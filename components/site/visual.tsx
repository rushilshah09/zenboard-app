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

/** The page's lattice: twelve columns on a wide screen; on a phone every cell is a row of its own.
    (It carried a light that followed the pointer along its lines for a day; the user, 2026-09-26:
    "this pink glow on the hairline does not look good". The line is the page's structure, and it
    stays quiet.) */
export function Grid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('relative grid grid-cols-12 gap-px bg-line p-px', className)}>{children}</div>;
}

/** A section whose cells take the grid's own columns, so every line on the page is one line. Its rule
    draws out to the window's edges as it comes into view (`data-reveal="rule"`). */
export function Row({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section data-reveal="rule" {...rest} className={cn('site-row col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px', className)}>
      <Joints />
      {children}
    </section>
  );
}

/** The two joints where a row's top rule crosses the grid's outer rules, drawn as the grid's own star
    (globals.css `.site-joint`). Out of flow, so they take no cell of the row's grid. `foot`: the same
    pair on the grid's bottom edge. */
export function Joints({ foot = false }: { foot?: boolean }) {
  return (
    <>
      <span aria-hidden className="site-joint" data-at="start" data-foot={foot || undefined} />
      <span aria-hidden className="site-joint" data-at="end" data-foot={foot || undefined} />
    </>
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
/** An area's hue, as three custom properties (globals.css). It paints nothing on its own: what
 *  reads it decides whether to be coloured always (`site-tile`) or only while showing
 *  (`site-feature-tile`). */
export const HUE: Record<Hue, string> = {
  petal: 'site-hue-petal',
  apricot: 'site-hue-apricot',
  butter: 'site-hue-butter',
  sage: 'site-hue-sage',
  sky: 'site-hue-sky',
  periwinkle: 'site-hue-periwinkle',
};

/** A picture in three layers: its area's gradient, the mark printed over it in light, and the product on top. */
export function Stage({ field, mark, fade, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { field: Field; mark: MarkPlacement; fade?: Fade }) {
  return (
    <Cell {...rest} className={cn('site-field grid place-items-center overflow-hidden p-5 sm:p-10 lg:p-12', FIELD[field], className)}>
      {/* A FINER, SOFTER print on a picture (user, 2026-09-26: "a bit smaller and detailed …
          blend mode … make it subtle"). 10px instead of 14 is about twice the glyphs per area, so
          the mark reads as screened rather than as dots; `soft-light` lets the light sit IN the
          gradient instead of on top of it, which is the difference between a print and a sticker.
          The page's own halftone keeps the coarser pitch and no blending: it has no colour under
          it to sit in. */}
      <Halftone mark={mark} fade={fade} pitch={10} className="[mix-blend-mode:soft-light]" />
      <TrimMarks />
      {/* The product lifts onto its picture as it comes into view; the picture itself is already there. */}
      <div data-reveal="lift" className="relative grid w-full grid-cols-1 place-items-center">{children}</div>
    </Cell>
  );
}

/** A section's name, beside a tile of its colour. */
export function Eyebrow({ hue, icon, children, className, ...rest }: React.HTMLAttributes<HTMLParagraphElement> & { hue: Hue; icon: IconType }) {
  return (
    <p {...rest} className={cn('flex items-center gap-2.5 text-ui font-medium text-ink-800', className)}>
      <span aria-hidden className={cn('site-tile grid size-7 shrink-0 place-items-center rounded-md', HUE[hue])}>
        <Icon icon={icon} size={16} weight="fill" />
      </span>
      {children}
    </p>
  );
}

/** A feature's glyph: filled, 20px, on a tile of its area's colour (or of the card surface, with no hue). */
/**
 * TRIM MARKS — the detail a printed thing has and a rendered one does not (user, 2026-09-26: "add
 * more detailing, but appropriate to the product, don't add forcefully").
 *
 * Every picture on this site is a PRINT: its gradient is screened in the product's own marks, and
 * that is the story the page tells about itself. So the detail it earns is a printer's, not an
 * engineer's — four corner registration marks at the picture's margin, in the same light the print
 * is made of. They say the picture was placed, not pasted.
 *
 * They are not decoration you have to look at: they carry no information and they are gone on a
 * phone, where the margin they mark does not exist. But they ARE meant to be seeable — the first
 * pass set them at 20% of a light that is itself 60% transparent, and measured on the rendered
 * page the corner pixels were identical to the field. A detail nobody can see is not a detail.
 */
function TrimMarks() {
  const CORNERS = [
    'start-4 top-4 border-s border-t',
    'end-4 top-4 border-e border-t',
    'start-4 bottom-4 border-s border-b',
    'end-4 bottom-4 border-e border-b',
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {CORNERS.map((c) => (
        <span
          key={c}
          className={cn('absolute size-4 border-[color-mix(in_oklab,var(--color-illustration-light)_72%,transparent)]', c)}
        />
      ))}
    </span>
  );
}

export function IconTile({ icon, hue, showing, className }: {
  icon: IconType;
  hue?: Hue;
  /** In a list where one item is shown at a time, the tile takes the area's colour only while it
   *  IS the one shown, and is quiet ink otherwise (Calendry's rule; `site-feature-tile`). The
   *  state is read from the ancestor that owns it, so no component has to be told twice. */
  showing?: 'state';
  className?: string;
}) {
  if (showing) {
    return (
      <span aria-hidden className={cn('site-feature-tile grid size-9 shrink-0 place-items-center rounded-md', hue && HUE[hue], className)}>
        {/* Both weights, stacked and cross-faded: outline at rest, filled when it lights up. */}
        <Icon icon={icon} size={20} className="site-glyph-line col-start-1 row-start-1" />
        <Icon icon={icon} size={20} weight="fill" className="site-glyph-fill col-start-1 row-start-1" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-md', hue ? cn('site-tile', HUE[hue]) : 'border border-line bg-surface-raised text-ink-800', className)}
    >
      <Icon icon={icon} size={20} weight="fill" />
    </span>
  );
}
