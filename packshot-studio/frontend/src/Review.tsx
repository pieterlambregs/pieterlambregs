import { useEffect, useMemo, useRef, useState } from "react";
import { api, fileUrl, Layout, LibraryItem, Options, Panel, Project, ROLE_LABEL } from "./api";

type Props = {
  project: Project;
  options: Options;
  library: LibraryItem[];
  onChange: (p: Project) => void;
  onApproved: () => void;
  busy: (fn: () => Promise<unknown>, label: string) => Promise<void>;
};

const ROLE_COLOUR: Record<string, string> = {
  front: "#e4572e",
  back: "#2e86ab",
  left: "#7a5195",
  right: "#7a5195",
  top: "#2a9d8f",
  bottom: "#2a9d8f",
  glue_flap: "#999",
  tuck_flap_top: "#b5a642",
  tuck_flap_bottom: "#b5a642",
  dust_flap: "#bbb",
  inner_flap: "#bbb",
  ignore: "#ccc",
};

function rectOf(layout: Layout, p: Panel) {
  const L = layout.lines;
  const xs = [L[p.edges.l].pos, L[p.edges.r].pos].sort((a, b) => a - b);
  const ys = [L[p.edges.t].pos, L[p.edges.b].pos].sort((a, b) => a - b);
  return { x0: xs[0], x1: xs[1], y0: ys[0], y1: ys[1] };
}

export default function Review({ project, options, library, onChange, onApproved, busy }: Props) {
  const [layout, setLayout] = useState<Layout>(project.layout);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [showLines, setShowLines] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => setLayout(project.layout), [project.layout]);

  const { w: pw, h: ph } = layout.page;
  const sel = layout.panels.find((p) => p.id === selected) || null;

  // extent of each line = union of the panel edges that use it
  const lineExtents = useMemo(() => {
    const ext: Record<string, [number, number]> = {};
    for (const p of layout.panels) {
      const r = rectOf(layout, p);
      for (const [side, id] of Object.entries(p.edges)) {
        const span: [number, number] = side === "l" || side === "r" ? [r.y0, r.y1] : [r.x0, r.x1];
        const e = ext[id];
        ext[id] = e ? [Math.min(e[0], span[0]), Math.max(e[1], span[1])] : span;
      }
    }
    return ext;
  }, [layout]);

  const toMM = (ev: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = svg.getScreenCTM()!.inverse();
    const q = pt.matrixTransform(m);
    return { x: q.x, y: q.y };
  };

  const onMove = (ev: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = toMM(ev);
    const l = layout.lines[drag];
    const pos = Math.round((l.orient === "v" ? x : y) * 20) / 20; // 0.05 mm steps
    setLayout({ ...layout, lines: { ...layout.lines, [drag]: { ...l, pos } } });
  };
  const onUp = () => {
    if (!drag) return;
    const id = drag;
    setDrag(null);
    busy(() => api.layout(project.id, { lines: { [id]: layout.lines[id] } }).then(onChange), "Updating layout");
  };

  const setRole = (p: Panel, role: string) =>
    busy(() => api.layout(project.id, { panels: [{ ...p, role }] }).then(onChange), "Relabelling");
  const rotate = (p: Panel, by: number) =>
    busy(() => api.layout(project.id, { panels: [{ ...p, rotation: (p.rotation + by + 360) % 360 }] }).then(onChange), "Rotating");
  const makeFront = (p: Panel) => busy(() => api.layout(project.id, {}, p.id).then(onChange), "Setting front");

  const sameDieline = library.filter((x) => x.id !== project.id && x.approved && x.dieline_key && x.dieline_key === project.dieline_key);
  const dc = project.dims_compare;
  const a = project.analysis;
  const measured = project.measure;

  return (
    <div className="review">
      <div className="sheet-wrap">
        <div className="toolbar">
          <label>
            <input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} /> Fold lines
          </label>
          <button onClick={() => busy(() => api.rotateSheet(project.id, 2).then(onChange), "Turning sheet")}>Sheet upside down? Turn 180°</button>
          <button onClick={() => busy(() => api.rotateSheet(project.id, 1).then(onChange), "Turning sheet")}>Turn 90°</button>
          <span className="muted">Drag a line to move it. Click a panel to relabel or rotate it. Labels read in the panel's upright direction.</span>
        </div>
        <svg
          ref={svgRef}
          className="sheet"
          viewBox={`0 0 ${pw} ${ph}`}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <image href={fileUrl(project.id, "sheet.png", project.created)} x={0} y={0} width={pw} height={ph} />
          {layout.panels.map((p) => {
            const r = rectOf(layout, p);
            const cx = (r.x0 + r.x1) / 2;
            const cy = (r.y0 + r.y1) / 2;
            const small = Math.min(r.x1 - r.x0, r.y1 - r.y0);
            const fs = Math.max(2, Math.min(4.2, small / 7));
            const col = ROLE_COLOUR[p.role] || "#888";
            return (
              <g key={p.id} onClick={() => setSelected(p.id)} className="panel">
                <rect
                  x={r.x0}
                  y={r.y0}
                  width={r.x1 - r.x0}
                  height={r.y1 - r.y0}
                  fill={col}
                  fillOpacity={selected === p.id ? 0.35 : 0.12}
                  stroke={selected === p.id ? col : "none"}
                  strokeWidth={0.6}
                />
                <g transform={`translate(${cx} ${cy}) rotate(${-p.rotation})`}>
                  <rect x={-fs * 4.2} y={-fs * 1.1} width={fs * 8.4} height={fs * 2.2} rx={fs * 0.4} fill="white" fillOpacity={0.75} />
                  <text textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill={col} fontWeight={700}>
                    {p.role === "front" ? "★ " : ""}
                    {ROLE_LABEL[p.role] || p.role} ↑
                  </text>
                </g>
              </g>
            );
          })}
          {showLines &&
            Object.entries(layout.lines).map(([id, l]) => {
              const e = lineExtents[id];
              if (!e) return null;
              const [a0, a1] = e;
              const v = l.orient === "v";
              const coords = v ? { x1: l.pos, x2: l.pos, y1: a0, y2: a1 } : { x1: a0, x2: a1, y1: l.pos, y2: l.pos };
              return (
                <g key={id}>
                  <line {...coords} stroke={l.kind === "crease" ? "#00a0ff" : "#ff2bd0"} strokeWidth={0.35} strokeDasharray={l.kind === "crease" ? "2 1" : undefined} />
                  <line
                    {...coords}
                    stroke="transparent"
                    strokeWidth={3}
                    style={{ cursor: v ? "ew-resize" : "ns-resize" }}
                    onPointerDown={(ev) => {
                      (ev.target as Element).setPointerCapture?.(ev.pointerId);
                      setDrag(id);
                    }}
                  />
                </g>
              );
            })}
        </svg>
      </div>

      <aside className="side">
        {project.questions.length > 0 && (
          <section className="card ask">
            <h3>Please confirm</h3>
            {project.questions.map((q) => (
              <div key={q.id} className="q">
                <p>{q.text}</p>
                {q.options.map((o) => (
                  <button key={o} onClick={() => busy(() => api.answer(project.id, q.id, o).then(onChange), "Saving")}>
                    {o}
                  </button>
                ))}
              </div>
            ))}
          </section>
        )}

        {!layout.front_confirmed && (
          <section className="card ask">
            <h3>Which panel is the front?</h3>
            <p className="muted">Proposed: ★ {layout.panels.find((p) => p.role === "front")?.id} ({layout.front_reason}).</p>
            <button
              onClick={() => {
                const f = layout.panels.find((p) => p.role === "front");
                if (f) makeFront(f);
              }}
            >
              Yes, that is the front
            </button>
            <span className="muted"> or select another panel and press “Make front”.</span>
          </section>
        )}

        <section className="card">
          <h3>Scale check</h3>
          {measured.box ? (
            <p>
              Measured on the dieline: <b>{measured.box.width.toFixed(1)}</b> (front width) × <b>{measured.box.depth.toFixed(1)}</b> (depth) ×{" "}
              <b>{measured.box.height.toFixed(1)}</b> (height) mm
            </p>
          ) : (
            <p className="warn">No box could be measured.</p>
          )}
          {dc.status === "match" && (
            <p className="ok">
              ✓ Matches the file name “{dc.stated_raw}” read as {dc.reading} (max difference {dc.max_diff_mm} mm).
            </p>
          )}
          {dc.status === "mismatch" && (
            <div className="warn">
              <p>
                ✗ The file name says “{dc.stated_raw}”; that does not match the dieline (max difference {dc.max_diff_mm} mm).
              </p>
              {dc.readings &&
                Object.entries(dc.readings).map(([k, v]) => (
                  <p key={k} className="muted">
                    read as {k}: {v.join(" × ")} mm
                  </p>
                ))}
              <p>Which is right?</p>
              <button className={project.dims_choice === "measured" ? "on" : ""} onClick={() => busy(() => api.answer(project.id, "dims", "measured").then(onChange), "Saving")}>
                The dieline ({dc.measured_mm?.join(" × ")} mm)
              </button>
              <button className={project.dims_choice === "stated" ? "on" : ""} onClick={() => busy(() => api.answer(project.id, "dims", "stated").then(onChange), "Saving")}>
                The file name ({dc.stated_mm?.join(" × ")} mm)
              </button>
            </div>
          )}
          {dc.status === "no_stated" && <p className="muted">The file name states no dimensions.</p>}
          {measured.issues.map((i) => (
            <p key={i} className="warn">
              ⚠ {i}
            </p>
          ))}
          <table className="sizes">
            <tbody>
              {layout.panels
                .filter((p) => !["ignore", "dust_flap", "inner_flap"].includes(p.role))
                .map((p) => (
                  <tr key={p.id}>
                    <td>{ROLE_LABEL[p.role]}</td>
                    <td>
                      {measured.panels[p.id]?.w.toFixed(2)} × {measured.panels[p.id]?.h.toFixed(2)} mm
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {sel && (
          <section className="card">
            <h3>Panel {sel.id}</h3>
            <label>
              Label{" "}
              <select value={sel.role} onChange={(e) => setRole(sel, e.target.value)}>
                {options.roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <button onClick={() => rotate(sel, -90)}>⟲ 90°</button>
              <button onClick={() => rotate(sel, 90)}>⟳ 90°</button>
              <button onClick={() => rotate(sel, 180)}>180°</button>
              <span className="muted">now {sel.rotation}°</span>
            </div>
            <button onClick={() => makeFront(sel)}>★ Make front</button>
          </section>
        )}

        <section className="card">
          <h3>Dieline detection</h3>
          <p>
            Method: <b>{{ spot: "spot colour", layer: "layer", color: "line colour (flattened file)", none: "none (template grid)" }[a.method] || a.method}</b>
            {a.removed_at_source && <span className="ok"> · marks removed from the file before rasterising</span>}
          </p>
          {a.notes.map((n) => (
            <p key={n} className="warn">
              ⚠ {n}
            </p>
          ))}
          {a.sources.length > 0 && (
            <table className="sizes">
              <tbody>
                {a.sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.kind}: <b>{s.name}</b>
                    </td>
                    <td>
                      <select
                        value={s.role}
                        onChange={(e) =>
                          busy(() => api.sources(project.id, { ...Object.fromEntries(a.sources.map((x) => [x.id, x.role])), [s.id]: e.target.value }).then(onChange), "Re-analysing")
                        }
                      >
                        {["dieline", "cut", "crease", "technical", "finish", "artwork"].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                        {s.role === "ask" && <option>ask</option>}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <label>
            Source profile{" "}
            <select value={project.settings.icc_profile} onChange={(e) => busy(() => api.settings(project.id, { icc_profile: e.target.value }).then(onChange), "Re-analysing")}>
              {Object.entries(options.icc_profiles).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Raster resolution{" "}
            <select value={project.settings.dpi} onChange={(e) => busy(() => api.settings(project.id, { dpi: Number(e.target.value) }).then(onChange), "Saving")}>
              <option value={600}>600 dpi</option>
              <option value={1200}>1200 dpi</option>
            </select>
          </label>
        </section>

        {project.artwork_warnings.length > 0 && (
          <section className="card">
            <h3>Artwork warnings</h3>
            <p className="muted">Shown as in the file; nothing is repaired.</p>
            {project.artwork_warnings.map((w) => (
              <p key={w} className="warn">
                ⚠ {w}
              </p>
            ))}
          </section>
        )}

        {sameDieline.length > 0 && (
          <section className="card">
            <h3>Same dieline in the library</h3>
            {sameDieline.map((x) => (
              <div key={x.id} className="row">
                <span>{x.filename}</span>
                <button onClick={() => busy(() => api.reuse(project.id, x.id).then(onChange), "Reusing layout")}>Reuse its layout</button>
              </div>
            ))}
          </section>
        )}

        <button
          className="primary big"
          disabled={!layout.front_confirmed || (dc.status === "mismatch" && !project.dims_choice) || project.questions.some((q) => q.id.startsWith("source:"))}
          onClick={() =>
            busy(
              () =>
                api.approve(project.id).then((p) => {
                  onChange(p);
                  onApproved();
                }),
              "Cropping panels at " + project.settings.dpi + " dpi",
            )
          }
        >
          Approve layout & crop panels
        </button>
        {!layout.front_confirmed && <p className="muted">Confirm the front first.</p>}
        {dc.status === "mismatch" && !project.dims_choice && <p className="muted">Choose the right dimensions first.</p>}
      </aside>
    </div>
  );
}
