import { site } from "@/content/site";

/**
 * First-visit loading curtain. Animated entirely in CSS (see globals.css):
 * it counts to 100, then lifts on its own, so it can never block the page.
 * Skipped on return visits within a session and for reduced-motion visitors.
 */
export function Loader() {
  return (
    <div
      aria-hidden
      className="loader fixed inset-0 z-[95] flex flex-col justify-between bg-bg gutter py-[var(--gutter)] text-fg"
      style={{ clipPath: "inset(0 0 0 0)" }}
    >
      <div className="label flex justify-between text-muted">
        <span>{site.name}</span>
        <span>Portfolio 2026</span>
      </div>
      <div>
        <div className="flex items-end justify-between gap-6">
          <p className="display overflow-hidden text-[clamp(2.5rem,9vw,9rem)]">
            <span className="loader__word">{site.role.split(" ")[0]}</span>
            <br />
            <span className="loader__word" style={{ animationDelay: "0.08s" }}>
              {site.role.split(" ")[1]}
            </span>
          </p>
          <span className="loader__count display text-[clamp(2.5rem,9vw,9rem)] tabular-nums text-accent" />
        </div>
        <div className="mt-6 h-px w-full bg-line">
          <div className="loader__bar h-full bg-fg" />
        </div>
      </div>
    </div>
  );
}
