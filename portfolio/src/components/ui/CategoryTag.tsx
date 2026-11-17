import { getCategory, type CategoryId } from "@/content/projects";

/** A project's discipline, shown as its accent index and name: "02 Brand & identity". */
export function CategoryTag({ id, className }: { id: CategoryId; className?: string }) {
  const category = getCategory(id);
  return (
    <p className={`label text-muted ${className ?? ""}`}>
      <span className="text-accent">{category.index}</span> {category.name}
    </p>
  );
}
