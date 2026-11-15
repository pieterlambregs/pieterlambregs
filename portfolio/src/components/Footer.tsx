import { footer, site } from "@/content/site";
import { LocalTime } from "@/components/ui/LocalTime";

export function Footer() {
  return (
    <footer className="gutter border-t border-line py-6">
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
