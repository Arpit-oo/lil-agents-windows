import { execSync, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ProviderName } from '../shared/types';

export const PROVIDER_BINARY_NAMES: Record<ProviderName, string | null> = {
  claude: 'claude',
  codex: 'codex',
  copilot: 'copilot',
  gemini: 'gemini',
  opencode: 'opencode',
  openclaw: null,
};

export function getBinaryName(provider: ProviderName): string | null {
  return PROVIDER_BINARY_NAMES[provider];
}

const home = process.env.USERPROFILE || process.env.HOME || '';
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

export const FALLBACK_PATHS: string[] = [
  path.join(appData, 'npm'),
  path.join(localAppData, 'Programs'),
  path.join(home, '.local', 'bin'),
  path.join(home, 'scoop', 'shims'),
  path.join(home, '.cargo', 'bin'),
  'C:\\Program Files\\nodejs',
  'C:\\Program Files (x86)\\nodejs',
];

let resolvedPaths: Map<string, string> = new Map();
let shellPathResolved = false;
let shellPATH: string[] = [];

export async function resolveShellPATH(): Promise<string[]> {
  if (shellPathResolved) return shellPATH;
  try {
    const output = execSync(
      'powershell -NoProfile -Command "& { $env:PATH }"',
      { encoding: 'utf8', timeout: 10000 }
    );
    shellPATH = output.trim().split(';').filter(Boolean);
    shellPathResolved = true;
  } catch {
    shellPATH = (process.env.PATH || '').split(';').filter(Boolean);
    shellPathResolved = true;
  }
  return shellPATH;
}

export async function findBinary(provider: ProviderName, customPath?: string): Promise<string | null> {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const binaryName = getBinaryName(provider);
  if (!binaryName) return null;

  if (resolvedPaths.has(binaryName)) {
    return resolvedPaths.get(binaryName)!;
  }

  const pathDirs = await resolveShellPATH();
  const extensions = ['.cmd', '.exe', '.bat', '.ps1', ''];

  for (const dir of [...pathDirs, ...FALLBACK_PATHS]) {
    for (const ext of extensions) {
      const candidate = path.join(dir, binaryName + ext);
      if (fs.existsSync(candidate)) {
        resolvedPaths.set(binaryName, candidate);
        return candidate;
      }
    }
  }

  return null;
}

export function spawnViaPowerShell(binaryPath: string, args: string[], env?: Record<string, string>): ChildProcess {
  const psArgs = [
    '-NoLogo',
    '-NoProfile',
    '-Command',
    `& '${binaryPath}' ${args.map(a => `'${a}'`).join(' ')}`,
  ];

  const processEnv = { ...process.env, ...env };
  delete processEnv.CLAUDE_CODE;
  delete processEnv.CLAUDE_CODE_ENTRYPOINT;

  return spawn('powershell', psArgs, {
    env: processEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
