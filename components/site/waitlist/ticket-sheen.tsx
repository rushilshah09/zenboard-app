'use client';
// ── THE CARD CATCHES THE LIGHT WHERE YOUR HAND IS ───────────────────────────
//
// The artwork's own highlight is painted into it, so it is the same highlight from every angle.
// This is the one thing a flat drawing cannot do: a band of light that moves when you do. It rides
// OVER the card at `soft-light`, so it lifts the gold that is already there rather than laying a
// white streak on top of it.
//
// ── WHAT THIS FILE IS CAREFUL ABOUT (the rules components/site/sheen.tsx set) ──────────────
//
// ONE LISTENER, ON THE CARD, and it is passive — not a page-wide pointermove that hit-tests.
// IT MEASURES ONCE PER ENTER: `getBoundingClientRect` in a move handler is a forced synchronous
// layout on every event, and the card's box cannot change between two moves of one hover.
// ONE WRITE PER FRAME, and it is a TRANSFORM ON A LEAF — never a custom property on the card,
// which would invalidate style for everything inside it.
// NOTHING RUNS WHEN NOBODY IS POINTING: the move handler is attached on enter and removed on leave.

import * as React from 'react';

export function TicketSheen() {
  const band = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = band.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let box: DOMRect | null = null;
    let raf = 0;
    let want = 0.5;

    const draw = () => {
      raf = 0;
      // THE BAND'S CENTRE SITS UNDER THE POINTER, across the WHOLE card. The first version moved it
      // about a third of the card's width, which is real but so small that the user reported the
      // shine as not interactive at all — and they were right to: a response nobody can see is not
      // one. The band starts at `left: -60%` of the card and is 26% of it wide, and a transform
      // percentage is of the ELEMENT, so putting its centre at fraction `f` is (f + 0.47) / 0.26.
      el.style.transform = `translateX(${((want + 0.47) / 0.26) * 100}%) rotate(14deg)`;
    };
    const onMove = (e: PointerEvent) => {
      if (!box) return;
      want = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
      raf ||= requestAnimationFrame(draw);
    };
    const onEnter = (e: PointerEvent) => {
      box = host.getBoundingClientRect();
      host.addEventListener('pointermove', onMove, { passive: true });
      onMove(e);
    };
    const onLeave = () => {
      host.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
      raf = 0;
      box = null;
      el.style.transform = '';
    };

    host.addEventListener('pointerenter', onEnter, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });
    return () => {
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <span ref={band} aria-hidden className="zb-ticket-gleam" />;
}
