import { RevealBlock, RevealLines } from "@/components/ui/Reveal";
import { FactList } from "@/components/ui/FactList";
import { about } from "@/content/site";

export function About({ as = "h2" }: { as?: "h1" | "h2" }) {
  const [lead, ...rest] = about.paragraphs;
  return (
    <section
      id="about"
      className={`gutter section-y ${as === "h1" ? "pt-[clamp(7rem,16vh,11rem)]" : "border-t border-line"}`}
    >
      <RevealLines as={as} lines={about.headline} className="display text-[clamp(2.5rem,9.4vw,12rem)]" />

      <div className="grid-12 mt-[clamp(3.5rem,8vw,8rem)] gap-y-16">
        <div className="col-span-12 lg:col-span-6">
          <RevealBlock>
            <p className="text-[clamp(1.5rem,2.5vw,2.5rem)] font-medium leading-[1.14] tracking-[-0.03em]">{lead}</p>
          </RevealBlock>
          <RevealBlock delay={0.1} className="mt-10 max-w-[58ch] space-y-5 text-body leading-[1.55] text-muted">
            {rest.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </RevealBlock>

          <FactList
            facts={[...about.facts]}
            className="mt-14 grid grid-cols-1 gap-x-8 border-t border-line sm:grid-cols-2"
          />
        </div>

        <div className="col-span-12 lg:col-span-5 lg:col-start-8">
          <h3 className="label text-muted">Experience</h3>
          <ol className="mt-4 border-t border-line">
            {about.experience.map((job, i) => (
              <li
                key={`${job.company}-${job.period}`}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-b border-line py-4"
              >
                <div>
                  <p className="text-[clamp(1.25rem,1.8vw,1.75rem)] font-medium leading-[1.15] tracking-[-0.02em]">
                    {job.company}
                    {i === 0 && (
                      <span
                        className="ml-3 inline-block h-2 w-2 -translate-y-[0.2em] rounded-full bg-accent"
                        style={{ animation: "pulse-dot 2.4s ease-out infinite" }}
                        aria-hidden
                      />
                    )}
                  </p>
                  <p className="mt-1 text-small text-muted">{job.role}</p>
                </div>
                <p className="label tabular-nums text-muted">{job.period}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
