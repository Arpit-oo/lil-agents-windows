import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/main/settings';
import { AppSettings } from '../src/shared/types';

describe('Settings defaults', () => {
  it('has correct default structure', () => {
    const s: AppSettings = DEFAULT_SETTINGS;
    expect(s.soundEnabled).toBe(true);
    expect(s.selectedMonitor).toBe('auto');
    expect(s.characters.bruce.visible).toBe(true);
    expect(s.characters.bruce.provider).toBe('claude');
    expect(s.characters.bruce.size).toBe('large');
    expect(s.characters.jazz.visible).toBe(true);
    expect(s.characters.jazz.provider).toBe('claude');
    expect(s.characters.jazz.size).toBe('large');
    expect(s.openClaw.gatewayURL).toBe('ws://localhost:3001');
  });
});
