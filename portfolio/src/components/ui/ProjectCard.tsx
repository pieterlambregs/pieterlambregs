import { MediaView } from "@/components/ui/MediaView";
import { TransitionLink } from "@/components/ui/TransitionLink";
import { CategoryTag } from "@/components/ui/CategoryTag";
import type { Project } from "@/content/projects";

const ratios = { wide: "16 / 9", landscape: "4 / 3", portrait: "4 / 5" } as const;

/** A project preview: large image, then title, year, discipline and summary. */
export function ProjectCard({
  project,
  sizes,
  shape = project.cardShape,
  priority,
  compact,
}: {
  project: Project;
  sizes: string;
  shape?: keyof typeof ratios;
  priority?: boolean;
  compact?: boolean;
}) {
  return (
    <article>
      <TransitionLink
        href={`/work/${project.slug}`}
        transitionLabel={project.title}
        data-cursor="View case"
        className="group block"
      >
        <div className="overflow-hidden">
          <MediaView
            media={project.cover}
            sizes={sizes}
            ratio={ratios[shape]}
            priority={priority}
          />
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <CategoryTag id={project.category} />
          <p className="label shrink-0 tabular-nums text-muted">{project.year}</p>
        </div>
        <h3
          className={`display mt-3 ${compact ? "text-[clamp(1.75rem,3.4vw,3.25rem)]" : "text-[clamp(2.25rem,5.6vw,6rem)]"}`}
        >
          <span className="link-draw pb-[0.06em]">{project.title}</span>
        </h3>
        <p className="label mt-3 text-muted">{project.discipline}</p>
        {!compact && (
          <p className="mt-3 max-w-[52ch] text-small text-muted">{project.summary}</p>
        )}
      </TransitionLink>
    </article>
  );
}
