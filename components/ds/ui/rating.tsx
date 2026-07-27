import * as React from "react";
import { Star } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md §4.21 — 5 stars, ink-300 empty → warning-500 filled. It IS a
// radio group: ←→ changes, Enter/Space commits, 0–5 types directly. Read-only
// is aria-hidden with adjacent text — never make an SR user count stars.
export interface RatingProps {
  value: number;
  onValueChange?: (v: number) => void;
  max?: number;
  readOnly?: boolean;
  /** Adjacent text for read-only, e.g. "4.2 out of 5 · 31 reviews". */
  caption?: string;
  "aria-label"?: string;
  className?: string;
}

export function Rating({ value, onValueChange, max = 5, readOnly, caption, className, ...aria }: RatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const groupRef = React.useRef<HTMLDivElement>(null);
  const shown = hover ?? value;

  if (readOnly) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <span aria-hidden className="inline-flex gap-0.5">
          {Array.from({ length: max }, (_, i) => (
            <StarGlyph key={i} filled={i < Math.round(value)} half={value - i > 0 && value - i < 0.75 && value - i >= 0.25} />
          ))}
        </span>
        <span className="text-meta text-ink-500">{caption ?? `${value} out of ${max}`}</span>
      </span>
    );
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={aria["aria-label"] ?? "Rating"}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (/^[0-9]$/.test(e.key)) {
          const n = Math.min(max, Number(e.key));
          onValueChange?.(n);
        }
      }}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span className="inline-flex gap-0.5">
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          const checked = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${n} of ${max}`}
              tabIndex={checked || (value === 0 && n === 1) ? 0 : -1}
              onMouseEnter={() => setHover(n)}
              onClick={() => onValueChange?.(n)}
              onKeyDown={(e) => {
                let next: number | undefined;
                if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(max, value + 1);
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, value - 1);
                if (next !== undefined) {
                  e.preventDefault();
                  onValueChange?.(next);
                  // keep focus on the checked star (single tab stop)
                  requestAnimationFrame(() => {
                    groupRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
                  });
                }
              }}
              className="focus-ring rounded-xs p-0.5"
            >
              <StarGlyph filled={n <= shown} />
            </button>
          );
        })}
      </span>
      <span className="text-meta text-ink-500" aria-hidden>
        {shown > 0 ? `${shown} of ${max}` : ""}
      </span>
    </div>
  );
}

function StarGlyph({ filled, half }: { filled: boolean; half?: boolean }) {
  return (
    <span className="relative inline-flex" aria-hidden>
      <Star className={cn("size-4", filled ? "fill-warning-500 text-warning-500" : "text-ink-300")} strokeWidth={1.75} />
      {half && (
        <span className="absolute inset-0 w-1/2 overflow-hidden">
          <Star className="size-4 fill-warning-500 text-warning-500" strokeWidth={1.75} />
        </span>
      )}
    </span>
  );
}
