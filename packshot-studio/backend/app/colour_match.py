"""Match the colours of a panel to reference colours (e.g. the brand's digital RGB colours).

Used when a print file (CMYK) has to look like an approved RGB reference: a few anchor
colours are given as pairs (colour in the panel -> colour in the reference). The shift is
interpolated smoothly in CIELAB between the anchors, so anti-aliased edges and halftone dots
follow their ink. Neutrals (white, greys, black) are pinned and never change. Only colour
values change: every pixel stays where it is, so text, logos and positions are untouched.
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy.interpolate import RegularGridInterpolator
from skimage.color import lab2rgb, rgb2lab

GRID = 33
SIGMA = 18.0  # ΔE reach of one anchor


def _lab(rgb) -> np.ndarray:
    return rgb2lab(np.asarray(rgb, dtype=float).reshape(-1, 1, 3) / 255.0).reshape(-1, 3)


def build_lut(pairs: list[tuple[tuple[int, int, int], tuple[int, int, int]]]) -> np.ndarray:
    """33³ RGB lookup table implementing the anchor mapping."""
    src = _lab([p[0] for p in pairs])
    dst = _lab([p[1] for p in pairs])
    neutrals = _lab([(v, v, v) for v in range(0, 256, 17)])
    anchors = np.vstack([src, neutrals])
    deltas = np.vstack([dst - src, np.zeros_like(neutrals)])

    def phi(r):
        return np.exp(-(r / SIGMA) ** 2)

    A = phi(np.linalg.norm(anchors[:, None] - anchors[None], axis=-1)) + 1e-6 * np.eye(len(anchors))
    W = np.linalg.solve(A, deltas)

    g = np.linspace(0, 255, GRID)
    rr, gg, bb = np.meshgrid(g, g, g, indexing="ij")
    grid = np.stack([rr, gg, bb], -1).reshape(-1, 3)
    lab = _lab(grid)
    shift = phi(np.linalg.norm(lab[:, None] - anchors[None], axis=-1)) @ W
    out = lab2rgb((lab + shift).reshape(-1, 1, 3)).reshape(-1, 3) * 255.0
    return np.clip(out, 0, 255).reshape(GRID, GRID, GRID, 3)


def apply(img: Image.Image, lut: np.ndarray) -> Image.Image:
    g = np.linspace(0, 255, GRID)
    f = RegularGridInterpolator((g, g, g), lut, method="linear")
    a = np.asarray(img.convert("RGB"), dtype=float)
    h, w = a.shape[:2]
    out = np.empty_like(a)
    flat = a.reshape(-1, 3)
    res = out.reshape(-1, 3)
    for i in range(0, len(flat), 2_000_000):
        res[i:i + 2_000_000] = f(flat[i:i + 2_000_000])
    return Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8))
