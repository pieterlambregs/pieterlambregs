import { useCallback, useEffect, useState } from "react";
import { api, fileUrl, LibraryItem, Options, Project, Scene } from "./api";
import RenderView from "./RenderView";
import Review from "./Review";
import SceneSetup from "./SceneSetup";

type Step = "library" | "upload" | "review" | "scene" | "render";
const STEPS: [Step, string][] = [
  ["upload", "1 Upload"],
  ["review", "2 Review panels"],
  ["scene", "3 Set up scene"],
  ["render", "4 Render & download"],
];

export default function App() {
  const [options, setOptions] = useState<Options | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>("library");
  const [renderId, setRenderId] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ filename: string; id?: string; error?: string }[]>([]);

  const refreshLibrary = useCallback(() => api.library().then(setLibrary), []);
  useEffect(() => {
    api.options().then(setOptions);
    refreshLibrary();
  }, [refreshLibrary]);

  const busy = useCallback(async (fn: () => Promise<unknown>, label: string) => {
    setBusyLabel(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusyLabel(null);
    }
  }, []);

  const open = (id: string, s: Step = "review") =>
    busy(async () => {
      const p = await api.project(id);
      setProject(p);
      setRenderId(p.renders[0]?.id || null);
      setStep(p.approved && s === "review" ? "scene" : s);
    }, "Opening");

  const onChange = (p: Project) => {
    setProject(p);
    refreshLibrary();
  };

  const upload = (files: File[]) =>
    busy(async () => {
      const res = await api.upload(files);
      setBatch(res.map((r) => ("id" in r ? { filename: r.filename, id: r.id } : { filename: r.filename, error: r.error })));
      await refreshLibrary();
      const first = res.find((r) => "id" in r) as Project | undefined;
      if (first) {
        setProject(first);
        setStep("review");
      }
    }, `Analysing ${files.length} file(s)`);

  const startRender = (scene: Scene) =>
    busy(async () => {
      const rec = await api.render(project!.id, scene);
      const p = await api.project(project!.id);
      setProject(p);
      setRenderId(rec.id);
      setStep("render");
    }, "Queuing render");

  if (!options) return <div className="loading">Loading…</div>;

  const canGo = (s: Step) =>
    s === "upload" || s === "library" || (project != null && (s === "review" || project.approved));

  return (
    <div className="app">
      <header>
        <h1 onClick={() => setStep("library")}>Packshot Studio</h1>
        <nav>
          <button className={step === "library" ? "on" : ""} onClick={() => setStep("library")}>
            Library
          </button>
          {STEPS.map(([s, label]) => (
            <button key={s} className={step === s ? "on" : ""} disabled={!canGo(s)} onClick={() => setStep(s)}>
              {label}
            </button>
          ))}
        </nav>
        {project && step !== "library" && step !== "upload" && (
          <div className="current" title={project.filename}>
            {project.meta.brand} {project.meta.product} {project.meta.version && `v${project.meta.version}`}
          </div>
        )}
      </header>
      {busyLabel && <div className="busy">{busyLabel}…</div>}
      {error && (
        <div className="error" onClick={() => setError(null)}>
          {error} (click to dismiss)
        </div>
      )}
      {project && step !== "library" && step !== "upload" && <MetaBar project={project} onChange={onChange} />}

      <main>
        {step === "library" && <Library items={library} onOpen={open} onUpload={() => setStep("upload")} onDelete={(id) => busy(() => api.remove(id).then(refreshLibrary), "Deleting")} />}
        {step === "upload" && <Upload onFiles={upload} batch={batch} onOpen={open} />}
        {step === "review" && project && (
          <Review project={project} options={options} library={library} onChange={onChange} onApproved={() => setStep("scene")} busy={busy} />
        )}
        {step === "scene" && project && <SceneSetup project={project} options={options} library={library} onChange={onChange} onRender={startRender} busy={busy} />}
        {step === "render" && project && <RenderView project={project} renderId={renderId} onSelect={setRenderId} onFinished={() => { api.project(project.id).then(setProject); refreshLibrary(); }} />}
      </main>
    </div>
  );
}

function MetaBar({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const m = project.meta;
  const [draft, setDraft] = useState(m);
  useEffect(() => setDraft(project.meta), [project.meta]);
  const field = (k: "date_code" | "brand" | "product" | "pack_size" | "version", label: string, w = 90) => (
    <label>
      <span>{label}</span>
      <input
        style={{ width: w }}
        value={draft[k] || ""}
        onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
        onBlur={() => draft[k] !== m[k] && api.meta(project.id, { [k]: draft[k] }).then(onChange)}
      />
    </label>
  );
  return (
    <div className="metabar">
      {field("date_code", "Date code", 60)}
      {field("brand", "Brand", 60)}
      {field("product", "Product", 160)}
      <label>
        <span>Dimensions</span>
        <input style={{ width: 150 }} value={m.dimensions?.raw || "—"} readOnly title="Compared with the dieline in the scale check" />
      </label>
      {field("pack_size", "Pack size", 70)}
      {field("version", "Version", 40)}
      <label>
        <span>Tags</span>
        <input
          style={{ width: 90 }}
          value={draft.tags.join(" ")}
          onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(/\s+/).filter(Boolean) })}
          onBlur={() => api.meta(project.id, { tags: draft.tags }).then(onChange)}
        />
      </label>
      <span className="muted small" title={project.filename}>
        {project.filename}
      </span>
    </div>
  );
}

function Upload({ onFiles, batch, onOpen }: { onFiles: (f: File[]) => void; batch: { filename: string; id?: string; error?: string }[]; onOpen: (id: string) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div className="upload">
      <label
        className={over ? "drop over" : "drop"}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <input type="file" multiple accept=".pdf,.ai,.png,.tif,.tiff,.jpg,.jpeg" onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
        <b>Drop print files here</b> or click to choose
        <span className="muted">PDF (preferred), AI, PNG, TIFF, JPG — several at once is fine</span>
      </label>
      {batch.length > 1 && (
        <div className="card">
          <h3>This batch</h3>
          {batch.map((b) => (
            <div key={b.filename} className="row">
              <span>{b.filename}</span>
              {b.id ? <button onClick={() => onOpen(b.id!)}>Review</button> : <span className="bad">{b.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Library({ items, onOpen, onUpload, onDelete }: { items: LibraryItem[]; onOpen: (id: string, s?: Step) => void; onUpload: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="library">
      <div className="row">
        <h2>Library</h2>
        <button className="primary" onClick={onUpload}>
          + Upload print files
        </button>
      </div>
      {items.length === 0 && <p className="muted">No projects yet.</p>}
      <div className="grid">
        {items.map((x) => (
          <div key={x.id} className="card tile">
            <img src={fileUrl(x.id, "sheet.png")} alt="" onClick={() => onOpen(x.id)} />
            <b>
              {x.meta.brand} {x.meta.product}
            </b>
            <span className="muted small">{x.filename}</span>
            <span className="small">
              {x.meta.version && `v${x.meta.version} · `}
              {x.approved ? "layout approved" : "needs review"} · {x.renders} render(s)
            </span>
            <div className="row">
              <button onClick={() => onOpen(x.id, "review")}>Review</button>
              {x.approved && <button onClick={() => onOpen(x.id, "scene")}>Scene</button>}
              {x.renders > 0 && <button onClick={() => onOpen(x.id, "render")}>Renders</button>}
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete ${x.filename} and its renders?`)) onDelete(x.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
