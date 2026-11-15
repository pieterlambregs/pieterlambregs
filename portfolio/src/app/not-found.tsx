import { TransitionLink } from "@/components/ui/TransitionLink";

export default function NotFound() {
  return (
    <section className="gutter flex min-h-[100svh] flex-col justify-end pb-16 pt-32">
      <p className="label text-muted">Error 404</p>
      <h1 className="display mt-4 text-[clamp(3.25rem,15vw,20rem)]">Off the grid.</h1>
      <p className="mt-8 max-w-[40ch] text-[1.0625rem] leading-[1.5] text-muted">
        This page does not exist, or it moved. The work is still where it was.
      </p>
      <div className="label mt-8 flex gap-8">
        <TransitionLink href="/" transitionLabel="Pieter Lambregs" className="link-draw py-1">
          Go to the home page
        </TransitionLink>
        <TransitionLink href="/work" transitionLabel="All work" className="link-draw py-1">
          Browse all work
        </TransitionLink>
      </div>
    </section>
  );
}
