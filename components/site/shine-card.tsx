'use client';
// ShineCard — the waitlist card plus one interaction: a specular light
// reflection that follows the mouse across the gold.
//
// The card artwork is an immutable asset. It renders untouched as an <img>;
// the reflection is a separate overlay above it, masked by the card's own
// alpha so light never leaves the card. At rest the overlay is fully
// transparent, so the card is pixel-identical to the asset.
//
// Blend modes do the realism: `overlay` and `color-dodge` leave black as
// black, so the frame stays dark and only the gold catches the light. Each
// light is its own masked layer with the blend mode on the layer itself; a
// mask isolates its children, so a blend set inside it would never reach the
// card.
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

/** The reflection: a broad sheen that lifts the gold, and a narrow specular core. */
const LIGHTS = [
  { blend: 'overlay', w: '34%', h: '150%', bg: 'radial-gradient(closest-side, rgba(255,248,228,0.7), rgba(255,240,205,0.28) 45%, rgba(255,240,205,0) 100%)' },
  { blend: 'color-dodge', w: '13%', h: '84%', bg: 'radial-gradient(closest-side, rgba(255,236,190,0.55), rgba(255,236,190,0) 100%)' },
] as const;
const LERP = 0.14; // per frame: soft follow, settles in ~250ms
const FADE_IN = 'opacity 240ms cubic-bezier(0.23, 1, 0.32, 1)';
const FADE_OUT = 'opacity 320ms cubic-bezier(0.23, 1, 0.32, 1)';

export function ShineCard({ src, alt, width, height, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lightRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const layers = layerRefs.current.filter((el): el is HTMLDivElement => !!el);
    const lights = lightRefs.current.filter((el): el is HTMLDivElement => !!el);
    if (!root || !layers.length) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let raf = 0;
    let inside = false;

    const place = () => {
      const t = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) rotate(-24deg)`;
      for (const el of lights) el.style.transform = t;
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
      for (const el of layers) { el.style.transition = FADE_IN; el.style.opacity = '1'; }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !inside) return;
      local(e);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      inside = false;
      for (const el of layers) { el.style.transition = FADE_OUT; el.style.opacity = '0'; }
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

  const mask = `url("${src}") center / 100% 100% no-repeat`;
  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', display: 'inline-block', width, maxWidth: '100%', aspectRatio: `${width} / ${height}`, lineHeight: 0 }}>
      {/* The asset itself, untouched. A plain <img> keeps it byte-for-byte. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} draggable={false} style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }} />
      {LIGHTS.map((l, i) => (
        <div
          key={l.blend}
          ref={(el) => { layerRefs.current[i] = el; }}
          aria-hidden
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, overflow: 'hidden', mixBlendMode: l.blend, mask, WebkitMask: mask }}
        >
          <div ref={(el) => { lightRefs.current[i] = el; }} style={{ position: 'absolute', left: 0, top: 0, width: l.w, height: l.h, background: l.bg, willChange: 'transform' }} />
        </div>
      ))}
    </div>
  );
}
