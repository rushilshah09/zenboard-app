// ── THE WEBSITE'S VISUAL PARTS ──────────────────────────────────────────────
//
// The small set the whole website is laid out with (globals.css, "the website's visual layer"):
//
//   · Grid, Row, Cell: THE MARK IS THE GRID. Rounded cells tiled edge to edge, the page's line in the
//     pixel between them; where four cells meet, their corners leave the concave star at the heart of
//     the Zenboard mark. A Row is a section whose cells take the grid's own columns (subgrid), so a
//     line that runs down one section runs on down the next, and the stars land where they meet;
//   · Stage: a picture in three layers: a gradient of its area's colours, the mark printed over it in
//     light, and the product's cards lying on top, lifted;
//   · Eyebrow: a section's name beside a tile of its colour;
//   · IconTile: a feature's glyph, filled, on a tile of its area's colour, at a size read from arm's
//     length rather than from a menu.

import * as React from 'react';
import { type IconType } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { Halftone, type Fade, type MarkPlacement } from './halftone';

/** The page's lattice: twelve columns on a wide screen; on a phone every cell is a row of its own. */
export function Grid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid grid-cols-12 gap-px bg-line p-px', className)}>{children}</div>;
}

/** A section whose cells take the grid's own columns, so every line on the page is one line. */
export function Row({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={cn('col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px', className)}>
      {children}
    </section>
  );
}

/** One cell: the page's own ground with its corners rounded, which is what makes the joints stars. */
export function Cell({ className, pad = false, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return (
    <div {...rest} className={cn('relative col-span-full min-w-0 rounded-lg bg-background', pad && 'site-pad', className)}>
      {children}
    </div>
  );
}

/** The gradient a picture stands on: one per part of the page (globals.css `.site-field-*`). */
export type Field = 'hero' | 'how' | 'day' | 'projects' | 'portal' | 'money';
/** A tile's colour: one of the illustration fields, with that field's own deep ink for the glyph. */
export type Hue = 'petal' | 'apricot' | 'butter' | 'sage' | 'sky' | 'periwinkle';

const FIELD: Record<Field, string> = {
  hero: 'site-field-hero',
  how: 'site-field-how',
  day: 'site-field-day',
  projects: 'site-field-projects',
  portal: 'site-field-portal',
  money: 'site-field-money',
};
const TILE: Record<Hue, string> = {
  petal: 'site-tile-petal',
  apricot: 'site-tile-apricot',
  butter: 'site-tile-butter',
  sage: 'site-tile-sage',
  sky: 'site-tile-sky',
  periwinkle: 'site-tile-periwinkle',
};

/** A picture in three layers: its area's gradient, the mark printed over it in light, and the product on top. */
export function Stage({ field, mark, fade, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { field: Field; mark: MarkPlacement; fade?: Fade }) {
  return (
    <Cell {...rest} className={cn('site-field grid place-items-center overflow-hidden p-5 sm:p-10 lg:p-12', FIELD[field], className)}>
      <Halftone mark={mark} fade={fade} />
      <div className="relative grid w-full grid-cols-1 place-items-center">{children}</div>
    </Cell>
  );
}

/** A section's name, beside a tile of its colour. */
export function Eyebrow({ hue, icon, children, className }: { hue: Hue; icon: IconType; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2.5 text-ui font-medium text-ink-800', className)}>
      <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-md', TILE[hue])}>
        <Icon icon={icon} size={16} weight="fill" />
      </span>
      {children}
    </p>
  );
}

/** A feature's glyph: filled, 20px, on a tile of its area's colour (or of the card surface, with no hue). */
export function IconTile({ icon, hue, className }: { icon: IconType; hue?: Hue; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-md', hue ? TILE[hue] : 'border border-line bg-surface-raised text-ink-800', className)}
    >
      <Icon icon={icon} size={20} weight="fill" />
    </span>
  );
}
