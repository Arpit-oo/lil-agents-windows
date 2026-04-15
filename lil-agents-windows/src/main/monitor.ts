import { screen } from 'electron';
import { getSettings } from './settings';

export interface MonitorInfo {
  id: string;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

export function getAllMonitors(): MonitorInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map(d => ({
    id: d.id.toString(),
    label: `${d.bounds.width}x${d.bounds.height}${d.id === primary.id ? ' (Primary)' : ''}`,
    bounds: d.bounds,
    workArea: d.workArea,
    isPrimary: d.id === primary.id,
  }));
}

export function getSelectedMonitor(): MonitorInfo {
  const monitors = getAllMonitors();
  const selected = getSettings().get('selectedMonitor');
  if (selected && selected !== 'auto') {
    const found = monitors.find(m => m.id === selected);
    if (found) return found;
  }
  return monitors.find(m => m.isPrimary) || monitors[0];
}

export function getOverlayBounds(monitor: MonitorInfo): { x: number; y: number; width: number; height: number } {
  const overlayHeight = 250;
  let taskbarHeight = monitor.bounds.height - monitor.workArea.height - (monitor.workArea.y - monitor.bounds.y);
  // On Windows with display scaling, workArea can equal bounds (taskbar height = 0).
  // Fall back to a sensible default so overlay sits above the taskbar.
  if (taskbarHeight <= 0) {
    taskbarHeight = 48; // typical Windows 11 taskbar
    console.log('[monitor] taskbarHeight was <= 0, defaulting to', taskbarHeight);
  }
  console.log('[monitor] overlay calc: taskbarHeight=%d overlayHeight=%d', taskbarHeight, overlayHeight);
  return {
    x: monitor.bounds.x,
    y: monitor.bounds.y + monitor.bounds.height - overlayHeight - taskbarHeight,
    width: monitor.bounds.width,
    height: overlayHeight,
  };
}
