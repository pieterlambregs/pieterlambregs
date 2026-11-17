"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/providers/Providers";
import { site } from "@/content/site";
import type { LineSpec } from "./GlassScene";

const GlassScene = dynamic(() => import("./GlassScene"), { ssr: false });

const NAME = ["Pieter", "Lambregs."];

const palette = {
  dark: { fg: "#f4f3ef", bg: "#08090b" },
  light: { fg: "#08090b", bg: "#f4f3ef" },
};

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Full-screen opening. The name is real HTML; when WebGL is available the
 * same two lines are redrawn inside the 3D scene so the glass form can
 * refract them, and the HTML copy turns transparent (it stays readable to
 * search engines and screen readers). Without WebGL the HTML simply shows.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion() ?? false;
  const { theme } = useTheme();
  const [lines, setLines] = useState<LineSpec[] | null>(null);
  const [glReady, setGlReady] = useState(false);
  const [introDelay, setIntroDelay] = useState(0);

  useEffect(() => {
    if (!supportsWebGL()) return;
    const h1 = heading.current;
    const host = section.current;
    if (!h1 || !host) return;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const origin = host.getBoundingClientRect();
      const specs = Array.from(h1.querySelectorAll<HTMLElement>("[data-line]")).map((el) => {
        // The mask is untransformed, so it gives the true line box.
        const box = el.parentElement!.getBoundingClientRect();
        return {
          text: (el.textContent ?? "").toUpperCase(),
          x: box.left - origin.left,
          cy: box.top - origin.top + box.height / 2,
          width: el.offsetWidth,
          height: box.height,
        };
      });
      setLines(specs);
    };

    setIntroDelay(reduced ? 0 : document.documentElement.hasAttribute("data-seen") ? 0.15 : 2.1);
    document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(h1);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [reduced]);

  const colors = palette[theme];

  return (
    <section ref={section} className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {lines && (
        <GlassScene
          lines={lines}
          fg={colors.fg}
          bg={colors.bg}
          reduced={reduced}
          introDelay={introDelay}
          onReady={() => setGlReady(true)}
        />
      )}

      <div className="gutter relative pt-[clamp(5.5rem,13vh,9rem)]">
        <h1
          ref={heading}
          aria-label={site.name}
          className={`display text-[calc((100vw-2*var(--gutter))/5.34)] transition-opacity duration-300 ${glReady ? "opacity-0" : ""}`}
        >
          {NAME.map((line, i) => (
            <span key={line} className="block overflow-hidden leading-[0.84]" aria-hidden>
              <span data-line className="intro-rise" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                {line}
              </span>
            </span>
          ))}
        </h1>
      </div>

      <div className="gutter relative mt-auto pb-[clamp(4.5rem,9vh,6rem)] pt-10">
        <div className="grid-12 gap-y-6">
          <div className="intro-fade col-span-12 md:col-span-4" style={{ "--d": "500ms" } as React.CSSProperties}>
            <p className="text-[clamp(1.25rem,1.7vw,1.75rem)] font-medium leading-[1.1] tracking-[-0.02em]">
              {site.role}
              <span className="block text-muted">{site.tagline}</span>
            </p>
          </div>
          <p
            className="intro-fade col-span-12 max-w-[46ch] text-small text-muted md:col-span-5 md:col-start-6 lg:col-span-4 lg:col-start-6"
            style={{ "--d": "620ms" } as React.CSSProperties}
          >
            {site.intro}
          </p>
          <ul
            className="intro-fade label col-span-12 flex flex-wrap gap-x-6 gap-y-1 text-muted md:col-span-12 lg:col-span-2 lg:col-start-11 lg:flex-col lg:items-end lg:text-right"
            style={{ "--d": "740ms" } as React.CSSProperties}
          >
            <li>Based in {site.location}</li>
            <li>{site.years} years of creative experience</li>
            <li>
              Currently at <span className="text-fg">{site.currentEmployer}</span>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="intro-fade label pointer-events-none absolute bottom-5 left-[var(--gutter)] flex items-center gap-3 text-muted"
        style={{ "--d": "1100ms" } as React.CSSProperties}
        aria-hidden
      >
        <span className="block h-7 w-px bg-line">
          <span className="block h-full w-full bg-fg" style={{ animation: "scroll-hint 2.4s var(--ease-in-out) infinite" }} />
        </span>
        <span>Scroll</span>
      </div>
    </section>
  );
}
