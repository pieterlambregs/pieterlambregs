"""Output files: PNG (RGBA, sRGB), JPG (on a colour, q95, sRGB), PDF (300 dpi page, info strip)."""
from __future__ import annotations

import datetime as dt
import io
import zipfile
from pathlib import Path

import pymupdf
from PIL import Image

from .filename_parser import output_basename
from .raster import srgb_icc_bytes

ASPECTS = {"1:1": (1, 1), "4:5": (4, 5), "16:9": (16, 9), "A4": (210, 297)}


def resolution(long_side: int, aspect: str, custom_w: int | None = None, custom_h: int | None = None) -> tuple[int, int]:
    if aspect == "custom" and custom_w and custom_h:
        return int(custom_w), int(custom_h)
    aw, ah = ASPECTS.get(aspect, (1, 1))
    if aw >= ah:
        return int(long_side), int(round(long_side * ah / aw))
    return int(round(long_side * aw / ah)), int(long_side)


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _on_colour(im: Image.Image, colour: str) -> Image.Image:
    bg = Image.new("RGBA", im.size, (*hex_rgb(colour), 255))
    bg.alpha_composite(im)
    return bg.convert("RGB")


def write_outputs(render_png: Path, out_dir: Path, source_name: str, view: str, formats: list[str],
                  background: str = "transparent", jpg_background: str = "#ffffff",
                  info_strip: bool = False, info: dict | None = None, recolour_label: str | None = None) -> list[dict]:
    im = Image.open(render_png).convert("RGBA")
    size = f"{max(im.size)}px"
    view_label = view + (f"_recoloured-{recolour_label}" if recolour_label else "")
    base = output_basename(source_name, view_label, size)
    icc = srgb_icc_bytes()
    files = []
    if "png" in formats:
        p = out_dir / f"{base}.png"
        img = im if background == "transparent" else _on_colour(im, background)
        img.save(p, "PNG", icc_profile=icc, compress_level=6)
        files.append({"format": "png", "name": p.name})
    if "jpg" in formats:
        p = out_dir / f"{base}.jpg"
        bg = jpg_background if background == "transparent" else background
        _on_colour(im, bg).save(p, "JPEG", quality=95, subsampling=0, icc_profile=icc, dpi=(300, 300))
        files.append({"format": "jpg", "name": p.name})
    if "pdf" in formats:
        p = out_dir / f"{base}.pdf"
        write_pdf(im, p, background, info if info_strip else None)
        files.append({"format": "pdf", "name": p.name})
    return files


def write_pdf(im: Image.Image, path: Path, background: str, info: dict | None) -> None:
    """The render placed on a page at 300 dpi, with an optional info strip underneath."""
    w_pt, h_pt = im.width / 300 * 72, im.height / 300 * 72
    strip = 0.0
    if info:
        strip = max(28.0, h_pt * 0.06)
    doc = pymupdf.open()
    page = doc.new_page(width=w_pt, height=h_pt + strip)
    if background != "transparent":
        page.draw_rect(pymupdf.Rect(0, 0, w_pt, h_pt), color=None, fill=tuple(c / 255 for c in hex_rgb(background)))
    buf = io.BytesIO()
    im.save(buf, "PNG", icc_profile=srgb_icc_bytes())
    page.insert_image(pymupdf.Rect(0, 0, w_pt, h_pt), stream=buf.getvalue())
    if info:
        y = h_pt
        page.draw_rect(pymupdf.Rect(0, y, w_pt, y + strip), color=None, fill=(0.96, 0.96, 0.96))
        fs = max(7.0, strip * 0.3)
        parts = [info.get("product", ""), info.get("dimensions", ""), f"version {info['version']}" if info.get("version") else "",
                 info.get("date") or dt.date.today().isoformat()]
        text = "   |   ".join(x for x in parts if x)
        page.insert_text(pymupdf.Point(fs, y + strip / 2 + fs / 3), text, fontsize=fs, color=(0.15, 0.15, 0.15))
    doc.set_metadata({"title": info.get("product", "Packshot") if info else "Packshot", "creator": "Packshot Studio"})
    doc.save(path, deflate=True)


def zip_files(paths: list[tuple[Path, str]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p, arc in paths:
            if p.exists():
                z.write(p, arc)
    return buf.getvalue()
