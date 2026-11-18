"use client";

import { useRef } from "react";
import { PillLink } from "@/components/ui/PillLink";
import { ProjectCard } from "@/components/ui/ProjectCard";
import { RevealBlock, RevealLines } from "@/components/ui/Reveal";
import { projects } from "@/content/projects";
import { gsap, SCENE_QUERY, useGSAP } from "@/lib/gsap";

/**
 * Stacked layout (phones, tablets, reduced motion): where each project sits
 * on the 12-column grid. The pattern repeats every six projects, so the
 * gallery stays asymmetric however many there are.
 */
const placements = [
  { cols: "noscene:md:col-span-12", shape: "wide", sizes: "(min-width: 1024px) 82vh, 100vw" },
  { cols: "noscene:md:col-span-7", shape: "landscape", sizes: "(min-width: 1024px) 61vh, 58vw" },
  { cols: "noscene:md:col-span-4 noscene:md:col-start-9 noscene:md:mt-[32%]", shape: "portrait", sizes: "(min-width: 1024px) 37vh, 33vw" },
  { cols: "noscene:md:col-span-10 noscene:md:col-start-3", shape: "wide", sizes: "(min-width: 1024px) 82vh, 83vw" },
  { cols: "noscene:md:col-span-4 noscene:md:mt-[18%]", shape: "portrait", sizes: "(min-width: 1024px) 37vh, 33vw" },
  { cols: "noscene:md:col-span-7 noscene:md:col-start-6", shape: "landscape", sizes: "(min-width: 1024px) 61vh, 58vw" },
] as const;

/**
 * Pinned scene (wide screens, motion allowed): panel widths are tied to the
 * viewport height, so every image is the same height (about 46svh) and the
 * row reads as one strip whatever the shape.
 */
const sceneWidths = {
  wide: "scene:w-[min(82svh,68vw)]",
  landscape: "scene:w-[min(61svh,52vw)]",
  portrait: "scene:w-[min(37svh,34vw)]",
} as const;

const total = String(projects.length).padStart(2, "0");

export function Work() {
  const section = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(SCENE_QUERY, () => {
        const trackEl = track.current;
        const sceneEl = scene.current;
        if (!trackEl || !sceneEl) return;

        // How far the strip travels: its overflow past the right edge.
        const distance = () => Math.max(0, trackEl.scrollWidth - window.innerWidth);
        const last = projects.length - 1;

        // Vertical scroll drives one linear timeline: the strip slides left
        // while the progress bar fills. ease "none" keeps scroll and position 1:1.
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: sceneEl,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const index = Math.min(last, Math.round(self.progress * last));
              if (counter.current) counter.current.textContent = String(index + 1).padStart(2, "0");
            },
          },
        });
        tl.to(trackEl, { x: () => -distance() }, 0).fromTo(bar.current, { scaleX: 0 }, { scaleX: 1 }, 0);

        // Each image drifts slightly against the strip as it crosses the screen.
        gsap.utils.toArray<HTMLElement>(".scene-media > *").forEach((frame) => {
          gsap.set(frame, { scale: 1.12 });
          gsap.fromTo(
            frame,
            { xPercent: 5 },
            {
              xPercent: -5,
              ease: "none",
              scrollTrigger: {
                trigger: frame.closest(".scene-panel"),
                containerAnimation: tl,
                start: "left right",
                end: "right left",
                scrub: true,
              },
            },
          );
        });
      });
    },
    { scope: section },
  );

  return (
    <section id="work" ref={section} className="scroll-mt-0 section-y scene:pb-[clamp(3rem,6vw,6rem)]">
      <div className="gutter grid-12 items-end gap-y-8">
        <RevealLines
          lines={["Selected work.", "Creative thinking.", "Real-world impact."]}
          className="display col-span-12 text-[clamp(2.25rem,7.6vw,9.5rem)] lg:col-span-10"
        />
        <p className="label col-span-12 text-muted lg:col-span-2 lg:pb-3 lg:text-right">
          {total} projects
          <br />
          2010 – 2026
        </p>
      </div>

      <div
        ref={scene}
        className="mt-[clamp(3.5rem,8vw,8rem)] scene:relative scene:mt-[clamp(2rem,4vw,4rem)] scene:flex scene:h-svh scene:flex-col scene:justify-center scene:overflow-hidden"
      >
        <div
          ref={track}
          className="gutter noscene:grid-12 noscene:gap-y-[clamp(4rem,9vw,9rem)] scene:flex scene:w-max scene:items-start scene:gap-[clamp(3rem,5vw,6rem)] scene:pt-[6svh] scene:will-change-transform"
        >
          {projects.map((project, i) => {
            const place = placements[i % placements.length];
            // A video poster is 16:9; a portrait slot would crop it too hard.
            const shape = project.cover.type === "youtube" && place.shape === "portrait" ? "landscape" : place.shape;
            return (
              <RevealBlock
                key={project.slug}
                className={`scene-panel col-span-12 ${place.cols} scene:shrink-0 ${sceneWidths[shape]}`}
              >
                <ProjectCard project={project} shape={shape} sizes={place.sizes} scene />
              </RevealBlock>
            );
          })}

          {/* Closing panel of the strip; on stacked layouts the link sits below. */}
          <div className="hidden scene:flex scene:w-[min(40svh,30vw)] scene:shrink-0 scene:flex-col scene:items-start scene:justify-center scene:gap-6 scene:self-stretch">
            <p className="display text-[clamp(2rem,3.6vw,4rem)]">
              Every
              <br />
              discipline.
            </p>
            <PillLink href="/work" transitionLabel="All work">
              Browse all work
            </PillLink>
          </div>
        </div>

        {/* Scene progress: current case, total and a filling rule. */}
        <div
          aria-hidden="true"
          className="gutter pointer-events-none absolute inset-x-0 bottom-[clamp(1.25rem,3svh,2.5rem)] hidden items-center gap-6 scene:flex"
        >
          <p className="label tabular-nums text-muted">
            <span ref={counter} className="text-fg">
              01
            </span>{" "}
            / {total}
          </p>
          <span className="relative h-px flex-1 bg-line">
            <span ref={bar} className="absolute inset-0 origin-left scale-x-0 bg-accent" />
          </span>
          <p className="label text-muted">Scroll</p>
        </div>
      </div>

      <div className="mt-[clamp(4rem,8vw,8rem)] flex justify-center scene:hidden">
        <PillLink href="/work" transitionLabel="All work">
          Browse all work by discipline
        </PillLink>
      </div>
    </section>
  );
}
