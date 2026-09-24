'use client';
import * as React from 'react';

/**
 * Hand focus back to whatever had it when a layer opened.
 *
 * Radix does this for every overlay it owns, which is why the DS menus, dialogs
 * and popovers already behave. The layers this app hand-rolls did not: measured
 * on /dev-preview/shell, ⌘K opened the command palette from the Search button
 * and Escape left `document.activeElement` on `<body>` — so the next Tab started
 * again from the top of the page, and a reader using the keyboard lost their
 * place for having opened a palette they then closed.
 *
 * Works for both shapes a layer takes here: a component that stays mounted and
 * flips `open`, and one that is mounted only while open (pass nothing). The
 * restore lives in the effect CLEANUP, which React runs after the DOM is gone,
 * so `document.activeElement` is honestly `<body>` by the time it looks.
 *
 * It restores ONLY when the close left focus nowhere. If the action moved focus
 * somewhere deliberate — the field it just created, the layer underneath — that
 * claim wins.
 *
 * Safe beside the DS tooltip: a restore leaves `relatedTarget` null, and
 * `focusOpensTooltip` (components/ds/ui/tooltip.tsx) treats null as "handed
 * back" rather than "arrived", so the trigger does not sprout a tooltip that
 * would eat the next Escape.
 */
/**
 * Did the close leave focus NOWHERE? Only then is it ours to hand back: if the
 * action moved focus somewhere deliberate — the field it just created, the
 * layer underneath — that claim wins. Pure, and by tag name rather than by
 * identity, so the rule can be read without a document.
 */
export function focusFellNowhere(now: { tagName: string } | null): boolean {
  return !now || now.tagName === 'BODY' || now.tagName === 'HTML';
}

/**
 * `restore` carries WHY the layer closed, and the distinction is not ours — it
 * was already solved privately in `components/task-detail/chip-ui.tsx`, which
 * keeps `{ open, restore }` in one piece of state: choosing something or
 * pressing Escape means focus belongs back on the trigger, while clicking
 * elsewhere means whatever was clicked should keep it. Pass `false` at the
 * moment of a click-away close to say so; the default restores. (chip-ui still
 * runs its own copy: it has no tests, and it is correct, so it keeps it until
 * someone is in there anyway — the shared rule can express what it knows now.)
 */
export function useFocusReturn(open: boolean = true, restore: boolean = true): void {
  const opener = React.useRef<HTMLElement | null>(null);
  // Read at CLOSE time, not at open time, so the reason can change while open.
  const wants = React.useRef(restore);
  wants.current = restore;
  React.useEffect(() => {
    if (!open) return;
    const el = document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
    return () => {
      const back = opener.current;
      opener.current = null;
      if (!back || !back.isConnected || !wants.current) return;
      if (!focusFellNowhere(document.activeElement)) return;
      back.focus({ preventScroll: true });
    };
  }, [open]);
}
