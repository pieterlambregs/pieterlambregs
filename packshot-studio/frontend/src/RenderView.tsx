import { useEffect, useState } from "react";
import { api, fileUrl, Project, RenderRecord } from "./api";

export default function RenderView({ project, renderId, onSelect, onFinished }: { project: Project; renderId: string | null; onSelect: (rid: string) => void; onFinished: () => void }) {
  const [rec, setRec] = useState<RenderRecord | null>(null);

  useEffect(() => {
    if (!renderId) return;
    let stop = false;
    const tick = () =>
      api.renderStatus(project.id, renderId).then((r) => {
        if (stop) return;
        setRec(r);
        if (r.status === "queued" || r.status === "running") setTimeout(tick, 1500);
        else onFinished();
      });
    tick();
    return () => {
      stop = true;
    };
  }, [project.id, renderId]);

  const base = (rid: string, name: string) => fileUrl(project.id, `renders/${rid}/${name}`);

  return (
    <div className="renders">
      <aside className="history card">
        <h3>Renders of this project</h3>
        {project.renders.length === 0 && <p className="muted">None yet.</p>}
        {project.renders.map((r) => (
          <button key={r.id} className={r.id === renderId ? "on block" : "block"} onClick={() => onSelect(r.id)}>
            {new Date(r.created * 1000).toLocaleString()} · {r.views.length} view(s) · {r.status}
          </button>
        ))}
        {project.renders.length > 0 && (
          <a className="button" href={`/api/projects/${project.id}/zip`}>
            Download all renders (ZIP)
          </a>
        )}
      </aside>
      <div className="render-main">
        {!rec && <p className="muted">Start a render from “Set up scene”.</p>}
        {rec && (
          <>
            <div className="card">
              <h3>
                Render {rec.id} — {rec.status === "failed_verification" ? <span className="bad">verification failed</span> : rec.status}
              </h3>
              {(rec.status === "queued" || rec.status === "running") && (
                <>
                  <div className="progress">
                    <div style={{ width: `${Math.round(rec.progress * 100)}%` }} />
                  </div>
                  <p className="muted">
                    {rec.stage} · {Math.round(rec.progress * 100)}%
                  </p>
                </>
              )}
              {rec.error && <pre className="bad">{rec.error}</pre>}
              {rec.outputs.length > 0 && (
                <a className="button primary" href={`/api/projects/${project.id}/renders/${rec.id}/zip`}>
                  Download all files of this render (ZIP)
                </a>
              )}
            </div>
            {rec.outputs.map((o) => (
              <div key={o.view} className="card output">
                <div className="out-img checker">
                  <img src={base(rec.id, o.thumb)} alt={o.label} />
                </div>
                <div className="out-info">
                  <h3>
                    {o.label} · {o.size[0]} × {o.size[1]} px
                  </h3>
                  <div className="row wrap">
                    {o.files.map((f) => (
                      <a key={f.name} className="button" href={base(rec.id, f.name)} download={f.name}>
                        {f.format.toUpperCase()}
                      </a>
                    ))}
                  </div>
                  <p className="muted small">{o.files[0]?.name}</p>
                  <h4>
                    Verification: <span className={o.verify.status === "pass" ? "ok" : "bad"}>{o.verify.status.toUpperCase()}</span>
                  </h4>
                  <table className="checks">
                    <tbody>
                      {o.verify.checks.map((c) => (
                        <tr key={c.name}>
                          <td className={c.status === "pass" ? "ok" : c.status === "fail" ? "bad" : "warnc"}>{{ pass: "✓", fail: "✗", warn: "!", skipped: "–" }[c.status]}</td>
                          <td>{c.name}</td>
                          <td className="muted">{c.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {o.verify_image && (
                    <>
                      <p className="muted small">Source panel · rendered front unwarped to flat · colour difference (ΔE, lighting removed)</p>
                      <img className="verify-img" src={base(rec.id, o.verify_image)} alt="verification" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
