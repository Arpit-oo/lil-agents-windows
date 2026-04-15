import { app, dialog, ipcMain, Menu, nativeTheme, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipc-channels';
import { CharacterName, ProviderName, CharacterSize } from '../shared/types';
import { initSettings, getSettings } from './settings';
import { CHARACTERS, CHARACTER_SIZES } from './characters/character-config';
import { WalkerEngine } from './characters/walker-engine';
import { createOverlayWindow, getOverlayWindow, updateOverlayCharacters, repositionOverlay } from './overlay-window';
import { showPopover, sendToPopover, closeAllPopovers, getPopoverWindow } from './popover-window';
import { createSession, AgentSession, AgentSessionCallbacks } from './sessions/index';
import { createTray, destroyTray } from './tray';
import { getSelectedMonitor } from './monitor';
import { openTerminal, closeAllTerminals } from './terminal-window';

process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
});

app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[main] render-process-gone:', webContents.getURL(), details.reason, details.exitCode);
});

app.on('child-process-gone', (_event, details) => {
  console.error('[main] child-process-gone:', details.type, details.reason, details.exitCode);
});

// Fix Windows GPU cache "Access is denied" errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,UseSkiaRenderer');

// Disable GPU acceleration for reliable window rendering on Windows.
// transparent: true silently breaks rendering with GPU compositing.
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

function configureDevStoragePaths(): void {
  if (app.isPackaged) return;

  const profileRoot = path.join(app.getPath('temp'), 'lil-agents-windows-dev-profile');

  // Wipe stale cache to avoid lock conflicts from previous runs
  const cacheDir = path.join(profileRoot, 'cache');
  try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch {}

  const sessionDir = path.join(profileRoot, 'session');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  app.setPath('userData', profileRoot);
  app.setPath('sessionData', sessionDir);
  app.setPath('cache', cacheDir);
  app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
}

configureDevStoragePaths();

// Prevent Electron from quitting when no visible windows exist (tray app)
app.on('window-all-closed', () => {
  // Do nothing — app stays alive via tray
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[main] Another instance is already running; exiting this instance.');
  app.exit(0);
}

// State
let walkerEngine: WalkerEngine;
let sessions: Map<CharacterName, AgentSession> = new Map();
let animationTimer: ReturnType<typeof setInterval> | null = null;

// Sound
const SOUND_FILES = [
  'ping-aa.mp3', 'ping-bb.mp3', 'ping-cc.mp3', 'ping-dd.mp3',
  'ping-ee.mp3', 'ping-ff.mp3', 'ping-gg.mp3', 'ping-hh.mp3',
  'ping-jj.m4a',
];
let lastSoundIndex = -1;

function getRandomSound(): string {
  let index: number;
  do {
    index = Math.floor(Math.random() * SOUND_FILES.length);
  } while (index === lastSoundIndex && SOUND_FILES.length > 1);
  lastSoundIndex = index;
  return SOUND_FILES[index];
}

// Thinking bubble management
const THINKING_PHRASES = [
  'hmm...', 'thinking...', 'one sec...', 'ok hold on', 'let me check',
  'working on it', 'on it...', 'processing...', 'give me a moment',
  'let me see...', 'checking...', 'analyzing...', 'figuring it out',
  'looking into it', 'almost...', 'bear with me', 'just a sec',
  'running that...', 'computing...', 'crunching...', 'diving in',
  'exploring...', 'searching...', 'reading...', 'cooking...',
];
const COMPLETION_PHRASES = [
  'done!', 'all set!', 'ready!', 'here you go', 'got it!',
  'finished!', 'ta-da!', 'voila!', 'boom!', 'there ya go!',
  'check it out!', 'nailed it!',
];

const thinkingTimers: Map<CharacterName, ReturnType<typeof setInterval>> = new Map();

function startThinkingBubble(name: CharacterName): void {
  stopThinkingBubble(name);
  const rotatePhrases = () => {
    const phrase = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
    walkerEngine.setBusy(name, true, phrase);
  };
  rotatePhrases();
  const timer = setInterval(rotatePhrases, 3000 + Math.random() * 2000);
  thinkingTimers.set(name, timer);
}

function stopThinkingBubble(name: CharacterName): void {
  const timer = thinkingTimers.get(name);
  if (timer) {
    clearInterval(timer);
    thinkingTimers.delete(name);
  }
  walkerEngine.setBusy(name, false, null);
}

function showCompletionBubble(name: CharacterName): void {
  stopThinkingBubble(name);
  const phrase = COMPLETION_PHRASES[Math.floor(Math.random() * COMPLETION_PHRASES.length)];
  walkerEngine.setBusy(name, false, phrase);
  setTimeout(() => {
    walkerEngine.setBusy(name, false, null);
  }, 3000);
}

// Session management
function getOrCreateSession(name: CharacterName): AgentSession {
  let session = sessions.get(name);
  if (session?.isRunning) return session;

  const settings = getSettings();
  const charSettings = settings.get(`characters.${name}` as any) as any;
  const provider: ProviderName = charSettings?.provider || 'claude';

  session = createSession(provider);
  const callbacks: AgentSessionCallbacks = {
    onText: (text) => {
      sendToPopover(name, IPC.STREAM_TEXT, text);
    },
    onToolUse: (toolName, input) => {
      sendToPopover(name, IPC.TOOL_USE, toolName, input);
    },
    onToolResult: (result, isError) => {
      sendToPopover(name, IPC.TOOL_RESULT, result, isError);
    },
    onTurnComplete: () => {
      sendToPopover(name, IPC.TURN_COMPLETE);
      showCompletionBubble(name);

      // Play sound
      if (settings.get('soundEnabled')) {
        const soundFile = getRandomSound();
        const overlay = getOverlayWindow();
        if (overlay) {
          overlay.webContents.executeJavaScript(
            `new Audio('../../../assets/sounds/${soundFile}').play().catch(() => {})`
          );
        }
      }
    },
    onError: (error) => {
      sendToPopover(name, IPC.SESSION_ERROR, error);
      stopThinkingBubble(name);
    },
  };

  session.start(callbacks);
  sessions.set(name, session);
  return session;
}

function destroySession(name: CharacterName): void {
  const session = sessions.get(name);
  if (session) {
    session.stop();
    sessions.delete(name);
  }
  stopThinkingBubble(name);
}

function getTimeAgo(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// App ready
app.whenReady().then(() => {
  const settings = initSettings();
  const monitor = getSelectedMonitor();

  // Init walker engine
  walkerEngine = new WalkerEngine(CHARACTERS, monitor.bounds.width);

  // Apply saved settings to walker
  for (const char of CHARACTERS) {
    const charSettings = settings.get(`characters.${char.name}` as any) as any;
    if (charSettings) {
      walkerEngine.setCharacterVisible(char.name, charSettings.visible ?? true);
      walkerEngine.setCharacterSize(char.name, charSettings.size || 'large');
    }
  }

  // Create overlay window
  const overlayWin = createOverlayWindow();

  // Restore custom animations from settings after overlay loads
  overlayWin.webContents.on('did-finish-load', () => {
    for (const char of CHARACTERS) {
      const customAnim = settings.get(`characters.${char.name}.customAnimation` as any) as string | undefined;
      if (customAnim) {
        const fs = require('fs');
        if (fs.existsSync(customAnim)) {
          overlayWin.webContents.send('character:animation-changed', char.name, customAnim);
          console.log(`[main] Restored custom animation for ${char.name}: ${customAnim}`);
        } else {
          // File no longer exists, clear the setting
          settings.set(`characters.${char.name}.customAnimation` as any, undefined);
        }
      }
    }
  });

  // Create system tray (can be disabled in dev for diagnostics)
  if (process.env.LIL_AGENTS_NO_TRAY === '1') {
    console.warn('[main] Tray disabled via LIL_AGENTS_NO_TRAY=1');
  } else {
    createTray({
      onProviderChange: (name, provider) => {
        destroySession(name);
        walkerEngine.setCharacterProvider(name, provider);
      },
      onSizeChange: (name, size) => {
        walkerEngine.setCharacterSize(name, size);
      },
      onVisibilityChange: (name, visible) => {
        walkerEngine.setCharacterVisible(name, visible);
        if (!visible) destroySession(name);
      },
      onSoundToggle: (_enabled) => {},
      onMonitorChange: (_monitorId) => {
        const newMonitor = getSelectedMonitor();
        walkerEngine.updateScreenWidth(newMonitor.bounds.width);
        repositionOverlay();
      },
      onRefreshAll: () => {
        for (const name of ['bruce', 'jazz'] as CharacterName[]) {
          destroySession(name);
        }
      },
    });
  }

  // Animation loop (60fps)
  const FPS = 60;
  const frameTime = 1000 / FPS;
  let lastTick = Date.now();

  animationTimer = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    walkerEngine.tick(delta);
    const states = walkerEngine.getStates();

    // Update character heights based on size setting
    for (const state of states) {
      state.height = CHARACTER_SIZES[state.size];
      state.width = state.height * (1080 / 1920);
    }

    updateOverlayCharacters(states);
  }, frameTime);

  // IPC: Character clicked
  ipcMain.on(IPC.CHARACTER_CLICKED, (_event, name: CharacterName) => {
    const states = walkerEngine.getStates();
    const charState = states.find(s => s.name === name);
    if (!charState) return;

    const currentMonitor = getSelectedMonitor();
    getOrCreateSession(name);

    showPopover(
      name,
      currentMonitor.bounds.x + charState.x,
      currentMonitor.bounds.y + currentMonitor.bounds.height - charState.height - 60,
      charState.provider
    );
  });

  // IPC: Send message
  ipcMain.on(IPC.SEND_MESSAGE, (_event, text: string) => {
    for (const [name, session] of sessions) {
      const popover = getPopoverWindow(name);
      if (popover && popover.webContents === _event.sender) {
        startThinkingBubble(name);
        session.send(text);
        return;
      }
    }
  });

  // IPC: Slash command
  ipcMain.on(IPC.SLASH_COMMAND, (_event, cmd: string) => {
    if (cmd === 'clear') {
      for (const [name, session] of sessions) {
        const popover = getPopoverWindow(name);
        if (popover && popover.webContents === _event.sender) {
          session.stop();
          sessions.delete(name);
          break;
        }
      }
    }
  });

  // IPC: Refresh session
  ipcMain.on(IPC.REFRESH_SESSION, (_event) => {
    for (const name of ['bruce', 'jazz'] as CharacterName[]) {
      const popover = getPopoverWindow(name);
      if (popover && popover.webContents === _event.sender) {
        destroySession(name);
        getOrCreateSession(name);
        break;
      }
    }
  });

  // IPC: Copy last response
  ipcMain.on(IPC.COPY_LAST, (_event) => {
    _event.sender.send('get-last-response');
  });

  // IPC: Change provider
  ipcMain.on(IPC.CHANGE_PROVIDER, (_event, provider: ProviderName) => {
    for (const name of ['bruce', 'jazz'] as CharacterName[]) {
      const popover = getPopoverWindow(name);
      if (popover && popover.webContents === _event.sender) {
        destroySession(name);
        getSettings().set(`characters.${name}.provider` as any, provider);
        walkerEngine.setCharacterProvider(name, provider);
        getOrCreateSession(name);
        break;
      }
    }
  });

  // IPC: Character right-clicked — show session context menu instantly
  ipcMain.on('character:right-clicked', (_event, name: CharacterName, _screenX: number, _screenY: number) => {
    const { launchInPowerShell, listClaudeSessions, getClaudeLaunchCommand, projectDirToPath } = require('./sessions/claude-launcher');
    const { findBinary } = require('./shell-environment');

    // Helper: open any CLI tool in the mini-terminal
    const openInTerminal = async (binaryName: string, cliArgs: string[], cwd?: string) => {
      const binaryPath = await findBinary(binaryName as any);
      if (!binaryPath) {
        console.error(`[main] ${binaryName} CLI not found`);
        return;
      }
      const states = walkerEngine.getStates();
      const charState = states.find((s: any) => s.name === name);
      const currentMonitor = getSelectedMonitor();
      const x = currentMonitor.bounds.x + (charState?.x || 400);
      const y = currentMonitor.bounds.y + currentMonitor.bounds.height - 300;
      openTerminal(name, x, y, binaryPath, cliArgs, cwd);
    };

    // Read sessions from disk — instant, no CLI call
    const allSessions = listClaudeSessions();

    // Most recent project dir for context-aware commands
    const mostRecentCwd = allSessions.length > 0
      ? projectDirToPath(allSessions[0].projectDir)
      : undefined;

    const menuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'New Claude session',
        click: () => openInTerminal('claude', []),
      },
      {
        label: 'Continue last session',
        click: () => openInTerminal('claude', ['--continue'], mostRecentCwd),
      },
      {
        label: 'Pick session (interactive)',
        click: () => openInTerminal('claude', ['--resume'], mostRecentCwd),
      },
    ];

    // Add recent sessions grouped by project
    if (allSessions.length > 0) {
      menuItems.push({ type: 'separator' });
      menuItems.push({ label: `Recent sessions (${allSessions.length} total)`, enabled: false });

      for (const session of allSessions.slice(0, 12)) {
        const timeAgo = getTimeAgo(session.modifiedAt);
        const shortId = session.id.slice(0, 8);
        const projectLabel = session.projectDir.split('/').pop() || session.projectDir;
        const cwd = projectDirToPath(session.projectDir);
        menuItems.push({
          label: `${projectLabel} — ${shortId}... (${session.sizeKB}KB, ${timeAgo})`,
          click: () => openInTerminal('claude', ['--resume', session.id], cwd),
        });
      }
    }

    // Other AI tools submenu
    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: 'Other AI tools',
      submenu: [
        { label: 'Gemini CLI', click: () => openInTerminal('gemini', []) },
        { label: 'Codex', click: () => openInTerminal('codex', []) },
        { label: 'Copilot', click: () => openInTerminal('copilot', []) },
        { label: 'OpenCode', click: () => openInTerminal('opencode', []) },
      ],
    });

    // Character visibility + animation options
    menuItems.push({ type: 'separator' });

    const otherChar: CharacterName = name === 'bruce' ? 'jazz' : 'bruce';
    const otherLabel = otherChar === 'bruce' ? 'Bruce' : 'Jazz';
    const otherVisible = (getSettings().get(`characters.${otherChar}.visible` as any) as boolean) ?? true;

    if (otherVisible) {
      menuItems.push({
        label: `Hide ${otherLabel}`,
        click: () => {
          getSettings().set(`characters.${otherChar}.visible` as any, false);
          walkerEngine.setCharacterVisible(otherChar, false);
        },
      });
    } else {
      menuItems.push({
        label: `Show ${otherLabel}`,
        click: () => {
          getSettings().set(`characters.${otherChar}.visible` as any, true);
          walkerEngine.setCharacterVisible(otherChar, true);
        },
      });
    }

    menuItems.push({
      label: 'Change animation...',
      click: () => {
        dialog.showOpenDialog({
          title: `Choose animation for ${name === 'bruce' ? 'Bruce' : 'Jazz'}`,
          filters: [
            { name: 'Images', extensions: ['gif', 'png', 'webp', 'apng'] },
          ],
          properties: ['openFile'],
        }).then(result => {
          if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            getSettings().set(`characters.${name}.customAnimation` as any, filePath);
            const overlay = getOverlayWindow();
            if (overlay && !overlay.isDestroyed()) {
              overlay.webContents.send('character:animation-changed', name, filePath);
            }
          }
        });
      },
    });

    const currentCustom = getSettings().get(`characters.${name}.customAnimation` as any);
    if (currentCustom) {
      menuItems.push({
        label: 'Reset to original animation',
        click: () => {
          getSettings().set(`characters.${name}.customAnimation` as any, undefined);
          const overlay = getOverlayWindow();
          if (overlay && !overlay.isDestroyed()) {
            overlay.webContents.send('character:animation-reset', name);
          }
        },
      });
    }

    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: 'Set custom notification sound...',
      click: () => {
        dialog.showOpenDialog({
          title: 'Choose notification sound',
          filters: [
            { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
          ],
          properties: ['openFile'],
        }).then(result => {
          if (!result.canceled && result.filePaths.length > 0) {
            getSettings().set('customChime' as any, result.filePaths[0]);
          }
        });
      },
    });

    const currentChime = getSettings().get('customChime' as any);
    if (currentChime) {
      menuItems.push({
        label: 'Reset to default sounds',
        click: () => getSettings().set('customChime' as any, undefined),
      });
    }

    const menu = Menu.buildFromTemplate(menuItems);
    menu.popup();
  });

  // Theme changes
  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    const overlay = getOverlayWindow();
    overlay?.webContents.send(IPC.THEME_CHANGED, isDark);
    for (const name of ['bruce', 'jazz'] as CharacterName[]) {
      sendToPopover(name, IPC.THEME_CHANGED, isDark);
    }
  });

  // Monitor changes
  screen.on('display-added', () => repositionOverlay());
  screen.on('display-removed', () => repositionOverlay());
  screen.on('display-metrics-changed', () => repositionOverlay());

  console.log('[main] App fully initialized. Tray + overlay + animation running.');
});

app.on('before-quit', () => {
  console.log('[main] App quitting...');
  if (animationTimer) clearInterval(animationTimer);
  for (const name of ['bruce', 'jazz'] as CharacterName[]) {
    destroySession(name);
  }
  closeAllPopovers();
  closeAllTerminals();
  destroyTray();
});
