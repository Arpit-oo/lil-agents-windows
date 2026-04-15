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
    this.process = spawnViaPowerShell(binaryPath, ['--output-format', 'stream-json', '--verbose']);
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
    this.buffer = lines.pop() || '';
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
          if (block.type === 'text') return { type: 'text', content: block.text };
          if (block.type === 'tool_use') return { type: 'tool_use', name: block.name, input: JSON.stringify(block.input) };
        }
      }
      if (data.type === 'tool_result' || data.type === 'tool_output') {
        return { type: 'tool_result', content: data.output || data.content || '', isError: data.is_error || false };
      }
      if (data.type === 'result') return { type: 'turn_complete' };
      if (data.type === 'error') return { type: 'error', content: data.error?.message || data.message || 'Unknown error' };
      return { type: 'unknown' };
    } catch {
      return { type: 'text', content: line };
    }
  }

  private dispatchParsed(parsed: NDJSONParsed): void {
    if (!this.callbacks) return;
    switch (parsed.type) {
      case 'text': if (parsed.content) this.callbacks.onText(parsed.content); break;
      case 'tool_use': this.callbacks.onToolUse(parsed.name || 'unknown', parsed.input || ''); break;
      case 'tool_result': this.callbacks.onToolResult(parsed.content || '', parsed.isError || false); break;
      case 'turn_complete': this.callbacks.onTurnComplete(); break;
      case 'error': this.callbacks.onError(parsed.content || 'Unknown error'); break;
    }
  }
}
