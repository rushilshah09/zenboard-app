// ── THE WEBSITE'S LOADER: WHEN IT PLAYS ────────────────────────────────────
//
// The user, 2026-09-26, first: "when the website first loads, show the loader, and show it once every
// 4 hours"; then, the same day: "now I want the loader on every reload, and when we go live on
// production, every 5th time". So it COUNTS opens on this device. In production it plays on the first
// open and then on every fifth after it (the 1st, 6th, 11th …): a first visit always meets it, and a
// regular visitor is not made to sit through it every time. While the site is being worked on (a
// development build) it plays on every open, so it can be seen.
//
// An open is a real page load: typing the address, a link from elsewhere, a refresh. Moving around
// inside the site never counts and never plays: a client-side navigation does not run the decision
// script, and the page it lands on finds the attribute already gone.
//
// The decision is made BEFORE first paint, by a tiny script at the top of the page (the same way the
// app's boot splash and theme are decided), because deciding in an effect would paint the page first
// and then cover it. If storage is unavailable (a private window, a blocked site) it cannot count, so
// in production it does not play at all: failing closed means a visitor is never shown a loader that
// cannot remember it ran. In development there is nothing to remember, and it plays.

export const SITE_LOADER_KEY = 'zb-site-loader';
export const SITE_LOADER_ATTR = 'data-site-loader';
/** Every how many opens it plays: every fifth in production, every one while developing. */
export const SITE_LOADER_EVERY = process.env.NODE_ENV === 'production' ? 5 : 1;
/** How long the first screen waits when the loader plays: until its cover starts to lift. The same
 *  expression as the cover's own delay (globals.css `.site-loader`), so the two cannot drift apart.
 *  Written on <html> by the decision script, as `--site-wait`, and read by the first screen's
 *  entrance (globals.css `.site-rise`). */
export const SITE_LOADER_WAIT = 'calc(var(--duration-slow) * 9)';

/** Whether the `open`-th open on this device (counting from 1) plays the loader. */
export function shouldShowLoader(open: number, every = SITE_LOADER_EVERY): boolean {
  if (!Number.isFinite(open) || open < 1) return true;
  return (Math.floor(open) - 1) % every === 0;
}

/**
 * The decision, as the inline script a site page renders first. Kept in step with `shouldShowLoader`
 * by `site-loader.test.ts`, which runs it. What it keeps is the number of opens so far; anything else
 * found under its key (the time the four-hour rule used to keep, or a value it did not write) counts
 * as never opened.
 */
export function loaderScript(every: number): string {
  const play = `d.setAttribute(${JSON.stringify(SITE_LOADER_ATTR)},'');d.style.setProperty('--site-wait',${JSON.stringify(SITE_LOADER_WAIT)})`;
  return `(function(){var d=document.documentElement;try{var k=${JSON.stringify(SITE_LOADER_KEY)},v=Number(localStorage.getItem(k)),n=(v>=1&&v<1e9?Math.floor(v):0)+1;localStorage.setItem(k,String(n));if((n-1)%${every}===0){${play}}}catch(e){if(${every}===1){${play}}}})();`;
}

export const siteLoaderScript = loaderScript(SITE_LOADER_EVERY);
