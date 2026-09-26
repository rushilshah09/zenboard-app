'use client';
// ── THE LOGO, ANSWERING THE HAND ────────────────────────────────────────────
//
// The website's logo is more than a link home (user, 2026-09-26):
//
//   · RIGHT-CLICK IT, and it offers itself the way Attio's does: "Copy wordmark as SVG", "Copy logo as
//     SVG", and, in place of their brand guidelines, "Start focus session": the product's own first
//     minute, without an account (guest-focus.tsx). The files are the page's own artwork with the
//     brand's colours put in (lib/brand.ts).
//   · MOVE THE CURSOR ROUND IT, and the mark turns with it, while the lettering stays exactly where it
//     is (`useTurn`, below).

import Link from 'next/link';
import * as React from 'react';
import { Logo, toast } from '@/components/ds/ui';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ds/ui/context-menu';
import { logoSvg, wordmarkSvg } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { openGuestFocus } from '@/lib/guest-focus';

/** How far outside the logo the pointer still turns the mark. */
const REACH = 28;
/** How much of the way to the pointer's turn the mark goes each frame: it eases after the hand. */
const EASE = 0.2;
/** Nearer the mark's middle than this, the pointer's angle is noise, so it does not turn it. */
const DEAD = 6;

/**
 * THE MARK TURNS WITH THE CURSOR; NOTHING ELSE MOVES. The user, 2026-09-26: "only the logo mark
 * rotating", then "not rotating by itself on hover: I want it to rotate with the mouse cursor", and
 * "the logo is cutting while rotating". So the mark turns as the pointer goes round it, by as much as
 * the pointer turned, easing after it; the lettering never moves. Let go and it settles on the nearest
 * quarter turn, which for a mark of four petals is exactly how it always looks, so it never visibly
 * unwinds. The lockup is allowed to draw outside its own box, because a square turned inside a square
 * box loses its corners. A fine pointer only, and never under less motion.
 */
function useTurn(ref: React.RefObject<HTMLAnchorElement | null>) {
  React.useEffect(() => {
    const link = ref.current;
    const svg = link?.querySelector('svg');
    // The lockup's first shape is the mark (components/ds/ui/icon.tsx `Logo`).
    const mark = link?.querySelector<SVGPathElement>('svg > path');
    if (!link || !svg || !mark) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    svg.style.overflow = 'visible';
    mark.style.transformBox = 'fill-box';
    mark.style.transformOrigin = 'center';

    let turn = 0;
    let toTurn = 0;
    let angle: number | null = null;
    let frame = 0;
    const tick = () => {
      frame = 0;
      turn += (toTurn - turn) * EASE;
      mark.style.transform = `rotate(${turn.toFixed(2)}deg)`;
      if (Math.abs(toTurn - turn) > 0.05) frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const letGo = () => {
      if (angle == null) return;
      angle = null;
      toTurn = Math.round(toTurn / 90) * 90;
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
      if (Math.hypot(dx, dy) < DEAD) return;
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle != null) {
        let d = a - angle;
        if (d > 180) d -= 360;
        else if (d < -180) d += 360;
        toTurn += d;
        wake();
      }
      angle = a;
    };

    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', letGo);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', letGo);
      cancelAnimationFrame(frame);
      mark.style.transform = '';
    };
  }, [ref]);
}

export function SiteLogo({ height = 24, className }: { height?: number; className?: string }) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  useTurn(ref);

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
