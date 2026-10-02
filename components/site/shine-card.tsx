'use client';
// ShineCard — the waitlist card whose own diagonal shine is interactive.
//
// The card's shine is part of its artwork. To move it, the card is split once
// (see shine-profile.ts): a flattened card (the gold without its shine), plus
// the shine itself, measured from the original and stored as two gradient
// masks: a lift where the gold is brighter and a shade where it is darker.
// Both are copies of the same flattened card, brightened or darkened, so the
// texture, the frame and the logo always line up and light never leaves the
// card. At rest (--s = 0) the stack reproduces the original artwork.
//
// Modes:
//  - 'cursor': the shine's peak slides to follow the mouse along the shine's
//    own axis, and eases back to its original place when the mouse leaves.
//  - 'scroll': the shine travels with the card's position in the viewport,
//    which also works on phones.
// No tilt, rotation, scale, movement or glow. Reduced motion keeps the shine
// at rest.
import { useEffect, useRef } from 'react';
import { SHINE } from './shine-profile';

type Props = {
  /** The flattened card (the artwork without its baked shine). */
  src: string;
  alt: string;
  /** Intrinsic size of the asset, for the aspect ratio. */
  width: number;
  height: number;
  mode?: 'cursor' | 'scroll';
  className?: string;
};

const LERP = 0.12; // per frame: a soft follow that settles in ~300ms
const RAD = (SHINE.angle * Math.PI) / 180;
const DIR = { x: Math.sin(RAD), y: -Math.cos(RAD) }; // the gradient line, in screen space

export function ShineCard({ src, alt, width, height, mode = 'cursor', className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;

    let target = 0;
    let shift = 0;
    let raf = 0;
    /** Length of the gradient line for the card's current size. */
    const lineLength = () => {
      const r = root.getBoundingClientRect();
      return { r, L: r.width * Math.abs(DIR.x) + r.height * Math.abs(DIR.y) };
    };
    const tick = () => {
      shift += (target - shift) * LERP;
      root.style.setProperty('--s', `${shift.toFixed(2)}px`);
      raf = Math.abs(target - shift) < 0.1 ? 0 : requestAnimationFrame(tick);
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(tick); };

    if (mode === 'scroll') {
      const onScroll = () => {
        const { r, L } = lineLength();
        // -1 when the card enters at the bottom, +1 when it leaves at the top.
        const p = (window.innerHeight / 2 - (r.top + r.height / 2)) / (window.innerHeight / 2 + r.height / 2);
        target = Math.max(-1, Math.min(1, p)) * L * 0.45;
        go();
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); };
    }

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const { r, L } = lineLength();
      const proj = (e.clientX - r.left - r.width / 2) * DIR.x + (e.clientY - r.top - r.height / 2) * DIR.y;
      target = (proj / L + 0.5 - SHINE.peak) * L; // put the shine's peak under the cursor
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
  }, [mode]);

  const layer = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' } as const;
  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', display: 'inline-block', width, maxWidth: '100%', aspectRatio: `${width} / ${height}`, lineHeight: 0 }}>
      {/* eslint-disable @next/next/no-img-element -- plain <img> keeps the artwork byte-for-byte */}
      <img src={src} alt={alt} width={width} height={height} draggable={false} style={layer} />
      <img src={src} alt="" aria-hidden draggable={false} style={{ ...layer, filter: SHINE.shade.filter, maskImage: SHINE.shade.mask, WebkitMaskImage: SHINE.shade.mask }} />
      <img src={src} alt="" aria-hidden draggable={false} style={{ ...layer, filter: SHINE.lift.filter, maskImage: SHINE.lift.mask, WebkitMaskImage: SHINE.lift.mask }} />
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}
