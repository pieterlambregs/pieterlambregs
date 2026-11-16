"""Automatic verification of every render.

1. Unwarp the rendered front face back to flat (homography from the projected face
   corners) and compare it with the source panel:
     - structure: SSIM on luminance, edge agreement (text and line work), residual shift
     - colour: mean CIEDE2000, raw and after removing the smooth lighting gradient
     - brightness: front (and visible side) relative to the file
   The render FAILS when text or positions differ (structure checks).
2. Background: fully transparent apart from a neutral black shadow, nothing outside the
   box silhouette other than shadow.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image
from skimage.color import deltaE_ciede2000, rgb2lab
from skimage.metrics import structural_similarity

THRESHOLDS = {"ssim": 0.80, "edge_f1": 0.80, "shift_px": 1.5, "local_mismatch": 0.35, "delta_e_comp_warn": 3.0, "shadow_rgb_max": 20}
MARGIN = 0.03  # ignore 3 % along each edge of the face (board bevel)


def _srgb_to_lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def unwarp(render_rgba: np.ndarray, corners_px, out_w: int, out_h: int) -> np.ndarray:
    """corners_px: BL, BR, TR, TL of the face in the render."""
    bl, br, tr, tl = corners_px
    src = np.float32([tl, tr, br, bl])
    dst = np.float32([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]])
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(render_rgba, M, (out_w, out_h), flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def _face_size_px(corners_px):
    bl, br, tr, tl = [np.array(c) for c in corners_px]
    w = (np.linalg.norm(br - bl) + np.linalg.norm(tr - tl)) / 2
    h = (np.linalg.norm(tl - bl) + np.linalg.norm(tr - br)) / 2
    return w, h


def _edges(gray):
    g = cv2.GaussianBlur(gray, (3, 3), 0)
    v = np.median(g)
    return cv2.Canny(g, int(max(10, 0.5 * v)), int(min(255, max(40, 1.2 * v)))) > 0


def _edge_f1(a, b, tol=2):
    if a.sum() == 0 and b.sum() == 0:
        return 1.0
    k = np.ones((2 * tol + 1, 2 * tol + 1), np.uint8)
    da = cv2.dilate(a.astype(np.uint8), k) > 0
    db = cv2.dilate(b.astype(np.uint8), k) > 0
    recall = (a & db).sum() / max(1, a.sum())
    precision = (b & da).sum() / max(1, b.sum())
    return float(2 * precision * recall / max(1e-9, precision + recall))


def _strong(gray, edges, thr=60.0):
    """Edges with real contrast (text, line work, logos), not faint halftone or gradients."""
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    return edges & (np.hypot(gx, gy) > thr * 4)


def _local_edge_mismatch(e_s, e_r, size_px, tol=2, s_strong=None, r_strong=None):
    """Largest local disagreement of edges (text strokes, lines) between source and render.

    A global score hides one missing letter; this looks at tiles of ~4 % of the face. Returns
    the worst tile: unmatched edge pixels as a fraction of the tile's edge pixels, plus its box.
    """
    k = np.ones((2 * tol + 1, 2 * tol + 1), np.uint8)
    s_strong = e_s if s_strong is None else s_strong
    r_strong = e_r if r_strong is None else r_strong
    # a strong edge on one side must have some edge nearby on the other side
    miss = (s_strong & ~(cv2.dilate(e_r.astype(np.uint8), k) > 0)) | (r_strong & ~(cv2.dilate(e_s.astype(np.uint8), k) > 0))
    both = s_strong | r_strong
    t = max(12, int(size_px * 0.04))
    h, w = miss.shape
    worst = {"fraction": 0.0, "pixels": 0, "box": None}
    for y in range(0, h, t // 2):
        for x in range(0, w, t // 2):
            m = int(miss[y:y + t, x:x + t].sum())
            n = int(both[y:y + t, x:x + t].sum())
            if m >= max(12, t // 2) and n:
                f = m / n
                if f > worst["fraction"]:
                    worst = {"fraction": round(f, 3), "pixels": m, "box": [x, y, min(w, x + t), min(h, y + t)]}
    return worst


def _mark(heat, local):
    if local.get("box") and local["fraction"] > THRESHOLDS["local_mismatch"]:
        heat = heat.copy()
        x0, y0, x1, y1 = local["box"]
        cv2.rectangle(heat, (x0, y0), (x1 - 1, y1 - 1), (0, 255, 255), 2)
    return heat


def compare_face(render_rgba: np.ndarray, corners_px, source_rgb: np.ndarray) -> dict:
    fw, fh = _face_size_px(corners_px)
    # compare at the render's own resolution of the face (never upsample the render)
    out_w, out_h = max(16, int(round(fw))), max(16, int(round(fh)))
    flat = unwarp(render_rgba, corners_px, out_w, out_h)
    src = cv2.resize(source_rgb[..., :3], (out_w, out_h), interpolation=cv2.INTER_AREA)
    mx, my = int(out_w * MARGIN) + 1, int(out_h * MARGIN) + 1
    r = flat[my:-my, mx:-mx, :3].astype(np.float32) / 255.0
    s = src[my:-my, mx:-mx].astype(np.float32) / 255.0
    alpha = flat[my:-my, mx:-mx, 3] if flat.shape[2] == 4 else np.full(r.shape[:2], 255)
    coverage = float((alpha > 250).mean())

    # brightness relative to the file (encoded sRGB, luminance-weighted)
    wts = np.array([0.2126, 0.7152, 0.0722])
    lum_r, lum_s = (r * wts).sum(-1), (s * wts).sum(-1)
    valid = lum_s > 0.08
    brightness = float(np.median(lum_r[valid] / lum_s[valid])) if valid.any() else None

    # remove the smooth lighting gradient before measuring colour
    lr, ls = _srgb_to_lin(r), _srgb_to_lin(s)
    sig = max(out_w, out_h) * 0.12
    num = cv2.GaussianBlur((lr * wts).sum(-1), (0, 0), sig)
    den = cv2.GaussianBlur((ls * wts).sum(-1), (0, 0), sig)
    gain = np.clip(num / np.maximum(den, 1e-4), 0.05, 4.0)
    r_comp = _lin_to_srgb(lr / gain[..., None])
    de_raw = deltaE_ciede2000(rgb2lab(s), rgb2lab(r))
    de_comp = deltaE_ciede2000(rgb2lab(s), rgb2lab(r_comp))

    # structure: luminance SSIM after gain compensation, edges, residual shift
    g_r = (np.clip(r_comp, 0, 1) * 255).astype(np.uint8)
    g_s = (s * 255).astype(np.uint8)
    gray_r = cv2.cvtColor(g_r, cv2.COLOR_RGB2GRAY)
    gray_s = cv2.cvtColor(g_s, cv2.COLOR_RGB2GRAY)
    ssim = float(structural_similarity(gray_s, gray_r, data_range=255, gaussian_weights=True, sigma=1.5))
    e_s, e_r = _edges(gray_s), _edges(gray_r)
    f1 = _edge_f1(e_s, e_r)
    local = _local_edge_mismatch(e_s, e_r, max(out_w, out_h), s_strong=_strong(gray_s, e_s), r_strong=_strong(gray_r, e_r))
    win = cv2.createHanningWindow(gray_s.shape[::-1], cv2.CV_32F)
    (dx, dy), _resp = cv2.phaseCorrelate(gray_s.astype(np.float32), gray_r.astype(np.float32), win)
    shift = float(np.hypot(dx, dy))

    diff = np.clip(de_comp / 10.0, 0, 1)
    heat = (cv2.applyColorMap((diff * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)[..., ::-1])
    return {
        "size_px": [out_w, out_h],
        "coverage": round(coverage, 4),
        "ssim": round(ssim, 4),
        "edge_f1": round(f1, 4),
        "shift_px": round(shift, 3),
        "delta_e_raw_mean": round(float(de_raw.mean()), 2),
        "delta_e_comp_mean": round(float(de_comp.mean()), 2),
        "delta_e_comp_p95": round(float(np.percentile(de_comp, 95)), 2),
        "brightness_ratio": None if brightness is None else round(brightness, 3),
        "local_mismatch": local,
        "_images": (g_s, (r * 255).astype(np.uint8), _mark(heat, local)),
    }


def _hull_mask(points_px, w, h, grow=2):
    pts = np.array(points_px, dtype=np.float32)
    hull = cv2.convexHull(pts).astype(np.int32)
    m = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(m, hull, 1)
    if grow:
        m = cv2.dilate(m, np.ones((2 * grow + 1, 2 * grow + 1), np.uint8))
    return m.astype(bool)


def background_check(render_rgba: np.ndarray, boxes_meta: list[dict], shadow_enabled: bool) -> dict:
    h, w = render_rgba.shape[:2]
    inside = np.zeros((h, w), bool)
    for b in boxes_meta:
        inside |= _hull_mask(b["points_px"], w, h)
    a = render_rgba[..., 3].astype(int)
    rgb = render_rgba[..., :3].astype(int)
    out = ~inside
    painted = out & (a > 3)
    issues = []
    if not shadow_enabled and painted.sum() > 0:
        issues.append(f"{int(painted.sum())} non-transparent pixels outside the box while the shadow is off")
    # shadow must be neutral black: in straight alpha its colour is (near) black
    heavy = out & (a > 24)
    if heavy.any():
        max_rgb = int(rgb[heavy].max())
        chroma = int((rgb[heavy].max(axis=1) - rgb[heavy].min(axis=1)).max())
        if max_rgb > THRESHOLDS["shadow_rgb_max"] or chroma > 8:
            issues.append(f"shadow is not neutral black (max RGB {max_rgb}, max chroma {chroma})")
    else:
        max_rgb, chroma = 0, 0
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    if border.max() > 0:
        issues.append("the image border is not fully transparent (shadow or box touches the edge)")
    return {
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "outside_painted_px": int(painted.sum()),
        "shadow_max_alpha": int(a[out].max()) if out.any() else 0,
        "shadow_max_rgb": max_rgb,
        "transparent_fraction": round(float((a == 0).mean()), 4),
    }


def verify(render_path, meta: dict, faces_src: dict[str, str], shadow_enabled: bool, report_img_path) -> dict:
    rgba = np.asarray(Image.open(render_path).convert("RGBA"))
    hero = meta["boxes"][0]
    result = {"faces": {}, "checks": [], "thresholds": THRESHOLDS}
    tiles = []
    for name in ("front", "left", "right", "top"):
        f = hero["faces"].get(name)
        if not f or not f["visible"] or name not in faces_src:
            continue
        fw, fh = _face_size_px(f["corners_px"])
        if min(fw, fh) < 40:
            continue
        src = np.asarray(Image.open(faces_src[name]).convert("RGB"))
        c = compare_face(rgba, f["corners_px"], src)
        imgs = c.pop("_images")
        result["faces"][name] = c
        if name == "front":
            tiles = imgs
    front = result["faces"].get("front")
    if front:
        lm = front["local_mismatch"]
        structure_ok = (front["ssim"] >= THRESHOLDS["ssim"] and front["edge_f1"] >= THRESHOLDS["edge_f1"]
                        and front["shift_px"] <= THRESHOLDS["shift_px"] and lm["fraction"] <= THRESHOLDS["local_mismatch"])
        too_small = min(front["size_px"]) < 350
        result["checks"].append({
            "name": "Front structure (text and positions)",
            "status": "pass" if structure_ok else ("warn" if too_small else "fail"),
            "detail": f"SSIM {front['ssim']:.3f}, edge match {front['edge_f1']:.3f}, shift {front['shift_px']:.2f} px, "
                      f"worst local difference {lm['fraction'] * 100:.0f}%"
                      + (f" at {lm['box']} (marked in the report image)" if lm["fraction"] > THRESHOLDS["local_mismatch"] else "")
                      + (f". The front is only {front['size_px'][0]} x {front['size_px'][1]} px in this image: too small to check "
                         "small text; render larger to verify" if too_small and not structure_ok else ""),
        })
        result["checks"].append({
            "name": "Front colour",
            "status": "pass" if front["delta_e_comp_mean"] <= THRESHOLDS["delta_e_comp_warn"] else "warn",
            "detail": f"mean ΔE00 {front['delta_e_comp_mean']:.2f} after removing lighting "
                      f"({front['delta_e_raw_mean']:.2f} with lighting), 95th pct {front['delta_e_comp_p95']:.2f}",
        })
        b = front["brightness_ratio"]
        side = [result["faces"][s]["brightness_ratio"] for s in ("left", "right") if s in result["faces"]]
        detail = f"front {b * 100:.0f}% of the file" if b else "n/a"
        if side and side[0]:
            detail += f", visible side {side[0] * 100:.0f}%"
        ok = b is not None and 0.88 <= b <= 0.98 and (not side or side[0] is None or side[0] < b - 0.05)
        result["checks"].append({"name": "Lighting", "status": "pass" if ok else "warn", "detail": detail})
    else:
        result["checks"].append({"name": "Front structure (text and positions)", "status": "skipped",
                                 "detail": "front face not visible in this view"})
    bg = background_check(rgba, meta["boxes"], shadow_enabled)
    result["background"] = bg
    result["checks"].append({"name": "Transparent background", "status": bg["status"],
                             "detail": "; ".join(bg["issues"]) or f"{bg['transparent_fraction'] * 100:.1f}% fully transparent, shadow neutral black"})
    result["status"] = "fail" if any(c["status"] == "fail" for c in result["checks"]) else "pass"
    if tiles:
        g_s, g_r, heat = tiles
        gap = np.full((g_s.shape[0], 12, 3), 255, np.uint8)
        Image.fromarray(np.concatenate([g_s, gap, g_r, gap, heat], axis=1)).save(report_img_path)
        result["image"] = True
    return result
