# lil-agents Windows Port — Design Spec

## Summary

Port the macOS "lil-agents" desktop companion app to Windows using Electron + TypeScript. Two animated characters (Bruce and Jazz) walk back and forth at the bottom of the screen above the taskbar. Clicking a character opens a popover chat terminal connected to an AI CLI tool (Claude, Codex, Copilot, Gemini, OpenCode, or OpenClaw). A system tray icon provides settings access.

## Decisions from Brainstorming

| Area | Decision |
|---|---|
| Tech stack | Electron + TypeScript |
| Character position | Bottom of screen, full screen width, stay floating if taskbar hides |
| Animation rendering | Pre-converted sprite sheet PNGs (user provides), 60fps via requestAnimationFrame |
| Hit testing | Center 60% of character bounding box |
| Taskbar support | Bottom-only, full screen width walk area |
| Multi-monitor | User picks monitor via tray menu |
| AI providers | All 6: Claude, Codex, Copilot, Gemini, OpenCode, OpenClaw |
| Terminal output | Simple for v1 — basic text, can improve later |
| Settings UI | Native system tray context menu |
| Themes | Single theme, auto light/dark from Windows preference |
| Sounds | Ship original 9 ping sound files |
| CLI discovery | Auto-detect PATH + common Windows locations, manual override if not found |
| Memory budget | Don't care (~150MB Electron is fine) |
| Window strategy | Single transparent always-on-top overlay for characters |
| Thinking indicator | Speech bubble with rotating phrases (matching macOS) |
| Characters | Bruce + Jazz hardcoded, but assets/sounds easily swappable in code |
| Session lifecycle | Keep alive until provider switch or quit |
| Distribution | Portable .exe, default Electron bundle size |
| Shell spawning | Via PowerShell for full user environment |
| Taskbar geometry | Ignore taskbar layout — walk full screen width |

## Architecture

### Process Model (Electron)

```
Main Process (Node.js)
├── App lifecycle, single-instance lock
├── System tray icon + context menu
├── Overlay BrowserWindow (transparent, always-on-top, click-through)
│   └── Renderer: sprite animation, speech bubbles, click detection
├── Popover BrowserWindow (per-character, shown on click)
│   └── Renderer: terminal UI, input field, markdown-light output
├── ShellEnvironment — resolves PATH via PowerShell, finds CLI binaries
├── AgentSessions — spawns/manages CLI processes per character
└── Settings — persisted via electron-store (JSON file)
```

### IPC Flow

```
Overlay Renderer                Main Process              Popover Renderer
      |                              |                          |
      |--character-clicked(name)---->|                          |
      |                              |--show-popover(name)----->|
      |                              |                          |
      |                              |<--send-message(text)-----|
      |                              |  (spawn/send to CLI)     |
      |                              |                          |
      |<--thinking-state(name,busy)--|--stream-text(chunk)----->|
      |                              |--turn-complete----------->|
      |<--thinking-done(name)--------|                          |
```

### Character Animation

- Sprite sheets: sequences of PNG frames extracted from the original HEVC .mov files
- Walking state machine: `Paused → Walking → Paused` (same as macOS)
- Movement: ease-in/ease-out across full screen width, random walk distance 200-325px (normalized)
- Two characters maintain minimum 12% screen-width separation
- 60fps `requestAnimationFrame` loop in overlay renderer

### Overlay Window

- Transparent, frameless `BrowserWindow` with `alwaysOnTop: true`
- Positioned at bottom of selected monitor, height ~250px (character + bubble space)
- Mouse events pass through transparent areas (Electron `setIgnoreMouseEvents` with forwarding)
- Click detection: when mouse enters center 60% of a character's bounding box, temporarily enable mouse events

### Popover Window

- Standard frameless `BrowserWindow`, ~420x350px
- Positioned above the clicked character
- Title bar with provider dropdown, refresh button, copy button
- Scrollable text output area
- Single-line input field with placeholder "Ask {Provider}..."
- Slash commands: `/clear`, `/copy`, `/help`

### AI Provider Sessions

All providers implement a common interface:

```typescript
interface AgentSession {
  start(): Promise<void>;
  send(message: string): void;
  stop(): void;
  onText: (text: string) => void;
  onToolUse: (tool: string, input: string) => void;
  onToolResult: (result: string, isError: boolean) => void;
  onTurnComplete: () => void;
  onError: (error: string) => void;
}
```

Session implementations spawn CLI processes via PowerShell:
- **Claude**: Multi-turn, NDJSON streaming (`--output-format stream-json`)
- **Codex/Copilot/Gemini/OpenCode**: One-shot execution per message, history concatenated
- **OpenClaw**: WebSocket to gateway (not CLI-spawned)

### CLI Binary Discovery

1. Query `PATH` via `powershell -Command "& { $env:PATH }"`
2. Search PATH directories for binary
3. Check common fallback locations:
   - `%APPDATA%\npm` (npm global installs)
   - `%LOCALAPPDATA%\Programs` (local installs)
   - `%USERPROFILE%\.local\bin`
   - `%USERPROFILE%\scoop\shims` (Scoop)
   - `C:\Program Files\nodejs` (Node.js)
4. If not found, provider shows "not found" state with option to configure path manually

### Settings (electron-store)

```json
{
  "selectedTheme": "auto",
  "soundEnabled": true,
  "selectedMonitor": "auto",
  "characters": {
    "bruce": { "visible": true, "provider": "claude", "size": "large" },
    "jazz": { "visible": true, "provider": "claude", "size": "large" }
  },
  "providerPaths": {},
  "openClaw": {
    "gatewayURL": "ws://localhost:3001",
    "authToken": "",
    "sessionPrefix": "lil-agents",
    "agentId": null
  }
}
```

### Theme

Single theme that auto-detects Windows light/dark mode via `nativeTheme.shouldUseDarkColors`:
- **Light**: warm off-white background, soft border, dark text
- **Dark**: near-black background, accent border, light text

### Sound

9 completion sound files bundled in `assets/sounds/`. Randomly selected (no consecutive repeats) via `Audio` API in renderer.

### File Structure

```
lil-agents-windows/
├── package.json
├── tsconfig.json
├── electron-builder.json5
├── src/
│   ├── main/
│   │   ├── main.ts                 — App entry, lifecycle, single-instance
│   │   ├── tray.ts                 — System tray icon + context menu
│   │   ├── overlay-window.ts       — Creates/positions overlay BrowserWindow
│   │   ├── popover-window.ts       — Creates/manages popover BrowserWindows
│   │   ├── shell-environment.ts    — PowerShell PATH, binary discovery
│   │   ├── settings.ts             — electron-store wrapper
│   │   ├── monitor.ts              — Monitor detection + selection
│   │   ├── sessions/
│   │   │   ├── agent-session.ts    — Interface + base class
│   │   │   ├── claude-session.ts
│   │   │   ├── codex-session.ts
│   │   │   ├── copilot-session.ts
│   │   │   ├── gemini-session.ts
│   │   │   ├── opencode-session.ts
│   │   │   └── openclaw-session.ts
│   │   └── characters/
│   │       ├── character-config.ts  — Bruce/Jazz definitions, easy to swap
│   │       └── walker-engine.ts     — Walking state machine + separation logic
│   ├── renderer/
│   │   ├── overlay/
│   │   │   ├── index.html
│   │   │   ├── overlay.ts          — Sprite rendering, bubbles, click zones
│   │   │   └── overlay.css
│   │   └── popover/
│   │       ├── index.html
│   │       ├── popover.ts          — Terminal display, input, slash commands
│   │       └── popover.css
│   ├── preload/
│   │   ├── overlay-preload.ts      — contextBridge for overlay
│   │   └── popover-preload.ts      — contextBridge for popover
│   └── shared/
│       ├── types.ts                — Shared type definitions
│       └── ipc-channels.ts         — IPC channel constants
├── assets/
│   ├── sprites/
│   │   ├── bruce/                  — bruce-001.png ... bruce-NNN.png
│   │   └── jazz/                   — jazz-001.png ... jazz-NNN.png
│   ├── sounds/
│   │   ├── ping-aa.mp3
│   │   ├── ping-bb.mp3
│   │   ├── ping-cc.mp3
│   │   ├── ping-dd.mp3
│   │   ├── ping-ee.mp3
│   │   ├── ping-ff.mp3
│   │   ├── ping-gg.mp3
│   │   ├── ping-hh.mp3
│   │   └── ping-jj.m4a
│   └── icons/
│       ├── tray-icon.png
│       └── tray-icon@2x.png
└── tests/
    ├── walker-engine.test.ts
    ├── shell-environment.test.ts
    ├── character-config.test.ts
    └── sessions/
        └── claude-session.test.ts
```
