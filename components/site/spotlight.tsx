'use client';
// ── A PRODUCT AREA ──────────────────────────────────────────────────────────
//
// One row of the page's grid, two cells side by side: the area's name, a claim and what it does; and
// the product doing it, on a picture in three layers (the area's gradient, the mark printed over it in
// light, the product's cards on top). The areas alternate sides down the page, and all of them split
// the grid at the same column, so the line between the two cells runs straight down through every area
// and the joints on it are whole stars.
//
// The list is a real tab set (Radix Tabs, vertical): arrow keys move, each picture is labelled by its
// item, and it turns its own pages until the reader touches it (use-auto-advance.tsx).
//
// Every description is always shown (inactive ones quieter), so the list never changes height as the
// selection moves: an expanding item would push the whole column around every six seconds. On a phone
// the picture is below the list rather than beside it, so the list keeps only its titles, four short
// rows that put the picture on the same screen as the item that chose it, and the chosen item's words
// move under the picture, in a caption two lines tall whatever it says.

import * as React from 'react';
import { Tabs as RT } from 'radix-ui';
import { type IconType } from '@/components/ds/icons';
import { cn } from '@/lib/cn';
import { type MarkPlacement } from './halftone';
import { DwellLine, useAutoAdvance } from './use-auto-advance';
import { Cell, Eyebrow, HUE, IconTile, Joints, Stage, type Field, type Hue } from './visual';
import { Title } from './words';

export type Feature = {
  title: string;
  body: string;
  icon: IconType;
  /** The picture; told whether it is the one showing, so a live picture only runs while seen. */
  visual: (showing: boolean) => React.ReactNode;
};

export function Spotlight({
  id, field, hue, icon, name, title, features, mark, flip = false,
}: {
  id: string;
  /** The gradient its picture stands on, and the colour of its tiles. */
  field: Field;
  hue: Hue;
  icon: IconType;
  name: string;
  /** The claim, and its second clause in the quieter tone (words.tsx `Title`). */
  title: [string, string];
  features: Feature[];
  /** The lobe of the mark its stage is printed with. */
  mark: MarkPlacement;
  flip?: boolean;
}) {
  // Destructured on purpose: reading a field off the object that also holds the ref reads, to the
  // React Compiler's rules, as reading the ref during render.
  const { ref, active, running, choose, next, stop, hold } = useAutoAdvance(features.length);

  return (
    <RT.Root asChild value={String(active)} onValueChange={(v) => choose(Number(v))} orientation="vertical">
      <section
        id={id}
        ref={ref}
        aria-labelledby={`${id}-title`}
        data-running={running}
        data-reveal="rule"
        {...hold}
        className="site-row col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px"
      >
        <Joints />
        <Cell pad className={cn('site-head flex flex-col justify-center lg:col-span-6', flip && 'lg:order-2')}>
          {/* Arrives as one sentence: the area's name, its heading a word at a time, then its list. */}
          <div data-reveal-group>
            <Eyebrow hue={hue} icon={icon} data-reveal="rise">{name}</Eyebrow>
            <h2 id={`${id}-title`} data-reveal="words" className="mt-6 max-w-[16ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline"><Title then={title[1]}>{title[0]}</Title></h2>

            {/* The area's hue is set ONCE, here: the tile below takes it only while its row is the
                one showing, and the rule that times the row is the same hue at ink strength. */}
            <RT.List aria-label={`${name}: what it does`} className={cn('mt-12 flex flex-col border-t border-line lg:mt-16', HUE[hue])}>
              {features.map((f, i) => (
                <RT.Trigger
                  key={f.title}
                  value={String(i)}
                  data-reveal="rise"
                  // No fill on hover (user, 2026-09-26: "this grey patch looks so bad, I want only the text
                  // and content to highlight"): the words and the glyph darken, nothing else changes.
                  className="focus-ring group relative flex items-start gap-4 rounded-xs border-b border-line py-4 text-start lg:py-6"
                >
                  <IconTile icon={f.icon} hue={hue} showing="state" />
                  {/* The title's first line centres on the tile (a 28px line beside a 36px tile); the
                      description hangs from the title, not from the tile. The title is in the titling
                      face and at a size that holds its own beside the tile (user, 2026-09-26: "increase
                      the title, use Rubik, it looks so small next to the icon"). */}
                  <span className="min-w-0 flex-1 pt-1">
                    <span className="block font-editorial text-title-3 font-medium text-ink-500 transition-colors duration-[var(--site-hover)] ease-hover group-hover:text-ink-800 group-data-[state=active]:text-ink-900">{f.title}</span>
                    <span className="mt-2 block max-w-[416px] text-body-lg text-ink-500 transition-colors duration-[var(--site-hover)] ease-hover group-hover:text-ink-600 group-data-[state=active]:text-ink-600 max-lg:hidden">{f.body}</span>
                  </span>
                  {/* These rows are DRAWN with a bottom rule, so the rule is the timer: filling
                      it is one mark, where a box round the tile would be a second. */}
                  {i === active && <DwellLine onEnd={next} />}
                </RT.Trigger>
              ))}
            </RT.List>
          </div>
        </Cell>

        {/* Pressing inside a picture means the reader is using it: stop turning the pages under them. */}
        <Stage field={field} mark={mark} flip={flip} onPointerDown={stop} className={cn('min-h-[28rem] sm:min-h-[36rem] lg:col-span-6', flip && 'lg:order-1')}>
          {features.map((f, i) => (
            <RT.Content
              key={f.title}
              value={String(i)}
              forceMount
              inert={i !== active}
              className={cn(
                // One picture gives way to the next through a little blur and scale, at the site's
                // pace: a cross-fade that reads as one thing changing, not two swapping.
                'col-start-1 row-start-1 grid w-full grid-cols-1 place-items-center rounded-2xl transition-[opacity,translate,scale,filter] duration-[var(--site-swap)] ease-out-quiet focus-visible:outline-none',
                i === active ? 'opacity-100' : 'pointer-events-none translate-y-3 scale-[0.985] opacity-0 blur-[6px]',
              )}
            >
              {f.visual(i === active)}
            </RT.Content>
          ))}
          <p key={active} className="site-swap col-start-1 row-start-2 mt-6 min-h-10 w-full text-ui text-ink-600 lg:hidden">{features[active].body}</p>
        </Stage>
      </section>
    </RT.Root>
  );
}
