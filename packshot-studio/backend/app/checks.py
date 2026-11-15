"""Checks on the cropped panels and the artwork. They warn; they never change pixels."""
from __future__ import annotations

import re

import cv2
import numpy as np
from skimage.color import rgb2lab

MAIN_ROLES = ("front", "back", "left", "right", "top", "bottom")


def dieline_colour_from_original(orig_rgb: np.ndarray, segments_px: list[tuple[int, int, int, int]]) -> np.ndarray | None:
    """Median sRGB colour at the midpoints of the dieline segments on the original render."""
    h, w = orig_rgb.shape[:2]
    samples = []
    for x0, y0, x1, y1 in segments_px:
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        if 0 <= cx < w and 0 <= cy < h:
            px = orig_rgb[cy, cx].astype(int)
            if px.sum() < 3 * 245:  # skip anti-aliased misses on white
                samples.append(px)
    if len(samples) < 5:
        return None
    return np.median(np.array(samples), axis=0)


def residue_mask(panel_rgb: np.ndarray, die_rgb: np.ndarray, px_per_mm: float, tol_de: float = 14.0) -> np.ndarray:
    """Pixels of dieline colour that form thin straight lines (not blobs such as a logo)."""
    lab = rgb2lab(panel_rgb[..., :3] / 255.0)
    die_lab = rgb2lab(np.array(die_rgb, dtype=float).reshape(1, 1, 3) / 255.0)[0, 0]
    de = np.linalg.norm(lab - die_lab, axis=-1)
    m = (de < tol_de).astype(np.uint8)
    if not m.any():
        return m.astype(bool)
    L = max(5, int(round(4.0 * px_per_mm)))  # a line is at least 4 mm long
    T = max(3, int(round(0.8 * px_per_mm)))  # and thinner than 0.8 mm
    lines = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((1, L), np.uint8)) | \
        cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((L, 1), np.uint8))
    blobs = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((T, T), np.uint8))
    # thin slivers along the edge of a same-coloured area (a magenta band, a logo) are artwork:
    # ignore everything within ~0.6 mm of such an area
    g = max(3, int(round(0.6 * px_per_mm)) * 2 + 1)
    blobs = cv2.dilate(blobs, np.ones((g, g), np.uint8))
    cand = ((lines > 0) & ~(blobs > 0)).astype(np.uint8)
    # a dieline remnant is a long line (usually a whole panel edge); drop short pieces
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cand, connectivity=8)
    keep = np.zeros(n, bool)
    min_len = 8.0 * px_per_mm
    for i in range(1, n):
        if max(stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]) >= min_len:
            keep[i] = True
    return keep[lab]


def residue_check(panel_rgb, die_rgb, px_per_mm) -> dict:
    if die_rgb is None:
        return {"status": "skipped", "reason": "dieline colour unknown"}
    mask = residue_mask(panel_rgb, die_rgb, px_per_mm)
    n = int(mask.sum())
    limit = max(10, int(1.5 * px_per_mm))  # ignore a few stray anti-aliased pixels
    out = {"status": "fail" if n > limit else "pass", "pixels": n}
    if n > limit:
        ys, xs = np.nonzero(mask)
        out["bbox_px"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    return out


def edge_fill_check(panel_rgb: np.ndarray, px_per_mm: float) -> list[str]:
    """Warn when paper-white shows along an edge while the panel interior is printed."""
    h, w = panel_rgb.shape[:2]
    band = max(2, int(0.6 * px_per_mm))
    inner = max(band + 2, int(3.0 * px_per_mm))
    white = (panel_rgb[..., :3].min(axis=-1) >= 248)
    issues = []
    sides = {
        "left": (white[:, :band], white[:, band:inner]),
        "right": (white[:, w - band:], white[:, w - inner:w - band]),
        "top": (white[:band, :], white[band:inner, :]),
        "bottom": (white[h - band:, :], white[h - inner:h - band, :]),
    }
    for side, (edge, ins) in sides.items():
        e, i = edge.mean(), ins.mean()
        if e > 0.5 and i < 0.3:
            issues.append(f"unprinted (white) strip along the {side} edge: background does not reach the fold line")
    if issues:
        return issues

    # A lighter strip of another colour along an edge (e.g. a neighbouring flap colour that
    # runs over the fold): compare the outer 0.5 mm with the band 2-4 mm inside.
    e_w = max(2, int(0.5 * px_per_mm))
    i0, i1 = int(2.0 * px_per_mm), int(4.0 * px_per_mm)
    if min(h, w) <= 2 * i1:
        return issues
    rgb = panel_rgb[..., :3]
    bands = {
        "left": (rgb[:, :e_w], rgb[:, i0:i1]),
        "right": (rgb[:, w - e_w:], rgb[:, w - i1:w - i0]),
        "top": (rgb[:e_w, :], rgb[i0:i1, :]),
        "bottom": (rgb[h - e_w:, :], rgb[h - i1:h - i0, :]),
    }
    for side, (edge, ins) in bands.items():
        e_lab = rgb2lab(edge.reshape(-1, 1, 3) / 255.0).reshape(-1, 3)
        i_lab = rgb2lab(ins.reshape(-1, 1, 3) / 255.0).reshape(-1, 3)
        e_med, i_med = np.median(e_lab, axis=0), np.median(i_lab, axis=0)
        # both bands mostly one colour (a background), and clearly different from each other
        e_uni = np.mean(np.linalg.norm(e_lab - e_med, axis=1) < 6)
        i_uni = np.mean(np.linalg.norm(i_lab - i_med, axis=1) < 6)
        de = float(np.linalg.norm(e_med - i_med))
        if e_uni > 0.7 and i_uni > 0.6 and de > 10 and e_med[0] > i_med[0]:
            issues.append(f"a lighter strip runs along the {side} edge (ΔE {de:.0f} from the background): "
                          "the background may not reach the fold line")
    return issues


_CAMEL = re.compile(r"[a-zà-ÿ]{3,}[A-ZÀ-Þ][a-zà-ÿ]{2,}")


def text_warnings(lines: list[dict]) -> list[str]:
    out = []
    for t in lines:
        for tok in t["text"].split():
            if _CAMEL.search(tok) or (len(tok) > 28 and tok.isalpha()):
                out.append(f"possible missing word space: “{tok}”")
    return sorted(set(out))


def image_warnings(images: list[dict], faces: dict[str, tuple] | None = None, min_ppi: float = 250.0) -> list[str]:
    """One warning per face for placed images below min_ppi (grouped, not one line per image)."""
    low = [im for im in images if im["ppi"] < min_ppi and (im["bbox"][2] - im["bbox"][0]) > 3]
    if not low:
        return []
    groups: dict[str, list[dict]] = {}
    for im in low:
        x0, y0, x1, y1 = im["bbox"]
        hit = "outside the box faces"
        for role, (a0, b0, a1, b1) in (faces or {}).items():
            if min(x1, a1) - max(x0, a0) > 1 and min(y1, b1) - max(y0, b0) > 1:
                hit = role
                break
        groups.setdefault(hit, []).append(im)
    out = []
    for where, ims in groups.items():
        if where == "outside the box faces":
            continue
        ppis = sorted({round(i["ppi"]) for i in ims})
        rgb = sum(1 for i in ims if "RGB" in (i.get("cs") or ""))
        out.append(f"{where}: {len(ims)} placed image(s) at {', '.join(map(str, ppis))} ppi (below {min_ppi:.0f})"
                   + (f", {rgb} of them RGB (often flattened shadows or glows)" if rgb else "")
                   + " - they may look soft")
    return out
