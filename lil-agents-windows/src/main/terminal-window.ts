import { BrowserWindow, Notification, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CharacterName } from '../shared/types';
import { getSettings } from './settings';

const pty = require('node-pty');

interface TerminalInstance {
  window: BrowserWindow;
  ptyProcess: any;
}

const terminals: Map<string, TerminalInstance> = new Map();

function resolveTerminalHtmlPath(): string {
  const distPath = path.join(__dirname, '..', 'renderer', 'terminal', 'index.html');
  if (fs.existsSync(distPath)) return distPath;
  const srcPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'terminal', 'index.html');
  if (fs.existsSync(srcPath)) return srcPath;
  return srcPath;
}

export function openTerminal(
  characterName: CharacterName,
  x: number,
  y: number,
  claudePath: string,
  claudeArgs: string[],
  cwd?: string,
): void {
  // Create a unique key for this terminal
  const key = `${characterName}-${Date.now()}`;

  const win = new BrowserWindow({
    width: 700,
    height: 480,
    x: Math.max(0, x - 350),
    y: Math.max(0, y - 500),
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a2e' : '#fefefe',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'terminal-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Spawn the PTY process
  const shell = claudePath;
  const workDir = cwd || process.cwd();
  const env = { ...process.env };
  delete env.CLAUDE_CODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const ptyProcess = pty.spawn(shell, claudeArgs, {
    name: 'xterm-256color',
    cols: 100,
    rows: 30,
    cwd: workDir,
    env,
  });

  const terminalKey = key;

  // Idle detection: play chime when Claude finishes responding
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let receivedData = false;
  const IDLE_MS = 2000; // 2 seconds of silence = response done

  // PTY → renderer
  ptyProcess.onData((data: string) => {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:data', data);
    }

    // Reset idle timer on each data chunk
    receivedData = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (receivedData && !win.isDestroyed()) {
        // Send chime with custom sound path if set
        const customChime = getSettings().get('customChime' as any) as string | undefined;
        win.webContents.send('terminal:chime', customChime || null);
        receivedData = false;

        // System tray notification (only if window is not focused)
        if (!win.isFocused() && Notification.isSupported()) {
          new Notification({
            title: 'Claude Code',
            body: 'Response ready',
            silent: true, // We play our own sound
          }).show();
        }
      }
    }, IDLE_MS);
  });

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    console.log(`[terminal] PTY exited with code ${exitCode}`);
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:exit', exitCode);
    }
  });

  win.loadFile(resolveTerminalHtmlPath());

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('terminal:init', {
      isDark: nativeTheme.shouldUseDarkColors,
      title: claudeArgs.includes('--resume') ? 'Claude Code (resumed)' : 'Claude Code',
      characterName,
    });
  });

  // Renderer → PTY (input)
  const { ipcMain } = require('electron');
  const inputHandler = (_event: any, data: string) => {
    if (_event.sender === win.webContents) {
      ptyProcess.write(data);
    }
  };
  const resizeHandler = (_event: any, cols: number, rows: number) => {
    if (_event.sender === win.webContents) {
      try { ptyProcess.resize(cols, rows); } catch {}
    }
  };

  const minimizeHandler = (_event: any) => {
    if (_event.sender === win.webContents) {
      win.minimize();
    }
  };

  ipcMain.on('terminal:input', inputHandler);
  ipcMain.on('terminal:resize', resizeHandler);
  ipcMain.on('terminal:minimize', minimizeHandler);

  win.on('closed', () => {
    ipcMain.removeListener('terminal:input', inputHandler);
    ipcMain.removeListener('terminal:resize', resizeHandler);
    ipcMain.removeListener('terminal:minimize', minimizeHandler);
    try { ptyProcess.kill(); } catch {}
    terminals.delete(terminalKey);
  });

  // Handle close button from renderer
  ipcMain.on('terminal:close', (_event: any) => {
    if (_event.sender === win.webContents) {
      win.close();
    }
  });

  // Theme changes
  nativeTheme.on('updated', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:theme', nativeTheme.shouldUseDarkColors);
    }
  });

  terminals.set(key, { window: win, ptyProcess });
}

export function closeAllTerminals(): void {
  for (const [key, terminal] of terminals) {
    if (!terminal.window.isDestroyed()) terminal.window.close();
    try { terminal.ptyProcess.kill(); } catch {}
  }
  terminals.clear();
}
