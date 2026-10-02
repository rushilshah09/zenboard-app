import * as React from "react";

import { cn } from "@/lib/cn";

// ── THE ANCHORED ROW ────────────────────────────────────────────────────────
//
// A glyph well, a two-line label, and a control on the trailing edge. It is the row Granola's
// preferences and Linear's settings are both built out of, and the user sent nine screenshots of
// it (2026-09-29) asking for "the richness of Granola, the product UX of Linear".
//
// **The richness is not decoration — it is the well and the second line.** A row that is one line
// of text has nothing to anchor the eye and nothing to say beyond its name, so a column of them
// reads as a wireframe however carefully it is spaced. Give the same row a glyph to start at and a
// sentence under the title and it has weight at 64px that a centred 180px billboard never had.
//
// It lived inside `SettingsRow` and was named for its first consumer. Home's empty sections needed
// exactly the same row, and a second copy of a shape this specific is how two surfaces end up
// disagreeing about what a row is — so the anatomy moved here and `SettingsRow` binds to it.
//
// THE WELL IS A WASH, NOT A TONE. It was `bg-paper-3`, which resolves to `--popover` — pure white
// in light. On a white card that is a well you cannot see, and on a settings pane it only worked
// because the pane behind it was not white. A wash (ink at 6%) is a step down from whatever it is
// on, which is the whole reason `surface-fill` exists ([[zenboard-wash-not-tone]]).

export interface AnchorRowProps {
  /** The 16px glyph that anchors the row. Sits in a 32px well. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** The line under the title. What this thing IS, or what will appear here. */
  description?: React.ReactNode;
  /** The trailing edge: a control, a value, an action. */
  trailing?: React.ReactNode;
  /** stack = the trailing content drops to its own line, for full-width controls. */
  layout?: "inline" | "stack";
  className?: string;
}

export function AnchorRow({ icon, title, description, trailing, layout = "inline", className }: AnchorRowProps) {
  return (
    <div
      className={cn(
        "flex gap-x-6 gap-y-3",
        layout === "inline" ? "flex-wrap items-center justify-between" : "flex-col",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-52 items-start gap-3">
        {icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-fill text-ink-600 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="text-ui text-ink-800">{title}</div>
          {description && <div className="text-meta text-ink-500">{description}</div>}
        </div>
      </div>
      {trailing && (
        <div className={cn("flex shrink-0 items-center gap-2", layout === "stack" && "self-start")}>{trailing}</div>
      )}
    </div>
  );
}
