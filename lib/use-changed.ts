'use client';
// "Has this value just changed?", answered during render.
import { useState } from 'react';

/**
 * True on exactly the render in which `value` differs from the previous one,
 * false on every other render. Evaluated during render, not after it.
 *
 * For resetting state when something opens, closes or switches:
 *
 *     if (useChanged(open) && open) { setQuery(''); setActive(0); }
 *
 * WHY NOT AN EFFECT, which is how all seven call sites were written. An effect
 * runs *after* paint, so reopening a dialog rendered the previous contents,
 * committed them to the DOM, and only then cleared them — a visible frame of
 * the last search you typed every time you pressed ⌘K. Comparing during render
 * restarts the render before anything is committed, so the stale frame never
 * exists. React documents this under "You Might Not Need an Effect".
 *
 * The hook itself is called unconditionally, as the rules require; only the
 * work after `&&` is conditional. Setting state during render is legal here
 * because it is this component's own state — React re-runs the render rather
 * than scheduling a second one.
 *
 * Comparison is `Object.is`, so pass something stable. An object literal
 * rebuilt every render "changes" every render, which would loop.
 */
export function useChanged<T>(value: T): boolean {
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    return true;
  }
  return false;
}
