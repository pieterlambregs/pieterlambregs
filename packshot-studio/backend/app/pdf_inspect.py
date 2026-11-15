"""Inspect a PDF: layers, spot colours, dieline paths, text and images.

Also builds the "clean" working copy in which dieline/technical marks that live on their
own layer or spot colour are removed at the source. The original file is never modified.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import pymupdf
from pymupdf import mupdf

from .content_filter import ParseError, filter_stream

PT_TO_MM = 25.4 / 72.0

# --- naming conventions -----------------------------------------------------------------
# role: "dieline" (cut + crease in one, told apart by dash pattern), "cut", "crease",
#       "technical" (never printed, hidden), "finish" (varnish/foil masks, hidden from the
#       print but kept as mask candidates), "ask" (looks non-printing, user must confirm),
#       "artwork".
_ROLE_PATTERNS: list[tuple[str, str]] = [
    ("crease", r"crease|creasing|fold|score|scoring|ril(l)?(ijn|lijn|en)?\b|rillijn|vouw|pli\b|plis\b|rainage|rainure|rill|falz|nut\b"),
    ("cut", r"\bcut\b|cutcontour|cut[\s_-]?contour|thru[\s_-]?cut|snij|coupe|schnitt|schneid"),
    ("dieline", r"die[\s_-]?line|dieline|die[\s_-]?cut|diecut|\bdie\b|cutter|keyline|key[\s_-]?line|stans|stanz|d[ée]coupe|\bcad\b|contour|kontur|vorm\b|forme\b|template|gabarit|sjabloon"),
    ("technical", r"\bzone\b|zones\b|pasting|\bpaste\b|lijmzone|glue[\s_-]?area"),
    ("technical", r"(varnish|vernis|lak|uv)[\s_-]*(free|vrij|libre|frei)|lakvrij|no[\s_-]?varnish|sans[\s_-]?vernis"),
    ("finish", r"varnish|vernis|\blak\b|lak[\s_-]|\buv\b|spot[\s_-]?uv|foil|folie|hot[\s_-]?stamp|emboss|deboss|preeg|pr[äa]g|gaufrage|dorure|cold[\s_-]?foil|metallic[\s_-]?mask"),
    ("ask", r"print[\s_-]?elements?|variable[\s_-]?data|braille|\bwhite\b|\bwit\b|blanc|weiss|wei[sß]"),
    ("technical", r"caption|dimension|maat|maten|measure|afmeting|cote\b|cotes\b|bemaßung|info|legend|legende|slug|note|notes|technical|technisch|technique|guide|hulplijn|non[\s_-]?print|niet[\s_-]?druk|do[\s_-]?not[\s_-]?print|glue|lijm|colle|kleb|lakvrij|varnish[\s_-]?free|no[\s_-]?varnish|free[\s_-]?zone|registration|crop[\s_-]?mark|marks|pharmacode[\s_-]?zone|barcode[\s_-]?zone"),
]


def classify_name(name: str) -> str:
    n = name.strip().lower()
    for role, pat in _ROLE_PATTERNS:
        if re.search(pat, n):
            return role
    return "artwork"


HIDDEN_ROLES = {"dieline", "cut", "crease", "technical", "finish"}
DIELINE_ROLES = {"dieline", "cut", "crease"}


@dataclass
class Source:
    id: str  # "layer:<name>" or "spot:<name>"
    kind: str  # "layer" | "spot"
    name: str
    role: str
    proposed_role: str
    n_paths: int = 0
    needs_confirmation: bool = False

    def to_dict(self):
        return self.__dict__.copy()


@dataclass
class Segment:
    x0: float
    y0: float
    x1: float
    y1: float
    kind: str  # "cut" | "crease" | "unknown"
    curve: bool = False  # flattened curve piece (used for outline extent only)

    def to_list(self):
        return [round(self.x0, 4), round(self.y0, 4), round(self.x1, 4), round(self.y1, 4), self.kind, self.curve]


@dataclass
class Inspection:
    page_count: int
    page_index: int
    page_w_mm: float
    page_h_mm: float
    sources: list[Source] = field(default_factory=list)
    segments: list[Segment] = field(default_factory=list)
    method: str = "none"  # "layer" | "spot" | "color" | "none"
    dieline_stroke_rgb: list[float] | None = None  # for method "color"
    dieline_line_width_mm: float = 0.0
    removed_at_source: bool = False
    hidden_ocg_xrefs: list[int] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    output_intent: str | None = None


# --- low level helpers ------------------------------------------------------------------

def _sentinel(i: int) -> tuple[float, float, float]:
    # Exactly representable 8-bit RGB values that are extremely unlikely in real artwork.
    return ((17 + 37 * i) % 256 / 255.0, (251 - 3 * (i // 7)) / 255.0, (91 + 53 * i) % 256 / 255.0)


def _iter_dict(obj):
    for i in range(mupdf.pdf_dict_len(obj)):
        yield mupdf.pdf_to_name(mupdf.pdf_dict_get_key(obj, i)), mupdf.pdf_dict_get_val(obj, i)


def _walk_resources(page: pymupdf.Page):
    """Yield (owner_xref_or_None, resources_obj) for the page and every nested Form XObject.

    owner xref is None for the page itself, otherwise the xref of the form stream.
    """
    pobj = pymupdf._as_pdf_page(page).obj()
    res = mupdf.pdf_dict_get_inheritable(pobj, mupdf.pdf_new_name("Resources"))
    seen: set[int] = set()
    stack = [(None, res)]
    while stack:
        owner, r = stack.pop()
        if not mupdf.pdf_is_dict(r):
            continue
        yield owner, r
        xo = mupdf.pdf_dict_gets(r, "XObject")
        if mupdf.pdf_is_dict(xo):
            for _name, val in _iter_dict(xo):
                num = mupdf.pdf_to_num(val)
                if num in seen or not mupdf.pdf_is_dict(val):
                    continue
                if mupdf.pdf_to_name(mupdf.pdf_dict_gets(val, "Subtype")) != "Form":
                    continue
                seen.add(num)
                sub = mupdf.pdf_dict_gets(val, "Resources")
                stack.append((num, sub if mupdf.pdf_is_dict(sub) else r))


def _separations(resources) -> list[tuple[str, str, object]]:
    """(resource_name, colorant_name, array_obj) for each Separation colour space."""
    out = []
    cs = mupdf.pdf_dict_gets(resources, "ColorSpace")
    if not mupdf.pdf_is_dict(cs):
        return out
    for rname, val in _iter_dict(cs):
        if mupdf.pdf_is_array(val) and mupdf.pdf_array_len(val) >= 4:
            if mupdf.pdf_to_name(mupdf.pdf_array_get(val, 0)) == "Separation":
                colorant = mupdf.pdf_to_name(mupdf.pdf_array_get(val, 1))
                out.append((rname, colorant, val))
    return out


def list_spot_colours(page: pymupdf.Page) -> list[str]:
    names: list[str] = []
    for _owner, res in _walk_resources(page):
        for _r, colorant, _arr in _separations(res):
            if colorant not in ("All", "None") and colorant not in names:
                names.append(colorant)
    return names


def _apply_sentinels(doc: pymupdf.Document, page: pymupdf.Page, colorants: list[str]) -> dict[str, tuple]:
    """Rewrite each listed Separation so its paths are drawn in a unique sentinel RGB."""
    pdf = pymupdf._as_pdf_document(doc)
    mapping = {c: _sentinel(i) for i, c in enumerate(colorants)}

    def arr(vals):
        a = mupdf.pdf_new_array(pdf, len(vals))
        for v in vals:
            mupdf.pdf_array_push(a, mupdf.pdf_new_real(float(v)))
        return a

    for _owner, res in _walk_resources(page):
        for _r, colorant, a in _separations(res):
            if colorant not in mapping:
                continue
            f = mupdf.pdf_new_dict(pdf, 5)
            mupdf.pdf_dict_puts(f, "FunctionType", mupdf.pdf_new_int(2))
            mupdf.pdf_dict_puts(f, "Domain", arr([0, 1]))
            mupdf.pdf_dict_puts(f, "C0", arr([1, 1, 1]))
            mupdf.pdf_dict_puts(f, "C1", arr(mapping[colorant]))
            mupdf.pdf_dict_puts(f, "N", mupdf.pdf_new_int(1))
            mupdf.pdf_array_put(a, 2, mupdf.pdf_new_name("DeviceRGB"))
            mupdf.pdf_array_put(a, 3, f)
    return mapping


def _close(c1, c2, tol=1.5 / 255.0) -> bool:
    return c1 is not None and c2 is not None and len(c1) == len(c2) and all(abs(a - b) <= tol for a, b in zip(c1, c2))


def _flatten_bezier(p0, p1, p2, p3, n=8):
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x
        y = mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y
        pts.append((x, y))
    return pts


def _drawing_segments(d: dict, kind: str) -> list[Segment]:
    """Turn one drawing into straight segments in millimetres."""
    segs: list[Segment] = []

    def add(a, b, curve=False):
        segs.append(Segment(a[0] * PT_TO_MM, a[1] * PT_TO_MM, b[0] * PT_TO_MM, b[1] * PT_TO_MM, kind, curve))

    for item in d["items"]:
        op = item[0]
        if op == "l":
            add((item[1].x, item[1].y), (item[2].x, item[2].y))
        elif op == "re":
            r = item[1]
            c = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
            for i in range(4):
                add(c[i], c[(i + 1) % 4])
        elif op == "qu":
            q = item[1]
            c = [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]
            for i in range(4):
                add(c[i], c[(i + 1) % 4])
        elif op == "c":
            pts = _flatten_bezier(item[1], item[2], item[3], item[4])
            straight = _is_straight(pts)
            if straight:
                add(pts[0], pts[-1])
            else:
                for a, b in zip(pts, pts[1:]):
                    add(a, b, curve=True)
    if d.get("closePath") and segs:
        first, last = segs[0], segs[-1]
        if math.hypot(first.x0 - last.x1, first.y0 - last.y1) > 1e-3:
            segs.append(Segment(last.x1, last.y1, first.x0, first.y0, kind, last.curve and first.curve))
    return segs


def _is_straight(pts) -> bool:
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    length = math.hypot(x1 - x0, y1 - y0)
    if length < 1e-6:
        return False
    for x, y in pts[1:-1]:
        if abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / length > 0.02:
            return False
    return True


def _is_dashed(d: dict) -> bool:
    dashes = (d.get("dashes") or "").strip()
    m = re.match(r"\[(.*?)\]", dashes)
    return bool(m and m.group(1).strip())


# --- main inspection --------------------------------------------------------------------

def inspect(path: str, page_index: int = 0, role_overrides: dict[str, str] | None = None) -> Inspection:
    """Find layers/spot colours, decide which carry the dieline and extract its geometry."""
    role_overrides = role_overrides or {}
    doc = pymupdf.open(path)
    page = doc[page_index]
    info = Inspection(
        page_count=doc.page_count,
        page_index=page_index,
        page_w_mm=page.rect.width * PT_TO_MM,
        page_h_mm=page.rect.height * PT_TO_MM,
    )
    if doc.page_count > 1:
        info.notes.append(f"The file has {doc.page_count} pages; page {page_index + 1} is used.")

    # Sources: layers (optional content groups) and spot colours.
    ocgs = doc.get_ocgs() or {}
    layer_names: list[str] = []
    for _xref, o in ocgs.items():
        if o["name"] not in layer_names:
            layer_names.append(o["name"])
    spots = list_spot_colours(page)

    def make(kind, name):
        sid = f"{kind}:{name}"
        proposed = classify_name(name)
        role = role_overrides.get(sid, proposed)
        return Source(sid, kind, name, role, proposed, needs_confirmation=(role == "ask"))

    sources = [make("layer", n) for n in layer_names] + [make("spot", n) for n in spots]
    by_id = {s.id: s for s in sources}

    # Sentinel copy: spot-coloured paths become identifiable in get_drawings().
    sdoc = pymupdf.open("pdf", doc.tobytes())
    spage = sdoc[page_index]
    sentinels = _apply_sentinels(sdoc, spage, spots) if spots else {}
    sdoc = pymupdf.open("pdf", sdoc.tobytes())
    spage = sdoc[page_index]
    drawings = spage.get_drawings()

    def spot_of(d) -> str | None:
        for colorant, rgb in sentinels.items():
            if _close(d.get("color"), rgb) or _close(d.get("fill"), rgb):
                return colorant
        return None

    widths: list[float] = []
    segs_layer: list[Segment] = []
    segs_spot: list[Segment] = []
    for d in drawings:
        layer = d.get("layer") or ""
        spot = spot_of(d)
        lsrc = by_id.get(f"layer:{layer}") if layer else None
        ssrc = by_id.get(f"spot:{spot}") if spot else None
        if lsrc:
            lsrc.n_paths += 1
        if ssrc:
            ssrc.n_paths += 1
        if d.get("color") is None:  # fills are never fold or cut lines
            continue
        # A path is dieline geometry if its spot colour or its layer says so. The spot
        # colour is the more specific signal (a "Dieline" layer may hold "Stans" + "Rillijn").
        src = None
        if ssrc and ssrc.role in DIELINE_ROLES:
            src = ssrc
        elif lsrc and lsrc.role in DIELINE_ROLES and not (ssrc and ssrc.role in ("technical", "finish")):
            src = lsrc
        if not src:
            continue
        if src.role == "dieline":
            kind = "crease" if _is_dashed(d) else "cut"
        else:
            kind = src.role
        new = _drawing_segments(d, kind)
        (segs_spot if src.kind == "spot" else segs_layer).extend(new)
        if d.get("width"):
            widths.append(d["width"] * PT_TO_MM)

    info.sources = sources
    info.segments = segs_spot + segs_layer
    if info.segments:
        info.method = "spot" if segs_spot else "layer"
        info.dieline_line_width_mm = sorted(widths)[len(widths) // 2] if widths else 0.0
        # If every line came out as "cut" (one solid style for everything) the fold lines
        # cannot be told apart by style; the geometry builder then works by position only.
        if all(s.kind == "cut" for s in info.segments) and any(s.role == "dieline" for s in sources):
            for s in info.segments:
                s.kind = "unknown"
    else:
        _detect_by_colour(page, info)

    info.hidden_ocg_xrefs = [x for x, o in ocgs.items() if by_id[f"layer:{o['name']}"].role in HIDDEN_ROLES]

    try:
        oi = mupdf.pdf_document_output_intent(pymupdf._as_pdf_document(doc))
        if oi.m_internal:
            info.output_intent = mupdf.fz_colorspace_name(oi) or None
    except Exception:
        info.output_intent = None
    return info


def _detect_by_colour(page: pymupdf.Page, info: Inspection) -> None:
    """Fallback for flattened vector files: find the stroke colour that draws the dieline.

    Candidates are thin stroked paths made of long axis-aligned lines. The colour with the
    greatest axis-aligned stroke length wins, with a preference for colours that are used
    with both solid and dashed strokes (cut + crease).
    """
    groups: dict[tuple, dict] = {}
    for d in page.get_drawings():
        col = d.get("color")
        if col is None or d.get("fill") is not None:
            continue
        w = (d.get("width") or 0) * PT_TO_MM
        if w > 0.6:  # dielines are hairlines; thicker strokes are artwork
            continue
        key = tuple(round(c, 2) for c in col)
        g = groups.setdefault(key, {"axis_len": 0.0, "dashed": 0, "solid": 0, "drawings": [], "widths": [], "rgb": col})
        dashed = _is_dashed(d)
        segs = _drawing_segments(d, "crease" if dashed else "cut")
        for s in segs:
            if s.curve:
                continue
            dx, dy = abs(s.x1 - s.x0), abs(s.y1 - s.y0)
            if (dx < 0.05 or dy < 0.05) and max(dx, dy) >= 5.0:
                g["axis_len"] += max(dx, dy)
        g["dashed" if dashed else "solid"] += 1
        g["drawings"].append(segs)
        g["widths"].append(w)

    best, best_score = None, 0.0
    for key, g in groups.items():
        score = g["axis_len"]
        if g["dashed"] and g["solid"]:
            score *= 2.0
        r, gg, b = key[:3] if len(key) >= 3 else (key[0],) * 3
        if max(r, gg, b) - min(r, gg, b) > 0.3:  # saturated technical colour
            score *= 1.5
        if score > best_score:
            best, best_score = g, score
    if best is None or best["axis_len"] < 200.0:
        return
    info.segments = [s for segs in best["drawings"] for s in segs]
    info.method = "color"
    info.dieline_stroke_rgb = [float(c) for c in best["rgb"]]
    ws = sorted(best["widths"])
    info.dieline_line_width_mm = ws[len(ws) // 2] if ws else 0.0
    if not best["dashed"] or not best["solid"]:
        for s in info.segments:
            s.kind = "unknown"
    info.notes.append(
        "No dieline layer or spot colour was found. The dieline was detected by line colour; "
        "please check the fold lines carefully."
    )


def build_clean_pdf(path: str, out_path: str, info: Inspection) -> dict:
    """Write a working copy with spot-coloured dieline/technical marks removed.

    Layers are not removed here; they are switched off at render time (see open_clean).
    Returns a small report. On any parse problem the affected stream is left untouched and
    the report says so: the caller then falls back to cropping inside the fold lines.
    """
    doc = pymupdf.open(path)
    page = doc[info.page_index]
    hide = {s.name for s in info.sources if s.kind == "spot" and s.role in HIDDEN_ROLES}
    report = {"spots_removed": sorted(hide), "ops_removed": 0, "failed_streams": 0}
    if hide:
        for owner, res in _walk_resources(page):
            names = {r for r, colorant, _a in _separations(res) if colorant in hide}
            if not names:
                continue
            try:
                if owner is None:
                    data = page.read_contents()
                    new, n = filter_stream(data, names)
                    xrefs = page.get_contents()
                    doc.update_stream(xrefs[0], new)
                    doc.xref_set_key(page.xref, "Contents", f"{xrefs[0]} 0 R")
                else:
                    data = doc.xref_stream(owner)
                    new, n = filter_stream(data, names)
                    doc.update_stream(owner, new)
                report["ops_removed"] += n
            except (ParseError, Exception):  # noqa: BLE001 - never break the artwork
                report["failed_streams"] += 1
    doc.save(out_path, garbage=0, deflate=True)
    info.removed_at_source = (
        info.method in ("spot", "layer") and report["failed_streams"] == 0
    )
    return report


def open_clean(clean_path: str, hidden_ocg_xrefs: list[int]) -> pymupdf.Document:
    doc = pymupdf.open(clean_path)
    if hidden_ocg_xrefs:
        doc.set_layer(-1, off=list(hidden_ocg_xrefs))
    return doc


# --- text and images (for orientation and artwork warnings) ------------------------------

def text_lines(page: pymupdf.Page) -> list[dict]:
    """Live text lines: bbox in mm, direction and the text itself."""
    out = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            txt = "".join(s["text"] for s in line.get("spans", []))
            if not txt.strip():
                continue
            b = line["bbox"]
            dx, dy = line.get("dir", (1.0, 0.0))
            out.append({
                "bbox": [b[0] * PT_TO_MM, b[1] * PT_TO_MM, b[2] * PT_TO_MM, b[3] * PT_TO_MM],
                # reading direction on the page, degrees clockwise (0 = left to right)
                "angle": round(math.degrees(math.atan2(dy, dx))) % 360,
                "text": txt,
                "size": max((s.get("size", 0) for s in line.get("spans", [])), default=0),
            })
    return out


def placed_images(page: pymupdf.Page) -> list[dict]:
    out = []
    for im in page.get_image_info(xrefs=True):
        b = im["bbox"]
        w_in = max((b[2] - b[0]) / 72.0, 1e-6)
        h_in = max((b[3] - b[1]) / 72.0, 1e-6)
        out.append({
            "bbox": [b[0] * PT_TO_MM, b[1] * PT_TO_MM, b[2] * PT_TO_MM, b[3] * PT_TO_MM],
            "px": [im["width"], im["height"]],
            "ppi": round(min(im["width"] / w_in, im["height"] / h_in), 1),
            "cs": im.get("cs-name"),
        })
    return out
