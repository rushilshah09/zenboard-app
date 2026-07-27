import * as React from "react";
import { X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

// design-system.md §4.57 — rises from the bottom of the content pane when ≥1
// item is selected. The ONLY dark chrome element in the light theme: it's a
// temporary mode and must be unmissable. Esc clears (before anything else).
export interface SelectionBarProps {
  count: number;
  noun?: string;
  /** Only actions legal for ALL selected items (§4.57). */
  children: React.ReactNode;
  onClear: () => void;
  className?: string;
}

export function SelectionBar({ count, noun = "selected", children, onClear, className }: SelectionBarProps) {
  React.useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, onClear]);

  if (count === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-toast flex justify-center">
      <div
        role="toolbar"
        aria-label={`${count} ${noun}`}
        // Dark chrome: the child buttons' focus rings offset in ink-900, not paper,
        // so the ring never reads as a halo on the wrong colour (§2.11.2 / B1.3).
        style={{ ["--focus-offset" as string]: "var(--color-ink-900)" }}
        className={cn(
          "pointer-events-auto flex h-12 max-w-[640px] items-center gap-3 rounded-md bg-ink-900 px-4 text-paper shadow-lift-3 animate-rise",
          className,
        )}
      >
        <span role="status" aria-live="polite" className="text-ui font-medium" data-numeric>
          {count} {noun}
        </span>
        <span aria-hidden className="h-5 w-px bg-paper/20" />
        <div className="flex items-center gap-1 [&_button]:text-paper/80 [&_button:hover]:bg-paper/10 [&_button:hover]:text-paper">
          {children}
        </div>
        <span aria-hidden className="h-5 w-px bg-paper/20" />
        <button
          type="button"
          onClick={onClear}
          className="focus-ring flex items-center gap-1.5 rounded-sm px-2 py-1 text-ui text-paper/80 hover:bg-paper/10 hover:text-paper"
        >
          <X className="size-3.5" aria-hidden />
          Clear
          <Kbd keys={["esc"]} className="border-paper/20 bg-transparent text-paper/75 shadow-none" />
        </button>
      </div>
    </div>
  );
}
