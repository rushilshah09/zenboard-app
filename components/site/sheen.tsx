'use client';
// ── THE SHEEN ───────────────────────────────────────────────────────────────
//
// A card that knows where your hand is: a soft light follows the pointer across it, and its rim
// lights up while the pointer is on it (globals.css, "the sheen"). It is the answer to the user's
// note of 2026-09-26 — "all your animation is clean but not rich and premium" — and to the audit
// that preceded it, which measured 124 of this page's 180 moving elements changing COLOUR and
// nothing else. A page of correct colour transitions is tidy; a surface that responds is not.
//
// ── WHAT THIS FILE IS CAREFUL ABOUT ────────────────────────────────────────
//
// ONE LISTENER, ON THE CARD, and it is passive. Not on the window: a page-wide pointermove that
// hit-tests every card would run on every pixel of every scroll-adjacent move.
//
// ONE WRITE PER FRAME, and it is a TRANSFORM ON A LEAF. Never a custom property on the card: a
// variable set on an ancestor invalidates style for every descendant, and these cards hold a
// hundred of them (Emil, on Vaul: update the element's transform, not a variable on the
// container). So a move costs one composited transform, no style recalc, no layout, no paint.
//
// IT MEASURES ONCE PER ENTER, not per move. `getBoundingClientRect` in a pointermove handler is a
// forced synchronous layout on every event; the card's box cannot change between two moves of the
// same hover, so it is read on `pointerenter` and reused.
//
// NOTHING RUNS WHEN NOBODY IS POINTING. The move handler is attached on enter and removed on
// leave, so a page of twelve cards has zero listeners running while you read it.

import * as React from 'react';

/**
 * Wrap the sheen's two layers around a card's own children. The host must be the positioned,
 * rounded element — pass its ref through `hostRef`, or let `Sheen` be a child of any element that
 * carries `zb-sheen-host` and the radius, which is what `Cell` does.
 */
export function Sheen() {
  const light = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = light.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    // A coarse pointer has no hover: a light left where a thumb last touched is worse than none.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let box: DOMRect | null = null;
    let x = 0;
    let y = 0;
    let raf = 0;

    const paint = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const move = (e: PointerEvent) => {
      if (!box) return;
      x = e.clientX - box.left;
      y = e.clientY - box.top;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const enter = (e: PointerEvent) => {
      // Measured once for this hover: the card cannot move between two frames of the same pass,
      // and reading the box per move is a forced layout per event.
      box = host.getBoundingClientRect();
      move(e);
      // Placed before the first paint of the fade-in, so the light never arrives from the corner.
      paint();
      host.addEventListener('pointermove', move, { passive: true });
    };
    const leave = () => {
      host.removeEventListener('pointermove', move);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      box = null;
    };

    host.addEventListener('pointerenter', enter, { passive: true });
    host.addEventListener('pointerleave', leave, { passive: true });
    return () => {
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
      leave();
    };
  }, []);

  return (
    <>
      <span ref={light} aria-hidden className="zb-sheen" />
      <span aria-hidden className="zb-sheen-rim" />
    </>
  );
}
