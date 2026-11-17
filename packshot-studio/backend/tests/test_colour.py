"""Colour path: RGB artwork must come through untouched, CMYK through the press profile."""
import numpy as np
import pymupdf
from PIL import Image

from app import raster


def _sheet():
    doc = pymupdf.open()
    page = doc.new_page(width=300, height=100)
    page.draw_rect(pymupdf.Rect(0, 0, 100, 100), color=None, fill=(0.6, 0.75, 0.0, 0.0))  # CMYK
    page.draw_rect(pymupdf.Rect(100, 0, 200, 100), color=None, fill=(0.512, 0.371, 0.659))  # RGB
    page.draw_rect(pymupdf.Rect(200, 0, 300, 100), color=None, fill=(0.0, 0.0, 0.0, 1.0))  # K100
    return pymupdf.open("pdf", doc.tobytes())


def test_rgb_artwork_is_not_shifted_through_cmyk():
    a = np.asarray(raster.render_page_srgb(raster.prepare(_sheet())[0], 72)).astype(int)
    assert np.abs(a[50, 150] - np.array([131, 95, 168])).max() <= 2


def test_cmyk_uses_the_press_profile():
    a = np.asarray(raster.render_page_srgb(raster.prepare(_sheet(), "FOGRA39")[0], 72)).astype(int)
    for x, cmyk in ((50, (153, 191, 0, 0)), (250, (0, 0, 0, 255))):
        ref = np.array(raster.cmyk_to_srgb(Image.new("CMYK", (1, 1), cmyk), "FOGRA39").getpixel((0, 0)))
        assert np.abs(a[50, x] - ref).max() <= 3, (a[50, x], ref)


def test_profile_choice_changes_cmyk_only():
    a = np.asarray(raster.render_page_srgb(raster.prepare(_sheet(), "FOGRA39")[0], 72)).astype(int)
    b = np.asarray(raster.render_page_srgb(raster.prepare(_sheet(), "FOGRA47")[0], 72)).astype(int)
    assert np.abs(a[50, 50] - b[50, 50]).max() > 3  # coated vs uncoated differ
    assert np.abs(a[50, 150] - b[50, 150]).max() <= 1  # RGB is unaffected
