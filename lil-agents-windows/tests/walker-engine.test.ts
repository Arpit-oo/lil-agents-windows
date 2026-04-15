import { describe, it, expect, beforeEach } from 'vitest';
import { WalkerEngine } from '../src/main/characters/walker-engine';

// Inline character configs to avoid cross-dependency
const TEST_CHARACTERS = [
  {
    name: 'bruce' as const,
    displayName: 'Bruce',
    color: '#66B88C',
    spriteDir: 'sprites/bruce',
    walkCycle: { totalFrames: 300, accelEndFrame: 90, fullSpeedEndFrame: 112, decelEndFrame: 240, stopEndFrame: 255 },
    yOffset: -3,
    defaultProvider: 'claude' as const,
  },
  {
    name: 'jazz' as const,
    displayName: 'Jazz',
    color: '#FF6600',
    spriteDir: 'sprites/jazz',
    walkCycle: { totalFrames: 300, accelEndFrame: 117, fullSpeedEndFrame: 135, decelEndFrame: 240, stopEndFrame: 262 },
    yOffset: -7,
    defaultProvider: 'claude' as const,
  },
];

describe('WalkerEngine', () => {
  let engine: WalkerEngine;
  const screenWidth = 1920;

  beforeEach(() => {
    engine = new WalkerEngine(TEST_CHARACTERS, screenWidth);
  });

  it('initializes two characters', () => {
    const states = engine.getStates();
    expect(states).toHaveLength(2);
    expect(states[0].name).toBe('bruce');
    expect(states[1].name).toBe('jazz');
  });

  it('characters start paused', () => {
    const states = engine.getStates();
    expect(states[0].isWalking).toBe(false);
    expect(states[1].isWalking).toBe(false);
  });

  it('tick advances state over time', () => {
    const before = engine.getStates().map(s => ({ ...s }));
    for (let i = 0; i < 300; i++) {
      engine.tick(16.67);
    }
    const after = engine.getStates();
    const moved = after.some((s, i) => s.x !== before[i].x || s.isWalking);
    expect(moved).toBe(true);
  });

  it('updateScreenWidth clamps positions', () => {
    engine.updateScreenWidth(800);
    const states = engine.getStates();
    for (const s of states) {
      expect(s.x).toBeLessThanOrEqual(800);
    }
  });

  it('setCharacterVisible hides a character', () => {
    engine.setCharacterVisible('bruce', false);
    expect(engine.getStates()[0].visible).toBe(false);
  });

  it('setBusy sets thinking state', () => {
    engine.setBusy('bruce', true, 'thinking...');
    const state = engine.getStates()[0];
    expect(state.isBusy).toBe(true);
    expect(state.bubbleText).toBe('thinking...');
  });
});
