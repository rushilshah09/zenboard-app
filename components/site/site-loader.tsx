'use client';
// ── THE WEBSITE'S LOADER ────────────────────────────────────────────────────
//
// What plays when the website is opened (lib/site-loader.ts decides when, before first paint): the
// Zenboard mark drawing itself and filling with the palette's chalk, and a line filling under it, on
// the page's own ground; then it lifts away and the page is there. It is the app's boot splash, the
// same mark and the same bar (DrawnMark, `.zb-splash-bar`), because the site and the app should
// introduce themselves the same way.
//
// It is CSS from start to finish: shown by `html[data-site-loader]`, which the decision script sets,
// and gone by its own exit animation. Once that exit has finished the attribute comes off, so a page
// reached by moving around the site afterwards never plays it again. Reduced motion keeps the mark
// (filled, not drawn) and the fade, and nothing moves. It is a picture: hidden from assistive
// technology, and the page under it is already there for anyone reading it.
//
// The first screen waits for it (`--site-wait`, written by the same script). That wait is left alone
// here, because the words arriving were timed against it; only a page reached by moving around the
// site, where nothing played, drops it before it paints.

import * as React from 'react';
import { DrawnMark } from '@/components/ds/ui/drawn-mark';
import { SITE_LOADER_ATTR } from '@/lib/site-loader';

export function SiteLoader() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute(SITE_LOADER_ATTR)) {
      root.style.removeProperty('--site-wait');
      return;
    }
    // Whether this woke while the cover was still up or after it had gone (a slow start), the
    // attribute comes off once its exit has finished, and never before.
    const cover = ref.current?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'site-loader-out');
    if (!cover) {
      root.removeAttribute(SITE_LOADER_ATTR);
      return;
    }
    let live = true;
    cover.finished.then(() => { if (live) root.removeAttribute(SITE_LOADER_ATTR); }, () => {});
    return () => { live = false; };
  }, []);
  return (
    <div ref={ref} className="site-loader" aria-hidden>
      <DrawnMark size={52} />
      <div className="zb-splash-bar"><span /></div>
    </div>
  );
}
