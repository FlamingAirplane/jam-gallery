// level.js — a designed dungeon layout inspired by Map_Base.png.
// No image is copied; the layout is rebuilt from simple shapes.
import * as THREE from 'three';
import { arenaSize, wallHeight, wallThickness, columnRadius } from './tuning.js';

const STONE_COLOR = '#8e8e8e';

function createStoneTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#5c5c5c';
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random() < 0.5 ? '#666666' : '#525252';
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

function addTorch(scene, x, z, y = 3.2) {
  const light = new THREE.PointLight('#ffaa44', 4, 18);
  light.position.set(x, y, z);
  scene.add(light);
  // Small emissive fixture mesh.
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.6, 0.3),
    new THREE.MeshBasicMaterial({ color: '#ffaa44' })
  );
  fixture.position.set(x, y, z);
  scene.add(fixture);
}

function createCentralDisc(scene) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  const cx = size / 2;
  // Cobalt pool with mosaic border.
  c.fillStyle = '#1a2332';
  c.fillRect(0, 0, size, size);
  c.beginPath();
  c.arc(cx, cx, cx - 8, 0, Math.PI * 2);
  c.fillStyle = '#2a4d6e';
  c.fill();
  c.lineWidth = 12;
  c.strokeStyle = '#8c8c8c';
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
    new THREE.CircleGeometry(10, 48),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, transparent: true, opacity: 0.9 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  scene.add(mesh);
}

export function buildMap(scene) {
  const walls = [];
  const wallMeshes = [];
  const columns = [];

  const half = arenaSize;
  const wallH = wallHeight;
  const thickness = 2.2;
  const roomCenter = 28;
  const roomSize = 18; // outer half-size
  const corridorW = 8;
  const centralR = 10;

  // --- Perimeter walls with crenellations ------------------------------------
  const perimeterH = wallH;
  const outerLong = half * 2 + thickness;
  addWall(scene, walls, wallMeshes, 0, -half - thickness / 2, outerLong, thickness, perimeterH, stoneTexture, stoneBump);
  addWall(scene, walls, wallMeshes, 0, half + thickness / 2, outerLong, thickness, perimeterH, stoneTexture, stoneBump);
  addWall(scene, walls, wallMeshes, -half - thickness / 2, 0, thickness, outerLong, perimeterH, stoneTexture, stoneBump);
  addWall(scene, walls, wallMeshes, half + thickness / 2, 0, thickness, outerLong, perimeterH, stoneTexture, stoneBump);
  addCrenellations(scene, 0, -half - thickness / 2, outerLong, thickness, stoneTexture, stoneBump);
  addCrenellations(scene, 0, half + thickness / 2, outerLong, thickness, stoneTexture, stoneBump);
  addCrenellations(scene, -half - thickness / 2, 0, thickness, outerLong, stoneTexture, stoneBump);
  addCrenellations(scene, half + thickness / 2, 0, thickness, outerLong, stoneTexture, stoneBump);

  // --- Corner rooms ----------------------------------------------------------
  const roomOffsets = [
    { x: roomCenter, z: roomCenter },
    { x: -roomCenter, z: roomCenter },
    { x: roomCenter, z: -roomCenter },
    { x: -roomCenter, z: -roomCenter },
  ];
  for (const off of roomOffsets) {
    const rx = off.x;
    const rz = off.z;
    const sx = Math.sign(rx);
    const sz = Math.sign(rz);
    // Outer walls.
    addWall(scene, walls, wallMeshes, rx + sx * roomSize / 2, rz, thickness, roomSize, wallH, stoneTexture, stoneBump);
    addWall(scene, walls, wallMeshes, rx, rz + sz * roomSize / 2, roomSize, thickness, wallH, stoneTexture, stoneBump);
    // Inner-side walls with doorway gap.
    const doorHalf = corridorW / 2 + thickness;
    const sideLen = (roomSize - corridorW) / 2 - thickness;
    // left of door
    addWall(scene, walls, wallMeshes, rx - sx * (roomSize / 2 - sideLen / 2), rz - sz * (corridorW / 2 + sideLen / 2), sideLen, thickness, wallH, stoneTexture, stoneBump);
    // right of door
    addWall(scene, walls, wallMeshes, rx + sx * (roomSize / 2 - sideLen / 2), rz - sz * (corridorW / 2 + sideLen / 2), sideLen, thickness, wallH, stoneTexture, stoneBump);

    // Corner pillars.
    addPillar(scene, columns, rx + sx * (roomSize / 2 - 1.5), rz + sz * (roomSize / 2 - 1.5), stoneTexture, stoneBump);
    addPillar(scene, columns, rx - sx * (roomSize / 2 - 1.5), rz + sz * (roomSize / 2 - 1.5), stoneTexture, stoneBump);
    addPillar(scene, columns, rx + sx * (roomSize / 2 - 1.5), rz - sz * (roomSize / 2 - 1.5), stoneTexture, stoneBump);

    // Torches inside rooms.
    addTorch(scene, rx - sx * 4, rz - sz * 4, 3);
  }

  // --- Corridors and central chamber -----------------------------------------
  // Four corridor side walls, stopping before the central disc.
  const corridorStart = centralR + thickness / 2;
  const corridorEnd = roomCenter - roomSize / 2 - thickness / 2;
  const corridorLen = corridorEnd - corridorStart;
  const offsets = [
    { x: corridorW / 2 + thickness / 2, z: 0, rot: 0, dx: 0, dz: 1 },
    { x: -(corridorW / 2 + thickness / 2), z: 0, rot: 0, dx: 0, dz: 1 },
    { x: 0, z: corridorW / 2 + thickness / 2, rot: Math.PI / 2, dx: 1, dz: 0 },
    { x: 0, z: -(corridorW / 2 + thickness / 2), rot: Math.PI / 2, dx: 1, dz: 0 },
  ];
  for (const off of offsets) {
    const mid = (corridorStart + corridorEnd) / 2;
    if (off.rot === 0) {
      addWall(scene, walls, wallMeshes, off.x, mid, thickness, corridorLen, wallH, stoneTexture, stoneBump);
    } else {
      addWall(scene, walls, wallMeshes, mid, off.z, corridorLen, thickness, wallH, stoneTexture, stoneBump);
    }
    // Arch at the corridor/central chamber boundary.
    const ax = off.dx * corridorStart + off.x * (1 - Math.abs(off.dx));
    const az = off.dz * corridorStart + off.z * (1 - Math.abs(off.dz));
    addArch(scene, ax, az, corridorW, thickness, off.rot, stoneTexture, stoneBump);
    // Pillars flanking the arch.
    const px = ax + off.dx * 1.5 + (off.dz ? corridorW / 2 : 0) * Math.sign(off.x || off.z);
    // simpler pillar placement along corridor edges
    addPillar(scene, columns, off.x > 0 ? off.x : off.x, off.z > 0 ? corridorStart + 2 : corridorEnd - 2, stoneTexture, stoneBump);
    addPillar(scene, columns, off.x > 0 ? off.x : off.x, off.z < 0 ? -(corridorStart + 2) : corridorEnd - 2, stoneTexture, stoneBump);
  }

  // --- Central disc/fountain --------------------------------------------------
  createCentralDisc(scene);
  addTorch(scene, 0, 0, 1.5);

  // --- Extra pillars around the central chamber -------------------------------
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = centralR + 3.5;
    addPillar(scene, columns, Math.cos(angle) * r, Math.sin(angle) * r, stoneTexture, stoneBump);
  }

  return { walls, wallMeshes, columns };
}
