"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";
import { RevealLines } from "@/components/ui/Reveal";
import { expertise, type Discipline } from "@/content/site";
import { EASE_OUT } from "@/lib/motion";

function Preview({ item }: { item: Discipline }) {
  return item.preview.type === "video" ? (
    <video
      src={item.preview.src}
      aria-label={item.preview.alt}
      className="h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
    />
  ) : (
    <Image src={item.preview.src} alt={item.preview.alt} fill sizes="320px" className="object-cover" />
  );
}

/**
 * The toolkit: a list of disciplines. On desktop a preview follows the
 * pointer and swaps as you move down the list; on touch each row opens to
 * show its description and preview inline.
 */
export function Expertise() {
  const [active, setActive] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  // True while a mouse is driving the list, so a click does not close the
  // row the pointer has just opened.
  const byMouse = useRef(false);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 160, damping: 22, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 160, damping: 22, mass: 0.5 });

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
    setHovering(true);
    byMouse.current = true;
  }

  const current = active !== null ? expertise[active] : null;

  return (
    <section id="expertise" className="gutter section-y">
      <div className="grid-12 items-end gap-y-6">
        <RevealLines lines={["What I do."]} className="display col-span-12 text-[clamp(2.75rem,9vw,11rem)] lg:col-span-8" />
        <p className="col-span-12 max-w-[40ch] text-small text-muted lg:col-span-4 lg:pb-4">
          Nine disciplines, one toolkit. Most projects need several of them at once, and that is where
          working across all of them pays off.
        </p>
      </div>

      <div
        className="relative mt-[clamp(3rem,6vw,6rem)]"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHovering(false);
          setActive(null);
          byMouse.current = false;
        }}
      >
        <ul className="border-t border-line">
          {expertise.map((item, i) => {
            const open = active === i;
            const dimmed = active !== null && !open;
            return (
              <li key={item.name} className="border-b border-line">
                <button
                  type="button"
                  aria-expanded={open}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                  onClick={() => setActive((v) => (v === i && !byMouse.current ? null : i))}
                  className={`grid-12 w-full cursor-pointer items-baseline py-5 text-left transition-opacity duration-500 md:py-7 ${dimmed ? "opacity-30" : ""}`}
                >
                  <span className="display col-span-10 text-[clamp(1.75rem,5.2vw,5.5rem)] md:col-span-7">
                    <span
                      className="inline-block transition-transform duration-700 ease-out-expo"
                      style={{ transform: open ? "translateX(0.35em)" : "none" }}
                    >
                      {item.name}
                    </span>
                  </span>
                  <span className="label col-span-4 hidden text-muted md:block md:col-start-9">
                    {item.keywords.join(" / ")}
                  </span>
                  <span
                    aria-hidden
                    className="label col-span-2 justify-self-end text-muted md:col-span-1 md:col-start-12"
                  >
                    {open ? "–" : "+"}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.5, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="grid-12 gap-y-5 pb-7">
                        <p className="col-span-12 max-w-[48ch] text-body md:col-span-6 md:col-start-1 lg:col-span-5">
                          {item.description}
                        </p>
                        <div className="relative col-span-8 aspect-[4/5] overflow-hidden bg-surface sm:col-span-5 md:hidden">
                          <Preview item={item} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>

        {/* Pointer-following preview, desktop only. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 hidden md:block"
          style={{ x: sx, y: sy }}
        >
          <motion.div
            className="relative -translate-x-[-2.5rem] -translate-y-1/2 overflow-hidden bg-surface"
            initial={false}
            animate={{
              width: current && hovering ? 300 : 0,
              height: current && hovering ? 375 : 0,
              opacity: current && hovering ? 1 : 0,
            }}
            transition={{ duration: reduced ? 0 : 0.55, ease: EASE_OUT }}
          >
            <AnimatePresence mode="popLayout">
              {current && (
                <motion.div
                  key={current.name}
                  className="absolute left-0 top-0 h-[375px] w-[300px]"
                  initial={{ opacity: 0, scale: 1.12 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: EASE_OUT }}
                >
                  <Preview item={current} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
