#!/usr/bin/env python3
"""Generate a 2048x2048 water-orb flipbook sprite sheet (8x8 grid, 64 frames)."""

import numpy as np
from PIL import Image

CELL = 256
GRID = 8
FRAMES = GRID * GRID
SIZE = CELL * GRID


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0 + 1e-8), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def fbm(cx, cy, r, angle, t):
    """Fractal turbulence for swirling water."""
    n = np.zeros_like(r)
    freq_a = 2.5
    freq_r = 5.0
    freq_xy = 0.07
    amp = 1.0
    for i in range(6):
        layer = (
            np.sin(angle * freq_a + t * 1.2 + i * 1.4)
            * np.cos(r * freq_r - t * 1.8 + i * 1.1)
            + np.sin(cx * freq_xy + t * 2.5 + i * 0.7)
            + np.cos(cy * freq_xy * 1.2 - t * 2.0 + i * 0.5)
        )
        n += amp * layer
        freq_a *= 1.9
        freq_r *= 1.8
        freq_xy *= 1.7
        amp *= 0.5
    return (n + 2.0) / 4.0


def make_frame(t):
    y, x = np.indices((CELL, CELL), dtype=np.float32)
    cx = x - (CELL - 1) / 2.0
    cy = y - (CELL - 1) / 2.0
    r = np.hypot(cx, cy) / (CELL / 2.0)
    angle = np.arctan2(cy, cx)

    noise = fbm(cx, cy, r, angle, t)

    # Swirl the water surface inward/outward.
    swirl = noise * 0.28
    displaced_r = r - swirl

    # Soft orb body.
    body = smoothstep(0.95, 0.25, displaced_r)
    inner = smoothstep(0.75, 0.0, displaced_r)

    # Caustic bright highlights / foam.
    caustic = (
        np.sin(angle * 7.0 + t * 3.0 + noise * 5.0)
        * np.cos(r * 20.0 - t * 4.0 + noise * 4.0)
    )
    caustic = (caustic + 1.0) / 2.0
    foam_mask = (caustic > 0.72) & (displaced_r < 0.82)

    # Droplets spinning off the orb edge.
    droplets = np.zeros_like(r, dtype=bool)
    droplet_count = 12
    rng = np.random.default_rng(int(t * 1000) % 2**31)
    for i in range(droplet_count):
        theta = (i / droplet_count) * 2.0 * np.pi + t * 1.5 + i * 0.9
        dist = 0.82 + 0.12 * np.sin(t * 3.0 + i * 2.1)
        dx = cx - np.cos(theta) * dist * (CELL / 2.0)
        dy = cy - np.sin(theta) * dist * (CELL / 2.0)
        droplet_r = 4.0 + 3.0 * np.sin(i * 1.3 + t * 4.0)**2
        droplets |= (dx * dx + dy * dy) < (droplet_r * droplet_r)

    # Base colors: deep blue to turquoise.
    R = inner * 0.05 + (body - inner) * 0.1
    G = inner * 0.25 + (body - inner) * 0.55
    B = inner * 0.65 + (body - inner) * 0.85

    # Add churn variation.
    churn = noise * 0.12
    G += churn
    B += churn * 0.6

    # Foam / highlights: bright white-cyan.
    R = np.where(foam_mask, R + 0.45, R)
    G = np.where(foam_mask, G + 0.55, G)
    B = np.where(foam_mask, B + 0.6, B)

    # Droplets: bright turquoise.
    R = np.where(droplets, 0.7, R)
    G = np.where(droplets, 0.95, G)
    B = np.where(droplets, 1.0, B)

    # Alpha follows the orb body plus droplets.
    alpha = np.clip(body, 0.0, 1.0)
    alpha = np.where(droplets, np.maximum(alpha, 0.85), alpha)

    # Soft caustic rim light on the upper-left quadrant.
    rim = smoothstep(0.85, 0.35, displaced_r) * smoothstep(0.0, 0.7, (cx - cy) / (CELL / 2.0) + 1.0) * 0.25
    G += rim
    B += rim * 1.2

    img = np.zeros((CELL, CELL, 4), dtype=np.uint8)
    img[..., 0] = (np.clip(R * alpha, 0, 1) * 255).astype(np.uint8)
    img[..., 1] = (np.clip(G * alpha, 0, 1) * 255).astype(np.uint8)
    img[..., 2] = (np.clip(B * alpha, 0, 1) * 255).astype(np.uint8)
    img[..., 3] = (alpha * 255).astype(np.uint8)
    return img


def main():
    sheet = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    for f in range(FRAMES):
        t = f / FRAMES * (2.0 * np.pi)
        frame = make_frame(t)
        row = f // GRID
        col = f % GRID
        sheet[row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL] = frame

    Image.fromarray(sheet, 'RGBA').save('assets/water_orb_spritesheet.png')
    print('saved assets/water_orb_spritesheet.png')


if __name__ == '__main__':
    main()
