import { app, ipcMain, nativeTheme, screen } from 'electron';
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

// Fix Windows GPU cache "Access is denied" errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');

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

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
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
  createOverlayWindow();

  // Create system tray
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
});

app.on('window-all-closed', () => {
  // Keep running in tray — do nothing
});

app.on('before-quit', () => {
  if (animationTimer) clearInterval(animationTimer);
  for (const name of ['bruce', 'jazz'] as CharacterName[]) {
    destroySession(name);
  }
  closeAllPopovers();
  destroyTray();
});
