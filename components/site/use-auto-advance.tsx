'use client';
// ── A LIST THAT TURNS ITS OWN PAGES, UNTIL YOU TOUCH IT ────────────────────
//
// The one interaction grammar for everything on the website that moves on by itself (a product area's
// features, the loop's steps): an item holds for `--site-dwell`, shown as a berry rule filling under
// it, then the next takes over. The dwell is CSS (`site-dwell` in globals.css), so:
//   · pointer over the part, or focus inside it: it pauses (a reader is reading);
//   · the part off screen: it pauses (nothing turns over where nobody is looking);
//   · choosing an item, or pressing inside a picture: it stops for good (the reader has taken over);
//   · less motion asked for: there is no dwell at all, so nothing ever advances by itself.
// Pausing is one attribute, `data-running`, on the part's root; the stylesheet pauses every animation
// inside it, the dwell and whatever the part choreographs alongside.

import * as React from 'react';

export function useAutoAdvance(count: number) {
  const [active, setActive] = React.useState(0);
  const [auto, setAuto] = React.useState(true);
  const [held, setHeld] = React.useState(false);
  const [seen, setSeen] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = auto && !held && seen;
  const choose = (i: number) => { setActive(i); setAuto(false); };
  const next = () => setActive((a) => (a + 1) % count);
  const stop = () => setAuto(false);
  const hold = {
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocusCapture: () => setHeld(true),
    onBlurCapture: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); },
  };
  return { ref, active, auto, seen, running, choose, next, stop, hold };
}

/** The dwell under the active item: a rule that fills, and hands over when it is full.
 *  It is the AREA'S hue (`--site-hue-ink`, set by `site-hue-*` on an ancestor), so the bar, the
 *  glyph beside it and the picture it is turning are one colour — Calendly's rule, and the reason
 *  the eye has only one thing to follow. Where no area owns it, it falls back to the accent. */
export function Dwell({ onEnd, className }: { onEnd: () => void; className?: string }) {
  return (
    <span aria-hidden className={className ?? 'absolute inset-x-0 -bottom-px h-0.5 overflow-hidden'}>
      <span className="site-dwell block h-full bg-[var(--site-hue-ink,var(--accent))]" onAnimationEnd={onEnd} />
    </span>
  );
}
