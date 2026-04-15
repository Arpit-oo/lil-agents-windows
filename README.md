# lil agents

![lil agents](hero-thumbnail.png)

Tiny AI companions that live on your screen.

**Bruce** and **Jazz** walk back and forth above your dock (macOS) or taskbar (Windows). Click one to open an AI terminal. They walk, they think, they vibe.

> **I DON'T KNOW WHAT I'M DOING. THIS MIGHT WORK. THIS MIGHT NOT WORK. YOU HAVE FULL FREEDOM TO CHANGE IT ACCORDINGLY AND WORK UPON THAT. THIS IS JUST MY INTERPRETATION OF THE ORIGINAL WORK. FEEL FREE TO FORK, BREAK, REBUILD, AND MAKE IT YOUR OWN.**

---

## Choose Your Platform

### macOS (Original)

The original lil agents by [Ryan Stephen](https://github.com/ryanstephen/lil-agents).

- Native macOS AppKit application
- Animated characters rendered from transparent HEVC video
- Four visual themes: Peach, Midnight, Cloud, Moss
- Supports Claude Code, OpenAI Codex, GitHub Copilot, and Google Gemini CLIs
- Auto-updates via Sparkle
- **[Download for macOS](https://lilagents.xyz)** | [Original repo](https://github.com/ryanstephen/lil-agents)

**Requirements:** macOS Sonoma (14.0+), universal binary (Apple Silicon + Intel)

**Building:** Open `lil-agents.xcodeproj` in Xcode and hit run.

---

### Windows (This Version)

A Windows port built from the ground up with Electron + TypeScript. This is entirely my own work and interpretation of the original macOS app, built for my device and workflow. It is not affiliated with or endorsed by the original project.

Based on the original repo: [github.com/ryanstephen/lil-agents](https://github.com/ryanstephen/lil-agents)

- Electron app with canvas-based sprite animation at 60fps
- **Built-in mini-terminal (xterm.js)** with a purple theme — click a character to launch Claude Code sessions, browse and resume previous conversations, all without leaving the app
- Session management reads directly from `~/.claude/projects/` — instant, no CLI calls
- Custom GIF animations — swap character walk cycles with any GIF, persisted across restarts
- Notification chimes with system tray alerts when Claude finishes responding
- Custom notification sounds
- Character visibility toggles (show one or both)
- Auto light/dark theme following Windows settings
- Supports 6 AI providers: Claude, Codex, Copilot, Gemini, OpenCode, OpenClaw

**Requirements:** Windows 10/11, Node.js 18+, Visual Studio Build Tools (for node-pty)

**Quick start:**
```bash
cd lil-agents-windows
npm install
npm run dev
```

**Build portable .exe:**
```bash
npm run pack
```

**Full documentation:** See [lil-agents-windows/README.md](lil-agents-windows/README.md)

---

## How It Works

Both versions share the same concept:

1. Two animated characters walk at the bottom of your screen
2. Click a character to interact with an AI CLI tool
3. Characters show thinking bubbles while the AI works
4. A sound plays when the response is ready
5. Settings accessible via system tray (Windows) or menubar (macOS)

The macOS version uses native AppKit with transparent HEVC video. The Windows version uses Electron with canvas sprite sheets and an embedded xterm.js terminal for full Claude Code interactivity.

## Credits

- **Original macOS app** by [Ryan Stephen](https://github.com/ryanstephen/lil-agents) — the inspiration for everything here
- **Windows port** by [Arpit](https://github.com/Arpit-oo) — built as an interpretation and adaptation for Windows

## Privacy

lil agents runs entirely on your machine and sends no personal data anywhere. AI conversations are handled by the CLI process you choose (Claude, Codex, etc.) running locally. The app does not intercept, store, or transmit your chat content.

## License

MIT License. See [LICENSE](LICENSE) for details.
