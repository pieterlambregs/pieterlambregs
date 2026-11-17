"use client";

import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ElementType, type ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";

const EASE = EASE_OUT;

/**
 * Headline whose lines rise out of a mask the first time they scroll into
 * view. Pass each line as a string; the element stays one heading for
 * assistive technology.
 */
export function RevealLines({
  lines,
  as: Tag = "h2",
  className,
  delay = 0,
  id,
}: {
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const reduced = useReducedMotion();
  // Watch the heading itself: the lines start outside their masks, so the
  // browser would never report them as visible.
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  return (
    <Tag ref={ref} className={className} id={id}>
      {lines.map((line, i) => (
        <span key={i} className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
          <motion.span
            className="block will-change-transform"
            initial={reduced ? false : { y: "115%" }}
            animate={inView || reduced ? { y: 0 } : undefined}
            transition={{ duration: 1.1, ease: EASE, delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/**
 * A plain block. It used to fade in on scroll; content now simply stands
 * where it is, and motion is kept for headlines and the hero.
 */
export function RevealBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const reduced = useReducedMotion();
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity: reduced ? 1 : opacity }}>{children} </motion.span>;
}

/** Paragraph whose words brighten one by one as the reader scrolls through it. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.5"] });
  const words = text.split(" ");

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {word}
        </Word>
      ))}
    </p>
  );
}
