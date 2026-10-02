'use client';
// ── THE HUB ─────────────────────────────────────────────────────────────────
//
// From the user's design canvas (claude.ai/artifact/Eepb17AWMWrLSfzwMerT1a, "Zenboard hub ·
// everything in one calm place"): twelve features fanning into the mark at the centre, with the
// lines that connect them drawn.
//
// It is the product's own thesis as a picture. Every other section argues a PART — your day, your
// projects, the portal, the money — and this one argues the whole: that they are one place. A
// paragraph claiming "it's all connected" is a claim; a drawing where every line ends at the same
// mark is the thing itself.
//
// ── WHAT CAME ACROSS FROM THE CANVAS, AND WHAT DID NOT ─────────────────────
// The canvas ships as CSS modules and Phosphor icons for a different repo. None of that came: this
// site has Tailwind tokens, its own icon seam and its own lattice. What came is the DESIGN — the
// geometry, the twelve features and their places on a 1440×640 field — and the behaviour, which
// the canvas's own handoff board states precisely and which is guarded below.
//
// THE COLOURS ARE THE SITE'S PLACES (2026-09-29; user: "colours feel like we use them randomly").
// A tile wears the colour of the place it belongs to — the same hue as that place's section, its
// tag and its card in the menu (visual.tsx `CHAPTER`): your day butter, projects sky, the portal
// periwinkle, finance sage. They used to be the ten colours the app gives entities, which was
// correct inside the app and read as a rainbow here, the one section that shows every place at
// once. And the CENTRE is the brand (globals.css "the centre"): the mark's own gradient, berry
// through rose into apricot, painted the way every picture on the page is painted. The places are
// the colours; the thing they all arrive at is Zenboard.
//
// ── HOW IT ADAPTS (the canvas's handoff, verbatim in behaviour) ────────────
//   · 900px and wider — the full fan, a label under every tile;
//   · 760 to 899px — the full fan without labels; the twelve show as chips below;
//   · under 760px — the fan stops shrinking and crops to its centre; the chips list all twelve;
//   · wider than 1600px — the band stays 1600 wide, centred, and the lines fade into the page.
//
// The drawing is hidden from assistive technology and the chips are the readable list, so a screen
// reader gets the headline and twelve names rather than a diagram it cannot see.

import * as React from 'react';
import {
  Calendar, FileText, Flame, Folder, Inbox, Landmark, Link as LinkIcon, ListChecks, SquareCheck,
  Target, Timer, Users, type IconType,
} from '@/components/ds/icons';
import { Icon, Mark } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

import { CHAPTER, Cell, Eyebrow, HUE, Row } from './visual';

/** The field the drawing is composed on. Everything below is a place on it. */
const FIELD = { w: 1440, h: 640 } as const;
/** Where the mark sits, and how wide the fan's mouth is either side of it. */
const HUB = { x: 720, y: 320, left: 666, right: 774 } as const;

/**
 * A feature: what it is called, its glyph, the PLACE it belongs to (whose colour it wears), how big
 * its tile is (nearer the centre is bigger) and where it sits on the field. The places are the
 * product menu's (nav-menu.tsx): Home and Inbox are your day, Docs sits with Projects.
 */
type Place = keyof typeof CHAPTER;
type Feature = { label: string; icon: IconType; place: Place; size: number; x: number; y: number };

const FEATURES: Feature[] = [
  { label: 'Inbox', icon: Inbox, place: 'day', size: 56, x: 247.9, y: 44.9 },
  { label: 'Tasks', icon: SquareCheck, place: 'day', size: 64, x: 393.1, y: 221.5 },
  { label: 'Calendar', icon: Calendar, place: 'day', size: 64, x: 393.1, y: 354.5 },
  { label: 'Focus', icon: Timer, place: 'day', size: 56, x: 261.8, y: 528.6 },
  { label: 'Goals', icon: Target, place: 'day', size: 52, x: 93.9, y: 248.9 },
  { label: 'Habits', icon: Flame, place: 'day', size: 52, x: 58, y: 405.2 },
  { label: 'Docs', icon: FileText, place: 'projects', size: 56, x: 1150.3, y: 97.1 },
  { label: 'Projects', icon: Folder, place: 'projects', size: 64, x: 989, y: 189.4 },
  { label: 'Client portal', icon: LinkIcon, place: 'portal', size: 64, x: 1001.4, y: 333.3 },
  { label: 'Finance', icon: Landmark, place: 'money', size: 56, x: 1122.2, y: 471.2 },
  { label: 'Clients', icon: Users, place: 'portal', size: 52, x: 1311.8, y: 248 },
  { label: 'Forms', icon: ListChecks, place: 'portal', size: 52, x: 1243.5, y: 531.4 },
];
/** The class that puts a place's colour in scope (`--site-hue`, `--site-hue-ink`: globals.css). */
const hueOf = (f: { place: Place }) => HUE[CHAPTER[f.place]];

/**
 * THE FAN. Thirteen lines each side, leaving the mark 2.6px apart and spreading to these thirteen
 * heights at the field's edge. Generated rather than listed: twenty-six hand-written cubics is a
 * table nobody can check, and the shape is one rule — leave the hub level, bend once, arrive flat.
 */
const SPREAD = [-150, -54.2, 36.9, 122.4, 201, 269.9, 320, 370.1, 439, 517.6, 603.1, 694.2, 790];
const START = HUB.y - ((SPREAD.length - 1) / 2) * 2.6;

function fan(side: 'left' | 'right') {
  const from = side === 'left' ? HUB.left : HUB.right;
  const bend = side === 'left' ? 420 : 1020;
  const turn = side === 'left' ? 300 : 1140;
  const edge = side === 'left' ? -80 : 1520;
  return SPREAD.map((to, i) => {
    const y = +(START + i * 2.6).toFixed(1);
    return `M${from} ${y}C${bend} ${y} ${turn} ${to} ${edge} ${to}`;
  });
}
const LINES = { left: fan('left'), right: fan('right') };

/**
 * WHAT TRAVELS, AND WHERE IT COMES FROM (rewritten 2026-09-27 on the user's brief: "the dots go
 * random — I want each dot a specific colour, and starting behind its icon; Calendar is orange, so
 * one orange dot starts behind Calendar").
 *
 * Before this, four NEUTRAL dots rode four arbitrary fan lines. The fan is generated to thirteen
 * even heights at the field's edge and has nothing to do with where the twelve tiles sit, so a dot
 * came from nowhere in particular and was the colour of the lattice. The picture said "things move"
 * where it should say "YOUR inbox, YOUR calendar, YOUR money arrive here".
 *
 * So every feature now feeds the hub down a line of its own, carrying ITS colour — the same token
 * its records wear inside the product. The feed starts at the tile's centre, which is BEHIND the
 * tile: the tiles are HTML and paint after this svg, so a dot is hidden until it has left, and it
 * ends under the mark, which paints after it too. It is absorbed rather than stopped.
 *
 * FOUR AT A TIME, STILL. Twelve dots all travelling would be the swarm the canvas forbids. Each
 * one travels for barely a third of its cycle and rests the remainder, and the twelve are dealt
 * across the cycle, so about four are ever in flight (12 × 0.34 ≈ 4). The cycles differ slightly
 * so they drift apart instead of marching. The negative delay is what stops all twelve queueing at
 * the tiles on first paint — each opens part-way through its own cycle.
 */
/**
 * WHICH FAN LINE A TILE FEEDS DOWN, and where on it its dot starts.
 *
 * The version before this drew every tile its OWN curve into the mark, so that a dot had a path
 * under it instead of floating in empty space. That fixed one fault and introduced a worse one:
 * twelve new curves crossing the twenty-six the fan already draws, at angles the fan never uses.
 * The user saw it at once — "so noisy, overlapping lines". Drawing a line to explain a dot is the
 * wrong trade in a picture whose whole quality is its calm.
 *
 * So NOTHING new is drawn. Each tile is matched to the fan line that already passes nearest it, and
 * its dot rides that line inward from the point closest to the tile. The lattice is untouched; the
 * dots simply belong to it now.
 *
 * Sampled rather than solved: x is monotonic along these curves but t is not proportional to arc
 * length, and `offset-distance` is a percentage of LENGTH. Walking the curve yields both the
 * nearest point and the length to it, which is the number the animation needs.
 */
type Sample = { x: number; y: number; len: number };

function walk(d: string): Sample[] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const at = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    };
  };
  const out: Sample[] = [{ ...at(0), len: 0 }];
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= 240; i++) {
    const q = at(i / 240);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    out.push({ ...q, len });
    prev = q;
  }
  return out;
}

const WALKED = { left: LINES.left.map(walk), right: LINES.right.map(walk) };

/** The fan line nearest this tile, and how far along it (0-1) the tile sits. */
function feed(f: Feature) {
  const cx = f.x + f.size / 2, cy = f.y + f.size / 2;
  const side: 'left' | 'right' = cx < HUB.x ? 'left' : 'right';
  let best = { line: 0, at: 1, dist: Infinity };
  WALKED[side].forEach((samples, line) => {
    const total = samples[samples.length - 1].len;
    for (const s of samples) {
      const dist = Math.hypot(s.x - cx, s.y - cy);
      if (dist < best.dist) best = { line, at: s.len / total, dist };
    }
  });
  return { d: LINES[side][best.line], from: best.at };
}

const FEEDS = FEATURES.map((f, i) => {
  const { d, from } = feed(f);
  return {
    label: f.label,
    place: f.place,
    d,
    /** Where the tile sits along that line. The dot runs from here to the mark, so it still leaves
     *  from behind its own tile — on a line that was always in the drawing. */
    from: `${(from * 100).toFixed(1)}%`,
    seconds: 8.4 + (i % 5) * 0.6,
    delay: -(i * 0.78),
  };
});

/** The three feeds whose arrivals the mark answers, spread around the fan so the pulses do not
 *  cluster on one side. A dot lands at 34% of its cycle (see `hub-feed`), so the ripple starts
 *  there and is over well before the next one — no two ripples from one feed are ever in flight.
 *  Every ripple is the centre's own colour leaving it (globals.css `.hub-ripple`). */
const RIPPLES = [0, 4, 8].map((i) => ({ seconds: FEEDS[i].seconds, delay: FEEDS[i].delay + FEEDS[i].seconds * 0.34 }));

/** One feature's tile: its glyph on a wash of its place's colour, with its name under it. */

function Tile({ f, feed }: { f: Feature; feed?: { seconds: number; delay: number } }) {
  return (
    <span
      className={cn('hub-tile absolute', hueOf(f))}
      style={{
        left: `${(f.x / FIELD.w) * 100}%`,
        top: `${(f.y / FIELD.h) * 100}%`,
        width: `${(f.size / FIELD.w) * 100}%`,
      }}
    >
      {/* The tile answers as its dot LEAVES it, on that dot's own clock — so the pulse is the cause
          of the journey rather than a second animation that happens to be running nearby. */}
      <span
        className="hub-tile-box hub-depart grid aspect-square w-full place-items-center rounded-[28%]"
        style={feed ? { animationDuration: `${feed.seconds}s`, animationDelay: `${feed.delay}s` } : undefined}
      >
        <Icon icon={f.icon} size={20} weight="fill" className="w-[45%] text-[var(--site-hue-ink)]" />
      </span>
      {/* The label sits ON the page's ground, so a line passing behind it is cut cleanly rather
          than crossing the word. The canvas draws it fully rounded; the house's corner is the
          square one, and it is the same idea either way. */}
      <span className="hub-tile-label absolute start-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded-md bg-background px-2 text-small font-medium text-ink-600">
        {f.label}
      </span>
    </span>
  );
}

export function HubSection() {
  return (
    <Row id="everything" aria-labelledby="hub-title" className="site-hue-neutral">
      <Cell pad className="overflow-hidden pb-0 pt-16 sm:pt-20 lg:pt-28">
        {/* Centred, so its title and lede sit 32 apart rather than 24: a centred block has no left
            edge to hold it together, and the extra air is what keeps it one group (the type canvas). */}
        <div className="site-reveal relative z-[1] flex flex-col items-center text-center">
          <Eyebrow hue="neutral" icon={Folder}>Everything in Zenboard</Eyebrow>
          <h2 id="hub-title" className="mt-6 max-w-[20ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline">
            Everything you run, <span className="text-site-second">in one calm place.</span>
          </h2>
          <p className="mt-8 max-w-[540px] text-lead leading-6 text-ink-600">
            Your day, your projects, your clients and your money live together, so nothing falls between apps.
          </p>
        </div>

        {/* THE DRAWING. Hidden from assistive technology: the list below it is the readable form,
            and a diagram read aloud is twelve positions nobody asked for. */}
        <div aria-hidden className="hub-stage mx-auto -mt-8 sm:-mt-12 lg:-mt-16">
          <div className="hub-field relative mx-auto">
            <span className="hub-glow absolute" />
            {/* THE RIPPLE. Three soft bands leaving the mark on one long cycle, a third of it
                apart, so one is always on its way out and no frame reads as a "start". They live
                inside a MASKED layer: the stage is pulled up under the lede, so a ripple free to
                expand would run through the words — the mask makes that impossible by construction
                rather than by choosing numbers that happen to miss. */}
            {/* THE RIPPLE ANSWERS AN ARRIVAL (user, 2026-09-28: "ripple active when dots touch the
                Zenboard icon"). Three of them, and each one rides a real feed's clock: a dot
                crosses in the first 34% of its cycle, so a ripple on that same duration, delayed by
                that same 34%, breaks exactly as its dot lands. That is the difference between a
                decoration on a timer and the mark REACTING — and it is why the three are tied to
                three different feeds rather than to thirds of an arbitrary cycle.

                AND IT IS THE CENTRE'S OWN COLOUR (user, 2026-09-29: "make it in brand … more
                cohesive"): the tile's gradient going out into the room along the tile's own light,
                so whatever arrives, what answers it is Zenboard. */}
            <span aria-hidden className="hub-ripples">
              {RIPPLES.map((r, i) => (
                <span key={i} className="hub-ripple absolute"
                  style={{ animationDuration: `${r.seconds}s`, animationDelay: `${r.delay}s` }} />
              ))}
            </span>

            <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} className="hub-lines absolute inset-0 size-full overflow-visible">
              <g fill="none" strokeWidth="1" className="stroke-[var(--site-hue-ink)] opacity-50">
                {LINES.left.map((d, i) => <path key={`l${i}`} id={`hub-l${i}`} d={d} />)}
                {LINES.right.map((d, i) => <path key={`r${i}`} id={`hub-r${i}`} d={d} />)}
              </g>
              {/* What travels them. `offset-path` rather than SMIL, so the browser composites it
                  and `prefers-reduced-motion` can stop it in CSS. */}
            </svg>

            {/* THE FEEDS, in their own svg because the lattice above wears an edge mask and these
                must not: a dot's fade is its keyframe's business, and Habits sits at 4% of the
                field where that mask would have swallowed it whole. */}
            <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} className="hub-feeds absolute inset-0 size-full overflow-visible">
              {FEEDS.map((f) => (
                <g
                  key={f.label}
                  className={cn('hub-feed', hueOf(f))}
                  style={{
                    offsetPath: `path("${f.d}")`,
                    ['--hub-from' as string]: f.from,
                    animationDuration: `${f.seconds}s`,
                    animationDelay: `${f.delay}s`,
                  }}
                >
                  {/* Two circles: the light the dot casts on the line, and the dot. A single flat
                      disc is the "basic" the user saw — this is what gives it a body. */}
                  <circle r="7" className="hub-feed-halo" />
                  <circle r="3" className="hub-feed-dot" />
                  <circle r="1.1" className="hub-feed-core" />
                </g>
              ))}
            </svg>

            {/* THE CENTRE: the brand's own picture (user, 2026-09-29: "make it in brand, make it
                look properly designed"). The tile is painted in the pictures' recipe in the mark's
                arc, two soft lights drift over it at different speeds and in opposite directions,
                so the colour moves through itself while the tile never turns, and the grain every
                picture has sits over the paint and under the mark. */}
            <span className="hub-mark absolute grid place-items-center">
              <span aria-hidden className="hub-paint hub-paint-a" />
              <span aria-hidden className="hub-paint hub-paint-b" />
              <span aria-hidden className="site-grain" />
              {/* `style`, not a class: `Mark` paints itself with an inline `color`, and an
                  inline style beats a class. `--hub-mark-ink` is the illustrations' light, which
                  holds on every part of the painted tile. */}
              <Mark size={48} className="hub-mark-glyph relative h-auto w-[48%]" style={{ color: 'var(--hub-mark-ink)' }} />
            </span>

            {FEATURES.map((f, i) => <Tile key={f.label} f={f} feed={FEEDS[i]} />)}
          </div>
        </div>

        {/* THE TWELVE, AS WORDS. Below 900px this is what the section is; above it, it is what a
            screen reader gets. One list either way, so the two cannot disagree. */}
        <ul className="hub-chips mx-auto mt-8 flex max-w-[44rem] flex-wrap justify-center gap-2 pb-14 sm:pb-16 lg:pb-20">
          {FEATURES.map((f) => (
            <li
              key={f.label}
              className={cn('hub-chip flex items-center gap-2 rounded-md px-2.5 py-1.5 text-small text-ink-800', hueOf(f))}
            >
              <Icon icon={f.icon} size={14} weight="fill" className="text-[var(--site-hue-ink)]" />
              {f.label}
            </li>
          ))}
        </ul>
      </Cell>
    </Row>
  );
}
