import { describe, it, expect } from 'vitest';
import { FALLBACK_PATHS, PROVIDER_BINARY_NAMES, getBinaryName } from '../src/main/shell-environment';

describe('ShellEnvironment constants', () => {
  it('defines fallback paths for Windows', () => {
    expect(FALLBACK_PATHS.length).toBeGreaterThan(0);
    expect(FALLBACK_PATHS.some(p => p.includes('npm'))).toBe(true);
  });

  it('maps all providers to binary names', () => {
    const providers = ['claude', 'codex', 'copilot', 'gemini', 'opencode'] as const;
    for (const p of providers) {
      expect(getBinaryName(p)).toBeTruthy();
      expect(typeof getBinaryName(p)).toBe('string');
    }
  });

  it('openclaw has no binary (websocket-based)', () => {
    expect(getBinaryName('openclaw')).toBeNull();
  });
});
