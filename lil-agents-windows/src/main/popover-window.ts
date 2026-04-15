import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared/ipc-channels';
import { CharacterName, ProviderName } from '../shared/types';

const popoverWindows: Map<CharacterName, BrowserWindow> = new Map();

function resolvePopoverHtmlPath(): string {
  const distPath = path.join(__dirname, '..', 'renderer', 'popover', 'index.html');
  if (fs.existsSync(distPath)) return distPath;
  return path.join(__dirname, '..', '..', 'src', 'renderer', 'popover', 'index.html');
}

export function showPopover(characterName: CharacterName, x: number, y: number, provider: ProviderName): BrowserWindow {
  let win = popoverWindows.get(characterName);
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }

  win = new BrowserWindow({
    width: 420,
    height: 350,
    x: Math.max(0, x - 210),
    y: Math.max(0, y - 360),
    frame: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'popover-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(resolvePopoverHtmlPath());
  win.once('ready-to-show', () => {
    win!.show();
    win!.webContents.send(IPC.THEME_CHANGED, nativeTheme.shouldUseDarkColors);
  });
  win.on('closed', () => { popoverWindows.delete(characterName); });
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape') win?.hide();
  });

  popoverWindows.set(characterName, win);
  return win;
}

export function getPopoverWindow(name: CharacterName): BrowserWindow | null {
  const win = popoverWindows.get(name);
  return win && !win.isDestroyed() ? win : null;
}

export function sendToPopover(name: CharacterName, channel: string, ...args: any[]): void {
  const win = getPopoverWindow(name);
  win?.webContents.send(channel, ...args);
}

export function hidePopover(name: CharacterName): void {
  getPopoverWindow(name)?.hide();
}

export function closeAllPopovers(): void {
  for (const [name, win] of popoverWindows) {
    if (!win.isDestroyed()) win.close();
  }
  popoverWindows.clear();
}
