'use client';
// ── THE CLIENT PORTAL SECTION ───────────────────────────────────────────────
//
// Built from the user's design canvas (claude.ai/artifact/3HAMhbe4fYnVCyP4nkHYnz, "Client portal
// section · zenboard.life/#portal"): a header and five cards on the page's own lattice, each card a
// periwinkle tile, a title, a sentence, and a picture of the thing it describes.
//
// It REPLACES the portal Spotlight — a list of four features beside one rotating picture. The
// canvas makes a different and better argument: the portal is five separate promises (a link, the
// choosing, requests, approvals, invoices) and a list that shows one at a time makes the reader
// wait to find out whether the one they care about is in it.
//
// ── WHAT IS TRANSLATED, AND WHAT IS NOT ────────────────────────────────────
// The canvas is drawn in absolute pixels and literal hexes, because that is what a canvas is for.
// Here every one of them is a token: the canvas's lilac tile is the periwinkle field the site
// already owns, its page and rule are the page and its line, its deep lilac is that same hue at
// ink strength (`--site-hue-ink`) and its green is `success-600`. Its geometry becomes the grid's
// own columns —
// 764/545 of 1309 is 7 and 5 of twelve, and three 436s are three fours — so the section sits on
// the same lattice as every other, and the stars land where its cells meet.
//
// ── THE INTERACTIONS ───────────────────────────────────────────────────────
// The canvas marks "You choose what they see" interactive, and it is the one that matters: the
// claim is that YOU decide, so the reader gets to decide, and the client's view changes under
// their hand. Copying the link earns its place too, because it is the card's own verb. The other
// three TELL A STORY ON A LOOP (user, 2026-09-29: "make them proper animation, delightful
// animation, on loop"): a request becoming a task and done, a plan being approved, an invoice
// being paid. A picture is looped or interactive, never both.

import * as React from 'react';
import {
  Check, CheckCircle, Copy, Eye, FileText, Link as LinkIcon, Lock, MessageCircle, Receipt, Users,
} from '@/components/ds/icons';
import { Icon, Switch, button, cardClass } from '@/components/ds/ui';
import { IconSwap } from '@/components/ds/ui/motion';
import { cn } from '@/lib/cn';
import { useStory } from './use-story';
import { CardLine, CHAPTER, Cell, Eyebrow, HUE, Plot, Row } from './visual';

/**
 * One card: the tile, the title, the sentence, and the picture under them.
 *
 * THE CARD HAS A HEIGHT, and it has to. Its picture is absolutely positioned — that is what lets a
 * browser window overlap a share card and a cursor sit between them — so the picture contributes
 * NOTHING to the card's height, and an auto-height card collapses onto its own words and lets the
 * illustration spill into the row below (which is exactly what the first render did). The canvas
 * draws the wide pair at 600 and the trio at 560; those numbers are the picture's room, so they
 * come across. Below `sm` they relax, because a phone gets a shorter picture, not a scrollbar.
 */
function Card({ icon, title, body, wide, tall, className, children }: {
  icon: typeof Eye; title: string; body: string; wide?: boolean; tall?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <Cell sheen className={cn(
      'site-hue-periwinkle flex flex-col gap-7 overflow-hidden p-6 sm:p-10',
      tall ? 'min-h-[460px] sm:min-h-[600px]' : 'min-h-[440px] sm:min-h-[560px]',
      className,
    )}>
      <div data-reveal="rise" className="flex items-start gap-5">
        <span aria-hidden className="site-tile grid size-11 shrink-0 place-items-center rounded-[10px]">
          <Icon icon={icon} size={20} weight="fill" />
        </span>
        <CardLine title={title} body={body} className={cn('min-w-0 pt-2.5', wide ? 'max-w-[520px]' : 'max-w-[416px]')} />
      </div>
      {children}
    </Cell>
  );
}

/** A cursor with someone's name on it, the way a shared document draws one. In a story picture it
 *  travels and presses (`plot-cursor`, globals.css); everywhere else it simply rests. */
function Cursor({ who, className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { who: string }) {
  return (
    <span aria-hidden {...rest} className={cn('pointer-events-none absolute flex flex-col items-start', className)}>
      <svg width="20" height="22" viewBox="0 0 20 22" className="text-[var(--site-hue-ink)]">
        <path d="M3 2 L3 17 L7.4 13.2 L10.4 19.6 L13.1 18.4 L10.1 12.1 L16 12.1 Z" fill="currentColor" stroke="var(--color-surface-raised)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className="-mt-0.5 ms-3.5 flex h-[22px] items-center whitespace-nowrap rounded-md bg-[var(--site-hue-ink)] px-2 text-caption font-medium text-[var(--color-paper)]">{who}</span>
    </span>
  );
}

/** The confirmation that floats over a picture once the thing in it has happened. */
function Stamp({ what, when, className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { what: string; when: string }) {
  return (
    <span {...rest} className={cn('plot-panel absolute flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full ps-2.5 pe-3', className)}>
      <Icon icon={CheckCircle} size={16} weight="fill" className="text-success-600" />
      <span className="text-caption font-medium text-ink-900">{what}</span>
      <span className="text-caption text-ink-500">{when}</span>
    </span>
  );
}

/** A status as the portal shows it. In a story, two or three of these share one place and hand over
 *  to each other (`plot-swap`), so the place is as wide as the widest and nothing beside it moves. */
const STATUS = {
  waiting: { chip: 'bg-surface-fill text-ink-600', dot: 'border-[1.5px] border-ink-500' },
  moving: { chip: 'bg-[color-mix(in_oklab,var(--site-hue)_70%,transparent)] text-[var(--site-hue-ink)]', dot: 'border-[1.5px] border-[var(--site-hue-ink)]' },
  done: { chip: 'bg-success-100 text-success-600', dot: 'bg-success-600' },
} as const;
function Status({ tone, className, children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone: keyof typeof STATUS }) {
  return (
    <span {...rest} className={cn('plot-swap col-start-1 row-start-1 inline-flex h-5 items-center gap-1.5 rounded-md px-2 text-micro font-medium', STATUS[tone].chip, className)}>
      <span className={cn('size-1.5 rounded-full', STATUS[tone].dot)} />{children}
    </span>
  );
}

// ── 01 · ONE LINK, NO LOGIN ─────────────────────────────────────────────────

const PLACES = ['Overview', 'To review', 'Requests', 'Work', 'Invoices'];
const UPDATES = [['Invitations sent', '2d'], ['Venue booked', '4d'], ['Kickoff call', '6d']];

function CardLink() {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    // The card's own verb. If the clipboard is refused (an insecure origin, or a browser that
    // asks), the button still confirms: the point being made is "one link", not "this worked".
    try { await navigator.clipboard?.writeText('https://zenboard.life/p/ridgeline'); } catch { /* shown anyway */ }
    setCopied(true);
  };

  return (
    <Card icon={LinkIcon} title="One link, no login" wide tall className="lg:col-span-7"
      body="Send your client a link. They open it and see the project: progress, recent work and what needs them. No account, no password.">
      <Plot label="The Ridgeline launch event portal open in a browser, shared from a copied link, with the client looking at the event plan that awaits their review" className="flex-1 -mx-6 -mb-6 sm:-mx-10 sm:-mb-10">
        <span aria-hidden className="plot-glow absolute left-[46%] top-[38%] hidden h-[220px] w-[360px] lg:block" />

        {/* The portal itself, in a browser. */}
        <div data-reveal="lift" className="plot-panel absolute inset-x-6 top-6 bottom-0 flex flex-col overflow-hidden rounded-[14px] sm:inset-x-16 lg:end-auto lg:w-[468px]">
          <div className="relative flex h-[38px] shrink-0 items-center border-b border-line-soft px-3.5">
            <span aria-hidden className="flex gap-1.5">
              {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-line-strong" />)}
            </span>
            <span className="absolute left-1/2 top-2 flex h-[22px] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-surface-fill px-2.5 font-mono text-caption text-ink-500">
              <Icon icon={Lock} size={12} weight="fill" />zenboard.life/p/ridgeline
            </span>
          </div>
          <div className="flex min-h-0 flex-1">
            <nav aria-hidden className="hidden w-32 shrink-0 flex-col gap-0.5 border-e border-line-soft bg-canvas px-2.5 py-3.5 sm:flex">
              <span className="mb-3.5 flex items-center gap-2 px-1.5">
                <span className="grid size-[22px] place-items-center rounded-md bg-ink-900 text-caption font-semibold text-[var(--color-paper)]">N</span>
                <span className="text-caption font-medium text-ink-900">Northlight</span>
              </span>
              {PLACES.map((p, i) => (
                <span key={p} className={cn('flex h-[26px] items-center justify-between rounded-md px-2 text-caption', i === 0 ? 'bg-surface-active font-medium text-ink-900' : 'text-ink-600')}>
                  {p}
                  {i === 1 && <span className="grid size-4 place-items-center rounded-full bg-[color-mix(in_oklab,var(--site-hue)_70%,transparent)] px-1 text-micro font-semibold text-[var(--site-hue-ink)]">1</span>}
                </span>
              ))}
            </nav>
            <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-4 sm:px-5">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-h4 font-semibold text-ink-900">Ridgeline launch event</span>
                  <span className="inline-flex h-[18px] items-center gap-1.5 rounded-md bg-success-100 px-1.5 text-micro font-medium text-success-600">
                    <span className="size-1 rounded-full bg-success-600" />Active
                  </span>
                </span>
                <span className="text-caption text-ink-500">Here is where things stand. No login needed.</span>
              </div>

              <div className="flex items-center gap-3.5 rounded-[10px] border border-line-soft bg-canvas px-3.5 py-3">
                <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="shrink-0 -rotate-90">
                  <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-line" />
                  <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="0.64 1" className="stroke-ink-900" />
                </svg>
                <span className="flex flex-col">
                  <span className="text-h3 font-semibold tabular-nums text-ink-900">64%</span>
                  <span className="text-caption text-ink-500">18 of 28 tasks done</span>
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-overline">To review</span>
                <span className="flex h-10 items-center gap-2.5 rounded-[10px] px-3 ring-1 ring-inset ring-[color-mix(in_oklab,var(--site-hue-ink)_22%,transparent)] bg-[color-mix(in_oklab,var(--site-hue)_26%,transparent)]">
                  <Icon icon={FileText} size={14} weight="fill" className="text-[var(--site-hue-ink)]" />
                  <span className="flex-1 truncate text-caption font-medium text-ink-900">Event plan and budget</span>
                  <span className="hidden h-5 shrink-0 items-center rounded-md bg-[color-mix(in_oklab,var(--site-hue)_70%,transparent)] px-2 text-micro font-medium text-[var(--site-hue-ink)] sm:flex">Awaiting you</span>
                </span>
              </div>

              <div className="flex min-h-0 flex-col">
                <span className="mb-1 text-overline">Recent updates</span>
                {UPDATES.map(([what, when]) => (
                  <span key={what} className="flex h-[26px] items-center gap-2 text-caption text-ink-900">
                    <Icon icon={CheckCircle} size={14} weight="fill" className="text-success-600" />
                    <span className="flex-1 truncate">{what}</span>
                    <span className="text-ink-500">{when}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* The share card, and the one control in this picture that works. */}
        <div data-reveal="lift" className="plot-panel absolute end-4 top-16 hidden w-[252px] flex-col gap-2.5 rounded-xl p-3.5 xl:flex">
          <span className="flex items-center justify-between">
            <span className="text-small font-medium text-ink-900">Share with client</span>
            <Switch size="sm" checked aria-hidden tabIndex={-1} className="pointer-events-none" onCheckedChange={() => {}} />
          </span>
          <span className="-mt-1.5 text-caption text-ink-500">Anyone with the link can view it.</span>
          <span className="flex gap-1.5">
            <span className="flex h-[30px] min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap rounded-lg bg-surface-fill px-2.5 font-mono text-caption text-ink-600">zenboard.life/p/ridgeline</span>
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className="focus-ring zb-press flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg bg-ink-900 px-2.5 text-caption font-medium text-[var(--color-paper)]"
            >
              {/* The glyph's MEANING changes, so it is `IconSwap` and not `Icon state`: the old
                  one shrinks away as the new one grows in, blurred through the middle. */}
              <IconSwap swapKey={copied ? 'done' : 'copy'}><Icon icon={copied ? Check : Copy} size={12} /></IconSwap>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        </div>

        {/* Resting, not travelling: this picture is an INTERACTIVE one (the copy button works), and
            a picture is looped or interactive, never both. */}
        <Cursor who="Maya · Ridgeline" className="left-[62%] top-[54%] hidden lg:flex" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[72px] bg-gradient-to-b from-transparent to-background" />
      </Plot>
    </Card>
  );
}

// ── 02 · YOU CHOOSE WHAT THEY SEE ───────────────────────────────────────────

const SHARE = [
  { key: 'progress', label: 'Progress' },
  { key: 'done', label: 'Finished work' },
  { key: 'open', label: 'Open tasks' },
  { key: 'docs', label: 'Documents' },
  { key: 'invoices', label: 'Invoices' },
] as const;
const KEPT = [['Internal notes', '6'], ['Time logged', '14h 20m'], ['Costs', '$1,240']];

function CardVisibility() {
  // The canvas's own starting state: everything on but the open tasks, which is the honest default
  // — a client wants to know what is DONE, and a list of what is not is a list of ways to worry.
  const [on, setOn] = React.useState<Record<string, boolean>>({ progress: true, done: true, open: false, docs: true, invoices: true });
  const shared = SHARE.filter((r) => on[r.key]).length;

  return (
    <Card icon={Eye} title="You choose what they see" tall className="lg:col-span-5"
      body="Turn on progress, finished work, documents or invoices. Notes, time and costs stay inside Zenboard.">
      <div className="relative min-h-0 flex-1">
        <span aria-hidden className="plot-ground absolute inset-0" />

        {/* What never crosses the link: drawn as a hatched, dashed panel BEHIND the switches, so
            "stays with you" is a place rather than a sentence. */}
        <div aria-hidden data-reveal="lift" className="absolute end-0 top-[46%] hidden w-[206px] flex-col gap-1 rounded-xl border border-dashed border-line-strong bg-canvas p-3.5 [background-image:repeating-linear-gradient(135deg,color-mix(in_oklab,var(--color-ink-900)_4%,transparent)_0_1px,transparent_1px_8px)] sm:flex">
          <span className="mb-1.5 flex items-center gap-1.5 ps-[30px]">
            <Icon icon={Lock} size={12} weight="fill" className="text-ink-600" />
            <span className="text-caption font-medium text-ink-600">Stays with you</span>
          </span>
          {KEPT.map(([what, value]) => (
            <span key={what} className="flex h-7 items-center justify-between ps-[30px] text-caption text-ink-500">
              {what}<span className="tabular-nums text-ink-600">{value}</span>
            </span>
          ))}
        </div>

        <div data-reveal="lift" className="plot-panel absolute inset-x-0 top-2 overflow-hidden rounded-xl sm:inset-x-auto sm:start-[6%] sm:w-[292px]">
          <div className="flex h-[46px] items-center gap-2 px-4">
            <Icon icon={Eye} size={14} weight="fill" className="text-[var(--site-hue-ink)]" />
            <span className="text-small font-medium text-ink-900">What Maya sees</span>
            {/* Polite, so the count is heard as the reader changes it. */}
            <span aria-live="polite" className="ms-auto text-caption tabular-nums text-ink-500">{shared} of {SHARE.length} on</span>
          </div>
          {SHARE.map((r) => {
            const checked = on[r.key];
            return (
              // THE DS SWITCH, not a drawing of one. This started as a hand-built track and knob
              // because the canvas draws it at 28×16, and that is exactly the fork the house rule
              // exists to stop: the real control brings its own keyboard, its own ARIA and the
              // house's own motion, and a reader who tabs into this card gets a switch that
              // behaves like every other switch in the product.
              <label
                key={r.key}
                className="flex h-11 w-full cursor-pointer items-center justify-between border-t border-line-soft px-4 text-small transition-colors duration-fast ease-hover hover:bg-surface-hover"
              >
                <span className={cn('transition-colors duration-fast ease-hover', checked ? 'text-ink-900' : 'text-ink-500')}>{r.label}</span>
                <Switch
                  size="sm"
                  checked={checked}
                  onCheckedChange={(v) => setOn((st) => ({ ...st, [r.key]: v }))}
                  aria-label={`Show ${r.label.toLowerCase()} to your client`}
                />
              </label>
            );
          })}
        </div>
      </div>
      <p className="text-body text-ink-600">Preview as client shows you their exact view.</p>
    </Card>
  );
}

// ── THE THREE STORIES ───────────────────────────────────────────────────────
// User, 2026-09-29: "make them proper animation, delightful animation, on loop". Each picture TELLS
// its card's sentence, step by step, in the product's own parts (use-story.ts is the clock; every part
// says from which step it shows; globals.css "a portal picture tells its story" moves it). The last
// step of each is its longest: for a third of the loop the picture is its sentence, finished, and
// reads as a still. They are LOOPED pictures (`story`), so the pointer is given nothing to do.
//
// A story's steps are held in BEATS (use-story.ts: one beat is the site's cross-fade).

// ── 03 · REQUESTS BECOME TASKS ──────────────────────────────────────────────
// Her request waits · is sent · you approve it and it moves · it lands in your tasks · you tick it,
// and her status follows it to done · the whole thread holds.
const REQUEST_STORY = [2.4, 2.4, 2.8, 3.2, 3.6, 5.4] as const;

function CardRequests() {
  const { ref, on } = useStory(REQUEST_STORY, 5);
  return (
    <Card icon={MessageCircle} title="Requests become tasks" className="lg:col-span-4"
      body="Your client asks in the portal. Approve it and it lands in your tasks, and they watch it move to done.">
      <Plot ref={ref} story label="A request from Maya in the portal, sent Monday at 9:14, approved by you at 11:02, turned into a task in your list linked back to her request, and ticked done while her request's status follows it" className="flex-1 -mx-6 -mb-6 sm:-mx-10 sm:-mb-10">
        {/* The thread from her ask to your task, DRAWING ITSELF as the request travels: the hue
            while it is hers, the ink once it is yours, and the tick where it changed hands. */}
        <svg aria-hidden viewBox="0 0 436 388" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMin slice">
          <path d="M 60 138 V 196" pathLength={1} data-on={on(1)} fill="none" strokeWidth="1.5" strokeLinecap="round" className="plot-draw stroke-[var(--site-hue-ink)] opacity-60" />
          <path d="M 60 196 V 254 Q 60 266 72 266 H 121" pathLength={1} data-on={on(3)} fill="none" strokeWidth="1.5" strokeLinecap="round" className="plot-draw stroke-ink-900" />
          <path d="M 119.5 261.5 L 124.5 266 L 119.5 270.5" data-on={on(3)} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="plot-in plot-late stroke-ink-900" />
          <circle cx="60" cy="136" r="4" strokeWidth="1.5" className="fill-[var(--color-surface-raised)] stroke-[var(--site-hue-ink)]" />
          <circle cx="60" cy="162" r="3" data-on={on(1)} className="plot-pop fill-[var(--site-hue-ink)] opacity-60" />
          <g data-on={on(2)} className="plot-pop">
            <circle cx="60" cy="196" r="16" className="fill-[var(--site-hue)] opacity-40" />
            <circle cx="60" cy="196" r="10" className="fill-ink-900" />
            <path d="M 55.5 196.2 L 58.6 199.2 L 64.5 193" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-[var(--color-paper)]" />
          </g>
        </svg>
        <span data-on={on(1)} className="plot-in absolute left-[72px] top-[154px] text-caption text-ink-500">Sent · Mon 9:14</span>
        <span data-on={on(2)} className="plot-panel plot-in absolute left-20 top-[184px] flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5">
          <span className="text-caption font-medium text-ink-900">Approved by you</span>
          <span className="text-caption text-ink-500">Mon 11:02</span>
        </span>

        <div data-reveal="lift" className="plot-panel absolute left-7 top-2 w-[264px] rounded-xl px-3.5 py-3">
          <span className="flex items-center gap-2">
            <span className="grid size-[22px] place-items-center rounded-full bg-[color-mix(in_oklab,var(--site-hue)_70%,transparent)] text-caption font-semibold text-[var(--site-hue-ink)]">M</span>
            <span className="text-caption font-medium text-ink-900">Maya</span>
            <span className="text-caption text-ink-500">via portal</span>
            <span className="ms-auto text-caption text-ink-500">Mon</span>
          </span>
          <p className="mt-2 text-small text-ink-900">Could we add 20 more guests to the list?</p>
          {/* Her request's status, as SHE sees it in the portal: it follows the work, which is the
              card's whole promise ("they watch it move to done"). */}
          <span className="mt-2.5 grid justify-items-start">
            <Status tone="waiting" data-on={on(0, 2)}>Sent</Status>
            <Status tone="moving" data-on={on(2, 4)}>In progress</Status>
            <Status tone="done" data-on={on(4)}>Done</Status>
          </span>
        </div>

        <div data-reveal="lift" className="plot-panel absolute left-32 top-[212px] w-[284px] overflow-hidden rounded-xl">
          <span className="flex h-8 items-center justify-between border-b border-line-soft px-3.5 text-caption font-medium text-ink-500">
            Your tasks<span className="font-normal">Ridgeline</span>
          </span>
          <div className="relative px-3.5 py-3">
            {/* Where her request will land: an empty place in the list until it does. */}
            <span aria-hidden data-on={on(0, 3)} className="plot-swap absolute inset-x-2 inset-y-1.5 rounded-lg border border-dashed border-line-strong" />
            <div data-on={on(3)} className="plot-in">
              <span className="flex items-center gap-2">
                {/* A task's box is SQUARE, as it is everywhere in Zenboard; ticking it lands a filled
                    box with its tick, and a line runs through the words. */}
                <span className="relative grid size-3.5 shrink-0">
                  <span aria-hidden className="absolute inset-0 rounded-[4px] border-[1.5px] border-line-strong" />
                  <span aria-hidden data-on={on(4)} className="plot-pop absolute inset-0 grid place-items-center rounded-[4px] bg-ink-900 text-[var(--color-paper)]">
                    <Icon icon={Check} size={12} className="w-2.5" />
                  </span>
                </span>
                <span data-on={on(4)} className="plot-done relative text-small font-medium">
                  Add 20 guests to the list
                  <span aria-hidden data-on={on(4)} className="plot-strike absolute inset-x-0 top-1/2 h-px bg-ink-500" />
                </span>
              </span>
              <span className="mt-2 flex items-center justify-between ps-[22px]">
                <span className="flex h-5 items-center gap-1.5 rounded-md px-1.5 text-caption font-medium text-[var(--site-hue-ink)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--site-hue-ink)_22%,transparent)] bg-[color-mix(in_oklab,var(--site-hue)_26%,transparent)]">
                  <Icon icon={MessageCircle} size={12} weight="fill" />From Maya’s request
                </span>
                <span className="text-caption text-ink-500">Fri</span>
              </span>
            </div>
          </div>
          <span aria-hidden className="flex h-9 items-center gap-2 border-t border-line-soft px-3.5 opacity-70">
            <span className="size-3.5 shrink-0 rounded-[4px] border-[1.5px] border-line" />
            <span className="h-1.5 w-[124px] rounded-full bg-line" />
            <span className="ms-auto h-1.5 w-6 rounded-full bg-line" />
          </span>
        </div>
      </Plot>
    </Card>
  );
}

// ── 04 · APPROVALS, ON THE RECORD ───────────────────────────────────────────
// The plan draws itself · Maya's cursor travels to Approve · presses it · the answer replaces the
// buttons · and is stamped on the file · which holds.
const APPROVAL_STORY = [2, 2.4, 2.8, 1.2, 2, 2.4, 5.2] as const;

function CardApprovals() {
  const { ref, on } = useStory(APPROVAL_STORY, 6);
  return (
    <Card icon={CheckCircle} title="Approvals, on the record" className="lg:col-span-4"
      body="Send a plan, a quote or a design for sign-off. Your client approves or asks for changes, and the answer stays with the file.">
      <Plot ref={ref} story label="The event plan and budget, version 3, shared for sign-off in the portal; Maya presses Approve, and her approval is saved with the file" className="flex-1 -mx-6 -mb-6 sm:-mx-10 sm:-mb-10">
        <span aria-hidden className="plot-glow absolute left-1/3 top-[38%] h-[180px] w-[280px]" />
        {/* The versions behind it: the same file, twice before. */}
        <span aria-hidden className={cardClass('absolute left-[108px] top-0.5 h-[208px] w-[220px] opacity-60')} />
        <span aria-hidden className={cardClass('absolute left-[94px] top-3 h-[228px] w-[248px] opacity-80')} />

        <div data-reveal="lift" className="plot-panel absolute left-20 top-6 w-[276px] rounded-xl p-2">
          <div className="relative h-[132px] overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--site-hue)_26%,transparent)]">
            <svg aria-hidden viewBox="0 0 260 132" className="absolute inset-0 size-full">
              <g fill="none" strokeWidth="1" strokeDasharray="2 3" className="stroke-[var(--site-hue-ink)] opacity-30">
                {[54.5, 84.5, 114.5, 144.5].map((x) => <line key={x} x1={x} y1="42" x2={x} y2="122" />)}
              </g>
              {/* The plan, drawn a task at a time: each bar grows from its start. */}
              {[
                { x: 54, y: 50, w: 28, tone: '' },
                { x: 72, y: 68, w: 36, tone: 'opacity-70' },
                { x: 96, y: 86, w: 40, tone: 'opacity-35' },
              ].map((b, i) => (
                <rect key={b.x} x={b.x} y={b.y} width={b.w} height="8" rx="4" data-on={on(1)}
                  className={cn('plot-grow fill-[var(--site-hue-ink)]', b.tone)}
                  style={{ transitionDelay: `calc(var(--site-stagger) * ${i * 2})` }} />
              ))}
              <g data-on={on(1)} className="plot-in plot-late">
                <line x1="104.5" y1="44" x2="104.5" y2="118" strokeWidth="1" className="stroke-[var(--site-hue-ink)]" />
                <circle cx="104.5" cy="44" r="2.5" className="fill-[var(--site-hue-ink)]" />
              </g>
            </svg>
            <span className="absolute left-2 top-2 flex gap-0.5 font-mono text-micro">
              {['v1', 'v2', 'v3'].map((v, i) => (
                <span key={v} className={cn('rounded-xs px-1.5 leading-4', i === 2 ? 'bg-surface-raised text-ink-900 ring-1 ring-inset ring-line' : 'text-ink-500')}>{v}</span>
              ))}
            </span>
            <span className="absolute end-2.5 top-2 text-micro leading-4 text-ink-500">Event plan</span>
            <span className="absolute end-2.5 top-8 flex w-[70px] flex-col">
              <span className="text-micro leading-3 text-ink-500">Budget</span>
              <span className="mt-0.5 text-h4 font-semibold tabular-nums text-ink-900">$8,200</span>
              <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
                <span className="w-9 bg-[var(--site-hue-ink)]" />
                <span className="w-[22px] bg-[var(--site-hue-ink)] opacity-60" />
                <span className="flex-1 bg-[var(--site-hue-ink)] opacity-25" />
              </span>
            </span>
          </div>
          <div className="px-1.5 pb-1.5 pt-2.5">
            <span className="block text-small font-medium text-ink-900">Event plan and budget</span>
            <span className="mt-0.5 block text-caption text-ink-500">Version 3 · shared Tuesday</span>
            {/* The buttons, and the answer that replaces them: an approval that can be given twice
                is not on the record. Drawings of the product's buttons, not buttons: this is a
                picture, and the pointer is given nothing to do in it. */}
            <div className="relative mt-3 h-8">
              <span data-on={on(0, 4)} className="plot-swap absolute inset-0 flex gap-2">
                <span className={cn(button({ size: 'sm', variant: 'secondary' }), 'pointer-events-none flex-1')}>Request changes</span>
                <span data-press={on(3, 4)} className={cn(button({ size: 'sm', variant: 'primary' }), 'plot-press pointer-events-none flex-1')}>Approve</span>
              </span>
              <span data-on={on(4)} className="plot-swap absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg bg-success-100 text-caption font-medium text-success-600">
                <Icon icon={Check} size={14} />Approved, and saved with the file
              </span>
            </div>
          </div>
        </div>

        {/* Maya's hand: it travels to Approve, presses, and moves away once the answer is given. */}
        <Cursor who="Maya" data-on={on(2, 5)} data-press={on(3, 4)} className="plot-cursor left-[290px] top-[238px]" />
        <Stamp what="Approved by Maya" when="Thu 10:42" data-on={on(5)} className="plot-in left-[112px] top-[314px]" />
      </Plot>
    </Card>
  );
}

// ── 05 · INVOICES, NEXT TO THE WORK ─────────────────────────────────────────
// What is due · the sent one asks to be looked at · it is paid: its status turns, the balance
// clears, and the paper settles · the stamp lands · which holds.
const BILLS = [
  { no: 'INV-002', what: 'Venue deposit', amount: '$2,800' },
  { no: 'INV-001', what: 'Planning', amount: '$3,500' },
];
const INVOICE_STORY = [2.4, 2.4, 2.8, 2.4, 6] as const;

function CardInvoices() {
  const { ref, on } = useStory(INVOICE_STORY, 4);
  return (
    <Card icon={Receipt} title="Invoices, next to the work" className="lg:col-span-4"
      body="Your client sees what is due and what is paid, on the same page as the work it pays for.">
      <Plot ref={ref} story label="The Ridgeline invoices in the portal: the 2,800 dollar venue deposit goes from sent to paid, and the balance due clears" className="flex-1 -mx-6 -mb-6 sm:-mx-10 sm:-mb-10">
        {/* The paper one, behind: an invoice is a document before it is a row. Once it is paid it
            settles, a little straighter, like a page put away. */}
        <span aria-hidden data-on={on(2)} className="plot-panel plot-settle absolute end-4 top-5 flex h-[212px] w-[172px] rotate-6 flex-col gap-2.5 rounded-[10px] p-4">
          {/* Sentence case, and no tracking: the house rule holds even where a paper invoice
              would shout (CLAUDE.md keeps capitals for ID strings like INV-001, which is what the
              rows below use). */}
          <span className="text-overline">Invoice</span>
          {[72, 112, 92].map((w) => <span key={w} className="h-1.5 rounded-full bg-line" style={{ width: w }} />)}
          <span className="mt-auto h-px bg-line-soft" />
          <span className="flex items-center justify-between">
            <span className="h-1.5 w-9 rounded-full bg-line" />
            <span className="h-2 w-[52px] rounded-full bg-line-strong" />
          </span>
        </span>

        <div data-reveal="lift" className="plot-panel absolute inset-x-6 top-14 rounded-xl px-4 pb-1.5 pt-4 sm:inset-x-8">
          <span className="block text-caption text-ink-500">Balance due</span>
          {/* The balance ROLLS: what was due leaves upward as what is due now comes up under it. */}
          <span className="mt-0.5 grid overflow-hidden">
            <span data-on={on(0, 2)} className="plot-roll-up col-start-1 row-start-1 text-display tabular-nums text-ink-900">$2,800</span>
            <span data-on={on(2)} className="plot-roll col-start-1 row-start-1 text-display tabular-nums text-ink-900">$0</span>
          </span>
          <span className="grid">
            <span data-on={on(0, 2)} className="plot-swap col-start-1 row-start-1 text-caption text-ink-500">Due Oct 5</span>
            <span data-on={on(2)} className="plot-swap col-start-1 row-start-1 text-caption text-success-600">Paid in full, Oct 3</span>
          </span>
          <span className="mt-3.5 block h-px bg-line-soft" />
          {BILLS.map((b, i) => (
            <span key={b.no} className={cn('flex h-[42px] items-center gap-2.5 text-caption', i > 0 && 'border-t border-line-soft')}>
              <span className="w-14 shrink-0 font-mono text-ink-500">{b.no}</span>
              <span className="flex-1 truncate text-ink-900">{b.what}</span>
              <span className="tabular-nums text-ink-900">{b.amount}</span>
              {/* The venue deposit is the one that moves: it asks to be looked at once, then turns. */}
              {i === 0 ? (
                <span className="relative grid w-11 shrink-0">
                  <span aria-hidden data-on={on(1, 2)} className="plot-ping col-start-1 row-start-1 rounded-md ring-2 ring-warning-600" />
                  <span data-on={on(0, 2)} className="plot-swap col-start-1 row-start-1 grid h-5 place-items-center rounded-md bg-warning-100 text-micro font-medium text-warning-600">Sent</span>
                  <span data-on={on(2)} className="plot-swap col-start-1 row-start-1 grid h-5 place-items-center rounded-md bg-success-100 text-micro font-medium text-success-600">Paid</span>
                </span>
              ) : (
                <span className="grid h-5 w-11 shrink-0 place-items-center rounded-md bg-success-100 text-micro font-medium text-success-600">Paid</span>
              )}
            </span>
          ))}
        </div>

        <Stamp what="INV-002 paid" when="Oct 3" data-on={on(3)} className="plot-in left-[136px] top-[282px]" />
      </Plot>
    </Card>
  );
}

// ── THE SECTION ─────────────────────────────────────────────────────────────

export function PortalSection() {
  return (
    <Row id="portal" aria-labelledby="portal-title" className={HUE[CHAPTER.portal]}>
      <Cell pad className="site-head">
        <div className="site-reveal flex flex-col justify-between gap-8 lg:flex-row lg:items-end lg:gap-12">
          <div>
            <Eyebrow hue={CHAPTER.portal} icon={Users}>Client portal</Eyebrow>
            <h2 id="portal-title" className="mt-6 max-w-[22ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline">
              Your client sees the work, <span className="text-site-second">not the workspace.</span>
            </h2>
          </div>
          <p className="max-w-[416px] text-lead leading-6 text-ink-600">
            Share a project with one link. Your client follows progress, sends requests and signs off on work, without an account. You decide what they see.
          </p>
        </div>
      </Cell>

      <CardLink />
      <CardVisibility />
      <CardRequests />
      <CardApprovals />
      <CardInvoices />
    </Row>
  );
}
