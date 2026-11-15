"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ProjectCard } from "@/components/ui/ProjectCard";
import { categories, projects, type CategoryId } from "@/content/projects";

/** The full archive, filterable by discipline. */
export function WorkIndex() {
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const reduced = useReducedMotion();
  const shown = filter === "all" ? projects : projects.filter((p) => p.category === filter);
  const active = categories.find((c) => c.id === filter);

  return (
    <>
      <div className="grid-12 mt-[clamp(3rem,6vw,6rem)] gap-y-8 border-t border-line pt-6">
        <div role="group" aria-label="Filter by discipline" className="col-span-12 flex flex-wrap gap-2 lg:col-span-8">
          {[{ id: "all" as const, index: "00", name: "All work" }, ...categories].map((c) => {
            const on = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(c.id)}
                className={`label flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 transition-[color,background-color,border-color,transform] duration-300 active:scale-[0.97] ${
                  on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-fg hover:text-fg"
                }`}
              >
                <span className={on ? "" : "text-accent"}>{c.index}</span>
                {c.name}
              </button>
            );
          })}
        </div>
        <p className="col-span-12 max-w-[38ch] text-[0.9375rem] leading-[1.5] text-muted lg:col-span-4" aria-live="polite">
          {active ? active.description : "Six disciplines, one portfolio. Pick one to narrow the list."}
        </p>
      </div>

      <div className="grid-12 mt-[clamp(3rem,6vw,6rem)] gap-y-[clamp(3.5rem,7vw,7rem)]">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((project, i) => (
            <motion.div
              key={project.slug}
              layout={!reduced}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`col-span-12 ${i % 2 === 0 ? "md:col-span-7" : "md:col-span-4 md:col-start-9 md:mt-[22%]"}`}
            >
              <ProjectCard
                project={project}
                shape={i % 2 === 0 ? "landscape" : "portrait"}
                sizes={i % 2 === 0 ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
                priority={i < 2}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
