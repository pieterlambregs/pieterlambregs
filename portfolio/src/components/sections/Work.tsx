import { PillLink } from "@/components/ui/PillLink";
import { ProjectCard } from "@/components/ui/ProjectCard";
import { RevealBlock, RevealLines } from "@/components/ui/Reveal";
import { projects } from "@/content/projects";

/**
 * Where each project sits on the 12-column grid. The pattern repeats every
 * six projects, so the gallery stays asymmetric however many there are.
 */
const placements = [
  { cols: "md:col-span-12", shape: "wide", sizes: "100vw" },
  { cols: "md:col-span-7", shape: "landscape", sizes: "(min-width: 768px) 58vw, 100vw" },
  { cols: "md:col-span-4 md:col-start-9 md:mt-[32%]", shape: "portrait", sizes: "(min-width: 768px) 33vw, 100vw" },
  { cols: "md:col-span-10 md:col-start-3", shape: "wide", sizes: "(min-width: 768px) 83vw, 100vw" },
  { cols: "md:col-span-4 md:mt-[18%]", shape: "portrait", sizes: "(min-width: 768px) 33vw, 100vw" },
  { cols: "md:col-span-7 md:col-start-6", shape: "landscape", sizes: "(min-width: 768px) 58vw, 100vw" },
] as const;

export function Work() {
  return (
    <section id="work" className="gutter scroll-mt-0 section-y">
      <div className="grid-12 items-end gap-y-8">
        <RevealLines
          lines={["Selected work.", "Creative thinking.", "Real-world impact."]}
          className="display col-span-12 text-[clamp(2.25rem,7.6vw,9.5rem)] lg:col-span-10"
        />
        <p className="label col-span-12 text-muted lg:col-span-2 lg:pb-3 lg:text-right">
          {String(projects.length).padStart(2, "0")} projects
          <br />
          2010 – 2026
        </p>
      </div>

      <div className="grid-12 mt-[clamp(3.5rem,8vw,8rem)] gap-y-[clamp(4rem,9vw,9rem)]">
        {projects.map((project, i) => {
          const place = placements[i % placements.length];
          return (
            <RevealBlock key={project.slug} className={`col-span-12 ${place.cols}`}>
              <ProjectCard project={project} shape={place.shape} sizes={place.sizes} />
            </RevealBlock>
          );
        })}
      </div>

      <div className="mt-[clamp(4rem,8vw,8rem)] flex justify-center">
        <PillLink href="/work" transitionLabel="All work">
          Browse all work by discipline
        </PillLink>
      </div>
    </section>
  );
}
