"use client";

import { useLenis } from "lenis/react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { nav, site, socials } from "@/content/site";
import { useTheme } from "@/components/providers/Providers";
import { Magnetic } from "@/components/ui/Magnetic";
import { TransitionLink } from "@/components/ui/TransitionLink";

const EASE = [0.76, 0, 0.24, 1] as const;

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="group relative h-8 w-8 cursor-pointer"
    >
      <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-current">
        <span
          className="absolute inset-y-0 left-0 w-1/2 bg-current transition-transform duration-500 ease-out-expo"
          style={{ transform: theme === "light" ? "translateX(100%)" : "none" }}
        />
      </span>
    </button>
  );
}

export function Nav() {
  const { scrollY } = useScroll();
  const lenis = useLenis();
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  // Step aside while reading down the page, return on the way back up.
  useMotionValueEvent(scrollY, "change", (now) => {
    const before = scrollY.getPrevious() ?? 0;
    if (now < 120) setHidden(false);
    else if (now > before + 4) setHidden(true);
    else if (now < before - 4) setHidden(false);
  });

  useEffect(() => {
    if (open) lenis?.stop();
    else lenis?.start();
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open, lenis]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-[70] text-[#f4f3ef] mix-blend-difference"
        initial={false}
        animate={{ y: hidden && !open ? "-110%" : "0%" }}
        transition={{ duration: reduced ? 0 : 0.6, ease: EASE }}
      >
        <div className="intro-fade gutter flex h-16 items-center justify-between sm:h-20">
          <TransitionLink
            href="/"
            transitionLabel={site.name}
            onClick={() => setOpen(false)}
            className="text-[0.8125rem] font-semibold uppercase leading-none tracking-[-0.01em]"
            aria-label={`${site.name}, home`}
          >
            Pieter Lambregs
          </TransitionLink>

          <div className="flex items-center gap-5 md:gap-8">
            <p className="label hidden items-center gap-2 lg:flex">
              <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                style={{ animation: "pulse-dot 2.4s ease-out infinite" }}
              />
              {site.status}
            </p>
            <nav aria-label="Primary" className="hidden md:block">
              <ul className="flex items-center gap-7">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Magnetic strength={0.3}>
                      <TransitionLink
                        href={item.href}
                        transitionLabel={site.name}
                        className="label link-draw block py-2"
                      >
                        {item.label}
                      </TransitionLink>
                    </Magnetic>
                  </li>
                ))}
              </ul>
            </nav>
            <ThemeToggle />
            <button
              type="button"
              className="label -mr-2 cursor-pointer px-2 py-3 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col justify-between bg-bg gutter pb-8 pt-24 md:hidden"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
            transition={{ duration: reduced ? 0 : 0.7, ease: EASE }}
          >
            <nav aria-label="Mobile">
              <ul>
                {nav.map((item, i) => (
                  <li key={item.href} className="overflow-hidden border-b border-line">
                    <motion.div
                      initial={{ y: "110%" }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.25 + i * 0.06 }}
                    >
                      <TransitionLink
                        href={item.href}
                        transitionLabel={site.name}
                        onClick={() => setOpen(false)}
                        className="display block py-4 text-[clamp(2.75rem,14vw,5rem)]"
                      >
                        {item.label}
                      </TransitionLink>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex flex-col gap-6">
              <p className="label flex items-center gap-2 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {site.status}
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {socials.slice(0, 4).map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noreferrer" className="label py-2">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
