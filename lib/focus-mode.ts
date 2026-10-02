// Is the app in Focus mode, and where does the toggle go?
//
// ONE PREDICATE, because two things read it and they must never disagree: the
// shell decides whether to draw a sidebar at all, and the toggle decides which
// way it is pointing. A shell that thinks it is focusing while the switch reads
// "off" is a screen with no navigation and no visible way back.
//
// It is a path test rather than state so the mode survives a refresh, works as
// a deep link, and needs nothing kept in sync — the URL is the whole store.

/** The route Focus mode lives at. */
export const FOCUS_PATH = '/focus';

/** Where the toggle returns you. Today, not Home: you were working on today. */
export const FOCUS_EXIT_PATH = '/today';

/**
 * Focus mode is `/focus` and anything beneath it.
 *
 * Anchored and segment-aware on purpose. A bare `startsWith('/focus')` also
 * matches `/focus-settings` or `/focused-work` — routes nobody has written yet,
 * which is exactly when this kind of bug lands: someone adds one, and the whole
 * chrome disappears on a page that never asked for it.
 */
export function isFocusMode(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === FOCUS_PATH || pathname.startsWith(`${FOCUS_PATH}/`);
}
