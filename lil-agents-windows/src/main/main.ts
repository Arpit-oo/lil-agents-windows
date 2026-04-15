import { app, BrowserWindow } from 'electron';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(() => {
  console.log('lil-agents-windows starting...');
});

app.on('window-all-closed', () => {
  // Prevent app from quitting when all windows are closed — we're a tray app
});
