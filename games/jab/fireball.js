// fireball.js — looping sprite-sheet fireball VFX (8x8 flipbook, 2048px sheet).
import * as THREE from 'three';

const COLS = 8;
const ROWS = 8;
const FRAMES = COLS * ROWS;
const FRAME_TIME = 1 / 18; // seconds per frame

const texture = await new THREE.TextureLoader().loadAsync('assets/fireball_spritesheet.png?v=1');
texture.colorSpace = THREE.SRGBColorSpace;
texture.magFilter = THREE.LinearFilter;
texture.minFilter = THREE.LinearMipMapLinearFilter;
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;

function setFrame(material, frame) {
  const col = frame % COLS;
  const row = Math.floor(frame / COLS);
  material.map.offset.set(col / COLS, 1 - (row + 1) / ROWS);
  material.map.repeat.set(1 / COLS, 1 / ROWS);
}

export function createFireball(scene, scale = 1.2) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  setFrame(material, 0);

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  scene.add(sprite);

  return {
    sprite,
    frame: 0,
    timer: 0,
  };
}

export function updateFireball(fireball, dt) {
  fireball.timer += dt;
  while (fireball.timer >= FRAME_TIME) {
    fireball.timer -= FRAME_TIME;
    fireball.frame = (fireball.frame + 1) % FRAMES;
  }
  setFrame(fireball.sprite.material, fireball.frame);
}

export function removeFireball(fireball) {
  if (fireball.sprite.parent) fireball.sprite.parent.remove(fireball.sprite);
}
