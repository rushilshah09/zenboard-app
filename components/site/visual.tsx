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
import { Sheen } from './sheen';

/** The page's lattice: twelve columns on a wide screen; on a phone every cell is a row of its own.
    (It carried a light that followed the pointer along its lines for a day; the user, 2026-09-26:
    "this pink glow on the hairline does not look good". The line is the page's structure, and it
    stays quiet.) */
export function Grid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('relative grid grid-cols-12 gap-px bg-line p-px', className)}>{children}</div>;
}

/** A section whose cells take the grid's own columns, so every line on the page is one line. Its rule
    draws out to the window's edges as it comes into view (`data-reveal="rule"`). */
export function Row({ className, children, ref, ...rest }: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }) {
  return (
    <section ref={ref} data-reveal="rule" {...rest} className={cn('site-row col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px', className)}>
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

/** One cell: the page's own ground with its corners rounded, which is what makes the joints stars.
 *  `sheen` gives it a light that follows the pointer and a rim that lights with it (sheen.tsx) —
 *  for a cell you CONSIDER, which on this page means the ones you choose between. */
export function Cell({ className, pad = false, sheen = false, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean; sheen?: boolean }) {
  return (
    <div {...rest} className={cn('relative col-span-full min-w-0 rounded-lg bg-background', pad && 'site-pad', sheen && 'zb-sheen-host overflow-hidden', className)}>
      {/* The layers sit at z-index -1 inside the host's own stacking context, which paints them
          above the card's background and below everything in it: the card's own layout is
          untouched and nothing has to be wrapped. */}
      {sheen && <Sheen />}
      {children}
    </div>
  );
}

/** The gradient a picture stands on: one per part of the page (globals.css `.site-field-*`). */
export type Field = 'hero' | 'how' | 'day' | 'projects' | 'portal' | 'money';
/** A tile's colour: one of the illustration fields, with that field's own deep ink for the glyph. */
export type Hue = 'petal' | 'apricot' | 'butter' | 'sage' | 'sky' | 'periwinkle' | 'neutral';

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
  neutral: 'site-hue-neutral',
};

/**
 * THE ONE PLACE A PLACE'S COLOUR IS DECIDED (the colour system, globals.css "the website's colour
 * system"). Each of the product's four places owns one hue, and every part of the site that stands
 * for that place (its menu card, its section's tag, its feature tiles, its person) reads it from
 * here, so the same place can never wear two colours again (Finance was pink in the menu and green
 * on the page). A section that is not one place is `neutral`.
 */
/**
 * THE ILLUSTRATION STAGE — every picture on the site stands on this, and only this.
 *
 * User, 2026-09-28: "the Client Portal section and the Details section have completely different
 * visual treatments. I really like the treatment used in the Client Portal section. Keep that
 * treatment consistent across all illustrations." It was the portal's, so it lived in
 * portal-section.tsx and its classes were called `portal-*`; now it is everyone's, so it lives
 * here and they are called `plot-*`. A name that says where a thing was born is how the second
 * copy gets written.
 *
 * The treatment is two things: a DOTTED GROUND, masked to an ellipse so it has no edge to end on,
 * and optionally the area's hue blooming behind whatever the picture is about. The drawing sits on
 * top. `label` makes the picture meaningful to a screen reader; without one it is decorative and
 * is hidden, which is the right answer for a drawing whose card already says the same thing.
 */
export function Plot({ label, glow, story, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & {
  label?: string;
  /** Bloom the area's hue behind the drawing. */
  glow?: boolean;
  /** The picture tells a story on a loop (use-story.ts), so it is a LOOPED picture and its cards do
   *  not fan under the pointer: a picture is looped or interactive, never both. */
  story?: boolean;
  /** The story's clock watches the stage (React 19 passes `ref` as a prop). */
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      // `...rest` and not a fixed prop list: the stage has to carry `data-reveal` through, and a
      // component that silently swallows it breaks the section's choreography with no error.
      {...rest}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={cn('relative min-h-0', className)}
    >
      {/* WHAT REACTS IS THE CARDS, not the picture. A hover parallax that leaned the whole drawing
          against the ground shipped here for about an hour, and the user named it exactly: "on
          hover the entire illustration is dancing". It failed Emil's second test — moving every
          plane together has no purpose, it is a slide, not depth. The reaction lives in CSS on the
          cards inside instead (globals.css, "a stack of cards fans"), which is cheaper, runs off
          the main thread, and says something: there are more of these than you can see. */}
      <span className="plot-life absolute inset-0" data-story={story || undefined}>
        <span aria-hidden className="plot-ground absolute inset-0" />
        {glow && <span aria-hidden className="plot-glow absolute inset-[18%]" />}
        {children}
      </span>
    </div>
  );
}

export const CHAPTER = { day: 'butter', projects: 'sky', portal: 'periwinkle', money: 'sage' } as const satisfies Record<string, Hue>;

/** THE GRAIN over a picture. It was five blurred colour shapes and a grain; six pastels blurred
    together average to grey, which is what the user was looking at when they said the gradients
    "look so bad in black and white" (2026-09-26). The colour is now the field's own two-anchor
    background (globals.css "the pictures") and this layer is only what stops
    a wash that wide from banding. `flip` mirrors it, for a picture on the other side. */
export function Mesh({ flip = false }: { flip?: boolean }) {
  return (
    <span aria-hidden className="site-mesh" data-flip={flip || undefined}>
      <span className="site-grain" />
    </span>
  );
}

/** A picture in the one recipe (globals.css "the pictures"): its chapter's arc painted edge to edge,
    the mark printed over it in light, and the product on top. */
export function Stage({ field, mark, fade, flip, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { field: Field; mark: MarkPlacement; fade?: Fade; flip?: boolean }) {
  return (
    <Cell {...rest} className={cn('site-field grid place-items-center overflow-hidden p-5 sm:p-10 lg:p-12', FIELD[field], className)}>
      <Mesh flip={flip} />
      {/* THE PRINT TAKES THE FIELD'S COLOUR THROUGH THE BLEND, which is the whole trick in the
          user's reference (2026-09-26): its glyphs are red over the amber and blue over the
          lavender, and they are all ONE ink. `overlay` is what does that — it darkens under a dark
          ink and lightens under a light one, and carries the backdrop's hue either way. So the
          screen is black and white, exactly as asked, and comes out in the picture's colours
          (`site-screen`). The pitch is the reference's: a dense screen, 7px between glyphs. */}
      <Halftone mark={mark} fade={fade} pitch={7} className="site-screen" />
      <TrimMarks />
      {/* The product lifts onto its picture as it comes into view; the picture itself is already there. */}
      <div data-reveal="lift" className="relative grid w-full grid-cols-1 place-items-center">{children}</div>
    </Cell>
  );
}

/** A section's name, as a tag in its colour: the tile inset in a wash of the same hue (globals.css
    `.site-tag`). */
export function Eyebrow({ hue, icon, children, className, ...rest }: React.HTMLAttributes<HTMLParagraphElement> & { hue: Hue; icon: IconType }) {
  return (
    <p {...rest} className={cn('site-tag text-body-lg font-medium', HUE[hue], className)}>
      <span aria-hidden className="site-tile grid size-7 shrink-0 place-items-center rounded-md">
        <Icon icon={icon} size={16} weight="fill" />
      </span>
      {children}
    </p>
  );
}

/**
 * A CARD'S TITLE WITH ITS LINE (the type canvas, 2026-09-28, measured on Ramp): one run of 18/24
 * type, the title in ink and the line after it in the card's second tone, so what a card is and why
 * it matters read as one sentence at two volumes rather than a bold label over small print.
 *
 * The second tone here is `ink-500`, NOT the title's `--site-second`: this is 18px, where text must
 * clear 4.5:1, and ink-500 does on the ground and on a card (5.6:1 and 6.1:1). The title stays the
 * card's heading, its own element set inline, so the outline of the page is unchanged.
 */
export function CardLine({ title, body, as: Heading = 'h3', className }: { title: string; body: string; as?: 'h3' | 'p'; className?: string }) {
  return (
    <div className={cn('text-h3 leading-6', className)}>
      <Heading className="inline text-ink-900">{title}.</Heading>{' '}
      <p className="inline text-ink-500">{body}</p>
    </div>
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
