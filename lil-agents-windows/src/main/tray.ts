import { Tray, Menu, nativeImage, nativeTheme, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getSettings } from './settings';
import { getAllMonitors } from './monitor';
import { CharacterName, ProviderName, CharacterSize } from '../shared/types';

type TrayCallbacks = {
  onProviderChange: (character: CharacterName, provider: ProviderName) => void;
  onSizeChange: (character: CharacterName, size: CharacterSize) => void;
  onVisibilityChange: (character: CharacterName, visible: boolean) => void;
  onSoundToggle: (enabled: boolean) => void;
  onMonitorChange: (monitorId: string) => void;
  onRefreshAll: () => void;
};

let tray: Tray | null = null;

function createFallbackIcon(): Electron.NativeImage {
  // 16x16 solid green PNG encoded as base64 (valid PNG bytes)
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGElEQVR4nGNkOMHAQIxg1YxV' +
    'M1TNAAAEKgAacw6P8QAAAABJRU5ErkJggg==';
  return nativeImage.createFromDataURL(`data:image/png;base64,${pngBase64}`);
}

function resolveTrayIconPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-icon.png'),
    path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'tray-icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function createTray(callbacks: TrayCallbacks): Tray {
  let icon: Electron.NativeImage;
  try {
    const iconPath = resolveTrayIconPath();
    icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    if (icon.isEmpty()) {
      console.warn('[tray] Icon file loaded but is empty, using fallback');
      icon = createFallbackIcon();
    } else {
      icon = icon.resize({ width: 16, height: 16 });
    }
  } catch {
    console.warn('[tray] Failed to load icon, using fallback');
    icon = createFallbackIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip('Lil Agents');
  updateTrayMenu(callbacks);

  nativeTheme.on('updated', () => {
    updateTrayMenu(callbacks);
  });

  return tray;
}

function updateTrayMenu(callbacks: TrayCallbacks): void {
  if (!tray) return;

  const settings = getSettings();
  const monitors = getAllMonitors();
  const selectedMonitor = settings.get('selectedMonitor') || 'auto';
  const soundEnabled = settings.get('soundEnabled');

  const providers: { label: string; value: ProviderName }[] = [
    { label: 'Claude', value: 'claude' },
    { label: 'Codex', value: 'codex' },
    { label: 'Copilot', value: 'copilot' },
    { label: 'Gemini', value: 'gemini' },
    { label: 'OpenCode', value: 'opencode' },
    { label: 'OpenClaw', value: 'openclaw' },
  ];

  const sizes: { label: string; value: CharacterSize }[] = [
    { label: 'Large', value: 'large' },
    { label: 'Medium', value: 'medium' },
    { label: 'Small', value: 'small' },
  ];

  const characterMenuItems = (name: CharacterName, displayName: string): Electron.MenuItemConstructorOptions[] => {
    const charSettings = settings.get(`characters.${name}`) as any;
    return [
      { label: displayName, enabled: false },
      {
        label: 'Visible',
        type: 'checkbox',
        checked: charSettings?.visible ?? true,
        click: () => {
          const newVal = !(charSettings?.visible ?? true);
          settings.set(`characters.${name}.visible` as any, newVal);
          callbacks.onVisibilityChange(name, newVal);
          updateTrayMenu(callbacks);
        },
      },
      {
        label: 'Provider',
        submenu: providers.map(p => ({
          label: p.label,
          type: 'radio' as const,
          checked: (charSettings?.provider || 'claude') === p.value,
          click: () => {
            settings.set(`characters.${name}.provider` as any, p.value);
            callbacks.onProviderChange(name, p.value);
            updateTrayMenu(callbacks);
          },
        })),
      },
      {
        label: 'Size',
        submenu: sizes.map(s => ({
          label: s.label,
          type: 'radio' as const,
          checked: (charSettings?.size || 'large') === s.value,
          click: () => {
            settings.set(`characters.${name}.size` as any, s.value);
            callbacks.onSizeChange(name, s.value);
            updateTrayMenu(callbacks);
          },
        })),
      },
    ];
  };

  const menu = Menu.buildFromTemplate([
    ...characterMenuItems('bruce', 'Bruce'),
    { type: 'separator' },
    ...characterMenuItems('jazz', 'Jazz'),
    { type: 'separator' },
    {
      label: 'Sound',
      type: 'checkbox',
      checked: soundEnabled,
      click: () => {
        const newVal = !soundEnabled;
        settings.set('soundEnabled', newVal);
        callbacks.onSoundToggle(newVal);
        updateTrayMenu(callbacks);
      },
    },
    {
      label: 'Display',
      submenu: [
        {
          label: 'Auto (Primary)',
          type: 'radio',
          checked: selectedMonitor === 'auto',
          click: () => {
            settings.set('selectedMonitor', 'auto');
            callbacks.onMonitorChange('auto');
            updateTrayMenu(callbacks);
          },
        },
        ...monitors.map(m => ({
          label: m.label,
          type: 'radio' as const,
          checked: selectedMonitor === m.id,
          click: () => {
            settings.set('selectedMonitor', m.id);
            callbacks.onMonitorChange(m.id);
            updateTrayMenu(callbacks);
          },
        })),
      ],
    },
    { type: 'separator' },
    { label: 'Refresh Sessions', click: () => callbacks.onRefreshAll() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
