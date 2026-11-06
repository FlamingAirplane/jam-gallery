// The golem: WASD movement on the floor, mouse aim, and firing element-charged shots.
import * as THREE from 'three';
import {
  moveSpeed,
  playerHP,
  playerRadius,
  fireRate,
  projectileSpeed,
  projectileDamage,
  projectileRange,
  projectileRadius,
  arenaSize,
  elementColors,
  fireProjectileSpeed,
  waterProjectileSpeed,
  earthProjectileSpeed,
  earthProjectileScale,
  waterPierceCount,
  windProjectileSpeed,
  windPierceCount,
  elementMoveSpeedMul,
  elementFireRateMul,
  elementRotationSpeedMul,
  trailSpawnInterval,
  arrowTurnSpeed,
  waterSpeedBoostMul,
  waterSpeedBoostDuration,
} from './tuning.js';
import { spawnMuzzleFlash, spawnProjectileTrailDot, clearFX } from './fx.js?v=2';
import { playShoot } from './audio.js?v=2';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GOLEM_COLOR = '#8e9196';
const PROJECTILE_COLOR = '#f1f2f4';

// Module state: the game has one golem and one projectile list at a time.
let activePlayer = null; // whose position new shots start from
let shotScene = null; // the scene shot meshes are added to
let fireTimer = 0; // seconds until the next shot is allowed
const projectiles = []; // [{ mesh, dir, damage, alive, traveled, speed, pierce }]
let speedBoostTimer = 0; // water speed boost remaining time

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const hitPoint = new THREE.Vector3();
const moveStep = new THREE.Vector3();
let projectileGeometry = null; // one shared sphere, made on first shot

// Load the Flow Studio golem models. Base is used for water; fire and earth have their own forms.
const golemTemplates = { base: null, fire: null, earth: null };
async function loadGolemModel(key, file) {
  try {
    golemTemplates[key] = await new GLTFLoader().loadAsync(file);
  } catch (err) {
    console.warn(`Golem ${key} model not loaded`, err);
  }
}
await Promise.all([
  loadGolemModel('base', 'assets/golem.glb?v=5'),
  loadGolemModel('fire', 'assets/golem_fire.glb?v=1'),
  loadGolemModel('earth', 'assets/golem_earth.glb?v=1'),
]);

function hasAnyGolemModel() {
  return golemTemplates.base || golemTemplates.fire || golemTemplates.earth;
}

// movement keys are matched on e.code ('KeyW') and on the plain letter, so either convention works
function held(keys, code, letter) {
  return keys.has(code) || keys.has(letter);
}

// Firing is Space, or the left mouse button held down. main.js reports the button either
// as a key token in ctx.keys or as a flag, so accept the obvious spellings of each.
function firing(ctx) {
  const keys = ctx.keys;
  if (ctx.mouseDown || ctx.firing || (ctx.mouse && ctx.mouse.down)) return true;
  if (keys.has('Space') || keys.has('space')) return true;
  return (
    keys.has('Mouse0') ||
    keys.has('mouse0') ||
    keys.has('MouseLeft') ||
    keys.has('mouseleft') ||
    keys.has('Primary') ||
    keys.has('primary')
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerpAngle(current, target, t) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}

function buildProceduralGolem(group) {
  // Procedural fallback: a chunky body made of boxes.
  const material = new THREE.MeshStandardMaterial({ color: GOLEM_COLOR, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.7), material);
  torso.position.y = 0.75;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), material);
  head.position.y = 1.55;
  group.add(head);

  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.45), material);
  shoulderL.position.set(-0.62, 1.1, 0);
  group.add(shoulderL);

  const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.45), material);
  shoulderR.position.set(0.62, 1.1, 0);
  group.add(shoulderR);
}

function attachModelForElement(group, type) {
  // Remove any previous model.
  for (let i = group.children.length - 1; i >= 0; i--) {
    group.remove(group.children[i]);
  }
  // Pick the variant: fire/earth use their own model; water/wind (and any fallback) uses base.
  let key = 'base';
  if (type === 'fire' && golemTemplates.fire) key = 'fire';
  else if (type === 'earth' && golemTemplates.earth) key = 'earth';

  if (golemTemplates[key]) {
    const model = golemTemplates[key].scene.clone();
    group.add(model);
  } else if (hasAnyGolemModel()) {
    const model = (golemTemplates.base || golemTemplates.fire || golemTemplates.earth).scene.clone();
    group.add(model);
  } else {
    buildProceduralGolem(group);
  }
}

export function createPlayer(scene) {
  // A restart builds a fresh golem: drop the old one and the shots it left in the air.
  if (activePlayer && activePlayer.group.parent) activePlayer.group.parent.remove(activePlayer.group);
  clearProjectiles();
  clearFX();

  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  scene.add(group);
  shotScene = scene;
  fireTimer = 0;
  speedBoostTimer = 0;

  const player = {
    group,
    hp: playerHP,
    dead: false,
    element: null,
    facing: new THREE.Vector3(0, 0, 1), // where the next shot goes
    upgrades: { damage: 1, speed: 1, maxHp: 1, fireRate: 1 },
    buffs: { damage: 1, speed: 1, fireRate: 1 },
  };
  setElement(player, 'fire');
  activePlayer = player;
  return player;
}

export function setElement(player, type) {
  if (player.element !== type) {
    attachModelForElement(player.group, type);
  }
  player.element = type;
  player.group.traverse((child) => {
    if (child.isMesh && child.material) {
      // Keep the baked texture; no elemental tint.
      child.material.emissive.setHex(0x000000);
      child.material.emissiveIntensity = 0;
      // Remove specular sheen.
      child.material.roughness = 1;
      child.material.metalness = 0;
    }
  });
}

export function getElement(player) {
  return player.element;
}

export function applyWaterSpeedBoost() {
  speedBoostTimer = waterSpeedBoostDuration;
}

export function updatePlayer(player, dt, ctx) {
  activePlayer = player;
  const keys = ctx.keys;
  const position = player.group.position;

  // Walk: screen-relative, so WASD matches the screen no matter the camera angle.
  // W = screen up, S = screen down, A = screen left, D = screen right.
  const cam = ctx.camera;
  const camForward = new THREE.Vector3();
  cam.getWorldDirection(camForward);
  // Camera right lies flat on the ground because it's perpendicular to world up.
  const screenRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();
  // Screen up is perpendicular to screen right and also flat on the ground.
  const screenUp = new THREE.Vector3().crossVectors(screenRight, new THREE.Vector3(0, 1, 0)).normalize();

  moveStep.set(0, 0, 0);
  if (held(keys, 'KeyW', 'w')) moveStep.sub(screenUp);
  if (held(keys, 'KeyS', 's')) moveStep.add(screenUp);
  if (held(keys, 'KeyD', 'd')) moveStep.add(screenRight);
  if (held(keys, 'KeyA', 'a')) moveStep.sub(screenRight);
  // Water moves build a short speed boost.
  let speedMul = 1;
  if (speedBoostTimer > 0) {
    speedBoostTimer -= dt;
    speedMul = waterSpeedBoostMul;
  }

  if (moveStep.lengthSq() > 0) {
    moveStep.normalize().multiplyScalar(moveSpeed * elementMoveSpeedMul[player.element] * speedMul * player.upgrades.speed * player.buffs.speed * dt);
    position.x = clamp(position.x + moveStep.x, -arenaSize, arenaSize);
    position.z = clamp(position.z + moveStep.z, -arenaSize, arenaSize);
  }

  // Aim: arrow keys rotate manually; otherwise turn toward the mouse cursor.
  let arrowTurn = 0;
  if (held(keys, 'ArrowLeft', 'ArrowLeft')) arrowTurn += 1;
  if (held(keys, 'ArrowRight', 'ArrowRight')) arrowTurn -= 1;
  if (arrowTurn !== 0) {
    player.group.rotation.y += arrowTurn * arrowTurnSpeed * dt;
    player.facing.set(Math.sin(player.group.rotation.y), 0, Math.cos(player.group.rotation.y));
  } else {
    raycaster.setFromCamera(ctx.mouseNDC, ctx.camera);
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      const dx = hitPoint.x - position.x;
      const dz = hitPoint.z - position.z;
      if (dx !== 0 || dz !== 0) {
        player.facing.set(dx, 0, dz).normalize();
        const targetAngle = Math.atan2(player.facing.x, player.facing.z);
        const turnSpeed = 12 * elementRotationSpeedMul[player.element] * dt;
        player.group.rotation.y = lerpAngle(player.group.rotation.y, targetAngle, turnSpeed);
      }
    }
  }

  // Fire: one shot per cooldown while the button or Space is held.
  fireTimer = Math.max(0, fireTimer - dt);
  if (firing(ctx) && fireTimer === 0) {
    spawnShot(player);
    fireTimer = 1 / (fireRate * elementFireRateMul[player.element] * player.upgrades.fireRate * player.buffs.fireRate);
  }

  player.dead = player.hp <= 0;
}

export function updateProjectiles(dt) {
  // Drop last frame's spent shots first, in place: the caller holds this exact array.
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (projectiles[i].alive) continue;
    const mesh = projectiles[i].mesh;
    if (mesh.parent) mesh.parent.remove(mesh);
    projectiles.splice(i, 1);
  }

  for (const shot of projectiles) {
    const step = shot.speed * dt;
    shot.mesh.position.addScaledVector(shot.dir, step);
    shot.traveled += step;

    shot.trailTimer += dt;
    if (shot.trailTimer >= trailSpawnInterval) {
      shot.trailTimer = 0;
      spawnProjectileTrailDot(shotScene, shot.mesh.position.clone(), shot.mesh.material.color);
    }

    if (shot.traveled >= projectileRange) shot.alive = false; // cleaned up next frame
  }
}

export function getProjectiles() {
  return projectiles;
}

function spawnShot(player) {
  if (!projectileGeometry) projectileGeometry = new THREE.SphereGeometry(projectileRadius, 10, 6);

  const element = player.element ?? 'fire';
  const material = new THREE.MeshStandardMaterial({ color: elementColors[element] ?? PROJECTILE_COLOR });

  let mesh;
  let speed = projectileSpeed;
  let damage = projectileDamage * player.upgrades.damage * player.buffs.damage;
  let pierce;

  if (element === 'water') {
    // Thinner, longer piercing beam.
    mesh = new THREE.Mesh(projectileGeometry, material);
    mesh.scale.set(0.5, 0.5, 2.5);
    speed = waterProjectileSpeed;
    pierce = waterPierceCount;
  } else if (element === 'earth') {
    // Larger, slower, harder-hitting blast.
    mesh = new THREE.Mesh(projectileGeometry, material);
    mesh.scale.setScalar(earthProjectileScale);
    speed = earthProjectileSpeed;
    damage = projectileDamage * 1.5 * player.upgrades.damage;
  } else if (element === 'wind') {
    // Fast, thin, piercing dart.
    mesh = new THREE.Mesh(projectileGeometry, material);
    mesh.scale.set(0.35, 0.35, 2.2);
    speed = windProjectileSpeed;
    pierce = windPierceCount;
  } else {
    // Fire: fast default bolt.
    mesh = new THREE.Mesh(projectileGeometry, material);
    speed = fireProjectileSpeed;
  }

  const dir = player.facing.clone();
  mesh.position.copy(player.group.position);
  mesh.position.y = playerRadius; // chest height, clear of the floor
  mesh.position.addScaledVector(dir, playerRadius); // clear of the golem's own box
  shotScene.add(mesh);

  spawnMuzzleFlash(shotScene, mesh.position.clone(), elementColors[element] ?? PROJECTILE_COLOR);
  playShoot(element);

  projectiles.push({
    mesh,
    dir,
    damage,
    alive: true,
    traveled: 0,
    speed,
    pierce,
    trailTimer: 0,
  });
}

function clearProjectiles() {
  for (const shot of projectiles) {
    if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
  }
  projectiles.length = 0;
}
