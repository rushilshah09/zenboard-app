// ── ILLUSTRATIONS ──────────────────────────────────────────────────────────
//
// Zenboard's illustrations are drawn in ONE style (brand/illustrations/style.json): black ink, paper-white
// shapes, one flat field colour, and the Zenboard mark in berry exactly once, on the thing that matters.
// This is the one place the app draws them, so size, corners, outline and accessibility are decided once.
//
// Where they go is deliberate and short (brand/illustrations/README.md): moments, edges and the
// client-facing pages. Never an empty state (a 20px icon — CLAUDE.md rule 4), never sign-in or
// onboarding (they show the live product), never a working screen.
//
// The art is a transparent SVG in /public; the FIELD is painted here, from a token. That keeps one
// drawing usable at any aspect ratio, and keeps a picture looking the same in light and dark — a
// picture does not change with the theme. Only its hairline does: 10% black on light, 10% white on
// dark, so the tile's edge stays crisp against either ground.

import * as React from 'react';
import { cn } from '@/lib/cn';

export type IllustrationField = 'petal' | 'apricot' | 'butter' | 'sage' | 'sky' | 'periwinkle' | 'sand' | 'mist';

/** Written out in full so Tailwind can see every class. */
const FIELD_BG: Record<IllustrationField, string> = {
  petal: 'bg-field-petal',
  apricot: 'bg-field-apricot',
  butter: 'bg-field-butter',
  sage: 'bg-field-sage',
  sky: 'bg-field-sky',
  periwinkle: 'bg-field-periwinkle',
  sand: 'bg-field-sand',
  mist: 'bg-field-mist',
};

/** Every illustration the app ships, by name. The id is the one in brand/illustrations. */
export const ILLUSTRATIONS = {
  'day-planned': { id: 'ZB-01', src: '/illustrations/zb-01-day-planned.svg', field: 'butter' },
} as const satisfies Record<string, { id: string; src: string; field: IllustrationField }>;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const art = ILLUSTRATIONS[name];
  return (
    <div
      // Decorative: the words beside it carry the meaning, so a screen reader skips the picture.
      aria-hidden
      data-illustration={art.id}
      className={cn(
        'relative aspect-[3/2] w-full overflow-hidden rounded-lg',
        'outline-1 -outline-offset-1 outline-edge-image',
        FIELD_BG[art.field],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG: nothing for next/image to optimise */}
      <img src={art.src} alt="" draggable={false} className="absolute inset-[10%] size-[80%] object-contain" />
    </div>
  );
}
