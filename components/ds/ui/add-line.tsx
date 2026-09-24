import * as React from "react";
import { cva } from "class-variance-authority";
import { Loader2, Plus } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

// The quiet "+ Add …" line at the foot of a list — Notion's "+ New" row, Linear's "Add sub-issues". A glyph and a
// word in the placeholder's ink, on a list row's geometry: 36px tall (44 under a finger), the `sm` glyph a list row
// carries, the 8px gap a row puts between its box and its name — so the word starts where the names above it start.
//
// Under the pointer it takes the row wash, and its ink steps up to 700: a wash is a new ground, and ink-500 fails on
// it (app/theme-bridge.test.ts).
//
// Two shapes, one geometry: a BUTTON that does the adding (Add file), and a FIELD row whose input is the adding
// (Add a subtask…). They stack in the task panel, where two hand-spelled versions sat 4px apart, a weight step apart
// and a type size apart (2026-09-21) — one class keeps their glyphs on one vertical and their words on another.
export const addLine = cva(
  "touch-row flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-ui text-ink-500",
  {
    variants: {
      as: {
        button:
          "focus-ring cursor-pointer border-0 bg-transparent hover:bg-surface-hover hover:text-ink-700 " +
          "data-[loading]:cursor-progress",
        // The caret is the focus; the glyph steps up with it, as the button's does under the pointer.
        field: "cursor-text focus-within:text-ink-700",
      },
      // What the line sits under. `none`: a list of names — the glyph is the leading icon. `checkbox`: a list of
      // TASK ROWS (components/tasks/task-row.tsx) — the + takes the checkbox's 16px slot, on the checkboxes' own
      // vertical, and the word starts where the titles start (the row's inset and its 12px gap).
      lead: {
        none: "",
        checkbox: "gap-3 rounded-none px-[var(--panel-px)]",
      },
    },
    defaultVariants: { as: "button", lead: "none" },
  },
);

export interface AddLineProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Busy: the glyph becomes the Button's spinner, and the line stops taking presses (the global press skips it). */
  loading?: boolean;
  /** `checkbox` above or below a list of task rows, so the + and the word line up with the checkboxes and titles. */
  lead?: "none" | "checkbox";
}

/** The button shape of `addLine`: `<AddLine onClick={…}>Add file</AddLine>`. The field shape is the class on a row. */
export const AddLine = React.forwardRef<HTMLButtonElement, AddLineProps>(function AddLine(
  { loading, lead = "none", className, children, onClick, type = "button", ...props },
  ref,
) {
  // In the checkbox's 16px slot a 14px glyph needs a pixel either side to sit on the checkboxes' centre line.
  const slot = lead === "checkbox" ? "mx-px" : undefined;
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cn(addLine({ as: "button", lead }), className)}
      {...props}
    >
      {loading ? (
        <Loader2 aria-hidden className={cn("size-3.5 shrink-0 animate-spin motion-reduce:animate-[spin_1.4s_linear_infinite]", slot)} />
      ) : (
        <Icon icon={Plus} size={14} className={cn("shrink-0", slot)} />
      )}
      {children}
    </button>
  );
});
