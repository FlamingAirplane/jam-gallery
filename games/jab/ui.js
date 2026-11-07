// ui.js — the plain-DOM overlay: kills, floor, health bar, and the game over / restart panel.
import {
  enemyHealthBarWidth, enemyHealthBarHeight, enemyHealthBarYOffset,
  enemyHealthBarColor, enemyHealthBarBg,
  spawnIndicatorSize, spawnIndicatorColor, elementColors,
} from './tuning.js?v=1';

const GREY = { dark: '#1a1a1a', mid: '#3a3a3a', light: '#5c5c5c', pale: '#999999', white: '#d4d4d4', blood: '#8b0000' };

let els = null;            // built by createUI
let onRestart = null;      // set by main.js
let shown = { score: null, floor: null };   // skip redrawing unchanged readouts
const enemyBars = [];      // active enemy health-bar containers

export function createUI() {
  const root = document.getElementById('ui') || document.createElement('div');
  root.id = 'ui';
  Object.assign(root.style, {
    position: 'fixed', inset: '0', zIndex: '10', pointerEvents: 'none',
    font: '15px/1.5 system-ui, sans-serif', color: GREY.white, userSelect: 'none',
  });

  // Top-left readout.
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'absolute', left: '16px', top: '16px', padding: '10px 14px', minWidth: '170px',
    background: 'rgba(0,0,0,0.45)', border: `1px solid ${GREY.mid}`, borderRadius: '6px',
  });
  const score = document.createElement('div');
  const floor = document.createElement('div');
  panel.append(score, floor);

  // Bottom-left health panel.
  const hpPanel = document.createElement('div');
  Object.assign(hpPanel.style, {
    position: 'absolute', left: '16px', bottom: '16px', padding: '10px 14px', minWidth: '170px',
    background: 'rgba(0,0,0,0.55)', border: `1px solid ${GREY.mid}`, borderRadius: '6px',
  });
  const hpText = document.createElement('div');
  Object.assign(hpText.style, { fontSize: '13px', color: GREY.pale });
  const hpBarOuter = document.createElement('div');
  Object.assign(hpBarOuter.style, {
    marginTop: '4px', height: '12px', background: GREY.dark, border: `1px solid ${GREY.mid}`,
  });
  const hpBar = document.createElement('div');
  Object.assign(hpBar.style, { height: '100%', width: '100%', background: GREY.blood });
  hpBarOuter.appendChild(hpBar);
  hpPanel.append(hpText, hpBarOuter);
  root.appendChild(hpPanel);

  // Bottom ability list.
  const abilityPanel = document.createElement('div');
  Object.assign(abilityPanel.style, {
    position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
    padding: '10px 18px', textAlign: 'center',
    background: 'rgba(0,0,0,0.55)', border: `1px solid ${GREY.mid}`, borderRadius: '6px',
  });
  const abilityTitle = document.createElement('div');
  Object.assign(abilityTitle.style, { fontSize: '14px', fontWeight: 'bold', color: GREY.white });
  const abilityList = document.createElement('div');
  Object.assign(abilityList.style, { marginTop: '4px', fontSize: '12px', color: GREY.pale });
  abilityPanel.append(abilityTitle, abilityList);
  root.appendChild(abilityPanel);

  // Game over: a centred panel with one Restart button. The button is the only clickable thing.
  const over = document.createElement('div');
  Object.assign(over.style, {
    position: 'absolute', inset: '0', display: 'none', placeItems: 'center',
    background: 'rgba(0,0,0,0.6)',
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    padding: '24px 32px', textAlign: 'center', background: 'rgba(0,0,0,0.8)',
    border: `1px solid ${GREY.blood}`, borderRadius: '8px',
  });
  const title = document.createElement('div');
  title.textContent = 'The golem is destroyed';
  Object.assign(title.style, { fontSize: '20px', marginBottom: '10px' });
  const overStats = document.createElement('div');
  Object.assign(overStats.style, { color: GREY.pale, marginBottom: '16px' });
  const hint = document.createElement('div');
  hint.textContent = 'press R or click Restart';
  Object.assign(hint.style, { color: GREY.light, fontSize: '13px', marginTop: '10px' });
  const button = document.createElement('button');
  button.textContent = 'Restart';
  Object.assign(button.style, {
    pointerEvents: 'auto', cursor: 'pointer', font: 'inherit', padding: '8px 20px',
    color: GREY.white, background: GREY.dark, border: `1px solid ${GREY.light}`, borderRadius: '6px',
  });
  button.addEventListener('click', () => { if (onRestart) onRestart(); });
  button.addEventListener('mousedown', (event) => event.stopPropagation());  // don't read as a shot
  box.append(title, overStats, button, hint);
  over.appendChild(box);

  root.append(panel, over);
  if (!root.isConnected) document.body.appendChild(root);

  const wave = document.createElement('div');
  Object.assign(wave.style, { marginTop: '4px', fontSize: '13px', color: GREY.pale });
  panel.append(wave);

  const music = document.createElement('div');
  music.textContent = 'Music: ON (M to mute)';
  Object.assign(music.style, { marginTop: '4px', fontSize: '12px', color: GREY.light });
  panel.append(music);

  const level = document.createElement('div');
  Object.assign(level.style, { marginTop: '4px', fontSize: '13px', color: GREY.pale });
  panel.append(level);

  const xpLabel = document.createElement('div');
  Object.assign(xpLabel.style, { marginTop: '2px', fontSize: '12px', color: GREY.light });
  xpLabel.textContent = 'XP';
  panel.append(xpLabel);
  const xpOuter = document.createElement('div');
  Object.assign(xpOuter.style, {
    marginTop: '2px', height: '6px', background: GREY.dark, border: `1px solid ${GREY.mid}`,
  });
  const xpBar = document.createElement('div');
  Object.assign(xpBar.style, { height: '100%', width: '0%', background: '#d4a65a' });
  xpOuter.appendChild(xpBar);
  panel.append(xpOuter);

  const abilityLabel = document.createElement('div');
  Object.assign(abilityLabel.style, { marginTop: '6px', fontSize: '12px', color: GREY.light });
  abilityLabel.textContent = 'Alt-fire (E / RMB)';
  panel.append(abilityLabel);
  const abilityOuter = document.createElement('div');
  Object.assign(abilityOuter.style, {
    marginTop: '2px', height: '6px', background: GREY.dark, border: `1px solid ${GREY.mid}`,
  });
  const abilityBar = document.createElement('div');
  Object.assign(abilityBar.style, { height: '100%', width: '100%', background: '#3498db' });
  abilityOuter.appendChild(abilityBar);
  panel.append(abilityOuter);

  const buffs = document.createElement('div');
  Object.assign(buffs.style, { marginTop: '6px', fontSize: '12px', color: GREY.pale, minHeight: '18px' });
  panel.append(buffs);

  // Centre banner for floor start / complete announcements.
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'absolute', inset: '0', display: 'none', placeItems: 'center',
    opacity: '0', transition: 'opacity 0.4s ease',
  });
  const bannerBox = document.createElement('div');
  Object.assign(bannerBox.style, {
    padding: '18px 40px', textAlign: 'center', background: 'rgba(0,0,0,0.8)',
    border: `2px solid ${GREY.blood}`, borderRadius: '10px',
  });
  const bannerTitle = document.createElement('div');
  Object.assign(bannerTitle.style, { fontSize: '32px', fontWeight: 'bold', letterSpacing: '1px' });
  const bannerSub = document.createElement('div');
  Object.assign(bannerSub.style, { marginTop: '6px', fontSize: '15px', color: GREY.pale });
  bannerBox.append(bannerTitle, bannerSub);
  banner.appendChild(bannerBox);
  root.append(banner);

  // Level-up choice panel (hidden until needed).
  const levelup = document.createElement('div');
  Object.assign(levelup.style, {
    position: 'absolute', inset: '0', display: 'none', placeItems: 'center',
    background: 'rgba(0,0,0,0.75)',
  });
  const levelupBox = document.createElement('div');
  Object.assign(levelupBox.style, {
    padding: '28px 36px', textAlign: 'center', background: 'rgba(0,0,0,0.85)',
    border: `2px solid ${GREY.light}`, borderRadius: '10px', maxWidth: '420px',
  });
  const levelupTitle = document.createElement('div');
  levelupTitle.textContent = 'Level Up!';
  Object.assign(levelupTitle.style, { fontSize: '24px', marginBottom: '16px' });
  const levelupHint = document.createElement('div');
  levelupHint.textContent = 'Choose one upgrade';
  Object.assign(levelupHint.style, { color: GREY.pale, fontSize: '13px', marginBottom: '16px' });
  const levelupButtons = document.createElement('div');
  Object.assign(levelupButtons.style, { display: 'flex', flexDirection: 'column', gap: '10px' });
  levelupBox.append(levelupTitle, levelupHint, levelupButtons);
  levelup.appendChild(levelupBox);
  root.append(levelup);

  els = { score, floor, wave, hpText, hpBar, over, overStats, music, level, xpBar, abilityBar, buffs, abilityTitle, abilityList, banner, bannerTitle, bannerSub, levelup, levelupButtons };
  setScore(0);
  setFloor(1);
  setWave(1, 1);
  setHealth(1, 1);
  setLevel(1);
  setXP(0, 100);
  return {
    setRestartHandler(fn) { onRestart = fn; },
    setMusicMuted(muted) {
      if (!els) return;
      els.music.textContent = muted ? 'Music: MUTED (M to unmute)' : 'Music: ON (M to mute)';
    },
  };
}

export function showBanner(title, sub = '', duration = 2000) {
  if (!els) return;
  els.bannerTitle.textContent = title;
  els.bannerSub.textContent = sub;
  els.banner.style.display = 'grid';
  // Force reflow so the transition plays.
  void els.banner.offsetWidth;
  els.banner.style.opacity = '1';
  if (els.bannerTimer) clearTimeout(els.bannerTimer);
  els.bannerTimer = setTimeout(() => {
    els.banner.style.opacity = '0';
    setTimeout(() => { els.banner.style.display = 'none'; }, 400);
  }, duration);
}

export function setScore(n) {
  if (!els || shown.score === n) return;
  shown.score = n;
  els.score.textContent = `Kills: ${n}`;
}

export function setFloor(n) {
  if (!els || shown.floor === n) return;
  shown.floor = n;
  els.floor.textContent = `Floor: ${n}`;
}

export function setWave(current, total) {
  if (!els) return;
  els.wave.textContent = `Wave: ${current} / ${total}`;
}

export function setHealth(hp, maxHp) {
  if (!els) return;
  const shown = Math.max(0, Math.ceil(hp));
  els.hpText.textContent = `HP: ${shown} / ${maxHp}`;
  els.hpBar.style.width = `${Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0)) * 100}%`;
  els.hpBar.style.background = GREY.blood;
}

export function setLevel(n) {
  if (!els) return;
  els.level.textContent = `Level: ${n}`;
}

export function setXP(xp, xpToNext) {
  if (!els) return;
  const ratio = Math.max(0, Math.min(1, xpToNext > 0 ? xp / xpToNext : 0));
  els.xpBar.style.width = `${ratio * 100}%`;
}

export function setAbilityCooldown(remaining, total) {
  if (!els) return;
  const ratio = total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 1;
  els.abilityBar.style.width = `${ratio * 100}%`;
}

export function setBuffs(active) {
  if (!els) return;
  if (active.length === 0) {
    els.buffs.textContent = '';
    return;
  }
  els.buffs.textContent = 'Buffs: ' + active.map((b) => `${b.label} ${Math.ceil(b.timer)}s`).join(', ');
}

const ABILITY_COPY = {
  fire: {
    title: 'FIRE',
    lines: [
      'LMB — Flame blast: single shot, applies burn',
      'E / RMB — Flame grenade: explodes for AoE burn',
    ],
  },
  water: {
    title: 'WATER',
    lines: [
      'LMB — Piercing beam: passes through enemies',
      'E / RMB — Tidal wave: wide knockback pulse',
    ],
  },
  earth: {
    title: 'EARTH',
    lines: [
      'LMB — Heavy blast: chance to slow',
      'E / RMB — Earthquake: expanding slow + knockback',
    ],
  },
  wind: {
    title: 'WIND',
    lines: [
      'LMB — Piercing dart: fast, cuts through enemies',
      'E / RMB — Gust: narrow knockback stream',
    ],
  },
};

export function setAbilityList(element) {
  if (!els) return;
  const copy = ABILITY_COPY[element] ?? ABILITY_COPY.fire;
  els.abilityTitle.textContent = copy.title;
  els.abilityTitle.style.color = elementColors[element] ?? GREY.white;
  els.abilityList.innerHTML = copy.lines.map((l) => `<div>${l}</div>`).join('');
}

export function showLevelUp(choices, onChoose) {
  if (!els) return;
  els.levelupButtons.innerHTML = '';
  for (const choice of choices) {
    const btn = document.createElement('button');
    btn.textContent = choice.label;
    Object.assign(btn.style, {
      pointerEvents: 'auto', cursor: 'pointer', font: 'inherit', padding: '10px 18px',
      color: GREY.white, background: GREY.dark, border: `1px solid ${GREY.light}`, borderRadius: '6px',
    });
    btn.addEventListener('click', () => onChoose(choice));
    btn.addEventListener('mousedown', (event) => event.stopPropagation());
    els.levelupButtons.appendChild(btn);
  }
  els.levelup.style.display = 'grid';
}

export function hideLevelUp() {
  if (!els) return;
  els.levelup.style.display = 'none';
}

export function showGameOver(score, floor) {
  if (!els) return;
  els.overStats.textContent = `Kills: ${score}    Floor: ${floor}`;
  els.over.style.display = 'grid';
}

export function hideGameOver() { if (els) els.over.style.display = 'none'; }

// --- Enemy health bars -------------------------------------------------------
export function createEnemyHealthBar() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'absolute', pointerEvents: 'none',
    width: `${enemyHealthBarWidth}px`, height: `${enemyHealthBarHeight}px`,
  });

  const bg = document.createElement('div');
  Object.assign(bg.style, {
    width: '100%', height: '100%', background: enemyHealthBarBg,
    border: `1px solid ${GREY.dark}`, borderRadius: '1px', overflow: 'hidden',
  });

  const fg = document.createElement('div');
  Object.assign(fg.style, {
    width: '100%', height: '100%', background: enemyHealthBarColor,
  });

  bg.appendChild(fg);
  container.appendChild(bg);
  document.body.appendChild(container);
  enemyBars.push(container);

  return {
    element: container,
    setHp(hp, maxHp) {
      const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
      fg.style.width = `${ratio * 100}%`;
    },
    remove() {
      const i = enemyBars.indexOf(container);
      if (i >= 0) enemyBars.splice(i, 1);
      if (container.parentNode) container.parentNode.removeChild(container);
    },
  };
}

export function positionEnemyHealthBar(barElement, worldPosition, camera, renderer) {
  const ndc = worldPosition.clone().project(camera);
  const canvas = renderer.domElement;

  if (ndc.z > 1 || ndc.z < -1) {
    barElement.style.display = 'none';
    return;
  }

  const screenX = (ndc.x * 0.5 + 0.5) * canvas.clientWidth;
  const screenY = (1 - (ndc.y * 0.5 + 0.5)) * canvas.clientHeight;

  barElement.style.display = 'block';
  barElement.style.left = `${screenX - enemyHealthBarWidth / 2}px`;
  barElement.style.top = `${screenY - enemyHealthBarHeight - enemyHealthBarYOffset}px`;
}

export function clearEnemyHealthBars() {
  for (const bar of enemyBars) {
    if (bar.parentNode) bar.parentNode.removeChild(bar);
  }
  enemyBars.length = 0;
}

export function getHealthBarCount() {
  return enemyBars.length;
}

// --- Spawn indicators --------------------------------------------------------
export function createSpawnIndicator() {
  const element = document.createElement('div');
  const half = spawnIndicatorSize / 2;
  Object.assign(element.style, {
    position: 'absolute',
    pointerEvents: 'none',
    width: '0',
    height: '0',
    borderTop: `${half}px solid transparent`,
    borderBottom: `${half}px solid transparent`,
    borderLeft: `${spawnIndicatorSize}px solid ${spawnIndicatorColor}`,
  });
  document.body.appendChild(element);

  return {
    element,
    remove() {
      if (element.parentNode) element.parentNode.removeChild(element);
    },
  };
}

export function positionSpawnIndicator(element, worldPos, camera, renderer) {
  const ndc = worldPos.clone().project(camera);
  const canvas = renderer.domElement;

  // If the point is behind the camera, mirror it so the indicator lands on the opposite edge.
  const behind = ndc.z > 1;
  const rawX = behind ? -ndc.x : ndc.x;
  const rawY = behind ? -ndc.y : ndc.y;

  // On-screen spawns don't need an arrow.
  if (!behind && Math.abs(rawX) < 1 && Math.abs(rawY) < 1) {
    element.style.display = 'none';
    return;
  }

  const clampedX = Math.max(-0.95, Math.min(0.95, rawX));
  const clampedY = Math.max(-0.95, Math.min(0.95, rawY));

  const screenX = (clampedX * 0.5 + 0.5) * canvas.clientWidth;
  const screenY = (1 - (clampedY * 0.5 + 0.5)) * canvas.clientHeight;

  const rawScreenX = (rawX * 0.5 + 0.5) * canvas.clientWidth;
  const rawScreenY = (1 - (rawY * 0.5 + 0.5)) * canvas.clientHeight;
  const angle = Math.atan2(rawScreenY - screenY, rawScreenX - screenX) * (180 / Math.PI);

  element.style.display = 'block';
  element.style.left = `${screenX}px`;
  element.style.top = `${screenY}px`;
  element.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}
