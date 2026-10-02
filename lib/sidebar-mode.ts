// How the sidebar starts, in a place the SERVER can read.
//
// THE BUG THIS EXISTS FOR. The saved mode lived only in `localStorage`, which a
// server render cannot see — so every page load rendered the expanded sidebar,
// painted it, and then an effect corrected it. For anyone whose saved mode is
// `collapsed` or `hover` that is not a style flicker: `hover` renders a
// structurally different tree (a positioned panel over a reserved rail) and
// `collapsed` changes the sidebar's width, so the whole page reflowed one frame
// after paint, on every navigation.
//
// A cookie is the app's existing answer to "server and client must resolve the
// same value" — `SPACE_COOKIE` in lib/active-space.ts exists for exactly that
// reason. Mirroring the mode into one lets the layout render the right sidebar
// the first time, and there is nothing to correct.
//
// `localStorage` is still written alongside it, because it is the older key and
// a cookie can be cleared independently; whichever the client sees first agrees.

export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

/** The saved startup mode. Readable by the server. */
export const SIDEBAR_COOKIE = 'zb-sidebar';
/** Same value, older home — kept so an existing install is not reset. */
export const SIDEBAR_KEY = 'zb:sidebar';
/** The mode switched temporarily in THIS tab. Deliberately not a cookie: it is
 *  per-tab by definition, and a cookie is shared across them. */
export const SIDEBAR_SESSION_KEY = 'zb:sidebar:session';

export const DEFAULT_SIDEBAR_MODE: SidebarMode = 'expanded';

export function isSidebarMode(v: string | null | undefined): v is SidebarMode {
  return v === 'expanded' || v === 'collapsed' || v === 'hover';
}

/** Parse a stored value, falling back to the default. */
export function toSidebarMode(v: string | null | undefined): SidebarMode {
  return isSidebarMode(v) ? v : DEFAULT_SIDEBAR_MODE;
}

/**
 * Persist the mode where both sides can see it.
 *
 * A year, because this is a preference and not a session: an expiring cookie
 * would silently put the sidebar back to expanded. `SameSite=Lax` is enough —
 * nothing here is a credential, and the value never leaves the app.
 */
export function writeSidebarCookie(mode: SidebarMode): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SIDEBAR_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}
