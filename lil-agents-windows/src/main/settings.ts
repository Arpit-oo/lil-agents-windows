import Store from 'electron-store';
import { AppSettings, ProviderName, CharacterSize } from '../shared/types';

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  selectedMonitor: 'auto',
  characters: {
    bruce: { visible: true, provider: 'claude', size: 'large' },
    jazz: { visible: true, provider: 'claude', size: 'large' },
  },
  providerPaths: {},
  openClaw: {
    gatewayURL: 'ws://localhost:3001',
    authToken: '',
    sessionPrefix: 'lil-agents',
    agentId: null,
  },
};

let store: Store<AppSettings>;

export function initSettings(): Store<AppSettings> {
  store = new Store<AppSettings>({
    name: 'lil-agents-settings',
    defaults: DEFAULT_SETTINGS,
  });
  return store;
}

export function getSettings(): Store<AppSettings> {
  if (!store) throw new Error('Settings not initialized. Call initSettings() first.');
  return store;
}
