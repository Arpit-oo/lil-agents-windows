import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared/ipc-channels';
import { CharacterState } from '../shared/types';
import { getSelectedMonitor, getOverlayBounds } from './monitor';

let overlayWindow: BrowserWindow | null = null;

function resolveOverlayHtmlPath(): string {
  const distPath = path.join(__dirname, '..', 'renderer', 'overlay', 'index.html');
  if (fs.existsSync(distPath)) return distPath;
  return path.join(__dirname, '..', '..', 'src', 'renderer', 'overlay', 'index.html');
}

export function createOverlayWindow(): BrowserWindow {
  const monitor = getSelectedMonitor();
  const bounds = getOverlayBounds(monitor);

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(resolveOverlayHtmlPath());

  ipcMain.on(IPC.SET_CLICK_THROUGH, (_event, ignore: boolean, forward: boolean) => {
    overlayWindow?.setIgnoreMouseEvents(ignore, { forward });
  });

  overlayWindow.on('closed', () => { overlayWindow = null; });
  return overlayWindow;
}

export function getOverlayWindow(): BrowserWindow | null { return overlayWindow; }

export function sendToOverlay(channel: string, ...args: any[]): void {
  overlayWindow?.webContents.send(channel, ...args);
}

export function updateOverlayCharacters(states: CharacterState[]): void {
  sendToOverlay(IPC.UPDATE_CHARACTERS, states);
}

export function repositionOverlay(): void {
  if (!overlayWindow) return;
  const monitor = getSelectedMonitor();
  const bounds = getOverlayBounds(monitor);
  overlayWindow.setBounds(bounds);
}
