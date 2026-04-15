import { CharacterConfig, CharacterName, CharacterSize } from '../../shared/types';

export const CHARACTER_SIZES: Record<CharacterSize, number> = {
  large: 200,
  medium: 150,
  small: 100,
};

const BRUCE_CONFIG: CharacterConfig = {
  name: 'bruce',
  displayName: 'Bruce',
  color: '#66B88C',
  spriteDir: 'sprites/bruce',
  walkCycle: {
    totalFrames: 301,
    accelEndFrame: 90,
    fullSpeedEndFrame: 112,
    decelEndFrame: 240,
    stopEndFrame: 255,
  },
  yOffset: -3,
  defaultProvider: 'claude',
};

const JAZZ_CONFIG: CharacterConfig = {
  name: 'jazz',
  displayName: 'Jazz',
  color: '#FF6600',
  spriteDir: 'sprites/jazz',
  walkCycle: {
    totalFrames: 301,
    accelEndFrame: 117,
    fullSpeedEndFrame: 135,
    decelEndFrame: 240,
    stopEndFrame: 262,
  },
  yOffset: -7,
  defaultProvider: 'claude',
};

export const CHARACTERS: CharacterConfig[] = [BRUCE_CONFIG, JAZZ_CONFIG];

export function getCharacter(name: CharacterName): CharacterConfig {
  const config = CHARACTERS.find(c => c.name === name);
  if (!config) throw new Error(`Unknown character: ${name}`);
  return config;
}
