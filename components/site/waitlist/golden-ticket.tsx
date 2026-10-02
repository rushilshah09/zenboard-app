'use client';
// ── THE GOLDEN TICKET ───────────────────────────────────────────────────────
//
// The user's own artwork (Frame 15917.svg, ticket-art.ts says what was done to it and why), drawn
// inline so its gradients can move. Three things happen to it, and nothing else:
//
//   1. IT CATCHES THE LIGHT WHERE YOUR HAND IS. The ticket's shine is where its gold gradients sit,
//      so those gradients slide along the shine's own axis under the pointer: the light crosses the
//      face, the frame, every logo glyph and the print together. Not a band laid over the top.
//   2. IT TILTS toward the pointer on both axes, and a click turns it over to the back (the mark
//      alone). The tilt and the light share one loop and one pointer reading.
//   3. IT FOLLOWS THE STORYBOARD (user, 2026-10-02): the black card arrives, the gold card rises out
//      of it, the black card tucks behind; when someone joins, the ticket slides out of its holder
//      and the holder drops away.
//   4. THE NAME IS LASER-ENGRAVED onto it as it comes free (user, 2026-10-02: "name appear like
//      laser engraving"): a hot point scans up and down through the letters as it travels left to
//      right, a short glow trails it, and the struck-in name is left behind. Once, never on a loop.
//
// AT REST IT IS THE EXPORT: when the pointer leaves, every gradient gets the export's own value back,
// not a near-zero offset. Motion is time-based (exponential, so it settles the same at 30 or 120
// fps). Reduced motion keeps the ticket still: no tilt, no travel, and the turn-over is instant.
//
// The print is part of the ticket layer, so it travels with the card when it slides out.

import * as React from 'react';
import { cn } from '@/lib/cn';
import { formatTicket } from '@/lib/waitlist';
import {
  DEFS, GLOW, GOLD, HOLDER, MARK_ON_HOLDER, PRINT, SHINE_AXIS, SHINE_PEAK,
  TICKET_BACK, TICKET_FRONT, TICKET_OFFSET, TICKET_RATIO, VIEWBOX,
} from './ticket-art';

export { TICKET_RATIO };

/** Where the ticket is in the storyboard. 'card' is the resting card; 'ticket' is the ticket alone. */
export type TicketStep = 'enter' | 'back' | 'rise' | 'settle' | 'card' | 'dispense' | 'ticket';

const TILT = 11;            // degrees at the card's edge
const RANGE = 120;          // how far the shine may travel along its axis, export units
const TAU_FOLLOW = 90;      // ms: the light and the tilt following the hand
const TAU_TURN = 150;       // ms: turning the card over
const ADDRESS = 'zenboard.life';
const ENGRAVE_SPEED = 0.11;  // export units per ms: a laser moves at one steady speed (linear)
const SCAN_HZ = 0.045;       // the head's up-and-down passes per ms

/** Storyboard timings, in steps of the product's slow duration (so a reduced-motion skin is honoured). */
const INTRO: [TicketStep, number][] = [['back', 0], ['rise', 4.5], ['settle', 4.5], ['card', 3.2]];
const RELEASE: [TicketStep, number][] = [['dispense', 1.2], ['ticket', 4.5]];

export function GoldenTicket({ number, name, arrive = false, out = false, bare = false, intro = false, interactive = true, className }: {
  /** The place in the queue this ticket is for. */
  number: number;
  /** Whose ticket it is, printed top-left the way a card carries its holder. */
  name?: string | null;
  /** True when it has just been earned, so it rises in rather than simply being there. */
  arrive?: boolean;
  /** True when the ticket should leave its holder (the moment someone joins). */
  out?: boolean;
  /** The ticket on its own, with no holder behind it. */
  bare?: boolean;
  /** Play the storyboard's opening when the ticket scrolls into view. */
  intro?: boolean;
  /** Tilt, light and turn-over under the pointer. */
  interactive?: boolean;
  className?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const tiltRef = React.useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState<TicketStep>(intro ? 'enter' : bare ? 'ticket' : 'card');
  const [flipped, setFlipped] = React.useState(false);
  const flipRef = React.useRef(false);
  React.useEffect(() => { flipRef.current = flipped; }, [flipped]);

  // Per-instance ids, so two tickets on a page never share gradients.
  const art = React.useMemo(() => {
    const ns = (s: string) => s.replaceAll('zb-', `zb${uid}-`);
    return { defs: ns(DEFS), holder: ns(HOLDER), front: ns(TICKET_FRONT), back: ns(TICKET_BACK), mark: ns(MARK_ON_HOLDER), id: (s: string) => s.replace('zb-', `zb${uid}-`) };
  }, [uid]);

  // ── The storyboard ──
  const play = React.useCallback((list: [TicketStep, number][]) => {
    const root = rootRef.current;
    if (!root) return () => {};
    // Reduced motion lands on the last step at once (still on a timer, never inside the effect's own tick).
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const unit = still ? 0 : parseFloat(getComputedStyle(root).getPropertyValue('--duration-slow')) || 200;
    if (still) list = [list[list.length - 1]];
    let t = 0;
    const ids = list.map(([s, n]) => window.setTimeout(() => setStep(s), (t += n * unit)));
    return () => ids.forEach(clearTimeout);
  }, []);

  React.useEffect(() => {
    if (!intro) return;
    const root = rootRef.current;
    if (!root) return;
    let stop = () => {};
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { stop = play(INTRO); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(root);
    return () => { io.disconnect(); stop(); };
  }, [intro, play]);

  React.useEffect(() => {
    if (!out || bare) return;
    return play(RELEASE);
  }, [out, bare, play]);

  // ── The name, laser-engraved as the ticket comes free ──
  const nameRef = React.useRef<SVGTextElement>(null);
  const clipRef = React.useRef<SVGRectElement>(null);
  const hotRef = React.useRef<SVGRectElement>(null);
  const headRef = React.useRef<SVGGElement>(null);
  const engraves = !!name && out && !bare;
  React.useEffect(() => {
    const text = nameRef.current;
    const clip = clipRef.current;
    const hot = hotRef.current;
    const head = headRef.current;
    if (!engraves || step !== 'ticket' || !text || !clip || !hot || !head) return;
    const reveal = (w: number) => clip.setAttribute('width', String(w));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { reveal(10000); return; }
    const len = text.getComputedTextLength();
    const x0 = PRINT.name.x;
    const top = PRINT.name.y - PRINT.size * 0.74;
    const span = PRINT.size * 0.78;
    const duration = len / ENGRAVE_SPEED;
    let raf = 0;
    let t0 = 0;
    const frame = (t: number) => {
      if (!t0) t0 = t;
      const e = t - t0;
      const p = Math.min(1, e / duration);
      const x = x0 + p * len;
      reveal(Math.max(0, x - x0));
      // The hot trail: the last few units behind the head are still glowing.
      hot.setAttribute('x', String(Math.max(x0, x - 9)));
      hot.setAttribute('width', String(Math.min(9, x - x0)));
      // The head scans the glyph height as it moves, the way a raster engraver does.
      const y = top + (0.5 - 0.5 * Math.cos(e * SCAN_HZ * Math.PI * 2)) * span;
      head.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      head.style.opacity = p < 1 ? '1' : String(Math.max(0, 1 - (e - duration) / 260));
      hot.style.opacity = p < 1 ? '0.85' : String(Math.max(0, 0.85 - (e - duration) / 420));
      if (p < 1 || e < duration + 420) raf = requestAnimationFrame(frame);
      else reveal(10000);
    };
    reveal(0);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engraves, step]);

  // ── Light, tilt and turn-over: one loop ──
  const turnTo = React.useRef<(flip: boolean) => void>(() => {});
  React.useEffect(() => {
    const root = rootRef.current;
    const tilt = tiltRef.current;
    if (!root || !tilt || !interactive) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const grads = [...GOLD, ...GLOW]
      .map((id) => root.querySelectorAll<SVGGradientElement>(`[id="${art.id(id)}"]`)[0])
      .filter((g): g is SVGGradientElement => !!g);
    const base = grads.map((g) => g.getAttribute('gradientTransform') ?? '');
    const [vx, vy, vw, vh] = VIEWBOX.split(' ').map(Number);

    const want = { shine: 0, rx: 0, ry: 0, turn: flipRef.current ? 180 : 0 };
    const now = { ...want };
    let raf = 0;
    let last = 0;

    const paint = () => {
      tilt.style.transform = `rotateX(${now.rx.toFixed(2)}deg) rotateY(${(now.turn + now.ry).toFixed(2)}deg)`;
      const dx = (now.shine * SHINE_AXIS.x).toFixed(2);
      const dy = (now.shine * SHINE_AXIS.y).toFixed(2);
      grads.forEach((g, i) => {
        if (now.shine === 0) { if (base[i]) g.setAttribute('gradientTransform', base[i]); else g.removeAttribute('gradientTransform'); return; }
        g.setAttribute('gradientTransform', `translate(${dx} ${dy}) ${base[i]}`.trim());
      });
    };
    const ease = (k: keyof typeof want, dt: number, tau: number, snap: number) => {
      now[k] += (want[k] - now[k]) * (1 - Math.exp(-dt / tau));
      if (Math.abs(want[k] - now[k]) < snap) now[k] = want[k];
    };
    const tick = (t: number) => {
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      ease('shine', dt, TAU_FOLLOW, 0.25);
      ease('rx', dt, TAU_FOLLOW, 0.02);
      ease('ry', dt, TAU_FOLLOW, 0.02);
      ease('turn', dt, TAU_TURN, 0.05);
      paint();
      const settled = (Object.keys(want) as (keyof typeof want)[]).every((k) => want[k] === now[k]);
      if (settled) { raf = 0; last = 0; } else raf = requestAnimationFrame(tick);
    };
    const go = () => {
      if (reduce) { Object.assign(now, want, { rx: 0, ry: 0, shine: 0 }); paint(); return; }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    turnTo.current = (flip) => { want.turn = flip ? 180 : 0; go(); };

    // Measured once per entry: the card's box does not change during one hover.
    let box: DOMRect | null = null;
    const onEnter = () => { box = tilt.getBoundingClientRect(); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!box) box = tilt.getBoundingClientRect();
      const px = (e.clientX - box.left) / box.width;
      const py = (e.clientY - box.top) / box.height;
      want.ry = (px - 0.5) * 2 * TILT;
      want.rx = -(py - 0.5) * 2 * TILT;
      // The pointer in the ticket's own coordinates, for the light.
      const x = vx + px * vw - TICKET_OFFSET.x;
      const y = vy + py * vh - TICKET_OFFSET.y;
      const along = (x - SHINE_PEAK.x) * SHINE_AXIS.x + (y - SHINE_PEAK.y) * SHINE_AXIS.y;
      want.shine = Math.max(-RANGE, Math.min(RANGE, flipRef.current ? -along : along));
      go();
    };
    const onLeave = () => { box = null; want.rx = 0; want.ry = 0; want.shine = 0; go(); };
    // Listened for on the ticket as a whole (the turn-over button lies across it).
    if (fine) {
      root.addEventListener('pointerenter', onEnter);
      root.addEventListener('pointermove', onMove, { passive: true });
      root.addEventListener('pointerleave', onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [art, interactive]);

  const turn = () => { const next = !flipped; flipRef.current = next; setFlipped(next); turnTo.current(next); };

  const digits = formatTicket(number).slice(1);
  const label = name
    ? `Zenboard waitlist ticket for ${name}, number ${formatTicket(number)}`
    : `Zenboard waitlist ticket, number ${formatTicket(number)}`;
  const engraving = engraves && name && (
    <g aria-hidden>
      <defs>
        <clipPath id={art.id('zb-engrave-clip')}><rect ref={clipRef} x={PRINT.name.x - 2} y={PRINT.name.y - PRINT.size * 1.2} width={engraves ? 0 : 10000} height={PRINT.size * 1.6} /></clipPath>
        <clipPath id={art.id('zb-engrave-hot')}><rect ref={hotRef} x={PRINT.name.x} y={PRINT.name.y - PRINT.size * 1.2} width={0} height={PRINT.size * 1.6} /></clipPath>
        <filter id={art.id('zb-engrave-glow')} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      {/* Freshly struck metal, still hot just behind the head. */}
      <text x={PRINT.name.x} y={PRINT.name.y} fill="#FFE7A8" clipPath={`url(#${art.id('zb-engrave-hot')})`} filter={`url(#${art.id('zb-engrave-glow')})`}>{name}</text>
      <text x={PRINT.name.x} y={PRINT.name.y} fill="#FFF3D0" clipPath={`url(#${art.id('zb-engrave-hot')})`}>{name}</text>
      {/* The head: a white-hot point in a warm bloom. */}
      <g ref={headRef} style={{ opacity: 0 }}>
        <circle r="3.4" fill="#FFD88A" opacity="0.55" filter={`url(#${art.id('zb-engrave-glow')})`} />
        <circle r="0.9" fill="#FFFFFF" />
      </g>
    </g>
  );
  const print = (
    <g className="zb-ticket-print" fontWeight={450} fontSize={PRINT.size} style={{ fontFamily: 'var(--font-sans, var(--font-geist-sans)), ui-sans-serif, system-ui, sans-serif' }}>
      {/* Struck in like the lockup (its emboss), in a deeper gold the shine runs through. */}
      <g filter={`url(#${art.id('zb-print-emboss')})`} fill={`url(#${art.id('zb-print-gold')})`}>
        {name && (
          <g clipPath={engraves ? `url(#${art.id('zb-engrave-clip')})` : undefined}>
            <text ref={nameRef} className="zb-ticket-name" x={PRINT.name.x} y={PRINT.name.y}>{name}</text>
          </g>
        )}
        <text className="zb-ticket-number" x={PRINT.number.x} y={PRINT.number.y} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{digits}</text>
        <text x={PRINT.address.x} y={PRINT.address.y}>{ADDRESS}</text>
      </g>
      {engraving}
    </g>
  );

  return (
    <div
      ref={rootRef}
      className={cn('zb-ticket', className)}
      data-step={step}
      data-bare={bare ? 'true' : undefined}
      data-arrive={arrive ? 'true' : undefined}
      data-flipped={flipped ? 'true' : undefined}
    >
      <div role="img" aria-label={label} className="zb-ticket-figure">
        <svg className="zb-ticket-defs" aria-hidden focusable="false"><defs dangerouslySetInnerHTML={{ __html: art.defs }} /></svg>
        {/* The black card that arrives first: the holder, closed, with the mark. */}
        {intro && (
          <svg className="zb-ticket-layer zb-ticket-sleeve" viewBox={VIEWBOX} fill="none" aria-hidden>
            <g dangerouslySetInnerHTML={{ __html: art.holder + art.mark }} />
          </svg>
        )}
        <div className="zb-ticket-layer zb-ticket-card">
          {!bare && (
            <svg className="zb-ticket-layer zb-ticket-holder" viewBox={VIEWBOX} fill="none" aria-hidden>
              <g dangerouslySetInnerHTML={{ __html: art.holder }} />
            </svg>
          )}
          {/* The ticket: front and back, turned and tilted as one. Every layer keeps the export's
              fill="none" — its outline strokes rely on it, and without it they fill black. */}
          <div className="zb-ticket-layer zb-ticket-slide">
            <div ref={tiltRef} className="zb-ticket-tilt">
              <svg className="zb-ticket-face zb-ticket-front" viewBox={VIEWBOX} fill="none" aria-hidden>
                <g transform={`translate(${TICKET_OFFSET.x} ${TICKET_OFFSET.y})`}>
                  <g dangerouslySetInnerHTML={{ __html: art.front }} />
                  {print}
                </g>
              </svg>
              <svg className="zb-ticket-face zb-ticket-back" viewBox={VIEWBOX} fill="none" aria-hidden>
                <g transform={`translate(${TICKET_OFFSET.x} ${TICKET_OFFSET.y})`} dangerouslySetInnerHTML={{ __html: art.back }} />
              </svg>
            </div>
          </div>
        </div>
      </div>
      {interactive && (
        <button type="button" className="zb-ticket-turn" onClick={turn} aria-pressed={flipped}>
          <span className="sr-only">{flipped ? 'Turn the ticket to the front' : 'Turn the ticket over'}</span>
        </button>
      )}
    </div>
  );
}
