// items.js — temporary buff pickups dropped by enemies.
import * as THREE from 'three';

const items = [];

// Shared geometry and per-type materials so pickups don't allocate on every drop.
const itemGeometry = new THREE.OctahedronGeometry(0.45, 0);
const ringGeometry = new THREE.RingGeometry(0.35, 0.5, 16);
const itemMaterials = {};
const ringMaterials = {};
for (const type of ITEM_TYPES) {
  itemMaterials[type.key] = new THREE.MeshStandardMaterial({
    color: type.color,
    emissive: type.color,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.6,
  });
  ringMaterials[type.key] = new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
}

export const ITEM_TYPES = [
  { key: 'damage', label: 'Might', color: '#e74c3c', mul: 1.25 },
  { key: 'speed', label: 'Swiftness', color: '#3498db', mul: 1.25 },
  { key: 'fireRate', label: 'Alacrity', color: '#f1c40f', mul: 1.25 },
  { key: 'heal', label: 'Restoration', color: '#2ecc71', mul: 0 },
];

export function itemTypeFor(key) {
  return ITEM_TYPES.find((t) => t.key === key) ?? ITEM_TYPES[0];
}

function createItemMesh(scene, type, x, z) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(itemGeometry, itemMaterials[type.key]);
  mesh.position.y = 0.7;
  group.add(mesh);

  // Small ground ring.
  const ring = new THREE.Mesh(ringGeometry, ringMaterials[type.key]);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  group.position.set(x, 0, z);
  scene.add(group);
  return { group, mesh, ring };
}

export function spawnItemAt(scene, position, key = null) {
  const pool = key ? [itemTypeFor(key)] : ITEM_TYPES;
  const type = pool[Math.floor(Math.random() * pool.length)];
  const { group, mesh, ring } = createItemMesh(scene, type, position.x, position.z);
  items.push({ mesh: group, visual: mesh, ring, type, alive: true, radius: 0.8 });
  return items[items.length - 1];
}

export function updateItems(dt, playerPos, now = performance.now()) {
  const pickups = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.alive === false) continue;

    // Bob and spin.
    item.visual.rotation.y += dt * 2;
    item.visual.position.y = 0.7 + Math.sin(now * 0.004 + i) * 0.1;

    const dx = playerPos.x - item.mesh.position.x;
    const dz = playerPos.z - item.mesh.position.z;
    if (Math.hypot(dx, dz) < item.radius + 0.5) {
      item.alive = false;
      pickups.push(item.type);
      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
      items.splice(i, 1);
    }
  }
  return pickups;
}

export function clearItems(scene) {
  for (const item of items) {
    if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
  }
  items.length = 0;
}

export function getItems() { return items; }
