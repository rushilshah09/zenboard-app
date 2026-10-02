'use client';
// ── THE DETAILS ─────────────────────────────────────────────────────────────
//
// The small things that add up, each on a card of its own: a real feature, named the way the app
// names it, and drawn by the user's illustration board.
//
// THE DRAWINGS ARE THE BOARD'S, EXACTLY (user, 2026-09-27: "use these exact same illustrations …
// arrange them in a 3 × 2 grid … all 6 should always have animation … do not change anything").
// They come from `board-scenes.tsx`, the board's own markup and values, and they sit in a plain 3 × 2
// grid: six features of equal weight, so six cells of equal size, where the row before was a bento
// with the palette twice the size of the rest. Every drawing loops on the board's own motion.
//
// What the row gave up for it: four of the cards used to be small demos (the palette took keys, the
// timer counted, the calendar card had a button, the import ran). Each of those changed its drawing
// to demonstrate itself, which is the one thing the brief rules out. The product itself, working, is
// the second section of the page.

import * as React from 'react';
import { Calendar as CalendarIcon, Keyboard, Mail, Plug, Search, Timer, type IconType } from '@/components/ds/icons';
import { cn } from '@/lib/cn';
import { BoardCalendar, BoardDigest, BoardFocus, BoardIntegrations, BoardPalette, BoardShortcuts } from './board-scenes';
import { CardLine, Cell, HUE, IconTile, Plot, type Hue } from './visual';

/** One cell of the grid: its glyph, a title that says what it is, a line that says why, and the drawing.
 *
 *  AN ILLUSTRATION IS LOOPED OR INTERACTIVE, NEVER BOTH (user, 2026-09-28: "some animated and some
 *  interactive — animated is continuously on loop, on hover nothing is happening; and interactive
 *  is interactive"). These six LOOP: their drawings run `ib-*` on their own clock (site-board.css),
 *  so the pointer is given nothing to do. The tile used to rotate 6° and scale on card hover, which
 *  is what the user saw as "the entire illustration is dancing" — a drawing already in motion does
 *  not need a second, unrelated motion laid over it when you happen to point at it.
 *
 *  The portal's pictures are the other kind: they hold still and their cards fan under the pointer
 *  (globals.css, "a stack of cards fans"). One rule, two answers. */
function Card({ className, icon, hue, title, body, children }: { className?: string; icon: IconType; hue: Hue; title: string; body: string; children?: React.ReactNode }) {
  return (
    // Its words arrive, then the drawing (each child is `data-reveal="rise"`); the cell does not fade,
    // because a cell fading in shows the grid's line behind it. Under the pointer its tile turns a
    // little toward the reader, the one sign the card is more than a picture.
    <Cell sheen data-reveal-group className={cn('group/card flex flex-col gap-6 p-6 sm:p-8', className)}>
      <div data-reveal="rise" className="flex items-start gap-4">
        <IconTile icon={icon} hue={hue} />
        <CardLine title={title} body={body} className="min-w-0 max-w-[416px] pt-1.5" />
      </div>
      {children}
    </Cell>
  );
}

/** The six, in the board's order, with the board's words. */
/** ONE SECTION, ONE COLOUR (user, 2026-09-28: "in one section we use only one colour for icons,
 *  we don't use multiple colours").
 *
 *  These were `hue="neutral"` six times, which the user read as "too faded"; the first fix walked
 *  the palette's six across the row, which they then read as a fairground. Both notes point the
 *  same way: the section needs colour, and it needs to be ONE. A chapter hue would be a lie here —
 *  these are the parts you use in every chapter, so no chapter owns them — which leaves the brand's
 *  own family, and that is the honest answer for the section about Zenboard's own craft. */
const DETAILS: { icon: IconType; hue: Hue; title: string; body: string; Scene: () => React.ReactElement }[] = [
  { icon: Search, hue: 'petal', title: 'Everything is a few keys away', body: 'The command palette opens with ⌘K. Type, move with the arrow keys, press Enter.', Scene: BoardPalette },
  { icon: Keyboard, hue: 'petal', title: 'Shortcuts you learn once', body: 'The keys follow the words: H highlights, E completes, G then P goes to Projects.', Scene: BoardShortcuts },
  { icon: Timer, hue: 'petal', title: 'Focus mode', body: 'One task on screen, a timer, and nothing else until you come back.', Scene: BoardFocus },
  { icon: CalendarIcon, hue: 'petal', title: 'Your calendar, beside your tasks', body: 'Connect Google Calendar and your meetings sit on the same day as your plan.', Scene: BoardCalendar },
  { icon: Mail, hue: 'petal', title: 'Your day, in your inbox', body: 'A short email each morning: the highlight, the plan, and what is waiting on others.', Scene: BoardDigest },
  { icon: Plug, hue: 'petal', title: 'Bring your work with you', body: 'Import your pages from Notion. Connect an AI assistant through Zenboard’s MCP server.', Scene: BoardIntegrations },
];

/** The cells of the details row: they sit straight in the page's grid (a Row's subgrid), three across
    and two down on a wide screen, two across on a tablet, one on a phone. */
export function Bento() {
  return (
    <>
      {DETAILS.map(({ icon, hue, title, body, Scene }) => (
        <Card key={title} className="md:col-span-6 lg:col-span-4" icon={icon} hue={hue} title={title} body={body}>
          {/* The stage every drawing gets, and now it is the SAME stage the portal's pictures stand
              on (user, 2026-09-28: "keep that treatment consistent across all illustrations") — the
              dotted ground and the area's bloom, from `Plot` in visual.tsx. The board's own 4:3, so
              the row reads as one at every width and a drawing never floats in a stage taller than
              it (a fixed height did, below 1280px). No label: the card's own title already says
              what the drawing shows, and a screen reader does not need it twice. `HUE[hue]` rides
              the stage too, so the bloom behind a drawing is its own card's colour rather than the
              page's fallback accent — the tile and the light behind it agree. */}
          <Plot glow data-reveal="rise" className={cn('mt-auto aspect-[4/3] w-full', HUE[hue])}>
            <Scene />
          </Plot>
        </Card>
      ))}
    </>
  );
}
