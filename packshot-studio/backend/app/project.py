"""Projects on disk: upload, analysis, editable layout, panel extraction.

data/projects/<id>/
  project.json      metadata, analysis, layout, checks, renders
  source.<ext>      the uploaded file, never modified
  clean.pdf         working copy with spot-colour dieline marks removed
  sheet.png         preview of the original sheet (with dieline) for the review overlay
  panels/<id>.png   cropped panels, upright for their face, sRGB
"""
from __future__ import annotations

import json
import os
import shutil
import time
import uuid
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image

from . import checks, dieline as dl, pdf_inspect as pi, raster
from .filename_parser import parse_filename

DATA = Path(os.environ.get("PACKSHOT_DATA", Path(__file__).resolve().parents[1] / "data"))
PROJECTS = DATA / "projects"
PREVIEW_DPI = 100
RASTER_EXT = {"png", "tif", "tiff", "jpg", "jpeg"}
PDF_EXT = {"pdf", "ai"}
FACE_ROLES = ("front", "back", "left", "right", "top", "bottom")


def pdir(pid: str) -> Path:
    if not pid or "/" in pid or ".." in pid:
        raise KeyError(pid)
    return PROJECTS / pid


def load(pid: str) -> dict:
    f = pdir(pid) / "project.json"
    if not f.exists():
        raise KeyError(pid)
    return json.loads(f.read_text())


def save(p: dict) -> None:
    d = pdir(p["id"])
    tmp = d / "project.json.tmp"
    tmp.write_text(json.dumps(p, indent=1))
    tmp.replace(d / "project.json")


def list_projects() -> list[dict]:
    out = []
    if PROJECTS.exists():
        for d in PROJECTS.iterdir():
            try:
                p = load(d.name)
            except (KeyError, json.JSONDecodeError):
                continue
            out.append({
                "id": p["id"], "filename": p["filename"], "created": p["created"], "status": p["status"],
                "meta": p["meta"], "approved": p.get("approved", False),
                "renders": len(list((d / "renders").glob("*/record.json"))), "dieline_key": p.get("dieline_key"),
            })
    return sorted(out, key=lambda x: -x["created"])


# --- create + analyse -------------------------------------------------------------------

def create(filename: str, data: bytes) -> dict:
    pid = uuid.uuid4().hex[:12]
    d = pdir(pid)
    (d / "panels").mkdir(parents=True)
    meta = parse_filename(filename)
    ext = meta.extension or "pdf"
    (d / f"source.{ext}").write_bytes(data)
    p = {
        "id": pid, "filename": filename, "created": time.time(), "status": "uploaded",
        "meta": meta.to_dict(), "ext": ext, "settings": {"icc_profile": "FOGRA39", "intent": "relative", "dpi": 600},
        "renders": [], "warnings": [], "questions": [],
    }
    save(p)
    return p


def _source_pdf(p: dict) -> Path:
    """Path of a PDF version of the source. Raster files are wrapped in a one-page PDF."""
    d = pdir(p["id"])
    src = d / f"source.{p['ext']}"
    if p["ext"] in PDF_EXT:
        return src
    wrapped = d / "source_wrapped.pdf"
    if not wrapped.exists():
        im = Image.open(src)
        dpi = im.info.get("dpi", (300, 300))[0] or 300
        doc = pymupdf.open()
        w_pt, h_pt = im.width / dpi * 72, im.height / dpi * 72
        page = doc.new_page(width=w_pt, height=h_pt)
        page.insert_image(page.rect, filename=str(src))
        doc.save(wrapped)
    return wrapped


def analyse(pid: str, role_overrides: dict | None = None, force_rotation: int | None = None) -> dict:
    p = load(pid)
    d = pdir(pid)
    src = _source_pdf(p)
    if role_overrides is None:
        role_overrides = p.get("role_overrides", {})
    p["role_overrides"] = role_overrides
    try:
        doc = pymupdf.open(src)
    except Exception as e:  # noqa: BLE001
        p["status"] = "error"
        p["error"] = f"Cannot open the file: {e}"
        save(p)
        return p
    if doc.needs_pass:
        p["status"] = "error"
        p["error"] = "The PDF is password protected."
        save(p)
        return p

    info = pi.inspect(str(src), 0, role_overrides)
    page = doc[0]
    texts = pi.text_lines(page)
    images = pi.placed_images(page)

    # Preview of the original sheet (dieline visible) for the overlay.
    sheet = raster.render_page_srgb(page, PREVIEW_DPI, p["settings"]["icc_profile"], p["settings"]["intent"])
    sheet.save(d / "sheet.png")

    clean_report = pi.build_clean_pdf(str(src), str(d / "clean.pdf"), info)

    questions = []
    ask = [s for s in info.sources if s.role == "ask"]
    for s in ask:
        questions.append({
            "id": f"source:{s.id}",
            "text": f"The {s.kind} “{s.name}” may be non-printing (white, Braille or similar). Should it be printed on the box?",
            "options": ["artwork", "technical"],
        })

    layout = None
    layout_error = None
    if info.segments:
        try:
            layout = dl.build_layout([s.to_list() for s in info.segments], info.page_w_mm, info.page_h_mm, texts, force_rotation)
        except dl.DielineNotFound as e:
            layout_error = str(e)
    else:
        layout_error = "No dieline found (no layer, spot colour or line colour that draws one)."
    if layout is None:
        dims = (p["meta"].get("dimensions") or {}).get("as_tenths_mm")
        layout = dl.template_layout(info.page_w_mm, info.page_h_mm, dims)
        questions.append({"id": "no_dieline", "text": f"{layout_error} A template grid was placed; drag the fold lines onto the artwork.", "options": ["ok"]})

    if not layout.get("is_template"):
        _propose_front_by_content(page, layout, texts)

    if layout.get("orientation_source") == "structure":
        questions.append({"id": "orientation", "text": "The text in this file is outlined, so its reading direction cannot be detected. Choose the front and the way it reads under “Front and reading direction”.", "options": ["ok"]})

    p.update({
        "status": "analysed",
        "analysis": {
            "method": info.method,
            "sources": [s.to_dict() for s in info.sources],
            "notes": info.notes + layout.get("notes", []),
            "segments": [s.to_list() for s in info.segments],
            "page_mm": [info.page_w_mm, info.page_h_mm],
            "dieline_rgb": info.dieline_stroke_rgb,
            "line_width_mm": info.dieline_line_width_mm,
            "removed_at_source": info.removed_at_source,
            "hidden_layers": [s.name for s in info.sources if s.kind == "layer" and s.role in pi.HIDDEN_ROLES],
            "clean_report": clean_report,
            "layout_error": layout_error,
            "output_intent": info.output_intent,
            "preview_dpi": PREVIEW_DPI,
        },
        "layout": layout,
        "questions": questions,
        "approved": False,
    })
    p["analysis"]["images"] = images
    p["analysis"]["text_warnings"] = checks.text_warnings(texts)
    _update_measure(p)
    save(p)
    return p


def _small_print_counts(page: pymupdf.Page, layout: dict, texts: list[dict]) -> dict[int, int]:
    """Small items (outlined glyphs, small live text) per body column; the back carries most."""
    rects = {q["struct"]["col"]: dl.panel_rect(layout, q) for q in layout["panels"] if q["struct"]["type"] == "body"}
    counts = {c: 0 for c in rects}

    def add(cx, cy, n=1):
        for c, (x0, y0, x1, y1) in rects.items():
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                counts[c] += n
                return

    k = 25.4 / 72
    for d in page.get_drawings():
        r = d["rect"]
        if d.get("fill") is not None and max(r.width, r.height) * k < 3.0:
            add((r.x0 + r.x1) / 2 * k, (r.y0 + r.y1) / 2 * k)
    for t in texts:
        if t["size"] < 9:
            add((t["bbox"][0] + t["bbox"][2]) / 2, (t["bbox"][1] + t["bbox"][3]) / 2, len(t["text"]))
    return counts


def _propose_front_by_content(page, layout, texts) -> None:
    """Choose between the structurally proposed front and the panel opposite it.

    The back of a pharmaceutical carton carries the dense small print (composition, legal
    text), so the one of the two with clearly less small print is proposed as the front.
    Still only a proposal: the user confirms the front.
    """
    a = layout.get("front_col", 0)
    b = (a + 2) % 4
    counts = _small_print_counts(page, layout, texts)
    lo, hi = sorted((counts.get(a, 0), counts.get(b, 0)))
    if hi >= 20 and hi > 1.5 * max(lo, 1):
        best = a if counts.get(a, 0) <= counts.get(b, 0) else b
        if best != a:
            dl.assign_roles(layout, best, keep_user=False)
        layout["front_reason"] = (f"proposed the panel with the least small print "
                                  f"({lo} small items against {hi} on the panel opposite)")


def _update_measure(p: dict) -> None:
    a = p.get("analysis") or {}
    face_rects = {q["role"]: dl.panel_rect(p["layout"], q) for q in p["layout"]["panels"] if q.get("role") in FACE_ROLES}
    p["artwork_warnings"] = a.get("text_warnings", []) + checks.image_warnings(a.get("images", []), face_rects)
    m = dl.measure(p["layout"])
    p["measure"] = m
    p["dims_compare"] = dl.compare_dimensions(m["box"], p["meta"].get("dimensions"))
    p["dieline_key"] = "x".join(f"{v:.1f}" for v in sorted(m["box"].values())) if m["box"] else None


def update_layout(pid: str, layout: dict, front_panel: str | None = None) -> dict:
    p = load(pid)
    old = p["layout"]
    # keep everything the client may not send, but take lines and panel edits from it
    for k, v in (layout.get("lines") or {}).items():
        if k in old["lines"]:
            old["lines"][k] = {**old["lines"][k], "pos": float(v.get("pos", old["lines"][k]["pos"]))}
    by_id = {q["id"]: q for q in old["panels"]}
    for q in layout.get("panels", []):
        o = by_id.get(q["id"])
        if not o:
            continue
        if "role" in q and q["role"] != o.get("role"):
            o["role"], o["role_source"] = q["role"], "user"
        if "rotation" in q and q["rotation"] % 360 != o.get("rotation", 0):
            if o.get("role") == "front" and o.get("rotation_source") != "user":
                # turning the front turns the whole box (e.g. a carton that lies on its side)
                delta = (q["rotation"] - o.get("rotation", 0)) % 360
                old["front_turn"] = (old.get("front_turn", 0) + delta) % 360
                dl.assign_roles(old, old.get("front_col", 0), keep_user=True)
            else:
                o["rotation"], o["rotation_source"] = q["rotation"] % 360, "user"
    if front_panel:
        fp = by_id[front_panel]
        if fp["struct"]["type"] == "body":
            dl.assign_roles(old, fp["struct"]["col"], keep_user=False)
        else:
            for q in old["panels"]:
                if q.get("role") == "front":
                    q["role"], q["role_source"] = "ignore", "user"
            fp["role"], fp["role_source"] = "front", "user"
        old["front_confirmed"] = True
    if layout.get("front_confirmed"):
        old["front_confirmed"] = True
    p["layout"] = old
    p["approved"] = False
    _update_measure(p)
    save(p)
    return p


def answer(pid: str, qid: str, value: str) -> dict:
    p = load(pid)
    if qid.startswith("source:"):
        sid = qid.split(":", 1)[1]
        overrides = p.get("role_overrides", {})
        overrides[sid] = value
        p["role_overrides"] = overrides
        save(p)
        return analyse(pid, overrides)
    if qid == "dims":
        p["dims_choice"] = value  # "measured" | "stated"
    p["questions"] = [q for q in p.get("questions", []) if q["id"] != qid]
    save(p)
    return p


def set_sources(pid: str, overrides: dict[str, str]) -> dict:
    return analyse(pid, overrides)


# --- panel extraction -------------------------------------------------------------------

def _rotate(img: Image.Image, deg: int) -> Image.Image:
    deg %= 360
    return {0: img, 90: img.transpose(Image.Transpose.ROTATE_270), 180: img.transpose(Image.Transpose.ROTATE_180),
            270: img.transpose(Image.Transpose.ROTATE_90)}[deg]


def _dieline_colour(p: dict, a: dict):
    """sRGB colour of the dieline, sampled at 600 dpi in the centre of long straight segments."""
    segs = [sg for sg in a["segments"] if not sg[5] and ((sg[2] - sg[0]) ** 2 + (sg[3] - sg[1]) ** 2) ** 0.5 > 10]
    if not segs:
        return None
    doc = pymupdf.open(_source_pdf(p))
    page = doc[0]
    vals = []
    step = max(1, len(segs) // 15)
    for x0, y0, x1, y1, _k, _c in segs[::step][:15]:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        img = np.asarray(raster.render_region_srgb(page, (cx - 0.3, cy - 0.3, cx + 0.3, cy + 0.3), 600,
                                                   p["settings"]["icc_profile"], p["settings"]["intent"]))
        c = img[img.shape[0] // 2, img.shape[1] // 2].astype(float)
        vals.append(c)
    return np.median(np.array(vals), axis=0)


def extract_panels(pid: str, dpi: int | None = None) -> dict:
    p = load(pid)
    d = pdir(pid)
    dpi = int(dpi or p["settings"].get("dpi", 600))
    dpi = max(600, dpi)
    a = p["analysis"]
    doc = pymupdf.open(d / "clean.pdf")
    raster.hide_layers(doc, set(a["hidden_layers"]))
    page = doc[0]
    inset = 0.0 if a["removed_at_source"] else max(0.1, a["line_width_mm"] / 2 + 0.08)

    die_rgb = _dieline_colour(p, a)

    results = {}
    faces = {}
    for q in p["layout"]["panels"]:
        role = q.get("role")
        if role in (None, "ignore"):
            continue
        x0, y0, x1, y1 = dl.panel_rect(p["layout"], q)
        rect = (x0 + inset, y0 + inset, x1 - inset, y1 - inset)
        img = raster.render_region_srgb(page, rect, dpi, p["settings"]["icc_profile"], p["settings"]["intent"])
        img = _rotate(img, q.get("rotation", 0))
        out = d / "panels" / f"{q['id']}.png"
        raster.save_png_srgb(img, out)
        arr = np.asarray(img)
        r = {"file": f"panels/{q['id']}.png", "px": [img.width, img.height], "role": role,
             "mm": [round(x1 - x0, 2), round(y1 - y0, 2)]}
        if role in FACE_ROLES:
            r["residue"] = checks.residue_check(arr, die_rgb, dpi / 25.4)
            r["edge_warnings"] = checks.edge_fill_check(arr, dpi / 25.4)
            faces.setdefault(role, q["id"])
        results[q["id"]] = r
    # small previews for the browser (three.js)
    for pid_, r in results.items():
        im = Image.open(d / r["file"])
        im.thumbnail((1024, 1024))
        im.save(d / "panels" / f"{pid_}_preview.jpg", quality=90)
        r["preview"] = f"panels/{pid_}_preview.jpg"
    p["panels"] = results
    p["faces"] = faces
    p["panel_dpi"] = dpi
    p["die_rgb"] = None if die_rgb is None else [float(v) for v in die_rgb]
    missing = [f for f in FACE_ROLES if f not in faces]
    p["panel_warnings"] = ([f"No panel is labelled “{m}”; that face renders as plain board." for m in missing]
                           + [f"{results[i]['role']}: {w}" for i in results for w in results[i].get("edge_warnings", [])]
                           + [f"{results[i]['role']}: dieline-coloured lines remain inside the panel" for i in results
                              if results[i].get("residue", {}).get("status") == "fail"])
    save(p)
    return p


def approve(pid: str) -> dict:
    p = extract_panels(pid)
    p["approved"] = True
    p["status"] = "approved"
    save(p)
    return p


def reuse_layout(pid: str, from_pid: str) -> dict:
    """Apply the approved layout of another project (same dieline, new artwork version)."""
    p = load(pid)
    src = load(from_pid)
    pw, ph = p["analysis"]["page_mm"]
    sw, sh = src["analysis"]["page_mm"]
    if abs(pw - sw) > 1.0 or abs(ph - sh) > 1.0:
        raise ValueError(f"page sizes differ ({pw:.1f} x {ph:.1f} mm vs {sw:.1f} x {sh:.1f} mm)")
    p["layout"] = json.loads(json.dumps(src["layout"]))
    p["layout"]["reused_from"] = from_pid
    p["questions"] = [q for q in p.get("questions", []) if q["id"] not in ("orientation", "no_dieline")]
    _update_measure(p)
    save(p)
    return p


def delete(pid: str) -> None:
    shutil.rmtree(pdir(pid))
