#!/usr/bin/env python3
"""Generate a 2048x2048 fireball flipbook sprite sheet (8x8 grid, 64 frames)."""

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
    """Fractal-ish turbulence using stacked sine waves."""
    n = np.zeros_like(r)
    freq_a = 3.0
    freq_r = 6.0
    freq_xy = 0.08
    amp = 1.0
    for i in range(6):
        layer = (
            np.sin(angle * freq_a + t * 1.5 + i * 1.7)
            * np.cos(r * freq_r - t * 2.0 + i * 1.3)
            + np.sin(cx * freq_xy + t * 3.0 + i)
            + np.cos(cy * freq_xy * 1.3 - t * 2.5 + i * 0.9)
        )
        n += amp * layer
        freq_a *= 1.9
        freq_r *= 1.8
        freq_xy *= 1.7
        amp *= 0.5
    # normalize roughly to 0..1
    return (n + 2.0) / 4.0


def make_frame(t):
    y, x = np.indices((CELL, CELL), dtype=np.float32)
    cx = x - (CELL - 1) / 2.0
    cy = y - (CELL - 1) / 2.0
    r = np.hypot(cx, cy) / (CELL / 2.0)
    angle = np.arctan2(cy, cx)

    noise = fbm(cx, cy, r, angle, t)

    # Displace the flame edge outward/inward with turbulence.
    displaced_r = r - (noise - 0.5) * 0.35

    # Core white-hot, then yellow, orange, crimson.
    core = smoothstep(0.32, -0.05, displaced_r)
    hot = smoothstep(0.55, 0.15, displaced_r)
    body = smoothstep(0.92, 0.38, displaced_r)

    # Embers: tiny bright fragments breaking off.
    ember_noise = np.sin(cx * 0.25 + t * 6.0) * np.cos(cy * 0.23 - t * 5.0)
    ember_noise += np.sin(r * 18.0 - angle * 5.0 + t * 8.0)
    embers = (ember_noise > 1.4) & (r > 0.25) & (r < 0.85)

    # Base alpha shaped like a fireball.
    alpha = np.clip(body, 0.0, 1.0)

    # Color channels.
    R = hot * 1.0 + (1.0 - hot) * body * 0.6
    G = core * 1.0 + (hot - core) * 0.75 + (body - hot) * 0.15
    B = core * 0.6 + (hot - core) * 0.1

    # Boost embers to bright yellow-white.
    R = np.where(embers, 1.0, R)
    G = np.where(embers, 0.95, G)
    B = np.where(embers, 0.6, B)
    alpha = np.where(embers, np.maximum(alpha, 0.9), alpha)

    # Fade blue/purple at the very tips for crimson look.
    tip = smoothstep(0.75, 1.0, displaced_r)
    R = R * (1.0 - tip * 0.2) + tip * 0.9
    G = G * (1.0 - tip * 0.5)
    B = B * (1.0 - tip * 0.2) + tip * 0.15

    img = np.zeros((CELL, CELL, 4), dtype=np.uint8)
    img[..., 0] = (np.clip(R * alpha, 0, 1) * 255).astype(np.uint8)
    img[..., 1] = (np.clip(G * alpha, 0, 1) * 255).astype(np.uint8)
    img[..., 2] = (np.clip(B * alpha, 0, 1) * 255).astype(np.uint8)
    # Pure black background for additive blending; intensity lives in RGB.
    img[..., 3] = 255
    return img


def main():
    sheet = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    for f in range(FRAMES):
        t = f / FRAMES * (2.0 * np.pi)
        frame = make_frame(t)
        row = f // GRID
        col = f % GRID
        sheet[row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL] = frame

    Image.fromarray(sheet, 'RGBA').save('assets/fireball_spritesheet.png')
    print('saved assets/fireball_spritesheet.png')


if __name__ == '__main__':
    main()
