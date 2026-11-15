import { useEffect, useMemo, useState } from "react";
import { api, LibraryItem, Options, Project, Scene } from "./api";
import Preview3D from "./Preview3D";

type Props = {
  project: Project;
  options: Options;
  library: LibraryItem[];
  onChange: (p: Project) => void;
  onRender: (scene: Scene) => void;
  busy: (fn: () => Promise<unknown>, label: string) => Promise<void>;
};

const ANCHORS: Record<string, [number, number]> = {
  centre: [0, 0],
  "right (space for copy on the left)": [1, 0],
  "left (space for copy on the right)": [-1, 0],
  "low (space above)": [0, -1],
};

export default function SceneSetup({ project, options, library, onChange, onRender, busy }: Props) {
  const [scene, setScene] = useState<Scene>(options.default_scene);
  const [presets, setPresets] = useState<{ last: Scene; named: Record<string, Scene> } | null>(null);
  const [previewView, setPreviewView] = useState("three_quarter_left");
  const [groupProjects, setGroupProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.presets().then((p) => {
      setPresets(p);
      setScene({ ...options.default_scene, ...p.last, group: null });
      setPreviewView((p.last.views || ["three_quarter_left"])[0]);
    });
  }, [options]);

  const groupIds = scene.group?.projects || [];
  useEffect(() => {
    Promise.all(groupIds.map((id) => api.project(id))).then(setGroupProjects);
  }, [groupIds.join(",")]);

  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => setScene((s) => ({ ...s, [k]: v }));
  const toggle = (k: "views" | "formats", v: string) =>
    setScene((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  const boxes = useMemo(() => {
    const list: { project: Project; position: [number, number] }[] = [{ project, position: [0, 0] }];
    if (scene.group && groupProjects.length) {
      let x = project.measure.box!.width / 2;
      groupProjects.forEach((q, i) => {
        x += scene.group!.spacing_mm + q.measure.box!.width / 2;
        list.push({ project: q, position: [x, (i + 1) * scene.group!.depth_offset_mm] });
        x += q.measure.box!.width / 2;
      });
      const shift = (x - project.measure.box!.width / 2) / 2;
      list.forEach((b) => (b.position = [b.position[0] - shift, b.position[1]]));
    }
    return list;
  }, [project, groupProjects, scene.group?.spacing_mm, scene.group?.depth_offset_mm]);

  const approvedOthers = library.filter((x) => x.approved && x.id !== project.id);
  const faces = ["front", "back", "left", "right", "top", "bottom"].filter((f) => project.faces?.[f]);

  return (
    <div className="scene">
      <div className="preview-col">
        <div className="row">
          {Object.entries(options.views).map(([k, label]) => (
            <button key={k} className={previewView === k ? "on" : ""} onClick={() => setPreviewView(k)}>
              {label}
            </button>
          ))}
        </div>
        <Preview3D boxes={boxes} scene={scene} view={previewView} />
        <p className="muted">
          Live preview (WebGL). The final render is Cycles with calibrated studio light; framing and camera match this preview.
        </p>
        {project.panel_warnings && project.panel_warnings.length > 0 && (
          <div className="card">
            <h3>Panel checks</h3>
            {project.panel_warnings.map((w) => (
              <p key={w} className="warn">
                ⚠ {w}
              </p>
            ))}
            <p className="muted">These are rendered exactly as in the file.</p>
          </div>
        )}
      </div>

      <aside className="side">
        <section className="card">
          <h3>Views to render</h3>
          <div className="row wrap">
            {Object.entries(options.views).map(([k, label]) => (
              <label key={k} className="chip">
                <input type="checkbox" checked={scene.views.includes(k)} onChange={() => toggle("views", k)} /> {label}
              </label>
            ))}
          </div>
          <label>
            Angle (3/4 and hero) {scene.azimuth ?? "preset"}°
            <input type="range" min={10} max={60} value={scene.azimuth ?? 35} onChange={(e) => set("azimuth", Number(e.target.value))} />
          </label>
          <label>
            Camera height {scene.elevation ?? "preset"}°
            <input type="range" min={0} max={45} value={scene.elevation ?? 10} onChange={(e) => set("elevation", Number(e.target.value))} />
          </label>
          <label>
            Lens {scene.focal} mm
            <input type="range" min={85} max={135} step={5} value={scene.focal} onChange={(e) => set("focal", Number(e.target.value))} />
          </label>
          <label>
            Box size in frame {Math.round(scene.fill * 100)}%
            <input type="range" min={40} max={95} value={scene.fill * 100} onChange={(e) => set("fill", Number(e.target.value) / 100)} />
          </label>
          <label>
            Placement{" "}
            <select
              value={Object.entries(ANCHORS).find(([, v]) => v[0] === scene.anchor[0] && v[1] === scene.anchor[1])?.[0] || "centre"}
              onChange={(e) => set("anchor", ANCHORS[e.target.value])}
            >
              {Object.keys(ANCHORS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="card">
          <h3>Finish & light</h3>
          <label>
            Finish{" "}
            <select value={scene.finish} onChange={(e) => set("finish", e.target.value)}>
              {options.finishes.map((f) => (
                <option key={f} value={f}>
                  {{ matte: "Matte varnish", gloss: "Gloss varnish", soft_touch: "Soft-touch" }[f]}
                </option>
              ))}
            </select>
          </label>
          {faces.map((f) => (
            <div key={f} className="row mask">
              <span>{f} foil / spot UV mask:</span>
              {project.masks?.[f] ? (
                <>
                  <b>{project.masks[f].type}</b>
                  <button onClick={() => busy(() => api.removeMask(project.id, f).then(onChange), "Removing mask")}>remove</button>
                </>
              ) : (
                <>
                  {(["spot_uv", "foil"] as const).map((t) => (
                    <label key={t} className="file">
                      {t === "foil" ? "foil" : "spot UV"}
                      <input
                        type="file"
                        accept="image/png,image/tiff,image/jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) busy(() => api.mask(project.id, f, t, file).then(onChange), "Uploading mask");
                        }}
                      />
                    </label>
                  ))}
                </>
              )}
            </div>
          ))}
          <p className="muted">Mask: white = finish, black = none, same proportions as the panel.</p>
          <label>
            Key light / shadow direction{" "}
            <select value={scene.key_side} onChange={(e) => set("key_side", e.target.value)}>
              <option value="auto">auto (shadow away from the visible side)</option>
              <option value="left">light from the left</option>
              <option value="right">light from the right</option>
              <option value="front">light from the front</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={scene.shadow} onChange={(e) => set("shadow", e.target.checked)} /> Shadow
          </label>
          <label>
            Background{" "}
            <select value={scene.background === "transparent" || scene.background === "#ffffff" ? scene.background : "custom"} onChange={(e) => set("background", e.target.value === "custom" ? "#eeeeee" : e.target.value)}>
              <option value="transparent">transparent</option>
              <option value="#ffffff">white</option>
              <option value="custom">custom colour</option>
            </select>
            {scene.background !== "transparent" && scene.background !== "#ffffff" && (
              <input type="color" value={scene.background} onChange={(e) => set("background", e.target.value)} />
            )}
          </label>
        </section>

        <section className="card">
          <h3>Group shot</h3>
          {approvedOthers.length === 0 && <p className="muted">Approve more projects to add them next to this box.</p>}
          {approvedOthers.map((x) => (
            <label key={x.id} className="chip">
              <input
                type="checkbox"
                checked={groupIds.includes(x.id)}
                onChange={() => {
                  const ids = groupIds.includes(x.id) ? groupIds.filter((i) => i !== x.id) : [...groupIds, x.id];
                  set("group", ids.length ? { spacing_mm: scene.group?.spacing_mm ?? 12, depth_offset_mm: scene.group?.depth_offset_mm ?? 25, projects: ids } : null);
                }}
              />{" "}
              {x.meta.product || x.filename} {x.meta.version && `v${x.meta.version}`}
            </label>
          ))}
          {scene.group && (
            <>
              <label>
                Spacing {scene.group.spacing_mm} mm
                <input type="range" min={0} max={80} value={scene.group.spacing_mm} onChange={(e) => set("group", { ...scene.group!, spacing_mm: Number(e.target.value) })} />
              </label>
              <label>
                Depth offset {scene.group.depth_offset_mm} mm
                <input type="range" min={0} max={120} value={scene.group.depth_offset_mm} onChange={(e) => set("group", { ...scene.group!, depth_offset_mm: Number(e.target.value) })} />
              </label>
            </>
          )}
        </section>

        <section className="card">
          <h3>Output</h3>
          <label>
            Long side{" "}
            <select value={scene.long_side} onChange={(e) => set("long_side", Number(e.target.value))}>
              {[1000, 2000, 4000, 8000].map((v) => (
                <option key={v} value={v}>
                  {v} px{v === 1000 ? " (quick test)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aspect{" "}
            <select value={scene.aspect} onChange={(e) => set("aspect", e.target.value)}>
              {options.aspects.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          {scene.aspect === "custom" && (
            <div className="row">
              <input type="number" placeholder="width px" value={scene.custom_w ?? ""} onChange={(e) => set("custom_w", Number(e.target.value))} />
              <input type="number" placeholder="height px" value={scene.custom_h ?? ""} onChange={(e) => set("custom_h", Number(e.target.value))} />
            </div>
          )}
          <div className="row">
            {["png", "jpg", "pdf"].map((f) => (
              <label key={f} className="chip">
                <input type="checkbox" checked={scene.formats.includes(f)} onChange={() => toggle("formats", f)} /> {f.toUpperCase()}
              </label>
            ))}
          </div>
          {scene.formats.includes("jpg") && scene.background === "transparent" && (
            <label>
              JPG background <input type="color" value={scene.jpg_background} onChange={(e) => set("jpg_background", e.target.value)} />
            </label>
          )}
          {scene.formats.includes("pdf") && (
            <label>
              <input type="checkbox" checked={scene.pdf_info_strip} onChange={(e) => set("pdf_info_strip", e.target.checked)} /> PDF info strip
            </label>
          )}
        </section>

        <section className="card">
          <h3>Presets</h3>
          <div className="row wrap">
            {presets &&
              Object.entries(presets.named).map(([name, s]) => (
                <button key={name} onClick={() => setScene({ ...options.default_scene, ...s, group: scene.group })}>
                  {name}
                </button>
              ))}
            <button
              onClick={() => {
                const name = prompt("Preset name");
                if (name) api.savePreset(name, { ...scene, group: null }).then(() => api.presets().then(setPresets));
              }}
            >
              Save current as preset…
            </button>
          </div>
          <p className="muted">The last used camera, light and finish settings are restored automatically.</p>
        </section>

        <button className="primary big" disabled={scene.views.length === 0 || scene.formats.length === 0} onClick={() => onRender(scene)}>
          Render {scene.views.length} view{scene.views.length === 1 ? "" : "s"}
        </button>
      </aside>
    </div>
  );
}
