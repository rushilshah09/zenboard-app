'use client';
// THE list keyboard grammar — the guard and the roving cursor, in one place.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// The grammar (§6.3) was built for the Tasks list and its recipe was written
// down with the note "extend to Today + project lists next". Extending it by
// COPYING would have put the same ~30 lines of guard logic in three views —
// which is the duplication CONSISTENCY_PRINCIPLE.md exists to prevent, and the
// guard is the half most likely to drift: every clause below is a bug somebody
// already hit, and a copy that misses one re-opens it silently.
//
// So the two halves that must be IDENTICAL everywhere live here, and the third
// — which keys do what to a row — stays with each view, because that genuinely
// differs. Tasks can reschedule; Today cannot move a task off today; a project
// list has no "move to list". Same principles, not the same screens.
//
// ── WHAT A VIEW STILL OWNS ──────────────────────────────────────────────────
//   const cursor = useListCursor(visible.length);
//   useListKeys((e) => {
//     if (cursor.arrows(e)) return;          // ↑ ↓ j k Esc, handled here
//     const t = visible[cursor.index];       // the view's own actions
//     if (!t) return;
//     if (e.key === 'Enter') open(t.id);
//   }, { suspended: composing || triaging });
import { useCallback, useEffect, useRef, useState } from 'react';
import { goChordActive } from '@/components/shell/keyboard-shortcuts';
import { useLatest } from '@/lib/use-latest';

/**
 * Is the user typing into something?
 *
 * Was defined privately in `keyboard-shortcuts.tsx` AND inlined again in the
 * tasks list. One definition now; that file imports this one.
 */
export function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  // `=== true`, not truthiness: the signature promises a boolean, and
  // `isContentEditable` is only guaranteed present on a real HTMLElement.
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable === true;
}

/** Everything that can make a keystroke NOT the list's to handle. */
export type ListKeyContext = {
  /** The event's target — a typing target means hands off. */
  target: EventTarget | null;
  metaKey: boolean; ctrlKey: boolean; altKey: boolean;
  /** The `g` navigation chord is mid-flight (`g t`, `g p`…). */
  goChord: boolean;
  /** A Radix menu/popover is open and owns the keyboard. */
  popperOpen: boolean;
  /** A record is open over the list (`?task=`), and owns the keyboard. */
  recordOpen: boolean;
  /** The view's own reasons — a composer has focus, triage is running. */
  suspended: boolean;
};

/**
 * May the list act on this key?
 *
 * Pure, and takes a described context rather than a DOM event, so every clause
 * is testable — these are the exact conditions that made the grammar "fight
 * everything" before they were each added, and a regression in any one of them
 * is invisible until somebody's typing starts completing tasks.
 */
export function listKeysActive(c: ListKeyContext): boolean {
  // A modified key belongs to the browser, the OS, or the app-wide shortcuts.
  if (c.metaKey || c.ctrlKey || c.altKey) return false;
  // `g t` must navigate to Today, not also fire the row-level `t`.
  if (c.goChord) return false;
  if (isTypingTarget(c.target)) return false;
  if (c.popperOpen) return false;
  if (c.recordOpen) return false;
  if (c.suspended) return false;
  return true;
}

/** Read the live context out of the document. Separated so the rule above can
 *  be tested without a DOM. */
function readContext(e: KeyboardEvent, suspended: boolean): ListKeyContext {
  return {
    target: e.target,
    metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
    goChord: goChordActive(),
    popperOpen: !!document.querySelector('[data-radix-popper-content-wrapper]'),
    recordOpen: new URLSearchParams(window.location.search).has('task'),
    suspended,
  };
}

/**
 * Bind a list's keyboard handler.
 *
 * Window-level via a ref, not an element's `onKeyDown`: the cursor is visual
 * state rather than DOM focus, so there is no focused element to hang a handler
 * on, and a window listener keeps working after a mouse click lands anywhere.
 * The ref keeps it reading fresh state without rebinding on every render.
 */
export function useListKeys(handler: (e: KeyboardEvent) => void, opts?: { suspended?: boolean }): void {
  const suspended = opts?.suspended ?? false;
  const ref = useLatest((e: KeyboardEvent) => {
    if (!listKeysActive(readContext(e, suspended))) return;
    handler(e);
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [ref]);
}

/**
 * Where the cursor lands next. `-1` means "no row focused".
 *
 * From nowhere, BOTH directions land on the first row — pressing ↑ with no
 * cursor to jump to the bottom of a list you have not entered is a surprise,
 * and this matches what the Tasks list already did.
 */
export function nextIndex(current: number, length: number, delta: 1 | -1): number {
  if (length <= 0) return -1;
  if (current < 0) return 0;
  return Math.min(length - 1, Math.max(0, current + delta));
}

export type ListCursor = {
  /** The focused row, or -1 for none. VISUAL state — never DOM focus. */
  index: number;
  set: (i: number) => void;
  /** Move to `i` and scroll it just into view. */
  focus: (i: number) => void;
  /** Register a row element so `focus` can scroll to it. */
  ref: (i: number) => (el: HTMLElement | null) => void;
  /** The registered element, for a view that must ANCHOR to a row — a popover
   *  pinned to its rect. Without this every view keeps a second ref map beside
   *  the cursor's, and the two go out of step the moment a list re-orders. */
  el: (i: number) => HTMLElement | null;
  /** Handle ↑ ↓ j k Esc. Returns true when it consumed the key. */
  arrows: (e: KeyboardEvent) => boolean;
};

export function useListCursor(length: number): ListCursor {
  const [index, setIndex] = useState(-1);
  const rows = useRef<(HTMLElement | null)[]>([]);

  // Clamp DURING render, not in an effect: a list that shrinks under the cursor
  // must never paint one frame pointing at a row that is gone. -1 is preserved.
  if (index >= 0 && index > length - 1) setIndex(Math.max(-1, length - 1));

  const focus = useCallback((i: number) => {
    setIndex(i);
    // After the commit, not during: the wash that marks the focused row is
    // painted by this same state change, and scrolling first can land the row
    // under a sticky header that has not resized yet.
    requestAnimationFrame(() => rows.current[i]?.scrollIntoView({ block: 'nearest' }));
  }, []);

  const ref = useCallback((i: number) => (el: HTMLElement | null) => { rows.current[i] = el; }, []);
  const el = useCallback((i: number) => rows.current[i] ?? null, []);

  const arrows = useCallback((e: KeyboardEvent): boolean => {
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowDown' || k === 'j') { e.preventDefault(); focus(nextIndex(index, length, 1)); return true; }
    if (e.key === 'ArrowUp' || k === 'k') { e.preventDefault(); focus(nextIndex(index, length, -1)); return true; }
    if (e.key === 'Escape' && index >= 0) { e.preventDefault(); setIndex(-1); return true; }
    return false;
  }, [index, length, focus]);

  return { index, set: setIndex, focus, ref, el, arrows };
}
