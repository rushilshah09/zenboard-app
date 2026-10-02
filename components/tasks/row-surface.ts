// THE hover/selected wash for a task row, in one place.
//
// ── THE BUG ────────────────────────────────────────────────────────────────
// The wash was painted on the same element that carried the row's divider, at
// the row's full rectangle, with no radius. So hovering a row inside a rounded
// container produced a hard-cornered slab sitting ON the list rather than a
// row lighting up — and its bottom edge landed exactly on the hairline, which
// is what made it read as an overlay someone had dropped on top.
//
// Every other hover surface in this app already had the answer: the DS
// `ListRow` rounds its wash (`rounded-sm`), the board's quick-add rounds its
// (`rounded-md`), every menu item rounds its, and the project task list rounds
// its. The two task rows were the only ones that never got it.
//
// ── THE FIX, AND WHY IT IS TWO ELEMENTS ────────────────────────────────────
// A rounded wash and a full-width divider cannot live on the same box: the
// wash's corners curve away exactly where the line runs straight, and you see
// both. So the divider stays on the OUTER element, spanning the list, and the
// wash is an inner box with a 2px vertical inset — enough that its rounded
// corners never touch the hairline, so it floats inside the row instead of
// filling it to the edges.
//
// The row's total height is unchanged: the padding lost to the inset is the
// padding the wash gives back.
//
// ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
// There are two task rows — `components/tasks/task-row.tsx` (Home, project
// tabs) and the roomier local one in `tasks-view.tsx` — and they had drifted
// into two spellings of the same broken thing. Fixing them separately would
// have fixed them differently. A row's surface is one idea; it gets one
// definition.
import { ROW_DIVIDER, ROW_TRANSITION, rowWash } from '@/components/ds/ui/row-state';
import { cn } from '@/lib/cn';

/** 8px. Kept for the surfaces that inset a row HORIZONTALLY — a rail item, a
 *  menu row — where a rounded corner has an edge to be inset from.
 *
 *  A full-bleed row is not one of them; see `rowSurface` below. */
export const ROW_RADIUS = 'rounded-md';

/**
 * How far the wash is inset from the card's side edges, in px.
 *
 * USER DIRECTION 2026-09-29, with a screenshot of a hover running into the card's left edge:
 * *"on hover i want space from 4 sides, right and left it touches, not looks good."* The row had a
 * vertical inset and no horizontal one, so a hovered row lit up as a band welded to both walls of
 * the card instead of a pill lying inside it.
 *
 * **The old objection was real and is answered rather than ignored.** Insetting used to mean
 * pushing every row's text out of line with the panel header above it — so the wash GIVES THE
 * PADDING BACK: the outer pads by this, the wash pads by `--panel-px` MINUS this, and the first
 * glyph still lands exactly `--panel-px` from the card edge. The same trick the vertical inset
 * already used ("the padding lost to the inset is the padding the wash gives back").
 *
 * That also restores the radius. It was dropped because a rounded rectangle touching both edges
 * has nothing to be inset FROM and shows four corner notches; now it has 6px on each side, which
 * is what a corner needs in order to read as a corner.
 */
export const ROW_INSET_PX = 6;

export type RowSurface = {
  /** The element that owns the divider, the ref and the group. */
  outer: string;
  /** The inner box that carries the padding and the wash. */
  wash: string;
};

/**
 * @param padding  the row's own padding classes, minus the 2px the wash's
 *                 vertical inset takes back — e.g. `py-3.5` for a row that
 *                 used to be `py-4`.
 *
 *                 VERTICAL is genuinely per-row: a Home TaskRow is compact
 *                 (36px), the Tasks page's row is 56px because it carries a
 *                 meta line. HORIZONTAL is not — a row inside a panel takes
 *                 `px-[var(--panel-px)]` so its leading edge lines up with the
 *                 panel header above it. The two rows here had it TRANSPOSED
 *                 (`px-3.5 py-2.5` against `px-2.5 py-3.5`), which is what a
 *                 free-string parameter on a shared recipe buys you.
 */
export function rowSurface({ selected = false, last = false, padding, heightClass }: {
  selected?: boolean;
  last?: boolean;
  padding: string;
  /**
   * The row's TOTAL height, as a LITERAL Tailwind class — `h-[var(--row-task)]`.
   * It must be a literal at the call site: Tailwind v4 scans source text, so a
   * class built from a template string is never generated and the rule silently
   * does not ship (the trap recorded for the z-index registry).
   *
   * ── WHY A ROW MAY NOT BE SIZED BY ITS TALLEST CONTROL ──────────────────
   * Measured 2026-09-10: the compact row's own comment claimed 36px and it
   * rendered at 48. Nothing about the row had changed — a 28px star
   * IconButton and a 24px share pill had joined the trailing cluster, and
   * `py-2.5` around a 28px child is 48. The row's height was therefore
   * decided by whichever control was added last, and on an internal task
   * that control is at `opacity: 0`: an invisible affordance was setting the
   * height of the densest list in the product.
   *
   * With `heightClass`, the row declares its own size and controls centre inside
   * it, so adding a chip can never move the list's rhythm again. Omit it and
   * the row keeps growing to fit — which is right for the two-line row in
   * tasks-view.tsx, whose meta line is real content, not furniture.
   */
  heightClass?: string;
}): RowSurface {
  return {
    // THE INSET LIVES ON THE OUTER, AS PADDING.
    //
    // It was `my-0.5` on the wash, and it did not work: a top margin on the
    // first child of a box with no padding or top border COLLAPSES through its
    // parent. Measured on a row: `gapTop: 0, gapBottom: 3` — declared 2/2,
    // rendered 0/3. So the fill sat flush against the hairline above it and
    // 3px short of the one below, which is the off-centre band the user saw.
    // Padding on the parent cannot collapse, so the two gaps are equal by
    // construction rather than by luck.
    // The height goes on the OUTER, so the declared number is what the list steps
    // by. Tailwind is border-box, so the divider is included rather than added.
    // The horizontal inset lives here with the vertical one, as padding, for the same reason:
    // padding on the parent cannot collapse, so all four gaps are equal by construction.
    outer: cn('group relative px-1.5 py-0.5', heightClass, !last && ROW_DIVIDER),
    wash: cn(
      // A PILL INSIDE THE CARD, not a band welded to its walls — see ROW_INSET_PX. The radius is
      // the shared one, and the horizontal padding is `--panel-px` LESS the inset, so a row's first
      // glyph still lines up with the panel header above it to the pixel.
      'flex', ROW_RADIUS, 'px-[calc(var(--panel-px)-6px)]', ROW_TRANSITION,
      // h-full fills whatever the outer declared; without a height the wash is
      // sized by its padding and content exactly as before.
      heightClass && 'h-full',
      padding,
      // The states come from the DS row vocabulary, which the table reads too — so a task row
      // and an invoice row cannot light up differently (they did: berry vs surface-selected).
      rowWash(selected),
    ),
  };
}
