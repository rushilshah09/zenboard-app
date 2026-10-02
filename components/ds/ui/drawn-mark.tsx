'use client';
// ── THE MARK, DRAWN ─────────────────────────────────────────────────────────
//
// The Zenboard mark as the product's two loaders show it: its outline drawn, then filled with the
// chalk gradient of the marketing palette, the line fading once the fill is in (globals.css,
// `.zb-splash-draw` / `.zb-splash-fill`). One component for both, so the app's boot splash and the
// website's loader can never drift into two slightly different marks.
//
// `pathLength="1"` makes the draw a fraction of the outline rather than a measured length, so the
// animation cannot go wrong if the mark's path ever changes. The gradient's id is per instance.
// `overflow="visible"`: the mark touches all four sides of its square, so the line drawn along its
// edge is half outside the box, and a clipped box cut it (user, 2026-09-26: "the animation is cutting").

import * as React from 'react';
import { MARK_PATH } from '@/components/ds/icons';
import { cn } from '@/lib/cn';

export function DrawnMark({ size = 44, className }: { size?: number; className?: string }) {
  const chalk = `zb-chalk-${React.useId().replace(/:/g, '')}`;
  return (
    <svg className={cn('zb-splash-mark', className)} width={size} height={size} viewBox="0 0 20 20" overflow="visible" role="presentation" aria-hidden>
      <defs>
        <linearGradient id={chalk} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-field-petal)" />
          <stop offset="42%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--color-field-apricot)" />
        </linearGradient>
      </defs>
      <path className="zb-splash-fill" d={MARK_PATH} fill={`url(#${chalk})`} />
      <path className="zb-splash-draw" d={MARK_PATH} pathLength={1} />
    </svg>
  );
}
