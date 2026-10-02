'use client';
// ── THE PRODUCT MENU ────────────────────────────────────────────────────────
//
// Built from the user's design canvas (claude.ai/artifact/3HAMhbe4fYnVCyP4nkHYnz, "Site navigation
// · micro illustrations"): six places in two columns, each a card with a drawing of itself, and a
// narrow aside holding everything else Zenboard has plus the launch film.
//
// ── WHAT THE CANVAS ARGUES, AND WHY IT WINS ────────────────────────────────
// The menu this replaces showed FOUR places, each explained at length, plus a featured cell. The
// canvas shows SIX at a glance with one line each, and that is the better shape for a menu: a menu
// is a list of where you can go, not a place to read. Anything that needs explaining is a section
// on the page, and the page is one click away.
//
// ── THE ITEM, AND ITS ONE INTERACTION ──────────────────────────────────────
// At rest an item shows its KEYBOARD SHORTCUT; under the pointer the shortcut becomes an ARROW,
// the card lifts to white with a ring, and its drawing is used — the highlight gets ticked, the
// card lands in its column, the invoice reads Paid. One gesture, and it teaches the shortcut to
// anyone who never hovers long enough to read it.
//
// Every place shows ONE affordance, a chevron, and no keyboard hint: the shortcut chips that used
// to sit beside each title were removed on the user's instruction (2026-09-27), and with them the
// `IconSwap` that crossfaded chip into arrow. A keyboard opens this menu with no animation at all
// (`zb-enter`).

import Link from 'next/link';
import * as React from 'react';
import {
  Calendar, ChevronRight, Check, FileText, Flame, Folder, House, Inbox, Landmark, ListChecks, Play, Target, Users,
  type IconType,
} from '@/components/ds/icons';
import { Icon, Modal } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import {
  DocsScene, FinanceScene, HomeScene, InboxScene, NAV_SCENE, PortalScene, ProjectsScene,
} from './nav-art';
import { CHAPTER, HUE, type Hue } from './visual';

/** The film, its poster and its real length — read off the file, not guessed (73.557s). */
export const FILM = { src: '/film/zenboard-launch.mp4', poster: '/film/zenboard-launch.jpg', length: '1:13' } as const;

type Place = {
  href: string; title: string; body: string; hue: Hue; Scene: () => React.ReactElement;
};

/** The six places, in the canvas's own order: the day first, the work after it, the money last. */
const PLACES: Place[] = [
  { href: '/#day', title: 'Home', body: 'Your day in one place, with the one thing that matters first.', hue: CHAPTER.day, Scene: HomeScene },
  { href: '/#day', title: 'Inbox', body: 'Everything that arrived, filed in one pass.', hue: CHAPTER.day, Scene: InboxScene },
  { href: '/#projects', title: 'Projects', body: 'Boards, your calendar, briefs and what you are waiting on.', hue: CHAPTER.projects, Scene: ProjectsScene },
  { href: '/#portal', title: 'Client portal', body: 'One link your client can follow. No login, no account.', hue: CHAPTER.portal, Scene: PortalScene },
  { href: '/#details', title: 'Docs', body: 'Briefs and notes that link to the work they are about.', hue: CHAPTER.projects, Scene: DocsScene },
  { href: '/#money', title: 'Finance', body: 'Invoices from your tracked time, and what has been paid.', hue: CHAPTER.money, Scene: FinanceScene },
];

/** Everything else the product has: a name and a glyph. */
const MORE: { href: string; icon: IconType; title: string }[] = [
  { href: '/#day', icon: ListChecks, title: 'Tasks' },
  { href: '/#projects', icon: Calendar, title: 'Calendar' },
  { href: '/#portal', icon: Users, title: 'Clients' },
  { href: '/#details', icon: FileText, title: 'Forms' },
  { href: '/#how', icon: Target, title: 'Goals' },
  { href: '/#day', icon: Flame, title: 'Habits' },
];

/** One place: its words on the left, its drawing cropped off the right edge. */
function PlaceCard({ p }: { p: Place }) {
  return (
    <Link
      href={p.href}
      className={cn(
        'site-art group focus-ring relative isolate block overflow-hidden rounded-lg bg-popover p-5',
        // The hover is a RING plus a wash. The canvas draws it as the card turning white with a
        // ring — but a state is a wash here and never an elevation (app/theme-bridge.test.ts),
        // and white IS the elevation. The ring is what the canvas is actually saying ("this one
        // is under your hand"), so the ring stays and the fill becomes the house's wash.
        //
        // WHICH wash, though, is a question of AREA (user, 2026-09-27: "this hover grey is so dark,
        // I want subtle"). `surface-hover` is ink at 5%, which is right for a 32px row and heavy
        // across a card this size — and it COMPOUNDED: the drawings set their own surfaces in
        // `surface-fill` (6%), so a hovered card stacked 6% on 5% and the scene went muddy, which is
        // the fill-on-fill the house forbids. `surface-row` is the same ladder's quietest step
        // (2.5%) and exists for exactly this: a large, calm surface. The RING does the work of
        // saying which card is under the hand; the wash only has to agree with it.
        'transition-[background-color,box-shadow] duration-[var(--site-hover)] ease-hover',
        'hover:bg-surface-row hover:shadow-[inset_0_0_0_1px_var(--color-border-panel)]',
        HUE[p.hue],
      )}
    >
      <span className="relative z-[1] block max-w-[12.25rem]">
        <span className="flex items-center gap-2">
          <span className="text-ui font-medium tracking-tight text-ink-900">{p.title}</span>
          {/* The shortcut chip that used to sit here is gone (user, 2026-09-27: "remove this
              shortcut, I don't like it"). It was a promise the website could not keep — G T means
              nothing until you are signed in — and it put a second, competing label beside every
              title. What is left is the affordance itself: one chevron, always there, nudging under
              the hand on the same 100ms and the same curve the card's own wash uses. */}
          <Icon icon={ChevronRight} size={12} className="text-ink-500 transition-transform duration-fast ease-hover group-hover:translate-x-0.5" nudge="end" />
        </span>
        <span className="mt-1.5 block text-small text-ink-600">{p.body}</span>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute end-0 top-0 max-[52rem]:hidden"
        style={{ width: NAV_SCENE.width, height: NAV_SCENE.height }}
      >
        <p.Scene />
      </span>
    </Link>
  );
}

/** The launch film: its poster in the menu, the film itself in a dialog. */
function FilmCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring group flex flex-col gap-2.5 rounded-lg text-start"
      >
        <span className="relative block h-[84px] overflow-hidden rounded-lg bg-ink-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- a poster frame, pre-sized in /public */}
          <img src={FILM.poster} alt="" width={1280} height={720} loading="lazy" decoding="async"
            className="size-full object-cover object-top opacity-90 transition-transform duration-slow ease-out-quiet motion-safe:group-hover:scale-[1.03]" />
          <span aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="grid size-7 place-items-center rounded-full bg-[var(--color-paper)] shadow-lift-2">
              <Icon icon={Play} size={12} weight="fill" className="ms-px text-ink-900" />
            </span>
          </span>
          <span aria-hidden className="absolute end-2 bottom-2 rounded-xs bg-[color-mix(in_oklab,var(--color-ink-900)_55%,transparent)] px-1.5 font-mono text-micro leading-4 text-[var(--color-paper)]">{FILM.length}</span>
        </span>
        <span className="flex items-center justify-between text-caption font-medium text-ink-900">
          Watch the launch film
          <Icon icon={ChevronRight} size={12} className="text-ink-500" nudge="end" />
        </span>
      </button>

      <Modal open={open} onOpenChange={setOpen} size="lg" title="The Zenboard launch film" description={`${FILM.length} · no sound needed`}>
        {/* `preload="none"`: the file is 23 MB, and a menu nobody opened should not have fetched
            it. `controls` and nothing else: it never starts on its own, which is both the
            reduced-motion answer and the polite one. */}
        <video
          src={FILM.src}
          poster={FILM.poster}
          controls
          playsInline
          preload="none"
          className="aspect-video w-full rounded-lg bg-ink-900"
        />
      </Modal>
    </>
  );
}

/**
 * THE MENU. A piece of the page's own grid: cells one line apart, so where four cards meet their
 * corners leave the concave star at the heart of the mark, as every joint on the page does. It
 * spans the navigation bar edge to edge, so it lines up with the wordmark and the button rather
 * than hanging from wherever the trigger happens to be.
 */
export function ProductMenu() {
  return (
    <div className="@container">
      <div className="grid gap-px bg-line @min-[60rem]:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid grid-cols-1 gap-px @min-[36rem]:grid-cols-2">
          {PLACES.map((p) => <PlaceCard key={p.title} p={p} />)}
        </div>

        <aside aria-label="More in Zenboard" className="flex flex-col rounded-lg bg-popover p-5">
          <p className="text-overline">More in Zenboard</p>
          <ul className="mt-2 flex flex-col">
            {MORE.map((m) => (
              <li key={m.title}>
                <Link href={m.href} className="focus-ring group flex h-[30px] items-center gap-2.5 rounded-md text-small text-ink-900">
                  <Icon icon={m.icon} size={14} className="text-ink-500" />
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
          <span aria-hidden className="my-3.5 h-px bg-line" />
          <FilmCard />
        </aside>
      </div>
    </div>
  );
}

/** The same six places as a phone's list: the drawings go, the words stay. */
export function ProductMenuMobile() {
  return (
    <>
      {PLACES.map((p) => (
        <Link key={p.title} href={p.href} className="focus-ring touch-row group flex items-center gap-3 rounded-md px-3 py-2.5 text-ui text-ink-900 hover:bg-surface-hover">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{p.title}</span>
            <span className="mt-0.5 block truncate text-caption text-ink-500">{p.body}</span>
          </span>
          <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-500" nudge="end" />
        </Link>
      ))}
    </>
  );
}

/** Kept beside the menu so the icon list and the place list cannot drift apart. */
export const NAV_ICONS: Record<string, IconType> = {
  Home: House, Inbox, Projects: Folder, 'Client portal': Users, Docs: FileText, Finance: Landmark, Done: Check,
};
