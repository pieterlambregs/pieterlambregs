"""Turn dieline segments into a folding-carton layout: fold lines and labelled panels.

All coordinates are millimetres on the page (origin top-left, y down).

The layout model is deliberately simple so it can be edited in the browser:
  lines:  {id: {"orient": "v"|"h", "pos": mm, "kind": "crease"|"cut"}}
  panels: [{"id", "role", "edges": {"l","r","t","b" -> line id}, "rotation", "struct", ...}]
Panels reference lines, so dragging a fold line moves every panel that touches it.

The builder works in a canonical frame in which the carton body stands upright (main
panels side by side, top flaps above). Sheets drawn rotated are handled by rotating the
segments into that frame first (sheet_rotation = k * 90 degrees clockwise).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

ROLES = [
    "front", "back", "left", "right", "top", "bottom",
    "glue_flap", "tuck_flap_top", "tuck_flap_bottom", "tuck_flap_left", "tuck_flap_right",
    "dust_flap", "inner_flap", "ignore",
]


class DielineNotFound(Exception):
    pass


# --- frame rotation ---------------------------------------------------------------------

def _to_canon(x, y, k, W, H):
    """Page point -> canonical point for a sheet that must be turned k*90deg clockwise."""
    k %= 4
    if k == 0:
        return x, y
    if k == 1:
        return H - y, x
    if k == 2:
        return W - x, H - y
    return y, W - x


def _from_canon(cx, cy, k, W, H):
    k %= 4
    if k == 0:
        return cx, cy
    if k == 1:
        return cy, H - cx
    if k == 2:
        return W - cx, H - cy
    return W - cy, cx


def _canon_size(k, W, H):
    return (W, H) if k % 2 == 0 else (H, W)


# --- line merging -----------------------------------------------------------------------

@dataclass
class MLine:
    pos: float
    a: float
    b: float
    crease_len: float = 0.0
    cut_len: float = 0.0

    @property
    def length(self):
        return self.b - self.a

    @property
    def kind(self):
        return "crease" if self.crease_len > self.cut_len else "cut"


def _merge(segs, vertical: bool, pos_tol=0.35, gap_tol=3.0) -> list[MLine]:
    """Merge collinear axis-aligned segments (all kinds together) into long lines."""
    items = []
    for x0, y0, x1, y1, kind, curve in segs:
        if curve:
            continue
        if vertical and abs(x1 - x0) <= 0.08 and abs(y1 - y0) > 0.3:
            items.append(((x0 + x1) / 2, min(y0, y1), max(y0, y1), kind))
        elif not vertical and abs(y1 - y0) <= 0.08 and abs(x1 - x0) > 0.3:
            items.append(((y0 + y1) / 2, min(x0, x1), max(x0, x1), kind))
    items.sort()
    groups: list[list] = []
    for it in items:
        if groups and it[0] - groups[-1][-1][0] <= pos_tol:
            groups[-1].append(it)
        else:
            groups.append([it])
    out: list[MLine] = []
    for g in groups:
        total = sum(i[2] - i[1] for i in g) or 1.0
        pos = sum(i[0] * (i[2] - i[1]) for i in g) / total
        g.sort(key=lambda i: i[1])
        cur = None
        for _p, a, b, kind in g:
            if cur is not None and a - cur.b <= gap_tol:
                cur.b = max(cur.b, b)
            else:
                cur = MLine(pos, a, b)
                out.append(cur)
            if kind == "crease":
                cur.crease_len += b - a
            else:
                cur.cut_len += b - a
    return out


def _sample_points(segs, step=1.0):
    pts = []
    for x0, y0, x1, y1, _k, _c in segs:
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        for i in range(n + 1):
            t = i / n
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    return pts


# --- the builder ------------------------------------------------------------------------

def _build_canonical(segs, cw, ch) -> dict:
    """segs: list of (x0,y0,x1,y1,kind,curve) in the canonical frame."""
    if not segs:
        raise DielineNotFound("no dieline lines")
    xs_all = [v for s in segs for v in (s[0], s[2])]
    ys_all = [v for s in segs for v in (s[1], s[3])]
    bx0, bx1, by0, by1 = min(xs_all), max(xs_all), min(ys_all), max(ys_all)
    bw = bx1 - bx0

    hl = _merge(segs, vertical=False, pos_tol=1.1)  # dust-flap creases may be offset ~0.5 mm
    vl = _merge(segs, vertical=True)
    if len(hl) < 2 or len(vl) < 5:
        raise DielineNotFound("too few straight lines")

    # Body top and bottom: the two long horizontal lines that bound a band crossed by the
    # most full-height vertical lines.
    # A body edge may be interrupted (thumb notch, slot): pieces on the same line count
    # together, spanning from the first to the last piece.
    spans: list[MLine] = []
    for l in sorted(hl, key=lambda l: l.pos):
        if spans and abs(l.pos - spans[-1].pos) <= 0.6:
            sp = spans[-1]
            sp.a, sp.b = min(sp.a, l.a), max(sp.b, l.b)
            sp.crease_len += l.crease_len
            sp.cut_len += l.cut_len
        else:
            spans.append(MLine(l.pos, l.a, l.b, l.crease_len, l.cut_len))
    long_h = sorted([l for l in spans if (l.b - l.a) >= 0.55 * bw and (l.crease_len + l.cut_len) >= 0.4 * bw],
                    key=lambda l: l.pos)
    best = None
    for i in range(len(long_h)):
        for j in range(i + 1, len(long_h)):
            t, b = long_h[i], long_h[j]
            if b.pos - t.pos < 8.0:
                continue
            ov0, ov1 = max(t.a, b.a), min(t.b, b.b)
            if ov1 - ov0 < 0.5 * bw:
                continue
            cross = [v for v in vl if v.a <= t.pos + 1.2 and v.b >= b.pos - 1.2 and ov0 - 1.0 <= v.pos <= ov1 + 1.0]
            if len(cross) < 5:
                continue
            score = (len(cross), min(t.crease_len + t.cut_len, b.crease_len + b.cut_len))
            if best is None or score > best[0]:
                best = (score, t, b, cross)
    if best is None:
        raise DielineNotFound("no carton body found (need two fold lines crossed by at least five vertical lines)")
    _score, top, bot, cross = best
    y_top, y_bot = top.pos, bot.pos
    xs = sorted(v.pos for v in cross)
    kinds = {round(v.pos, 3): v.kind for v in cross}

    # Choose 5 consecutive lines whose 4 columns alternate (W, D, W, D).
    def pattern_err(i):
        w = [xs[i + j + 1] - xs[i + j] for j in range(4)]
        if min(w) < 5.0:
            return 1e9
        return abs(w[0] - w[2]) + abs(w[1] - w[3])

    start = min(range(len(xs) - 4), key=pattern_err)
    err = pattern_err(start)
    if err >= 1e9:
        raise DielineNotFound("vertical fold lines do not form four panels")
    fx = xs[start:start + 5]
    widths = [fx[i + 1] - fx[i] for i in range(4)]
    notes = []
    if err > 3.0:
        notes.append(
            f"Opposite panels differ by {err:.1f} mm in width; please check the fold lines."
        )

    pts = _sample_points(segs)

    lines: dict[str, dict] = {}
    panels: list[dict] = []

    def add_line(lid, orient, pos, kind):
        lines[lid] = {"orient": orient, "pos": round(pos, 3), "kind": kind}
        return lid

    for i, x in enumerate(fx):
        add_line(f"v{i}", "v", x, kinds.get(round(x, 3), "crease"))
    add_line("h_top", "h", y_top, "crease")
    add_line("h_bot", "h", y_bot, "crease")

    # Per-column fold position on the top/bottom edge (dust-flap creases are often offset).
    def column_h(i, side):
        base = y_top if side == "top" else y_bot
        x0, x1 = fx[i], fx[i + 1]
        cands = [l for l in _merge(segs, vertical=False, pos_tol=0.2)
                 if abs(l.pos - base) <= 1.3 and min(l.b, x1) - max(l.a, x0) >= 0.6 * (x1 - x0)]
        if not cands:
            return "h_top" if side == "top" else "h_bot"
        c = min(cands, key=lambda l: abs(l.pos - base))
        if abs(c.pos - base) <= 0.15:
            return "h_top" if side == "top" else "h_bot"
        return add_line(f"h_{side}_{i}", "h", c.pos, "crease")

    body_edges = []
    for i in range(4):
        t, b = column_h(i, "top"), column_h(i, "bot")
        body_edges.append((t, b))
        panels.append({
            "id": f"body{i}", "struct": {"type": "body", "col": i},
            "edges": {"l": f"v{i}", "r": f"v{i + 1}", "t": t, "b": b},
        })

    # Glue flap: dieline geometry beside the body, within the body's height.
    def side_extent(left: bool):
        edge = fx[0] if left else fx[4]
        sel = [p[0] for p in pts if y_top + 1.5 < p[1] < y_bot - 1.5 and ((p[0] < edge - 1.0) if left else (p[0] > edge + 1.0))]
        if not sel:
            return 0.0, edge
        ext = min(sel) if left else max(sel)
        return abs(ext - edge), ext

    for left in (True, False):
        depth, ext = side_extent(left)
        if depth >= 3.0 and depth <= 0.75 * min(widths):
            lid = add_line("v_glue", "v", ext, "cut")
            edges = {"l": lid, "r": "v0", "t": "h_top", "b": "h_bot"} if left else {"l": "v4", "r": lid, "t": "h_top", "b": "h_bot"}
            panels.append({"id": "glue", "struct": {"type": "glue", "side": "l" if left else "r"}, "edges": edges})
            break

    # Flaps above and below each body column.
    hl_fine = _merge(segs, vertical=False, pos_tol=0.35)
    for side in ("top", "bottom"):
        up = side == "top"
        for i in range(4):
            x0, x1 = fx[i], fx[i + 1]
            base_id = body_edges[i][0 if up else 1]
            base = lines[base_id]["pos"]
            sel = [p[1] for p in pts if x0 + 1.5 < p[0] < x1 - 1.5 and ((p[1] < base - 1.5) if up else (p[1] > base + 1.5))]
            if not sel:
                continue
            ext = min(sel) if up else max(sel)
            depth = abs(ext - base)
            if depth < 3.0:
                continue
            inner = [
                l for l in hl_fine
                if min(l.b, x1) - max(l.a, x0) >= 0.6 * (x1 - x0)
                and 3.0 < abs(l.pos - base) < depth - 3.0
                and ((l.pos < base) if up else (l.pos > base))
            ]
            ext_id = add_line(f"h_{side}_ext_{i}", "h", ext, "cut")
            if inner:
                # The lid is as deep as the neighbouring panel is wide.
                expect = widths[(i + 1) % 4]
                c = min(inner, key=lambda l: abs(abs(l.pos - base) - expect))
                cid = add_line(f"h_{side}_lid_{i}", "h", c.pos, "crease")
                lid_edges = {"l": f"v{i}", "r": f"v{i + 1}", "t": cid, "b": base_id} if up else {"l": f"v{i}", "r": f"v{i + 1}", "t": base_id, "b": cid}
                tuck_edges = {"l": f"v{i}", "r": f"v{i + 1}", "t": ext_id, "b": cid} if up else {"l": f"v{i}", "r": f"v{i + 1}", "t": cid, "b": ext_id}
                panels.append({"id": f"{side}_lid_{i}", "struct": {"type": "flap", "side": side, "col": i, "part": "lid"}, "edges": lid_edges})
                panels.append({"id": f"{side}_tuck_{i}", "struct": {"type": "flap", "side": side, "col": i, "part": "tuck"}, "edges": tuck_edges})
            else:
                e = {"l": f"v{i}", "r": f"v{i + 1}", "t": ext_id, "b": base_id} if up else {"l": f"v{i}", "r": f"v{i + 1}", "t": base_id, "b": ext_id}
                panels.append({"id": f"{side}_flap_{i}", "struct": {"type": "flap", "side": side, "col": i, "part": "flap", "depth": round(depth, 2)}, "edges": e})

    # Flaps without a tuck crease: a full-depth flap is a closing panel, the rest are dust flaps.
    for side in ("top", "bottom"):
        has_lid = any(p["struct"].get("part") == "lid" and p["struct"].get("side") == side for p in panels)
        plain = [p for p in panels if p["struct"].get("part") == "flap" and p["struct"].get("side") == side]
        if not plain:
            continue
        deepest = max(p["struct"]["depth"] for p in plain)
        closing_set = False
        for p in sorted(plain, key=lambda p: -p["struct"]["depth"]):
            col = p["struct"]["col"]
            full = p["struct"]["depth"] >= 0.85 * widths[(col + 1) % 4]
            if not has_lid and not closing_set and full and p["struct"]["depth"] >= 0.9 * deepest:
                p["struct"]["part"] = "lid"
                closing_set = True
            elif not has_lid and full:
                p["struct"]["part"] = "inner"
            else:
                p["struct"]["part"] = "dust"

    return {"lines": lines, "panels": panels, "widths": widths, "height": y_bot - y_top,
            "pattern_err": err, "notes": notes, "n_cross": len(cross)}


# --- roles and rotations ----------------------------------------------------------------

_BODY_ORDER = ["front", "right", "back", "left"]  # walking to the right on the flat sheet
_TOP_ROT = {"front": 0, "back": 180, "right": 270, "left": 90}
_BOTTOM_ROT = {"front": 0, "back": 180, "right": 90, "left": 270}


def propose_front(panels: list[dict], widths: list[float]) -> tuple[int, str]:
    """Propose (never decide) which body column is the front. Returns (column, reason)."""
    top_lid_cols = [p["struct"]["col"] for p in panels
                    if p["struct"].get("part") == "lid" and p["struct"].get("side") == "top"]
    wide = max(widths)
    wide_cols = [i for i in range(4) if widths[i] >= wide - 1.0]
    if len(wide_cols) == 4:
        if top_lid_cols:
            return (top_lid_cols[0] + 2) % 4, "all four panels are equally wide; proposed the panel opposite the top lid"
        return 0, "all four panels are equally wide; proposed the first panel"
    for c in wide_cols:
        if c not in top_lid_cols:
            return c, "proposed the wide panel that does not carry the top lid"
    return wide_cols[0], "proposed the first wide panel"


# Rolling the box a quarter turn clockwise (as seen from the front) when its front artwork
# reads sideways: the face that was on top goes to the right, and so on. Every face image
# turns with it: +90 deg, except the back, which turns -90 deg when seen from behind.
_ROLL_CW = {"top": "right", "right": "bottom", "bottom": "left", "left": "top", "front": "front", "back": "back",
            "tuck_flap_top": "tuck_flap_right", "tuck_flap_bottom": "tuck_flap_left",
            "tuck_flap_right": "tuck_flap_bottom", "tuck_flap_left": "tuck_flap_top"}


def _roll(role: str, rot: int, turns: int) -> tuple[str, int]:
    for _ in range(turns % 4):
        new = _ROLL_CW.get(role, role)
        rot = (rot + (270 if role == "back" else 90 if role in _ROLL_CW else 0)) % 360
        role = new
    return role, rot


def assign_roles(layout: dict, front_col: int, keep_user: bool = True) -> None:
    """Set role and default rotation of every panel from the fold topology.

    Rotation is the clockwise turn applied to the cropped panel so that it is upright for
    its face: body faces seen from outside, top seen from above with the front edge at the
    bottom of the view, bottom seen from below with the front edge at the top of the view.
    layout["front_turn"] (0/90/180/270) turns the whole box when the front artwork reads
    sideways on the structural carton (a box that lies on its side, tuck ends left/right).
    Panels the user relabelled or rotated by hand are left alone when keep_user is set.
    """
    k = layout.get("sheet_rotation", 0)
    turn = layout.get("front_turn", 0) % 360
    col_role = {(front_col + j) % 4: _BODY_ORDER[j] for j in range(4)}
    layout["front_col"] = front_col
    for p in layout["panels"]:
        s = p["struct"]
        topo = 0
        if s["type"] == "body":
            role = col_role[s["col"]]
        elif s["type"] == "glue":
            role = "glue_flap"
        else:
            host = col_role[s["col"]]
            part, side = s.get("part"), s.get("side")
            if part == "lid":
                role = side
                topo = (_TOP_ROT if side == "top" else _BOTTOM_ROT)[host]
            elif part == "tuck":
                role = f"tuck_flap_{side}"
                topo = (_TOP_ROT if side == "top" else _BOTTOM_ROT)[host]
            elif part == "inner":
                role = "inner_flap"
            else:
                role = "dust_flap"
        rot = (k * 90 + topo) % 360
        role, rot = _roll(role, rot, turn // 90)
        if not (keep_user and p.get("role_source") == "user"):
            p["role"] = role
            p["role_source"] = "fold"
        if not (keep_user and p.get("rotation_source") == "user"):
            p["rotation"] = rot
            p["rotation_source"] = "fold"
        p["is_front"] = p.get("role") == "front"


# --- public API -------------------------------------------------------------------------

def _rotate_layout_to_page(canon: dict, k: int, W: float, H: float) -> dict:
    lines = {}
    for lid, l in canon["lines"].items():
        if l["orient"] == "v":
            x, y = _from_canon(l["pos"], 0.0, k, W, H)
        else:
            x, y = _from_canon(0.0, l["pos"], k, W, H)
        flip = k % 2 == 1
        orient = ("h" if l["orient"] == "v" else "v") if flip else l["orient"]
        lines[lid] = {"orient": orient, "pos": round(x if orient == "v" else y, 3), "kind": l["kind"]}
    panels = []
    for p in canon["panels"]:
        ids = list(p["edges"].values())
        vs = sorted([i for i in ids if lines[i]["orient"] == "v"], key=lambda i: lines[i]["pos"])
        hs = sorted([i for i in ids if lines[i]["orient"] == "h"], key=lambda i: lines[i]["pos"])
        q = dict(p)
        q["edges"] = {"l": vs[0], "r": vs[1], "t": hs[0], "b": hs[1]}
        panels.append(q)
    return {"lines": lines, "panels": panels}


def panel_rect(layout: dict, panel: dict) -> tuple[float, float, float, float]:
    L = layout["lines"]
    e = panel["edges"]
    x0, x1 = sorted((L[e["l"]]["pos"], L[e["r"]]["pos"]))
    y0, y1 = sorted((L[e["t"]]["pos"], L[e["b"]]["pos"]))
    return x0, y0, x1, y1


def text_vote(layout: dict, lines_of_text: list[dict], body_only: bool = True) -> dict[int, float]:
    """Characters of live text per reading angle (page frame) inside the body panels."""
    votes: dict[int, float] = {}
    rects = [panel_rect(layout, p) for p in layout["panels"] if not body_only or p["struct"]["type"] == "body"]
    for t in lines_of_text:
        cx, cy = (t["bbox"][0] + t["bbox"][2]) / 2, (t["bbox"][1] + t["bbox"][3]) / 2
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in rects):
            a = int(round(t["angle"] / 90.0)) % 4 * 90
            votes[a] = votes.get(a, 0) + len(t["text"].strip())
    return votes


def build_layout(segments: list, page_w: float, page_h: float,
                 text: list[dict] | None = None, force_rotation: int | None = None) -> dict:
    """Build the editable layout. Raises DielineNotFound if no carton can be recognised."""
    def attempt(k):
        cw, ch = _canon_size(k, page_w, page_h)
        csegs = []
        for x0, y0, x1, y1, kind, curve in segments:
            a = _to_canon(x0, y0, k, page_w, page_h)
            b = _to_canon(x1, y1, k, page_w, page_h)
            csegs.append((a[0], a[1], b[0], b[1], kind, curve))
        return _build_canonical(csegs, cw, ch)

    orientation_source = "structure"
    if force_rotation is not None:
        k = force_rotation % 4
        canon = attempt(k)
        orientation_source = "user"
    else:
        results = {}
        errors = []
        for k in (0, 1):
            try:
                results[k] = attempt(k)
            except DielineNotFound as e:
                errors.append(str(e))
        if not results:
            raise DielineNotFound(errors[0])
        k = max(results, key=lambda kk: (results[kk]["n_cross"], -results[kk]["pattern_err"]))
        canon = results[k]

    layout = _rotate_layout_to_page(canon, k, page_w, page_h)
    layout.update({
        "page": {"w": round(page_w, 3), "h": round(page_h, 3)},
        "sheet_rotation": k,
        "notes": list(canon["notes"]),
    })

    # Upright or upside down? Structure cannot tell; live text on the body panels can.
    if force_rotation is None:
        votes = text_vote(layout, text or [])
        upright, flipped = votes.get((360 - k * 90) % 360, 0), votes.get((180 - k * 90) % 360, 0)
        if flipped > upright * 1.5 and flipped >= 10:
            k = (k + 2) % 4
            canon = attempt(k)
            layout = _rotate_layout_to_page(canon, k, page_w, page_h)
            layout.update({"page": {"w": round(page_w, 3), "h": round(page_h, 3)},
                           "sheet_rotation": k, "notes": list(canon["notes"])})
            orientation_source = "text"
        elif upright >= 10 and upright > flipped * 1.5:
            orientation_source = "text"
    layout["orientation_source"] = orientation_source  # "text" | "structure" (unconfirmed) | "user"

    front, reason = propose_front(layout["panels"], canon["widths"])
    assign_roles(layout, front, keep_user=False)
    layout["front_confirmed"] = False
    layout["front_reason"] = reason
    return layout


def template_layout(page_w: float, page_h: float, dims_mm: list[float] | None) -> dict:
    """A starting grid for files in which no dieline could be detected (user drags it)."""
    d = sorted(dims_mm or [60.0, 40.0, 100.0])
    depth, width, height = (d[0], d[1], d[2]) if len(d) == 3 else (40.0, 60.0, 100.0)
    glue = 12.0
    total_w = glue + 2 * (width + depth)
    total_h = height + 2 * depth
    s = min(1.0, (page_w * 0.9) / total_w, (page_h * 0.9) / total_h)
    width, depth, height, glue = width * s, depth * s, height * s, glue * s
    x = (page_w - (glue + 2 * (width + depth))) / 2
    y = (page_h - (height + 2 * depth)) / 2 + depth
    segs = []
    xs = [x + glue, x + glue + width, x + glue + width + depth, x + glue + 2 * width + depth, x + glue + 2 * (width + depth)]
    for xx in xs:
        segs.append((xx, y, xx, y + height, "crease", False))
    segs.append((x, y, xs[-1], y, "crease", False))
    segs.append((x, y + height, xs[-1], y + height, "crease", False))
    segs.append((x, y + 2, x, y + height - 2, "cut", False))
    for yy in (y - depth, y + height + depth):
        segs.append((xs[0], yy, xs[1], yy, "cut", False))
    layout = build_layout(segs, page_w, page_h)
    layout["is_template"] = True
    return layout


def measure(layout: dict) -> dict:
    """Panel sizes in mm and the box dimensions they imply."""
    sizes = {}
    by_role: dict[str, list] = {}
    for p in layout["panels"]:
        x0, y0, x1, y1 = panel_rect(layout, p)
        w, h = x1 - x0, y1 - y0
        if layout.get("sheet_rotation", 0) % 2 == 1:
            w, h = h, w  # report width/height as on the upright carton
        if layout.get("front_turn", 0) % 180 == 90:
            w, h = h, w  # the box lies on its side
        sizes[p["id"]] = {"w": round(w, 2), "h": round(h, 2)}
        by_role.setdefault(p["role"], []).append((w, h))

    def avg(role_a, role_b, idx):
        vals = [s[idx] for r in (role_a, role_b) for s in by_role.get(r, [])]
        return sum(vals) / len(vals) if vals else None

    width = avg("front", "back", 0)
    depth = avg("left", "right", 0)
    height_vals = [s[1] for r in ("front", "back", "left", "right") for s in by_role.get(r, [])]
    height = sum(height_vals) / len(height_vals) if height_vals else None

    # The box itself is defined by the four body panels (flaps are cut slightly smaller to
    # fit inside). Use them whenever they exist, then apply the turn of a lying box.
    body = {p["struct"]["col"]: p for p in layout["panels"] if p["struct"].get("type") == "body"}
    if len(body) == 4 and "front_col" in layout:
        def struct_wh(p):
            x0, y0, x1, y1 = panel_rect(layout, p)
            w, h = x1 - x0, y1 - y0
            return (h, w) if layout.get("sheet_rotation", 0) % 2 == 1 else (w, h)
        fc = layout["front_col"]
        wh = {c: struct_wh(p) for c, p in body.items()}
        W = (wh[fc][0] + wh[(fc + 2) % 4][0]) / 2
        D = (wh[(fc + 1) % 4][0] + wh[(fc + 3) % 4][0]) / 2
        H = sum(v[1] for v in wh.values()) / 4
        if layout.get("front_turn", 0) % 180 == 90:
            width, height, depth = H, W, D
        else:
            width, height, depth = W, H, D
    issues = []

    def pair(a, b, idx, label):
        va, vb = by_role.get(a), by_role.get(b)
        if va and vb and abs(va[0][idx] - vb[0][idx]) > 1.0:
            issues.append(f"{a} and {b} differ in {label}: {va[0][idx]:.2f} mm vs {vb[0][idx]:.2f} mm")

    pair("front", "back", 0, "width")
    pair("left", "right", 0, "width")
    for lid in ("top", "bottom"):
        if by_role.get(lid) and width and depth:
            w, h = by_role[lid][0]
            a, b = sorted((w, h))
            lo, hi = sorted((width, depth))
            if abs(a - lo) > 1.5 or abs(b - hi) > 1.5:
                issues.append(f"{lid} panel is {w:.2f} x {h:.2f} mm but the box footprint is {width:.2f} x {depth:.2f} mm")
    box = None
    if width and depth and height:
        box = {"width": round(width, 2), "depth": round(depth, 2), "height": round(height, 2)}
    return {"panels": sizes, "box": box, "issues": issues}


def compare_dimensions(measured_box: dict | None, parsed_dims: dict | None) -> dict:
    """Compare the measured box with the dimensions stated in the file name.

    The file name may be in mm or in tenths of a mm; the order of the three numbers is not
    assumed. status: "match" | "mismatch" | "no_stated" | "no_measured".
    """
    if not parsed_dims:
        return {"status": "no_stated"}
    if not measured_box:
        return {"status": "no_measured", "stated_raw": parsed_dims["raw"]}
    m = sorted([measured_box["width"], measured_box["depth"], measured_box["height"]])
    readings = [("mm", parsed_dims["as_written_mm"])]
    if parsed_dims.get("unit") != "cm":  # "1085x695x695mm" is often tenths of a mm
        readings.append(("tenths of a mm", parsed_dims["as_tenths_mm"]))
    best = None
    for label, vals in readings:
        s = sorted(vals)
        diffs = [abs(a - b) for a, b in zip(m, s)]
        ok = all(d <= max(0.6, 0.005 * b) for d, b in zip(diffs, s))
        cand = {"reading": label, "stated_mm": vals, "max_diff_mm": round(max(diffs), 2), "ok": ok}
        if best is None or cand["max_diff_mm"] < best["max_diff_mm"]:
            best = cand
    return {
        "status": "match" if best["ok"] else "mismatch",
        "stated_raw": parsed_dims["raw"],
        "reading": best["reading"],
        "stated_mm": best["stated_mm"],
        "readings": {label: vals for label, vals in readings},
        "measured_mm": [measured_box["width"], measured_box["depth"], measured_box["height"]],
        "max_diff_mm": best["max_diff_mm"],
    }
