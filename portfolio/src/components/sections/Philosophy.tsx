"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { RevealLines, ScrollWords } from "@/components/ui/Reveal";
import { philosophy } from "@/content/site";

const rings = [
  { cx: 150, cy: 118, label: "Clarity", lx: 150, ly: 34 },
  { cx: 112, cy: 184, label: "Creativity", lx: 38, ly: 262 },
  { cx: 188, cy: 184, label: "Purpose", lx: 262, ly: 262 },
];

/** Three overlapping fields; the copy is about the place where they meet. */
function Intersection() {
  const ref = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref as unknown as React.RefObject<HTMLElement>, offset: ["start 0.9", "center 0.5"] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const core = useTransform(scrollYProgress, [0.7, 1], [0, 1]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 300 290"
      className="w-full max-w-[22rem]"
      role="img"
      aria-label="Diagram: design sits where clarity, creativity and purpose overlap"
    >
      {rings.map((r) => (
        <g key={r.label}>
          <motion.circle
            cx={r.cx}
            cy={r.cy}
            r={76}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ pathLength: reduced ? 1 : draw }}
          />
          <text
            x={r.lx}
            y={r.ly}
            textAnchor="middle"
            className="fill-[var(--muted)] font-mono text-[9px] uppercase tracking-[0.06em]"
          >
            {r.label}
          </text>
        </g>
      ))}
      <motion.circle cx={150} cy={162} r={5} className="fill-[var(--accent)]" style={{ opacity: reduced ? 1 : core }} />
    </svg>
  );
}

export function Philosophy() {
  return (
    <section className="tone-flip gutter py-[clamp(6rem,14vw,13rem)]">
      <RevealLines lines={philosophy.headline} className="display text-[clamp(2.5rem,8.6vw,11.5rem)]" />
      <div className="grid-12 mt-[clamp(4rem,9vw,9rem)] items-end gap-y-12">
        <div className="col-span-8 col-start-1 sm:col-span-5 lg:col-span-3">
          <Intersection />
        </div>
        <ScrollWords
          text={philosophy.body}
          className="col-span-12 text-[clamp(1.5rem,2.9vw,3rem)] font-medium leading-[1.12] tracking-[-0.03em] lg:col-span-7 lg:col-start-6"
        />
      </div>
    </section>
  );
}
