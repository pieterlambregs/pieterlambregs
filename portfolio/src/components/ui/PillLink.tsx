import { Magnetic } from "@/components/ui/Magnetic";
import { TransitionLink } from "@/components/ui/TransitionLink";

/**
 * The site's one button style: an outlined pill that fills on hover, presses
 * on click and leans toward the pointer. Used for secondary navigation
 * between pages, never for inline links.
 */
export function PillLink({
  href,
  children,
  transitionLabel,
}: {
  href: string;
  children: string;
  transitionLabel?: string;
}) {
  return (
    <Magnetic>
      <TransitionLink
        href={href}
        transitionLabel={transitionLabel}
        className="label flex h-14 items-center rounded-full border border-line px-8 transition-[color,background-color,border-color,transform] duration-300 hover:border-fg hover:bg-fg hover:text-bg active:scale-[0.97]"
      >
        {children}
      </TransitionLink>
    </Magnetic>
  );
}
