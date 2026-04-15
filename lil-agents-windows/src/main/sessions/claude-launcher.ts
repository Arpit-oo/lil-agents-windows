import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { findBinary } from '../shell-environment';

export interface ClaudeSession {
  id: string;
  label: string;
  projectDir: string;
  modifiedAt: number;
  sizeKB: number;
}

/**
 * Find all Claude Code sessions by reading ~/.claude/projects/ directly.
 * This is instant — no CLI call, no blocking.
 */
export function listClaudeSessions(): ClaudeSession[] {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const projectsDir = path.join(home, '.claude', 'projects');

  if (!fs.existsSync(projectsDir)) return [];

  const sessions: ClaudeSession[] = [];

  try {
    const projects = fs.readdirSync(projectsDir);
    for (const project of projects) {
      const projectPath = path.join(projectsDir, project);
      if (!fs.statSync(projectPath).isDirectory()) continue;

      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const id = file.replace('.jsonl', '');
        const stat = fs.statSync(filePath);

        sessions.push({
          id,
          label: '', // Will be filled with first user message
          projectDir: project.replace(/--/g, '/').replace(/^C-/, 'C:'),
          modifiedAt: stat.mtimeMs,
          sizeKB: Math.round(stat.size / 1024),
        });
      }
    }
  } catch (err) {
    console.warn('[claude-launcher] Error reading sessions:', err);
  }

  // Sort by most recently modified
  sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return sessions;
}

/**
 * Get the first user message from a session file as a label (reads just first few lines).
 */
export function getSessionLabel(sessionId: string, projectDir: string): Promise<string> {
  return new Promise((resolve) => {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    // Convert project dir back to the encoded folder name
    const encodedProject = projectDir.replace('C:', 'C-').replace(/\//g, '--');
    const filePath = path.join(home, '.claude', 'projects', encodedProject, `${sessionId}.jsonl`);

    if (!fs.existsSync(filePath)) {
      resolve('(unknown)');
      return;
    }

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream });
    let found = false;

    rl.on('line', (line) => {
      if (found) return;
      try {
        const d = JSON.parse(line);
        if (d.type === 'user' && d.message) {
          const msg = d.message;
          let text = '';
          if (typeof msg === 'string') {
            text = msg;
          } else if (msg.content) {
            if (typeof msg.content === 'string') {
              text = msg.content;
            } else if (Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (block.type === 'text' && block.text) {
                  text = block.text;
                  break;
                }
              }
            }
          }
          if (text) {
            found = true;
            rl.close();
            stream.destroy();
            resolve(text.slice(0, 60).replace(/\n/g, ' '));
          }
        }
      } catch {}
    });

    rl.on('close', () => {
      if (!found) resolve('(empty session)');
    });

    // Safety timeout
    setTimeout(() => {
      if (!found) {
        rl.close();
        stream.destroy();
        resolve('(timeout)');
      }
    }, 500);
  });
}

/**
 * Launch Claude Code in a NEW visible PowerShell window.
 */
export async function launchInPowerShell(mode: 'new' | 'continue' | 'resume' | 'resume-pick', sessionId?: string): Promise<void> {
  const binaryPath = await findBinary('claude');
  if (!binaryPath) {
    console.error('[claude-launcher] Claude CLI not found');
    return;
  }

  let claudeArgs = '';
  switch (mode) {
    case 'new':
      claudeArgs = '';
      break;
    case 'continue':
      claudeArgs = '--continue';
      break;
    case 'resume':
      claudeArgs = sessionId ? `--resume ${sessionId}` : '--continue';
      break;
    case 'resume-pick':
      claudeArgs = '--resume'; // Opens interactive picker
      break;
  }

  // Use cmd /c start to open a visible PowerShell window
  const cmd = `start "" powershell -NoExit -Command "& '${binaryPath}' ${claudeArgs}"`;

  exec(cmd, { windowsHide: false }, (err) => {
    if (err) {
      console.error('[claude-launcher] Failed to launch:', err.message);
    }
  });
}
