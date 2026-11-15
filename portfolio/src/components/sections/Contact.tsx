import { Magnetic } from "@/components/ui/Magnetic";
import { RevealBlock, RevealLines } from "@/components/ui/Reveal";
import { contact, site, socials } from "@/content/site";

export function Contact() {
  return (
    <section id="contact" className="gutter relative overflow-hidden pb-[clamp(4rem,8vw,7rem)] pt-[clamp(6rem,13vw,12rem)]">
      <div className="relative">
        <RevealLines lines={contact.headline} className="display text-[clamp(3rem,13.6vw,19rem)]" />

        {/* The one big gesture on the page: a disc that leans toward the pointer. */}
        <div className="mt-10 md:absolute md:bottom-[0.06em] md:right-0 md:mt-0">
          <Magnetic strength={0.45}>
            <a
              href={`mailto:${site.email}`}
              className="group flex h-[clamp(8.5rem,12.5vw,12rem)] w-[clamp(8.5rem,12.5vw,12rem)] items-center justify-center rounded-full bg-accent text-[#08090b] transition-transform duration-700 ease-out-expo hover:scale-[1.06]"
            >
              <span className="label text-center leading-[1.5]">
                Send an
                <br />
                email
              </span>
            </a>
          </Magnetic>
        </div>
      </div>

      <div className="grid-12 mt-[clamp(3.5rem,7vw,7rem)] gap-y-12 border-t border-line pt-8">
        <RevealBlock className="col-span-12 md:col-span-5">
          <p className="max-w-[40ch] text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.4]">{contact.body}</p>
        </RevealBlock>

        <div className="col-span-12 md:col-span-4 md:col-start-7">
          <h3 className="label text-muted">Email</h3>
          <a
            href={`mailto:${site.email}`}
            className="link-draw mt-3 inline-block break-all text-[clamp(1.25rem,2vw,2rem)] font-medium leading-[1.2] tracking-[-0.02em]"
          >
            {site.email}
          </a>
        </div>

        <div className="col-span-12 md:col-span-2 md:col-start-11">
          <h3 className="label text-muted">Elsewhere</h3>
          <ul className="mt-3 space-y-1.5">
            {socials.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="link-draw text-[1.0625rem] leading-[1.35]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
