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
// and gone by its own exit animation. When that animation ends, the attribute comes off, so a page
// reached by moving around the site afterwards never plays it again. Reduced motion keeps the mark
// (filled, not drawn) and the fade, and nothing moves. It is a picture: hidden from assistive
// technology, and the page under it is already there for anyone reading it.

import * as React from 'react';
import { DrawnMark } from '@/components/ds/ui/drawn-mark';
import { SITE_LOADER_ATTR } from '@/lib/site-loader';

export function SiteLoader() {
  const done = (e: React.AnimationEvent) => {
    if (e.target === e.currentTarget && e.animationName === 'site-loader-out') document.documentElement.removeAttribute(SITE_LOADER_ATTR);
  };
  return (
    <div className="site-loader" aria-hidden onAnimationEnd={done}>
      <DrawnMark size={52} />
      <div className="zb-splash-bar"><span /></div>
    </div>
  );
}
