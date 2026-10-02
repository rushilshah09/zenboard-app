'use client';
// WaitlistCard — the supplied card SVG, unchanged, with two things on top:
//  1. Its real shine follows the mouse. The shine is where the gold
//     gradients sit, so the card's own gradients slide along their axis
//     (face, border and every logo glyph together) and ease back to their
//     original place when the mouse leaves. At rest it is the export.
//  2. The storyboard: black card → gold card rises out → black card tucks
//     behind → on join, the ticket slides out of its holder with the name.
// No tilt, scale, glow or particles. Reduced motion skips the movement.
// Every layer svg keeps the export's fill="none": its outline strokes rely
// on it, and without it they would fill black over the gold.
import { useEffect, useId, useMemo, useRef } from 'react';
import { DEFS, GLOW, GOLD, HOLDER, SHINE_AXIS, SHINE_PEAK, TICKET, TICKET_OFFSET, VIEWBOX } from './art';
import styles from './waitlist-card.module.css';

export type WaitlistStep = 'enter' | 'back' | 'rise' | 'settle' | 'card' | 'dispense' | 'ticket';

type Props = {
  /** Storyboard step. 'card' is the resting card; 'ticket' is the named ticket. */
  step?: WaitlistStep;
  /** Engraved under the logo once the ticket is out. */
  name?: string;
  /** Texture used by the export's grain layer. */
  grain?: string;
  className?: string;
};

const MARK = 'M18.4226 8.14215L18.6403 7.92451C20.4532 6.11147 20.4532 3.1733 18.6403 1.36026L18.6383 1.35832C16.8254 -0.452773 13.8873 -0.452773 12.0763 1.35832L11.8567 1.57791C10.8326 2.60199 9.16736 2.60199 8.14137 1.57791L7.92373 1.36026C6.11076 -0.452773 3.1727 -0.452773 1.35973 1.36026C-0.453243 3.1733 -0.453243 6.11147 1.35973 7.92451L1.57736 8.14215C2.60141 9.16818 2.60141 10.8335 1.57736 11.8576L1.35973 12.0753C-0.453243 13.8883 -0.453243 16.8265 1.35973 18.6395C3.1727 20.4525 6.11076 20.4545 7.92373 18.6395L8.14137 18.4219C9.16736 17.3958 10.8326 17.3958 11.8567 18.4219L12.0743 18.6395C13.8873 20.4525 16.8254 20.4525 18.6383 18.6395H18.6403V18.6376C20.4532 16.8245 20.4532 13.8863 18.6403 12.0733L18.4226 11.8557C17.3966 10.8316 17.3966 9.16623 18.4226 8.1402V8.14215ZM4.85936 15.1397C7.69832 12.3007 7.69832 7.69909 4.85936 4.86003C7.69832 7.69909 12.3017 7.69909 15.1406 4.86003C12.3017 7.69909 12.3017 12.3007 15.1406 15.1397C12.3017 12.3007 7.69832 12.3007 4.85936 15.1397Z';
const TAU = 90; // ms: time-based easing, so it settles the same at any frame rate
const RANGE = 120; // how far the shine may travel along its axis, export units

export function WaitlistCard({ step = 'card', name, grain = '/waitlist/grain.png', className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Per-instance ids, so several cards can share a page.
  const art = useMemo(() => {
    const ns = (s: string) => s.replaceAll('zb-', `zb${uid}-`);
    return { defs: ns(DEFS).replaceAll('__GRAIN__', grain), holder: ns(HOLDER), ticket: ns(TICKET) };
  }, [uid, grain]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const grads = [...GOLD, ...GLOW]
      .map((id) => root.querySelector<SVGGradientElement>(`#${id.replace('zb-', `zb${uid}-`)}`))
      .filter((g): g is SVGGradientElement => !!g);
    // Radial glows already carry a gradientTransform: prepend the shift to it.
    const base = grads.map((g) => g.getAttribute('gradientTransform') ?? '');
    let target = 0;
    let shift = 0;
    let raf = 0;
    const apply = () => {
      const dx = (shift * SHINE_AXIS.x).toFixed(2);
      const dy = (shift * SHINE_AXIS.y).toFixed(2);
      grads.forEach((g, i) => {
        // At rest, restore the export's own attribute: identical to the SVG.
        if (shift === 0) { if (base[i]) g.setAttribute('gradientTransform', base[i]); else g.removeAttribute('gradientTransform'); return; }
        g.setAttribute('gradientTransform', `translate(${dx} ${dy}) ${base[i]}`.trim());
      });
    };
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      shift += (target - shift) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - shift) < 0.25) shift = target;
      apply();
      if (shift === target) { raf = 0; last = 0; } else raf = requestAnimationFrame(tick);
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const [vx, vy, vw, vh] = VIEWBOX.split(' ').map(Number);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = root.getBoundingClientRect();
      // Pointer in the export's coordinates (the ticket's own space).
      const x = vx + ((e.clientX - r.left) / r.width) * vw - TICKET_OFFSET.x;
      const y = vy + ((e.clientY - r.top) / r.height) * vh - TICKET_OFFSET.y;
      const along = (x - SHINE_PEAK.x) * SHINE_AXIS.x + (y - SHINE_PEAK.y) * SHINE_AXIS.y;
      target = Math.max(-RANGE, Math.min(RANGE, along));
      go();
    };
    const onLeave = () => { target = 0; go(); };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [uid]);

  const mark = `zb${uid}-mark`;
  return (
    <div ref={rootRef} data-step={step} className={[styles.root, name ? styles.named : '', className].filter(Boolean).join(' ')} role="img" aria-label={name ? `Zenboard waitlist ticket for ${name}` : 'Zenboard waitlist card'}>
      <svg className={styles.defs} aria-hidden focusable="false">
        <defs dangerouslySetInnerHTML={{ __html: art.defs }} />
        <defs>
          <linearGradient id={mark} x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0.16" stopColor="#C9A65D" /><stop offset="0.5" stopColor="#F8E7B9" /><stop offset="0.83" stopColor="#866535" />
          </linearGradient>
        </defs>
      </svg>
      {/* The black card that arrives first: the holder, closed, with the mark. */}
      <svg className={`${styles.layer} ${styles.back}`} viewBox={VIEWBOX} fill="none" aria-hidden>
        <g dangerouslySetInnerHTML={{ __html: art.holder }} />
        <path d={MARK} fill={`url(#${mark})`} transform="translate(705 425) scale(1.5)" />
      </svg>
      {/* The card: holder, and the ticket sitting in its recess. */}
      <div className={`${styles.layer} ${styles.card}`}>
        <svg className={`${styles.layer} ${styles.holder}`} viewBox={VIEWBOX} fill="none" aria-hidden>
          <g dangerouslySetInnerHTML={{ __html: art.holder }} />
        </svg>
        <svg className={`${styles.layer} ${styles.ticket}`} viewBox={VIEWBOX} fill="none" aria-hidden>
          <g transform={`translate(${TICKET_OFFSET.x} ${TICKET_OFFSET.y})`}>
            <g dangerouslySetInnerHTML={{ __html: art.ticket }} />
            {name && (
              <g className={styles.name} fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui" fontWeight={600} fontSize={15} letterSpacing={3.2} textAnchor="middle">
                {/* Engraved: a light lip below a darker cut. */}
                <text x="720" y="958.6" fill="#F8E7B9" fillOpacity={0.55}>{name.toUpperCase()}</text>
                <text x="720" y="957.6" fill="#6E4F1D" fillOpacity={0.9}>{name.toUpperCase()}</text>
              </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
