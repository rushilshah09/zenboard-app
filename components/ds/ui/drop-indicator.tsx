import * as React from "react";
import { cn } from "@/lib/cn";
import { OVERLAY_CLASS } from "./menu";

// Drag and drop — the two marks every drag in Zenboard draws, whatever it carries:
// a block in a document, a row or a column of a table.
//
//   · DropLine — where the thing will land: a 2px line with a dot where it starts
//     (Notion's). Rows and columns never shift under the pointer; the line moves
//     instead, so what you are aiming at stays where you saw it.
//   · DragGhost — what is under the pointer: a small lifted chip naming it, with a
//     count when several move together. Solid, never faded: its words are text.
//
// No drag library here (the drag seam, app/design-system.test.ts): the layer that
// runs the drag positions these from its own measurements.

export interface DropLineProps {
  /** Between rows or blocks (horizontal), or between columns (vertical). */
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Position within the nearest positioned ancestor: top/left and a length. */
  style?: React.CSSProperties;
}

export function DropLine({ orientation = "horizontal", className, style }: DropLineProps) {
  const vertical = orientation === "vertical";
  return (
    <div
      aria-hidden
      data-drop-line={orientation}
      className={cn("pointer-events-none absolute z-10 rounded-[1px] bg-drop-line", vertical ? "w-0.5" : "h-0.5", className)}
      style={style}
    >
      <span className={cn("absolute size-1.5 rounded-full bg-drop-line", vertical ? "-left-0.5 -top-[3px]" : "-left-[3px] -top-0.5")} />
    </div>
  );
}

export interface DragGhostProps {
  /** A leading glyph — the grip for a block or row, a property's type for a column. */
  icon?: React.ReactNode;
  label: string;
  /** More than one thing moving: "3 blocks". */
  count?: { n: number; noun: string };
  className?: string;
}

export function DragGhost({ icon, label, count, className }: DragGhostProps) {
  return (
    <div
      className={cn(
        // `w-max`: a drag overlay is the size of what was grabbed — a 20px handle —
        // and the ghost must be the size of its words instead.
        "flex w-max max-h-[120px] max-w-[360px] cursor-grabbing items-center gap-2 overflow-hidden whitespace-nowrap px-2.5 py-1 text-body",
        // Lifted like a menu: the one overlay chrome, with a tighter corner for a chip.
        OVERLAY_CLASS, "rounded-md text-ink-800",
        className,
      )}
    >
      {icon && <span className="flex shrink-0 items-center text-ink-600">{icon}</span>}
      <span className="truncate">{label}</span>
      {count && count.n > 1 && (
        <span className="num shrink-0 rounded-full bg-ink-900 px-1.5 py-px text-caption font-semibold text-onsolid">
          {count.n} {count.noun}
        </span>
      )}
    </div>
  );
}
