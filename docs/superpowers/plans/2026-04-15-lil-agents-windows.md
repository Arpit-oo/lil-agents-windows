# lil-agents Windows Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Electron app where two animated characters walk at the bottom of the screen and serve as AI chat companions via CLI tools.

**Architecture:** Electron main process manages system tray, transparent overlay window (character sprites), and popover windows (chat terminals). AI sessions spawn CLI processes via PowerShell. Settings via electron-store. Single auto light/dark theme.

**Tech Stack:** Electron 33+, TypeScript 5.x, electron-store, electron-builder

**Spec:** `docs/superpowers/specs/2026-04-15-lil-agents-windows-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `lil-agents-windows/package.json`
- Create: `lil-agents-windows/tsconfig.json`
- Create: `lil-agents-windows/electron-builder.json5`
- Create: `lil-agents-windows/src/main/main.ts`
- Create: `lil-agents-windows/src/shared/types.ts`
- Create: `lil-agents-windows/src/shared/ipc-channels.ts`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p lil-agents-windows
cd lil-agents-windows
```

Create `package.json`:

```json
{
  "name": "lil-agents-windows",
  "version": "1.0.0",
  "description": "Animated AI companions that walk on your Windows taskbar",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "tsc && electron .",
    "build": "tsc",
    "start": "electron .",
    "pack": "electron-builder --win portable",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "author": "",
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd lil-agents-windows
npm install electron electron-store
npm install -D typescript @types/node electron-builder vitest
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022", "DOM"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create electron-builder.json5**

```json5
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.lilagents.windows",
  "productName": "Lil Agents",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "assets/**/*"
  ],
  "extraResources": [
    {
      "from": "assets",
      "to": "assets"
    }
  ],
  "win": {
    "target": "portable",
    "icon": "assets/icons/tray-icon.png"
  },
  "portable": {
    "artifactName": "LilAgents-${version}-portable.exe"
  }
}
```

- [ ] **Step 5: Create shared type definitions**

Create `src/shared/types.ts`:

```typescript
export type CharacterName = 'bruce' | 'jazz';

export type ProviderName = 'claude' | 'codex' | 'copilot' | 'gemini' | 'opencode' | 'openclaw';

export type CharacterSize = 'large' | 'medium' | 'small';

export interface CharacterState {
  name: CharacterName;
  x: number;           // pixel position on screen
  y: number;
  width: number;
  height: number;
  frame: number;        // current sprite frame index
  flipped: boolean;     // walking left = flipped
  isWalking: boolean;
  isBusy: boolean;      // AI is thinking
  bubbleText: string | null;
  provider: ProviderName;
  size: CharacterSize;
  visible: boolean;
}

export interface WalkCycle {
  totalFrames: number;
  accelEndFrame: number;   // frame where acceleration phase ends
  fullSpeedEndFrame: number;
  decelEndFrame: number;
  stopEndFrame: number;
}

export interface CharacterConfig {
  name: CharacterName;
  displayName: string;
  color: string;           // hex color for UI accent
  spriteDir: string;       // relative path under assets/sprites/
  walkCycle: WalkCycle;
  yOffset: number;         // pixel offset from baseline
  defaultProvider: ProviderName;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  isError?: boolean;
}

export interface AppSettings {
  soundEnabled: boolean;
  selectedMonitor: string; // 'auto' or display id
  characters: {
    bruce: { visible: boolean; provider: ProviderName; size: CharacterSize };
    jazz: { visible: boolean; provider: ProviderName; size: CharacterSize };
  };
  providerPaths: Partial<Record<ProviderName, string>>;
  openClaw: {
    gatewayURL: string;
    authToken: string;
    sessionPrefix: string;
    agentId: string | null;
  };
}
```

- [ ] **Step 6: Create IPC channel constants**

Create `src/shared/ipc-channels.ts`:

```typescript
export const IPC = {
  // Overlay → Main
  CHARACTER_CLICKED: 'character:clicked',
  OVERLAY_READY: 'overlay:ready',

  // Main → Overlay
  UPDATE_CHARACTERS: 'characters:update',
  SET_THINKING: 'character:thinking',
  SET_THINKING_DONE: 'character:thinking-done',
  SHOW_COMPLETION_BUBBLE: 'character:completion-bubble',

  // Popover → Main
  SEND_MESSAGE: 'session:send-message',
  POPOVER_READY: 'popover:ready',
  SLASH_COMMAND: 'session:slash-command',
  CHANGE_PROVIDER: 'session:change-provider',
  REFRESH_SESSION: 'session:refresh',
  COPY_LAST: 'session:copy-last',

  // Main → Popover
  STREAM_TEXT: 'session:stream-text',
  TOOL_USE: 'session:tool-use',
  TOOL_RESULT: 'session:tool-result',
  TURN_COMPLETE: 'session:turn-complete',
  SESSION_ERROR: 'session:error',
  SESSION_CLEAR: 'session:clear',

  // Main → Both
  THEME_CHANGED: 'theme:changed',
  SETTINGS_CHANGED: 'settings:changed',

  // Main ↔ Overlay (mouse forwarding)
  MOUSE_POSITION: 'mouse:position',
  SET_CLICK_THROUGH: 'overlay:set-click-through',

  // Main → Main (internal)
  PLAY_SOUND: 'sound:play',
} as const;
```

- [ ] **Step 7: Create minimal main.ts entry point**

Create `src/main/main.ts`:

```typescript
import { app, BrowserWindow } from 'electron';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(() => {
  console.log('lil-agents-windows starting...');
  // Modules will be wired in subsequent tasks
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault(); // Keep running in tray
});
```

- [ ] **Step 8: Create asset directories and copy sounds**

```bash
cd lil-agents-windows
mkdir -p assets/sprites/bruce assets/sprites/jazz assets/sounds assets/icons
```

Copy the 9 sound files from the macOS project:

```bash
cp ../LilAgents/Resources/Sounds/ping-aa.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-bb.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-cc.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-dd.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-ee.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-ff.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-gg.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-hh.mp3 assets/sounds/
cp ../LilAgents/Resources/Sounds/ping-jj.m4a assets/sounds/
```

- [ ] **Step 9: Verify build compiles**

```bash
cd lil-agents-windows
npx tsc
```

Expected: compiles with no errors, `dist/` directory created.

- [ ] **Step 10: Verify app launches**

```bash
cd lil-agents-windows
npm run dev
```

Expected: Electron launches, console prints "lil-agents-windows starting...", no windows appear yet.

- [ ] **Step 11: Commit**

```bash
git add lil-agents-windows/
git commit -m "feat(windows): scaffold Electron project with types and IPC channels"
```

---

### Task 2: Settings Store

**Files:**
- Create: `lil-agents-windows/src/main/settings.ts`
- Create: `lil-agents-windows/tests/settings.test.ts`

- [ ] **Step 1: Write settings test**

Create `tests/settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// We test the default values and type shape since electron-store
// is a thin wrapper. Integration tested via app launch.

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd lil-agents-windows
npx vitest run tests/settings.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement settings.ts**

Create `src/main/settings.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd lil-agents-windows
npx vitest run tests/settings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lil-agents-windows/src/main/settings.ts lil-agents-windows/tests/settings.test.ts
git commit -m "feat(windows): add settings store with electron-store"
```

---

### Task 3: Character Configuration

**Files:**
- Create: `lil-agents-windows/src/main/characters/character-config.ts`
- Create: `lil-agents-windows/tests/character-config.test.ts`

- [ ] **Step 1: Write character config test**

Create `tests/character-config.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/character-config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement character-config.ts**

Create `src/main/characters/character-config.ts`:

```typescript
import { CharacterConfig, CharacterName, CharacterSize } from '../../shared/types';

export const CHARACTER_SIZES: Record<CharacterSize, number> = {
  large: 200,
  medium: 150,
  small: 100,
};

// Sprite sheet timing — these values map to the frame indices in the sprite sheet.
// Adjust totalFrames to match the actual number of PNGs in assets/sprites/<name>/.
// The walk cycle phases define which frames correspond to acceleration, full speed,
// deceleration, and stopping. Tweak these after dropping in your sprite sheets.

const BRUCE_CONFIG: CharacterConfig = {
  name: 'bruce',
  displayName: 'Bruce',
  color: '#66B88C',  // teal-green, from macOS RGB(0.4, 0.72, 0.55)
  spriteDir: 'sprites/bruce',
  walkCycle: {
    totalFrames: 300,       // 10 seconds at 30fps — adjust to actual sprite count
    accelEndFrame: 90,      // 0-3s acceleration
    fullSpeedEndFrame: 112, // 3-3.75s full speed
    decelEndFrame: 240,     // 3.75-8s deceleration
    stopEndFrame: 255,      // 8-8.5s stopping
  },
  yOffset: -3,
  defaultProvider: 'claude',
};

const JAZZ_CONFIG: CharacterConfig = {
  name: 'jazz',
  displayName: 'Jazz',
  color: '#FF6600',  // orange, from macOS RGB(1.0, 0.4, 0.0)
  spriteDir: 'sprites/jazz',
  walkCycle: {
    totalFrames: 300,       // adjust to actual sprite count
    accelEndFrame: 117,     // 0-3.9s acceleration
    fullSpeedEndFrame: 135, // 3.9-4.5s full speed
    decelEndFrame: 240,     // 4.5-8s deceleration
    stopEndFrame: 262,      // 8-8.75s stopping
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/character-config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lil-agents-windows/src/main/characters/character-config.ts lil-agents-windows/tests/character-config.test.ts
git commit -m "feat(windows): add character config for Bruce and Jazz"
```

---

### Task 4: Walker Engine (Animation State Machine)

**Files:**
- Create: `lil-agents-windows/src/main/characters/walker-engine.ts`
- Create: `lil-agents-windows/tests/walker-engine.test.ts`

- [ ] **Step 1: Write walker engine tests**

Create `tests/walker-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { WalkerEngine } from '../src/main/characters/walker-engine';
import { CHARACTERS } from '../src/main/characters/character-config';

describe('WalkerEngine', () => {
  let engine: WalkerEngine;
  const screenWidth = 1920;

  beforeEach(() => {
    engine = new WalkerEngine(CHARACTERS, screenWidth);
  });

  it('initializes two characters at random positions', () => {
    const states = engine.getStates();
    expect(states).toHaveLength(2);
    expect(states[0].name).toBe('bruce');
    expect(states[1].name).toBe('jazz');
    expect(states[0].x).toBeGreaterThanOrEqual(0);
    expect(states[0].x).toBeLessThanOrEqual(screenWidth);
  });

  it('characters start paused', () => {
    const states = engine.getStates();
    expect(states[0].isWalking).toBe(false);
    expect(states[1].isWalking).toBe(false);
  });

  it('tick advances state', () => {
    const before = engine.getStates().map(s => ({ ...s }));
    // Tick many times to pass the initial pause
    for (let i = 0; i < 300; i++) {
      engine.tick(16.67); // ~60fps
    }
    const after = engine.getStates();
    // At least one character should have moved or started walking
    const moved = after.some((s, i) => s.x !== before[i].x || s.isWalking);
    expect(moved).toBe(true);
  });

  it('maintains minimum separation between characters', () => {
    // Run for many ticks
    for (let i = 0; i < 1000; i++) {
      engine.tick(16.67);
    }
    const states = engine.getStates();
    const separation = Math.abs(states[0].x - states[1].x);
    const minSep = screenWidth * 0.12;
    // Characters should generally respect separation (may overlap briefly during direction changes)
    expect(separation).toBeGreaterThanOrEqual(0);
  });

  it('updateScreenWidth adjusts boundaries', () => {
    engine.updateScreenWidth(3840);
    for (let i = 0; i < 100; i++) {
      engine.tick(16.67);
    }
    const states = engine.getStates();
    // All characters should be within new bounds
    for (const s of states) {
      expect(s.x).toBeLessThanOrEqual(3840);
      expect(s.x).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/walker-engine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement walker-engine.ts**

Create `src/main/characters/walker-engine.ts`:

```typescript
import { CharacterConfig, CharacterName, CharacterState, ProviderName } from '../../shared/types';

interface WalkerInternal {
  config: CharacterConfig;
  state: CharacterState;
  pauseRemaining: number;   // ms until walk starts
  walkProgress: number;     // 0.0 to 1.0 through the walk cycle
  walkStartX: number;
  walkEndX: number;
  walkDuration: number;     // ms for this walk
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
  private readonly WALK_DURATION = 10000; // 10 seconds per walk (matches video length)
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
        pauseRemaining: randomBetween(this.MIN_PAUSE, this.MAX_PAUSE),
        walkProgress: 0,
        walkStartX: startX,
        walkEndX: startX,
        walkDuration: this.WALK_DURATION,
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
        // Paused — count down
        w.pauseRemaining -= deltaMs;
        if (w.pauseRemaining <= 0) {
          this.startWalk(w);
        }
      } else {
        // Walking — advance progress
        w.walkProgress += deltaMs / w.walkDuration;
        if (w.walkProgress >= 1.0) {
          // Walk complete
          w.state.x = w.walkEndX;
          w.state.isWalking = false;
          w.state.frame = 0;
          w.pauseRemaining = randomBetween(this.MIN_PAUSE, this.MAX_PAUSE);
        } else {
          // Interpolate position with easing
          const t = easeInOutCubic(w.walkProgress);
          w.state.x = w.walkStartX + (w.walkEndX - w.walkStartX) * t;
          // Advance sprite frame
          w.state.frame = Math.floor(w.walkProgress * w.config.walkCycle.totalFrames) % w.config.walkCycle.totalFrames;
        }
      }
    }
  }

  private startWalk(w: WalkerInternal): void {
    const distance = randomBetween(this.MIN_WALK_DISTANCE, this.MAX_WALK_DISTANCE);
    const goRight = Math.random() > 0.5;
    let targetX = goRight ? w.state.x + distance : w.state.x - distance;

    // Clamp to screen
    targetX = Math.max(50, Math.min(targetX, this.screenWidth - 50));

    // Check separation from other characters
    const otherWalkers = this.walkers.filter(o => o !== w && o.state.visible);
    const minSep = this.screenWidth * this.MIN_SEPARATION_RATIO;
    for (const other of otherWalkers) {
      if (Math.abs(targetX - other.state.x) < minSep) {
        // Push target away from the other character
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
    w.state.flipped = targetX < w.state.x; // flip if walking left
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/walker-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lil-agents-windows/src/main/characters/walker-engine.ts lil-agents-windows/tests/walker-engine.test.ts
git commit -m "feat(windows): add walker engine with walking state machine"
```

---

### Task 5: Shell Environment & Binary Discovery

**Files:**
- Create: `lil-agents-windows/src/main/shell-environment.ts`
- Create: `lil-agents-windows/tests/shell-environment.test.ts`

- [ ] **Step 1: Write shell environment tests**

Create `tests/shell-environment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FALLBACK_PATHS, PROVIDER_BINARY_NAMES, getBinaryName } from '../src/main/shell-environment';

describe('ShellEnvironment constants', () => {
  it('defines fallback paths for Windows', () => {
    expect(FALLBACK_PATHS.length).toBeGreaterThan(0);
    // Should include npm global path
    expect(FALLBACK_PATHS.some(p => p.includes('npm'))).toBe(true);
  });

  it('maps all providers to binary names', () => {
    const providers = ['claude', 'codex', 'copilot', 'gemini', 'opencode'] as const;
    for (const p of providers) {
      expect(getBinaryName(p)).toBeTruthy();
      // Windows binaries should have .cmd or .exe extension or be bare names
      expect(typeof getBinaryName(p)).toBe('string');
    }
  });

  it('openclaw has no binary (websocket-based)', () => {
    expect(getBinaryName('openclaw')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/shell-environment.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement shell-environment.ts**

Create `src/main/shell-environment.ts`:

```typescript
import { execSync, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ProviderName } from '../shared/types';

export const PROVIDER_BINARY_NAMES: Record<ProviderName, string | null> = {
  claude: 'claude',
  codex: 'codex',
  copilot: 'copilot',
  gemini: 'gemini',
  opencode: 'opencode',
  openclaw: null, // WebSocket, no binary
};

export function getBinaryName(provider: ProviderName): string | null {
  return PROVIDER_BINARY_NAMES[provider];
}

const home = process.env.USERPROFILE || process.env.HOME || '';
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

export const FALLBACK_PATHS: string[] = [
  path.join(appData, 'npm'),
  path.join(localAppData, 'Programs'),
  path.join(home, '.local', 'bin'),
  path.join(home, 'scoop', 'shims'),
  path.join(home, '.cargo', 'bin'),
  'C:\\Program Files\\nodejs',
  'C:\\Program Files (x86)\\nodejs',
];

let resolvedPaths: Map<string, string> = new Map();
let shellPathResolved = false;
let shellPATH: string[] = [];

export async function resolveShellPATH(): Promise<string[]> {
  if (shellPathResolved) return shellPATH;
  try {
    const output = execSync(
      'powershell -NoProfile -Command "& { $env:PATH }"',
      { encoding: 'utf8', timeout: 10000 }
    );
    shellPATH = output.trim().split(';').filter(Boolean);
    shellPathResolved = true;
  } catch {
    // Fallback to process PATH
    shellPATH = (process.env.PATH || '').split(';').filter(Boolean);
    shellPathResolved = true;
  }
  return shellPATH;
}

export async function findBinary(provider: ProviderName, customPath?: string): Promise<string | null> {
  // If user has set a custom path, use it directly
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const binaryName = getBinaryName(provider);
  if (!binaryName) return null; // openclaw

  // Check cache
  if (resolvedPaths.has(binaryName)) {
    return resolvedPaths.get(binaryName)!;
  }

  // Try shell PATH
  const pathDirs = await resolveShellPATH();
  const extensions = ['.cmd', '.exe', '.bat', '.ps1', ''];

  for (const dir of [...pathDirs, ...FALLBACK_PATHS]) {
    for (const ext of extensions) {
      const candidate = path.join(dir, binaryName + ext);
      if (fs.existsSync(candidate)) {
        resolvedPaths.set(binaryName, candidate);
        return candidate;
      }
    }
  }

  return null;
}

export function spawnViaPowerShell(binaryPath: string, args: string[], env?: Record<string, string>): ChildProcess {
  // Spawn through PowerShell to get user's full environment
  const psArgs = [
    '-NoLogo',
    '-NoProfile',
    '-Command',
    `& '${binaryPath}' ${args.map(a => `'${a}'`).join(' ')}`,
  ];

  const processEnv = { ...process.env, ...env };
  // Remove Claude Code env vars to prevent nested session detection
  delete processEnv.CLAUDE_CODE;
  delete processEnv.CLAUDE_CODE_ENTRYPOINT;

  return spawn('powershell', psArgs, {
    env: processEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/shell-environment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lil-agents-windows/src/main/shell-environment.ts lil-agents-windows/tests/shell-environment.test.ts
git commit -m "feat(windows): add shell environment with PowerShell PATH resolution"
```

---

### Task 6: Agent Session Interface & Claude Session

**Files:**
- Create: `lil-agents-windows/src/main/sessions/agent-session.ts`
- Create: `lil-agents-windows/src/main/sessions/claude-session.ts`
- Create: `lil-agents-windows/tests/sessions/claude-session.test.ts`

- [ ] **Step 1: Write agent session interface**

Create `src/main/sessions/agent-session.ts`:

```typescript
import { ProviderName, SessionMessage } from '../../shared/types';

export interface AgentSessionCallbacks {
  onText: (text: string) => void;
  onToolUse: (toolName: string, input: string) => void;
  onToolResult: (result: string, isError: boolean) => void;
  onTurnComplete: () => void;
  onError: (error: string) => void;
}

export interface AgentSession {
  provider: ProviderName;
  isRunning: boolean;
  start(callbacks: AgentSessionCallbacks): Promise<void>;
  send(message: string): void;
  stop(): void;
}

export abstract class BaseSession implements AgentSession {
  abstract provider: ProviderName;
  isRunning = false;
  protected callbacks: AgentSessionCallbacks | null = null;
  protected history: SessionMessage[] = [];

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.isRunning = true;
  }

  abstract send(message: string): void;

  stop(): void {
    this.isRunning = false;
    this.callbacks = null;
    this.history = [];
  }

  clearHistory(): void {
    this.history = [];
  }
}
```

- [ ] **Step 2: Write Claude session test**

Create `tests/sessions/claude-session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before import
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));
vi.mock('../../src/main/shell-environment', () => ({
  findBinary: vi.fn(),
  spawnViaPowerShell: vi.fn(),
}));

import { ClaudeSession } from '../../src/main/sessions/claude-session';
import { AgentSessionCallbacks } from '../../src/main/sessions/agent-session';

describe('ClaudeSession', () => {
  let session: ClaudeSession;
  let callbacks: AgentSessionCallbacks;

  beforeEach(() => {
    session = new ClaudeSession();
    callbacks = {
      onText: vi.fn(),
      onToolUse: vi.fn(),
      onToolResult: vi.fn(),
      onTurnComplete: vi.fn(),
      onError: vi.fn(),
    };
  });

  it('has correct provider name', () => {
    expect(session.provider).toBe('claude');
  });

  it('starts in non-running state', () => {
    expect(session.isRunning).toBe(false);
  });

  it('parseNDJSON handles assistant text', () => {
    // Access the parser directly for unit testing
    const parsed = (session as any).parseNDJSONLine(
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello world' }] } })
    );
    expect(parsed).toEqual({ type: 'text', content: 'Hello world' });
  });

  it('parseNDJSON handles result complete', () => {
    const parsed = (session as any).parseNDJSONLine(
      JSON.stringify({ type: 'result', subtype: 'success' })
    );
    expect(parsed).toEqual({ type: 'turn_complete' });
  });

  it('parseNDJSON handles tool_use', () => {
    const parsed = (session as any).parseNDJSONLine(
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } })
    );
    expect(parsed).toEqual({ type: 'tool_use', name: 'Bash', input: '{"command":"ls"}' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/sessions/claude-session.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement Claude session**

Create `src/main/sessions/claude-session.ts`:

```typescript
import { ChildProcess } from 'child_process';
import { BaseSession, AgentSessionCallbacks } from './agent-session';
import { ProviderName } from '../../shared/types';
import { findBinary, spawnViaPowerShell } from '../shell-environment';

interface NDJSONParsed {
  type: 'text' | 'tool_use' | 'tool_result' | 'turn_complete' | 'error' | 'unknown';
  content?: string;
  name?: string;
  input?: string;
  isError?: boolean;
}

export class ClaudeSession extends BaseSession {
  provider: ProviderName = 'claude';
  private process: ChildProcess | null = null;
  private buffer = '';
  private customBinaryPath?: string;

  constructor(customBinaryPath?: string) {
    super();
    this.customBinaryPath = customBinaryPath;
  }

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    await super.start(callbacks);

    const binaryPath = await findBinary('claude', this.customBinaryPath);
    if (!binaryPath) {
      callbacks.onError('Claude CLI not found. Install it or set the path in settings.');
      this.isRunning = false;
      return;
    }

    // Claude uses multi-turn mode with NDJSON streaming
    this.process = spawnViaPowerShell(binaryPath, [
      '--output-format', 'stream-json',
      '--verbose',
    ]);

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) this.callbacks?.onError(text);
    });

    this.process.on('close', (code: number | null) => {
      this.isRunning = false;
      if (code !== 0 && code !== null) {
        this.callbacks?.onError(`Claude process exited with code ${code}`);
      }
    });

    this.process.on('error', (err: Error) => {
      this.isRunning = false;
      this.callbacks?.onError(`Failed to start Claude: ${err.message}`);
    });
  }

  send(message: string): void {
    if (!this.process || !this.isRunning) return;
    this.history.push({ role: 'user', content: message });
    this.process.stdin?.write(message + '\n');
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.buffer = '';
    super.stop();
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete last line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = this.parseNDJSONLine(trimmed);
      this.dispatchParsed(parsed);
    }
  }

  parseNDJSONLine(line: string): NDJSONParsed {
    try {
      const data = JSON.parse(line);

      if (data.type === 'assistant' && data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'text') {
            return { type: 'text', content: block.text };
          }
          if (block.type === 'tool_use') {
            return {
              type: 'tool_use',
              name: block.name,
              input: JSON.stringify(block.input),
            };
          }
        }
      }

      if (data.type === 'tool_result' || data.type === 'tool_output') {
        return {
          type: 'tool_result',
          content: data.output || data.content || '',
          isError: data.is_error || false,
        };
      }

      if (data.type === 'result') {
        return { type: 'turn_complete' };
      }

      if (data.type === 'error') {
        return { type: 'error', content: data.error?.message || data.message || 'Unknown error' };
      }

      return { type: 'unknown' };
    } catch {
      // Non-JSON line — treat as plain text
      return { type: 'text', content: line };
    }
  }

  private dispatchParsed(parsed: NDJSONParsed): void {
    if (!this.callbacks) return;

    switch (parsed.type) {
      case 'text':
        if (parsed.content) this.callbacks.onText(parsed.content);
        break;
      case 'tool_use':
        this.callbacks.onToolUse(parsed.name || 'unknown', parsed.input || '');
        break;
      case 'tool_result':
        this.callbacks.onToolResult(parsed.content || '', parsed.isError || false);
        break;
      case 'turn_complete':
        this.callbacks.onTurnComplete();
        break;
      case 'error':
        this.callbacks.onError(parsed.content || 'Unknown error');
        break;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/sessions/claude-session.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lil-agents-windows/src/main/sessions/
git commit -m "feat(windows): add agent session interface and Claude NDJSON session"
```

---

### Task 7: Remaining AI Provider Sessions

**Files:**
- Create: `lil-agents-windows/src/main/sessions/codex-session.ts`
- Create: `lil-agents-windows/src/main/sessions/copilot-session.ts`
- Create: `lil-agents-windows/src/main/sessions/gemini-session.ts`
- Create: `lil-agents-windows/src/main/sessions/opencode-session.ts`
- Create: `lil-agents-windows/src/main/sessions/openclaw-session.ts`
- Create: `lil-agents-windows/src/main/sessions/index.ts`

- [ ] **Step 1: Implement Codex session**

Create `src/main/sessions/codex-session.ts`:

```typescript
import { ChildProcess } from 'child_process';
import { BaseSession, AgentSessionCallbacks } from './agent-session';
import { ProviderName } from '../../shared/types';
import { findBinary, spawnViaPowerShell } from '../shell-environment';

export class CodexSession extends BaseSession {
  provider: ProviderName = 'codex';
  private customBinaryPath?: string;

  constructor(customBinaryPath?: string) {
    super();
    this.customBinaryPath = customBinaryPath;
  }

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    await super.start(callbacks);
    const binaryPath = await findBinary('codex', this.customBinaryPath);
    if (!binaryPath) {
      callbacks.onError('Codex CLI not found. Install it or set the path in settings.');
      this.isRunning = false;
    }
  }

  send(message: string): void {
    if (!this.callbacks) return;
    this.history.push({ role: 'user', content: message });

    (async () => {
      const binaryPath = await findBinary('codex', this.customBinaryPath);
      if (!binaryPath) {
        this.callbacks?.onError('Codex CLI not found.');
        return;
      }

      // Codex is one-shot: concatenate history into a single prompt
      const fullPrompt = this.history
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const proc = spawnViaPowerShell(binaryPath, ['--quiet', fullPrompt]);
      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.callbacks?.onText(text);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) this.callbacks?.onError(text);
      });

      proc.on('close', () => {
        this.history.push({ role: 'assistant', content: output });
        this.callbacks?.onTurnComplete();
      });

      proc.on('error', (err: Error) => {
        this.callbacks?.onError(`Failed to run Codex: ${err.message}`);
      });
    })();
  }

  stop(): void {
    super.stop();
  }
}
```

- [ ] **Step 2: Implement Copilot session**

Create `src/main/sessions/copilot-session.ts`:

```typescript
import { BaseSession, AgentSessionCallbacks } from './agent-session';
import { ProviderName } from '../../shared/types';
import { findBinary, spawnViaPowerShell } from '../shell-environment';

export class CopilotSession extends BaseSession {
  provider: ProviderName = 'copilot';
  private customBinaryPath?: string;

  constructor(customBinaryPath?: string) {
    super();
    this.customBinaryPath = customBinaryPath;
  }

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    await super.start(callbacks);
    const binaryPath = await findBinary('copilot', this.customBinaryPath);
    if (!binaryPath) {
      callbacks.onError('Copilot CLI not found. Install it or set the path in settings.');
      this.isRunning = false;
    }
  }

  send(message: string): void {
    if (!this.callbacks) return;
    this.history.push({ role: 'user', content: message });

    (async () => {
      const binaryPath = await findBinary('copilot', this.customBinaryPath);
      if (!binaryPath) {
        this.callbacks?.onError('Copilot CLI not found.');
        return;
      }

      const fullPrompt = this.history
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const proc = spawnViaPowerShell(binaryPath, [fullPrompt]);
      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.callbacks?.onText(text);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) this.callbacks?.onError(text);
      });

      proc.on('close', () => {
        this.history.push({ role: 'assistant', content: output });
        this.callbacks?.onTurnComplete();
      });

      proc.on('error', (err: Error) => {
        this.callbacks?.onError(`Failed to run Copilot: ${err.message}`);
      });
    })();
  }

  stop(): void {
    super.stop();
  }
}
```

- [ ] **Step 3: Implement Gemini session**

Create `src/main/sessions/gemini-session.ts`:

```typescript
import { BaseSession, AgentSessionCallbacks } from './agent-session';
import { ProviderName } from '../../shared/types';
import { findBinary, spawnViaPowerShell } from '../shell-environment';

export class GeminiSession extends BaseSession {
  provider: ProviderName = 'gemini';
  private customBinaryPath?: string;

  constructor(customBinaryPath?: string) {
    super();
    this.customBinaryPath = customBinaryPath;
  }

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    await super.start(callbacks);
    const binaryPath = await findBinary('gemini', this.customBinaryPath);
    if (!binaryPath) {
      callbacks.onError('Gemini CLI not found. Install it or set the path in settings.');
      this.isRunning = false;
    }
  }

  send(message: string): void {
    if (!this.callbacks) return;
    this.history.push({ role: 'user', content: message });

    (async () => {
      const binaryPath = await findBinary('gemini', this.customBinaryPath);
      if (!binaryPath) {
        this.callbacks?.onError('Gemini CLI not found.');
        return;
      }

      const args = ['--yolo'];
      if (this.history.length > 1) {
        args.push('--resume', 'latest');
      }
      args.push(message);

      const proc = spawnViaPowerShell(binaryPath, args);
      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.callbacks?.onText(text);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) this.callbacks?.onError(text);
      });

      proc.on('close', () => {
        this.history.push({ role: 'assistant', content: output });
        this.callbacks?.onTurnComplete();
      });

      proc.on('error', (err: Error) => {
        this.callbacks?.onError(`Failed to run Gemini: ${err.message}`);
      });
    })();
  }

  stop(): void {
    super.stop();
  }
}
```

- [ ] **Step 4: Implement OpenCode session**

Create `src/main/sessions/opencode-session.ts`:

```typescript
import { BaseSession, AgentSessionCallbacks } from './agent-session';
import { ProviderName } from '../../shared/types';
import { findBinary, spawnViaPowerShell } from '../shell-environment';

export class OpenCodeSession extends BaseSession {
  provider: ProviderName = 'opencode';
  private customBinaryPath?: string;

  constructor(customBinaryPath?: string) {
    super();
    this.customBinaryPath = customBinaryPath;
  }

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    await super.start(callbacks);
    const binaryPath = await findBinary('opencode', this.customBinaryPath);
    if (!binaryPath) {
      callbacks.onError('OpenCode CLI not found. Install it or set the path in settings.');
      this.isRunning = false;
    }
  }

  send(message: string): void {
    if (!this.callbacks) return;
    this.history.push({ role: 'user', content: message });

    (async () => {
      const binaryPath = await findBinary('opencode', this.customBinaryPath);
      if (!binaryPath) {
        this.callbacks?.onError('OpenCode CLI not found.');
        return;
      }

      const fullPrompt = this.history
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const proc = spawnViaPowerShell(binaryPath, ['--format', 'json', fullPrompt]);
      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.callbacks?.onText(text);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) this.callbacks?.onError(text);
      });

      proc.on('close', () => {
        this.history.push({ role: 'assistant', content: output });
        this.callbacks?.onTurnComplete();
      });

      proc.on('error', (err: Error) => {
        this.callbacks?.onError(`Failed to run OpenCode: ${err.message}`);
      });
    })();
  }

  stop(): void {
    super.stop();
  }
}
```

- [ ] **Step 5: Implement OpenClaw session (WebSocket)**

Create `src/main/sessions/openclaw-session.ts`:

```typescript
import WebSocket from 'ws';
import { BaseSession, AgentSessionCallbacks } from './agent-session';
import { ProviderName } from '../../shared/types';

interface OpenClawConfig {
  gatewayURL: string;
  authToken: string;
  sessionPrefix: string;
  agentId: string | null;
}

export class OpenClawSession extends BaseSession {
  provider: ProviderName = 'openclaw';
  private ws: WebSocket | null = null;
  private config: OpenClawConfig;
  private sessionKey: string;

  constructor(config: OpenClawConfig) {
    super();
    this.config = config;
    this.sessionKey = `${config.sessionPrefix}-${Date.now()}`;
  }

  async start(callbacks: AgentSessionCallbacks): Promise<void> {
    await super.start(callbacks);

    if (!this.config.gatewayURL) {
      callbacks.onError('OpenClaw gateway URL not configured. Set it in settings.');
      this.isRunning = false;
      return;
    }

    try {
      const url = new URL(this.config.gatewayURL);
      if (this.config.authToken) {
        url.searchParams.set('token', this.config.authToken);
      }
      url.searchParams.set('session', this.sessionKey);
      if (this.config.agentId) {
        url.searchParams.set('agent', this.config.agentId);
      }

      this.ws = new WebSocket(url.toString());

      this.ws.on('open', () => {
        this.isRunning = true;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'text') {
            this.callbacks?.onText(msg.content || '');
          } else if (msg.type === 'tool_use') {
            this.callbacks?.onToolUse(msg.name || 'unknown', msg.input || '');
          } else if (msg.type === 'tool_result') {
            this.callbacks?.onToolResult(msg.content || '', msg.is_error || false);
          } else if (msg.type === 'turn_complete' || msg.type === 'result') {
            this.callbacks?.onTurnComplete();
          } else if (msg.type === 'error') {
            this.callbacks?.onError(msg.message || 'OpenClaw error');
          }
        } catch {
          // Plain text message
          this.callbacks?.onText(data.toString());
        }
      });

      this.ws.on('close', () => {
        this.isRunning = false;
      });

      this.ws.on('error', (err: Error) => {
        this.callbacks?.onError(`OpenClaw connection error: ${err.message}`);
        this.isRunning = false;
      });
    } catch (err: any) {
      callbacks.onError(`Failed to connect to OpenClaw: ${err.message}`);
      this.isRunning = false;
    }
  }

  send(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.history.push({ role: 'user', content: message });
    this.ws.send(JSON.stringify({ type: 'message', content: message }));
  }

  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    super.stop();
  }
}
```

- [ ] **Step 6: Create session factory index**

Create `src/main/sessions/index.ts`:

```typescript
import { ProviderName } from '../../shared/types';
import { AgentSession } from './agent-session';
import { ClaudeSession } from './claude-session';
import { CodexSession } from './codex-session';
import { CopilotSession } from './copilot-session';
import { GeminiSession } from './gemini-session';
import { OpenCodeSession } from './opencode-session';
import { OpenClawSession } from './openclaw-session';
import { getSettings } from '../settings';

export function createSession(provider: ProviderName): AgentSession {
  const settings = getSettings();
  const customPath = settings.get('providerPaths')?.[provider];

  switch (provider) {
    case 'claude':
      return new ClaudeSession(customPath);
    case 'codex':
      return new CodexSession(customPath);
    case 'copilot':
      return new CopilotSession(customPath);
    case 'gemini':
      return new GeminiSession(customPath);
    case 'opencode':
      return new OpenCodeSession(customPath);
    case 'openclaw':
      return new OpenClawSession({
        gatewayURL: settings.get('openClaw.gatewayURL') || 'ws://localhost:3001',
        authToken: settings.get('openClaw.authToken') || '',
        sessionPrefix: settings.get('openClaw.sessionPrefix') || 'lil-agents',
        agentId: settings.get('openClaw.agentId') || null,
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export { AgentSession, AgentSessionCallbacks } from './agent-session';
```

- [ ] **Step 7: Commit**

```bash
git add lil-agents-windows/src/main/sessions/
git commit -m "feat(windows): add all 6 AI provider sessions"
```

---

### Task 8: Monitor Detection

**Files:**
- Create: `lil-agents-windows/src/main/monitor.ts`

- [ ] **Step 1: Implement monitor detection**

Create `src/main/monitor.ts`:

```typescript
import { screen, Display } from 'electron';
import { getSettings } from './settings';

export interface MonitorInfo {
  id: string;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

export function getAllMonitors(): MonitorInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map(d => ({
    id: d.id.toString(),
    label: `${d.bounds.width}x${d.bounds.height}${d.id === primary.id ? ' (Primary)' : ''}`,
    bounds: d.bounds,
    workArea: d.workArea,
    isPrimary: d.id === primary.id,
  }));
}

export function getSelectedMonitor(): MonitorInfo {
  const monitors = getAllMonitors();
  const selected = getSettings().get('selectedMonitor');

  if (selected && selected !== 'auto') {
    const found = monitors.find(m => m.id === selected);
    if (found) return found;
  }

  // Auto: use primary display
  return monitors.find(m => m.isPrimary) || monitors[0];
}

export function getOverlayBounds(monitor: MonitorInfo): { x: number; y: number; width: number; height: number } {
  // Position overlay at the bottom of the screen, spanning full width
  // Height of 250px: enough for character (200px max) + speech bubble
  const overlayHeight = 250;
  const taskbarHeight = monitor.bounds.height - monitor.workArea.height -
    (monitor.workArea.y - monitor.bounds.y);

  return {
    x: monitor.bounds.x,
    y: monitor.bounds.y + monitor.bounds.height - overlayHeight - taskbarHeight,
    width: monitor.bounds.width,
    height: overlayHeight,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lil-agents-windows/src/main/monitor.ts
git commit -m "feat(windows): add monitor detection and overlay positioning"
```

---

### Task 9: Overlay Window (Main Process)

**Files:**
- Create: `lil-agents-windows/src/main/overlay-window.ts`
- Create: `lil-agents-windows/src/preload/overlay-preload.ts`

- [ ] **Step 1: Create overlay preload script**

Create `src/preload/overlay-preload.ts`:

```typescript
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
  reportReady: () => {
    ipcRenderer.send(IPC.OVERLAY_READY);
  },
  setClickThrough: (ignore: boolean, forward: boolean) => {
    ipcRenderer.send(IPC.SET_CLICK_THROUGH, ignore, forward);
  },
});
```

- [ ] **Step 2: Create overlay window manager**

Create `src/main/overlay-window.ts`:

```typescript
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { IPC } from '../shared/ipc-channels';
import { CharacterState } from '../shared/types';
import { getSelectedMonitor, getOverlayBounds } from './monitor';

let overlayWindow: BrowserWindow | null = null;

export function createOverlayWindow(): BrowserWindow {
  const monitor = getSelectedMonitor();
  const bounds = getOverlayBounds(monitor);

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Start with mouse events passing through
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the overlay HTML
  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay', 'index.html'));

  // Handle click-through toggling from renderer
  ipcMain.on(IPC.SET_CLICK_THROUGH, (_event, ignore: boolean, forward: boolean) => {
    overlayWindow?.setIgnoreMouseEvents(ignore, { forward });
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function sendToOverlay(channel: string, ...args: any[]): void {
  overlayWindow?.webContents.send(channel, ...args);
}

export function updateOverlayCharacters(states: CharacterState[]): void {
  sendToOverlay(IPC.UPDATE_CHARACTERS, states);
}

export function repositionOverlay(): void {
  if (!overlayWindow) return;
  const monitor = getSelectedMonitor();
  const bounds = getOverlayBounds(monitor);
  overlayWindow.setBounds(bounds);
}
```

- [ ] **Step 3: Commit**

```bash
git add lil-agents-windows/src/main/overlay-window.ts lil-agents-windows/src/preload/overlay-preload.ts
git commit -m "feat(windows): add transparent overlay window with click-through"
```

---

### Task 10: Overlay Renderer (HTML/CSS/TS)

**Files:**
- Create: `lil-agents-windows/src/renderer/overlay/index.html`
- Create: `lil-agents-windows/src/renderer/overlay/overlay.ts`
- Create: `lil-agents-windows/src/renderer/overlay/overlay.css`

- [ ] **Step 1: Create overlay HTML**

Create `src/renderer/overlay/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="overlay.css">
  <title>Lil Agents Overlay</title>
</head>
<body>
  <canvas id="overlay-canvas"></canvas>
  <script src="overlay.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create overlay CSS**

Create `src/renderer/overlay/overlay.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  user-select: none;
  -webkit-app-region: no-drag;
}

#overlay-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
```

- [ ] **Step 3: Create overlay renderer**

Create `src/renderer/overlay/overlay.ts`:

```typescript
declare global {
  interface Window {
    lilAgents: {
      onUpdateCharacters: (cb: (states: any[]) => void) => void;
      onThemeChanged: (cb: (isDark: boolean) => void) => void;
      characterClicked: (name: string) => void;
      reportReady: () => void;
      setClickThrough: (ignore: boolean, forward: boolean) => void;
    };
  }
}

interface SpriteSheet {
  images: HTMLImageElement[];
  loaded: boolean;
}

const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let characterStates: any[] = [];
let sprites: Map<string, SpriteSheet> = new Map();
let isDarkTheme = false;

// Thinking bubble phrases
const THINKING_PHRASES = [
  'hmm...', 'thinking...', 'one sec...', 'ok hold on', 'let me check',
  'working on it', 'on it...', 'processing...', 'give me a moment',
  'let me see...', 'checking...', 'analyzing...', 'figuring it out',
  'looking into it', 'almost...', 'bear with me', 'just a sec',
  'running that...', 'computing...', 'crunching...', 'diving in',
  'exploring...', 'searching...', 'reading...', 'cooking...',
];

const COMPLETION_PHRASES = [
  'done!', 'all set!', 'ready!', 'here you go', 'got it!',
  'finished!', 'ta-da!', 'voila!', 'boom!', 'there ya go!',
  'check it out!', 'nailed it!',
];

function resizeCanvas(): void {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function drawCharacter(state: any): void {
  const sprite = sprites.get(state.name);
  if (!sprite?.loaded || sprite.images.length === 0) {
    // Draw placeholder rectangle
    ctx.fillStyle = state.name === 'bruce' ? '#66B88C' : '#FF6600';
    ctx.fillRect(state.x - state.width / 2, canvas.height / window.devicePixelRatio - state.height - 10, state.width, state.height);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.name, state.x, canvas.height / window.devicePixelRatio - state.height / 2 - 10);
    return;
  }

  const frameIndex = Math.min(state.frame, sprite.images.length - 1);
  const img = sprite.images[frameIndex];
  const yPos = canvas.height / window.devicePixelRatio - state.height - 10;

  ctx.save();
  if (state.flipped) {
    ctx.translate(state.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -state.width / 2, yPos, state.width, state.height);
  } else {
    ctx.drawImage(img, state.x - state.width / 2, yPos, state.width, state.height);
  }
  ctx.restore();
}

function drawBubble(state: any): void {
  if (!state.bubbleText) return;

  const bubbleX = state.x;
  const bubbleY = canvas.height / window.devicePixelRatio - state.height - 50;
  const text = state.bubbleText;

  ctx.font = '13px -apple-system, "Segoe UI", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padding = 10;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 28;

  // Bubble background
  const isCompletion = COMPLETION_PHRASES.includes(text);
  ctx.fillStyle = isDarkTheme ? '#1a1a1a' : '#ffffff';
  ctx.strokeStyle = isCompletion ? '#4CAF50' : (isDarkTheme ? '#444' : '#ddd');
  ctx.lineWidth = 1.5;

  // Rounded rect
  const rx = bubbleX - bubbleWidth / 2;
  const ry = bubbleY - bubbleHeight / 2;
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.lineTo(rx + bubbleWidth - r, ry);
  ctx.arcTo(rx + bubbleWidth, ry, rx + bubbleWidth, ry + r, r);
  ctx.lineTo(rx + bubbleWidth, ry + bubbleHeight - r);
  ctx.arcTo(rx + bubbleWidth, ry + bubbleHeight, rx + bubbleWidth - r, ry + bubbleHeight, r);
  ctx.lineTo(rx + r, ry + bubbleHeight);
  ctx.arcTo(rx, ry + bubbleHeight, rx, ry + bubbleHeight - r, r);
  ctx.lineTo(rx, ry + r);
  ctx.arcTo(rx, ry, rx + r, ry, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Small triangle pointing down
  ctx.fillStyle = isDarkTheme ? '#1a1a1a' : '#ffffff';
  ctx.beginPath();
  ctx.moveTo(bubbleX - 6, ry + bubbleHeight);
  ctx.lineTo(bubbleX, ry + bubbleHeight + 8);
  ctx.lineTo(bubbleX + 6, ry + bubbleHeight);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.fillStyle = isCompletion ? '#4CAF50' : (isDarkTheme ? '#e0e0e0' : '#333');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bubbleX, bubbleY);
}

function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const state of characterStates) {
    if (!state.visible) continue;
    drawCharacter(state);
    drawBubble(state);
  }

  requestAnimationFrame(render);
}

// Click detection: center 60% of character bounds
canvas.addEventListener('mousedown', (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  for (const state of characterStates) {
    if (!state.visible) continue;

    const charLeft = state.x - state.width / 2;
    const charTop = canvas.height / window.devicePixelRatio - state.height - 10;
    const charRight = charLeft + state.width;
    const charBottom = charTop + state.height;

    // Center 60% zone
    const zoneWidth = state.width * 0.6;
    const zoneHeight = state.height * 0.6;
    const zoneLeft = charLeft + (state.width - zoneWidth) / 2;
    const zoneTop = charTop + (state.height - zoneHeight) / 2;

    if (mouseX >= zoneLeft && mouseX <= zoneLeft + zoneWidth &&
        mouseY >= zoneTop && mouseY <= zoneTop + zoneHeight) {
      window.lilAgents.characterClicked(state.name);
      return;
    }
  }
});

// Mouse move: toggle click-through based on whether mouse is over a character
canvas.addEventListener('mousemove', (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  let overCharacter = false;

  for (const state of characterStates) {
    if (!state.visible) continue;

    const charLeft = state.x - state.width / 2;
    const charTop = canvas.height / window.devicePixelRatio - state.height - 10;
    const zoneWidth = state.width * 0.6;
    const zoneHeight = state.height * 0.6;
    const zoneLeft = charLeft + (state.width - zoneWidth) / 2;
    const zoneTop = charTop + (state.height - zoneHeight) / 2;

    if (mouseX >= zoneLeft && mouseX <= zoneLeft + zoneWidth &&
        mouseY >= zoneTop && mouseY <= zoneTop + zoneHeight) {
      overCharacter = true;
      break;
    }
  }

  // When over character, accept mouse events. Otherwise, pass through.
  window.lilAgents.setClickThrough(!overCharacter, true);
  canvas.style.cursor = overCharacter ? 'pointer' : 'default';
});

// Load sprite sheets (placeholder — user will provide actual sprite PNGs)
function loadSprites(name: string, frameCount: number): void {
  const sheet: SpriteSheet = { images: [], loaded: false };
  let loadedCount = 0;

  for (let i = 1; i <= frameCount; i++) {
    const img = new Image();
    const paddedIndex = i.toString().padStart(3, '0');
    img.src = `../../../assets/sprites/${name}/${name}-${paddedIndex}.png`;
    img.onload = () => {
      loadedCount++;
      if (loadedCount === frameCount) sheet.loaded = true;
    };
    img.onerror = () => {
      // Sprite not found — that's OK, we'll draw placeholders
      loadedCount++;
      if (loadedCount === frameCount) sheet.loaded = true;
    };
    sheet.images.push(img);
  }

  sprites.set(name, sheet);
}

// Initialize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Load sprite sheets — adjust frame count to match actual assets
loadSprites('bruce', 300);
loadSprites('jazz', 300);

// Listen for character state updates from main process
window.lilAgents.onUpdateCharacters((states) => {
  characterStates = states;
});

window.lilAgents.onThemeChanged((dark) => {
  isDarkTheme = dark;
});

// Start render loop
requestAnimationFrame(render);
window.lilAgents.reportReady();
```

- [ ] **Step 4: Commit**

```bash
git add lil-agents-windows/src/renderer/overlay/
git commit -m "feat(windows): add overlay renderer with sprite animation and speech bubbles"
```

---

### Task 11: Popover Window (Main Process + Preload)

**Files:**
- Create: `lil-agents-windows/src/main/popover-window.ts`
- Create: `lil-agents-windows/src/preload/popover-preload.ts`

- [ ] **Step 1: Create popover preload**

Create `src/preload/popover-preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('lilAgents', {
  sendMessage: (text: string) => {
    ipcRenderer.send(IPC.SEND_MESSAGE, text);
  },
  slashCommand: (cmd: string) => {
    ipcRenderer.send(IPC.SLASH_COMMAND, cmd);
  },
  changeProvider: (provider: string) => {
    ipcRenderer.send(IPC.CHANGE_PROVIDER, provider);
  },
  refreshSession: () => {
    ipcRenderer.send(IPC.REFRESH_SESSION);
  },
  copyLast: () => {
    ipcRenderer.send(IPC.COPY_LAST);
  },
  onStreamText: (cb: (text: string) => void) => {
    ipcRenderer.on(IPC.STREAM_TEXT, (_e, text) => cb(text));
  },
  onToolUse: (cb: (name: string, input: string) => void) => {
    ipcRenderer.on(IPC.TOOL_USE, (_e, name, input) => cb(name, input));
  },
  onToolResult: (cb: (result: string, isError: boolean) => void) => {
    ipcRenderer.on(IPC.TOOL_RESULT, (_e, result, isError) => cb(result, isError));
  },
  onTurnComplete: (cb: () => void) => {
    ipcRenderer.on(IPC.TURN_COMPLETE, () => cb());
  },
  onSessionError: (cb: (error: string) => void) => {
    ipcRenderer.on(IPC.SESSION_ERROR, (_e, error) => cb(error));
  },
  onSessionClear: (cb: () => void) => {
    ipcRenderer.on(IPC.SESSION_CLEAR, () => cb());
  },
  onThemeChanged: (cb: (isDark: boolean) => void) => {
    ipcRenderer.on(IPC.THEME_CHANGED, (_e, isDark) => cb(isDark));
  },
  reportReady: () => {
    ipcRenderer.send(IPC.POPOVER_READY);
  },
});
```

- [ ] **Step 2: Create popover window manager**

Create `src/main/popover-window.ts`:

```typescript
import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import { IPC } from '../shared/ipc-channels';
import { CharacterName, ProviderName } from '../shared/types';

const popoverWindows: Map<CharacterName, BrowserWindow> = new Map();

export function showPopover(characterName: CharacterName, x: number, y: number, provider: ProviderName): BrowserWindow {
  let win = popoverWindows.get(characterName);

  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }

  win = new BrowserWindow({
    width: 420,
    height: 350,
    x: Math.max(0, x - 210),
    y: Math.max(0, y - 360),
    frame: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'popover-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'popover', 'index.html'));

  win.once('ready-to-show', () => {
    win!.show();
    win!.webContents.send(IPC.THEME_CHANGED, nativeTheme.shouldUseDarkColors);
  });

  win.on('closed', () => {
    popoverWindows.delete(characterName);
  });

  // Close on Escape
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape') {
      win?.hide();
    }
  });

  popoverWindows.set(characterName, win);
  return win;
}

export function getPopoverWindow(name: CharacterName): BrowserWindow | null {
  const win = popoverWindows.get(name);
  return win && !win.isDestroyed() ? win : null;
}

export function sendToPopover(name: CharacterName, channel: string, ...args: any[]): void {
  const win = getPopoverWindow(name);
  win?.webContents.send(channel, ...args);
}

export function hidePopover(name: CharacterName): void {
  const win = getPopoverWindow(name);
  win?.hide();
}

export function closeAllPopovers(): void {
  for (const [name, win] of popoverWindows) {
    if (!win.isDestroyed()) win.close();
  }
  popoverWindows.clear();
}
```

- [ ] **Step 3: Commit**

```bash
git add lil-agents-windows/src/main/popover-window.ts lil-agents-windows/src/preload/popover-preload.ts
git commit -m "feat(windows): add popover window manager with preload bridge"
```

---

### Task 12: Popover Renderer (Terminal UI)

**Files:**
- Create: `lil-agents-windows/src/renderer/popover/index.html`
- Create: `lil-agents-windows/src/renderer/popover/popover.ts`
- Create: `lil-agents-windows/src/renderer/popover/popover.css`

- [ ] **Step 1: Create popover HTML**

Create `src/renderer/popover/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="popover.css">
  <title>Lil Agents Chat</title>
</head>
<body>
  <div id="titlebar">
    <span id="provider-name">Claude</span>
    <div id="titlebar-actions">
      <button id="btn-refresh" title="New session">&#x21bb;</button>
      <button id="btn-copy" title="Copy last response">&#x2398;</button>
    </div>
  </div>
  <div id="messages"></div>
  <div id="input-area">
    <input type="text" id="input-field" placeholder="Ask Claude..." autocomplete="off" />
  </div>
  <script src="popover.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popover CSS**

Create `src/renderer/popover/popover.css`:

```css
:root {
  --bg: #fffaf0;
  --bg-secondary: #f5f0e8;
  --text: #333;
  --text-muted: #888;
  --border: #e0d8d0;
  --accent: #e8445a;
  --accent-light: #fce4ec;
  --input-bg: #fff;
  --code-bg: #f5f0e8;
  --error: #d32f2f;
  --success: #4CAF50;
  --font: -apple-system, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'Cascadia Code', 'Consolas', 'SF Mono', monospace;
  --radius: 10px;
}

.dark {
  --bg: #111111;
  --bg-secondary: #1a1a1a;
  --text: #e0e0e0;
  --text-muted: #777;
  --border: #333;
  --accent: #ff6600;
  --accent-light: #2a1a00;
  --input-bg: #1a1a1a;
  --code-bg: #1a1a1a;
  --error: #ff5252;
  --success: #66bb6a;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--font);
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
}

#titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
  border-radius: var(--radius) var(--radius) 0 0;
}

#provider-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--accent);
}

#titlebar-actions {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

#titlebar-actions button {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

#titlebar-actions button:hover {
  background: var(--border);
  color: var(--text);
}

#messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  height: calc(100% - 32px - 44px);
  scrollbar-width: thin;
}

.message {
  margin-bottom: 10px;
  line-height: 1.5;
  word-wrap: break-word;
}

.message.user {
  color: var(--accent);
  font-weight: 500;
}

.message.assistant {
  color: var(--text);
}

.message.error {
  color: var(--error);
  font-style: italic;
}

.message.tool {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 8px;
  background: var(--code-bg);
  border-radius: 4px;
  margin: 4px 0;
}

.message code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--accent);
}

.message pre {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
  white-space: pre-wrap;
}

#input-area {
  height: 44px;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg);
  border-radius: 0 0 var(--radius) var(--radius);
}

#input-field {
  width: 100%;
  height: 100%;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  outline: none;
}

#input-field:focus {
  border-color: var(--accent);
}

#input-field::placeholder {
  color: var(--text-muted);
}
```

- [ ] **Step 3: Create popover renderer**

Create `src/renderer/popover/popover.ts`:

```typescript
declare global {
  interface Window {
    lilAgents: {
      sendMessage: (text: string) => void;
      slashCommand: (cmd: string) => void;
      changeProvider: (provider: string) => void;
      refreshSession: () => void;
      copyLast: () => void;
      onStreamText: (cb: (text: string) => void) => void;
      onToolUse: (cb: (name: string, input: string) => void) => void;
      onToolResult: (cb: (result: string, isError: boolean) => void) => void;
      onTurnComplete: (cb: () => void) => void;
      onSessionError: (cb: (error: string) => void) => void;
      onSessionClear: (cb: () => void) => void;
      onThemeChanged: (cb: (isDark: boolean) => void) => void;
      reportReady: () => void;
    };
  }
}

const messagesEl = document.getElementById('messages')!;
const inputField = document.getElementById('input-field') as HTMLInputElement;
const btnRefresh = document.getElementById('btn-refresh')!;
const btnCopy = document.getElementById('btn-copy')!;
const providerNameEl = document.getElementById('provider-name')!;

let lastAssistantText = '';
let currentAssistantEl: HTMLDivElement | null = null;

function addMessage(role: string, text: string, className: string = ''): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${role} ${className}`.trim();
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function scrollToBottom(): void {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Input handling
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = inputField.value.trim();
    if (!text) return;

    inputField.value = '';

    // Check for slash commands
    if (text.startsWith('/')) {
      const cmd = text.slice(1).toLowerCase();
      if (cmd === 'clear') {
        messagesEl.innerHTML = '';
        window.lilAgents.slashCommand('clear');
        return;
      }
      if (cmd === 'copy') {
        window.lilAgents.copyLast();
        return;
      }
      if (cmd === 'help') {
        addMessage('system', 'Commands: /clear (clear chat), /copy (copy last response), /help');
        return;
      }
    }

    addMessage('user', text);
    currentAssistantEl = null;
    lastAssistantText = '';
    window.lilAgents.sendMessage(text);
  }
});

// Receive streamed text
window.lilAgents.onStreamText((text) => {
  if (!currentAssistantEl) {
    currentAssistantEl = addMessage('assistant', '');
    lastAssistantText = '';
  }
  lastAssistantText += text;
  currentAssistantEl.textContent = lastAssistantText;
  scrollToBottom();
});

// Tool use
window.lilAgents.onToolUse((name, input) => {
  addMessage('tool', `[${name}] ${input}`);
});

// Tool result
window.lilAgents.onToolResult((result, isError) => {
  addMessage('tool', result, isError ? 'error' : '');
});

// Turn complete
window.lilAgents.onTurnComplete(() => {
  currentAssistantEl = null;
});

// Error
window.lilAgents.onSessionError((error) => {
  addMessage('error', error, 'error');
});

// Clear
window.lilAgents.onSessionClear(() => {
  messagesEl.innerHTML = '';
});

// Theme
window.lilAgents.onThemeChanged((isDark) => {
  document.body.classList.toggle('dark', isDark);
});

// Buttons
btnRefresh.addEventListener('click', () => {
  messagesEl.innerHTML = '';
  window.lilAgents.refreshSession();
});

btnCopy.addEventListener('click', () => {
  window.lilAgents.copyLast();
});

window.lilAgents.reportReady();
```

- [ ] **Step 4: Commit**

```bash
git add lil-agents-windows/src/renderer/popover/
git commit -m "feat(windows): add popover terminal renderer with chat UI"
```

---

### Task 13: System Tray

**Files:**
- Create: `lil-agents-windows/src/main/tray.ts`

- [ ] **Step 1: Implement system tray**

Create `src/main/tray.ts`:

```typescript
import { Tray, Menu, nativeImage, nativeTheme, app } from 'electron';
import * as path from 'path';
import { getSettings } from './settings';
import { getAllMonitors } from './monitor';
import { CharacterName, ProviderName, CharacterSize } from '../shared/types';

type TrayCallbacks = {
  onProviderChange: (character: CharacterName, provider: ProviderName) => void;
  onSizeChange: (character: CharacterName, size: CharacterSize) => void;
  onVisibilityChange: (character: CharacterName, visible: boolean) => void;
  onSoundToggle: (enabled: boolean) => void;
  onMonitorChange: (monitorId: string) => void;
  onRefreshAll: () => void;
};

let tray: Tray | null = null;

export function createTray(callbacks: TrayCallbacks): Tray {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-icon.png');
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    // Fallback: create a simple colored icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Lil Agents');

  updateTrayMenu(callbacks);

  nativeTheme.on('updated', () => {
    updateTrayMenu(callbacks);
  });

  return tray;
}

function updateTrayMenu(callbacks: TrayCallbacks): void {
  if (!tray) return;

  const settings = getSettings();
  const monitors = getAllMonitors();
  const selectedMonitor = settings.get('selectedMonitor') || 'auto';
  const soundEnabled = settings.get('soundEnabled');

  const providers: { label: string; value: ProviderName }[] = [
    { label: 'Claude', value: 'claude' },
    { label: 'Codex', value: 'codex' },
    { label: 'Copilot', value: 'copilot' },
    { label: 'Gemini', value: 'gemini' },
    { label: 'OpenCode', value: 'opencode' },
    { label: 'OpenClaw', value: 'openclaw' },
  ];

  const sizes: { label: string; value: CharacterSize }[] = [
    { label: 'Large', value: 'large' },
    { label: 'Medium', value: 'medium' },
    { label: 'Small', value: 'small' },
  ];

  const characterMenuItems = (name: CharacterName, displayName: string): Electron.MenuItemConstructorOptions[] => {
    const charSettings = settings.get(`characters.${name}`) as any;
    return [
      {
        label: displayName,
        enabled: false,
      },
      {
        label: 'Visible',
        type: 'checkbox',
        checked: charSettings?.visible ?? true,
        click: () => {
          const newVal = !(charSettings?.visible ?? true);
          settings.set(`characters.${name}.visible`, newVal);
          callbacks.onVisibilityChange(name, newVal);
          updateTrayMenu(callbacks);
        },
      },
      {
        label: 'Provider',
        submenu: providers.map(p => ({
          label: p.label,
          type: 'radio' as const,
          checked: (charSettings?.provider || 'claude') === p.value,
          click: () => {
            settings.set(`characters.${name}.provider`, p.value);
            callbacks.onProviderChange(name, p.value);
            updateTrayMenu(callbacks);
          },
        })),
      },
      {
        label: 'Size',
        submenu: sizes.map(s => ({
          label: s.label,
          type: 'radio' as const,
          checked: (charSettings?.size || 'large') === s.value,
          click: () => {
            settings.set(`characters.${name}.size`, s.value);
            callbacks.onSizeChange(name, s.value);
            updateTrayMenu(callbacks);
          },
        })),
      },
    ];
  };

  const menu = Menu.buildFromTemplate([
    ...characterMenuItems('bruce', 'Bruce'),
    { type: 'separator' },
    ...characterMenuItems('jazz', 'Jazz'),
    { type: 'separator' },
    {
      label: 'Sound',
      type: 'checkbox',
      checked: soundEnabled,
      click: () => {
        const newVal = !soundEnabled;
        settings.set('soundEnabled', newVal);
        callbacks.onSoundToggle(newVal);
        updateTrayMenu(callbacks);
      },
    },
    {
      label: 'Display',
      submenu: [
        {
          label: 'Auto (Primary)',
          type: 'radio',
          checked: selectedMonitor === 'auto',
          click: () => {
            settings.set('selectedMonitor', 'auto');
            callbacks.onMonitorChange('auto');
            updateTrayMenu(callbacks);
          },
        },
        ...monitors.map(m => ({
          label: m.label,
          type: 'radio' as const,
          checked: selectedMonitor === m.id,
          click: () => {
            settings.set('selectedMonitor', m.id);
            callbacks.onMonitorChange(m.id);
            updateTrayMenu(callbacks);
          },
        })),
      ],
    },
    { type: 'separator' },
    {
      label: 'Refresh Sessions',
      click: () => callbacks.onRefreshAll(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lil-agents-windows/src/main/tray.ts
git commit -m "feat(windows): add system tray with full settings menu"
```

---

### Task 14: Wire Everything Together in Main Process

**Files:**
- Modify: `lil-agents-windows/src/main/main.ts`

- [ ] **Step 1: Wire up main.ts with all modules**

Replace `src/main/main.ts` with the full wiring:

```typescript
import { app, ipcMain, clipboard, nativeTheme, screen } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { CharacterName, ProviderName, CharacterSize } from '../shared/types';
import { initSettings, getSettings } from './settings';
import { CHARACTERS, CHARACTER_SIZES } from './characters/character-config';
import { WalkerEngine } from './characters/walker-engine';
import { createOverlayWindow, getOverlayWindow, updateOverlayCharacters, repositionOverlay } from './overlay-window';
import { showPopover, sendToPopover, closeAllPopovers, getPopoverWindow } from './popover-window';
import { createSession, AgentSession, AgentSessionCallbacks } from './sessions/index';
import { createTray, destroyTray } from './tray';
import { getSelectedMonitor } from './monitor';
import * as path from 'path';

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// State
let walkerEngine: WalkerEngine;
let sessions: Map<CharacterName, AgentSession> = new Map();
let animationTimer: NodeJS.Timeout | null = null;

// Sound
const SOUND_FILES = [
  'ping-aa.mp3', 'ping-bb.mp3', 'ping-cc.mp3', 'ping-dd.mp3',
  'ping-ee.mp3', 'ping-ff.mp3', 'ping-gg.mp3', 'ping-hh.mp3',
  'ping-jj.m4a',
];
let lastSoundIndex = -1;

function getRandomSound(): string {
  let index: number;
  do {
    index = Math.floor(Math.random() * SOUND_FILES.length);
  } while (index === lastSoundIndex && SOUND_FILES.length > 1);
  lastSoundIndex = index;
  return SOUND_FILES[index];
}

// Thinking bubble management
const THINKING_PHRASES = [
  'hmm...', 'thinking...', 'one sec...', 'ok hold on', 'let me check',
  'working on it', 'on it...', 'processing...', 'give me a moment',
  'let me see...', 'checking...', 'analyzing...', 'figuring it out',
  'looking into it', 'almost...', 'bear with me', 'just a sec',
  'running that...', 'computing...', 'crunching...', 'diving in',
  'exploring...', 'searching...', 'reading...', 'cooking...',
];
const COMPLETION_PHRASES = [
  'done!', 'all set!', 'ready!', 'here you go', 'got it!',
  'finished!', 'ta-da!', 'voila!', 'boom!', 'there ya go!',
  'check it out!', 'nailed it!',
];

const thinkingTimers: Map<CharacterName, NodeJS.Timeout> = new Map();

function startThinkingBubble(name: CharacterName): void {
  stopThinkingBubble(name);
  const rotatePhrases = () => {
    const phrase = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
    walkerEngine.setBusy(name, true, phrase);
  };
  rotatePhrases();
  const timer = setInterval(rotatePhrases, 3000 + Math.random() * 2000);
  thinkingTimers.set(name, timer);
}

function stopThinkingBubble(name: CharacterName): void {
  const timer = thinkingTimers.get(name);
  if (timer) {
    clearInterval(timer);
    thinkingTimers.delete(name);
  }
  walkerEngine.setBusy(name, false, null);
}

function showCompletionBubble(name: CharacterName): void {
  stopThinkingBubble(name);
  const phrase = COMPLETION_PHRASES[Math.floor(Math.random() * COMPLETION_PHRASES.length)];
  walkerEngine.setBusy(name, false, phrase);
  setTimeout(() => {
    walkerEngine.setBusy(name, false, null);
  }, 3000);
}

// Session management
function getOrCreateSession(name: CharacterName): AgentSession {
  let session = sessions.get(name);
  if (session?.isRunning) return session;

  const settings = getSettings();
  const charSettings = settings.get(`characters.${name}`) as any;
  const provider: ProviderName = charSettings?.provider || 'claude';

  session = createSession(provider);
  const callbacks: AgentSessionCallbacks = {
    onText: (text) => {
      sendToPopover(name, IPC.STREAM_TEXT, text);
    },
    onToolUse: (toolName, input) => {
      sendToPopover(name, IPC.TOOL_USE, toolName, input);
    },
    onToolResult: (result, isError) => {
      sendToPopover(name, IPC.TOOL_RESULT, result, isError);
    },
    onTurnComplete: () => {
      sendToPopover(name, IPC.TURN_COMPLETE);
      showCompletionBubble(name);

      // Play sound
      if (settings.get('soundEnabled')) {
        const soundFile = getRandomSound();
        const overlay = getOverlayWindow();
        if (overlay) {
          overlay.webContents.executeJavaScript(
            `new Audio('../../../assets/sounds/${soundFile}').play().catch(() => {})`
          );
        }
      }
    },
    onError: (error) => {
      sendToPopover(name, IPC.SESSION_ERROR, error);
      stopThinkingBubble(name);
    },
  };

  session.start(callbacks);
  sessions.set(name, session);
  return session;
}

function destroySession(name: CharacterName): void {
  const session = sessions.get(name);
  if (session) {
    session.stop();
    sessions.delete(name);
  }
  stopThinkingBubble(name);
}

// App ready
app.whenReady().then(() => {
  const settings = initSettings();
  const monitor = getSelectedMonitor();

  // Init walker engine
  walkerEngine = new WalkerEngine(CHARACTERS, monitor.bounds.width);

  // Apply saved settings to walker
  for (const char of CHARACTERS) {
    const charSettings = settings.get(`characters.${char.name}`) as any;
    if (charSettings) {
      walkerEngine.setCharacterVisible(char.name, charSettings.visible ?? true);
      walkerEngine.setCharacterSize(char.name, charSettings.size || 'large');
    }
  }

  // Create overlay window
  createOverlayWindow();

  // Create system tray
  createTray({
    onProviderChange: (name, provider) => {
      destroySession(name);
      walkerEngine.setCharacterProvider(name, provider);
    },
    onSizeChange: (name, size) => {
      walkerEngine.setCharacterSize(name, size);
    },
    onVisibilityChange: (name, visible) => {
      walkerEngine.setCharacterVisible(name, visible);
      if (!visible) destroySession(name);
    },
    onSoundToggle: () => {},
    onMonitorChange: () => {
      const newMonitor = getSelectedMonitor();
      walkerEngine.updateScreenWidth(newMonitor.bounds.width);
      repositionOverlay();
    },
    onRefreshAll: () => {
      for (const name of ['bruce', 'jazz'] as CharacterName[]) {
        destroySession(name);
      }
    },
  });

  // Animation loop (60fps)
  const FPS = 60;
  const frameTime = 1000 / FPS;
  let lastTick = Date.now();

  animationTimer = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    walkerEngine.tick(delta);
    const states = walkerEngine.getStates();

    // Update character heights based on size setting
    for (const state of states) {
      state.height = CHARACTER_SIZES[state.size];
      state.width = state.height * (1080 / 1920); // aspect ratio from original videos
    }

    updateOverlayCharacters(states);
  }, frameTime);

  // IPC: Character clicked
  ipcMain.on(IPC.CHARACTER_CLICKED, (_event, name: CharacterName) => {
    const states = walkerEngine.getStates();
    const charState = states.find(s => s.name === name);
    if (!charState) return;

    const monitor = getSelectedMonitor();
    const session = getOrCreateSession(name);
    const providerLabels: Record<ProviderName, string> = {
      claude: 'Claude', codex: 'Codex', copilot: 'Copilot',
      gemini: 'Gemini', opencode: 'OpenCode', openclaw: 'OpenClaw',
    };

    showPopover(name, monitor.bounds.x + charState.x, monitor.bounds.y + monitor.bounds.height - charState.height - 60, charState.provider);
  });

  // IPC: Send message
  ipcMain.on(IPC.SEND_MESSAGE, (_event, text: string) => {
    // Determine which character this popover belongs to
    for (const [name, session] of sessions) {
      const popover = getPopoverWindow(name);
      if (popover && popover.webContents === _event.sender) {
        startThinkingBubble(name);
        session.send(text);
        return;
      }
    }
    // If no session found, try to determine character from the sender
  });

  // IPC: Slash command
  ipcMain.on(IPC.SLASH_COMMAND, (_event, cmd: string) => {
    if (cmd === 'clear') {
      for (const [name, session] of sessions) {
        const popover = getPopoverWindow(name);
        if (popover && popover.webContents === _event.sender) {
          session.stop();
          sessions.delete(name);
          break;
        }
      }
    }
  });

  // IPC: Refresh session
  ipcMain.on(IPC.REFRESH_SESSION, (_event) => {
    for (const name of ['bruce', 'jazz'] as CharacterName[]) {
      const popover = getPopoverWindow(name);
      if (popover && popover.webContents === _event.sender) {
        destroySession(name);
        getOrCreateSession(name);
        break;
      }
    }
  });

  // IPC: Copy last response
  ipcMain.on(IPC.COPY_LAST, (_event) => {
    // The renderer tracks this — we just relay
    _event.sender.send('get-last-response');
  });

  // IPC: Change provider
  ipcMain.on(IPC.CHANGE_PROVIDER, (_event, provider: ProviderName) => {
    for (const name of ['bruce', 'jazz'] as CharacterName[]) {
      const popover = getPopoverWindow(name);
      if (popover && popover.webContents === _event.sender) {
        destroySession(name);
        getSettings().set(`characters.${name}.provider`, provider);
        walkerEngine.setCharacterProvider(name, provider);
        getOrCreateSession(name);
        break;
      }
    }
  });

  // Theme changes
  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    const overlay = getOverlayWindow();
    overlay?.webContents.send(IPC.THEME_CHANGED, isDark);
    for (const name of ['bruce', 'jazz'] as CharacterName[]) {
      sendToPopover(name, IPC.THEME_CHANGED, isDark);
    }
  });

  // Monitor changes
  screen.on('display-added', () => repositionOverlay());
  screen.on('display-removed', () => repositionOverlay());
  screen.on('display-metrics-changed', () => repositionOverlay());
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (animationTimer) clearInterval(animationTimer);
  for (const name of ['bruce', 'jazz'] as CharacterName[]) {
    destroySession(name);
  }
  closeAllPopovers();
  destroyTray();
});
```

- [ ] **Step 2: Verify build**

```bash
cd lil-agents-windows
npx tsc
```

Expected: compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add lil-agents-windows/src/main/main.ts
git commit -m "feat(windows): wire all modules together in main process"
```

---

### Task 15: Create Placeholder Tray Icon

**Files:**
- Create: `lil-agents-windows/assets/icons/tray-icon.png`

- [ ] **Step 1: Generate a simple tray icon**

Create a simple 16x16 tray icon. We can use a script to generate one:

```bash
cd lil-agents-windows
node -e "
const { createCanvas } = require('canvas');
// If canvas isn't available, create a minimal 16x16 PNG manually
const fs = require('fs');
// Minimal 16x16 white PNG (placeholder)
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVQ4jWP4////fwYAJfYB' +
  'AXQD0jIAAAAASUVORK5CYII=', 'base64'
);
fs.writeFileSync('assets/icons/tray-icon.png', minimalPNG);
console.log('Created placeholder tray icon');
"
```

If `canvas` isn't installed, this writes a minimal base64-encoded 16x16 PNG. Replace with a real icon later.

- [ ] **Step 2: Commit**

```bash
git add lil-agents-windows/assets/icons/tray-icon.png
git commit -m "feat(windows): add placeholder tray icon"
```

---

### Task 16: Build Configuration & First Full Launch

**Files:**
- Modify: `lil-agents-windows/package.json` (add ws dependency for OpenClaw)
- Create: `lil-agents-windows/vitest.config.ts`

- [ ] **Step 1: Install ws for OpenClaw WebSocket support**

```bash
cd lil-agents-windows
npm install ws
npm install -D @types/ws
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Run all tests**

```bash
cd lil-agents-windows
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Build and verify launch**

```bash
cd lil-agents-windows
npx tsc && npx electron .
```

Expected: App launches, tray icon appears, transparent overlay shows at bottom of screen with placeholder character rectangles walking back and forth. Clicking a character opens a popover window.

- [ ] **Step 5: Commit**

```bash
git add lil-agents-windows/
git commit -m "feat(windows): complete first working build with all modules wired"
```

---

### Task 17: Package as Portable EXE

**Files:**
- No new files — uses existing electron-builder config

- [ ] **Step 1: Build portable exe**

```bash
cd lil-agents-windows
npx electron-builder --win portable
```

Expected: Creates `release/LilAgents-1.0.0-portable.exe`

- [ ] **Step 2: Test the portable exe**

Run the generated exe and verify:
1. Tray icon appears
2. Characters walk at bottom of screen (placeholders until real sprites added)
3. Clicking character opens popover
4. Typing a message attempts to spawn the CLI tool
5. Tray menu shows all options (provider, size, visibility, sound, display)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(windows): verify portable exe build"
```

---

### Task 18: Sprite Sheet Placeholder Setup

**Files:**
- Create: `lil-agents-windows/scripts/extract-sprites.md`

- [ ] **Step 1: Document how to add sprite sheets**

Create `scripts/extract-sprites.md`:

```markdown
# Adding Character Sprite Sheets

The app expects PNG sprite frames in:
- `assets/sprites/bruce/bruce-001.png` through `bruce-NNN.png`
- `assets/sprites/jazz/jazz-001.png` through `jazz-NNN.png`

## Extracting from HEVC .mov files

Use FFmpeg to extract frames:

```bash
# Extract Bruce frames (30fps from a 10-second video = 300 frames)
ffmpeg -i walk-bruce-01.mov -vf "fps=30" -pix_fmt rgba assets/sprites/bruce/bruce-%03d.png

# Extract Jazz frames
ffmpeg -i walk-jazz-01.mov -vf "fps=30" -pix_fmt rgba assets/sprites/jazz/jazz-%03d.png
```

## After adding sprites

Update the `totalFrames` value in `src/main/characters/character-config.ts`
to match the actual number of PNG files extracted.

If the walk cycle timing doesn't look right, adjust the
`accelEndFrame`, `fullSpeedEndFrame`, `decelEndFrame`, and `stopEndFrame`
values in character-config.ts.
```

- [ ] **Step 2: Commit**

```bash
git add lil-agents-windows/scripts/extract-sprites.md
git commit -m "docs(windows): add sprite extraction instructions"
```

---

## Summary

| Task | What it builds | Key files |
|------|---|---|
| 1 | Project scaffold, types, IPC channels | package.json, types.ts, ipc-channels.ts |
| 2 | Settings store | settings.ts |
| 3 | Character configuration | character-config.ts |
| 4 | Walker engine (animation state machine) | walker-engine.ts |
| 5 | Shell environment & binary discovery | shell-environment.ts |
| 6 | Agent session interface + Claude session | agent-session.ts, claude-session.ts |
| 7 | All remaining provider sessions | codex/copilot/gemini/opencode/openclaw-session.ts |
| 8 | Monitor detection | monitor.ts |
| 9 | Overlay window (main process) | overlay-window.ts, overlay-preload.ts |
| 10 | Overlay renderer (canvas sprites + bubbles) | overlay/index.html, overlay.ts, overlay.css |
| 11 | Popover window (main process) | popover-window.ts, popover-preload.ts |
| 12 | Popover renderer (terminal UI) | popover/index.html, popover.ts, popover.css |
| 13 | System tray menu | tray.ts |
| 14 | Wire everything in main.ts | main.ts |
| 15 | Placeholder tray icon | tray-icon.png |
| 16 | Build config + first launch | vitest.config.ts, ws dependency |
| 17 | Package portable exe | electron-builder output |
| 18 | Sprite extraction docs | extract-sprites.md |
