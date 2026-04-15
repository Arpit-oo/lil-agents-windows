const canvas = document.getElementById('overlay-canvas');
const ctx = canvas.getContext('2d');

let characterStates = [];
let sprites = new Map();
let isDarkTheme = false;

// Per-character animation state (renderer-side, decoupled from main process)
let localAnimState = new Map();

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
  // Check for custom GIF animation first
  if (customAnimations.has(state.name) && drawCustomAnimation(state)) {
    return; // Custom animation handled it
  }

  const sprite = sprites.get(state.name);
  const canvasH = canvas.height / window.devicePixelRatio;
  const bottomY = canvasH - 10;

  // Get or create local animation state
  let anim = localAnimState.get(state.name);
  if (!anim) {
    anim = { frameAccum: 0, currentFrame: 0, lastTime: performance.now() };
    localAnimState.set(state.name, anim);
  }

  // Advance sprite frame smoothly at 30fps while walking
  const now = performance.now();
  const elapsed = now - anim.lastTime;
  anim.lastTime = now;

  if (state.isWalking) {
    anim.frameAccum += elapsed;
    const msPerFrame = 1000 / 30; // 30fps sprite playback
    while (anim.frameAccum >= msPerFrame) {
      anim.frameAccum -= msPerFrame;
      anim.currentFrame++;
    }
  } else {
    // Reset to standing frame when not walking
    anim.currentFrame = 0;
    anim.frameAccum = 0;
  }

  if (!sprite || !sprite.loaded || sprite.images.length === 0) {
    // Placeholder colored rectangle
    ctx.fillStyle = state.name === 'bruce' ? '#66B88C' : '#FF6600';
    const rectW = state.width || 113;
    const rectH = state.height || 200;
    ctx.fillRect(state.x - rectW / 2, bottomY - rectH, rectW, rectH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.name.charAt(0).toUpperCase() + state.name.slice(1), state.x, bottomY - rectH / 2);
    return;
  }

  const frameIndex = anim.currentFrame % sprite.images.length;
  const img = sprite.images[frameIndex];
  if (!img || !img.complete || img.naturalWidth === 0) return; // Skip unloaded frames

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

  const canvasH = canvas.height / window.devicePixelRatio;
  const bottomY = canvasH - 10;
  const bubbleX = state.x;
  const bubbleY = bottomY - state.height - 35;
  const text = state.bubbleText;

  ctx.font = '13px "Segoe UI", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const padding = 10;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 28;

  const isCompletion = COMPLETION_PHRASES.includes(text);

  ctx.fillStyle = isDarkTheme ? '#1a1a1a' : '#ffffff';
  ctx.strokeStyle = isCompletion ? '#4CAF50' : (isDarkTheme ? '#444' : '#ddd');
  ctx.lineWidth = 1.5;

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

  ctx.fillStyle = isDarkTheme ? '#1a1a1a' : '#ffffff';
  ctx.beginPath();
  ctx.moveTo(bubbleX - 6, ry + bubbleHeight);
  ctx.lineTo(bubbleX, ry + bubbleHeight + 8);
  ctx.lineTo(bubbleX + 6, ry + bubbleHeight);
  ctx.closePath();
  ctx.fill();

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
  if (e.button !== 0) return; // Left click only
  for (const state of characterStates) {
    if (!state.visible) continue;
    const canvasH = canvas.height / window.devicePixelRatio;
    const bottomY = canvasH - 10;
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

// Right-click: context menu
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  for (const state of characterStates) {
    if (!state.visible) continue;
    const canvasH = canvas.height / window.devicePixelRatio;
    const bottomY = canvasH - 10;
    const charLeft = state.x - state.width / 2;
    const charTop = bottomY - state.height;
    const zoneWidth = state.width * 0.7;
    const zoneHeight = state.height * 0.7;
    const zoneLeft = charLeft + (state.width - zoneWidth) / 2;
    const zoneTop = charTop + (state.height - zoneHeight) / 2;

    if (e.clientX >= zoneLeft && e.clientX <= zoneLeft + zoneWidth &&
        e.clientY >= zoneTop && e.clientY <= zoneTop + zoneHeight) {
      window.lilAgents.characterRightClicked(state.name, e.screenX, e.screenY);
      return;
    }
  }
});

// Mouse move: toggle click-through
canvas.addEventListener('mousemove', (e) => {
  let overCharacter = false;
  for (const state of characterStates) {
    if (!state.visible) continue;
    const canvasH = canvas.height / window.devicePixelRatio;
    const bottomY = canvasH - 10;
    const charLeft = state.x - state.width / 2;
    const charTop = bottomY - state.height;
    const zoneWidth = state.width * 0.7;
    const zoneHeight = state.height * 0.7;
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

// Lazy sprite loading — load in batches to avoid blocking
function loadSprites(name, frameCount) {
  const sheet = { images: new Array(frameCount), loaded: false, loadedCount: 0 };
  const BATCH_SIZE = 20;

  function loadBatch(startIdx) {
    const endIdx = Math.min(startIdx + BATCH_SIZE, frameCount);
    for (let i = startIdx; i < endIdx; i++) {
      const img = new Image();
      const paddedIndex = (i + 1).toString().padStart(3, '0');
      img.src = `../../../assets/sprites/${name}/${name}-${paddedIndex}.png`;
      img.onload = () => {
        sheet.loadedCount++;
        if (sheet.loadedCount === frameCount) {
          sheet.loaded = true;
          console.log('[overlay.js] All', frameCount, 'frames loaded for', name);
        }
      };
      img.onerror = () => {
        sheet.loadedCount++;
        if (sheet.loadedCount === frameCount) sheet.loaded = true;
      };
      sheet.images[i] = img;
    }
    if (endIdx < frameCount) {
      setTimeout(() => loadBatch(endIdx), 50); // Load next batch after 50ms
    }
  }

  sprites.set(name, sheet);
  loadBatch(0);
}

// Init
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

loadSprites('bruce', 301);
loadSprites('jazz', 301);

// Custom GIF animations — stored per character
let customAnimations = new Map(); // name -> { img: HTMLImageElement, loaded: boolean }

function drawCustomAnimation(state) {
  const custom = customAnimations.get(state.name);
  if (!custom || !custom.loaded) return false;

  const canvasH = canvas.height / window.devicePixelRatio;
  const bottomY = canvasH - 10;
  const yPos = bottomY - state.height;

  ctx.save();
  if (state.flipped) {
    ctx.translate(state.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(custom.img, -state.width / 2, yPos, state.width, state.height);
  } else {
    ctx.drawImage(custom.img, state.x - state.width / 2, yPos, state.width, state.height);
  }
  ctx.restore();
  return true;
}

if (window.lilAgents) {
  window.lilAgents.onUpdateCharacters((states) => {
    characterStates = states;
  });
  window.lilAgents.onThemeChanged((dark) => { isDarkTheme = dark; });

  // Listen for custom animation changes
  window.lilAgents.onAnimationChanged((name, filePath) => {
    console.log('[overlay.js] Loading custom animation for', name, ':', filePath);
    const img = new Image();
    img.onload = () => {
      customAnimations.set(name, { img, loaded: true });
      console.log('[overlay.js] Custom animation loaded for', name);
    };
    img.onerror = () => {
      console.error('[overlay.js] Failed to load custom animation:', filePath);
    };
    // Use file:// protocol for local files
    img.src = 'file:///' + filePath.replace(/\\/g, '/');
  });

  requestAnimationFrame(render);
  window.lilAgents.reportReady();
} else {
  console.error('[overlay.js] window.lilAgents is undefined! Preload failed.');
  requestAnimationFrame(render);
}
