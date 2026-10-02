'use client';
// One viewport hook for the whole app. Three views had already hand-rolled this
// exact matchMedia effect at three different breakpoints; a fourth copy in the
// form builder is how a codebase drifts, so it lives here now.
import { useCallback, useSyncExternalStore } from 'react';

/** The server has no viewport, so the wide layout is the safe default. */
const SERVER_SNAPSHOT = () => false;

/**
 * True when the viewport is at or below `maxWidth` px.
 *
 * `false` on the server and during hydration, on purpose: the first client
 * render must match the server's markup. After that the answer is the real one.
 *
 * ── WHY useSyncExternalStore, NOT AN EFFECT ─────────────────────────────────
 * This was `useState(false)` + a `useEffect` that corrected it after mount,
 * which is right for hydration but wrong for every CLIENT navigation: a view
 * mounting on a phone still rendered wide first, painted, and only then
 * switched — a one-frame flash of the wrong layout on every navigation. That is
 * cosmetic when the answer only resizes something, and a real flash when it
 * picks WHICH thing renders (the calendar's Day grid instead of Week). With a
 * store, a client-side mount reads the live media query on its first render;
 * hydration still starts from the server snapshot and corrects once, as before.
 */
export function useNarrow(maxWidth: number): boolean {
  return useMediaQuery(`(max-width: ${maxWidth}px)`);
}

/**
 * True when the primary pointer is a finger. Width cannot tell you this: a tablet
 * is wide AND has no hover, so anything that opens on hover needs a tap path
 * there too. `false` on the server, like `useNarrow`.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    // A `change` event alone can miss emulated/odd resizes (device toolbars,
    // split view) — the documents rail learned this the hard way.
    window.addEventListener('resize', onChange);
    return () => { mq.removeEventListener('change', onChange); window.removeEventListener('resize', onChange); };
  }, [query]);
  // A boolean, so React's Object.is comparison is stable between reads.
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, SERVER_SNAPSHOT);
}
