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
