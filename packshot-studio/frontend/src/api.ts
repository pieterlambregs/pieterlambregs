export type Line = { orient: "v" | "h"; pos: number; kind: string };
export type Panel = {
  id: string;
  role: string;
  rotation: number;
  role_source?: string;
  rotation_source?: string;
  is_front?: boolean;
  struct: { type: string; col?: number; side?: string; part?: string };
  edges: { l: string; r: string; t: string; b: string };
};
export type Layout = {
  lines: Record<string, Line>;
  panels: Panel[];
  page: { w: number; h: number };
  sheet_rotation: number;
  orientation_source: string;
  front_confirmed: boolean;
  front_reason?: string;
  is_template?: boolean;
  reused_from?: string;
};
export type Source = { id: string; kind: string; name: string; role: string; proposed_role: string; n_paths: number };
export type Question = { id: string; text: string; options: string[] };
export type Check = { name: string; status: "pass" | "fail" | "warn" | "skipped"; detail: string };
export type Output = {
  view: string;
  label: string;
  files: { format: string; name: string }[];
  thumb: string;
  verify: { status: string; checks: Check[]; faces: Record<string, any> };
  verify_image: string | null;
  size: [number, number];
};
export type RenderRecord = {
  id: string;
  project: string;
  created: number;
  status: string;
  progress: number;
  stage: string;
  scene: Scene;
  views: string[];
  outputs: Output[];
  error?: string;
};
export type Scene = {
  views: string[];
  azimuth: number | null;
  elevation: number | null;
  focal: number;
  fill: number;
  anchor: [number, number];
  finish: string;
  shadow: boolean;
  key_side: string;
  front_gain: number;
  background: string;
  long_side: number;
  aspect: string;
  custom_w: number | null;
  custom_h: number | null;
  formats: string[];
  jpg_background: string;
  pdf_info_strip: boolean;
  samples: number | null;
  group: { projects: string[]; spacing_mm: number; depth_offset_mm: number } | null;
};
export type Project = {
  id: string;
  filename: string;
  created: number;
  status: string;
  error?: string;
  meta: {
    source_name: string;
    date_code: string;
    brand: string;
    product: string;
    dimensions: { raw: string; as_written_mm: number[]; as_tenths_mm: number[]; unit: string | null } | null;
    pack_size: string;
    version: string;
    tags: string[];
  };
  settings: { icc_profile: string; intent: string; dpi: number };
  analysis: {
    method: string;
    sources: Source[];
    notes: string[];
    page_mm: [number, number];
    removed_at_source: boolean;
    preview_dpi: number;
    layout_error: string | null;
    clean_report: { spots_removed: string[]; ops_removed: number };
  };
  layout: Layout;
  questions: Question[];
  measure: { panels: Record<string, { w: number; h: number }>; box: { width: number; depth: number; height: number } | null; issues: string[] };
  dims_compare: {
    status: string;
    stated_raw?: string;
    reading?: string;
    stated_mm?: number[];
    measured_mm?: number[];
    max_diff_mm?: number;
    readings?: Record<string, number[]>;
  };
  dims_choice?: string;
  dieline_key?: string | null;
  approved: boolean;
  artwork_warnings: string[];
  panel_warnings?: string[];
  panels?: Record<string, { file: string; preview: string; px: [number, number]; role: string; mm: [number, number]; residue?: { status: string; pixels?: number }; edge_warnings?: string[] }>;
  faces?: Record<string, string>;
  masks?: Record<string, { file: string; type: string }>;
  renders: RenderRecord[];
};
export type LibraryItem = {
  id: string;
  filename: string;
  created: number;
  status: string;
  meta: Project["meta"];
  approved: boolean;
  renders: number;
  dieline_key: string | null;
};
export type Options = {
  icc_profiles: Record<string, string>;
  views: Record<string, string>;
  aspects: string[];
  finishes: string[];
  roles: string[];
  default_scene: Scene;
};

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try {
      const b = await r.json();
      msg = b.detail || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return r.json();
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  options: () => fetch("/api/options").then(j<Options>),
  library: () => fetch("/api/projects").then(j<LibraryItem[]>),
  project: (id: string) => fetch(`/api/projects/${id}`).then(j<Project>),
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return fetch("/api/projects", { method: "POST", body: fd }).then(j<(Project | { filename: string; error: string })[]>);
  },
  remove: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }).then(j),
  meta: (id: string, meta: Partial<Project["meta"]>) => fetch(`/api/projects/${id}/meta`, json("PUT", meta)).then(j<Project>),
  settings: (id: string, s: Partial<Project["settings"]>) => fetch(`/api/projects/${id}/settings`, json("PUT", s)).then(j<Project>),
  layout: (id: string, layout: Partial<Layout>, front_panel?: string) =>
    fetch(`/api/projects/${id}/layout`, json("PUT", { layout, front_panel })).then(j<Project>),
  sources: (id: string, overrides: Record<string, string>) => fetch(`/api/projects/${id}/sources`, json("POST", { overrides })).then(j<Project>),
  answer: (id: string, qid: string, value: string) => fetch(`/api/projects/${id}/answer`, json("POST", { id: qid, value })).then(j<Project>),
  rotateSheet: (id: string, quarter_turns: number) => fetch(`/api/projects/${id}/rotate-sheet`, json("POST", { quarter_turns })).then(j<Project>),
  approve: (id: string) => fetch(`/api/projects/${id}/approve`, { method: "POST" }).then(j<Project>),
  reuse: (id: string, from: string) => fetch(`/api/projects/${id}/reuse-layout`, json("POST", { from })).then(j<Project>),
  mask: (id: string, role: string, type: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`/api/projects/${id}/masks/${role}?type=${type}`, { method: "POST", body: fd }).then(j<Project>);
  },
  removeMask: (id: string, role: string) => fetch(`/api/projects/${id}/masks/${role}`, { method: "DELETE" }).then(j<Project>),
  render: (id: string, scene: Scene) => fetch(`/api/projects/${id}/renders`, json("POST", scene)).then(j<RenderRecord>),
  renderStatus: (id: string, rid: string) => fetch(`/api/projects/${id}/renders/${rid}`).then(j<RenderRecord>),
  presets: () => fetch("/api/presets").then(j<{ last: Scene; named: Record<string, Scene> }>),
  savePreset: (name: string, s: Scene) => fetch(`/api/presets/${encodeURIComponent(name)}`, json("PUT", s)).then(j),
};

export const fileUrl = (pid: string, path: string, bust?: string | number) =>
  `/api/projects/${pid}/file/${path}${bust ? `?v=${bust}` : ""}`;

export const ROLE_LABEL: Record<string, string> = {
  front: "Front",
  back: "Back",
  left: "Left side",
  right: "Right side",
  top: "Top",
  bottom: "Bottom",
  glue_flap: "Glue flap",
  tuck_flap_top: "Tuck flap (top)",
  tuck_flap_bottom: "Tuck flap (bottom)",
  dust_flap: "Dust flap",
  inner_flap: "Inner flap",
  ignore: "Ignore",
};
