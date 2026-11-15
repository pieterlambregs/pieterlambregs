"""Verification step, tested on synthetic renders (no Blender needed)."""
import cv2
import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFont

from app import verify


def _panel(w=600, h=900, text="Ferropti FORTE"):
    im = Image.new("RGB", (w, h), (0, 153, 98))
    d = ImageDraw.Draw(im)
    d.rectangle([40, 60, w - 40, 360], fill=(240, 240, 240))
    try:
        f = ImageFont.truetype("DejaVuSans-Bold.ttf", 60)
    except OSError:
        f = ImageFont.load_default(60)
    d.text((70, 150), text, fill=(20, 20, 20), font=f)
    d.ellipse([w - 180, 90, w - 80, 190], fill=(230, 0, 126))
    for i in range(40):
        d.rectangle([60 + i * 10, 600, 63 + i * 10 + (i % 3), 800], fill=(0, 0, 0))
    return np.asarray(im)


def _render(panel, gain=0.85, corners=None, size=(1200, 1200), shadow=True, shift=(0, 0)):
    """Project the panel into a transparent frame with a perspective warp, darken it like light does."""
    h, w = panel.shape[:2]
    corners = corners or [[350, 1050], [800, 1000], [800, 260], [350, 200]]  # BL, BR, TR, TL
    bl, br, tr, tl = corners
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), np.float32([tl, tr, br, bl]))
    lin = (panel / 255.0) ** 2.2 * gain
    face = (np.clip(lin, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
    if shift != (0, 0):
        face = np.roll(face, shift, axis=(0, 1))
    rgb = cv2.warpPerspective(face, M, size)
    a = cv2.warpPerspective(np.full((h, w), 255, np.uint8), M, size)
    rgba = np.dstack([rgb, a])
    if shadow:
        yy, xx = np.mgrid[0:size[1], 0:size[0]]
        sh = np.clip(1 - np.hypot(xx - 300, yy - 1060) / 120, 0, 1) * 140
        out = a == 0
        rgba[..., 3] = np.where(out, sh.astype(np.uint8), rgba[..., 3])
        rgba[out, :3] = 0
    meta = {"boxes": [{"faces": {"front": {"corners_px": corners, "visible": True}}, "points_px": corners}]}
    return rgba, meta


def _run(tmp_path, rgba, meta, src, shadow=True):
    rp = tmp_path / "r.png"
    sp = tmp_path / "s.png"
    Image.fromarray(rgba).save(rp)
    Image.fromarray(src).save(sp)
    return verify.verify(rp, meta, {"front": str(sp)}, shadow, tmp_path / "v.png")


def test_identical_artwork_passes(tmp_path):
    src = _panel()
    rgba, meta = _render(src)
    r = _run(tmp_path, rgba, meta, src)
    checks = {c["name"]: c["status"] for c in r["checks"]}
    assert checks["Front structure (text and positions)"] == "pass", r["checks"]
    assert checks["Transparent background"] == "pass", r["checks"]
    assert r["faces"]["front"]["delta_e_comp_mean"] < 3
    assert r["faces"]["front"]["brightness_ratio"] == pytest.approx(0.93, abs=0.03)
    assert (tmp_path / "v.png").exists()


def test_different_text_fails(tmp_path):
    src = _panel()
    rgba, meta = _render(_panel(text="Ferropti FORT"))
    r = _run(tmp_path, rgba, meta, src)
    assert r["status"] == "fail"
    assert {c["name"]: c["status"] for c in r["checks"]}["Front structure (text and positions)"] == "fail"


def test_moved_artwork_fails(tmp_path):
    src = _panel()
    rgba, meta = _render(src, shift=(0, 14))
    r = _run(tmp_path, rgba, meta, src)
    assert {c["name"]: c["status"] for c in r["checks"]}["Front structure (text and positions)"] == "fail"


def test_coloured_or_stray_background_fails(tmp_path):
    src = _panel()
    rgba, meta = _render(src)
    rgba[50:60, 50:900] = (255, 255, 255, 255)  # opaque pixels outside the box, not a shadow
    r = _run(tmp_path, rgba, meta, src)
    assert r["background"]["status"] == "fail"


def test_shadow_off_requires_full_transparency(tmp_path):
    src = _panel()
    rgba, meta = _render(src, shadow=True)
    r = _run(tmp_path, rgba, meta, src, shadow=False)
    assert r["background"]["status"] == "fail"
    rgba2, meta2 = _render(src, shadow=False)
    assert _run(tmp_path, rgba2, meta2, src, shadow=False)["background"]["status"] == "pass"
