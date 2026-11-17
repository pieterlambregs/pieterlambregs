"""Rasterise the print file and convert colour with a real ICC transform.

Each colour keeps its own colour space until the single conversion to sRGB:
* CMYK (and spot colours through their CMYK alternate) is converted with the selected press
  profile (default ISO Coated v2 / FOGRA39). The profile is set as the document's output
  intent, which MuPDF uses for all device CMYK.
* RGB artwork (DeviceRGB / ICC-based RGB) is converted from its own profile to sRGB and is
  never sent through CMYK, so RGB colours are not shifted by a double conversion.
No other change is made to the pixels.
"""
from __future__ import annotations

import io
from functools import lru_cache
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageCms

ICC_DIR = Path(__file__).parent / "icc"
PROFILES = {
    "FOGRA39": ("ISO Coated v2 / FOGRA39 (coated)", "FOGRA39L_coated.icc"),
    "FOGRA47": ("PSO Uncoated / FOGRA47 (uncoated)", "FOGRA47L_uncoated.icc"),
    "FOGRA29": ("ISO Uncoated / FOGRA29", "FOGRA29L_uncoated.icc"),
    "GRACOL": ("GRACoL 2006 coated (US)", "GRACoL_TR006_coated.icc"),
    "SWOP": ("SWOP coated #5 (US)", "SWOP_TR005_coated_5.icc"),
}
INTENTS = {
    "relative": ImageCms.Intent.RELATIVE_COLORIMETRIC,
    "perceptual": ImageCms.Intent.PERCEPTUAL,
    "absolute": ImageCms.Intent.ABSOLUTE_COLORIMETRIC,
}
SRGB_PATH = ICC_DIR / "sRGB.icc"
MM_TO_PT = 72.0 / 25.4


def srgb_icc_bytes() -> bytes:
    return SRGB_PATH.read_bytes()


@lru_cache(maxsize=16)
def _transform(profile: str, intent: str, bpc: bool):
    src = ImageCms.getOpenProfile(str(ICC_DIR / PROFILES[profile][1]))
    dst = ImageCms.getOpenProfile(str(SRGB_PATH))
    flags = ImageCms.Flags.BLACKPOINTCOMPENSATION if bpc else ImageCms.Flags.NONE
    return ImageCms.buildTransform(src, dst, "CMYK", "RGB", renderingIntent=INTENTS[intent], flags=flags)


def cmyk_to_srgb(cmyk: Image.Image, profile: str = "FOGRA39", intent: str = "relative", bpc: bool = True) -> Image.Image:
    return ImageCms.applyTransform(cmyk, _transform(profile, intent, bpc))


def hide_layers(doc: pymupdf.Document, hidden_names: set[str]) -> None:
    """Switch off layers by name (via the UI configuration, which the renderer honours)."""
    if not hidden_names:
        return
    for cfg in doc.layer_ui_configs():
        if cfg.get("text") in hidden_names and cfg.get("on"):
            doc.set_layer_ui_config(cfg["number"], action=2)


def prepare(doc: pymupdf.Document, profile: str = "FOGRA39") -> pymupdf.Document:
    """Return a copy of the document whose output intent is the selected press profile.

    Call this before switching layers off (reopening resets the layer view)."""
    data = (ICC_DIR / PROFILES[profile][1]).read_bytes()
    out = pymupdf.open("pdf", doc.tobytes())
    x = out.get_new_xref()
    out.update_object(x, "<< /N 4 >>")
    out.update_stream(x, data)
    oi = out.get_new_xref()
    out.update_object(oi, f"<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier ({profile}) "
                          f"/DestOutputProfile {x} 0 R >>")
    out.xref_set_key(out.pdf_catalog(), "OutputIntents", f"[{oi} 0 R]")
    return pymupdf.open("pdf", out.tobytes())


def render_region_cmyk(page: pymupdf.Page, rect_mm: tuple[float, float, float, float], dpi: int) -> Image.Image:
    x0, y0, x1, y1 = rect_mm
    clip = pymupdf.Rect(x0 * MM_TO_PT, y0 * MM_TO_PT, x1 * MM_TO_PT, y1 * MM_TO_PT)
    zoom = dpi / 72.0
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, colorspace=pymupdf.csCMYK, alpha=False)
    return Image.frombytes("CMYK", (pix.width, pix.height), pix.samples)


def render_region_srgb(page, rect_mm, dpi, profile="FOGRA39", intent="relative", bpc=True) -> Image.Image:
    """Render straight to sRGB. The page must come from a document made with prepare(), so
    that CMYK uses the press profile; RGB content keeps its own colours."""
    x0, y0, x1, y1 = rect_mm
    clip = pymupdf.Rect(x0 * MM_TO_PT, y0 * MM_TO_PT, x1 * MM_TO_PT, y1 * MM_TO_PT)
    zoom = dpi / 72.0
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, colorspace=pymupdf.csRGB, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def render_page_srgb(page, dpi, profile="FOGRA39", intent="relative", bpc=True) -> Image.Image:
    r = page.rect
    return render_region_srgb(page, (0, 0, r.width / MM_TO_PT, r.height / MM_TO_PT), dpi, profile, intent, bpc)


def save_png_srgb(img: Image.Image, path: Path) -> None:
    img.save(path, "PNG", icc_profile=srgb_icc_bytes(), optimize=False, compress_level=6)


def to_array(img: Image.Image) -> np.ndarray:
    return np.asarray(img)


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG", icc_profile=srgb_icc_bytes())
    return buf.getvalue()
