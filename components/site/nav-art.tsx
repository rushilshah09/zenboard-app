// ── THE PRODUCT MENU'S DRAWINGS ─────────────────────────────────────────────
//
// The user, 2026-09-26, with two references of cards that each carry a drawing of the product (three
// rows with one chosen, an editor with a caret, a dashboard with a ring): "I want this for navigation,
// large, in our brand, with illustrations related to our branding". Then, of the first attempt: "it
// looks amateur". It was: six grey wells of skeleton bars, a thumbnail each, too small to say
// anything, so they read as placeholders waiting for a picture.
//
// What the references actually do, measured, and what these drawings keep:
//   · ONE small scene per card, drawn at a size you can read: a few crisp surfaces from the product,
//     white, hairline-edged, lifted by a soft shadow, and nothing else;
//   · the scene BLEEDS off the card's edge, so the card crops it like a photograph rather than
//     framing it in a box;
//   · faint dashed guides run through it on the lines its surfaces sit on (a designer's layout
//     guides), fading out before they reach the words;
//   · ONE thing in colour, the brand's, and ONE pointer, in the colour of the area it points into
//     (the same hue as that section's tag on the page), resting on the thing you would press;
//   · under the pointer, the scene is used: the highlight gets ticked, the card lands in its column,
//     the client approves, the invoice is paid. A hover explains the place in one gesture.
//
// ── TWO SETS LIVE HERE (2026-09-27) ────────────────────────────────────────
// The four big scenes below (DayArt, BoardArt, PortalArt, MoneyArt) and the featured ProductArt
// were drawn for a menu of FOUR places at 280×170. The menu was rebuilt from the user's design
// canvas — six places at 418×128 — so those five are not hung anywhere at present; the six
// `…Scene` drawings at the foot of this file are. They are kept rather than deleted because the
// vocabulary is shared and the big ones may earn a place again; nothing else references them.
//
// Pure markup, so it costs no script, and hidden from assistive technology: the card's words say
// where it goes, and this only shows it. The motion is transform and colour only, and none of it
// plays for someone who asked for less motion.

import * as React from 'react';
import { Mark } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

/**
 * THE SCENE'S STORY, IN ORDER (2026-09-27). A card's drawing is a small story — the pointer moves,
 * the thing it presses answers, the consequence lands — and a story needs ORDER. Before this every
 * part of a scene transitioned on the SAME frame: the pointer twitched a pixel at the exact instant
 * the checkbox filled and the badge appeared, so nothing in the drawing appeared to CAUSE anything.
 * It read as "several things changed", which is a state swap, not an explanation.
 *
 * `--site-stagger` (80ms) is the site's own step, already used between two parts of one arrival and
 * between two words of a heading. Emil's range for a stagger is 30-80ms; longer reads as slow.
 *
 * ENTERING staggers, LEAVING does not: the delay only exists under `group-hover`, so a pointer that
 * leaves takes the whole drawing back at once. An exit is quicker than its entrance everywhere here,
 * and a drawing that unwound in sequence would still be moving after the reader had gone.
 */
const STEP = ['', 'group-hover:delay-[var(--site-stagger)]', 'group-hover:delay-[calc(var(--site-stagger)*2)]'] as const;

/** A place in the drawing, in the drawing's own pixels (a picture does not reflow or flip). */
const at = (left: number, top: number, width?: number, height?: number): React.CSSProperties => ({ left, top, width, height });

/** A designer's layout guides: dashed, on the lines the scene's surfaces sit on, fading at both ends
    (globals.css `.site-art-guide`). */
function Guides({ x = [], y = [] }: { x?: number[]; y?: number[] }) {
  return (
    <>
      {x.map((v) => <span key={`x${v}`} className="site-art-guide absolute inset-y-0 border-s border-dashed border-line" style={{ left: v }} />)}
      {y.map((v) => <span key={`y${v}`} className="site-art-guide absolute inset-x-0 border-t border-dashed border-line" data-axis="y" style={{ top: v }} />)}
    </>
  );
}

/** A surface from the product: white, a hairline, a soft lift. `raised` is the one being used. */
function Surface({ style, raised, className, children }: { style: React.CSSProperties; raised?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <span
      style={style}
      className={cn('absolute rounded-md border bg-surface-raised', raised ? 'border-line-strong shadow-md' : 'border-line shadow-xs', className)}
    >
      {children}
    </span>
  );
}

/** A line of text, drawn as its shape. */
const Bar = ({ w, tone = 'soft', className }: { w: number; tone?: 'soft' | 'mid' | 'strong'; className?: string }) => (
  <span
    className={cn('block h-1.5 shrink-0 rounded-xs', tone === 'soft' ? 'bg-ink-100' : tone === 'mid' ? 'bg-ink-200' : 'bg-ink-300', className)}
    style={{ width: w }}
  />
);

/** A task's square checkbox. `ticks`: it fills while the card is pointed at. */
function Check({ done, ticks, step = 0 }: { done?: boolean; ticks?: boolean; step?: 0 | 1 | 2 }) {
  return (
    <span
      className={cn(
        'relative grid size-3 shrink-0 place-items-center rounded-[3px] border',
        done ? 'border-ink-800 bg-ink-800' : 'border-ink-300 bg-surface-raised',
        ticks && 'transition-colors duration-[var(--site-hover)] ease-hover group-hover:border-ink-800 group-hover:bg-ink-800',
        ticks && STEP[step],
      )}
    >
      <svg viewBox="0 0 12 12" className={cn('size-2.5 text-surface-raised', !done && 'opacity-0', ticks && 'transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-100', ticks && STEP[step])}>
        <path d="M3 6.2 5.1 8.2 9 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The pointer, in the colour of the area it points into (`--art-pointer`, globals.css), with a name
 * when WHO is pointing is the point (the client, on her own page). It leans in a pixel while the card
 * is pointed at: the press.
 */
function Pointer({ style, tag, className, to }: { style: React.CSSProperties; tag?: string; className?: string; to?: [number, number] }) {
  // It used to lean in ONE pixel, in both axes, on every card — the comment called that "the press",
  // and at 1px it was indistinguishable from nothing. A pointer that TRAVELS the short distance onto
  // the thing it presses is what makes the rest of the drawing read as its consequence, which is the
  // whole purpose of the scene. `to` is that distance, in the drawing's own pixels; it goes through
  // custom properties because each scene's target sits somewhere different and Tailwind needs a
  // static class. First in the sequence: nothing else moves until the pointer has.
  const [dx, dy] = to ?? [-1, -1];
  return (
    <span style={style} className={cn('absolute flex items-start', className)}>
      <svg
        viewBox="0 0 18 18"
        style={{ '--art-dx': `${dx}px`, '--art-dy': `${dy}px` } as React.CSSProperties}
        className="size-[18px] drop-shadow-sm transition-[translate] duration-[var(--site-hover)] ease-out-quiet motion-safe:group-hover:[translate:var(--art-dx)_var(--art-dy)]"
      >
        <path d="M2.5 1.8 15.4 8 9.6 9.5 7.2 15.3Z" fill="var(--art-pointer)" stroke="var(--color-surface-raised)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {tag && <span className="site-art-tag -ms-0.5 mt-3.5 rounded-sm px-1.5 py-0.5 text-caption font-medium">{tag}</span>}
    </span>
  );
}

/** Your day: three tasks, and the highlight, chosen, being ticked. */
export function DayArt() {
  return (
    <>
      <Guides x={[24, 44]} y={[30, 142]} />
      <Surface style={at(44, 30, 230, 30)} className="flex items-center gap-2.5 px-2.5">
        <Check done /><Bar w={70} /><Bar w={30} />
      </Surface>
      <Surface raised style={at(24, 67, 250, 38)} className="flex items-center gap-2.5 px-3">
        <Check ticks /><Mark size={12} tone="brand" /><Bar w={96} tone="strong" />
      </Surface>
      <Surface style={at(44, 112, 230, 30)} className="flex items-center gap-2.5 px-2.5">
        <Check /><Bar w={80} tone="mid" />
      </Surface>
      <Pointer style={at(150, 88)} />
    </>
  );
}

/** Projects: a board, and a card being carried to the next column. It lands under the pointer. */
export function BoardArt() {
  const card = 'flex flex-col gap-1.5 px-2 py-2';
  return (
    <>
      <Guides x={[26, 142]} y={[24]} />
      {[26, 142].map((left, c) => (
        <span key={left} className="absolute rounded-lg bg-surface-fill" style={at(left, 24, 108, 170)}>
          <span className="absolute flex items-center gap-1.5" style={at(8, 9)}>
            <span className="size-1.5 rounded-full" style={{ background: 'var(--art-pointer)' }} /><Bar w={c ? 44 : 36} tone="strong" />
          </span>
        </span>
      ))}
      <Surface style={at(32, 50, 96, 30)} className={card}><Bar w={62} tone="mid" /><Bar w={40} /></Surface>
      <Surface style={at(32, 86, 96, 30)} className={card}><Bar w={52} tone="mid" /><Bar w={30} /></Surface>
      <Surface style={at(148, 50, 96, 30)} className={card}><Bar w={58} tone="mid" /><Bar w={44} /></Surface>
      {/* Where it will land. */}
      <span className="absolute rounded-md border border-dashed border-ink-300" style={at(148, 86, 96, 30)} />
      {/* The card in the hand: lifted and tilted; under the pointer it travels to its place. */}
      <span
        className="absolute transition-[translate,rotate] duration-[var(--site-swap)] ease-standard [rotate:-5deg] motion-safe:group-hover:translate-x-[36px] motion-safe:group-hover:-translate-y-[30px] motion-safe:group-hover:[rotate:-1deg]"
        style={at(112, 116, 96, 30)}
      >
        <Surface raised style={at(0, 0, 96, 30)} className={card}><Bar w={56} tone="strong" /><Bar w={36} /></Surface>
        <Pointer style={at(70, 18)} />
      </span>
    </>
  );
}

/** Client portal: her page. The work's progress, a file waiting, and her Approve, which she presses. */
export function PortalArt() {
  return (
    <>
      <Guides x={[22]} y={[22]} />
      <Surface raised style={at(22, 22, 250, 160)} className="overflow-hidden">
        <span className="flex h-[22px] items-center gap-1 border-b border-line-soft px-2.5">
          <span className="size-[5px] rounded-full bg-ink-200" /><span className="size-[5px] rounded-full bg-ink-200" /><span className="size-[5px] rounded-full bg-ink-200" />
          <span className="ms-6 block h-2.5 w-24 rounded-xs bg-surface-fill" />
        </span>
        <span className="flex flex-col gap-2 px-3 pt-3">
          <Bar w={92} tone="strong" />
          <Bar w={60} />
          <span className="mt-1 block h-1 w-[200px] overflow-hidden rounded-xs bg-surface-fill"><span className="block h-full w-[64%] rounded-xs bg-accent" /></span>
          <span className="mt-1.5 flex h-[30px] w-[204px] items-center gap-2 rounded-md border border-line px-2">
            <span className="h-4 w-3.5 shrink-0 rounded-[3px] border border-line bg-surface-fill" />
            <Bar w={62} tone="mid" />
            {/* Her Approve: outlined while it waits, green once she presses it. */}
            <span className="ms-auto grid h-4 w-11 place-items-center rounded-[4px] border border-line-strong transition-colors duration-[var(--site-hover)] ease-hover group-hover:border-success-600 group-hover:bg-success-600">
              <span className="col-start-1 row-start-1 block h-[3px] w-5 rounded-xs bg-ink-300 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-0" />
              <svg viewBox="0 0 12 12" className="col-start-1 row-start-1 size-2.5 text-surface-raised opacity-0 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-100">
                <path d="M3 6.2 5.1 8.2 9 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
        </span>
      </Surface>
      <Pointer style={at(188, 116)} tag="Client" />
    </>
  );
}

/** Money: the hours you tracked become the invoice, and the invoice is paid. */
export function MoneyArt() {
  return (
    <>
      <Guides x={[20, 128]} y={[36, 150]} />
      <Surface style={at(20, 36, 86, 28)} className="flex items-center gap-2 px-2.5">
        <svg viewBox="0 0 12 12" className="size-3 shrink-0 text-ink-500"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M6 3.6V6l1.6 1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        <Bar w={26} tone="mid" /><Bar w={14} />
      </Surface>
      {/* The hours travel into the invoice: the product's own connector, its two ends as nodes. */}
      <svg aria-hidden className="absolute overflow-visible" style={at(0, 0, 248, 168)}>
        <path d="M106 50 H114 Q120 50 120 56 V78 Q120 84 126 84 H128" fill="none" stroke="var(--color-line-strong)" strokeWidth="1" />
        <circle cx="106" cy="50" r="2.5" fill="var(--color-surface-raised)" stroke="var(--color-line-strong)" />
        <circle cx="128" cy="84" r="2.5" fill="var(--color-surface-raised)" stroke="var(--color-line-strong)" />
      </svg>
      <Surface raised style={at(128, 34, 150, 124)} className="flex flex-col gap-2 px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className="font-mono text-caption text-ink-500">INV-014</span>
          {/* Sent while it is owed; Paid once the payment is recorded (under the pointer). */}
          <span className="grid">
            <span className="col-start-1 row-start-1 rounded-sm bg-info-100 px-1.5 text-caption font-medium text-info-600 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-0">Sent</span>
            <span className="col-start-1 row-start-1 rounded-sm bg-success-100 px-1.5 text-caption font-medium text-success-600 opacity-0 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-100">Paid</span>
          </span>
        </span>
        <span className="mt-1 flex items-center gap-3"><Bar w={56} tone="mid" /><Bar w={22} /></span>
        <span className="flex items-center gap-3"><Bar w={44} tone="mid" /><Bar w={22} /></span>
        <span className="mt-auto flex items-center gap-3 border-t border-line-soft pt-2">
          <Bar w={26} tone="strong" /><span className="text-small font-medium tabular-nums text-ink-900">$4,800</span>
        </span>
      </Surface>
      <Pointer style={at(194, 47)} />
    </>
  );
}

/**
 * THE FEATURED PICTURE: the product itself, on the brand's own painted ground (the hero's field, the
 * way every picture on the page is made). A window of Zenboard's Home, cropped by the frame like a
 * screen rising from the bottom edge, with your pointer on today's first open task: an invitation,
 * because the product just below the headline really does work.
 */
export function ProductArt() {
  return (
    <span aria-hidden className="absolute inset-0">
      <Surface
        raised
        style={at(24, 36, 340, 210)}
        className="overflow-hidden rounded-lg shadow-lg transition-[translate] duration-[var(--site-swap)] ease-out-quiet motion-safe:group-hover:-translate-y-1"
      >
        <span className="absolute inset-y-0 start-0 flex w-[74px] flex-col gap-[7px] border-e border-line-soft px-2 pt-2.5">
          <span className="mb-1 flex items-center gap-1"><Mark size={10} tone="brand" /><Bar w={30} tone="strong" /></span>
          <span className="flex h-3.5 items-center rounded-[3px] bg-surface-active px-1"><Bar w={34} tone="strong" /></span>
          {[40, 30, 36, 26].map((w) => <span key={w} className="flex h-3.5 items-center px-1"><Bar w={w} /></span>)}
        </span>
        <span className="absolute inset-y-0 end-0 start-[74px] flex flex-col gap-2 px-3 pt-3">
          <span className="flex items-center gap-1.5"><Mark size={10} tone="brand" /><span className="block h-2 w-24 rounded-xs bg-ink-300" /></span>
          <Bar w={132} />
          <span className="mt-1.5 flex flex-col gap-2">
            <span className="flex items-center gap-2"><Check done /><Bar w={96} /></span>
            <span className="flex items-center gap-2"><Check ticks /><Bar w={118} tone="mid" /></span>
            <span className="flex items-center gap-2"><Check /><Bar w={84} tone="mid" /></span>
          </span>
        </span>
        <Pointer style={at(92, 76)} tag="You" className="site-art-you" />
      </Surface>
    </span>
  );
}

// ── THE MENU'S SIX SCENES, AT THE CANVAS'S SIZE ─────────────────────────────
//
// From the user's design canvas (claude.ai/artifact/3HAMhbe4fYnVCyP4nkHYnz, "Site navigation ·
// micro illustrations"): six nav items at 418×128, each with a 190×128 drawing bleeding off the
// right edge behind the words.
//
// They are SMALLER than the four above, and that is the canvas's argument rather than a
// constraint: six places at a glance beats four places explained, because a menu is a list of
// where you can go and not a place to read. So each scene is two or three surfaces and one thing
// happening — the same vocabulary (`Surface`, `Bar`, `Check`, `Pointer`, `Guides`), drawn tighter.
//
// Everything is in the drawing's own pixels, inside a 190×128 box the card crops.

/** The box every menu scene is drawn in. The card crops it; nothing here reflows. */
export const NAV_SCENE = { width: 190, height: 128 } as const;

/** Home: the day's three rows, and the highlight in the middle being ticked. */
export function HomeScene() {
  return (
    <>
      <Guides x={[40, 156]} y={[16, 112]} />
      <Surface style={at(40, 16, 116, 26)} className="flex items-center gap-2 px-2.5">
        <Check /><Bar w={58} />
      </Surface>
      <Surface raised style={at(28, 50, 140, 30)} className="flex items-center gap-2 px-2.5">
        <Check ticks step={1} /><Mark size={11} tone="brand" /><Bar w={52} tone="mid" className={cn('transition-colors duration-[var(--site-hover)] ease-hover group-hover:bg-ink-100', STEP[2])} />
        <span className="ms-auto font-mono text-[9px] leading-none text-ink-500">9:30</span>
      </Surface>
      <Surface style={at(40, 88, 116, 26)} className="flex items-center gap-2 px-2.5">
        <Check /><Bar w={44} />
      </Surface>
      {/* Onto the highlight's checkbox, which is what the whole row is for. */}
      <Pointer style={at(150, 64)} to={[-12, -2]} />
    </>
  );
}

/** Inbox: things arriving in a pile, and the top one being filed into today. */
export function InboxScene() {
  return (
    <>
      <Guides x={[46]} y={[22, 104]} />
      {/* The pile, stacked back to front: two behind, one in hand. */}
      <Surface style={at(52, 22, 118, 22)} />
      <Surface style={at(48, 30, 126, 24)} />
      <Surface raised style={at(42, 40, 138, 30)} className={cn('flex items-center gap-2 px-2.5 transition-transform duration-[var(--site-hover)] ease-out-quiet motion-safe:group-hover:translate-y-3', STEP[1])}>
        <span className="size-2.5 shrink-0 rounded-xs bg-[var(--art-pointer)]" />
        <Bar w={64} tone="mid" />
      </Surface>
      {/* Where it lands. It fills while the card is pointed at.
          THE TRAVEL ABOVE IS BOUNDED BY THIS BOX. The card in hand sits at y=40 and is 30 tall, so
          it ends at 70; this slot starts at y=86. Anything over 16px of travel puts the card THROUGH
          the slot — `translate-y-6` (24px) did, and the two drawings overlapped on hover. 12px reads
          as "on its way there" and keeps a 4px gap. A drawing is laid out in absolute pixels: motion
          in it has to respect the same geometry the static art does. */}
      <span
        style={at(52, 86, 118, 26)}
        className={cn('absolute flex items-center gap-2 rounded-md border border-dashed border-line-strong px-2.5 transition-colors duration-[var(--site-hover)] ease-hover group-hover:border-solid group-hover:bg-surface-hover', STEP[2])}
      >
        <Check ticks step={2} /><Bar w={52} />
      </span>
      <Pointer style={at(150, 70)} to={[-8, 6]} />
    </>
  );
}

/** Projects: two columns, and a card carried into the second one. */
export function ProjectsScene() {
  const col = 'absolute rounded-md bg-surface-fill';
  return (
    <>
      <Guides x={[36, 118]} y={[18]} />
      <span style={at(36, 18, 70, 96)} className={col} />
      <span style={at(114, 18, 70, 96)} className={col} />
      <Surface style={at(42, 26, 58, 22)} className="flex items-center px-2"><Bar w={34} /></Surface>
      <Surface style={at(42, 54, 58, 22)} className="flex items-center px-2"><Bar w={26} /></Surface>
      {/* The one being moved: it leans toward its new column under the pointer. */}
      <Surface
        raised
        style={at(96, 62, 62, 26)}
        className={cn('flex items-center gap-1.5 px-2 transition-transform duration-[var(--site-hover)] ease-out-quiet motion-safe:group-hover:translate-x-4', STEP[1])}
      >
        <span className="size-2 shrink-0 rounded-xs bg-[var(--art-pointer)]" /><Bar w={30} tone="mid" />
      </Surface>
      <Pointer style={at(148, 76)} to={[-10, 4]} />
    </>
  );
}

/** Client portal: one link, and the two people on either end of it. */
export function PortalScene() {
  return (
    <>
      <Guides x={[36, 148]} y={[12]} />
      <Surface raised style={at(36, 12, 112, 52)} className="flex flex-col overflow-hidden">
        <span className="flex h-[18px] items-center border-b border-line-soft px-2 font-mono text-[7px] tracking-[0.12em] text-ink-500">Ridgeline</span>
        <span className="flex flex-1 items-center gap-1.5 px-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--art-pointer)_30%,transparent)]">
            <Mark size={10} tone="brand" />
          </span>
          <Bar w={50} />
        </span>
      </Surface>
      {/* The link forking to the two of you. */}
      <svg aria-hidden viewBox="0 0 190 128" className="absolute inset-0 size-full">
        <g fill="none" strokeWidth="1.2" strokeLinecap="round" className="stroke-line-strong">
          <path d="M 92 66 V 80" /><path d="M 92 88 V 96 Q 92 104 84 104 H 67" /><path d="M 92 88 V 96 Q 92 104 100 104 H 117" />
        </g>
        <circle cx="92" cy="84" r="4.5" strokeWidth="1" className="fill-[var(--color-surface-raised)] stroke-line-strong" />
        <circle cx="92" cy="84" r="2" className="fill-[var(--art-pointer)]" />
      </svg>
      <span style={at(48, 95)} className="absolute grid size-[18px] place-items-center rounded-full bg-[color-mix(in_oklab,var(--art-pointer)_30%,transparent)] text-[9px] font-semibold text-ink-800 ring-2 ring-surface-raised">M</span>
      {/* The empty seat at the client's end of the link fills while the card is pointed at: the
          invitation is taken. Both marks are in the DOM and cross-fade, which is how an icon changes
          state here — never by swapping the element. */}
      <span className={cn('absolute grid size-4 place-items-center rounded-full border bg-surface-raised transition-colors duration-[var(--site-hover)] ease-hover border-line-strong group-hover:border-success-600 group-hover:bg-success-600', STEP[2])} style={at(118, 96)}>
        <svg viewBox="0 0 8 8" className={cn('col-start-1 row-start-1 size-2 text-ink-600 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-0', STEP[2])}><path d="M4 1 V7 M1 4 H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        <svg viewBox="0 0 12 12" className={cn('col-start-1 row-start-1 size-2.5 text-surface-raised opacity-0 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-100', STEP[2])}><path d="M3 6.2 5.1 8.2 9 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <Pointer style={at(62, 102)} to={[8, -4]} />
    </>
  );
}

/** Docs: a page being written, with the caret where the words stop. */
export function DocsScene() {
  return (
    <>
      <Guides x={[44]} y={[18, 110]} />
      <Surface raised style={at(44, 18, 130, 92)} className="flex flex-col gap-2 p-3">
        <Bar w={54} tone="strong" />
        <Bar w={100} />
        <Bar w={86} />
        <span className="flex items-center gap-1">
          <Bar w={44} />
          {/* A word lands at the caret while the card is pointed at — the page is being written, not
              merely open. It grows from the caret's side, so the caret reads as having typed it. */}
          <Bar w={22} className={cn('origin-left scale-x-0 transition-transform duration-[var(--site-hover)] ease-out-quiet motion-safe:group-hover:scale-x-100', STEP[1])} />
          {/* The caret: the one thing in this drawing that is alive. */}
          <span className="block h-3 w-px bg-[var(--art-pointer)] motion-safe:animate-[zb-caret_1.1s_steps(1,end)_infinite]" />
        </span>
        <span className="mt-auto flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-[color-mix(in_oklab,var(--art-pointer)_40%,transparent)]" />
          <Bar w={58} />
        </span>
      </Surface>
      <Pointer style={at(150, 82)} to={[-14, -6]} />
    </>
  );
}

/** Finance: what is owed, and the one that has just been paid. */
export function FinanceScene() {
  return (
    <>
      <Guides x={[38]} y={[16, 108]} />
      <Surface raised style={at(38, 16, 136, 58)} className="flex flex-col justify-center gap-1.5 px-3">
        <Bar w={34} />
        <span className="text-[17px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">$2,800</span>
      </Surface>
      <Surface style={at(48, 84, 126, 26)} className="flex items-center gap-2 px-2.5">
        <span className="font-mono text-[8px] leading-none text-ink-500">INV-001</span>
        <Bar w={30} />
        {/* Paid, and it says so while the card is pointed at. */}
        <span className={cn('ms-auto flex items-center gap-1 rounded-xs bg-success-100 px-1 py-px text-[8px] font-medium leading-none text-success-600 opacity-0 transition-opacity duration-[var(--site-hover)] ease-hover group-hover:opacity-100', STEP[2])}>Paid</span>
      </Surface>
      <Pointer style={at(150, 74)} to={[-10, 4]} />
    </>
  );
}
