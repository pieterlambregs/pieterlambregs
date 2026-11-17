import type { ReactNode } from "react";

export type Fact = { label: string; value: ReactNode };

/**
 * Label/value pairs on hairlines.
 * - `stacked`: label above value, laid out in the columns you pass.
 * - `rows`: label beside value, one row per fact.
 */
export function FactList({
  facts,
  variant = "stacked",
  size = "body",
  className,
}: {
  facts: Fact[];
  variant?: "stacked" | "rows";
  size?: "body" | "small";
  className?: string;
}) {
  const value = `${size === "small" ? "text-small" : "text-body"} leading-[1.35]`;

  if (variant === "rows") {
    return (
      <dl className={`border-t border-line ${className ?? ""}`}>
        {facts.map((fact) => (
          <div key={fact.label} className="grid grid-cols-[7rem_1fr] gap-4 border-b border-line py-3">
            <dt className="label pt-1 text-muted">{fact.label}</dt>
            <dd className={value}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={className}>
      {facts.map((fact) => (
        <div key={fact.label} className="border-b border-line py-4">
          <dt className="label text-muted">{fact.label}</dt>
          <dd className={`mt-1.5 ${value}`}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
