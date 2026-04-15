import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { CharacterState } from '../shared/types';

contextBridge.exposeInMainWorld('lilAgents', {
  onUpdateCharacters: (callback: (states: CharacterState[]) => void) => {
    ipcRenderer.on(IPC.UPDATE_CHARACTERS, (_event, states) => callback(states));
  },
  onThemeChanged: (callback: (isDark: boolean) => void) => {
    ipcRenderer.on(IPC.THEME_CHANGED, (_event, isDark) => callback(isDark));
  },
  characterClicked: (name: string) => {
    ipcRenderer.send(IPC.CHARACTER_CLICKED, name);
  },
  characterRightClicked: (name: string, screenX: number, screenY: number) => {
    ipcRenderer.send(IPC.CHARACTER_RIGHT_CLICKED, name, screenX, screenY);
  },
  reportReady: () => {
    ipcRenderer.send(IPC.OVERLAY_READY);
  },
  setClickThrough: (ignore: boolean, forward: boolean) => {
    ipcRenderer.send(IPC.SET_CLICK_THROUGH, ignore, forward);
  },
  onAnimationChanged: (callback: (name: string, filePath: string) => void) => {
    ipcRenderer.on('character:animation-changed', (_event, name, filePath) => callback(name, filePath));
  },
  onAnimationReset: (callback: (name: string) => void) => {
    ipcRenderer.on('character:animation-reset', (_event, name) => callback(name));
  },
});
