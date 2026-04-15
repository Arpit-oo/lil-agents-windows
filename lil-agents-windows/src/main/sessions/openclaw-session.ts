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
      callbacks.onError('OpenClaw gateway URL not configured.');
      this.isRunning = false;
      return;
    }
    try {
      const url = new URL(this.config.gatewayURL);
      if (this.config.authToken) url.searchParams.set('token', this.config.authToken);
      url.searchParams.set('session', this.sessionKey);
      if (this.config.agentId) url.searchParams.set('agent', this.config.agentId);

      this.ws = new WebSocket(url.toString());
      this.ws.on('open', () => { this.isRunning = true; });
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'text') this.callbacks?.onText(msg.content || '');
          else if (msg.type === 'tool_use') this.callbacks?.onToolUse(msg.name || 'unknown', msg.input || '');
          else if (msg.type === 'tool_result') this.callbacks?.onToolResult(msg.content || '', msg.is_error || false);
          else if (msg.type === 'turn_complete' || msg.type === 'result') this.callbacks?.onTurnComplete();
          else if (msg.type === 'error') this.callbacks?.onError(msg.message || 'OpenClaw error');
        } catch { this.callbacks?.onText(data.toString()); }
      });
      this.ws.on('close', () => { this.isRunning = false; });
      this.ws.on('error', (err: Error) => { this.callbacks?.onError(`OpenClaw error: ${err.message}`); this.isRunning = false; });
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
    if (this.ws) { this.ws.close(); this.ws = null; }
    super.stop();
  }
}
