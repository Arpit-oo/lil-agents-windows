import { exec, spawn } from 'child_process';
import { findBinary } from '../shell-environment';

export interface ClaudeSession {
  id: string;
  name: string;
  lastActive: string;
}

/**
 * List active Claude Code sessions (non-blocking, 5s timeout)
 */
export function listClaudeSessions(): Promise<ClaudeSession[]> {
  return new Promise(async (resolve) => {
    const binaryPath = await findBinary('claude');
    if (!binaryPath) {
      console.warn('[claude-launcher] Claude CLI not found');
      resolve([]);
      return;
    }

    const timer = setTimeout(() => {
      console.warn('[claude-launcher] Session listing timed out');
      try { child.kill(); } catch {}
      resolve([]);
    }, 5000);

    const child = exec(
      `powershell -NoProfile -Command "& '${binaryPath}' sessions list"`,
      { encoding: 'utf8', timeout: 5000 },
      (err, stdout) => {
        clearTimeout(timer);
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
  });
}

/**
 * Launch Claude Code in a NEW visible PowerShell window.
 * Uses `cmd /c start` which reliably opens a visible console window on Windows.
 */
export async function launchInPowerShell(sessionId?: string): Promise<void> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) {
    console.error('[claude-launcher] Claude CLI not found');
    return;
  }

  // Build the claude command
  const claudeArgs = sessionId ? `--resume ${sessionId}` : '';
  const title = sessionId ? `Claude Code (${sessionId.slice(0, 8)})` : 'Claude Code';

  // Use cmd /c start to open a visible PowerShell window
  // The "start" command opens a new console window
  const cmd = `start "title" powershell -NoExit -Command "& '${binaryPath}' ${claudeArgs}"`;

  exec(cmd, { windowsHide: false }, (err) => {
    if (err) {
      console.error('[claude-launcher] Failed to launch PowerShell:', err.message);
      // Fallback: try direct spawn with inherited stdio
      const fallbackArgs = sessionId ? ['--resume', sessionId] : [];
      const child = spawn(binaryPath, fallbackArgs, {
        detached: true,
        stdio: 'inherit',
        shell: true,
      });
      child.unref();
    }
  });
}

/**
 * Returns command info for future xterm.js PTY integration
 */
export async function getClaudeLaunchCommand(sessionId?: string): Promise<{ cmd: string; args: string[] } | null> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) return null;
  return { cmd: binaryPath, args: sessionId ? ['--resume', sessionId] : [] };
}
