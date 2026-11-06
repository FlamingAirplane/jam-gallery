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
  healerSpeed, healerPreferredRange, healerRangeTolerance,
  healerHealRange, healerHealAmount, healerHealRate,
  brawlerModelScale, archerModelScale, mageModelScale, healerModelScale,
  leaderAuraRadius, leaderSpeedMul, heroHpMul, heroSpeedMul, cowardFleeHpRatio,
  burnDamagePerSecond, burnDuration,
  earthSlowMul, earthSlowDuration,
} from './tuning.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BRAWLER_COLOR = '#4a4a4a';
const ARCHER_COLOR = '#6a5a4a';
const MAGE_COLOR = '#8e44ad';
const HEALER_COLOR = '#2ecc71';
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
let healerGeometry = null;
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

function pickHealerTemplate() {
  return enemyTemplates.water;
}

function pickRole() {
  const roll = Math.random();
  let sum = 0;
  for (const [key, weight] of Object.entries(enemyRoleWeights)) {
    sum += weight;
    if (roll < sum) return key;
  }
  return 'brawler';
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

function getHealerGeometry() {
  if (!healerGeometry) {
    // A floating orb for healers.
    healerGeometry = new THREE.IcosahedronGeometry(enemyRadius * 0.8, 1);
    healerGeometry.translate(0, enemyRadius * 1.4, 0);
  }
  return healerGeometry;
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
  } else if (chosenRole === 'healer') {
    const tmpl = pickHealerTemplate();
    if (tmpl) {
      mesh = tmpl.scene.clone();
      mesh.scale.setScalar(healerModelScale);
    } else {
      mesh = new THREE.Mesh(getHealerGeometry(), new THREE.MeshStandardMaterial({ color: HEALER_COLOR, roughness: 0.6, metalness: 0.2, flatShading: true }));
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
    healTimer: Math.random() * (1 / healerHealRate),
    burnTimer: 0,
    slowTimer: 0,
    scatterTimer: 0,
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
  const alive = (e) => e.alive !== false;

  // Drop the ones killed last frame first, in place.
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].alive) continue;
    const mesh = enemies[i].mesh;
    if (mesh.parent) mesh.parent.remove(mesh);
    enemies.splice(i, 1);
  }

  // Pre-compute leader positions for the aura and personality behaviours.
  const leaderPositions = enemies
    .filter((e) => e.personality === 'leader' && e.alive)
    .map((e) => e.mesh.position);
  const anyLeaderAlive = leaderPositions.length > 0;
  const burnKills = [];

  function nearestLeader(pos) {
    let best = null;
    let bestD = Infinity;
    for (const lp of leaderPositions) {
      const d = pos.distanceTo(lp);
      if (d < bestD) { bestD = d; best = lp; }
    }
    return best;
  }
  function nearestAlly(enemy, maxDist, filterFn = null) {
    let best = null;
    let bestD = maxDist;
    for (const other of enemies) {
      if (other === enemy || !alive(other)) continue;
      if (filterFn && !filterFn(other)) continue;
      const d = enemy.mesh.position.distanceTo(other.mesh.position);
      if (d < bestD) { bestD = d; best = other; }
    }
    return best;
  }
  function nearestDamagedAlly(enemy, maxDist) {
    return nearestAlly(enemy, maxDist, (o) => o.hp < o.maxHp);
  }

  for (const enemy of enemies) {
    const position = enemy.mesh.position;
    const dx = targetPos.x - position.x;
    const dz = targetPos.z - position.z;
    const distance = Math.hypot(dx, dz);

    // Status effects.
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt;
      enemy.hp -= burnDamagePerSecond * dt;
      if (enemy.healthBar) enemy.healthBar.setHp(enemy.hp, enemy.maxHp);
      if (enemy.hp <= 0) {
        enemy.alive = false;
        burnKills.push(enemy);
        continue;
      }
    }
    if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
    if (enemy.scatterTimer > 0) enemy.scatterTimer -= dt;

    // Personality speed modifiers.
    let speedMul = enemy.personality === 'hero' ? heroSpeedMul : 1;
    if (enemy.slowTimer > 0) speedMul *= earthSlowMul;
    for (const lp of leaderPositions) {
      if (lp === position) continue;
      if (position.distanceTo(lp) < leaderAuraRadius) {
        speedMul *= leaderSpeedMul;
        break;
      }
    }

    // Cowards run away when badly hurt or try to hide behind an ally.
    const nearestAnyAlly = nearestAlly(enemy, 15);
    const cowardHiding = enemy.personality === 'coward' && distance < 20 && nearestAnyAlly;
    const fleeing = enemy.personality === 'coward' && enemy.hp / enemy.maxHp < cowardFleeHpRatio && distance < 30;
    const scattering = enemy.personality === 'grunt' && !anyLeaderAlive && enemy.scatterTimer <= 0;
    if (scattering) enemy.scatterTimer = 2;

    if (enemy.role === 'archer' || enemy.role === 'mage' || enemy.role === 'healer') {
      const isMage = enemy.role === 'mage';
      const isHealer = enemy.role === 'healer';
      const prefRange = isHealer ? healerPreferredRange : (isMage ? magePreferredRange : archerPreferredRange);
      const rangeTol = isHealer ? healerRangeTolerance : (isMage ? mageRangeTolerance : archerRangeTolerance);
      const moveSpeed = (isHealer ? healerSpeed : (isMage ? mageSpeed : archerSpeed)) * speedMul;
      const fireRate = isMage ? mageFireRate : archerFireRate;

      let moveDirX = 0;
      let moveDirZ = 0;
      if (fleeing || (enemy.scatterTimer > 0)) {
        moveDirX = -dx / distance;
        moveDirZ = -dz / distance;
      } else if (cowardHiding) {
        const ap = nearestAnyAlly.mesh.position;
        moveDirX = ap.x - position.x;
        moveDirZ = ap.z - position.z;
        const len = Math.hypot(moveDirX, moveDirZ);
        if (len > 0.01) { moveDirX /= len; moveDirZ /= len; }
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

      if (isHealer) {
        // Heal the nearest damaged ally.
        enemy.healTimer -= dt;
        if (!fleeing && !cowardHiding && enemy.scatterTimer <= 0 && enemy.healTimer <= 0) {
          const patient = nearestDamagedAlly(enemy, healerHealRange);
          if (patient) {
            patient.hp = Math.min(patient.maxHp, patient.hp + healerHealAmount);
            if (patient.healthBar) patient.healthBar.setHp(patient.hp, patient.maxHp);
            enemy.healTimer = 1 / healerHealRate + Math.random() * 0.2;
            const ddx = patient.mesh.position.x - position.x;
            const ddz = patient.mesh.position.z - position.z;
            enemy.mesh.rotation.y = Math.atan2(ddx, ddz);
          }
        }
      } else {
        // Fire when roughly in range and not fleeing/scattering/hiding.
        enemy.fireTimer -= dt;
        if (!fleeing && !cowardHiding && enemy.scatterTimer <= 0 && enemy.fireTimer <= 0 && distance < prefRange + rangeTol * 2 && distance > 1) {
          const origin = position.clone().add(new THREE.Vector3(0, enemyRadius, 0));
          const dir = new THREE.Vector3(dx / distance, 0, dz / distance);
          if (isMage) {
            spawnMageProjectile(origin, dir);
          } else {
            spawnEnemyProjectile(origin, dir);
          }
          enemy.fireTimer = 1 / fireRate + Math.random() * 0.2;
        }
      }
    } else {
      // Brawler movement, modified by personality.
      let moveDirX = dx;
      let moveDirZ = dz;
      let isRushing = true;

      if (enemy.personality === 'grunt' && anyLeaderAlive) {
        // Follow the nearest leader.
        const leader = nearestLeader(position);
        if (leader) {
          moveDirX = leader.x - position.x;
          moveDirZ = leader.z - position.z;
        }
      } else if (enemy.personality === 'hero') {
        // Shield the nearest hurt ally by standing between them and the player.
        const protect = nearestAlly(enemy, 20, (o) => o.hp / o.maxHp < 0.5);
        if (protect) {
          const pp = protect.mesh.position;
          const toAlly = new THREE.Vector3(pp.x - targetPos.x, 0, pp.z - targetPos.z).normalize();
          const shieldPos = pp.clone().addScaledVector(toAlly, 2.5);
          moveDirX = shieldPos.x - position.x;
          moveDirZ = shieldPos.z - position.z;
        }
      } else if (fleeing) {
        moveDirX = -dx;
        moveDirZ = -dz;
        isRushing = false;
      } else if (cowardHiding) {
        const ap = nearestAnyAlly.mesh.position;
        moveDirX = ap.x - position.x;
        moveDirZ = ap.z - position.z;
        isRushing = false;
      } else if (enemy.scatterTimer > 0) {
        moveDirX = -dx;
        moveDirZ = -dz;
        isRushing = false;
      }

      const len = Math.hypot(moveDirX, moveDirZ);
      if (len > 0.01) {
        moveDirX /= len;
        moveDirZ /= len;
      }

      let step = enemySpeed * speedMul * dt;
      if (!isRushing) step *= 0.8; // flee/hide/scatter a little slower
      const travel = Math.min(step, len);
      position.x += moveDirX * travel;
      position.z += moveDirZ * travel;
      enemy.mesh.rotation.y = Math.atan2(moveDirX, moveDirZ);
    }

    position.y = 0;
  }

  return burnKills;
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
