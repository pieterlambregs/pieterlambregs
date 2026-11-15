"""Generate synthetic print-ready carton PDFs for tests and demos.

Reverse-tuck-end carton, W x D x H = 69.5 x 69.5 x 108.5 mm (file-name dimensions are
written in tenths of a millimetre: 1085x695x695mm).

Variants:
  layered   dieline on layer "Dieline" in spot colours "Stans" (solid cut) + "Rillijn" (dashed crease)
  flat      same drawing but the dieline is plain RGB magenta strokes, no layer, no spot colour
  rotated   layered, but the whole sheet is drawn rotated 90 degrees on the page
"""
from __future__ import annotations

import sys
from pathlib import Path

import pymupdf

MM = 72.0 / 25.4
W, D, H = 69.5, 69.5, 108.5
GLUE = 13.0
TUCK = 15.0
DUST = 30.0
BLEED = 3.0

# columns: glue | front | right | back | left
X0 = 25.0
XS = [X0, X0 + GLUE, X0 + GLUE + W, X0 + GLUE + W + D, X0 + GLUE + 2 * W + D, X0 + GLUE + 2 * (W + D)]
Y_TOP = 25.0 + D + TUCK
Y_BOT = Y_TOP + H
PAGE_W = XS[-1] + 25.0
PAGE_H = Y_BOT + D + TUCK + 25.0

BRAND_GREEN = (0.85, 0.0, 0.75, 0.10)  # CMYK background
LIGHT = (0.10, 0.0, 0.08, 0.0)
MAGENTA_LOGO = (0.0, 1.0, 0.0, 0.0)  # deliberately the same hue as the dieline
BLACK = (0, 0, 0, 1)
WHITE = (0, 0, 0, 0)


def cut_segments():
    """Solid cut lines (outline). Returns list of ((x0,y0),(x1,y1)) in mm."""
    s = []
    g0, f0, r0, b0, l0, end = XS
    # glue flap (tapered)
    s += [((f0, Y_TOP), (g0, Y_TOP + 4)), ((g0, Y_TOP + 4), (g0, Y_BOT - 4)), ((g0, Y_BOT - 4), (f0, Y_BOT))]
    # right edge
    s += [((end, Y_TOP), (end, Y_BOT))]
    # top: lid + tuck on the back column, dust flaps on the side columns, front column open
    s += [((f0, Y_TOP), (r0, Y_TOP))]
    for x0, x1 in ((r0, b0), (l0, end)):  # dust flaps
        s += [((x0, Y_TOP), (x0 + 2, Y_TOP - DUST)), ((x0 + 2, Y_TOP - DUST), (x1 - 8, Y_TOP - DUST)), ((x1 - 8, Y_TOP - DUST), (x1, Y_TOP - 6)), ((x1, Y_TOP - 6), (x1, Y_TOP))]
    s += [((b0, Y_TOP), (b0, Y_TOP - D)), ((l0, Y_TOP), (l0, Y_TOP - D))]
    s += [((b0, Y_TOP - D), (b0 + 2, Y_TOP - D - TUCK)), ((b0 + 2, Y_TOP - D - TUCK), (l0 - 2, Y_TOP - D - TUCK)), ((l0 - 2, Y_TOP - D - TUCK), (l0, Y_TOP - D))]
    # bottom: lid + tuck on the front column, dust flaps on sides, back column open
    s += [((b0, Y_BOT), (l0, Y_BOT))]
    for x0, x1 in ((r0, b0), (l0, end)):
        s += [((x0, Y_BOT), (x0 + 2, Y_BOT + DUST)), ((x0 + 2, Y_BOT + DUST), (x1 - 8, Y_BOT + DUST)), ((x1 - 8, Y_BOT + DUST), (x1, Y_BOT + 6)), ((x1, Y_BOT + 6), (x1, Y_BOT))]
    s += [((f0, Y_BOT), (f0, Y_BOT + D)), ((r0, Y_BOT), (r0, Y_BOT + D))]
    s += [((f0, Y_BOT + D), (f0 + 2, Y_BOT + D + TUCK)), ((f0 + 2, Y_BOT + D + TUCK), (r0 - 2, Y_BOT + D + TUCK)), ((r0 - 2, Y_BOT + D + TUCK), (r0, Y_BOT + D))]
    return s


def crease_segments():
    g0, f0, r0, b0, l0, end = XS
    s = [((x, Y_TOP), (x, Y_BOT)) for x in (f0, r0, b0, l0)]
    s += [((r0, Y_TOP), (end, Y_TOP)), ((f0, Y_BOT), (b0, Y_BOT)), ((l0, Y_BOT), (end, Y_BOT))]
    s += [((b0, Y_TOP - D), (l0, Y_TOP - D)), ((f0, Y_BOT + D), (r0, Y_BOT + D))]
    return s


def _rect(page, r, cmyk):
    page.draw_rect(pymupdf.Rect(*[v * MM for v in r]), color=None, fill=cmyk, overlay=True)


def _text(page, x, y, txt, size, cmyk, rotate=0, font="helv"):
    page.insert_text(pymupdf.Point(x * MM, y * MM), txt, fontsize=size, color=cmyk, rotate=rotate, fontname=font)


def draw_artwork(page):
    g0, f0, r0, b0, l0, end = XS
    # Background with bleed over the whole body + flaps
    _rect(page, (g0 - BLEED, Y_TOP - BLEED, end + BLEED, Y_BOT + BLEED), BRAND_GREEN)
    _rect(page, (b0 - BLEED, Y_TOP - D - TUCK - BLEED, l0 + BLEED, Y_TOP + 1), BRAND_GREEN)
    _rect(page, (f0 - BLEED, Y_BOT - 1, r0 + BLEED, Y_BOT + D + TUCK + BLEED), BRAND_GREEN)
    for x0, x1 in ((r0, b0), (l0, end)):
        _rect(page, (x0, Y_TOP - DUST - BLEED, x1, Y_TOP + 1), LIGHT)
        _rect(page, (x0, Y_BOT - 1, x1, Y_BOT + DUST + BLEED), LIGHT)

    # FRONT
    _rect(page, (f0 + 6, Y_TOP + 8, r0 - 6, Y_TOP + 48), WHITE)
    _text(page, f0 + 9, Y_TOP + 22, "EG", 14, MAGENTA_LOGO, font="hebo")  # magenta logo
    page.draw_circle(pymupdf.Point((r0 - 16) * MM, (Y_TOP + 18) * MM), 6 * MM, color=None, fill=MAGENTA_LOGO)
    _text(page, f0 + 9, Y_TOP + 34, "Ferropti", 15, BLACK, font="hebo")
    _text(page, f0 + 9, Y_TOP + 44, "FORTE", 13, MAGENTA_LOGO, font="hebo")
    _text(page, f0 + 8, Y_TOP + 62, "Ijzer + vitamine C", 8, WHITE)
    _text(page, f0 + 8, Y_TOP + 70, "Fer + vitamine C", 8, WHITE)
    _text(page, f0 + 8, Y_BOT - 10, "90 comprimes / tabletten", 7, WHITE)
    # BACK (legal text, small)
    for i, line in enumerate(["Samenstelling per tablet:", "IJzer 28 mg (200% RI)", "Vitamine C 80 mg (100% RI)",
                              "Composition par comprime :", "Fer 28 mg (200% AR)", "Vitamine C 80 mg (100% AR)",
                              "Lot / Exp: zie onderkant", "EG nv - 1000 Brussel"]):
        _text(page, b0 + 5, Y_TOP + 12 + i * 6, line, 5.5, WHITE)
    # barcode-like bars (vector, must stay identical)
    for i in range(30):
        w = 0.35 if i % 3 else 0.7
        _rect(page, (b0 + 8 + i * 1.1, Y_BOT - 28, b0 + 8 + i * 1.1 + w, Y_BOT - 10), BLACK)
    _rect(page, (b0 + 6, Y_BOT - 30, b0 + 46, Y_BOT - 8), WHITE)
    for i in range(30):
        w = 0.35 if i % 3 else 0.7
        _rect(page, (b0 + 8 + i * 1.1, Y_BOT - 28, b0 + 8 + i * 1.1 + w, Y_BOT - 10), BLACK)
    # SIDES: text reads bottom-to-top (rotated 90)
    _text(page, r0 + 12, Y_BOT - 10, "Ferropti FORTE  -  right side", 8, WHITE, rotate=90)
    _text(page, l0 + 12, Y_BOT - 10, "Ferropti FORTE  -  left side", 8, WHITE, rotate=90)
    # TOP lid on back column: printed upside down on the flat sheet (reads correctly from above)
    _text(page, l0 - 8, Y_TOP - D + 30, "TOP  Ferropti FORTE", 8, WHITE, rotate=180)
    # BOTTOM lid on front column
    _text(page, f0 + 8, Y_BOT + 20, "BOTTOM  Lot 12345  Exp 01-2029", 6, WHITE)


def add_spot_dieline(doc, page, flat=False):
    """Append the dieline as its own content stream."""
    def path(segs):
        ops = []
        for (x0, y0), (x1, y1) in segs:
            ops.append(f"{x0 * MM:.3f} {(PAGE_H - y0) * MM:.3f} m {x1 * MM:.3f} {(PAGE_H - y1) * MM:.3f} l S")
        return "\n".join(ops)

    if flat:
        stream = "q 0.5 w 1 0 1 RG\n" + path(cut_segments()) + "\n[3 2] 0 d\n" + path(crease_segments()) + "\nQ\n"
        stream += "BT /Fdim 6 Tf 1 0 1 rg 1 0 0 1 %.2f %.2f Tm (108.5 x 69.5 x 69.5 mm) Tj ET\n" % (30 * MM, (PAGE_H - 12) * MM)
    else:
        ocg = doc.add_ocg("Dieline", on=True)
        res_xref = int(doc.xref_get_key(page.xref, "Resources")[1].split()[0])
        fn = "<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [%s] /N 1 >>"
        doc.xref_set_key(res_xref, "ColorSpace/CSstans", "[/Separation /Stans /DeviceCMYK %s]" % (fn % "0 1 0 0"))
        doc.xref_set_key(res_xref, "ColorSpace/CSril", "[/Separation /Rillijn /DeviceCMYK %s]" % (fn % "1 0 0 0"))
        doc.xref_set_key(res_xref, "Properties/MCdie", f"{ocg} 0 R")
        stream = ("q /OC /MCdie BDC 0.5 w /CSstans CS 1 SCN\n" + path(cut_segments()) +
                  "\n/CSril CS 1 SCN [3 2] 0 d\n" + path(crease_segments()) + "\nEMC Q\n")
        # dimension text in the cut colour, outside the carton
        stream += "q /CSstans cs 1 scn BT /Fdim 6 Tf 1 0 0 1 %.2f %.2f Tm (108.5 x 69.5 x 69.5 mm) Tj ET Q\n" % (30 * MM, (PAGE_H - 12) * MM)
    res_xref = int(doc.xref_get_key(page.xref, "Resources")[1].split()[0])
    fx = doc.get_new_xref()
    doc.update_object(fx, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    doc.xref_set_key(res_xref, "Font/Fdim", f"{fx} 0 R")
    x = doc.get_new_xref()
    doc.update_object(x, "<<>>")
    doc.update_stream(x, stream.encode())
    c = doc.xref_get_key(page.xref, "Contents")
    if c[0] == "array":
        doc.xref_set_key(page.xref, "Contents", c[1][:-1] + f" {x} 0 R]")
    else:
        doc.xref_set_key(page.xref, "Contents", f"[{c[1]} {x} 0 R]")


def add_marks(page):
    # crop marks + registration in black, outside the trim
    for x, y in ((10, 10), (PAGE_W - 10, 10), (10, PAGE_H - 10), (PAGE_W - 10, PAGE_H - 10)):
        page.draw_line(pymupdf.Point((x - 5) * MM, y * MM), pymupdf.Point((x + 5) * MM, y * MM), color=(0, 0, 0, 1), width=0.25)
        page.draw_line(pymupdf.Point(x * MM, (y - 5) * MM), pymupdf.Point(x * MM, (y + 5) * MM), color=(0, 0, 0, 1), width=0.25)
    # colour bar
    for i, c in enumerate([(1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)]):
        _rect(page, (XS[-1] - 40 + i * 8, PAGE_H - 14, XS[-1] - 33 + i * 8, PAGE_H - 8), c)


def make(variant: str, out: Path) -> Path:
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE_W * MM, height=PAGE_H * MM)
    draw_artwork(page)
    add_marks(page)
    add_spot_dieline(doc, page, flat=(variant == "flat"))
    if variant == "rotated":
        tmp = pymupdf.open("pdf", doc.tobytes())
        rot = pymupdf.open()
        p2 = rot.new_page(width=PAGE_H * MM, height=PAGE_W * MM)
        p2.show_pdf_page(p2.rect, tmp, 0, rotate=90)
        doc = rot
    doc.save(out, deflate=True)
    return out


if __name__ == "__main__":
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    outdir.mkdir(parents=True, exist_ok=True)
    make("layered", outdir / "01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3.pdf")
    make("flat", outdir / "01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3 flat.pdf")
    make("rotated", outdir / "02-26 EG-Ferropti FORTE 1085x695x695mm 90comp 4.pdf")
    print("written to", outdir)
