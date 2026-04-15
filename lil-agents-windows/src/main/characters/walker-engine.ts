import { CharacterConfig, CharacterName, CharacterState, ProviderName } from '../../shared/types';

interface WalkerInternal {
  config: CharacterConfig;
  state: CharacterState;
  pauseRemaining: number;
  walkProgress: number;
  walkStartX: number;
  walkEndX: number;
  walkDuration: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class WalkerEngine {
  private walkers: WalkerInternal[] = [];
  private screenWidth: number;
  private readonly WALK_DURATION = 10000;
  private readonly MIN_PAUSE = 2000;
  private readonly MAX_PAUSE = 5000;
  private readonly MIN_WALK_DISTANCE = 200;
  private readonly MAX_WALK_DISTANCE = 325;
  private readonly MIN_SEPARATION_RATIO = 0.12;

  constructor(characters: CharacterConfig[], screenWidth: number) {
    this.screenWidth = screenWidth;
    this.walkers = characters.map((config, i) => {
      const startX = screenWidth * (0.3 + i * 0.4) + randomBetween(-50, 50);
      return {
        config,
        state: {
          name: config.name,
          x: Math.max(0, Math.min(startX, screenWidth)),
          y: 0,
          width: 0,
          height: 200,
          frame: 0,
          flipped: Math.random() > 0.5,
          isWalking: false,
          isBusy: false,
          bubbleText: null,
          provider: config.defaultProvider,
          size: 'large' as const,
          visible: true,
        },
        pauseRemaining: randomBetween(2000, 5000),
        walkProgress: 0,
        walkStartX: startX,
        walkEndX: startX,
        walkDuration: 10000,
      };
    });
  }

  getStates(): CharacterState[] {
    return this.walkers.map(w => ({ ...w.state }));
  }

  updateScreenWidth(width: number): void {
    this.screenWidth = width;
    for (const w of this.walkers) {
      w.state.x = Math.max(0, Math.min(w.state.x, width));
    }
  }

  setCharacterProvider(name: CharacterName, provider: ProviderName): void {
    const w = this.walkers.find(w => w.config.name === name);
    if (w) w.state.provider = provider;
  }

  setCharacterSize(name: CharacterName, size: 'large' | 'medium' | 'small'): void {
    const w = this.walkers.find(w => w.config.name === name);
    if (w) w.state.size = size;
  }

  setCharacterVisible(name: CharacterName, visible: boolean): void {
    const w = this.walkers.find(w => w.config.name === name);
    if (w) w.state.visible = visible;
  }

  setBusy(name: CharacterName, busy: boolean, bubbleText: string | null = null): void {
    const w = this.walkers.find(w => w.config.name === name);
    if (w) {
      w.state.isBusy = busy;
      w.state.bubbleText = bubbleText;
    }
  }

  tick(deltaMs: number): void {
    for (const w of this.walkers) {
      if (!w.state.visible) continue;
      if (!w.state.isWalking) {
        w.pauseRemaining -= deltaMs;
        if (w.pauseRemaining <= 0) {
          this.startWalk(w);
        }
      } else {
        w.walkProgress += deltaMs / w.walkDuration;
        if (w.walkProgress >= 1.0) {
          w.state.x = w.walkEndX;
          w.state.isWalking = false;
          w.state.frame = 0;
          w.pauseRemaining = randomBetween(this.MIN_PAUSE, this.MAX_PAUSE);
        } else {
          const t = easeInOutCubic(w.walkProgress);
          w.state.x = w.walkStartX + (w.walkEndX - w.walkStartX) * t;
          w.state.frame = Math.floor(w.walkProgress * w.config.walkCycle.totalFrames) % w.config.walkCycle.totalFrames;
        }
      }
    }
  }

  private startWalk(w: WalkerInternal): void {
    const distance = randomBetween(this.MIN_WALK_DISTANCE, this.MAX_WALK_DISTANCE);
    const goRight = Math.random() > 0.5;
    let targetX = goRight ? w.state.x + distance : w.state.x - distance;
    targetX = Math.max(50, Math.min(targetX, this.screenWidth - 50));

    const otherWalkers = this.walkers.filter(o => o !== w && o.state.visible);
    const minSep = this.screenWidth * this.MIN_SEPARATION_RATIO;
    for (const other of otherWalkers) {
      if (Math.abs(targetX - other.state.x) < minSep) {
        if (targetX > other.state.x) {
          targetX = Math.min(other.state.x + minSep, this.screenWidth - 50);
        } else {
          targetX = Math.max(other.state.x - minSep, 50);
        }
      }
    }

    w.walkStartX = w.state.x;
    w.walkEndX = targetX;
    w.walkProgress = 0;
    w.walkDuration = this.WALK_DURATION;
    w.state.isWalking = true;
    w.state.flipped = targetX < w.state.x;
  }
}
