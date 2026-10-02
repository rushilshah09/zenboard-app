import { useSyncExternalStore } from 'react';
// THE one place that decides how wide a week board's columns are.
//
// ── THE DEFECT THIS REPLACES ────────────────────────────────────────────────
// The board used fixed columns — `COL_INBOX 320 + COL_DAY 268 × 7` — and set
// that sum as the scroller's `minWidth`. So the board always demanded
//
//     320 + 268 × 7 = 2196px
//
// of horizontal space, at every viewport, and the columns had `flexShrink: 0`
// so they never gave any of it back. With the 232px tasks rail beside it that
// needs roughly a 2500px window. On a 1280px laptop you saw THREE of seven
// days and scrolled for the rest.
//
// A board whose entire premise is "see your week" that cannot show a week is
// failing at its one job, so the columns now flex and this file owns the floor.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// Unscheduled is a fixed staging column — it holds long, unplanned titles and
// should not shrink as the week fills up. The seven days SHARE what is left,
// equally, down to `DAY_MIN`. Below that the board scrolls, because a column
// too narrow to read is worse than one you have to scroll to.
//
// The layout itself is done in CSS (`flex: 1 1 0` + `min-width`), not by
// measuring in JS: the browser already solves this exactly, and a
// ResizeObserver recomputing widths on every frame would be a worse answer to
// a problem flexbox was designed for. The numbers live here so the rule is
// stated once, and so the fit can be reasoned about and tested.

/**
 * Fixed width of the Unscheduled staging column when open.
 *
 * 288, not 300. At 300 the week came to 1280 in a pane the browser reported as
 * 1276 — a four-pixel overflow that put a scrollbar back on a board that had
 * just been made to fit, which is the whole sprint undone by a rounding
 * assumption. Measured, not derived: the pane is the window minus the rail,
 * the shell's padding and a hairline, and none of those are worth predicting
 * when the fix is to leave headroom.
 */
export const COL_INBOX = 288;
/** …and when collapsed to a spine. Wide enough for a 24px chevron + padding. */
export const COL_INBOX_COLLAPSED = 44;
/**
 * The narrowest a day column may become.
 *
 * 140px is the width at which a card still reads: a two-line title, and a meta
 * row that has dropped to glyphs (see the container query in ds-theme.css).
 * It is also the number that makes the week FIT on the two machines this is
 * used on — a 1512px laptop with Unscheduled open, and a 1280px one with it
 * collapsed. Chosen against those, not picked for roundness.
 */
export const COL_DAY_MIN = 140;
/** The width a day column prefers when there is room to spare. */
export const COL_DAY_MAX = 320;

/** Space available to the seven days, given the pane and the staging column. */
export function daysWidth(paneWidth: number, collapsed: boolean): number {
  return Math.max(0, paneWidth - (collapsed ? COL_INBOX_COLLAPSED : COL_INBOX));
}

/**
 * Does the whole week fit without scrolling?
 *
 * Used to decide whether collapsing Unscheduled is worth OFFERING — the point
 * of the control is to buy the week enough room, so it is only worth pointing
 * at while it would actually change the answer.
 */
export function weekFits(paneWidth: number, dayCount: number, collapsed: boolean): boolean {
  if (dayCount <= 0) return true;
  return daysWidth(paneWidth, collapsed) >= COL_DAY_MIN * dayCount;
}

/**
 * Would collapsing the staging column make the week fit?
 *
 * `false` when it already fits (nothing to gain) AND when it still would not
 * (an offer that does not deliver is worse than no offer).
 */
export function collapseWouldHelp(paneWidth: number, dayCount: number): boolean {
  return !weekFits(paneWidth, dayCount, false) && weekFits(paneWidth, dayCount, true);
}

/** The minimum width the scroller must reserve — the floor, never the ideal. */
export function boardMinWidth(dayCount: number, collapsed: boolean): number {
  return (collapsed ? COL_INBOX_COLLAPSED : COL_INBOX) + COL_DAY_MIN * dayCount;
}

// ── Remembering the choice ──────────────────────────────────────────────────
// Per browser, not per account: it is a response to the size of the window you
// are looking at, and syncing it would push a laptop's answer onto a desktop.
//
// Read through `useSyncExternalStore` rather than an effect. `localStorage` IS
// an external store, which is exactly what that hook is for: it gives the
// server a defined snapshot (open) instead of hydrating a collapsed board into
// markup rendered open, and it does it without a setState-in-an-effect — the
// pattern the React Compiler rules reject, and rightly, since it renders twice
// on every mount.
const KEY = 'zb:week:unscheduled-collapsed';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires only in OTHER tabs, which is precisely the case a local
  // emitter cannot cover — two windows open on the same week stay in step.
  if (typeof window !== 'undefined') window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onChange);
  };
}

export function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** The server's snapshot: always open. A board that renders collapsed on the
 *  server and open on the client is a hydration mismatch. */
const serverSnapshot = () => false;

export function writeCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
  for (const fn of listeners) fn();
}

/** The staging column's collapsed state, and the one way to change it. */
export function useInboxCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, serverSnapshot);
  return [collapsed, writeCollapsed];
}
