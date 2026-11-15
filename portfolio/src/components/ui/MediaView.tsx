"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Media } from "@/content/projects";

/** Stand-in frame for media that has not been supplied yet. */
function Pending({ note }: { note: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-surface">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px calc(100% / 24))",
        }}
      />
      <div
        className="absolute inset-y-0 left-0 w-px bg-accent"
        style={{ animation: "reel-scan 7s linear infinite" }}
      />
      <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-8">
        <div className="label flex justify-between text-muted">
          <span>Placeholder</span>
          <span>00:00:00:00</span>
        </div>
        <p className="label max-w-[28ch] text-accent">{note}</p>
      </div>
    </div>
  );
}

function AutoVideo({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  // Play only while on screen; stay paused for reduced-motion visitors.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (reduced) {
      // No autoplay: hand the visitor the controls instead.
      video.controls = true;
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <video
      ref={ref}
      src={src}
      aria-label={alt}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}

type Props = {
  media: Media;
  sizes: string;
  /** Override the media's own aspect ratio, e.g. "4 / 3". */
  ratio?: string;
  priority?: boolean;
  parallax?: boolean;
  className?: string;
};

/**
 * Renders one piece of project media (image, video or pending placeholder)
 * in a frame of fixed aspect ratio, optionally with scroll parallax.
 */
export function MediaView({ media, sizes, ratio, priority, parallax = true, className }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const moving = parallax && !reduced && media.type !== "pending";

  return (
    <div
      ref={frame}
      className={`relative overflow-hidden bg-surface ${className ?? ""}`}
      style={{ aspectRatio: ratio ?? `${media.width} / ${media.height}` }}
    >
      <motion.div className="absolute inset-0" style={moving ? { y, scale: 1.14 } : undefined}>
        {media.type === "image" && (
          <Image
            src={media.src}
            alt={media.alt}
            fill
            sizes={sizes}
            priority={priority}
            onLoad={() => setLoaded(true)}
            className={`object-cover transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {media.type === "video" && <AutoVideo src={media.src} alt={media.alt} />}
        {media.type === "pending" && <Pending note={media.note} />}
      </motion.div>
    </div>
  );
}
