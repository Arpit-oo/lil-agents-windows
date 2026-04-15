import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('terminalBridge', {
  onData: (cb: (data: string) => void) => {
    ipcRenderer.on('terminal:data', (_e, data) => cb(data));
  },
  onInit: (cb: (config: { isDark: boolean; title: string; characterName: string }) => void) => {
    ipcRenderer.on('terminal:init', (_e, config) => cb(config));
  },
  onThemeChanged: (cb: (isDark: boolean) => void) => {
    ipcRenderer.on('terminal:theme', (_e, isDark) => cb(isDark));
  },
  onExit: (cb: (code: number) => void) => {
    ipcRenderer.on('terminal:exit', (_e, code) => cb(code));
  },
  onChime: (cb: (customSoundPath: string | null) => void) => {
    ipcRenderer.on('terminal:chime', (_e, customPath) => cb(customPath));
  },
  sendInput: (data: string) => {
    ipcRenderer.send('terminal:input', data);
  },
  sendResize: (cols: number, rows: number) => {
    ipcRenderer.send('terminal:resize', cols, rows);
  },
  close: () => {
    ipcRenderer.send('terminal:close');
  },
  minimize: () => {
    ipcRenderer.send('terminal:minimize');
  },
});
