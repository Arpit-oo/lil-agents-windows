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
      if (!binaryPath) { this.callbacks?.onError('OpenCode CLI not found.'); return; }
      const fullPrompt = this.history.map(m => `${m.role}: ${m.content}`).join('\n');
      const proc = spawnViaPowerShell(binaryPath, ['--format', 'json', fullPrompt]);
      let output = '';
      proc.stdout?.on('data', (data: Buffer) => { const text = data.toString(); output += text; this.callbacks?.onText(text); });
      proc.stderr?.on('data', (data: Buffer) => { const text = data.toString().trim(); if (text) this.callbacks?.onError(text); });
      proc.on('close', () => { this.history.push({ role: 'assistant', content: output }); this.callbacks?.onTurnComplete(); });
      proc.on('error', (err: Error) => { this.callbacks?.onError(`Failed to run OpenCode: ${err.message}`); });
    })();
  }

  stop(): void { super.stop(); }
}
