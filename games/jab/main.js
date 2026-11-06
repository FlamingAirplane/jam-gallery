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
} from './tuning.js';
import { createPlayer, updatePlayer, updateProjectiles, getProjectiles, setElement, getElement } from './player.js?v=8';
import { spawnHitBurst, updateFX, clearFX } from './fx.js?v=2';
import {
  spawnEnemyAt, updateEnemies, getEnemies, clearEnemies,
  updateEnemyProjectiles, getEnemyProjectiles, clearEnemyProjectiles,
} from './enemies.js?v=3';
import { spawnElementFields, spawnElementFieldAt, updateElementFields, getElementFields, clearElementFields } from './elements.js?v=2';
import { playHit, playDeath, playAbsorb, resumeAudio, startMusic, toggleMusic, isMusicMuted } from './audio.js?v=3';
import { buildMap } from './level.js?v=2';
import {
  createUI, setScore, setFloor, setWave, setHealth, showGameOver, hideGameOver,
  createEnemyHealthBar, positionEnemyHealthBar, clearEnemyHealthBars,
  createSpawnIndicator, positionSpawnIndicator,
} from './ui.js?v=2';

// --- Overlay -----------------------------------------------------------------
const ui = createUI();

// --- Scene, camera, renderer -------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#595959');

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

scene.add(new THREE.HemisphereLight('#f2f2f2', '#595959', 1.6));
const sun = new THREE.DirectionalLight('#f2f2f2', 1.8);
sun.position.set(8, 16, 6);
scene.add(sun);

// --- Mosaic floor texture ----------------------------------------------------
function createMosaicTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d');
  const greys = ['#595959', '#6e6e6e', '#7f7f7f', '#8f8f8f', '#a5a5a5'];

  // Base fill.
  ctx2d.fillStyle = '#555555';
  ctx2d.fillRect(0, 0, size, size);

  // Random-sized mosaic tiles.
  const tile = 32;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shade = greys[Math.floor(Math.random() * greys.length)];
      ctx2d.fillStyle = shade;
      ctx2d.fillRect(x + 1, y + 1, tile - 2, tile - 2);

      // Occasional smaller inset tile.
      if (Math.random() < 0.25) {
        ctx2d.fillStyle = greys[Math.floor(Math.random() * greys.length)];
        const inset = tile * 0.25;
        ctx2d.fillRect(x + inset, y + inset, tile - inset * 2, tile - inset * 2);
      }

      // Dark grout / cracks.
      ctx2d.strokeStyle = '#3a3a3a';
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(x, y, tile, tile);

      // Random crack line.
      if (Math.random() < 0.08) {
        ctx2d.beginPath();
        ctx2d.moveTo(x + Math.random() * tile, y + Math.random() * tile);
        ctx2d.lineTo(x + Math.random() * tile, y + Math.random() * tile);
        ctx2d.strokeStyle = '#2a2a2a';
        ctx2d.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(arenaSize * 2, arenaSize * 2),
  new THREE.MeshStandardMaterial({ map: createMosaicTexture(), roughness: 0.9 })
);
floorMesh.rotation.x = -Math.PI / 2;
scene.add(floorMesh);

const grid = new THREE.GridHelper(arenaSize * 2, arenaSize, '#f2f2f2', '#a5a5a5');
grid.position.y = 0.02;
scene.add(grid);

// --- Level layout (inspired by Map_Base.png) ---------------------------------
let walls = [];
let columnMeshes = [];

function clearLevel() {
  for (const mesh of columnMeshes) {
    if (mesh.parent) mesh.parent.remove(mesh);
  }
  columnMeshes.length = 0;
  // Wall meshes are owned by level.js; we rebuild them on restart.
}

function createLevel(scene) {
  clearLevel();
  const level = buildMap(scene);
  walls = level.walls;
  columnMeshes.push(...level.columns);
}

createLevel(scene);


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
  screenShake = 0;
  player.hp = maxHp();
  player.dead = false;
  player.group.position.set(0, player.group.position.y, 0);
  setElement(player, 'fire');
  score = 0;
  floor = 1;
  waveInFloor = 1;
  contactTimer = 0;
  waveTimer = spawnInterval;
  shownHp = player.hp;
  setMouseDown(false);
  createLevel(scene);
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
    if (projectileHitsWall(shot.mesh.position, archerProjectileRadius)) {
      shot.alive = false;
      if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
    }
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
        if (enemy.healthBar) enemy.healthBar.setHp(enemy.hp, enemyHP);
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
          const deathPos = enemy.mesh.position.clone();
          enemy.alive = false;
          if (enemy.mesh) scene.remove(enemy.mesh);
          if (enemy.healthBar) { enemy.healthBar.remove(); enemy.healthBar = null; }
          spawnHitBurst(scene, deathPos, elementColors[player.element]);
          screenShake += screenShakeAmount;
          score += 1;
          playHit(player.element);
          if (Math.random() < enemyElementDropChance) {
            spawnElementFieldAt(scene, deathPos);
          }
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
    if (distanceXZ(shot.mesh.position, playerPos) < archerProjectileRadius + playerRadius) {
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
  updateEnemies(dt, player.group.position);
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
        waveInFloor = 1;
        spawnWaveCustom(scene, waveSize + (floor - 1) * waveGrowth);
        attachHealthBars();
        clearElementFields();
        spawnElementFields(scene, elementFieldCount + Math.floor(floor / 2));
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

createLevel(scene);
spawnWaveCustom(scene, waveSize);
attachHealthBars();
waveTimer = spawnInterval;
spawnElementFields(scene, elementFieldCount);
setScore(score);
setFloor(floor);
setWave(waveInFloor, wavesPerFloor);
setHealth(player.hp, maxHp());
