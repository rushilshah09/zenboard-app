import { cn } from "@/lib/cn";

// ── ONE ROW VOCABULARY ─────────────────────────────────────────────────────
//
// Every list in the product answers the same four questions — how a row shows
// it is hovered, how it shows it is selected, what separates it from the next
// one, and how fast it changes — and they must get the same answers
// everywhere. That is most of what makes Linear feel like one product: an
// issue row, a project row and a view row respond identically to the pointer.
//
// Before this file the answers lived in two places and had already drifted.
// `rowSurface()` (the task row) washed selection with `bg-surface-selected` and
// changed over `--duration-fast`; the DS `DataTable` washed it with
// `bg-berry-100` and changed over `--duration-instant`. So an invoice row and a
// task row lit up in different colours at different speeds, and nothing in
// either file could have told you — each was internally consistent.
//
// What is shared here is the STATES, not the structure. A task row is a flex
// row whose wash is an inner box inset from its divider; a table row is a
// `<tr>`, and a `<tr>` cannot wrap its cells in an inner box. The two
// structures differ by necessity. The vocabulary they speak does not.

/** The divider between rows. Never on the last one — the container edges it. */
export const ROW_DIVIDER = "border-b border-line-soft";

/** How fast a row's state changes: a wash is colour, so it rides the colour ladder. */
export const ROW_TRANSITION = "transition-colors duration-fast";

/**
 * The wash: selected is a held state, hover is a passing one. Never both.
 *
 * A row that does nothing when clicked gets NO hover wash. Lighting up under the pointer is a
 * promise that the row is a target; a read-only row (an invoice's line items) that washes on hover
 * and then ignores the click is a false affordance, and those are what make an interface feel
 * unconsidered even when nobody can say why.
 */
export function rowWash(selected: boolean, interactive = true): string {
  if (selected) return "bg-surface-selected";
  return interactive ? "hover:bg-surface-hover" : "";
}

/** Everything a row's own element needs to respond like every other row. */
export function rowState({ selected = false, last = false, interactive = true }: { selected?: boolean; last?: boolean; interactive?: boolean }): string {
  return cn(ROW_TRANSITION, rowWash(selected, interactive), !last && ROW_DIVIDER);
}
