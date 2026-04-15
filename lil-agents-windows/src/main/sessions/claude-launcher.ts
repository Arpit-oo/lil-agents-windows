import { execSync, spawn } from 'child_process';
import { findBinary } from '../shell-environment';

export interface ClaudeSession {
  id: string;
  name: string;
  lastActive: string;
}

/**
 * List active Claude Code sessions by running `claude sessions list`
 */
export async function listClaudeSessions(): Promise<ClaudeSession[]> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) return [];

  try {
    const output = execSync(
      `powershell -NoProfile -Command "& '${binaryPath}' sessions list"`,
      { encoding: 'utf8', timeout: 10000 }
    );

    // Parse the output — claude sessions list outputs a table like:
    // Session ID    Name    Last Active
    // abc123        ...     2024-01-01
    const lines = output.trim().split('\n').filter(l => l.trim());
    if (lines.length <= 1) return []; // Header only or empty

    const sessions: ClaudeSession[] = [];
    // Skip header line(s) — look for lines that start with session-like IDs
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('-') || line.startsWith('=')) continue;

      // Try to parse space-separated columns
      const parts = line.split(/\s{2,}/); // Split on 2+ spaces
      if (parts.length >= 1) {
        sessions.push({
          id: parts[0]?.trim() || '',
          name: parts[1]?.trim() || parts[0]?.trim() || 'Unknown',
          lastActive: parts[2]?.trim() || '',
        });
      }
    }
    return sessions;
  } catch (err) {
    console.warn('[claude-launcher] Failed to list sessions:', err);
    return [];
  }
}

/**
 * Get the most recent session ID
 */
export async function getLastSessionId(): Promise<string | null> {
  const sessions = await listClaudeSessions();
  if (sessions.length === 0) return null;
  return sessions[0].id;
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

  const args = sessionId
    ? `& '${binaryPath}' --resume '${sessionId}'`
    : `& '${binaryPath}'`;

  // Open a new PowerShell window with Claude running inside
  spawn('powershell', [
    '-NoExit',
    '-Command',
    args,
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  }).unref();
}

/**
 * Launch Claude Code in an embedded terminal (returns the command + args for xterm.js PTY)
 */
export async function getClaudeLaunchCommand(sessionId?: string): Promise<{ cmd: string; args: string[] } | null> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) return null;

  const args = sessionId
    ? ['--resume', sessionId]
    : [];

  return { cmd: binaryPath, args };
}
