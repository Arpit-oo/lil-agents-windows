import { exec, spawn } from 'child_process';
import { findBinary } from '../shell-environment';

export interface ClaudeSession {
  id: string;
  name: string;
  lastActive: string;
}

/**
 * List active Claude Code sessions (non-blocking)
 */
export function listClaudeSessions(): Promise<ClaudeSession[]> {
  return new Promise(async (resolve) => {
    const binaryPath = await findBinary('claude');
    if (!binaryPath) { resolve([]); return; }

    // Use exec (async) instead of execSync to avoid blocking the main process
    const child = exec(
      `powershell -NoProfile -Command "& '${binaryPath}' sessions list"`,
      { encoding: 'utf8', timeout: 5000 },
      (err, stdout) => {
        if (err) {
          console.warn('[claude-launcher] Failed to list sessions:', err.message);
          resolve([]);
          return;
        }

        const lines = stdout.trim().split('\n').filter(l => l.trim());
        if (lines.length <= 1) { resolve([]); return; }

        const sessions: ClaudeSession[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('-') || line.startsWith('=')) continue;

          const parts = line.split(/\s{2,}/);
          if (parts.length >= 1) {
            sessions.push({
              id: parts[0]?.trim() || '',
              name: parts[1]?.trim() || parts[0]?.trim() || 'Unknown',
              lastActive: parts[2]?.trim() || '',
            });
          }
        }
        resolve(sessions);
      }
    );

    // Safety: kill if it takes too long
    setTimeout(() => {
      try { child.kill(); } catch {}
      resolve([]);
    }, 5000);
  });
}

/**
 * Launch Claude Code in a new PowerShell window
 */
export async function launchInPowerShell(sessionId?: string): Promise<void> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) {
    console.error('[claude-launcher] Claude CLI not found');
    return;
  }

  const claudeCmd = sessionId
    ? `& '${binaryPath}' --resume '${sessionId}'`
    : `& '${binaryPath}'`;

  spawn('powershell', ['-NoExit', '-Command', claudeCmd], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  }).unref();
}

/**
 * Returns command info for future xterm.js PTY integration
 */
export async function getClaudeLaunchCommand(sessionId?: string): Promise<{ cmd: string; args: string[] } | null> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) return null;
  return { cmd: binaryPath, args: sessionId ? ['--resume', sessionId] : [] };
}
