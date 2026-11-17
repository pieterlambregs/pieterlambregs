"""Packshot Studio API."""
from __future__ import annotations

import io
import json
from pathlib import Path

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image

from . import export, project as P, raster, tasks

app = FastAPI(title="Packshot Studio")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ALLOWED = P.PDF_EXT | P.RASTER_EXT


def _get(pid: str) -> dict:
    try:
        return P.load(pid)
    except KeyError:
        raise HTTPException(404, "project not found") from None


def _public(p: dict) -> dict:
    q = {k: v for k, v in p.items() if k != "analysis"}
    a = dict(p.get("analysis") or {})
    q["analysis"] = a
    q["renders"] = tasks.list_records(p["id"])
    return q


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/options")
def options():
    return {
        "icc_profiles": {k: v[0] for k, v in raster.PROFILES.items()},
        "views": {k: tasks.VIEW_LABELS[k] for k in tasks.VIEWS},
        "aspects": list(export.ASPECTS) + ["custom"],
        "finishes": ["true_color", "matte", "gloss", "soft_touch"],
        "roles": ["front", "back", "left", "right", "top", "bottom", "glue_flap", "tuck_flap_top",
                  "tuck_flap_bottom", "dust_flap", "inner_flap", "ignore"],
        "default_scene": tasks.DEFAULT_SCENE,
    }


# --- projects ---------------------------------------------------------------------------

@app.post("/api/projects")
async def upload(files: list[UploadFile] = File(...)):
    out = []
    for f in files:
        ext = (f.filename or "").rsplit(".", 1)[-1].lower()
        if ext not in ALLOWED:
            out.append({"filename": f.filename, "error": f"unsupported file type .{ext}"})
            continue
        p = P.create(f.filename, await f.read())
        p = P.analyse(p["id"])
        out.append(_public(p))
    return out


@app.get("/api/projects")
def projects():
    return P.list_projects()


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    return _public(_get(pid))


@app.delete("/api/projects/{pid}")
def delete_project(pid: str):
    _get(pid)
    P.delete(pid)
    return {"ok": True}


@app.put("/api/projects/{pid}/meta")
def put_meta(pid: str, meta: dict = Body(...)):
    p = _get(pid)
    for k in ("date_code", "brand", "product", "pack_size", "version", "tags"):
        if k in meta:
            p["meta"][k] = meta[k]
    P.save(p)
    return _public(p)


@app.put("/api/projects/{pid}/settings")
def put_settings(pid: str, settings: dict = Body(...)):
    p = _get(pid)
    if settings.get("icc_profile") in raster.PROFILES:
        p["settings"]["icc_profile"] = settings["icc_profile"]
    if settings.get("intent") in raster.INTENTS:
        p["settings"]["intent"] = settings["intent"]
    if settings.get("dpi") in (600, 1200):
        p["settings"]["dpi"] = settings["dpi"]
    P.save(p)
    p = P.analyse(pid)
    return _public(p)


@app.put("/api/projects/{pid}/colour-match")
def put_colour_match(pid: str, body: dict = Body(...)):
    """{"label": "brand RGB draft", "pairs": [[[r,g,b], [r,g,b]], ...]} or {} to switch off."""
    p = _get(pid)
    pairs = body.get("pairs") or []
    for a, b in pairs:
        if len(a) != 3 or len(b) != 3 or not all(0 <= v <= 255 for v in [*a, *b]):
            raise HTTPException(400, "pairs must be [[r,g,b],[r,g,b]] with values 0-255")
    p["settings"]["colour_match"] = {"label": body.get("label", "reference"), "pairs": pairs} if pairs else None
    P.save(p)
    if p.get("approved"):
        p = P.extract_panels(pid)
    return _public(p)


@app.put("/api/projects/{pid}/layout")
def put_layout(pid: str, body: dict = Body(...)):
    _get(pid)
    try:
        p = P.update_layout(pid, body.get("layout", {}), body.get("front_panel"))
    except KeyError as e:
        raise HTTPException(400, f"unknown panel {e}") from None
    return _public(p)


@app.post("/api/projects/{pid}/sources")
def post_sources(pid: str, body: dict = Body(...)):
    _get(pid)
    return _public(P.set_sources(pid, body.get("overrides", {})))


@app.post("/api/projects/{pid}/answer")
def post_answer(pid: str, body: dict = Body(...)):
    _get(pid)
    return _public(P.answer(pid, body["id"], body["value"]))


@app.post("/api/projects/{pid}/rotate-sheet")
def rotate_sheet(pid: str, body: dict = Body(...)):
    p = _get(pid)
    k = (p["layout"].get("sheet_rotation", 0) + int(body.get("quarter_turns", 2))) % 4
    p = P.analyse(pid, None, force_rotation=k)
    return _public(p)


@app.post("/api/projects/{pid}/approve")
def approve(pid: str):
    _get(pid)
    return _public(P.approve(pid))


@app.post("/api/projects/{pid}/reuse-layout")
def reuse(pid: str, body: dict = Body(...)):
    _get(pid)
    try:
        return _public(P.reuse_layout(pid, body["from"]))
    except (KeyError, ValueError) as e:
        raise HTTPException(400, str(e)) from None


@app.post("/api/projects/{pid}/masks/{role}")
async def upload_mask(pid: str, role: str, type: str = "spot_uv", file: UploadFile = File(...)):
    p = _get(pid)
    if role not in p.get("faces", {}):
        raise HTTPException(400, "approve the layout first; masks belong to a face")
    if type not in ("spot_uv", "foil"):
        raise HTTPException(400, "type must be spot_uv or foil")
    panel = p["panels"][p["faces"][role]]
    im = Image.open(io.BytesIO(await file.read())).convert("L").resize(tuple(panel["px"]), Image.Resampling.LANCZOS)
    rel = f"masks/{role}.png"
    (P.pdir(pid) / "masks").mkdir(exist_ok=True)
    im.save(P.pdir(pid) / rel)
    p.setdefault("masks", {})[role] = {"file": rel, "type": type}
    P.save(p)
    return _public(p)


@app.delete("/api/projects/{pid}/masks/{role}")
def delete_mask(pid: str, role: str):
    p = _get(pid)
    (p.get("masks") or {}).pop(role, None)
    P.save(p)
    return _public(p)


@app.get("/api/projects/{pid}/file/{path:path}")
def project_file(pid: str, path: str):
    _get(pid)
    root = P.pdir(pid).resolve()
    f = (root / path).resolve()
    if root not in f.parents or not f.is_file() or f.name == "project.json":
        raise HTTPException(404)
    return FileResponse(f, headers={"Cache-Control": "no-cache"})


# --- renders ----------------------------------------------------------------------------

@app.post("/api/projects/{pid}/renders")
def post_render(pid: str, scene: dict = Body(...)):
    _get(pid)
    try:
        return tasks.enqueue_render(pid, scene)
    except ValueError as e:
        raise HTTPException(400, str(e)) from None


@app.get("/api/projects/{pid}/renders/{rid}")
def get_render(pid: str, rid: str):
    try:
        return tasks.read_record(pid, rid)
    except (KeyError, OSError):
        raise HTTPException(404) from None


@app.get("/api/projects/{pid}/renders/{rid}/zip")
def render_zip(pid: str, rid: str):
    rec = get_render(pid, rid)
    d = tasks.rdir(pid, rid)
    files = [(d / f["name"], f["name"]) for o in rec["outputs"] for f in o["files"]]
    p = _get(pid)
    name = f"{p['meta']['source_name']}_{rid}.zip"
    return Response(export.zip_files(files), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.get("/api/projects/{pid}/zip")
def project_zip(pid: str):
    p = _get(pid)
    files = []
    for rec in tasks.list_records(pid):
        d = tasks.rdir(pid, rec["id"])
        files += [(d / f["name"], f"{rec['id']}/{f['name']}") for o in rec["outputs"] for f in o["files"]]
    return Response(export.zip_files(files), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{p["meta"]["source_name"]}_all.zip"'})


# --- presets ----------------------------------------------------------------------------

@app.get("/api/presets")
def get_presets():
    return tasks.load_presets()


@app.put("/api/presets/{name}")
def put_preset(name: str, scene: dict = Body(...)):
    pr = tasks.load_presets()
    pr["named"][name] = scene
    tasks.save_presets(pr)
    return pr


@app.delete("/api/presets/{name}")
def delete_preset(name: str):
    pr = tasks.load_presets()
    pr["named"].pop(name, None)
    tasks.save_presets(pr)
    return pr


# --- static frontend (production build) ------------------------------------------------
_static = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _static.exists():
    app.mount("/", StaticFiles(directory=_static, html=True), name="ui")
