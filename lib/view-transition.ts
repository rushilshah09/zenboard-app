// ── ONE CLICK, ONE CHANGE ──────────────────────────────────────────────────
//
// A route change replaces the screen: one set of elements stops existing, another starts, and
// nothing on screen says they are the same app. For most navigations that is fine — you went
// somewhere else. For a MODE it is wrong: entering focus does not take you to another place, it
// changes the room you are already in, and a hard cut makes it read as a page that lost its
// furniture.
//
// The browser's View Transitions API is built for exactly this: it snapshots the page before the
// change, lets the DOM update, and then animates between the two — layout changes included, as
// GPU-composited images rather than as a width that has to be re-laid-out sixty times a second.
// So a 240px sidebar leaving and a pane growing to fill its space costs nothing to animate, which
// is the one thing plain CSS cannot do here.
//
// ── WHY THE RAW API AND NOT REACT'S <ViewTransition> ──────────────────────
// React 19's component is available in this Next (16.2.9) but only behind
// `experimental.viewTransition` in `next.config.ts` — a file this session does not own. The raw
// API needs no configuration, works on the same browsers, and is a smaller surface: one call.
//
// ── THE PROMISE IS THE WHOLE TRICK ─────────────────────────────────────────
// `startViewTransition` captures "after" when its callback settles. `router.push` RETURNS before
// the new route has rendered, so resolving on it would snapshot the old screen twice and animate
// nothing. We resolve when the URL has actually become the destination and the browser has painted
// it (two frames — the first still belongs to the paint that committed), with a timeout underneath
// so a slow or failed navigation can never leave the page frozen under a transition.
export const VT_TIMEOUT_MS = 900;

/** Does this browser and this person want a transition at all? */
export function canViewTransition(): boolean {
  if (typeof document === 'undefined') return false;
  if (!('startViewTransition' in document)) return false;
  // Reduced motion gets the destination, instantly. A whole-screen morph is the definition of
  // the movement this setting asks us not to make.
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Run `navigate` inside a view transition, marking <html> while it runs.
 *
 * `data-vt` is how the rest of the app knows to stay out of the way: a page's own entrance fade
 * would otherwise play ON TOP of the transition, fading in content the browser is already
 * cross-fading, which reads as a double exposure.
 */
export function navigateWithTransition(navigate: () => void, isThere: () => boolean): void {
  if (!canViewTransition()) {
    navigate();
    return;
  }
  const root = document.documentElement;
  root.setAttribute('data-vt', '');
  const done = () => root.removeAttribute('data-vt');

  const transition = (document as Document & {
    startViewTransition: (cb: () => Promise<void> | void) => { finished: Promise<void> };
  }).startViewTransition(() => new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve(); };
    const guard = setTimeout(finish, VT_TIMEOUT_MS);
    const settle = () => { clearTimeout(guard); requestAnimationFrame(() => requestAnimationFrame(finish)); };
    const poll = () => {
      if (settled) return;
      if (isThere()) settle();
      else requestAnimationFrame(poll);
    };
    navigate();
    requestAnimationFrame(poll);
  }));

  transition.finished.then(done, done);
}
