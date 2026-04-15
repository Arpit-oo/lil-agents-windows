// Load xterm.js and fit addon from node_modules
// We use dynamic script/link loading since this is a plain HTML file

function loadCSS(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function init() {
  // Load xterm CSS
  loadCSS('../../../node_modules/@xterm/xterm/css/xterm.css');

  // Load xterm JS
  await loadScript('../../../node_modules/@xterm/xterm/lib/xterm.js');
  await loadScript('../../../node_modules/@xterm/addon-fit/lib/addon-fit.js');

  const Terminal = window.Terminal;
  const FitAddon = window.FitAddon.FitAddon;

  const container = document.getElementById('terminal-container');
  const btnClose = document.getElementById('btn-close');
  const btnMinimize = document.getElementById('btn-minimize');
  const titleText = document.getElementById('title-text');
  const titleDot = document.getElementById('title-dot');

  // Dark theme colors
  const darkTheme = {
    background: '#1a1a2e',
    foreground: '#e0e0e0',
    cursor: '#7c5cbf',
    cursorAccent: '#1a1a2e',
    selectionBackground: 'rgba(124, 92, 191, 0.3)',
    black: '#1a1a2e',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#6272a4',
    magenta: '#bd93f9',
    cyan: '#8be9fd',
    white: '#e0e0e0',
    brightBlack: '#4a4a6a',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  };

  const lightTheme = {
    background: '#fefefe',
    foreground: '#2a2a3a',
    cursor: '#6b4fa0',
    cursorAccent: '#fefefe',
    selectionBackground: 'rgba(107, 79, 160, 0.2)',
    black: '#2a2a3a',
    red: '#d32f2f',
    green: '#2e7d32',
    yellow: '#f57f17',
    blue: '#1565c0',
    magenta: '#7b1fa2',
    cyan: '#00838f',
    white: '#fefefe',
    brightBlack: '#6c6c8a',
    brightRed: '#e53935',
    brightGreen: '#43a047',
    brightYellow: '#f9a825',
    brightBlue: '#1e88e5',
    brightMagenta: '#8e24aa',
    brightCyan: '#00acc1',
    brightWhite: '#ffffff',
  };

  let isDark = true;

  const fitAddon = new FitAddon();
  const term = new Terminal({
    fontFamily: "'Cascadia Code', 'Consolas', 'SF Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 1.3,
    cursorBlink: true,
    cursorStyle: 'bar',
    theme: darkTheme,
    allowTransparency: false,
    scrollback: 5000,
  });

  term.loadAddon(fitAddon);
  term.open(container);

  // Small delay to let DOM settle before fitting
  setTimeout(() => {
    fitAddon.fit();
    window.terminalBridge.sendResize(term.cols, term.rows);
  }, 100);

  // Terminal input → PTY
  term.onData((data) => {
    window.terminalBridge.sendInput(data);
  });

  // PTY output → terminal
  window.terminalBridge.onData((data) => {
    term.write(data);
  });

  // Init config
  window.terminalBridge.onInit((config) => {
    isDark = config.isDark;
    document.body.classList.toggle('light', !isDark);
    term.options.theme = isDark ? darkTheme : lightTheme;
    if (config.title) titleText.textContent = config.title;
  });

  // Theme changes
  window.terminalBridge.onThemeChanged((dark) => {
    isDark = dark;
    document.body.classList.toggle('light', !dark);
    term.options.theme = dark ? darkTheme : lightTheme;
  });

  // Completion chime — plays a random ping sound when Claude finishes responding
  const SOUND_FILES = [
    'ping-aa.mp3', 'ping-bb.mp3', 'ping-cc.mp3', 'ping-dd.mp3',
    'ping-ee.mp3', 'ping-ff.mp3', 'ping-gg.mp3', 'ping-hh.mp3',
    'ping-jj.m4a',
  ];
  let lastSoundIdx = -1;

  window.terminalBridge.onChime((customSoundPath) => {
    let audioSrc;
    if (customSoundPath) {
      audioSrc = 'file:///' + customSoundPath.replace(/\\/g, '/');
    } else {
      let idx;
      do { idx = Math.floor(Math.random() * SOUND_FILES.length); }
      while (idx === lastSoundIdx && SOUND_FILES.length > 1);
      lastSoundIdx = idx;
      audioSrc = '../../../assets/sounds/' + SOUND_FILES[idx];
    }
    const audio = new Audio(audioSrc);
    audio.volume = 0.85;
    audio.play().catch(() => {});

    // Brief glow on the title dot
    titleDot.style.background = '#50fa7b';
    titleDot.style.boxShadow = '0 0 8px rgba(80, 250, 123, 0.5)';
    setTimeout(() => {
      titleDot.style.background = 'var(--dot-color)';
      titleDot.style.boxShadow = '0 0 6px var(--accent-glow)';
    }, 1500);
  });

  // Exit
  window.terminalBridge.onExit((code) => {
    term.write(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
    titleDot.style.background = '#666';
    titleDot.style.boxShadow = 'none';
  });

  // Window resize → fit terminal
  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
    window.terminalBridge.sendResize(term.cols, term.rows);
  });
  resizeObserver.observe(container);

  // Title bar buttons
  btnClose.addEventListener('click', () => window.terminalBridge.close());
  btnMinimize.addEventListener('click', () => {
    window.terminalBridge.minimize();
  });

  // Focus terminal on click
  container.addEventListener('click', () => term.focus());
  term.focus();
}

init().catch(err => {
  console.error('[terminal.js] Failed to initialize:', err);
  document.getElementById('terminal-container').textContent = 'Failed to load terminal: ' + err.message;
});
