// abilities.js — one alternate-fire ability per element: fire grenade, water tidal wave, earth earthquake.
import * as THREE from 'three';
import {
  abilityCooldown,
  fireGrenadeSpeed, fireGrenadeFuse, fireGrenadeBlastRadius, fireGrenadeDamage,
  waterWaveSpeed, waterWaveWidth, waterWaveRange, waterWaveDamage, waterWaveKnockback,
  earthquakeRadius, earthquakeDamage, earthquakeKnockback, earthquakeDuration,
  elementColors,
} from './tuning.js';

const abilities = [];
const cooldowns = { fire: 0, water: 0, earth: 0 };

function alive(e) { return e.alive !== false; }
function distanceXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

function makeGrenadeMesh(element) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10),
    new THREE.MeshStandardMaterial({
      color: elementColors[element],
      emissive: elementColors[element],
      emissiveIntensity: 0.6,
      roughness: 0.4,
    })
  );
  mesh.position.y = 0.6;
  return mesh;
}

function makeWaveMesh(element) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(waterWaveWidth, 0.25, 1),
    new THREE.MeshStandardMaterial({
      color: elementColors[element],
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
    })
  );
  mesh.position.y = 0.15;
  return mesh;
}

function makeQuakeMesh() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1, 64),
    new THREE.MeshStandardMaterial({
      color: elementColors.earth,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.08;
  return mesh;
}

export function triggerAbility(player, scene) {
  const element = player.element;
  if (!element || cooldowns[element] > 0) return null;
  cooldowns[element] = abilityCooldown[element];

  const origin = player.group.position.clone();
  origin.y = 0.6;
  const dir = player.facing.clone();

  if (element === 'fire') {
    const mesh = makeGrenadeMesh(element);
    mesh.position.copy(origin);
    scene.add(mesh);
    abilities.push({
      type: 'grenade',
      element,
      mesh,
      dir,
      fuse: fireGrenadeFuse,
      speed: fireGrenadeSpeed,
      traveled: 0,
    });
  } else if (element === 'water') {
    const mesh = makeWaveMesh(element);
    mesh.position.copy(origin);
    mesh.position.y = 0.15;
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    scene.add(mesh);
    abilities.push({
      type: 'wave',
      element,
      mesh,
      origin: origin.clone(),
      dir,
      traveled: 0,
      damaged: new Set(),
    });
  } else if (element === 'earth') {
    const mesh = makeQuakeMesh();
    mesh.position.copy(origin);
    mesh.position.y = 0.08;
    scene.add(mesh);
    abilities.push({
      type: 'quake',
      element,
      mesh,
      origin: origin.clone(),
      duration: earthquakeDuration,
      elapsed: 0,
      damaged: new Set(),
    });
  }
  return abilities[abilities.length - 1];
}

export function updateAbilities(dt, enemies, scene) {
  for (const key of Object.keys(cooldowns)) {
    cooldowns[key] = Math.max(0, cooldowns[key] - dt);
  }

  const events = [];

  for (let i = abilities.length - 1; i >= 0; i--) {
    const ab = abilities[i];

    if (ab.type === 'grenade') {
      const step = ab.speed * dt;
      ab.mesh.position.addScaledVector(ab.dir, step);
      ab.traveled += step;
      ab.fuse -= dt;

      // Explode on enemy contact or when the fuse runs out.
      let hitEnemy = null;
      for (const enemy of enemies) {
        if (!alive(enemy)) continue;
        if (distanceXZ(ab.mesh.position, enemy.mesh.position) < 0.8 + enemy.radius) {
          hitEnemy = enemy;
          break;
        }
      }

      if (hitEnemy || ab.fuse <= 0) {
        const center = ab.mesh.position.clone();
        events.push({ type: 'burst', position: center.clone(), color: elementColors[ab.element] });
        events.push({ type: 'shake', amount: 0.6 });
        for (const enemy of enemies) {
          if (!alive(enemy)) continue;
          const d = distanceXZ(center, enemy.mesh.position);
          if (d < fireGrenadeBlastRadius) {
            const pushDir = d > 0.01
              ? new THREE.Vector3(enemy.mesh.position.x - center.x, 0, enemy.mesh.position.z - center.z).normalize()
              : new THREE.Vector3(1, 0, 0);
            events.push({ type: 'damage', enemy, damage: fireGrenadeDamage, applyBurn: true });
            events.push({ type: 'knockback', enemy, dir: pushDir, amount: 9 });
          }
        }
        cleanupAbility(i, scene);
        continue;
      }

      if (ab.traveled > 60) cleanupAbility(i, scene);
    }

    if (ab.type === 'wave') {
      const step = waterWaveSpeed * dt;
      ab.traveled += step;
      // The wave is a wide box stretching from the cast point to the leading edge.
      ab.mesh.position.copy(ab.origin).addScaledVector(ab.dir, ab.traveled / 2);
      ab.mesh.scale.z = Math.max(1, ab.traveled);

      // Damage enemies inside the wave front.
      const waveFront = ab.origin.clone().addScaledVector(ab.dir, ab.traveled);
      const halfWidth = waterWaveWidth / 2;
      for (const enemy of enemies) {
        if (!alive(enemy) || ab.damaged.has(enemy)) continue;
        const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, ab.origin);
        const along = toEnemy.dot(ab.dir);
        const perp = Math.sqrt(Math.max(0, toEnemy.lengthSq() - along * along));
        if (along >= 0 && along <= ab.traveled && perp < halfWidth + enemy.radius) {
          ab.damaged.add(enemy);
          events.push({ type: 'damage', enemy, damage: waterWaveDamage });
          events.push({ type: 'knockback', enemy, dir: ab.dir.clone(), amount: waterWaveKnockback });
        }
      }

      if (ab.traveled >= waterWaveRange) cleanupAbility(i, scene);
    }

    if (ab.type === 'quake') {
      ab.elapsed += dt;
      const t = Math.min(1, ab.elapsed / ab.duration);
      const currentRadius = earthquakeRadius * t;
      const inner = Math.max(0.2, currentRadius - 1.5);
      ab.mesh.geometry.dispose();
      ab.mesh.geometry = new THREE.RingGeometry(inner, currentRadius, 64);

      for (const enemy of enemies) {
        if (!alive(enemy) || ab.damaged.has(enemy)) continue;
        const d = distanceXZ(ab.origin, enemy.mesh.position);
        if (d <= currentRadius) {
          ab.damaged.add(enemy);
          const pushDir = d > 0.01
            ? new THREE.Vector3(enemy.mesh.position.x - ab.origin.x, 0, enemy.mesh.position.z - ab.origin.z).normalize()
            : new THREE.Vector3(1, 0, 0);
          events.push({ type: 'damage', enemy, damage: earthquakeDamage, applySlow: true });
          events.push({ type: 'knockback', enemy, dir: pushDir, amount: earthquakeKnockback });
        }
      }

      if (ab.elapsed >= ab.duration) cleanupAbility(i, scene);
    }
  }

  return events;
}

function cleanupAbility(index, scene) {
  const ab = abilities[index];
  if (ab.mesh.parent) ab.mesh.parent.remove(ab.mesh);
  if (ab.mesh.geometry) ab.mesh.geometry.dispose();
  if (ab.mesh.material) ab.mesh.material.dispose();
  abilities.splice(index, 1);
}

export function clearAbilities(scene) {
  for (const ab of abilities) {
    if (ab.mesh.parent) ab.mesh.parent.remove(ab.mesh);
    if (ab.mesh.geometry) ab.mesh.geometry.dispose();
    if (ab.mesh.material) ab.mesh.material.dispose();
  }
  abilities.length = 0;
  cooldowns.fire = 0;
  cooldowns.water = 0;
  cooldowns.earth = 0;
}

export function getCooldowns() {
  return { ...cooldowns };
}
