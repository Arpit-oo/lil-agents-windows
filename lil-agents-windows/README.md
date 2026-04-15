# lil agents for Windows

[![Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?logo=windows)](https://www.microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

Tiny AI companions that walk above your Windows taskbar.

**Bruce** and **Jazz** pace back and forth at the bottom of your screen. Right-click one to launch a Claude Code session, browse previous conversations, or resume where you left off — all in a built-in mini-terminal with full terminal emulation.

A Windows port of [lil agents for macOS](https://github.com/ryanstephen/lil-agents).

![Screenshot](docs/screenshot.png)

## Features

- **Animated characters** rendered via canvas-based sprite sheets at 60fps
- **Right-click context menu** — start a new Claude Code session, continue the last one, pick from an interactive session browser, resume any recent conversation, change animation, hide/show the other character, or set a custom notification sound
- **Mini-terminal (xterm.js)** — sessions open in a built-in terminal with a purple theme, full color support, interactive prompts, and a working minimize button. Powered by xterm.js + node-pty; no external terminal window required
- **Session management** — recent sessions are read directly from `~/.claude/projects/` (instant, no CLI call) and displayed with time-ago labels across all projects
- **Notification chimes** — plays a random ping at 0.85 volume when Claude finishes responding (2 s idle detection), flashes a green dot on the title bar, and sends a system-tray notification when the terminal is not focused. Custom sounds can be set per-character via the right-click menu
- **6 AI providers** — Claude, Codex, Copilot, Gemini, OpenCode, and OpenClaw
- **System tray** with full settings: per-character provider, size, visibility, sound, and display selection
- **Auto light/dark theme** following your Windows appearance settings
- **Speech bubbles** with randomized thinking and completion phrases
- **Custom GIF animations** — right-click a character and choose "Change animation..." to use your own; the choice persists across restarts. "Reset to original animation" is also available in the same menu
- **Character toggle** — right-click a character to hide/show the other one, or use tray menu → **Characters** → Show both / Bruce only / Jazz only
- **Smooth walking** with ease-in/ease-out animation and collision avoidance between characters

## Getting Started

### Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org/) 18+
- At least one supported AI CLI installed (see [Providers](#providers) below)
- **Visual Studio Build Tools** (or `npm install --global windows-build-tools`) — required to compile [node-pty](https://github.com/microsoft/node-pty), which powers the built-in terminal. Install the "Desktop development with C++" workload from the [VS Build Tools installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [FFmpeg](https://ffmpeg.org/) (only if extracting sprite sheets from the original macOS `.mov` files)

### Install and run

```bash
cd lil-agents-windows
npm install
npm run dev
```

The app launches a transparent overlay window above your taskbar. Two characters will begin walking immediately.

### Build a portable executable

```bash
npm run pack
```

This produces `release/LilAgents-1.0.0-portable.exe` — a single file you can run on any Windows 10/11 machine without installing Node.js.

## Providers

The following CLI tools are supported. Install whichever you want to use, then select it per-character from the tray menu or right-click context menu.

| Provider | Install |
|----------|---------|
| [Claude Code](https://claude.ai/download) | `npm install -g @anthropic-ai/claude-code` |
| [OpenAI Codex](https://github.com/openai/codex) | `npm install -g @openai/codex` |
| [GitHub Copilot](https://github.com/github/copilot-cli) | `npm install -g @githubnext/github-copilot-cli` |
| [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) | `npm install -g @google/gemini-cli` |
| [OpenCode](https://github.com/nicholasgriffintn/opencode) | `npm install -g opencode` |
| [OpenClaw](https://github.com/openclaw/openclaw) | See project README |

## Customization

### Character animations

By default, characters use sprite sheets extracted from the original macOS HEVC videos. To generate them yourself:

```bash
ffmpeg -i ../LilAgents/walk-bruce-01.mov -vf "fps=30" -pix_fmt rgba assets/sprites/bruce/bruce-%03d.png
ffmpeg -i ../LilAgents/walk-jazz-01.mov -vf "fps=30" -pix_fmt rgba assets/sprites/jazz/jazz-%03d.png
```

You can also use any custom GIF: right-click a character and select **Change animation...** to pick a file from disk.

### Themes

The app automatically follows your Windows light or dark mode setting. No manual configuration needed.

### Character visibility

Open the system tray menu and navigate to **Characters** to toggle between showing both characters, Bruce only, or Jazz only. You can also right-click a character and choose **Hide/Show other character** to toggle the companion directly.

### Per-character settings

Right-click a character or use the tray menu to configure each one independently:

- AI provider
- Character size
- Visibility
- Sound on/off and custom notification sound
- Display (for multi-monitor setups)

### Right-click context menu

Right-clicking a character exposes:

- **New session** — start a fresh AI session
- **Continue last** — resume the most recent conversation
- **Pick session** — interactive picker to choose any session
- **Browse recent sessions** — view sessions from all projects with time-ago labels
- **Change animation** — swap in a custom GIF; saved and restored on restart
- **Reset to original animation** — revert to the default sprite sheet
- **Hide/Show other character** — toggle the companion character
- **Set custom notification sound** — choose a `.wav`/`.mp3` file to play on completion
- **Other AI tools** — launch Gemini CLI, Codex, Copilot, or OpenCode directly in the mini-terminal

## Architecture

```
src/
├── main/                  Electron main process
│   ├── main.ts            App entry point, IPC wiring, animation loop
│   ├── characters/        Character configuration, walker engine
│   ├── sessions/          AI provider session classes, Claude launcher
│   ├── settings.ts        electron-store based settings persistence
│   ├── monitor.ts         Display/monitor detection
│   ├── tray.ts            System tray icon and menu
│   ├── overlay-window.ts  Transparent fullscreen window for characters
│   └── popover-window.ts  Chat terminal popover
├── renderer/              Browser-side code
│   ├── overlay/           Canvas sprite renderer, click detection
│   └── popover/           Chat terminal UI
├── preload/               Electron context bridge scripts
└── shared/                TypeScript types, IPC channel constants
```

**Key design decisions:**

- **Canvas rendering** — Characters are drawn on an HTML5 canvas at 60fps in a transparent, click-through overlay window positioned above the taskbar.
- **electron-store** — All settings (provider, size, visibility, sound, custom GIF paths, custom animation paths) are persisted locally with no external dependencies.
- **xterm.js + node-pty** — AI sessions run inside a built-in terminal emulator (xterm.js) backed by a real PTY (node-pty). This gives full color output, interactive prompts, and a purple-themed UI without spawning an external terminal window. node-pty is a native module and requires Visual Studio Build Tools to compile.
- **Session discovery** — Recent Claude sessions are read directly from `~/.claude/projects/` on the fly; no CLI invocation is needed. Directory names are decoded (hyphen-separated path segments) to reconstruct the original file-system path.
- **Idle detection** — A 2-second silence timer after the last PTY output triggers the completion chime, green-dot title-bar flash, and optional system-tray notification.
- **IPC architecture** — Main process owns all state and logic; renderer processes communicate exclusively through typed IPC channels defined in `src/shared/ipc-channels.ts`.

## Privacy

lil agents runs entirely on your machine and sends no personal data anywhere.

- **Your data stays local.** The app renders bundled animations and reads your taskbar position. No project data, file paths, or personal information is collected or transmitted.
- **AI providers.** Conversations are handled by whichever CLI you choose, running as a local process. lil agents does not intercept, store, or transmit your chat content.
- **No accounts.** No login, no analytics, no telemetry.

## Credits

This is a Windows port of [lil agents](https://github.com/ryanstephen/lil-agents) by Ryan Stephen — the original macOS app that puts animated AI companions on your Dock. All character designs and walking animations originate from that project.

## License

MIT License. See [LICENSE](../LICENSE) for details.
