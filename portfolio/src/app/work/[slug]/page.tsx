import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Gallery } from "@/components/case/Gallery";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { FactList } from "@/components/ui/FactList";
import { MediaView } from "@/components/ui/MediaView";
import { ProjectCard } from "@/components/ui/ProjectCard";
import { RevealBlock, RevealLines } from "@/components/ui/Reveal";
import { TransitionLink } from "@/components/ui/TransitionLink";
import { getCategory, getNeighbours, getProject, getRelated, projects } from "@/content/projects";
import { site } from "@/content/site";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  const title = `${project.title} — ${getCategory(project.category).name}`;
  return {
    title,
    description: project.summary,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title,
      description: project.summary,
      type: "article",
      images: project.cover.type === "image" ? [{ url: project.cover.src, alt: project.cover.alt }] : undefined,
    },
  };
}

/** A chapter of the story: name in the margin, content beside it. */
function Chapter({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="grid-12 gap-y-5 border-t border-line py-[clamp(2.5rem,5vw,5rem)]">
      <h2 className="label col-span-12 text-muted md:col-span-3">{name}</h2>
      <div className="col-span-12 md:col-span-8 md:col-start-5">{children}</div>
    </section>
  );
}

/** Marks a section that still needs writing. Hidden when placeholders are off. */
function Unwritten({ field }: { field: string }) {
  return (
    <div className="border border-dashed border-accent/60 p-5 sm:p-6">
      <p className="label text-accent">Placeholder · to be written</p>
      <p className="mt-3 max-w-[52ch] text-body leading-[1.5] text-muted">
        This section is waiting for the real story. Add it in{" "}
        <code className="font-mono text-[0.875em] text-fg">src/content/projects.ts</code> under{" "}
        <code className="font-mono text-[0.875em] text-fg">{field}</code>.
      </p>
    </div>
  );
}

function Prose({ children }: { children: string }) {
  return (
    <RevealBlock>
      <p className="max-w-[40ch] text-[clamp(1.375rem,2.3vw,2.25rem)] font-medium leading-[1.18] tracking-[-0.025em]">
        {children}
      </p>
    </RevealBlock>
  );
}

export default async function CaseStudy({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const category = getCategory(project.category);
  const { previous, next } = getNeighbours(project.slug);
  const related = getRelated(project.slug);
  const number = String(projects.indexOf(project) + 1).padStart(2, "0");

  const chapters = [
    { name: "Background & challenge", key: "background", text: project.story.background },
    { name: "Creative strategy", key: "strategy", text: project.story.strategy },
    { name: "Concept development", key: "concept", text: project.story.concept },
  ].filter((c) => c.text || site.showPlaceholders);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    creator: { "@type": "Person", name: site.name },
    genre: category.name,
    url: `${site.url}/work/${project.slug}`,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 1–2. Introduction, title and category */}
      <header className="gutter flex min-h-[100svh] flex-col pt-[clamp(6rem,14vh,10rem)]">
        <div className="label intro-fade flex items-baseline justify-between text-muted">
          <CategoryTag id={project.category} />
          <p className="tabular-nums">
            {number} / {String(projects.length).padStart(2, "0")}
          </p>
        </div>

        <h1 className="display mt-6 text-[clamp(3.25rem,15vw,20rem)]">
          <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
            <span className="intro-rise">{project.title}</span>
          </span>
        </h1>

        <div className="grid-12 intro-fade mt-auto gap-y-8 pb-8 pt-12" style={{ "--d": "350ms" } as React.CSSProperties}>
          <p className="col-span-12 max-w-[34ch] text-[clamp(1.25rem,1.9vw,1.875rem)] font-medium leading-[1.2] tracking-[-0.02em] md:col-span-6">
            {project.summary}
          </p>
          <FactList
            size="small"
            className="col-span-12 grid grid-cols-2 gap-x-6 border-t border-line md:col-span-5 md:col-start-8 lg:grid-cols-3"
            facts={[
              { label: "Client", value: project.client },
              { label: "Year", value: project.year },
              { label: "Discipline", value: project.discipline },
            ]}
          />
        </div>
      </header>

      <div className="intro-fade" style={{ "--d": "500ms" } as React.CSSProperties}>
        <MediaView media={project.cover} sizes="100vw" ratio="16 / 9" priority className="max-h-[92svh] w-full" />
      </div>

      <div className="gutter">
        {/* 3. Overview */}
        <section className="grid-12 gap-y-8 py-[clamp(4rem,9vw,9rem)]">
          <h2 className="label col-span-12 text-muted md:col-span-3">Overview</h2>
          <div className="col-span-12 md:col-span-8 md:col-start-5">
            <RevealBlock>
              <p className="text-[clamp(1.5rem,3vw,3.25rem)] font-medium leading-[1.1] tracking-[-0.035em]">
                {project.overview}
              </p>
            </RevealBlock>
            <p className="label mt-10 text-muted">
              Role <span className="ml-3 text-fg">{project.role}</span>
            </p>
          </div>
        </section>

        {/* 4–6. Background, strategy, concept */}
        {chapters.map((chapter) => (
          <Chapter key={chapter.key} name={chapter.name}>
            {chapter.text ? <Prose>{chapter.text}</Prose> : <Unwritten field={`${project.slug} → story.${chapter.key}`} />}
          </Chapter>
        ))}

        {/* 7. Design exploration */}
        {project.exploration.length > 0 && (
          <section className="border-t border-line py-[clamp(2.5rem,5vw,5rem)]">
            <h2 className="label mb-[clamp(2rem,4vw,4rem)] text-muted">Design exploration</h2>
            <Gallery blocks={project.exploration} />
          </section>
        )}

        {/* 8–9. Final execution, full-width imagery and mockups */}
        {project.execution.length > 0 && (
          <section className="border-t border-line py-[clamp(2.5rem,5vw,5rem)]">
            <h2 className="label mb-[clamp(2rem,4vw,4rem)] text-muted">Final execution</h2>
            <Gallery blocks={project.execution} />
          </section>
        )}
      </div>

      {/* 10. Credits and deliverables */}
      <section className="tone-flip gutter py-[clamp(4rem,9vw,9rem)]">
        <div className="grid-12 gap-y-12">
          <div className="col-span-12 md:col-span-5">
            <h2 className="label text-muted">Deliverables</h2>
            <ul className="mt-5">
              {project.deliverables.map((d) => (
                <li
                  key={d}
                  className="border-t border-line py-3 text-[clamp(1.25rem,2.1vw,2rem)] font-medium leading-[1.15] tracking-[-0.025em] last:border-b"
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-12 md:col-span-5 md:col-start-8">
            <h2 className="label text-muted">Credits</h2>
            <FactList
              variant="rows"
              className="mt-5"
              facts={[...project.credits, { label: "Tools", value: project.tools.join(", ") }]}
            />
            {project.source && (
              <a
                href={project.source.href}
                target="_blank"
                rel="noreferrer"
                className="label link-draw mt-8 inline-block py-1"
              >
                {project.source.label} ↗
              </a>
            )}
          </div>
        </div>
      </section>

      {/* 11. Related projects */}
      <section className="gutter py-[clamp(4rem,9vw,9rem)]">
        <h2 className="label text-muted">Related projects</h2>
        <div className="grid-12 mt-8 gap-y-14">
          {related.map((p, i) => (
            <div key={p.slug} className={`col-span-12 md:col-span-5 ${i === 1 ? "md:col-start-8 md:mt-[12%]" : ""}`}>
              <ProjectCard project={p} shape="landscape" sizes="(min-width: 768px) 42vw, 100vw" compact />
            </div>
          ))}
        </div>
      </section>

      {/* 12. Previous / next */}
      <nav aria-label="More projects" className="gutter border-t border-line">
        <TransitionLink
          href={`/work/${next.slug}`}
          transitionLabel={next.title}
          data-cursor="Next case"
          className="group block py-[clamp(3rem,7vw,7rem)]"
        >
          <p className="label text-muted">Next project</p>
          <RevealLines
            as="p"
            lines={[next.title]}
            className="display mt-4 text-[clamp(3rem,14vw,18rem)] transition-colors duration-500 group-hover:text-accent"
          />
        </TransitionLink>
        <div className="label flex justify-between border-t border-line py-6">
          <TransitionLink href={`/work/${previous.slug}`} transitionLabel={previous.title} className="link-draw py-3.5">
            ← Previous: {previous.title}
          </TransitionLink>
          <TransitionLink href="/work" transitionLabel="All work" className="link-draw py-3.5">
            All work
          </TransitionLink>
        </div>
      </nav>
    </article>
  );
}
