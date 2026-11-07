// debug.js — lightweight performance overlay toggled by `?debug` or the ` key.

let panel = null;
let visible = false;
let frameCount = 0;
let frameTime = 0;
let lastFps = 0;

function createPanel() {
  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    right: '12px',
    top: '12px',
    zIndex: '40',
    padding: '10px 14px',
    minWidth: '220px',
    background: 'rgba(0,0,0,0.75)',
    border: '1px solid #8b0000',
    borderRadius: '6px',
    color: '#d4d4d4',
    font: '13px/1.5 monospace',
    pointerEvents: 'none',
    whiteSpace: 'pre-line',
  });
  document.body.appendChild(panel);
}

function formatMem(bytes) {
  if (bytes === undefined || bytes === null) return '?';
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function initDebug() {
  const params = new URLSearchParams(location.search);
  visible = params.has('debug');
  createPanel();
  panel.style.display = visible ? 'block' : 'none';

  addEventListener('keydown', (event) => {
    if (event.key === '`' || event.key === '~') {
      visible = !visible;
      panel.style.display = visible ? 'block' : 'none';
    }
  });

  return {
    setVisible(v) {
      visible = v;
      if (panel) panel.style.display = visible ? 'block' : 'none';
    },
  };
}

export function isDebugVisible() {
  return visible;
}

export function updateDebug(dt, stats) {
  if (!visible || !panel) return;

  frameCount += 1;
  frameTime += dt;
  if (frameTime >= 0.5) {
    lastFps = Math.round(frameCount / frameTime);
    frameCount = 0;
    frameTime = 0;
  }

  const mem = performance.memory ? performance.memory.usedJSHeapSize : null;
  const lines = [
    `FPS: ${lastFps}  frame: ${(dt * 1000).toFixed(1)}ms`,
    `update: ${stats.updateMs.toFixed(1)}ms  render: ${stats.renderMs.toFixed(1)}ms`,
    `draw calls: ${stats.drawCalls}  tris: ${stats.triangles}`,
    `lights: ${stats.pointLights} point`,
    `entities: ${stats.enemies} enemies | ${stats.projectiles} shots | ${stats.enemyProjectiles} enemy shots`,
    `systems: ${stats.fields} fields | ${stats.items} items | ${stats.abilities} abilities`,
    `DOM health bars: ${stats.healthBars}`,
    `heap: ${formatMem(mem)}`,
  ];

  panel.textContent = lines.join('\n');
}
