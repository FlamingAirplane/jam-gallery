// main.js — scene, camera, render loop, collision, game state and wiring for the moon-dungeon golem.
import * as THREE from 'three';
import {
  arenaSize, playerHP, playerRadius, projectileRadius, projectileDamage,
  enemyHP, enemyRadius,
  contactDamage, contactCooldown, contactPushDistance, contactPushEnemy,
  spawnInterval, waveSize, waveGrowth, wavesPerFloor,
  cameraHeight, cameraDistance, cameraFollowSpeed, cameraAngle, elementFieldCount,
  screenShakeAmount, screenShakeDecay, elementColors,
  spawnMargin, minSpawnDistance, spawnIndicatorDuration,
  columnRadius,
  enemyElementDropChance,
  archerProjectileRadius, archerProjectileDamage,
  burnDuration, earthSlowChance, earthSlowDuration,
  xpBase, xpGrowth, xpValues, levelUpChoices, upgradeOptions,
  itemDropChance, itemDuration, abilityCooldown,
} from './tuning.js';
import { createPlayer, updatePlayer, updateProjectiles, getProjectiles, setElement, getElement, applyWaterSpeedBoost } from './player.js?v=11';
import { spawnHitBurst, updateFX, clearFX } from './fx.js?v=2';
import {
  spawnEnemyAt, updateEnemies, getEnemies, clearEnemies,
  updateEnemyProjectiles, getEnemyProjectiles, clearEnemyProjectiles,
} from './enemies.js?v=6';
import { spawnElementFields, spawnElementFieldAt, updateElementFields, getElementFields, clearElementFields } from './elements.js?v=2';
import { spawnItemAt, updateItems, clearItems, itemTypeFor } from './items.js?v=1';
import { ACHIEVEMENTS, createStats, recordKill, recordFloor, checkAchievements } from './achievements.js?v=1';
import { playHit, playDeath, playAbsorb, playLevelUp, playAchievement, playItemPickup, resumeAudio, startMusic, toggleMusic, isMusicMuted } from './audio.js?v=4';
import { buildMap } from './level.js?v=7';
import {
  triggerAbility, updateAbilities, clearAbilities, getCooldowns,
} from './abilities.js?v=3';
import {
  createUI, setScore, setFloor, setWave, setHealth, setLevel, setXP,
  setAbilityCooldown, setBuffs,
  showGameOver, hideGameOver,
  showLevelUp, hideLevelUp,
  createEnemyHealthBar, positionEnemyHealthBar, clearEnemyHealthBars,
  createSpawnIndicator, positionSpawnIndicator, showBanner,
} from './ui.js?v=6';

// --- Overlay -----------------------------------------------------------------
const ui = createUI();

// --- Scene, camera, renderer -------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0a0a');
scene.fog = new THREE.FogExp2('#0a0a0a', 0.016);

// Isometric-ish top-down: 45 degrees around the golem, zoomed in, aimed at the golem.
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
camera.position.set(
  cameraDistance * Math.sin(cameraAngle),
  cameraHeight,
  cameraDistance * Math.cos(cameraAngle)
);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#555555', '#111111', 1.0));
const sun = new THREE.DirectionalLight('#6a7a8a', 1.2);
sun.position.set(8, 16, 6);
scene.add(sun);

// --- Floor texture -----------------------------------------------------------
// Use the Flow Studio floor image from assets. A plain grey material is shown
// for the first frame while the texture loads.
const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(arenaSize * 2, arenaSize * 2),
  new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.95 })
);
floorMesh.rotation.x = -Math.PI / 2;
scene.add(floorMesh);

new THREE.TextureLoader().load('assets/L_Floor.png?v=1', (texture) => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  floorMesh.material.map = texture;
  floorMesh.material.color.set('#3a3a3a');
  floorMesh.material.needsUpdate = true;
});


// --- Level layout (inspired by Map_Base.png) ---------------------------------
let walls = [];
let columnMeshes = [];

function clearLevel() {
  for (const mesh of columnMeshes) {
    if (mesh.parent) mesh.parent.remove(mesh);
  }
  columnMeshes.length = 0;
}

function createLevel(scene, floorNumber = 1) {
  clearLevel();
  const level = buildMap(scene, floorNumber);
  walls = level.walls;
  columnMeshes.push(...level.columns);
}

// --- Input -------------------------------------------------------------------
// Keys are held under several spellings ('Space'/'space'/' ', 'KeyW'/'keyw'/'w')
// so player.js can look up whichever it checks for.
const keys = new Set();
const mouseNDC = { x: 0, y: 0 };
const ctx = { keys, mouseNDC, camera, arenaSize, mouseDown: false };

const spellings = (event) => [event.code, event.key, event.key.toLowerCase(), event.code.toLowerCase()];

// The left button is reported to player.js both as ctx.mouseDown and as a key token.
const MOUSE_TOKENS = ['mouse', 'Mouse0', 'mouse0', 'MouseLeft', 'mouseleft', 'Primary', 'primary', 'Fire'];

let musicStarted = false;
function tryStartMusic() {
  if (!musicStarted) {
    musicStarted = true;
    startMusic();
  }
}

function setMouseDown(down) {
  ctx.mouseDown = down;
  for (const token of MOUSE_TOKENS) {
    if (down) keys.add(token); else keys.delete(token);
  }
}

function tryTriggerAbility() {
  if (state !== 'playing' || !player) return;
  const result = triggerAbility(player, scene);
  if (result) {
    if (player.element === 'water') applyWaterSpeedBoost();
    resumeAudio();
    tryStartMusic();
  }
}

addEventListener('contextmenu', (event) => event.preventDefault());

addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  for (const token of spellings(event)) keys.add(token);
  if (event.code === 'KeyM') {
    const muted = toggleMusic();
    ui.setMusicMuted(muted);
  }
  if (event.code === 'KeyE') tryTriggerAbility();
  if (state === 'gameover' && event.key.toLowerCase() === 'r') restart();
  tryStartMusic();
});
addEventListener('keyup', (event) => { for (const token of spellings(event)) keys.delete(token); });

addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    setMouseDown(true);
    resumeAudio();
    tryStartMusic();
  } else if (event.button === 2) {
    tryTriggerAbility();
  }
});
addEventListener('mouseup', (event) => { if (event.button === 0) setMouseDown(false); });
addEventListener('blur', () => setMouseDown(false));

addEventListener('pointermove', (event) => {
  mouseNDC.x = (event.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(event.clientY / innerHeight) * 2 + 1;
});

// Touch support: tap/ drag anywhere to aim and fire.
addEventListener('touchstart', (event) => {
  if (event.target.tagName === 'BUTTON') return;
  const t = event.touches[0];
  mouseNDC.x = (t.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(t.clientY / innerHeight) * 2 + 1;
  setMouseDown(true);
  tryStartMusic();
}, { passive: false });
addEventListener('touchmove', (event) => {
  event.preventDefault();
  const t = event.touches[0];
  mouseNDC.x = (t.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(t.clientY / innerHeight) * 2 + 1;
}, { passive: false });
addEventListener('touchend', () => setMouseDown(false));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Optional FPS panel ------------------------------------------------------
const urlParams = new URLSearchParams(location.search);
const showFps = urlParams.has('fps');
let fpsPanel = null;
if (showFps) {
  fpsPanel = document.createElement('div');
  Object.assign(fpsPanel.style, {
    position: 'fixed', right: '12px', top: '12px', zIndex: '20',
    padding: '8px 12px', background: 'rgba(0,0,0,0.6)', color: '#f2f2f2',
    font: '13px/1.4 monospace', pointerEvents: 'none',
  });
  fpsPanel.textContent = 'FPS: --';
  document.body.appendChild(fpsPanel);
}

// --- Game state --------------------------------------------------------------
const player = createPlayer(scene);
const maxHp = () => playerHP * player.upgrades.maxHp;

let state = 'playing';       // 'playing' | 'gameover' | 'levelup'
let score = 0;               // enemies killed
let floor = 1;               // the descent itself arrives in M2
let waveInFloor = 1;         // current wave out of wavesPerFloor
let playerLevel = 1;
let playerXP = 0;
let xpToNext = xpBase;
let contactTimer = 0;
const itemBuffs = { damage: { timer: 0, mul: 1 }, speed: { timer: 0, mul: 1 }, fireRate: { timer: 0, mul: 1 } };
let runStats = createStats();
let waveTimer = 0;
let shownHp = null;
let screenShake = 0;
const activeSpawnIndicators = [];

const alive = (thing) => thing.alive !== false;   // treat a missing flag as alive
const liveEnemies = () => getEnemies().filter(alive).length;
const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function attachHealthBars() {
  for (const enemy of getEnemies()) {
    if (!enemy.healthBar) {
      enemy.healthBar = createEnemyHealthBar();
      enemy.healthBar.setHp(enemy.hp, enemy.maxHp ?? enemyHP);
    }
  }
}

function clearSpawnIndicators() {
  for (const ind of activeSpawnIndicators) ind.remove();
  activeSpawnIndicators.length = 0;
}

function addSpawnIndicator(spawnPos) {
  const ind = createSpawnIndicator();
  positionSpawnIndicator(ind.element, spawnPos, camera, renderer);
  activeSpawnIndicators.push(ind);
  setTimeout(() => {
    ind.remove();
    const i = activeSpawnIndicators.indexOf(ind);
    if (i >= 0) activeSpawnIndicators.splice(i, 1);
  }, spawnIndicatorDuration * 1000);
}

function spawnWaveCustom(scene, count) {
  const playerPos = player.group.position;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  camDir.y = 0;
  if (camDir.lengthSq() > 0) camDir.normalize();
  const behind = camDir.clone().negate();
  const perp = new THREE.Vector3(-camDir.z, 0, camDir.x);

  const spawnDistance = minSpawnDistance + spawnMargin;
  const spread = minSpawnDistance * 0.6;

  for (let i = 0; i < count; i++) {
    const lateral = (Math.random() * 2 - 1) * spread;
    const spawnPos = new THREE.Vector3()
      .copy(playerPos)
      .addScaledVector(behind, spawnDistance)
      .addScaledVector(perp, lateral);
    spawnPos.x = Math.max(-arenaSize, Math.min(arenaSize, spawnPos.x));
    spawnPos.z = Math.max(-arenaSize, Math.min(arenaSize, spawnPos.z));
    spawnPos.y = 0;

    spawnEnemyAt(scene, spawnPos);
    addSpawnIndicator(spawnPos);
  }
}

function resolveColumnCollisions(position, radius) {
  for (const mesh of columnMeshes) {
    const dx = position.x - mesh.position.x;
    const dz = position.z - mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = radius + columnRadius;
    if (dist < minDist && dist > 0.001) {
      const push = (minDist - dist) / dist;
      position.x += dx * push;
      position.z += dz * push;
    }
  }
}

function resolveWallCollisions(position, radius) {
  for (const wall of walls) {
    // Closest point on the axis-aligned wall box to the circle center.
    const closestX = Math.max(wall.x - wall.halfW, Math.min(position.x, wall.x + wall.halfW));
    const closestZ = Math.max(wall.z - wall.halfD, Math.min(position.z, wall.z + wall.halfD));
    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > 0 && distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      position.x += dx * push;
      position.z += dz * push;
    }
  }
  position.x = Math.max(-arenaSize, Math.min(arenaSize, position.x));
  position.z = Math.max(-arenaSize, Math.min(arenaSize, position.z));
}

function separateEnemies() {
  const enemies = getEnemies();
  // Run a couple of iterations so large clumps unpack in a single frame.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!alive(a)) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (!alive(b)) continue;
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        // Keep enemies slightly farther apart than their physical radii so they fan out.
        const minDist = ((a.radius ?? enemyRadius) + (b.radius ?? enemyRadius)) * 1.3;
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) / dist * 0.55;
          a.mesh.position.x -= dx * push;
          a.mesh.position.z -= dz * push;
          b.mesh.position.x += dx * push;
          b.mesh.position.z += dz * push;
        }
      }
    }
  }
}

function restart() {
  clearSpawnIndicators();
  clearEnemyHealthBars();
  for (const enemy of getEnemies()) if (enemy.mesh) scene.remove(enemy.mesh);   // don't trust clearEnemies to un-draw them
  clearEnemies();
  for (const shot of getProjectiles()) {
    shot.alive = false;
    if (shot.mesh) scene.remove(shot.mesh);
  }
  clearElementFields();
  clearLevel();
  clearEnemyProjectiles();
  clearFX();
  clearAbilities(scene);
  clearItems(scene);
  screenShake = 0;
  player.upgrades = { damage: 1, speed: 1, maxHp: 1, fireRate: 1 };
  player.buffs = { damage: 1, speed: 1, fireRate: 1 };
  for (const key of Object.keys(itemBuffs)) { itemBuffs[key].timer = 0; itemBuffs[key].mul = 1; }
  runStats = createStats();
  player.hp = maxHp();
  player.dead = false;
  player.group.position.set(0, player.group.position.y, 0);
  setElement(player, 'fire');
  score = 0;
  floor = 1;
  waveInFloor = 1;
  playerLevel = 1;
  playerXP = 0;
  xpToNext = xpBase;
  contactTimer = 0;
  waveTimer = spawnInterval;
  shownHp = player.hp;
  setMouseDown(false);
  createLevel(scene, floor);
  spawnWaveCustom(scene, waveSize);
  attachHealthBars();
  spawnElementFields(scene, elementFieldCount);
  setScore(score);
  setFloor(floor);
  setWave(waveInFloor, wavesPerFloor);
  setHealth(player.hp, maxHp());
  hideGameOver();
  state = 'playing';
}

ui.setRestartHandler(restart);

// --- Element field absorption ------------------------------------------------
function absorbFields() {
  const playerPos = player.group.position;
  for (const field of getElementFields()) {
    if (!alive(field)) continue;
    if (distanceXZ(playerPos, field.mesh.position) < field.radius + playerRadius) {
      if (field.type === player.element) {
        // Matching element: heal instead of swapping.
        player.hp = Math.min(maxHp(), player.hp + 10);
      } else {
        setElement(player, field.type);
      }
      playAbsorb(field.type);
      field.alive = false;
      if (field.mesh.parent) field.mesh.parent.remove(field.mesh);
    }
  }
}

// --- Collision (ours, not the other builder's) --------------------------------
function projectileHitsWall(position, radius) {
  for (const wall of walls) {
    const closestX = Math.max(wall.x - wall.halfW, Math.min(position.x, wall.x + wall.halfW));
    const closestZ = Math.max(wall.z - wall.halfD, Math.min(position.z, wall.z + wall.halfD));
    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  for (const mesh of columnMeshes) {
    const dx = position.x - mesh.position.x;
    const dz = position.z - mesh.position.z;
    if (dx * dx + dz * dz < (radius + columnRadius) * (radius + columnRadius)) return true;
  }
  return false;
}

function blockProjectiles() {
  for (const shot of getProjectiles()) {
    if (!alive(shot)) continue;
    if (projectileHitsWall(shot.mesh.position, projectileRadius)) {
      shot.alive = false;
      if (shot.mesh) scene.remove(shot.mesh);
      spawnHitBurst(scene, shot.mesh.position.clone(), elementColors[player.element] ?? '#f2f2f2');
    }
  }
  for (const shot of getEnemyProjectiles()) {
    if (!alive(shot)) continue;
    if (projectileHitsWall(shot.mesh.position, shot.radius ?? archerProjectileRadius)) {
      shot.alive = false;
      if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
    }
  }
}

function killEnemy(enemy, deathPos) {
  enemy.alive = false;
  if (enemy.mesh) scene.remove(enemy.mesh);
  if (enemy.healthBar) { enemy.healthBar.remove(); enemy.healthBar = null; }
  spawnHitBurst(scene, deathPos, elementColors[player.element]);
  screenShake += screenShakeAmount;
  score += 1;
  playHit(player.element);
  addXP(xpForEnemy(enemy));
  recordKill(runStats, enemy);
  applyNewAchievements();
  if (Math.random() < enemyElementDropChance) {
    spawnElementFieldAt(scene, deathPos);
  }
  if (Math.random() < itemDropChance) {
    spawnItemAt(scene, deathPos);
  }
}

function xpForEnemy(enemy) {
  let xp = xpValues[enemy.role] ?? xpValues.brawler;
  if (enemy.personality === 'hero') xp *= xpValues.heroMul ?? 1;
  return Math.floor(xp);
}

function applyNewAchievements() {
  for (const ach of checkAchievements(runStats)) {
    player.upgrades[ach.reward.key] *= ach.reward.mul;
    if (ach.reward.key === 'maxHp') {
      const ratio = player.hp / maxHp();
      player.hp = maxHp() * Math.max(0.1, ratio);
    }
    showBanner(`Achievement: ${ach.label}`, ach.desc, 2500);
    playAchievement();
  }
}

function applyItem(type) {
  playItemPickup();
  if (type.key === 'heal') {
    player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.3);
  } else {
    itemBuffs[type.key].timer = itemDuration;
    itemBuffs[type.key].mul = type.mul;
    player.buffs[type.key] = type.mul;
  }
}

function addXP(amount) {
  if (state !== 'playing' && state !== 'levelup') return;
  playerXP += amount;
  setXP(playerXP, xpToNext);
  if (playerXP >= xpToNext) {
    playerXP -= xpToNext;
    xpToNext = Math.floor(xpToNext * xpGrowth);
    levelUp();
  }
}

function levelUp() {
  playerLevel += 1;
  setLevel(playerLevel);
  setXP(playerXP, xpToNext);
  state = 'levelup';
  setMouseDown(false);

  // Pick a few random upgrades.
  const choices = [];
  const pool = upgradeOptions.slice();
  while (choices.length < levelUpChoices && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(i, 1)[0]);
  }

  showLevelUp(choices, (choice) => {
    player.upgrades[choice.key] *= choice.mul;
    if (choice.key === 'maxHp') {
      const ratio = player.hp / maxHp();
      player.hp = maxHp() * Math.max(0.1, ratio);
    }
    state = 'playing';
    hideLevelUp();
    playLevelUp();
    setHealth(player.hp, maxHp());
  });
}

function damageEnemy(enemy, damage) {
  if (!alive(enemy)) return;
  enemy.hp -= damage;
  if (enemy.healthBar) enemy.healthBar.setHp(enemy.hp, enemy.maxHp ?? enemyHP);
  if (enemy.hp <= 0) {
    killEnemy(enemy, enemy.mesh.position.clone());
  }
}

function hitEnemies() {
  const enemies = getEnemies();
  for (const shot of getProjectiles()) {
    if (!alive(shot)) continue;
    for (const enemy of enemies) {
      if (!alive(enemy)) continue;
      const reach = projectileRadius + (enemy.radius ?? enemyRadius);
      if (distanceXZ(shot.mesh.position, enemy.mesh.position) < reach) {
        enemy.hp -= shot.damage ?? projectileDamage;
        if (enemy.healthBar) enemy.healthBar.setHp(enemy.hp, enemy.maxHp ?? enemyHP);

        // Elemental status effects.
        if (player.element === 'fire') enemy.burnTimer = burnDuration;
        if (player.element === 'earth' && Math.random() < earthSlowChance) enemy.slowTimer = earthSlowDuration;
        if (player.element === 'water') applyWaterSpeedBoost();

        if (shot.pierce !== undefined) {
          shot.pierce -= 1;
          if (shot.pierce <= 0) {
            shot.alive = false;
            if (shot.mesh) scene.remove(shot.mesh);
          }
        } else {
          shot.alive = false;
          if (shot.mesh) scene.remove(shot.mesh);
        }
        if (enemy.hp <= 0) {
          killEnemy(enemy, enemy.mesh.position.clone());
        }
        break;   // this shot hit one enemy this frame
      }
    }
  }
}

function hitPlayer() {
  const playerPos = player.group.position;
  for (const shot of getEnemyProjectiles()) {
    if (!alive(shot)) continue;
    const radius = shot.radius ?? archerProjectileRadius;
    if (distanceXZ(shot.mesh.position, playerPos) < radius + playerRadius) {
      player.hp -= shot.damage ?? archerProjectileDamage;
      shot.alive = false;
      if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
      screenShake += screenShakeAmount * 0.5;
      break;
    }
  }
}

function touchDamage(dt) {
  contactTimer -= dt;
  for (const enemy of getEnemies()) {
    if (!alive(enemy)) continue;
    const reach = (enemy.radius ?? enemyRadius) + playerRadius;
    const dx = player.group.position.x - enemy.mesh.position.x;
    const dz = player.group.position.z - enemy.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < reach) {
      // Resolve overlap so enemies don't sit inside the golem.
      const overlap = reach - dist;
      const nx = dist > 0.001 ? dx / dist : 1;
      const nz = dist > 0.001 ? dz / dist : 0;
      player.group.position.x = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.x + nx * overlap));
      player.group.position.z = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.z + nz * overlap));
      enemy.mesh.position.x -= nx * overlap;
      enemy.mesh.position.z -= nz * overlap;

      if (contactTimer <= 0) {
        player.hp -= contactDamage;
        contactTimer = contactCooldown;
        // Knock back both the golem and the enemy on contact.
        player.group.position.x = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.x + nx * contactPushDistance));
        player.group.position.z = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.z + nz * contactPushDistance));
        enemy.mesh.position.x -= nx * contactPushEnemy;
        enemy.mesh.position.z -= nz * contactPushEnemy;
      }
      break;
    }
  }
}

// --- Camera follow -----------------------------------------------------------
const targetCameraPos = new THREE.Vector3();
const currentCameraPos = camera.position.clone();

function updateCamera(dt) {
  const p = player.group.position;
  targetCameraPos.set(
    p.x + cameraDistance * Math.sin(cameraAngle),
    p.y + cameraHeight,
    p.z + cameraDistance * Math.cos(cameraAngle)
  );
  const t = Math.min(1, cameraFollowSpeed * dt);
  currentCameraPos.lerp(targetCameraPos, t);

  if (screenShake > 0) {
    const shake = new THREE.Vector3(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
    currentCameraPos.add(shake);
    screenShake = Math.max(0, screenShake - screenShakeDecay * dt);
  }

  camera.position.copy(currentCameraPos);
  camera.lookAt(p.x, p.y, p.z);
}

// --- Frame -------------------------------------------------------------------
function update(dt) {
  updatePlayer(player, dt, ctx);
  resolveColumnCollisions(player.group.position, playerRadius);
  resolveWallCollisions(player.group.position, playerRadius);
  updateProjectiles(dt);
  const burnKills = updateEnemies(dt, player.group.position);
  for (const enemy of burnKills) {
    if (enemy.mesh && enemy.mesh.parent) enemy.mesh.parent.remove(enemy.mesh);
    if (enemy.healthBar) { enemy.healthBar.remove(); enemy.healthBar = null; }
    killEnemy(enemy, enemy.mesh.position.clone());
  }
  updateEnemyProjectiles(dt);
  blockProjectiles();
  separateEnemies();
  hitPlayer(dt);

  for (const enemy of getEnemies()) {
    if (alive(enemy)) {
      resolveColumnCollisions(enemy.mesh.position, enemy.radius ?? enemyRadius);
      resolveWallCollisions(enemy.mesh.position, enemy.radius ?? enemyRadius);
      if (enemy.healthBar) {
        positionEnemyHealthBar(enemy.healthBar.element, enemy.mesh.position, camera, renderer);
      }
    }
  }

  absorbFields();
  hitEnemies();
  touchDamage(dt);
  updateElementFields(dt);

  // Item pickups and buff timers.
  const pickups = updateItems(dt, player.group.position);
  for (const itemType of pickups) applyItem(itemType);
  for (const key of Object.keys(itemBuffs)) {
    if (itemBuffs[key].timer > 0) {
      itemBuffs[key].timer -= dt;
      player.buffs[key] = itemBuffs[key].mul;
    } else {
      player.buffs[key] = 1;
    }
  }

  // HUD: ability cooldown and active item buffs.
  const cds = getCooldowns();
  setAbilityCooldown(cds[player.element], abilityCooldown[player.element]);
  const activeBuffList = [];
  const buffLabels = { damage: 'Might', speed: 'Swiftness', fireRate: 'Alacrity' };
  for (const key of Object.keys(itemBuffs)) {
    if (itemBuffs[key].timer > 0) {
      activeBuffList.push({ label: buffLabels[key], timer: itemBuffs[key].timer });
    }
  }
  setBuffs(activeBuffList);

  // Alternate-fire abilities.
  const abilityEvents = updateAbilities(dt, getEnemies(), scene);
  for (const ev of abilityEvents) {
    if (ev.type === 'damage') {
      damageEnemy(ev.enemy, ev.damage);
      if (ev.applyBurn) ev.enemy.burnTimer = burnDuration;
      if (ev.applySlow) ev.enemy.slowTimer = earthSlowDuration;
    } else if (ev.type === 'knockback') {
      if (alive(ev.enemy)) {
        ev.enemy.mesh.position.addScaledVector(ev.dir, ev.amount * dt);
      }
    } else if (ev.type === 'burst') {
      spawnHitBurst(scene, ev.position, ev.color);
    } else if (ev.type === 'shake') {
      screenShake += ev.amount;
    }
  }

  if (player.hp <= 0 && !player.dead) {
    player.dead = true;
    state = 'gameover';
    screenShake += screenShakeAmount * 3;
    playDeath();
    setMouseDown(false);
    showGameOver(score, floor);
  }

  // Floor escalation: quiet beat once the wave is clear, then the next wave or a new floor.
  if (liveEnemies() === 0) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      if (waveInFloor < wavesPerFloor) {
        waveInFloor += 1;
        spawnWaveCustom(scene, waveSize + (floor - 1) * waveGrowth);
        attachHealthBars();
      } else {
        floor += 1;
        recordFloor(runStats, floor);
        applyNewAchievements();
        waveInFloor = 1;
        screenShake += screenShakeAmount * 2;
        showBanner('Floor Complete', `Descending to floor ${floor}`, 1500);
        createLevel(scene, floor);
        clearAbilities(scene);
        clearItems(scene);
        spawnWaveCustom(scene, waveSize + (floor - 1) * waveGrowth);
        attachHealthBars();
        clearElementFields();
        spawnElementFields(scene, elementFieldCount + Math.floor(floor / 2));
        setTimeout(() => showBanner(`Floor ${floor}`, 'Survive the waves', 2500), 1600);
      }
      waveTimer = spawnInterval;
      setWave(waveInFloor, wavesPerFloor);
    }
  }

  setScore(score);
  setFloor(floor);

  if (player.hp !== shownHp) {
    shownHp = player.hp;
    setHealth(player.hp, maxHp());
  }
}

const clock = new THREE.Clock();
let fpsAccumulator = 0;
let fpsFrames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);   // a tab switch must not teleport the world
  if (state === 'playing') update(dt);
  updateFX(dt);
  updateCamera(dt);
  renderer.render(scene, camera);

  if (fpsPanel) {
    fpsAccumulator += dt;
    fpsFrames += 1;
    if (fpsAccumulator >= 0.5) {
      const fps = Math.round(fpsFrames / fpsAccumulator);
      const tris = renderer.info.render.triangles;
      const calls = renderer.info.render.calls;
      fpsPanel.textContent = `FPS: ${fps}  calls: ${calls}  tris: ${tris}`;
      fpsAccumulator = 0;
      fpsFrames = 0;
    }
  }
});

createLevel(scene, floor);
showBanner(`Floor ${floor}`, 'Survive the waves', 3000);
spawnWaveCustom(scene, waveSize);
attachHealthBars();
waveTimer = spawnInterval;
spawnElementFields(scene, elementFieldCount);
setScore(score);
setFloor(floor);
setWave(waveInFloor, wavesPerFloor);
setHealth(player.hp, maxHp());
setLevel(playerLevel);
setXP(playerXP, xpToNext);
