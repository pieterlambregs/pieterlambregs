"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { animate, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { EASE_IN_OUT } from "@/lib/motion";

/* ------------------------------------------------------------------ theme */

type Theme = "dark" | "light";

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

/** The active theme, read from <html data-theme>. Dark on the server. */
export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => "dark");
  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    if (next === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem("pl-theme", next);
    } catch {}
  }, []);
  return { theme, toggle };
}

/* ------------------------------------------------------- page transitions */

type Navigate = (href: string, label?: string) => void;
const TransitionContext = createContext<Navigate>(() => {});
export const usePageTransition = () => useContext(TransitionContext);

const EASE = EASE_IN_OUT;

function TransitionLayer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const pending = useRef<{ hash: string } | null>(null);
  const failsafe = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scrollToHash = useCallback(
    (hash: string, immediate: boolean) => {
      const target = hash ? document.getElementById(hash.slice(1)) : null;
      if (lenis) {
        // The page may have just changed length; measure before moving.
        lenis.resize();
        lenis.scrollTo(target ?? 0, { immediate, force: true, duration: 1.4 });
      } else if (target) {
        target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    },
    [lenis],
  );

  const reveal = useCallback(() => {
    clearTimeout(failsafe.current);
    const el = panel.current;
    const job = pending.current;
    pending.current = null;
    if (!job) return;
    // Wait a frame so the new route has painted and can be measured.
    requestAnimationFrame(() => {
      scrollToHash(job.hash, true);
      if (!el) return;
      animate(el, { clipPath: "inset(0% 0% 100% 0%)" }, { duration: 0.8, ease: EASE, delay: 0.1 }).then(() => {
        el.style.visibility = "hidden";
        lenis?.start();
      });
    });
  }, [lenis, scrollToHash]);

  // The route changed underneath the panel: lift it.
  useEffect(() => {
    if (pending.current) reveal();
  }, [pathname, reveal]);

  const navigate = useCallback<Navigate>(
    (href, nextLabel = "") => {
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) {
        // The mobile menu pauses scrolling while open; make sure it is running.
        lenis?.start();
        document.documentElement.style.overflow = "";
        scrollToHash(url.hash, false);
        if (url.hash) history.replaceState(null, "", url.hash);
        return;
      }
      const el = panel.current;
      if (reduced || !el) {
        pending.current = { hash: url.hash };
        router.push(url.pathname);
        return;
      }
      if (pending.current) return;
      setLabel(nextLabel);
      lenis?.stop();
      el.style.visibility = "visible";
      pending.current = { hash: url.hash };
      animate(
        el,
        { clipPath: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] },
        { duration: 0.7, ease: EASE },
      ).then(() => {
        router.push(url.pathname);
        failsafe.current = setTimeout(reveal, 4000);
      });
    },
    [lenis, reduced, reveal, router, scrollToHash],
  );

  return (
    <TransitionContext.Provider value={navigate}>
      {children}
      <div
        ref={panel}
        aria-hidden
        className="tone-flip pointer-events-none fixed inset-0 z-[90] flex items-end justify-between gutter pb-[var(--gutter)]"
        style={{ visibility: "hidden", clipPath: "inset(100% 0% 0% 0%)" }}
      >
        <span className="display text-[clamp(2.5rem,9vw,9rem)]">{label}</span>
        <span className="label pb-2 text-muted">Loading</span>
      </div>
    </TransitionContext.Provider>
  );
}

/* ----------------------------------------------------------------- root */

export function Providers({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  // Once the loader has played, later visits to the home page skip the wait.
  useEffect(() => {
    const id = setTimeout(() => document.documentElement.setAttribute("data-seen", ""), 2600);
    return () => clearTimeout(id);
  }, []);

  const options = useMemo(() => ({ lerp: 0.1, anchors: false, autoRaf: true }), []);

  const tree = <TransitionLayer>{children}</TransitionLayer>;
  if (reduced) return tree;
  return (
    <ReactLenis root options={options}>
      {tree}
    </ReactLenis>
  );
}
