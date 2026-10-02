'use client';
// ShineCard — the waitlist card plus one interaction: a light reflection that
// follows the mouse across the gold.
//
// The card artwork is an immutable asset and renders untouched as an <img>.
// The reflection is ONE layer above it: a second copy of the same artwork,
// brightened, revealed only inside a soft spot under the cursor (a radial
// mask). Because the light is made from the card itself:
//  - it can never leave the card's shape;
//  - the gold lights up while the black frame stays black (contrast holds the
//    darks down as brightness lifts the metal);
//  - no blend modes, so it looks the same on any page background and in
//    every browser.
// At rest the layer is transparent: the card is pixel-identical to the asset.
//
// No tilt, rotation, scale, movement, glow or auto-sweep. Mouse and pen only
// (touch has no hover), and reduced motion drops the smoothing.
import { useEffect, useRef } from 'react';

type Props = {
  /** The card asset (SVG or PNG with transparent surroundings). */
  src: string;
  alt: string;
  /** Intrinsic size of the asset, for the aspect ratio. */
  width: number;
  height: number;
  className?: string;
};

const LERP = 0.14; // per frame: soft follow, settles in ~250ms
const FADE_IN = 'opacity 240ms cubic-bezier(0.23, 1, 0.32, 1)';
const FADE_OUT = 'opacity 320ms cubic-bezier(0.23, 1, 0.32, 1)';
/** The light: a narrow, soft spot. Sized in % of the card so it scales with it. */
const SPOT = 'radial-gradient(ellipse 15% 46% at var(--x) var(--y), #000 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 100%)';
const LIFT = 'brightness(1.5) contrast(1.12)';

export function ShineCard({ src, alt, width, height, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const light = lightRef.current;
    if (!root || !light) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let raf = 0;
    let inside = false;

    const place = () => {
      light.style.setProperty('--x', `${pos.x}px`);
      light.style.setProperty('--y', `${pos.y}px`);
    };
    const tick = () => {
      const k = reduce.matches ? 1 : LERP;
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      place();
      const settled = Math.abs(target.x - pos.x) < 0.1 && Math.abs(target.y - pos.y) < 0.1;
      raf = settled && !inside ? 0 : requestAnimationFrame(tick);
    };
    const local = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      inside = true;
      local(e);
      // Light appears where the cursor enters; it never sweeps in from elsewhere.
      pos.x = target.x;
      pos.y = target.y;
      place();
      light.style.transition = FADE_IN;
      light.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !inside) return;
      local(e);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      inside = false;
      light.style.transition = FADE_OUT;
      light.style.opacity = '0';
    };

    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const fillBox = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', userSelect: 'none' } as const;
  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', display: 'inline-block', width, maxWidth: '100%', aspectRatio: `${width} / ${height}`, lineHeight: 0 }}>
      {/* The asset itself, untouched. A plain <img> keeps it byte-for-byte. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} draggable={false} style={fillBox} />
      {/* The single light: the same artwork, brightened, seen only under the cursor. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={lightRef}
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        style={{ ...fillBox, pointerEvents: 'none', opacity: 0, filter: LIFT, maskImage: SPOT, WebkitMaskImage: SPOT }}
      />
    </div>
  );
}
