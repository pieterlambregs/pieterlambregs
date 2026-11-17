"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { RevealLines } from "@/components/ui/Reveal";
import { process } from "@/content/site";

function Step({
  item,
  index,
  progress,
}: {
  item: (typeof process)[number];
  index: number;
  progress: MotionValue<number>;
}) {
  const reduced = useReducedMotion();
  const at = index / process.length;
  const reached = useTransform(progress, [at, at + 0.12], [0.28, 1]);
  const dot = useTransform(progress, [at, at + 0.08], [0, 1]);

  return (
    <motion.li className="relative pt-8 md:pt-10" style={{ opacity: reduced ? 1 : reached }}>
      <motion.span
        aria-hidden
        className="absolute left-[-5px] top-[-5px] hidden h-[11px] w-[11px] rounded-full bg-accent md:block"
        style={{ scale: reduced ? 1 : dot }}
      />
      <p className="label tabular-nums text-muted">{item.step}</p>
      <h3 className="display mt-4 text-[clamp(2.25rem,4.6vw,5rem)]">{item.name}</h3>
      <p className="mt-4 max-w-[26ch] text-body text-muted">{item.body}</p>
    </motion.li>
  );
}

/** Four steps on one line; the line draws itself as the section scrolls by. */
export function Process() {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.6"] });

  return (
    <section className="tone-flip gutter section-y">
      <div className="grid-12 items-end gap-y-6">
        <RevealLines
          lines={["From first question", "to final file."]}
          className="display col-span-12 text-[clamp(2.25rem,6.2vw,8rem)] lg:col-span-9"
        />
        <p className="col-span-12 max-w-[36ch] text-small text-muted lg:col-span-3 lg:pb-3">
          Every project is different. The way I work through one stays the same.
        </p>
      </div>

      <ol ref={ref} className="relative mt-[clamp(4rem,8vw,8rem)] grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-4">
        <span aria-hidden className="absolute inset-x-0 top-0 hidden h-px bg-line md:block" />
        <motion.span
          aria-hidden
          className="absolute inset-x-0 top-0 hidden h-px origin-left bg-fg md:block"
          style={{ scaleX: reduced ? 1 : scrollYProgress }}
        />
        {process.map((item, i) => (
          <Step key={item.step} item={item} index={i} progress={scrollYProgress} />
        ))}
      </ol>
    </section>
  );
}
