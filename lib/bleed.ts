'use client';
// A wide layout inside a document's text column — an inline database's table or
// board — runs out to the page's edges while its first column stays on the text
// (Notion; the database brief §3: "use the available page width intelligently …
// it should feel like a native block inside the page"). Before, a board clipped
// at the column: its Done column cut off, with a scrollbar inside the column.
//
// The page opts in by marking its scrolling content with `data-bleed-root`; a
// layout opts in with the `bleed-x` utility (app/ds-theme.css) and `ref={bleed}`.
// Anywhere else — a record in a side peek, the client portal — there is no root,
// the distances are zero, and the layout stays in its column.

export type BleedRoot = { left: number; clientLeft: number; clientWidth: number };
export type BleedBox = { left: number; right: number };

/**
 * How far a layout may reach past its column on each side: from where it would
 * sit without the bleed (its parent's box) to the page's content box — which
 * stops at the page's scrollbar, not under it. Rounded down, so it never runs past
 * an edge and a resize never nudges it by a fraction of a pixel.
 */
export function bleedInsets(root: BleedRoot, box: BleedBox): { start: number; end: number } {
  const left = root.left + root.clientLeft;
  const right = left + root.clientWidth;
  return {
    start: Math.max(0, Math.floor(box.left - left)),
    end: Math.max(0, Math.floor(right - box.right)),
  };
}

/**
 * The callback ref that makes a layout bleed: writes `--bleed-start` /
 * `--bleed-end` on the element and keeps them true as the page resizes (a rail
 * collapsing, a side peek opening, the window). A callback ref rather than a hook
 * because the layouts that bleed mount and unmount with the view — a table swapped
 * for a board is a new element — and React 19 runs the returned cleanup when one
 * goes. Module-level, so its identity never changes and React never re-attaches it.
 */
export function bleed(el: HTMLElement | null): void | (() => void) {
  const parent = el?.parentElement;
  const root = el?.closest<HTMLElement>('[data-bleed-root]');
  if (!el || !parent || !root) return;
  const apply = () => {
    const r = root.getBoundingClientRect();
    const { start, end } = bleedInsets(
      { left: r.left, clientLeft: root.clientLeft, clientWidth: root.clientWidth },
      parent.getBoundingClientRect(),
    );
    el.style.setProperty('--bleed-start', `${start}px`);
    el.style.setProperty('--bleed-end', `${end}px`);
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(root);
  ro.observe(parent);
  return () => ro.disconnect();
}
