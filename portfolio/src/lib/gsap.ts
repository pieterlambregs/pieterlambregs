"use client";

/**
 * GSAP entry point. Import gsap and its plugins from here so registration
 * happens once. GSAP owns pinned and scrubbed scroll scenes; Motion owns
 * everything else (see CLAUDE.md).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Same query as the `scene` CSS variant in globals.css. Keep them in sync. */
export const SCENE_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger, useGSAP };
