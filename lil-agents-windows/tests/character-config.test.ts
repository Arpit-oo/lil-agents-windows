import { describe, it, expect } from 'vitest';
import { CHARACTERS, getCharacter, CHARACTER_SIZES } from '../src/main/characters/character-config';

describe('Character configuration', () => {
  it('defines Bruce and Jazz', () => {
    expect(CHARACTERS).toHaveLength(2);
    expect(CHARACTERS[0].name).toBe('bruce');
    expect(CHARACTERS[1].name).toBe('jazz');
  });

  it('getCharacter returns correct config', () => {
    const bruce = getCharacter('bruce');
    expect(bruce.displayName).toBe('Bruce');
    expect(bruce.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(bruce.walkCycle.totalFrames).toBeGreaterThan(0);
  });

  it('character sizes map to pixel heights', () => {
    expect(CHARACTER_SIZES.large).toBe(200);
    expect(CHARACTER_SIZES.medium).toBe(150);
    expect(CHARACTER_SIZES.small).toBe(100);
  });

  it('each character has a sprite directory', () => {
    for (const char of CHARACTERS) {
      expect(char.spriteDir).toMatch(/^sprites\//);
    }
  });
});
