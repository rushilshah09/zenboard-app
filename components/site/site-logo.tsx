'use client';
// ── THE LOGO, ANSWERING THE HAND ────────────────────────────────────────────
//
// The website's logo is more than a link home (user, 2026-09-26):
//
//   · RIGHT-CLICK IT, and it offers itself the way Attio's does: "Copy wordmark as SVG", "Copy logo as
//     SVG", and, in place of their brand guidelines, "Start focus session": the product's own first
//     minute, without an account (guest-focus.tsx). The files are the page's own artwork with the
//     brand's colours put in (lib/brand.ts).
//   · POINT AT IT, and it leans toward the pointer a little, like a magnet; circle the pointer round
//     the mark and the mark turns with it. Let go and it settles on the nearest quarter turn, which
//     for a mark of four petals is exactly how it always looks, so it never visibly unwinds. A fine
//     pointer only, and never under less motion.

import Link from 'next/link';
import * as React from 'react';
import { Logo, toast } from '@/components/ds/ui';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ds/ui/context-menu';
import { logoSvg, wordmarkSvg } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { openGuestFocus } from '@/lib/guest-focus';

/** How far outside the logo the pointer still counts as near it. */
const REACH = 28;
/** How much of the pointer's offset the logo leans by, and the most it ever moves. */
const PULL = 0.12;
const MAX = 3;
/** How much of the way to where it is going it moves each frame (it eases after the hand). */
const EASE = 0.18;
/** Nearer the mark's middle than this, the pointer's angle is noise, so it does not turn it. */
const DEAD = 6;

const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));

function useMagnet(ref: React.RefObject<HTMLAnchorElement | null>) {
  React.useEffect(() => {
    const link = ref.current;
    // The lockup's first shape is the mark (components/ds/ui/icon.tsx `Logo`).
    const mark = link?.querySelector<SVGPathElement>('svg > path');
    if (!link || !mark) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    mark.style.transformBox = 'fill-box';
    mark.style.transformOrigin = 'center';

    let turn = 0;
    let toTurn = 0;
    let angle: number | null = null;
    let x = 0;
    let y = 0;
    let toX = 0;
    let toY = 0;
    let frame = 0;
    const tick = () => {
      frame = 0;
      turn += (toTurn - turn) * EASE;
      x += (toX - x) * EASE;
      y += (toY - y) * EASE;
      mark.style.transform = `rotate(${turn.toFixed(2)}deg)`;
      link.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      if (Math.abs(toTurn - turn) > 0.05 || Math.abs(toX - x) + Math.abs(toY - y) > 0.02) frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const letGo = () => {
      if (angle == null && toX === 0 && toY === 0) return;
      angle = null;
      toTurn = Math.round(toTurn / 90) * 90;
      toX = 0;
      toY = 0;
      wake();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !fine.matches || still.matches) return;
      const r = link.getBoundingClientRect();
      const near = e.clientX > r.left - REACH && e.clientX < r.right + REACH && e.clientY > r.top - REACH && e.clientY < r.bottom + REACH;
      if (!near) return letGo();
      const m = mark.getBoundingClientRect();
      const dx = e.clientX - (m.left + m.width / 2);
      const dy = e.clientY - (m.top + m.height / 2);
      if (Math.hypot(dx, dy) > DEAD) {
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle != null) {
          let d = a - angle;
          if (d > 180) d -= 360;
          else if (d < -180) d += 360;
          toTurn += d;
        }
        angle = a;
      }
      toX = clamp(dx * PULL);
      toY = clamp(dy * PULL);
      wake();
    };

    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', letGo);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', letGo);
      cancelAnimationFrame(frame);
      mark.style.transform = '';
      link.style.translate = '';
    };
  }, [ref]);
}

export function SiteLogo({ height = 24, className }: { height?: number; className?: string }) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  useMagnet(ref);

  const copy = (part: 'wordmark' | 'logo') => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    // The page's styles come off in the copy (lib/brand.ts), a turn in progress with them: the file
    // is the artwork at rest.
    const file = part === 'wordmark' ? wordmarkSvg(svg.outerHTML) : logoSvg(svg.outerHTML);
    navigator.clipboard.writeText(file).then(
      () => toast({ message: part === 'wordmark' ? 'Wordmark copied as SVG' : 'Logo copied as SVG' }),
      () => toast({ message: 'Couldn’t copy: this browser kept the clipboard closed.', variant: 'error' }),
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link ref={ref} href="/" aria-label="Zenboard home" className={cn('focus-ring rounded-md', className)}>
          <Logo height={height} />
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem onSelect={() => copy('wordmark')}>Copy wordmark as SVG</ContextMenuItem>
        <ContextMenuItem onSelect={() => copy('logo')}>Copy logo as SVG</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={openGuestFocus}>Start focus session</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
