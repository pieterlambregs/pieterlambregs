"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Media } from "@/content/projects";
import { asset } from "@/lib/asset";

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
      src={asset(src)}
      aria-label={alt}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}

/**
 * YouTube video behind a local poster. Nothing is requested from YouTube
 * until the visitor presses play; inside a card (not playable) it is just
 * the poster with a play mark.
 */
function YouTube({
  id,
  poster,
  alt,
  sizes,
  priority,
  playable,
}: {
  id: string;
  poster: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  playable: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={alt}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  const mark = (
    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-bg transition-transform duration-500 ease-out-expo group-hover:scale-110 sm:h-20 sm:w-20">
      <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M6 4l14 8-14 8z" />
      </svg>
    </span>
  );

  return (
    <>
      <Image src={asset(poster)} alt={playable ? "" : alt} fill sizes={sizes} priority={priority} className="object-cover" />
      {playable ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${alt}`}
          className="group absolute inset-0 flex cursor-pointer items-center justify-center"
        >
          {mark}
        </button>
      ) : (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">{mark}</span>
      )}
    </>
  );
}

type Props = {
  media: Media;
  sizes: string;
  /** Override the media's own aspect ratio, e.g. "4 / 3". */
  ratio?: string;
  priority?: boolean;
  parallax?: boolean;
  /** Let a YouTube item start playing in place (off inside linked cards). */
  playable?: boolean;
  className?: string;
};

/**
 * Renders one piece of project media (image, video, YouTube or pending placeholder)
 * in a frame of fixed aspect ratio, optionally with scroll parallax.
 */
export function MediaView({ media, sizes, ratio, priority, parallax = true, playable = false, className }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const moving = parallax && !reduced && media.type !== "pending" && !(media.type === "youtube" && playable);

  return (
    <div
      ref={frame}
      className={`relative overflow-hidden bg-surface ${className ?? ""}`}
      style={{ aspectRatio: ratio ?? `${media.width} / ${media.height}` }}
    >
      <motion.div className="absolute inset-0" style={moving ? { y, scale: 1.14 } : undefined}>
        {media.type === "image" && (
          <Image
            src={asset(media.src)}
            alt={media.alt}
            fill
            sizes={sizes}
            priority={priority}
            onLoad={() => setLoaded(true)}
            className={`object-cover transition-[opacity,transform] duration-700 ease-out-expo group-hover:scale-[1.03] ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {media.type === "video" && <AutoVideo src={media.src} alt={media.alt} />}
        {media.type === "youtube" && (
          <YouTube id={media.id} poster={media.poster} alt={media.alt} sizes={sizes} priority={priority} playable={playable} />
        )}
        {media.type === "pending" && <Pending note={media.note} />}
      </motion.div>
    </div>
  );
}
