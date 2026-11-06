// Enemy roles: brawlers rush and melee, archers keep distance and shoot.
import * as THREE from 'three';
import {
  enemySpeed, enemyHP, enemyRadius, arenaSize,
  enemyRoleWeights, personalityWeights,
  archerSpeed, archerPreferredRange, archerRangeTolerance,
  archerFireRate, archerProjectileSpeed, archerProjectileDamage,
  archerProjectileRadius, archerProjectileRange,
  mageSpeed, magePreferredRange, mageRangeTolerance,
  mageFireRate, mageProjectileSpeed, mageProjectileDamage,
  mageProjectileRadius, mageProjectileRange,
  brawlerModelScale, archerModelScale, mageModelScale,
  leaderAuraRadius, leaderSpeedMul, heroHpMul, heroSpeedMul, cowardFleeHpRatio,
} from './tuning.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BRAWLER_COLOR = '#4a4a4a';
const ARCHER_COLOR = '#6a5a4a';
const MAGE_COLOR = '#8e44ad';
const PERSONALITY_TINT = {
  leader: '#ffd700',
  hero: '#e74c3c',
  coward: '#95a5a6',
  grunt: null,
};
const enemies = [];
const enemyProjectiles = [];
let shotScene = null;
let brawlerGeometry = null;
let archerGeometry = null;
let mageGeometry = null;
let enemyProjectileGeometry = null;

// Load Flow Studio enemy models; fall back to procedural geometry if any fail.
const enemyTemplates = { fire: null, earth: null, water: null };
async function loadEnemyModel(element) {
  try {
    const gltf = await new GLTFLoader().loadAsync(`assets/enemy_${element}.glb?v=1`);
    enemyTemplates[element] = gltf;
  } catch (err) {
    console.warn(`Enemy ${element} model not loaded, using procedural fallback`, err);
  }
}
await Promise.all(['fire', 'earth', 'water'].map(loadEnemyModel));

function pickBrawlerTemplate() {
  return Math.random() < 0.5 ? enemyTemplates.fire : enemyTemplates.earth;
}

function pickArcherTemplate() {
  return enemyTemplates.water;
}

function pickMageTemplate() {
  return enemyTemplates.water;
}

function pickRole() {
  const roll = Math.random();
  if (roll < enemyRoleWeights.brawler) return 'brawler';
  if (roll < enemyRoleWeights.brawler + enemyRoleWeights.archer) return 'archer';
  return 'mage';
}

function pickPersonality() {
  const roll = Math.random();
  let sum = 0;
  for (const [key, weight] of Object.entries(personalityWeights)) {
    sum += weight;
    if (roll < sum) return key;
  }
  return 'grunt';
}

function getBrawlerGeometry() {
  if (!brawlerGeometry) {
    brawlerGeometry = new THREE.IcosahedronGeometry(enemyRadius * 0.9, 0);
    brawlerGeometry.scale(1, 1.6, 1);
    brawlerGeometry.translate(0, enemyRadius * 0.9, 0);
  }
  return brawlerGeometry;
}

function getArcherGeometry() {
  if (!archerGeometry) {
    // A narrower, taller shard for archers.
    archerGeometry = new THREE.ConeGeometry(enemyRadius * 0.7, enemyRadius * 2.6, 5);
    archerGeometry.translate(0, enemyRadius * 1.3, 0);
  }
  return archerGeometry;
}

function getMageGeometry() {
  if (!mageGeometry) {
    // A floating crystal for mages.
    mageGeometry = new THREE.OctahedronGeometry(enemyRadius * 0.95, 0);
    mageGeometry.translate(0, enemyRadius * 1.3, 0);
  }
  return mageGeometry;
}

export function spawnEnemyAt(scene, position, role = null) {
  shotScene = scene;
  const chosenRole = role ?? pickRole();
  const personality = pickPersonality();
  let mesh;
  let scale = 1;
  if (chosenRole === 'archer') {
    const tmpl = pickArcherTemplate();
    if (tmpl) {
      mesh = tmpl.scene.clone();
      mesh.scale.setScalar(archerModelScale);
    } else {
      mesh = new THREE.Mesh(getArcherGeometry(), new THREE.MeshStandardMaterial({ color: ARCHER_COLOR, roughness: 0.9, metalness: 0.2, flatShading: true }));
    }
  } else if (chosenRole === 'mage') {
    const tmpl = pickMageTemplate();
    if (tmpl) {
      mesh = tmpl.scene.clone();
      mesh.scale.setScalar(mageModelScale);
    } else {
      mesh = new THREE.Mesh(getMageGeometry(), new THREE.MeshStandardMaterial({ color: MAGE_COLOR, roughness: 0.6, metalness: 0.3, flatShading: true }));
    }
  } else {
    const tmpl = pickBrawlerTemplate();
    if (tmpl) {
      mesh = tmpl.scene.clone();
      mesh.scale.setScalar(brawlerModelScale);
    } else {
      mesh = new THREE.Mesh(getBrawlerGeometry(), new THREE.MeshStandardMaterial({ color: BRAWLER_COLOR, roughness: 0.9, metalness: 0.2, flatShading: true }));
    }
  }

  // Personality tint and scaling.
  const tint = PERSONALITY_TINT[personality];
  if (tint) {
    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color(tint);
        child.material.emissiveIntensity = personality === 'hero' ? 0.35 : 0.2;
      }
    });
  }
  if (personality === 'hero') {
    scale = 1.2;
    mesh.scale.multiplyScalar(scale);
  }

  mesh.position.copy(position);
  mesh.position.y = 0;
  mesh.rotation.y = Math.random() * Math.PI;
  scene.add(mesh);

  const maxHp = enemyHP * (personality === 'hero' ? heroHpMul : 1);
  enemies.push({
    mesh,
    hp: maxHp,
    maxHp,
    alive: true,
    radius: enemyRadius * scale,
    role: chosenRole,
    personality,
    fireTimer: Math.random() * 0.8,
  });
  return enemies[enemies.length - 1];
}

export function spawnWave(scene, count) {
  for (let i = 0; i < count; i++) {
    const edge = Math.floor(Math.random() * 4);
    const along = (Math.random() * 2 - 1) * arenaSize;
    const inset = arenaSize * (0.92 + Math.random() * 0.06);
    const position = new THREE.Vector3();
    if (edge === 0) position.set(along, 0, -inset);
    else if (edge === 1) position.set(along, 0, inset);
    else if (edge === 2) position.set(-inset, 0, along);
    else position.set(inset, 0, along);
    spawnEnemyAt(scene, position);
  }
}

function spawnEnemyProjectile(position, direction, {
  speed = archerProjectileSpeed,
  damage = archerProjectileDamage,
  radius = archerProjectileRadius,
  range = archerProjectileRange,
  color = '#f2a65a',
} = {}) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.copy(position);
  mesh.position.y = enemyRadius;
  if (shotScene) shotScene.add(mesh);
  enemyProjectiles.push({
    mesh,
    dir: direction.clone().normalize(),
    alive: true,
    traveled: 0,
    speed,
    damage,
    radius,
    range,
  });
}

function spawnMageProjectile(position, direction) {
  spawnEnemyProjectile(position, direction, {
    speed: mageProjectileSpeed,
    damage: mageProjectileDamage,
    radius: mageProjectileRadius,
    range: mageProjectileRange,
    color: '#9b59b6',
  });
}

export function updateEnemyProjectiles(dt) {
  // Clean up dead projectiles.
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    if (enemyProjectiles[i].alive) continue;
    const mesh = enemyProjectiles[i].mesh;
    if (mesh.parent) mesh.parent.remove(mesh);
    enemyProjectiles.splice(i, 1);
  }

  for (const shot of enemyProjectiles) {
    const step = (shot.speed ?? archerProjectileSpeed) * dt;
    shot.mesh.position.addScaledVector(shot.dir, step);
    shot.traveled += step;
    if (shot.traveled >= (shot.range ?? archerProjectileRange)) shot.alive = false;
  }
}

export function getEnemyProjectiles() {
  return enemyProjectiles;
}

export function clearEnemyProjectiles() {
  for (const shot of enemyProjectiles) {
    if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
  }
  enemyProjectiles.length = 0;
}

export function updateEnemies(dt, targetPos) {
  // Drop the ones killed last frame first, in place.
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].alive) continue;
    const mesh = enemies[i].mesh;
    if (mesh.parent) mesh.parent.remove(mesh);
    enemies.splice(i, 1);
  }

  // Pre-compute leader positions for the aura.
  const leaderPositions = enemies
    .filter((e) => e.personality === 'leader' && e.alive)
    .map((e) => e.mesh.position);

  for (const enemy of enemies) {
    const position = enemy.mesh.position;
    const dx = targetPos.x - position.x;
    const dz = targetPos.z - position.z;
    const distance = Math.hypot(dx, dz);

    // Personality speed modifiers.
    let speedMul = enemy.personality === 'hero' ? heroSpeedMul : 1;
    for (const lp of leaderPositions) {
      if (lp === position) continue;
      if (position.distanceTo(lp) < leaderAuraRadius) {
        speedMul *= leaderSpeedMul;
        break;
      }
    }

    // Cowards run away when badly hurt.
    const fleeing = enemy.personality === 'coward' && enemy.hp / enemy.maxHp < cowardFleeHpRatio && distance < 30;

    if (enemy.role === 'archer' || enemy.role === 'mage') {
      const isMage = enemy.role === 'mage';
      const prefRange = isMage ? magePreferredRange : archerPreferredRange;
      const rangeTol = isMage ? mageRangeTolerance : archerRangeTolerance;
      const moveSpeed = (isMage ? mageSpeed : archerSpeed) * speedMul;
      const fireRate = isMage ? mageFireRate : archerFireRate;

      let moveDirX = 0;
      let moveDirZ = 0;
      if (fleeing) {
        moveDirX = -dx / distance;
        moveDirZ = -dz / distance;
      } else {
        const tooClose = distance < prefRange - rangeTol;
        const tooFar = distance > prefRange + rangeTol;
        if (tooClose) {
          moveDirX = -dx / distance;
          moveDirZ = -dz / distance;
        } else if (tooFar) {
          moveDirX = dx / distance;
          moveDirZ = dz / distance;
        } else {
          // Strafe sideways to avoid stacking.
          moveDirX = dz / distance;
          moveDirZ = -dx / distance;
        }
      }
      position.x += moveDirX * moveSpeed * dt;
      position.z += moveDirZ * moveSpeed * dt;

      // Face the golem.
      if (distance > 1e-4) {
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
      }

      // Fire when roughly in range and not fleeing.
      enemy.fireTimer -= dt;
      if (!fleeing && enemy.fireTimer <= 0 && distance < prefRange + rangeTol * 2 && distance > 1) {
        const origin = position.clone().add(new THREE.Vector3(0, enemyRadius, 0));
        const dir = new THREE.Vector3(dx / distance, 0, dz / distance);
        if (isMage) {
          spawnMageProjectile(origin, dir);
        } else {
          spawnEnemyProjectile(origin, dir);
        }
        enemy.fireTimer = 1 / fireRate + Math.random() * 0.2;
      }
    } else {
      // Brawler: rush straight at the golem (or flee).
      let step = enemySpeed * speedMul * dt;
      if (fleeing) {
        step *= -1;
      }
      if (distance > 1e-4) {
        const travel = Math.min(Math.abs(step), distance) * Math.sign(step);
        position.x += (dx / distance) * travel;
        position.z += (dz / distance) * travel;
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }

    position.y = 0;
  }
}

export function getEnemies() {
  return enemies;
}

export function clearEnemies() {
  for (const enemy of enemies) {
    if (enemy.mesh.parent) enemy.mesh.parent.remove(enemy.mesh);
  }
  enemies.length = 0;
}
