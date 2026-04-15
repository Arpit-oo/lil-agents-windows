const canvas = document.getElementById('overlay-canvas');
const ctx = canvas.getContext('2d');

let characterStates = [];
let sprites = new Map();
let isDarkTheme = false;

const THINKING_PHRASES = [
  'hmm...', 'thinking...', 'one sec...', 'ok hold on', 'let me check',
  'working on it', 'on it...', 'processing...', 'give me a moment',
  'let me see...', 'checking...', 'analyzing...', 'figuring it out',
  'looking into it', 'almost...', 'bear with me', 'just a sec',
  'running that...', 'computing...', 'crunching...', 'diving in',
  'exploring...', 'searching...', 'reading...', 'cooking...',
];

const COMPLETION_PHRASES = [
  'done!', 'all set!', 'ready!', 'here you go', 'got it!',
  'finished!', 'ta-da!', 'voila!', 'boom!', 'there ya go!',
  'check it out!', 'nailed it!',
];

function resizeCanvas() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function drawCharacter(state) {
  const sprite = sprites.get(state.name);
  const bottomY = canvas.height / window.devicePixelRatio - 10;

  if (!sprite || !sprite.loaded || sprite.images.length === 0) {
    // Placeholder colored rectangle
    ctx.fillStyle = state.name === 'bruce' ? '#66B88C' : '#FF6600';
    ctx.fillRect(state.x - state.width / 2, bottomY - state.height, state.width, state.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.name.charAt(0).toUpperCase() + state.name.slice(1), state.x, bottomY - state.height / 2);
    return;
  }

  const frameIndex = Math.min(state.frame, sprite.images.length - 1);
  const img = sprite.images[frameIndex];
  const yPos = bottomY - state.height;

  ctx.save();
  if (state.flipped) {
    ctx.translate(state.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -state.width / 2, yPos, state.width, state.height);
  } else {
    ctx.drawImage(img, state.x - state.width / 2, yPos, state.width, state.height);
  }
  ctx.restore();
}

function drawBubble(state) {
  if (!state.bubbleText) return;

  const bottomY = canvas.height / window.devicePixelRatio - 10;
  const bubbleX = state.x;
  const bubbleY = bottomY - state.height - 35;
  const text = state.bubbleText;

  ctx.font = '13px "Segoe UI", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padding = 10;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 28;

  const isCompletion = COMPLETION_PHRASES.includes(text);

  // Background
  ctx.fillStyle = isDarkTheme ? '#1a1a1a' : '#ffffff';
  ctx.strokeStyle = isCompletion ? '#4CAF50' : (isDarkTheme ? '#444' : '#ddd');
  ctx.lineWidth = 1.5;

  // Rounded rect
  const rx = bubbleX - bubbleWidth / 2;
  const ry = bubbleY - bubbleHeight / 2;
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.lineTo(rx + bubbleWidth - r, ry);
  ctx.arcTo(rx + bubbleWidth, ry, rx + bubbleWidth, ry + r, r);
  ctx.lineTo(rx + bubbleWidth, ry + bubbleHeight - r);
  ctx.arcTo(rx + bubbleWidth, ry + bubbleHeight, rx + bubbleWidth - r, ry + bubbleHeight, r);
  ctx.lineTo(rx + r, ry + bubbleHeight);
  ctx.arcTo(rx, ry + bubbleHeight, rx, ry + bubbleHeight - r, r);
  ctx.lineTo(rx, ry + r);
  ctx.arcTo(rx, ry, rx + r, ry, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Triangle
  ctx.fillStyle = isDarkTheme ? '#1a1a1a' : '#ffffff';
  ctx.beginPath();
  ctx.moveTo(bubbleX - 6, ry + bubbleHeight);
  ctx.lineTo(bubbleX, ry + bubbleHeight + 8);
  ctx.lineTo(bubbleX + 6, ry + bubbleHeight);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.fillStyle = isCompletion ? '#4CAF50' : (isDarkTheme ? '#e0e0e0' : '#333');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bubbleX, bubbleY);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const state of characterStates) {
    if (!state.visible) continue;
    drawCharacter(state);
    drawBubble(state);
  }
  requestAnimationFrame(render);
}

// Click detection: center 60% of character bounds
canvas.addEventListener('mousedown', (e) => {
  for (const state of characterStates) {
    if (!state.visible) continue;
    const bottomY = canvas.height / window.devicePixelRatio - 10;
    const charLeft = state.x - state.width / 2;
    const charTop = bottomY - state.height;
    const zoneWidth = state.width * 0.6;
    const zoneHeight = state.height * 0.6;
    const zoneLeft = charLeft + (state.width - zoneWidth) / 2;
    const zoneTop = charTop + (state.height - zoneHeight) / 2;

    if (e.clientX >= zoneLeft && e.clientX <= zoneLeft + zoneWidth &&
        e.clientY >= zoneTop && e.clientY <= zoneTop + zoneHeight) {
      window.lilAgents.characterClicked(state.name);
      return;
    }
  }
});

// Mouse move: toggle click-through
canvas.addEventListener('mousemove', (e) => {
  let overCharacter = false;
  for (const state of characterStates) {
    if (!state.visible) continue;
    const bottomY = canvas.height / window.devicePixelRatio - 10;
    const charLeft = state.x - state.width / 2;
    const charTop = bottomY - state.height;
    const zoneWidth = state.width * 0.6;
    const zoneHeight = state.height * 0.6;
    const zoneLeft = charLeft + (state.width - zoneWidth) / 2;
    const zoneTop = charTop + (state.height - zoneHeight) / 2;

    if (e.clientX >= zoneLeft && e.clientX <= zoneLeft + zoneWidth &&
        e.clientY >= zoneTop && e.clientY <= zoneTop + zoneHeight) {
      overCharacter = true;
      break;
    }
  }
  window.lilAgents.setClickThrough(!overCharacter, true);
  canvas.style.cursor = overCharacter ? 'pointer' : 'default';
});

// Load sprites
function loadSprites(name, frameCount) {
  const sheet = { images: [], loaded: false };
  let loadedCount = 0;
  for (let i = 1; i <= frameCount; i++) {
    const img = new Image();
    const paddedIndex = i.toString().padStart(3, '0');
    img.src = `../../../assets/sprites/${name}/${name}-${paddedIndex}.png`;
    img.onload = () => { loadedCount++; if (loadedCount === frameCount) sheet.loaded = true; };
    img.onerror = () => { loadedCount++; if (loadedCount === frameCount) sheet.loaded = true; };
    sheet.images.push(img);
  }
  sprites.set(name, sheet);
}

// Init
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
loadSprites('bruce', 300);
loadSprites('jazz', 300);

window.lilAgents.onUpdateCharacters((states) => { characterStates = states; });
window.lilAgents.onThemeChanged((dark) => { isDarkTheme = dark; });

requestAnimationFrame(render);
window.lilAgents.reportReady();
