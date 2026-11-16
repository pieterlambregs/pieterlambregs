"""Headless Blender (Cycles) packshot renderer.

Run as a separate process so every render starts from a clean Blender state:
    python -m app.blender_render job.json

Job JSON (all sizes in millimetres):
{
  "boxes": [{"dims": {"width": W, "depth": D, "height": H},
             "faces": {"front": "front.png", "back": ..., "left": ..., "right": ..., "top": ..., "bottom": ...},
             "finish": "matte" | "gloss" | "soft_touch",
             "masks": {"front": {"path": "mask.png", "type": "foil" | "spot_uv"}},
             "position": [x_mm, y_mm], "rotation_z": 0}],
  "camera": {"azimuth": 35, "elevation": 12, "focal": 100, "fill": 0.82, "anchor": [0, 0], "top_down": false},
  "light": {"front_gain": 0.93, "key_side": "auto" | "left" | "right" | "front"},
  "shadow": true,
  "width": 2000, "height": 2000, "samples": 128,
  "out": "render.png", "meta_out": "render.json"
}

World axes: X to the right of the front, Y away from the viewer (front face at -Y), Z up.
Texture orientation per face (u = image right, v = image up):
  front: u=+X v=+Z   right: u=+Y v=+Z   back: u=-X v=+Z   left: u=-Y v=+Z
  top (seen from above, front edge at the bottom of the image): u=+X v=+Y
  bottom (seen from below, front edge at the top of the image):  u=+X v=-Y
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy  # noqa: I001  (bpy must be imported before bmesh)
import bmesh
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector

MM = 0.001
FACE_ORDER = ["front", "right", "back", "left", "top", "bottom"]


# --- scene ------------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.render.film_transparent = True
    s.display_settings.display_device = "sRGB"
    s.view_settings.view_transform = "Standard"  # never Filmic/AgX: colours stay true to the file
    s.view_settings.look = "None"
    s.view_settings.exposure = 0.0
    s.view_settings.gamma = 1.0
    s.cycles.max_bounces = 6
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 3
    s.cycles.transparent_max_bounces = 4
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.sample_clamp_indirect = 5.0
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    s.render.image_settings.color_depth = "8"
    s.unit_settings.system = "METRIC"
    w = bpy.data.worlds.new("World")
    s.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.5
    return s


def _image_node(nt, path, non_color=False):
    img = bpy.data.images.load(str(path), check_existing=True)
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = img
    n.interpolation = "Linear"
    n.extension = "EXTEND"
    return n


FINISHES = {
    #            roughness, specular, coat, coat_rough, sheen
    "matte":      (0.70, 0.25, 0.00, 0.30, 0.00),
    "gloss":      (0.30, 0.50, 0.85, 0.06, 0.00),
    "soft_touch": (0.85, 0.20, 0.00, 0.30, 0.25),
}


def make_material(name, tex_path, finish, mask=None, flat_color=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    rough, spec, coat, coat_r, sheen = FINISHES.get(finish, FINISHES["matte"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_r
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bsdf.inputs["Sheen Roughness"].default_value = 0.6
    if tex_path:
        tex = _image_node(nt, tex_path)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        c = flat_color or (0.9, 0.9, 0.9)
        bsdf.inputs["Base Color"].default_value = (*c, 1.0)
    if mask:
        mk = _image_node(nt, mask["path"], non_color=True)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(mk.outputs["Color"], sep.inputs["Color"])
        mval = sep.outputs["Red"]
        if mask.get("type") == "foil":
            nt.links.new(mval, bsdf.inputs["Metallic"])
            mr = nt.nodes.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value = rough
            mr.inputs["To Max"].default_value = 0.12
            nt.links.new(mval, mr.inputs["Value"])
            nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
        else:  # spot UV: a glossy coat only where the mask is white
            nt.links.new(mval, bsdf.inputs["Coat Weight"])
            bsdf.inputs["Coat Roughness"].default_value = 0.03
    return m


def build_box(spec, idx, calibration=False):
    W = spec["dims"]["width"] * MM
    D = spec["dims"]["depth"] * MM
    H = spec["dims"]["height"] * MM
    me = bpy.data.meshes.new(f"box{idx}")
    bm = bmesh.new()
    x0, x1, y0, y1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2, 0.0, H
    v = {}
    for xi, x in ((0, x0), (1, x1)):
        for yi, y in ((0, y0), (1, y1)):
            for zi, z in ((0, z0), (1, z1)):
                v[(xi, yi, zi)] = bm.verts.new((x, y, z))
    # each face as a CCW loop seen from outside, starting bottom-left of its image
    loops = {
        "front": [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
        "right": [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
        "back": [(1, 1, 0), (0, 1, 0), (0, 1, 1), (1, 1, 1)],
        "left": [(0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)],
        "top": [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
        "bottom": [(0, 1, 0), (1, 1, 0), (1, 0, 0), (0, 0, 0)],
    }
    uv_layer = bm.loops.layers.uv.new("UVMap")
    faces = {}
    for i, name in enumerate(FACE_ORDER):
        f = bm.faces.new([v[k] for k in loops[name]])
        f.material_index = i
        for loop, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            loop[uv_layer].uv = uv
        faces[name] = f
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(f"box{idx}", me)
    bpy.context.collection.objects.link(ob)
    for i, name in enumerate(FACE_ORDER):
        if calibration:
            mat = make_material(f"cal_{idx}_{name}", None, spec.get("finish", "matte"), flat_color=(0.5, 0.5, 0.5))
        else:
            mask = (spec.get("masks") or {}).get(name)
            mat = make_material(f"m_{idx}_{name}", spec["faces"].get(name), spec.get("finish", "matte"), mask)
        me.materials.append(mat)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = 0.3 * MM  # 0.3 mm board edge
    bev.segments = 4
    bev.limit_method = "ANGLE"
    bev.harden_normals = False
    for p in me.polygons:
        p.use_smooth = False
    px, py = spec.get("position", [0, 0])
    rot = spec.get("rotation") or [0.0, 0.0, spec.get("rotation_z", 0.0)]  # degrees about X, Y, Z
    ob.rotation_euler = Euler([math.radians(a) for a in rot], "XYZ")
    ob.location = (px * MM, py * MM, 0.0)
    # rest the lowest point of the box on its base level (the floor, or the box below it)
    bpy.context.view_layer.update()
    ws = [ob.matrix_world @ v.co for v in me.vertices]
    minz = min(w.z for w in ws)
    # turn about the box's own centre: keep its footprint centred on the given position
    cx = (min(w.x for w in ws) + max(w.x for w in ws)) / 2
    cy = (min(w.y for w in ws) + max(w.y for w in ws)) / 2
    ob.location.x += px * MM - cx
    ob.location.y += py * MM - cy
    ob.location.z += spec.get("z", 0.0) * MM - minz
    bpy.context.view_layer.update()
    return ob


def corners_world(ob, spec):
    """World coordinates of the 4 corners of each face, image order: BL, BR, TR, TL."""
    W = spec["dims"]["width"] * MM
    D = spec["dims"]["depth"] * MM
    H = spec["dims"]["height"] * MM
    x0, x1, y0, y1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2, 0.0, H
    P = lambda x, y, z: ob.matrix_world @ Vector((x, y, z))  # noqa: E731
    return {
        "front": [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
        "right": [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
        "back": [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)],
        "left": [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)],
        "top": [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
        "bottom": [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)],
    }


def face_normal(name, ob):
    n = {"front": (0, -1, 0), "right": (1, 0, 0), "back": (0, 1, 0), "left": (-1, 0, 0), "top": (0, 0, 1), "bottom": (0, 0, -1)}[name]
    return (ob.matrix_world.to_3x3() @ Vector(n)).normalized()


# --- camera -----------------------------------------------------------------------------

def setup_camera(scene, cam_spec, boxes, specs, width, height):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = cam_spec.get("focal", 100.0)
    cam_data.sensor_width = 36.0
    cam_data.sensor_fit = "AUTO"
    cam_data.clip_start = 0.01
    cam_data.clip_end = 100.0
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100

    pts = []
    for ob, sp in zip(boxes, specs):
        for face in corners_world(ob, sp).values():
            pts.extend(face)
    pts_np = np.array([[p.x, p.y, p.z] for p in pts])
    center = Vector(((pts_np[:, 0].min() + pts_np[:, 0].max()) / 2,
                     (pts_np[:, 1].min() + pts_np[:, 1].max()) / 2,
                     (pts_np[:, 2].min() + pts_np[:, 2].max()) / 2))
    radius = float(np.linalg.norm(pts_np - np.array(center), axis=1).max())

    az = math.radians(cam_spec.get("azimuth", 35.0))  # + = camera moves to the left of the front
    el = math.radians(cam_spec.get("elevation", 12.0))
    top_down = cam_spec.get("top_down", False) or cam_spec.get("elevation", 0) >= 89.5
    # direction from the subject towards the camera
    d = Vector((-math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    if top_down:
        d = Vector((0, 0, 1))
        cam.rotation_euler = Euler((0, 0, -az), "XYZ")  # looking down, front edge at the bottom
    else:
        # level camera (two-point perspective): pitch 90 deg, only yaw; vertical lines stay vertical
        yaw = math.atan2(-d.x, d.y) + math.pi
        cam.rotation_euler = Euler((math.radians(90.0), 0.0, yaw), "XYZ")

    fill = float(cam_spec.get("fill", 0.82))
    anchor = cam_spec.get("anchor", [0.0, 0.0])  # -1..1 in frame units, e.g. [0.4, 0] = right of centre
    aspect = width / height
    fw, fh = (1.0, 1.0 / aspect) if aspect >= 1 else (aspect, 1.0)  # frame size in shift units

    dist = radius * cam_data.lens / 36.0 * 2.2
    for _ in range(12):
        cam.location = center + d * dist
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        us, vs = [], []
        for p in pts:
            c = inv @ p
            z = -c.z
            us.append(cam_data.lens * c.x / z / 36.0)
            vs.append(cam_data.lens * c.y / z / 36.0)
        u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
        need = max((u1 - u0) / (fw * fill), (v1 - v0) / (fh * fill))
        dist *= need
        if abs(need - 1.0) < 1e-4:
            break
    cam_data.shift_x = (u0 + u1) / 2 - anchor[0] * fw * (1 - fill) / 2
    cam_data.shift_y = (v0 + v1) / 2 - anchor[1] * fh * (1 - fill) / 2
    return cam


# --- lights -----------------------------------------------------------------------------

def setup_lights(scene, light_spec, cam, center, size):
    """Soft key (casts the shadow) + shadowless fill + dim white world."""
    cam_az = math.atan2(-(cam.location.x - center.x), -(cam.location.y - center.y))  # 0 = in front
    side = light_spec.get("key_side", "auto")
    if side == "auto":
        side = "right" if cam_az >= 0 else "left"  # camera sees the left side -> key from the right
    key_az = {"left": math.radians(40), "right": math.radians(-40), "front": 0.0}[side]
    key_el = math.radians(light_spec.get("key_elevation", 42.0))
    dist = size * 6
    kd = Vector((-math.sin(key_az) * math.cos(key_el), -math.cos(key_az) * math.cos(key_el), math.sin(key_el)))

    def area(name, direction, energy, shadow, scale):
        l = bpy.data.lights.new(name, "AREA")
        l.shape = "DISK"
        l.size = size * scale
        l.energy = energy
        l.use_shadow = shadow
        ob = bpy.data.objects.new(name, l)
        ob.location = center + direction * dist
        ob.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        scene.collection.objects.link(ob)
        return ob

    key = area("key", kd, 1.0, True, 2.0)
    fd = Vector((-math.sin(-key_az * 0.6) * 0.9, -0.9, 0.3)).normalized()
    fill = area("fill", fd, 0.35, False, 6.0)  # casts no shadow
    return key, fill


# --- shadow -----------------------------------------------------------------------------

def setup_ground(scene, enabled, size):
    me = bpy.data.meshes.new("ground")
    s = size * 40
    bm = bmesh.new()
    for x, y in ((-s, -s), (s, -s), (s, s), (-s, s)):
        bm.verts.new((x, y, 0.0))
    bm.faces.new(bm.verts)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("ground", me)
    scene.collection.objects.link(ob)
    mat = bpy.data.materials.new("ground")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    me.materials.append(mat)
    ob.is_shadow_catcher = True
    if not enabled:
        ob.hide_render = True
    return ob


# --- render helpers ---------------------------------------------------------------------

def project(scene, cam, p):
    co = world_to_camera_view(scene, cam, p)
    return [co.x * scene.render.resolution_x, (1.0 - co.y) * scene.render.resolution_y]


def _stats_handler(*args):
    # Cycles reports "... | Sample 12/64" in the render statistics; forward it for progress bars
    for a in args:
        if isinstance(a, str) and "Sample" in a:
            print("PROGRESS", a.strip(), flush=True)


def render_to(scene, path, phase="final"):
    print(f"PHASE {phase}", flush=True)
    if _stats_handler not in bpy.app.handlers.render_stats:
        bpy.app.handlers.render_stats.append(_stats_handler)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def srgb_to_lin(v):
    v = np.asarray(v, dtype=float)
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def face_gain(png_path, scene, cam, corners) -> float:
    """Mean linear value of the central part of a face in a calibration render (albedo 0.5)."""
    from PIL import Image
    im = np.asarray(Image.open(png_path).convert("RGBA"), dtype=np.float32) / 255.0
    h, w = im.shape[:2]
    px = np.concatenate([srgb_to_lin(im[..., :3]), im[..., 3:]], axis=-1)
    pts = [project(scene, cam, c) for c in corners]
    # bilinear interior samples (avoid edges)
    vals = []
    for a in np.linspace(0.25, 0.75, 7):
        for b in np.linspace(0.25, 0.75, 7):
            bl, br, tr, tl = [np.array(p) for p in pts]
            p = (1 - b) * ((1 - a) * bl + a * br) + b * ((1 - a) * tl + a * tr)
            x, y = int(p[0]), int(p[1])
            if 0 <= x < w and 0 <= y < h and px[y, x, 3] > 0.5:
                vals.append(px[y, x, :3].mean())
    if not vals:
        return 0.0
    return float(np.median(vals)) / 0.5


def _front_ratio_solver(cal_png, corners_px, src_path, target):
    """Light scale k so that the rendered front has `target` x the file's brightness.

    All lights scale linearly, so the linear render at scale k is k * (render at scale 1):
    one calibration render is enough; k is found by bisection on the encoded ratio.
    """
    import cv2
    from PIL import Image
    rgba = np.asarray(Image.open(cal_png).convert("RGBA"))
    bl, br_, tr, tl = corners_px
    w = int(max(16, np.hypot(br_[0] - bl[0], br_[1] - bl[1])))
    h = int(max(16, np.hypot(tl[0] - bl[0], tl[1] - bl[1])))
    M = cv2.getPerspectiveTransform(np.float32([tl, tr, br_, bl]), np.float32([[0, 0], [w, 0], [w, h], [0, h]]))
    flat = cv2.warpPerspective(rgba, M, (w, h))[..., :3].astype(np.float32) / 255.0
    src = cv2.resize(np.asarray(Image.open(src_path).convert("RGB")), (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    m = max(2, int(0.06 * min(w, h)))
    flat, src = flat[m:-m, m:-m], src[m:-m, m:-m]
    wts = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lin = srgb_to_lin(flat)
    lum_s = (src * wts).sum(-1)
    valid = lum_s > 0.08
    if valid.sum() < 50:
        return None

    def lin_to_srgb(v):
        v = np.clip(v, 0, 1)
        return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)

    def ratio(k):
        enc = lin_to_srgb(lin * k)
        return float(np.median(((enc * wts).sum(-1))[valid] / lum_s[valid]))

    lo, hi = 0.05, 20.0
    for _ in range(40):
        mid = (lo * hi) ** 0.5
        if ratio(mid) < target:
            lo = mid
        else:
            hi = mid
    return (lo * hi) ** 0.5


def fade_shadow(png_path, points_list, size_hint_px):
    """Let the cast shadow fade out smoothly before it reaches the image border.

    Only pixels outside the box silhouette (shadow-only pixels) are touched; their colour is
    set to neutral black and their alpha multiplied by a smooth falloff.
    """
    import cv2
    from PIL import Image
    im = np.asarray(Image.open(png_path).convert("RGBA")).copy()
    h, w = im.shape[:2]
    inside = np.zeros((h, w), np.uint8)
    for pts in points_list:
        hull = cv2.convexHull(np.array(pts, dtype=np.float32)).astype(np.int32)
        cv2.fillConvexPoly(inside, hull, 1)
    inside = cv2.dilate(inside, np.ones((5, 5), np.uint8))
    dist = cv2.distanceTransform((1 - inside).astype(np.uint8), cv2.DIST_L2, 5)
    ys, xs = np.nonzero(inside)
    room = min(xs.min(), ys.min(), w - 1 - xs.max(), h - 1 - ys.max()) if len(xs) else min(w, h) / 4
    d1 = max(4.0, min(0.55 * size_hint_px, room - 3))
    d0 = 0.15 * d1
    t = np.clip((dist - d0) / max(1e-6, d1 - d0), 0, 1)
    fade = 1 - t * t * (3 - 2 * t)
    out = inside == 0
    a = im[..., 3].astype(np.float32)
    a[out] *= fade[out]
    im[..., 3] = np.round(a).astype(np.uint8)
    im[out, :3] = 0
    Image.fromarray(im).save(png_path)


def main(job_path):
    job = json.loads(Path(job_path).read_text())
    width, height = int(job["width"]), int(job["height"])
    specs = job["boxes"]
    target = float(job.get("light", {}).get("front_gain", 0.93))

    def build(calibration):
        scene = reset_scene()
        boxes = [build_box(sp, i, False) for i, sp in enumerate(specs)]
        bpy.context.view_layer.update()
        cam = setup_camera(scene, job.get("camera", {}), boxes, specs, width if not calibration else 320,
                           height if not calibration else max(1, int(320 * height / width)))
        all_pts = [p for ob, sp in zip(boxes, specs) for f in corners_world(ob, sp).values() for p in f]
        center = sum(all_pts, Vector()) / len(all_pts)
        size = max(max(sp["dims"].values()) for sp in specs) * MM
        key, fill = setup_lights(scene, job.get("light", {}), cam, center, size)
        setup_ground(scene, bool(job.get("shadow", True)), size)
        return scene, boxes, cam, key, fill

    out = Path(job["out"])
    hero = 0
    k = 1.0
    cal = {"method": "none"}
    if specs[hero]["faces"].get("front"):
        # 1. calibration render with the real artwork, small
        scene, boxes, cam, key, fill = build(True)
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
        cal_path = out.with_name(out.stem + "_cal.png")
        render_to(scene, cal_path, phase="calibration")
        cw = corners_world(boxes[hero], specs[hero])
        corners = [project(scene, cam, c) for c in cw["front"]]
        visible = face_normal("front", boxes[hero]).dot((cam.location - sum(cw["front"], Vector()) / 4).normalized()) > 0.05
        kk = _front_ratio_solver(cal_path, corners, specs[hero]["faces"]["front"], target) if visible else None
        if kk:
            k = kk
            cal = {"method": "front artwork", "target_ratio": target, "light_scale": k}
        try:
            cal_path.unlink()
        except OSError:
            pass

    # 2. the real render with calibrated light levels
    scene, boxes, cam, key, fill = build(False)
    key.data.energy *= k
    fill.data.energy *= k
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value *= k
    scene.cycles.samples = int(job.get("samples", 128))
    render_to(scene, out)

    meta = {"width": width, "height": height, "boxes": []}
    cam_loc = cam.location
    for ob, sp in zip(boxes, specs):
        faces = {}
        for name, cs in corners_world(ob, sp).items():
            centroid = sum(cs, Vector()) / 4
            visible = face_normal(name, ob).dot((cam_loc - centroid).normalized()) > 0.05
            faces[name] = {"corners_px": [project(scene, cam, c) for c in cs], "visible": bool(visible)}
        hull = [project(scene, cam, p) for f in corners_world(ob, sp).values() for p in f]
        meta["boxes"].append({"faces": faces, "points_px": hull})
    meta["calibration"] = cal
    if job.get("shadow", True):
        size_px = max(max(abs(p[0] - q[0]), abs(p[1] - q[1])) for b in meta["boxes"] for p in b["points_px"] for q in b["points_px"][:1])
        fade_shadow(out, [b["points_px"] for b in meta["boxes"]], max(size_px, 50))
    Path(job["meta_out"]).write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main(sys.argv[-1])
