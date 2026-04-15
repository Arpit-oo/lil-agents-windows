import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('lilAgents', {
  sendMessage: (text: string) => { ipcRenderer.send(IPC.SEND_MESSAGE, text); },
  slashCommand: (cmd: string) => { ipcRenderer.send(IPC.SLASH_COMMAND, cmd); },
  changeProvider: (provider: string) => { ipcRenderer.send(IPC.CHANGE_PROVIDER, provider); },
  refreshSession: () => { ipcRenderer.send(IPC.REFRESH_SESSION); },
  copyLast: () => { ipcRenderer.send(IPC.COPY_LAST); },
  onStreamText: (cb: (text: string) => void) => { ipcRenderer.on(IPC.STREAM_TEXT, (_e, text) => cb(text)); },
  onToolUse: (cb: (name: string, input: string) => void) => { ipcRenderer.on(IPC.TOOL_USE, (_e, name, input) => cb(name, input)); },
  onToolResult: (cb: (result: string, isError: boolean) => void) => { ipcRenderer.on(IPC.TOOL_RESULT, (_e, result, isError) => cb(result, isError)); },
  onTurnComplete: (cb: () => void) => { ipcRenderer.on(IPC.TURN_COMPLETE, () => cb()); },
  onSessionError: (cb: (error: string) => void) => { ipcRenderer.on(IPC.SESSION_ERROR, (_e, error) => cb(error)); },
  onSessionClear: (cb: () => void) => { ipcRenderer.on(IPC.SESSION_CLEAR, () => cb()); },
  onThemeChanged: (cb: (isDark: boolean) => void) => { ipcRenderer.on(IPC.THEME_CHANGED, (_e, isDark) => cb(isDark)); },
  reportReady: () => { ipcRenderer.send(IPC.POPOVER_READY); },
});
