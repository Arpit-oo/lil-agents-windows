export type CharacterName = 'bruce' | 'jazz';

export type ProviderName = 'claude' | 'codex' | 'copilot' | 'gemini' | 'opencode' | 'openclaw';

export type CharacterSize = 'large' | 'medium' | 'small';

export interface CharacterState {
  name: CharacterName;
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  flipped: boolean;
  isWalking: boolean;
  isBusy: boolean;
  bubbleText: string | null;
  provider: ProviderName;
  size: CharacterSize;
  visible: boolean;
}

export interface WalkCycle {
  totalFrames: number;
  accelEndFrame: number;
  fullSpeedEndFrame: number;
  decelEndFrame: number;
  stopEndFrame: number;
}

export interface CharacterConfig {
  name: CharacterName;
  displayName: string;
  color: string;
  spriteDir: string;
  walkCycle: WalkCycle;
  yOffset: number;
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
  selectedMonitor: string;
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
