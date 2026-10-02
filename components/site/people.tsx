'use client';
// ── WHO IT'S FOR ────────────────────────────────────────────────────────────
//
// The people who run a business and do the work in it, one profession at a time: a freelancer, a
// creator, a designer, a founder, a personal trainer, a consultant, a dance teacher, a lawyer. The
// user, 2026-09-28: "I want to show different profession people use Zenboard … in Zenboard branding
// and Zenboard style", with a reference of people standing in front of painted cards, a piece of the
// product resting across them.
//
// The photographs illustrate who Zenboard is for. They are not customers: no names, no quotes, no
// companies. A face with a made-up testimonial is a claim the product cannot stand behind. Left out on
// purpose: the doctor (a doctor on this page implies patient records, which Zenboard is not built or
// certified to hold) and the team shots (teams need shared seats, which do not exist yet).
//
// ── HOW EACH CARD IS MADE ─────────────────────────────────────────────────
// A card is one of the page's pictures, small: the field of a PLACE in the product, its grain, and
// on the one in the middle the mark printed in light (the halftone is a live canvas, so it prints on
// one card and not eight). The person is cut out of their photograph (macOS Vision, 2026-09-28) and
// stands in front of the card with their head above its top edge. Across them rests ONE real thing
// from their day in Zenboard, drawn as the page's other resting pieces are (`cardClass` + `site-lift`).
//
// The card's colour is the colour of the place that thing comes from, read from `CHAPTER` like every
// other colour on this page: a trainer's session is on their day (butter), a designer's approval is
// in the client portal (periwinkle). Two people per place, and no two neighbours share one.
//
// ── IT ASKS A QUESTION (2026-09-26, kept) ─────────────────────────────────
// Choosing a person answers *which of these is me?*: the line under the heading becomes theirs, and
// three chips name the parts of Zenboard they would live in. It is a real tab set (Radix), so arrow
// keys move between the people and the panel is labelled by the chosen one. It turns its own pages on
// the site's one grammar (`useAutoAdvance`), holding while the pointer rests on it, while it is off
// screen, and whenever less motion is asked for.
//
// ── THE RING ──────────────────────────────────────────────────────────────
// The chosen person stands in the middle at full size; their neighbours stand smaller on either side,
// cut by the cell's edges, so the row reads as a line of people rather than a gallery of eight. Each
// card's place is its distance from the chosen one the short way round the ring, so turning past the
// last person arrives at the first without the row rewinding. A card more than two places away is out
// of sight, and it is the only one that moves without a transition: it jumps round the back.

import * as React from 'react';
import { Tabs as RT } from 'radix-ui';
import { cn } from '@/lib/cn';
import { Calendar, Check, CheckCircle, FileText, Folder, Forms, Highlight, Kanban, Link as LinkIcon, Receipt, Sun, Timer, Users, Wallet, type IconType } from '@/components/ds/icons';
import { Icon, cardClass } from '@/components/ds/ui';
import { Halftone, type MarkPlacement } from './halftone';
import { Dwell, useAutoAdvance } from './use-auto-advance';
import { CHAPTER, Cell, Eyebrow, HUE, Mesh, Row, type Field, type Hue } from './visual';
import { Title } from './words';

type Person = {
  /** The person, cut out of their photograph: a transparent WebP, 1100 high. */
  src: string;
  /** Its width at 1100 high, so the browser reserves the room before it loads. */
  width: number;
  who: string;
  line: string;
  /** What this person would live in: three real places in the product, named as the app names them. */
  uses: { label: string; icon: IconType }[];
  /** The place their chip comes from, which is the card's colour. */
  place: keyof typeof CHAPTER;
  /** Where the mark sits in the print behind them. */
  mark: MarkPlacement;
  /** One real thing from their day in Zenboard. */
  chip: { icon: IconType; label: string; detail: string; side: 'start' | 'end' };
  /** How tall they stand against the card (1 = the card's height). A raised arm needs a little more. */
  stand?: number;
};

const FIELD: Record<Person['place'], Field> = { day: 'day', projects: 'projects', portal: 'portal', money: 'money' };

const PEOPLE: Person[] = [
  {
    src: '/site/people/freelancer.webp',
    width: 639,
    who: 'Freelancers',
    line: 'Plan the day, keep every client close, and get paid without a spreadsheet.',
    uses: [{ label: 'Home', icon: Sun }, { label: 'Tasks', icon: Check }, { label: 'Finance', icon: Wallet }],
    place: 'day',
    mark: { x: 0.82, y: 0.34, size: 1.15 },
    chip: { icon: Highlight, label: 'Highlight', detail: 'Send the Ridgeline invoice', side: 'start' },
  },
  {
    src: '/site/people/creator.webp',
    width: 537,
    who: 'Creators',
    line: 'Every piece from idea to published, beside the clients and sponsors who pay for it.',
    uses: [{ label: 'Content', icon: Kanban }, { label: 'Clients', icon: Users }, { label: 'Finance', icon: Wallet }],
    place: 'projects',
    mark: { x: 0.2, y: 0.4, size: 1.1 },
    chip: { icon: Kanban, label: 'Scheduled', detail: 'Newsletter, issue 12', side: 'end' },
  },
  {
    src: '/site/people/designer.webp',
    width: 697,
    who: 'Designers',
    line: 'Share each round in the client’s portal, and keep every approval on the record.',
    uses: [{ label: 'Projects', icon: Folder }, { label: 'Client portal', icon: LinkIcon }, { label: 'Documents', icon: FileText }],
    place: 'portal',
    mark: { x: 0.8, y: 0.62, size: 1.2 },
    chip: { icon: CheckCircle, label: 'Approved', detail: 'Logo, round 2', side: 'start' },
  },
  {
    src: '/site/people/founder.webp',
    width: 578,
    who: 'Founders',
    line: 'Projects, clients and money on one calm Home, so you can see the whole business at once.',
    uses: [{ label: 'Home', icon: Sun }, { label: 'Projects', icon: Folder }, { label: 'Finance', icon: Wallet }],
    place: 'money',
    mark: { x: 0.22, y: 0.3, size: 1.1 },
    chip: { icon: Wallet, label: 'Paid this month', detail: '$6,000', side: 'end' },
  },
  {
    src: '/site/people/trainer.webp',
    width: 600,
    who: 'Personal trainers',
    line: 'Sessions on your calendar, every client in one place, and invoices that go out on time.',
    uses: [{ label: 'Calendar', icon: Calendar }, { label: 'Clients', icon: Users }, { label: 'Finance', icon: Wallet }],
    place: 'day',
    mark: { x: 0.78, y: 0.5, size: 1.1 },
    chip: { icon: Calendar, label: '7:00 AM', detail: 'Session with Maya', side: 'start' },
  },
  {
    src: '/site/people/consultant.webp',
    width: 774,
    who: 'Consultants',
    line: 'Proposals, notes and invoices beside the work, and a page each client can open.',
    uses: [{ label: 'Documents', icon: FileText }, { label: 'Focus', icon: Timer }, { label: 'Finance', icon: Wallet }],
    place: 'projects',
    mark: { x: 0.2, y: 0.62, size: 1.15 },
    chip: { icon: FileText, label: 'Proposal signed', detail: 'Beacon Health', side: 'end' },
  },
  {
    src: '/site/people/dance-teacher.webp',
    width: 624,
    who: 'Dance teachers',
    line: 'A sign-up form for every class, and each student’s payments in one place.',
    uses: [{ label: 'Forms', icon: Forms }, { label: 'Calendar', icon: Calendar }, { label: 'Finance', icon: Wallet }],
    place: 'portal',
    mark: { x: 0.8, y: 0.36, size: 1.1 },
    chip: { icon: Forms, label: '8 new sign-ups', detail: 'Spring classes', side: 'start' },
    stand: 1.3,
  },
  {
    src: '/site/people/lawyer.webp',
    width: 656,
    who: 'Lawyers',
    line: 'Log the hours on each matter, and turn them into an invoice in one step.',
    uses: [{ label: 'Projects', icon: Folder }, { label: 'Focus', icon: Timer }, { label: 'Finance', icon: Wallet }],
    place: 'money',
    mark: { x: 0.2, y: 0.5, size: 1.1 },
    chip: { icon: Receipt, label: 'Invoice drafted', detail: '6h 30m, $975', side: 'end' },
  },
];

/** A card's place in the ring: its distance from the chosen one, the short way round. */
function ringOffset(i: number, chosen: number, count: number) {
  let o = (i - chosen) % count;
  if (o > count / 2) o -= count;
  if (o <= -count / 2) o += count;
  return o;
}

export function People() {
  const { ref, active: who, running, choose, next, hold } = useAutoAdvance(PEOPLE.length);
  const chosen = PEOPLE[who];
  const chosenHue: Hue = CHAPTER[chosen.place];

  return (
    <RT.Root asChild value={String(who)} onValueChange={(v) => choose(Number(v))}>
      <Row id="who" aria-labelledby="people-title" ref={ref} data-running={running} {...hold}>
        <Cell pad className="site-head">
          <div data-reveal-group className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
            <div>
              <Eyebrow hue="neutral" icon={Users} data-reveal="rise">Who it’s for</Eyebrow>
              <h2 id="people-title" data-reveal="words" className="mt-6 max-w-[22ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline">
                <Title then="and do the work.">Made for the people who run the business</Title>
              </h2>
            </div>
            {/* The answer to the choice, in the reader's own place on the page. `key` makes each
                answer a new element, so it arrives rather than mutating (`site-swap`). */}
            <div data-reveal="rise" className="max-w-[44ch]">
              {/* THE TAB'S PANEL: the chosen trigger's `aria-controls` names it. */}
              <RT.Content value={String(who)} className="focus-ring rounded-md">
                <p key={who} className="site-swap max-w-[416px] text-lead leading-6 text-ink-600">{chosen.line}</p>
                <ul key={`${who}-uses`} className="site-swap mt-4 flex flex-wrap gap-2" aria-label={`What ${chosen.who.toLowerCase()} use most`}>
                  {chosen.uses.map((u) => (
                    <li key={u.label} className={cn('site-chip text-ui font-medium', HUE[chosenHue])}>
                      <Icon icon={u.icon} size={14} weight="fill" className="text-ink-700" />{u.label}
                    </li>
                  ))}
                </ul>
              </RT.Content>
            </div>
          </div>
        </Cell>

        {/* THE RING. One cell, clipped at its edges, so the neighbours are cut the way a row of
            people is cut by a window. `contents` would lose the roving focus, so the list is a real
            element (Radix needs one to hold it). */}
        <Cell className="col-span-full overflow-hidden">
          <RT.List aria-label="Who it’s for" className="site-people relative">
            {PEOPLE.map((p, i) => {
              const o = ringOffset(i, who, PEOPLE.length);
              const on = i === who;
              const hue = CHAPTER[p.place];
              return (
                <div
                  key={p.who}
                  className="site-person"
                  data-active={on || undefined}
                  data-far={Math.abs(o) > 2 || undefined}
                  style={{ '--ring': o } as React.CSSProperties}
                >
                  <RT.Trigger
                    value={String(i)}
                    // NAMED BY WHAT IT SHOWS: the profession under the card (the chip across the photo
                    // is aria-hidden). It carried "who: line" as a label once, which put words in the
                    // name that are not on the button and missed the chip's that are (WCAG 2.5.3,
                    // axe 2026-09-28); the line is in the panel this tab controls.
                    className="focus-ring group flex w-full flex-col items-center rounded-xl text-center"
                  >
                    <span className="site-person-card">
                      <span aria-hidden className={cn('site-field absolute inset-0 overflow-hidden rounded-xl', `site-field-${FIELD[p.place]}`)}>
                        <Mesh />
                        {on && <Halftone mark={p.mark} pitch={7} weight={0.85} className="site-screen" />}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in /public; there is nothing for next/image to do on this host */}
                      <img
                        src={p.src}
                        alt=""
                        width={p.width}
                        height={1100}
                        loading={Math.abs(o) > 1 ? 'lazy' : 'eager'}
                        decoding="async"
                        draggable={false}
                        className="site-person-photo"
                        style={{ '--stand': p.stand ?? 1.22 } as React.CSSProperties}
                      />
                      <span
                        aria-hidden
                        key={on ? 'on' : 'off'}
                        className={cardClass(cn(
                          'site-lift site-person-chip flex items-center gap-2.5 whitespace-nowrap rounded-lg py-2 ps-2 pe-3.5 text-ui',
                          p.chip.side === 'start' ? 'start-[6%]' : 'end-[6%]',
                          on && 'site-swap',
                        ))}
                      >
                        <span className={cn('site-tile grid size-7 shrink-0 place-items-center rounded-md', HUE[hue])}>
                          <Icon icon={p.chip.icon} size={16} weight="fill" />
                        </span>
                        <span className="font-medium text-ink-900">{p.chip.label}</span>
                        <span className="text-ink-600 max-sm:hidden">{p.chip.detail}</span>
                      </span>
                    </span>

                    <span className="mt-5 flex items-center gap-3">
                      {/* The marker takes the AREA'S hue, not the brand's: a berry ring round a
                          butter tile is two colours doing one job. `HUE[hue]` sits on the Dwell so
                          `--site-hue-ink` is in scope for the dots and the line, as it already is
                          for the rule under a feature row. */}
                      <Dwell active={on} size={36} radius={11} onEnd={next} className={HUE[hue]}>
                        {/* EVERY person wears their box, always, in their own area's colour (user,
                            2026-09-28: "I just want box in all the card but in their colour, and when
                            it's active the dotted line comes"). So it is `site-tile`, which is coloured
                            wherever it appears — not `site-feature-tile`, which is quiet until the item
                            is the one showing. That one was also never lighting up here at all: its rule
                            is `[data-state='active'] .site-feature-tile`, a DESCENDANT selector, and the
                            attribute was on the tile itself, so the active person's box was transparent
                            too. The thing that marks the active one is the ring, which is the point. */}
                        <span aria-hidden className={cn('site-tile grid size-7 place-items-center rounded-md', HUE[hue])}>
                          <Icon icon={p.chip.icon} size={16} state={on} />
                        </span>
                      </Dwell>
                      <span className={cn('text-body-lg font-medium transition-colors duration-fast ease-hover', on ? 'text-ink-900' : 'text-ink-600 group-hover:text-ink-900')}>{p.who}</span>
                    </span>
                  </RT.Trigger>
                </div>
              );
            })}
          </RT.List>
        </Cell>
      </Row>
    </RT.Root>
  );
}
