// level.js — a designed dungeon layout inspired by Map_Base.png.
// No image is copied; the layout is rebuilt from simple shapes.
import * as THREE from 'three';
import {
  arenaSize, wallHeight, columnRadius, columnCount, columnMinDistanceFromPlayer,
  internalWallCount, internalWallLength, internalWallThickness, floorWallMargin,
} from './tuning.js?v=1';

const STONE_COLOR = '#3a3a3a';

function createStoneTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#2a2a2a';
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random() < 0.5 ? '#333333' : '#252525';
    c.fillStyle = shade;
    c.fillRect(x, y, 2, 2);
  }
  c.strokeStyle = '#3a3a3a';
  c.lineWidth = 2;
  const blocks = 4;
  const step = size / blocks;
  for (let i = 1; i < blocks; i++) {
    c.beginPath();
    c.moveTo(i * step, 0);
    c.lineTo(i * step, size);
    c.stroke();
    c.beginPath();
    c.moveTo(0, i * step);
    c.lineTo(size, i * step);
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    c.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    c.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      c.lineTo(x, y);
    }
    c.strokeStyle = Math.random() < 0.5 ? '#2a2a2a' : '#707070';
    c.lineWidth = 1;
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStoneBumpMap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#808080';
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 30000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.floor(Math.random() * 60 + 90).toString(16).padStart(2, '0');
    c.fillStyle = `#${v}${v}${v}`;
    c.fillRect(x, y, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const stoneTexture = createStoneTexture();
const stoneBump = createStoneBumpMap();

function wallMaterialFor(texture, bump, w, d) {
  const t = texture.clone();
  t.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(d / 8)));
  const b = bump.clone();
  b.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(d / 8)));
  return new THREE.MeshStandardMaterial({
    map: t,
    bumpMap: b,
    bumpScale: 0.05,
    roughness: 0.92,
    color: STONE_COLOR,
  });
}

function addWall(scene, walls, wallMeshes, x, z, w, d, h = wallHeight, texture, bump) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMaterialFor(texture, bump, w, d));
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  walls.push({ x, z, halfW: w / 2, halfD: d / 2 });
  wallMeshes.push(mesh);
  return mesh;
}

function addCrenellations(scene, x, z, w, d, texture, bump) {
  // Small square blocks along the top outer edge of a perimeter wall.
  const size = 1.2;
  const gap = 2.4;
  const h = 0.8;
  const mat = wallMaterialFor(texture, bump, size, size);
  const isHorizontal = w > d;
  const length = isHorizontal ? w : d;
  const steps = Math.floor(length / gap);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps - 0.5) * length;
    const mx = isHorizontal ? x + t : x + (w > 0 ? w / 2 - size / 2 : 0);
    const mz = isHorizontal ? z + (d > 0 ? d / 2 - size / 2 : 0) : z + t;
    const block = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), mat);
    block.position.set(mx, wallHeight + h / 2, mz);
    scene.add(block);
  }
}

function addArch(scene, x, z, w, d, rotationY, texture, bump) {
  // A simple frame of two pillars and a lintel.
  const thickness = 1.2;
  const opening = 4;
  const depth = Math.max(w, d);
  const lintelH = 1.2;
  const pillarW = (depth - opening) / 2;
  const mat = wallMaterialFor(texture, bump, thickness, pillarW);
  const left = new THREE.Mesh(new THREE.BoxGeometry(thickness, wallHeight - 1, pillarW), mat);
  const right = new THREE.Mesh(new THREE.BoxGeometry(thickness, wallHeight - 1, pillarW), mat);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(thickness, lintelH, depth), mat);
  left.position.set(-(opening + pillarW) / 2, (wallHeight - 1) / 2, 0);
  right.position.set((opening + pillarW) / 2, (wallHeight - 1) / 2, 0);
  lintel.position.set(0, wallHeight - lintelH / 2, 0);
  const group = new THREE.Group();
  group.add(left, right, lintel);
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;
  scene.add(group);
}

function addPillar(scene, columns, x, z, texture, bump) {
  const h = 4;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(columnRadius * 0.75, columnRadius * 0.8, h, 12),
    wallMaterialFor(texture, bump, columnRadius * 2, h)
  );
  shaft.position.y = h / 2;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(columnRadius * 1.1, columnRadius * 1.2, 0.3, 12),
    wallMaterialFor(texture, bump, columnRadius * 2.4, 0.3)
  );
  base.position.y = 0.15;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(columnRadius * 1.1, columnRadius * 0.85, 0.3, 12),
    wallMaterialFor(texture, bump, columnRadius * 2.2, 0.3)
  );
  cap.position.y = h - 0.15;
  const group = new THREE.Group();
  group.add(shaft, base, cap);
  group.position.set(x, 0, z);
  scene.add(group);
  columns.push(group);
}

const MAX_DYNAMIC_TORCHES = 8;
let dynamicTorchCount = 0;
let lightPositions = [];

function addTorch(scene, x, z, y = 3.2, lit = true) {
  // Only the first few torches cast real point light; the rest are emissive fakes.
  lightPositions.push({ x, z });
  if (lit && dynamicTorchCount < MAX_DYNAMIC_TORCHES) {
    const light = new THREE.PointLight('#ffaa44', 5, 18);
    light.position.set(x, y, z);
    scene.add(light);
    dynamicTorchCount += 1;
  }
  // Small emissive fixture mesh.
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.6, 0.3),
    new THREE.MeshBasicMaterial({ color: '#ffaa44' })
  );
  fixture.position.set(x, y, z);
  scene.add(fixture);
}

function addCandle(scene, x, z) {
  // Small static candle: emissive flame, no dynamic light (baked look, cheap).
  lightPositions.push({ x, z });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 })
  );
  base.position.set(x, 0.175, z);

  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#ffaa44' })
  );
  flame.position.set(x, 0.48, z);

  scene.add(base, flame);
}

export function createLightmapTexture(positions) {
  // Procedural lightmap baked from torch/candle positions.
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#7f7f7f';
  c.fillRect(0, 0, size, size);

  for (const pos of positions) {
    const u = (pos.x + arenaSize) / (arenaSize * 2);
    const v = 1 - (pos.z + arenaSize) / (arenaSize * 2);
    const cx = u * size;
    const cy = v * size;
    const g = c.createRadialGradient(cx, cy, 2, cx, cy, 140);
    g.addColorStop(0, 'rgba(255, 170, 68, 0.45)');
    g.addColorStop(0.55, 'rgba(255, 170, 68, 0.08)');
    g.addColorStop(1, 'rgba(255, 170, 68, 0)');
    c.fillStyle = g;
    c.fillRect(cx - 140, cy - 140, 280, 280);
  }

  // Vignette darkening near the outer walls.
  const vignette = c.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.85);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  c.fillStyle = vignette;
  c.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCentralDisc(scene, radius = 10) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  const cx = size / 2;
  // Cobalt pool with mosaic border.
  c.fillStyle = '#0d0d0d';
  c.fillRect(0, 0, size, size);
  c.beginPath();
  c.arc(cx, cx, cx - 8, 0, Math.PI * 2);
  c.fillStyle = '#15202e';
  c.fill();
  c.lineWidth = 12;
  c.strokeStyle = '#3a3a3a';
  c.stroke();
  // decorative rings
  for (let r = cx * 0.25; r < cx - 20; r += 30) {
    c.beginPath();
    c.arc(cx, cx, r, 0, Math.PI * 2);
    c.strokeStyle = `rgba(200,200,200,${0.1 + r / size})`;
    c.lineWidth = 2;
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, transparent: true, opacity: 0.9 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  scene.add(mesh);
}

function seededRandom(seed) {
  // Simple LCG so each floor number produces the same layout every run.
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rectRectOverlap(ax, az, aw, ad, bx, bz, bw, bd, gap = 0) {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 + gap &&
    Math.abs(az - bz) < (ad + bd) / 2 + gap
  );
}

function rectCircleDistance(rx, rz, rw, rd, cx, cz) {
  // Distance from circle centre to the closest point inside the rectangle.
  const dx = Math.max(Math.abs(cx - rx) - rw / 2, 0);
  const dz = Math.max(Math.abs(cz - rz) - rd / 2, 0);
  return Math.hypot(dx, dz);
}

export function buildMap(scene, floor = 1) {
  dynamicTorchCount = 0;
  lightPositions = [];
  const walls = [];
  const wallMeshes = [];
  const columns = [];

  const half = arenaSize;
  const thickness = 2.2;
  const rng = seededRandom(floor * 12345 + 6789);

  // --- Perimeter walls with crenellations ------------------------------------
  const outerLong = half * 2 + thickness;
  addWall(scene, walls, wallMeshes, 0, -half - thickness / 2, outerLong, thickness, wallHeight, stoneTexture, stoneBump);
  addWall(scene, walls, wallMeshes, 0, half + thickness / 2, outerLong, thickness, wallHeight, stoneTexture, stoneBump);
  addWall(scene, walls, wallMeshes, -half - thickness / 2, 0, thickness, outerLong, wallHeight, stoneTexture, stoneBump);
  addWall(scene, walls, wallMeshes, half + thickness / 2, 0, thickness, outerLong, wallHeight, stoneTexture, stoneBump);
  addCrenellations(scene, 0, -half - thickness / 2, outerLong, thickness, stoneTexture, stoneBump);
  addCrenellations(scene, 0, half + thickness / 2, outerLong, thickness, stoneTexture, stoneBump);
  addCrenellations(scene, -half - thickness / 2, 0, thickness, outerLong, stoneTexture, stoneBump);
  addCrenellations(scene, half + thickness / 2, 0, thickness, outerLong, stoneTexture, stoneBump);

  // --- Perimeter lighting (corners + midpoints) -------------------------------
  // Corner fixtures are emissive only; midpoints get real point lights.
  addTorch(scene, half, half, 3.5, false);
  addTorch(scene, -half, half, 3.5, false);
  addTorch(scene, half, -half, 3.5, false);
  addTorch(scene, -half, -half, 3.5, false);
  addTorch(scene, 0, -half, 3.5, true);
  addTorch(scene, 0, half, 3.5, true);
  addTorch(scene, -half, 0, 3.5, true);
  addTorch(scene, half, 0, 3.5, true);

  // --- Perimeter candles (baked/emissive, no dynamic light) -------------------
  const candleInset = half - 1.2;
  const candleSpacing = half / 2.5; // about 16 units apart
  for (let t = -candleSpacing; t <= candleSpacing; t += candleSpacing) {
    addCandle(scene, t, candleInset);
    addCandle(scene, t, -candleInset);
    addCandle(scene, candleInset, t);
    addCandle(scene, -candleInset, t);
  }

  // --- Central safe disc ------------------------------------------------------
  const centralR = 8 + rng() * 6;
  createCentralDisc(scene, centralR);
  addTorch(scene, 0, 0, 1.5);

  // Ring of candles around the central safe zone.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    addCandle(scene, Math.cos(angle) * (centralR + 2), Math.sin(angle) * (centralR + 2));
  }

  // --- Procedural internal walls ----------------------------------------------
  const margin = floorWallMargin;
  const safeR = columnMinDistanceFromPlayer;
  const minGap = 4;
  const wallCount = Math.max(2, internalWallCount + Math.floor((floor - 1) / 2));

  for (let i = 0; i < wallCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const horizontal = rng() < 0.5;
      const len = 6 + rng() * (internalWallLength - 6);
      const w = horizontal ? len : internalWallThickness;
      const d = horizontal ? internalWallThickness : len;
      const x = (rng() * 2 - 1) * (half - margin - Math.max(w, d) / 2);
      const z = (rng() * 2 - 1) * (half - margin - Math.max(w, d) / 2);

      // Keep the player spawn and a ring around it completely open.
      if (rectCircleDistance(x, z, w, d, 0, 0) < safeR) continue;

      // Keep walls away from each other and from the perimeter (perimeter is outside margin, so this is automatic).
      let overlap = false;
      for (const wall of walls) {
        if (rectRectOverlap(x, z, w, d, wall.x, wall.z, wall.halfW * 2, wall.halfD * 2, minGap)) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      addWall(scene, walls, wallMeshes, x, z, w, d, wallHeight, stoneTexture, stoneBump);
      addTorch(scene, x, z, 3.0, false);
      placed = true;
    }
  }

  // --- Procedural columns/pillars ---------------------------------------------
  const colCount = Math.min(20, columnCount + Math.floor((floor - 1) / 2));
  for (let i = 0; i < colCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const x = (rng() * 2 - 1) * (half - margin - columnRadius);
      const z = (rng() * 2 - 1) * (half - margin - columnRadius);

      if (Math.hypot(x, z) < safeR + columnRadius) continue;

      let tooClose = false;
      for (const wall of walls) {
        if (rectCircleDistance(wall.x, wall.z, wall.halfW * 2, wall.halfD * 2, x, z) < columnRadius + minGap) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      for (const col of columns) {
        const dx = col.position.x - x;
        const dz = col.position.z - z;
        if (Math.hypot(dx, dz) < columnRadius * 2 + minGap) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      addPillar(scene, columns, x, z, stoneTexture, stoneBump);
      if (i % 3 === 0) addTorch(scene, x, z, 3.2, false);
      placed = true;
    }
  }

  return { walls, wallMeshes, columns, lightPositions };
}
