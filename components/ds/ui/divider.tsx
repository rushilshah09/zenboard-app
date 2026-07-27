import { cn } from "@/lib/cn";

// design-system.md §4.10 — one divider per ~5 items; prefer bigger gaps first.
export interface DividerProps {
  variant?: "hairline" | "rule" | "vertical";
  /** A labelled rule (overline text, e.g. sidebar groups / long forms). */
  label?: string;
  className?: string;
}

export function Divider({ variant = "rule", label, className }: DividerProps) {
  if (variant === "vertical") {
    return (
      <span role="separator" aria-orientation="vertical" className={cn("mx-2 inline-block h-4 w-px bg-line-soft", className)} />
    );
  }
  if (label) {
    return (
      <div role="separator" aria-orientation="horizontal" className={cn("flex items-center gap-3", className)}>
        <span className="h-px flex-1 bg-line" />
        <span className="text-overline uppercase text-ink-500">{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }
  return <hr className={cn("h-px border-0", variant === "hairline" ? "bg-line-soft" : "bg-line", className)} />;
}
