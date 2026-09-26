// ── THE WEBSITE'S LOADER: WHEN IT PLAYS ────────────────────────────────────
//
// The user, 2026-09-26: "when the website first loads, show the loader, and show it once every 4
// hours, only when the website is opened". So it plays on a real page load (typing the address,
// a link from elsewhere, a refresh) and only if it has not played in the last four hours on this
// device. Moving around inside the site never plays it: a client-side navigation does not run the
// decision script, and the page it lands on finds the attribute already gone.
//
// The decision is made BEFORE first paint, by a tiny script at the top of the page (the same way
// the app's boot splash and theme are decided), because deciding in an effect would paint the page
// first and then cover it. If storage is unavailable (a private window, a blocked site) it does not
// play at all: failing closed means a visitor is never shown a loader that cannot remember it ran.

export const SITE_LOADER_KEY = 'zb-site-loader';
export const SITE_LOADER_ATTR = 'data-site-loader';
/** Four hours, in milliseconds: the least time between two plays on one device. */
export const SITE_LOADER_EVERY = 4 * 60 * 60 * 1000;

/** Whether an open at `now` plays the loader, given when it last played (`null` for never). */
export function shouldShowLoader(now: number, last: number | null): boolean {
  if (last == null || !Number.isFinite(last)) return true;
  // A clock that went backwards (a device reset) counts as a long time ago, not as "just played".
  if (last > now) return true;
  return now - last >= SITE_LOADER_EVERY;
}

/** The decision, as the inline script the site's pages render first. Kept in step with
    `shouldShowLoader` by `site-loader.test.ts`, which runs it. */
export const siteLoaderScript = `(function(){try{var k=${JSON.stringify(SITE_LOADER_KEY)},n=Date.now(),v=localStorage.getItem(k),l=v==null?NaN:Number(v);if(!(l<=n)||n-l>=${SITE_LOADER_EVERY}){localStorage.setItem(k,String(n));document.documentElement.setAttribute(${JSON.stringify(SITE_LOADER_ATTR)},'')}}catch(e){}})();`;
