'use client';
// ── WHO IT'S FOR ────────────────────────────────────────────────────────────
//
// Three kinds of creative business, each a person at work. One row of the grid, split unevenly (the
// freelancer wide, the studio and the consultant narrow) so it reads as a page of photographs rather
// than three equal cards. The wide cell ends on the same column as every product area below it, so the
// line between them runs on down the page.
//
// The photographs illustrate who Zenboard is for. They are not customers: no names, no quotes, no
// companies. A face with a made-up testimonial is a claim the product cannot stand behind.
//
// ── IT ASKS A QUESTION NOW (2026-09-26) ────────────────────────────────────
// User: "I want every section to have an interaction for users." This section was the only one on
// the page with none — three photographs and a sentence that was true of all of them. It is a
// CHOICE now, and the choice is the one thing a stranger actually wants to make on a page like
// this: *which of these is me?* Picking one answers it — the sentence under the heading becomes
// that person's, and three chips name the parts of Zenboard they would live in.
//
// It is a real tab set (Radix, the same grammar as every other list on this site), so arrow keys
// move between the people and the panel is labelled by the chosen one. Colour marks the chosen
// card and nothing else, which is the page's rule everywhere (`site-feature-tile`, Calendly's
// rule). No auto-advance: the other lists turn their own pages because they are SHOWING you
// things, and this one is asking you something — a question that answers itself every six seconds
// is not a question.

import * as React from 'react';
import { Tabs as RT } from 'radix-ui';
import { cn } from '@/lib/cn';
import { Users, type IconType, Sun, Folder, Wallet, Check, FileText, Timer } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { Cell, Eyebrow, HUE, Row, type Hue } from './visual';
import { Words } from './words';

type Person = {
  src: string;
  who: string;
  line: string;
  /** What this person would live in: three real places in the product, named as the app names them. */
  uses: { label: string; icon: IconType }[];
  hue: Hue;
  span: string;
  focus: string;
};

const PEOPLE: Person[] = [
  {
    src: '/site/people-freelancer.webp',
    who: 'Freelancers',
    line: 'Plan the day, keep every client close, and get paid without a spreadsheet.',
    uses: [{ label: 'Home', icon: Sun }, { label: 'Tasks', icon: Check }, { label: 'Finance', icon: Wallet }],
    hue: 'apricot',
    span: 'lg:col-span-6',
    focus: 'object-[50%_30%]',
  },
  {
    src: '/site/people-studio.webp',
    who: 'Studios',
    line: 'Every project, its client and its next move, in one place.',
    uses: [{ label: 'Projects', icon: Folder }, { label: 'Clients', icon: Users }, { label: 'Portal', icon: FileText }],
    hue: 'sky',
    span: 'lg:col-span-3',
    focus: 'object-center',
  },
  {
    src: '/site/people-consultant.webp',
    who: 'Consultants',
    line: 'Proposals, notes and invoices beside the work, and a page each client can open.',
    uses: [{ label: 'Documents', icon: FileText }, { label: 'Focus', icon: Timer }, { label: 'Finance', icon: Wallet }],
    hue: 'petal',
    span: 'lg:col-span-3',
    focus: 'object-[50%_25%]',
  },
];

export function People() {
  const [who, setWho] = React.useState(0);
  const chosen = PEOPLE[who];

  return (
    <RT.Root asChild value={String(who)} onValueChange={(v) => setWho(Number(v))}>
      <Row id="who" aria-labelledby="people-title">
        <Cell pad className="py-14 sm:py-16 lg:py-20">
          <div data-reveal-group className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
            <div>
              <Eyebrow hue="apricot" icon={Users} data-reveal="rise">Who it’s for</Eyebrow>
              <h2 id="people-title" data-reveal="words" className="mt-6 max-w-[20ch] text-balance font-editorial text-h1 text-ink-900 sm:text-headline">
                <Words>Made for the people who run the business and do the work.</Words>
              </h2>
            </div>
            {/* The answer to the choice, in the reader's own place on the page. `key` makes each
                answer a new element, so it arrives rather than mutating — the one animation here,
                and it is a fade with a hair of rise (`site-swap`), not a slide. */}
            <div data-reveal="rise" className="max-w-[44ch]">
              <p key={who} className="site-swap text-body-lg text-ink-600">{chosen.line}</p>
              <ul key={`${who}-uses`} className="site-swap mt-4 flex flex-wrap gap-2" aria-label={`What ${chosen.who.toLowerCase()} use most`}>
                {chosen.uses.map((u) => (
                  <li key={u.label} className={cn('site-tile flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium', HUE[chosen.hue])}>
                    <Icon icon={u.icon} size={14} weight="fill" />{u.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Cell>

        {/* `contents`, not `asChild`: the list has to be a REAL element for Radix to own the
            roving focus (arrow keys between the people), and `asChild` onto a fragment silently
            gives it nothing to hold — the cards still toggled, and the arrow keys did nothing.
            `display: contents` keeps the cards as direct children of the row's subgrid. */}
        <RT.List className="contents" aria-label="Who it’s for">
        {PEOPLE.map((p, i) => (
            <Cell key={p.who} className={cn('group overflow-hidden', p.span)}>
              <RT.Trigger
                value={String(i)}
                className="focus-ring block h-full w-full text-start"
                aria-label={`${p.who}: ${p.line}`}
              >
                <figure data-reveal="lift" className="flex h-full flex-col">
                  <div className="overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in /public; there is nothing for next/image to do on this host */}
                    <img
                      src={p.src}
                      alt=""
                      width={800}
                      height={1000}
                      loading="lazy"
                      decoding="async"
                      className={cn(
                        'h-[22rem] w-full object-cover transition-[transform,filter] duration-slow ease-out-quiet sm:h-[26rem]',
                        p.focus,
                        // The chosen one is in colour and a touch closer; the others wait in black and
                        // white (user, 2026-09-26), warming a little under the pointer. A filter, not
                        // an overlay: a scrim over a photograph reads as a disabled control.
                        i === who ? 'scale-[1.02]' : 'grayscale group-hover:scale-[1.01] group-hover:grayscale-[55%]',
                      )}
                    />
                  </div>
                  <figcaption className="flex flex-1 items-start gap-3 px-5 py-6 sm:px-6">
                    <span
                      aria-hidden
                      className={cn(
                        'site-feature-tile mt-0.5 grid size-7 shrink-0 place-items-center rounded-md',
                        HUE[p.hue],
                      )}
                      data-state={i === who ? 'active' : 'inactive'}
                    >
                      <Icon icon={p.uses[0].icon} size={16} className="site-glyph-line col-start-1 row-start-1" />
                      <Icon icon={p.uses[0].icon} size={16} weight="fill" className="site-glyph-fill col-start-1 row-start-1" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-body-lg font-medium transition-colors duration-fast ease-hover', i === who ? 'text-ink-900' : 'text-ink-600')}>{p.who}</span>
                      <span className="mt-1 block max-w-[36ch] text-ui text-ink-600">{p.line}</span>
                    </span>
                  </figcaption>
                </figure>
              </RT.Trigger>
            </Cell>
          ))}
        </RT.List>
      </Row>
    </RT.Root>
  );
}
