import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared/ipc-channels';
import { CharacterState } from '../shared/types';
import { getSelectedMonitor, getOverlayBounds } from './monitor';

let overlayWindow: BrowserWindow | null = null;
let clickThroughListenerRegistered = false;
let recreateTimer: ReturnType<typeof setTimeout> | null = null;

function resolveOverlayHtmlPath(): string {
  const distPath = path.join(__dirname, '..', 'renderer', 'overlay', 'index.html');
  if (fs.existsSync(distPath)) return distPath;
  const srcPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'overlay', 'index.html');
  if (fs.existsSync(srcPath)) return srcPath;
  console.error('[overlay] Could not find index.html at:', distPath, 'or', srcPath);
  return srcPath;
}

export function createOverlayWindow(): BrowserWindow {
  const monitor = getSelectedMonitor();
  const bounds = getOverlayBounds(monitor);
  const htmlPath = resolveOverlayHtmlPath();

  // GPU is disabled via --disable-gpu in main.ts, so transparent: true
  // works reliably with software compositing on Windows.
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
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.webContents.on('did-fail-load', (_e: any, code: number, desc: string) => {
    console.error('[overlay] did-fail-load:', code, desc);
  });
  overlayWindow.webContents.on('render-process-gone', (_e: any, details: any) => {
    console.error('[overlay] render-process-gone:', JSON.stringify(details));
    overlayWindow = null;
    if (recreateTimer) clearTimeout(recreateTimer);
    recreateTimer = setTimeout(() => {
      recreateTimer = null;
      console.warn('[overlay] Recreating overlay after renderer crash...');
      createOverlayWindow();
    }, 800);
  });

  overlayWindow.on('ready-to-show', () => {
    overlayWindow?.showInactive();
  });

  overlayWindow.loadFile(htmlPath);

  if (!clickThroughListenerRegistered) {
    ipcMain.on(IPC.SET_CLICK_THROUGH, (_event, ignore: boolean, forward: boolean) => {
      overlayWindow?.setIgnoreMouseEvents(ignore, { forward });
    });
    clickThroughListenerRegistered = true;
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
  return overlayWindow;
}

export function getOverlayWindow(): BrowserWindow | null { return overlayWindow; }

export function sendToOverlay(channel: string, ...args: any[]): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  try {
    overlayWindow.webContents.send(channel, ...args);
  } catch (error) {
    console.warn('[overlay] sendToOverlay failed:', error);
  }
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
