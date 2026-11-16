"""Render jobs. Run by an RQ worker (Docker) or a local thread (development)."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
import traceback
import uuid
from pathlib import Path

from PIL import Image

from . import export, project as P, verify

BACKEND = Path(__file__).resolve().parents[1]

VIEWS = {
    # name: (azimuth deg, elevation deg); + azimuth = camera to the left of the front
    "three_quarter_left": (35.0, 10.0),
    "three_quarter_right": (-35.0, 10.0),
    "front": (0.0, 0.0),
    "front_top": (0.0, 15.0),  # straight front, camera raised: front undistorted, top visible
    "top_down": (0.0, 90.0),
    "hero": (28.0, 24.0),
}
VIEW_LABELS = {"three_quarter_left": "34-left", "three_quarter_right": "34-right", "front": "front", "front_top": "front-top",
               "top_down": "top-down", "hero": "hero"}

DEFAULT_SCENE = {
    "views": ["three_quarter_left"],
    "azimuth": None, "elevation": None, "front_top_elevation": 15.0, "focal": 100, "fill": 0.8, "anchor": [0.0, 0.0],
    "finish": "matte", "shadow": True, "key_side": "auto", "front_gain": 0.93,
    "background": "transparent", "long_side": 2000, "aspect": "1:1", "custom_w": None, "custom_h": None,
    "formats": ["png", "jpg", "pdf"], "jpg_background": "#ffffff", "pdf_info_strip": True,
    "samples": None,
    "group": None,  # {"projects": [pid, ...], "spacing_mm": 12, "depth_offset_mm": 25}
    # Free composition (overrides group): the first entry is the hero box used for light
    # calibration and verification. [{"project": pid, "x": mm, "y": mm, "z": mm, "rotation": [rx, ry, rz]}]
    "arrangement": None,
    "title": None,  # used instead of the source file name in output file names
}
PRESETS_FILE = P.DATA / "presets.json"


# --- render records ---------------------------------------------------------------------

def rdir(pid: str, rid: str) -> Path:
    if "/" in rid or ".." in rid:
        raise KeyError(rid)
    return P.pdir(pid) / "renders" / rid


def read_record(pid: str, rid: str) -> dict:
    return json.loads((rdir(pid, rid) / "record.json").read_text())


def write_record(pid: str, rid: str, rec: dict) -> None:
    d = rdir(pid, rid)
    tmp = d / "record.json.tmp"
    tmp.write_text(json.dumps(rec, indent=1))
    tmp.replace(d / "record.json")


def list_records(pid: str) -> list[dict]:
    root = P.pdir(pid) / "renders"
    out = []
    if root.exists():
        for d in root.iterdir():
            try:
                out.append(read_record(pid, d.name))
            except (OSError, json.JSONDecodeError):
                pass
    return sorted(out, key=lambda r: -r["created"])


# --- presets ----------------------------------------------------------------------------

def load_presets() -> dict:
    if PRESETS_FILE.exists():
        return json.loads(PRESETS_FILE.read_text())
    return {"last": DEFAULT_SCENE, "named": {}}


def save_presets(p: dict) -> None:
    PRESETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PRESETS_FILE.write_text(json.dumps(p, indent=1))


# --- job building -----------------------------------------------------------------------

def _box_corners(b: dict) -> list[tuple[float, float, float]]:
    """World corners (mm) of a placed box, same conventions as the renderer."""
    import math
    W, D, H = b["dims"]["width"], b["dims"]["depth"], b["dims"]["height"]
    rx, ry, rz = [math.radians(v) for v in b.get("rotation", [0, 0, 0])]

    def rot(p):
        x, y, z = p
        y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
        x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
        x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
        return x, y, z

    pts = [rot((sx * W / 2, sy * D / 2, z)) for sx in (-1, 1) for sy in (-1, 1) for z in (0, H)]
    minz = min(p[2] for p in pts)
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    px, py = b.get("position", [0, 0])
    return [(p[0] - cx + px, p[1] - cy + py, p[2] - minz + b.get("z", 0)) for p in pts]


def check_no_overlap(boxes: list[dict], tol: float = 0.2) -> None:
    """Refuse compositions in which boxes would pass through each other (separating axes)."""
    import numpy as np

    def axes(c):
        c = np.array(c)
        # edges of a box: from corner 0 along its three directions
        e = [c[1] - c[0], c[2] - c[0], c[4] - c[0]]
        return [v / np.linalg.norm(v) for v in e if np.linalg.norm(v) > 1e-9]

    cs = [np.array(_box_corners(b)) for b in boxes]
    for i in range(len(cs)):
        for j in range(i + 1, len(cs)):
            a, b = cs[i], cs[j]
            ax = axes(a) + axes(b)
            ax += [np.cross(u, v) for u in axes(a) for v in axes(b) if np.linalg.norm(np.cross(u, v)) > 1e-6]
            separated = False
            for v in ax:
                v = v / np.linalg.norm(v)
                pa, pb = a @ v, b @ v
                if pa.max() <= pb.min() + tol or pb.max() <= pa.min() + tol:
                    separated = True
                    break
            if not separated:
                raise ValueError(f"boxes {i + 1} and {j + 1} of the composition overlap")

def box_dims(p: dict) -> dict:
    box = dict(p["measure"]["box"])
    cmpd = p.get("dims_compare") or {}
    if p.get("dims_choice") == "stated" and cmpd.get("stated_mm"):
        # map the stated numbers onto the measured axes by rank
        order = sorted(box, key=lambda k: box[k])
        for k, v in zip(order, sorted(cmpd["stated_mm"])):
            box[k] = v
    return box


def box_spec(p: dict, finish: str) -> dict:
    d = P.pdir(p["id"])
    faces = {role: str(d / p["panels"][panel_id]["file"]) for role, panel_id in p["faces"].items()}
    masks = {}
    for role, m in (p.get("masks") or {}).items():
        if (d / m["file"]).exists():
            masks[role] = {"path": str(d / m["file"]), "type": m["type"]}
    return {"dims": box_dims(p), "faces": faces, "finish": finish, "masks": masks}


def build_job(p: dict, scene: dict, view: str, out_png: Path, meta_json: Path) -> dict:
    az, el = VIEWS[view]
    if view == "front_top" and scene.get("front_top_elevation") is not None:
        el = float(scene["front_top_elevation"])
    if scene.get("azimuth") is not None and view not in ("front", "top_down", "front_top"):
        az = float(scene["azimuth"]) * (1 if az >= 0 else -1)
    if scene.get("elevation") is not None and view not in ("front", "top_down", "front_top"):
        el = float(scene["elevation"])
    w, h = export.resolution(int(scene["long_side"]), scene["aspect"], scene.get("custom_w"), scene.get("custom_h"))
    boxes = [box_spec(p, scene["finish"])]
    if scene.get("arrangement"):
        boxes = []
        for a in scene["arrangement"]:
            q = P.load(a["project"])
            if not q.get("approved"):
                raise ValueError(f"project {q['filename']} is not approved yet")
            b = box_spec(q, scene["finish"])
            b["position"] = [float(a.get("x", 0)), float(a.get("y", 0))]
            b["z"] = float(a.get("z", 0))
            b["rotation"] = [float(v) for v in a.get("rotation", [0, 0, 0])]
            boxes.append(b)
        check_no_overlap(boxes)
    group = {} if scene.get("arrangement") else (scene.get("group") or {})
    if group.get("projects"):
        spacing = float(group.get("spacing_mm", 12))
        depth = float(group.get("depth_offset_mm", 25))
        x = boxes[0]["dims"]["width"] / 2
        for i, other in enumerate(group["projects"], start=1):
            q = P.load(other)
            if not q.get("approved"):
                raise ValueError(f"project {q['filename']} is not approved yet")
            b = box_spec(q, scene["finish"])
            x += spacing + b["dims"]["width"] / 2
            b["position"] = [x, i * depth]
            x += b["dims"]["width"] / 2
            boxes.append(b)
        # centre the row on the hero box
        shift = (x - boxes[0]["dims"]["width"] / 2) / 2
        boxes[0]["position"] = [-shift, 0.0]
        for b in boxes[1:]:
            b["position"][0] -= shift
    samples = scene.get("samples") or (64 if max(w, h) <= 2500 else 32)
    return {
        "boxes": boxes,
        "camera": {"azimuth": az, "elevation": el, "focal": float(scene["focal"]), "fill": float(scene["fill"]),
                   "anchor": scene.get("anchor") or [0, 0], "top_down": view == "top_down"},
        "light": {"front_gain": float(scene.get("front_gain", 0.93)), "key_side": scene.get("key_side", "auto")},
        "shadow": bool(scene["shadow"]),
        "width": w, "height": h, "samples": int(samples),
        "out": str(out_png), "meta_out": str(meta_json),
    }


# --- the job ----------------------------------------------------------------------------

_SAMPLE_RE = re.compile(r"Sample (\d+)/(\d+)")


def _run_blender(job_path: Path, on_progress) -> None:
    proc = subprocess.Popen([sys.executable, "-W", "ignore", "-m", "app.blender_render", str(job_path)],
                            cwd=BACKEND, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    tail = []
    passes = 0
    for line in proc.stdout:
        tail = (tail + [line])[-40:]
        if line.startswith("PHASE"):
            passes = 0 if "calibration" in line else 1
            on_progress(passes, 0.0)
            continue
        m = _SAMPLE_RE.search(line)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            on_progress(passes, a / max(1, b))
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError("Blender failed:\n" + "".join(tail[-15:]))


def render_job(pid: str, rid: str) -> None:
    rec = read_record(pid, rid)
    d = rdir(pid, rid)
    try:
        p = P.load(pid)
        scene = rec["scene"]
        views = rec["views"]
        n = len(views)
        rec["status"] = "running"
        rec["started"] = time.time()
        write_record(pid, rid, rec)
        meta_info = p["meta"]
        info = {"product": " ".join(x for x in (meta_info.get("brand"), meta_info.get("product")) if x),
                "dimensions": " x ".join(f"{v:g}" for v in box_dims(p).values()) + " mm",
                "version": meta_info.get("version"), "date": meta_info.get("date_code")}
        for vi, view in enumerate(views):
            out_png = d / f"{view}_raw.png"
            meta_json = d / f"{view}_meta.json"
            job = build_job(p, scene, view, out_png, meta_json)
            (d / f"{view}_job.json").write_text(json.dumps(job, indent=1))

            def prog(passes, frac, vi=vi):
                # pass 0 = calibration (10 %), pass 1 = final render (90 %)
                part = 0.1 * frac if passes == 0 else 0.1 + 0.9 * frac
                rec["progress"] = round((vi + min(part, 1.0)) / n, 3)
                rec["stage"] = f"{VIEW_LABELS[view]}: {'calibrating light' if passes == 0 else 'rendering'}"
                write_record(pid, rid, rec)

            _run_blender(d / f"{view}_job.json", prog)
            rec["stage"] = f"{VIEW_LABELS[view]}: verifying"
            write_record(pid, rid, rec)
            meta = json.loads(meta_json.read_text())
            faces_src = job["boxes"][0]["faces"]
            report = verify.verify(out_png, meta, faces_src, job["shadow"], d / f"{view}_verify.png")
            files = export.write_outputs(out_png, d, scene.get("title") or p["meta"]["source_name"], VIEW_LABELS[view], scene["formats"],
                                         scene["background"], scene["jpg_background"], scene["pdf_info_strip"], info)
            thumb = Image.open(out_png)
            thumb.thumbnail((800, 800))
            thumb.save(d / f"{view}_thumb.png")
            rec["outputs"].append({"view": view, "label": VIEW_LABELS[view], "files": files,
                                   "thumb": f"{view}_thumb.png", "verify": report,
                                   "verify_image": f"{view}_verify.png" if report.get("image") else None,
                                   "size": [job["width"], job["height"]]})
            write_record(pid, rid, rec)
        rec["status"] = "failed_verification" if any(o["verify"]["status"] == "fail" for o in rec["outputs"]) else "done"
        rec["progress"] = 1.0
        rec["stage"] = "finished"
    except Exception as e:  # noqa: BLE001
        rec["status"] = "error"
        rec["error"] = f"{e}"
        rec["trace"] = traceback.format_exc()[-3000:]
    rec["finished"] = time.time()
    write_record(pid, rid, rec)


def enqueue_render(pid: str, scene_in: dict) -> dict:
    p = P.load(pid)
    if not p.get("approved"):
        raise ValueError("Approve the panel layout first.")
    scene = {**DEFAULT_SCENE, **{k: v for k, v in scene_in.items() if k in DEFAULT_SCENE}}
    views = [v for v in scene["views"] if v in VIEWS] or ["three_quarter_left"]
    rid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4]
    rdir(pid, rid).mkdir(parents=True)
    rec = {"id": rid, "project": pid, "created": time.time(), "status": "queued", "progress": 0.0, "stage": "queued",
           "scene": scene, "views": views, "outputs": []}
    write_record(pid, rid, rec)
    presets = load_presets()
    presets["last"] = scene
    save_presets(presets)

    redis_url = os.environ.get("REDIS_URL")
    if redis_url:
        from redis import Redis
        from rq import Queue
        Queue("renders", connection=Redis.from_url(redis_url)).enqueue(
            render_job, pid, rid, job_timeout=6 * 3600, result_ttl=3600)
    else:
        _local_queue.append((pid, rid))
        _ensure_local_worker()
    return rec


# development fallback: one background thread, renders one at a time
_local_queue: list = []
_local_lock = threading.Lock()
_local_thread: threading.Thread | None = None


def _ensure_local_worker():
    global _local_thread
    with _local_lock:
        if _local_thread and _local_thread.is_alive():
            return

        def loop():
            while _local_queue:
                pid, rid = _local_queue.pop(0)
                render_job(pid, rid)

        _local_thread = threading.Thread(target=loop, daemon=True)
        _local_thread.start()
