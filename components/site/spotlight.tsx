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
import { Dwell, useAutoAdvance } from './use-auto-advance';
import { Cell, Eyebrow, IconTile, Stage, type Field, type Hue } from './visual';

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
  title: string;
  features: Feature[];
  /** The lobe of the mark its stage is printed with. */
  mark: MarkPlacement;
  flip?: boolean;
}) {
  // Destructured on purpose: reading a field off the object that also holds the ref reads, to the
  // React Compiler's rules, as reading the ref during render.
  const { ref, active, auto, running, choose, next, stop, hold } = useAutoAdvance(features.length);

  return (
    <RT.Root asChild value={String(active)} onValueChange={(v) => choose(Number(v))} orientation="vertical">
      <section
        id={id}
        ref={ref}
        aria-labelledby={`${id}-title`}
        data-running={running}
        {...hold}
        className="col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px"
      >
        <Cell pad className={cn('flex flex-col justify-center py-14 sm:py-16 lg:col-span-6 lg:py-20', flip && 'lg:order-2')}>
          <div className="site-reveal">
            <Eyebrow hue={hue} icon={icon}>{name}</Eyebrow>
            <h2 id={`${id}-title`} className="mt-6 max-w-[15ch] text-balance font-editorial text-h1 text-ink-900 sm:text-headline">{title}</h2>

            <RT.List aria-label={`${name}: what it does`} className="mt-10 flex flex-col border-t border-line">
              {features.map((f, i) => (
                <RT.Trigger
                  key={f.title}
                  value={String(i)}
                  className="focus-ring group relative flex items-start gap-4 border-b border-line py-3.5 text-start transition-colors duration-fast ease-hover data-[state=inactive]:hover:bg-surface-hover lg:py-5"
                >
                  <IconTile icon={f.icon} hue={hue} />
                  {/* The title's first line centres on the tile; the description hangs from the title, not from the tile. */}
                  <span className="min-w-0 flex-1 pt-[7px]">
                    <span className="block text-body-lg font-medium leading-snug text-ink-500 transition-colors duration-fast ease-hover group-data-[state=active]:text-ink-900">{f.title}</span>
                    <span className="mt-1.5 block max-w-[46ch] text-ui leading-relaxed text-ink-500 group-data-[state=active]:text-ink-600 max-lg:hidden">{f.body}</span>
                  </span>
                  {i === active && auto && <Dwell onEnd={next} />}
                </RT.Trigger>
              ))}
            </RT.List>
          </div>
        </Cell>

        {/* Pressing inside a picture means the reader is using it: stop turning the pages under them. */}
        <Stage field={field} mark={mark} onPointerDown={stop} className={cn('min-h-[28rem] sm:min-h-[36rem] lg:col-span-6', flip && 'lg:order-1')}>
          {features.map((f, i) => (
            <RT.Content
              key={f.title}
              value={String(i)}
              forceMount
              inert={i !== active}
              className={cn(
                'col-start-1 row-start-1 grid w-full grid-cols-1 place-items-center rounded-2xl transition-[opacity,translate] duration-slow ease-out-quiet focus-visible:outline-none',
                i === active ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
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
