import { footer, pages, site } from "@/content/site";
import { TransitionLink } from "@/components/ui/TransitionLink";
import { LocalTime } from "@/components/ui/LocalTime";

export function Footer() {
  return (
    <footer className="gutter border-t border-line py-6">
      <nav aria-label="Pages" className="mb-6 border-b border-line pb-4">
        <ul className="label flex flex-wrap gap-x-8">
          {pages.map((page) => (
            <li key={page.href}>
              <TransitionLink href={page.href} transitionLabel={page.label} className="link-draw inline-block py-3">
                {page.label}
              </TransitionLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="label flex flex-col gap-3 text-muted md:flex-row md:items-center md:justify-between">
        <p className="text-fg">{site.name} © 2026</p>
        <p>{footer.line}</p>
        <p className="flex gap-4">
          <span>{site.location}</span>
          <LocalTime />
        </p>
      </div>
    </footer>
  );
}
