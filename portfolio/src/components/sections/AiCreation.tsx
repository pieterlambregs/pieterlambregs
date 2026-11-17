import Image from "next/image";
import { PillLink } from "@/components/ui/PillLink";
import { RevealLines } from "@/components/ui/Reveal";
import { TransitionLink } from "@/components/ui/TransitionLink";
import { ai } from "@/content/site";

/** How generative AI fits into the work, shown with one real example. */
export function AiCreation() {
  return (
    <section id="ai" className="gutter border-t border-line section-y">
      <div className="grid-12 gap-y-12">
        <div className="col-span-12 lg:col-span-7">
          <RevealLines lines={ai.headline} className="display text-[clamp(2.5rem,7.4vw,9rem)]" />
          <p className="mt-[clamp(2rem,4vw,4rem)] max-w-[30ch] text-[clamp(1.375rem,2.3vw,2.25rem)] font-medium leading-[1.16] tracking-[-0.025em]">
            {ai.body}
          </p>

          <ul className="mt-[clamp(2.5rem,5vw,5rem)] border-t border-line">
            {ai.points.map((point) => (
              <li key={point.name} className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[14rem_1fr]">
                <h3 className="text-body font-medium leading-[1.35]">{point.name}</h3>
                <p className="max-w-[44ch] text-body text-muted">{point.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <PillLink href={ai.href} transitionLabel="AI content creation">
              See how the image was made
            </PillLink>
          </div>
        </div>

        <figure className="col-span-12 sm:col-span-8 lg:col-span-4 lg:col-start-9">
          <TransitionLink
            href={ai.href}
            transitionLabel="AI content creation"
            data-cursor="View case"
            className="group relative block aspect-square overflow-hidden bg-surface"
          >
            <Image
              src={ai.image.src}
              alt={ai.image.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 66vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
            />
            <span className="label absolute left-3 top-3 bg-[#08090b] px-2.5 py-1.5 text-[#f4f3ef]">AI-generated</span>
          </TransitionLink>
          <figcaption className="label mt-3 text-muted">{ai.image.credit}</figcaption>
        </figure>
      </div>
    </section>
  );
}
