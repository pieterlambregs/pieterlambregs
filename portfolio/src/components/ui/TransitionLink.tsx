"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { usePageTransition } from "@/components/providers/Providers";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** Shown on the transition panel while the next page loads. */
  transitionLabel?: string;
};

/** A link that plays the page transition, and smooth-scrolls same-page anchors. */
export function TransitionLink({ href, transitionLabel, onClick, ...rest }: Props) {
  const navigate = usePageTransition();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href, transitionLabel);
  }

  return <Link href={href} onClick={handleClick} {...rest} />;
}
