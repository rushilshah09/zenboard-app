'use client';
// A ref that always holds the newest value — the "latest ref" pattern, written
// out by hand in seven places before it lived here.
import { useEffect, useRef, type RefObject } from 'react';

/**
 * A ref tracking the current `value`, for code that outlives the render it was
 * created in: a `window` listener attached once, an interval, a callback handed
 * to a third-party script.
 *
 * Those all capture their closure at attach time, so without this they read
 * whatever the state was on the render that attached them. The usual fix is to
 * re-attach on every change, which is worse — a keydown listener that detaches
 * and re-attaches on each keystroke, an IntersectionObserver that rebuilds.
 *
 * WHY AN EFFECT, when every call site wrote `ref.current = value` inline. A
 * render can be thrown away — React may start one, abandon it, and keep the
 * previous UI — and a render-phase write has already mutated the ref by then,
 * so it can end up holding a value from a render that never committed. An
 * effect runs only for the render that did. That is what
 * `react-hooks/refs` objects to, and it is why the inline form is a defect
 * rather than a shortcut.
 *
 * THE LIMIT: the ref updates *after* paint, so it is one render behind during
 * render and during the same tick. Never read it while rendering — that is both
 * the rule and the reason it is safe. Read it from handlers, timers and
 * callbacks, which all run after the commit.
 *
 * NOT for a ref something also writes imperatively. `week-view`'s `orderRef` is
 * assigned by its own reorder function so the next read in the same tick sees
 * the new order; layering an effect on top would overwrite that with the
 * previous value on the very next commit.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}
