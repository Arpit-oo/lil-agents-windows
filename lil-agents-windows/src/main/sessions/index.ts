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
    case 'claude': return new ClaudeSession(customPath);
    case 'codex': return new CodexSession(customPath);
    case 'copilot': return new CopilotSession(customPath);
    case 'gemini': return new GeminiSession(customPath);
    case 'opencode': return new OpenCodeSession(customPath);
    case 'openclaw':
      return new OpenClawSession({
        gatewayURL: settings.get('openClaw.gatewayURL') || 'ws://localhost:3001',
        authToken: settings.get('openClaw.authToken') || '',
        sessionPrefix: settings.get('openClaw.sessionPrefix') || 'lil-agents',
        agentId: settings.get('openClaw.agentId') || null,
      });
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

export { AgentSession, AgentSessionCallbacks } from './agent-session';
