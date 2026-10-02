'use client';
// ── ONE REQUEST, FROM ASK TO PAID ───────────────────────────────────────────
//
// The page's explanation of why Zenboard's parts are one product: a single thing travelling through
// it. Priya asks for social sizes of the logo in her portal; it arrives on your day as a task; you do
// it and she hears it is ready; she approves it and the invoice goes out; she pays and your day says
// so. Three parts of the product (her portal, Zenboard, your day) and the thing passing between them,
// carried along a track. Across on a wide screen; down on a phone, where the parts stack.
//
// Every step starts with someone doing something (static: it is already done when the step begins),
// then two hops, and whatever the second hop reaches appears as it lands. The steps are a tab set
// that turns itself, the same grammar as every product area (use-auto-advance.tsx). The pictures are
// what the step list says, drawn; so the drawing is hidden from assistive technology, and each panel
// says its step in words.

import * as React from 'react';
import { Tabs as RT } from 'radix-ui';
import { Check, Eye, Landmark, MessageCircle, Orbit, Receipt, SquareCheck, Wallet, type IconType } from '@/components/ds/icons';
import { Avatar, Badge, Button, Checkbox, Icon, Mark, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { FACES } from './faces';
import { Halftone } from './halftone';
import { Dwell, useAutoAdvance } from './use-auto-advance';
import { CHAPTER, Cell, Eyebrow, HUE, Joints, Mesh } from './visual';
import { Title } from './words';

/** The track between Zenboard and her portal, or between Zenboard and your day. */
type Track = 'portal' | 'day';
type Hop = { track: Track; inward: boolean; label: string; icon: IconType };

/** Each step happens in one place of the product, and its number wears that place's colour. */
const STEPS: { title: string; body: string; log: string; place: keyof typeof CHAPTER; hops: [Hop, Hop] }[] = [
  {
    title: 'She asks',
    place: 'portal',
    body: 'Priya asks for social sizes of the logo, in her portal.',
    log: 'A request, turned into a task',
    hops: [
      { track: 'portal', inward: true, label: 'Request', icon: MessageCircle },
      { track: 'day', inward: false, label: 'New task', icon: SquareCheck },
    ],
  },
  {
    title: 'You do it',
    place: 'day',
    body: 'It lands on today’s plan. You tick it off, and she hears it is ready.',
    log: 'Done, and sent for review',
    hops: [
      { track: 'day', inward: true, label: 'Done', icon: Check },
      { track: 'portal', inward: false, label: 'Ready for review', icon: Eye },
    ],
  },
  {
    title: 'She approves',
    place: 'portal',
    body: 'One press in her portal, and the invoice goes out by itself.',
    log: 'Approved, and invoiced',
    hops: [
      { track: 'portal', inward: true, label: 'Approved', icon: Check },
      { track: 'portal', inward: false, label: 'INV-022 · $450', icon: Receipt },
    ],
  },
  {
    title: 'She pays',
    place: 'money',
    body: 'Her payment lands in Finance, and your day tells you.',
    log: 'Paid, and in Finance',
    hops: [
      { track: 'portal', inward: true, label: '$450 paid', icon: Wallet },
      { track: 'day', inward: false, label: 'Paid', icon: Landmark },
    ],
  },
];

/** Appears when the n-th hop of its step lands; `null` is already there when the step begins. */
const arrive = (hops: number | null) =>
  hops == null ? {} : { className: 'site-arrive', style: { '--arrive-at': `calc(${hops} * var(--site-hop))` } as React.CSSProperties };

function Chip({ hop, at }: { hop: Hop; at: number }) {
  // The portal is left of Zenboard (above it on a phone) and your day right of it (below): so a hop
  // runs forward, from the track's start, when it goes in from the portal or out to your day.
  const forward = (hop.track === 'portal') === hop.inward;
  const far = (axis: 'cqw' | 'cqh') => `calc(100${axis} - 100%)`;
  const style = {
    '--hop-x0': forward ? '0px' : far('cqw'),
    '--hop-x1': forward ? far('cqw') : '0px',
    '--hop-y0': forward ? '0px' : far('cqh'),
    '--hop-y1': forward ? far('cqh') : '0px',
    '--hop-at': `calc(${at} * var(--site-hop))`,
  } as React.CSSProperties;
  return (
    <span
      style={style}
      className="site-hop absolute inset-x-0 top-0 mx-auto flex h-7 w-fit items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface-raised px-2 text-caption font-medium text-ink-800 shadow-xs lg:inset-x-auto lg:inset-y-0 lg:start-0 lg:my-auto lg:ms-0"
    >
      <Icon icon={hop.icon} size={14} weight="fill" className="text-ink-500" />
      {hop.label}
    </span>
  );
}

function TrackLine({ track, step }: { track: Track; step: number }) {
  return (
    <div className="relative h-16 w-full [container-type:size] lg:h-10">
      <span aria-hidden className="absolute inset-y-0 start-1/2 border-s border-dashed border-line-strong lg:hidden" />
      <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-line-strong max-lg:hidden" />
      {STEPS[step].hops.map((h, i) => h.track === track && <Chip key={i} hop={h} at={i} />)}
    </div>
  );
}

function Line({ title, end, hops = null }: { title: string; end: React.ReactNode; hops?: number | null }) {
  const a = arrive(hops);
  return (
    <div className={cn('flex items-center gap-2', a.className)} style={a.style}>
      <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{title}</span>
      {end}
    </div>
  );
}

function Portal({ step }: { step: number }) {
  return (
    <div data-reveal="lift" className={cardClass('site-glass w-full max-w-[18rem] rounded-xl p-4')}>
      <div className="flex items-center gap-2.5">
        <Avatar name="Priya Nair" src={FACES.priya} size="sm" decorative />
        <div className="min-w-0">
          <p className="truncate text-ui font-medium text-ink-900">Ridgeline rebrand</p>
          <p className="text-caption text-ink-500">Priya’s portal</p>
        </div>
      </div>
      <div className="mt-3 flex min-h-[6.5rem] flex-col gap-2.5 border-t border-line-soft pt-3">
        <p className="border-s-2 border-line ps-2.5 text-caption text-ink-800">Could we get social sizes of the logo?</p>
        {step >= 1 && (
          <Line
            title="Social sizes"
            hops={step === 1 ? 2 : null}
            end={step === 1 ? <Button size="xs" variant="secondary" tabIndex={-1}>Approve</Button> : <Badge status="success">Approved</Badge>}
          />
        )}
        {step >= 2 && (
          <Line
            title="INV-022 · $450"
            hops={step === 2 ? 2 : null}
            end={<Badge status={step === 3 ? 'success' : 'info'}>{step === 3 ? 'Paid' : 'Due Oct 20'}</Badge>}
          />
        )}
      </div>
    </div>
  );
}

function Hub({ step }: { step: number }) {
  const log = arrive(1);
  return (
    <div data-reveal="lift" className="flex flex-col items-center gap-3 py-2 lg:px-2">
      <div className="relative grid size-24 place-items-center">
        <svg viewBox="0 0 96 96" className="absolute inset-0 size-full text-line-strong">
          <circle cx="48" cy="48" r="46.5" fill="none" stroke="currentColor" strokeDasharray="2 5" />
        </svg>
        {/* The orbit: a short arc of the brand's colour going round the mark, the one thing always moving. */}
        <svg viewBox="0 0 96 96" className="site-orbit absolute inset-0 size-full text-accent">
          <path d="M48 1.5 A46.5 46.5 0 0 1 94.5 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="site-lift grid size-16 place-items-center rounded-full border border-line bg-surface-raised">
          <Mark size={30} tone="brand" />
        </span>
      </div>
      <p className="text-ui font-medium text-ink-900">Zenboard</p>
      <p className={cn('min-h-5 text-center text-caption text-ink-500', log.className)} style={log.style}>{STEPS[step].log}</p>
    </div>
  );
}

function Day({ step }: { step: number }) {
  const task = arrive(step === 0 ? 2 : null);
  const paid = arrive(step === 3 ? 2 : null);
  return (
    <div data-reveal="lift" className={cardClass('site-glass w-full max-w-[18rem] rounded-xl p-4')}>
      <div className="flex items-center gap-2">
        <Mark size={18} tone="brand" />
        <p className="font-editorial text-body-lg font-medium text-ink-900">Your day</p>
        <span className="ms-auto text-caption text-ink-500">Thursday</span>
      </div>
      <ul className="mt-3 flex min-h-[6.5rem] flex-col border-t border-line-soft">
        <li className="flex h-9 items-center gap-2.5">
          <Checkbox tabIndex={-1} />
          <span className="min-w-0 flex-1 truncate text-ui text-ink-900">Logo presentation</span>
        </li>
        <li className={cn('flex h-9 items-center gap-2.5 border-t border-line-soft', task.className)} style={task.style}>
          <Checkbox checked={step >= 1} tabIndex={-1} />
          <span className={cn('min-w-0 flex-1 truncate text-ui', step >= 1 ? 'text-ink-500 line-through' : 'text-ink-900')}>Social sizes of the logo</span>
          {step >= 2 && <Badge status="success">Approved</Badge>}
        </li>
        {step === 3 && (
          <li className={cn('flex h-9 items-center gap-2.5 border-t border-line-soft', paid.className)} style={paid.style}>
            <Icon icon={Landmark} size={16} weight="fill" className="text-success-600" />
            <span className="min-w-0 flex-1 truncate text-ui text-ink-900">Ridgeline paid $450</span>
          </li>
        )}
      </ul>
    </div>
  );
}

export function Loop() {
  // Destructured on purpose: reading a field off the object that also holds the ref reads, to the
  // React Compiler's rules, as reading the ref during render.
  const { ref, active, seen, running, choose, next, hold } = useAutoAdvance(STEPS.length);
  return (
    <RT.Root asChild value={String(active)} onValueChange={(v) => choose(Number(v))}>
      <section
        id="how"
        ref={ref}
        aria-labelledby="how-title"
        data-running={running}
        data-playing={seen}
        data-reveal="rule"
        {...hold}
        className="site-row col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px"
      >
        <Joints />
        {/* THE BAND: the page's one dark section (globals.css "the band"), and the part the rest of
            the page hangs from. One cell holds all of it: the heading, the picture, the steps. */}
        <Cell pad className="site-band site-hue-neutral pb-10 pt-16 sm:pb-12 sm:pt-20 lg:pb-16 lg:pt-28">
          <div data-reveal-group className="flex flex-col items-center text-center">
            <Eyebrow hue="neutral" icon={Orbit} data-reveal="rise">How it fits together</Eyebrow>
            <h2 id="how-title" data-reveal="words" className="mt-6 max-w-[20ch] text-balance font-editorial text-headline-sm sm:text-headline"><Title then="from ask to paid.">One request,</Title></h2>
            <p data-reveal="rise" className="mt-8 max-w-[540px] text-lead leading-6 text-site-ink-muted">
              Her portal, your plan and your invoices are one system, so a request moves through it by itself. Follow one from start to finish.
            </p>
          </div>

          {/* THE PICTURE, LIGHT, INSIDE THE BAND, as Ramp holds its product in a lit card on its dark
              section: the band is only the room around it, and the picture keeps the page's theme, so
              the product's cards read exactly as they do everywhere else. Its layers are every
              picture's: the portal's violet turning into the brand's rose, the mark printed over it
              in light, and her portal, Zenboard and your day lifting on in the order the request
              travels. */}
          <div data-reveal-group className="site-field site-field-how relative mt-12 overflow-hidden rounded-xl py-12 sm:mt-14 sm:py-16">
            <Mesh />
            <Halftone mark={{ x: 0.5, y: 0.5, size: 1.1 }} pitch={7} className="site-screen" />
            {STEPS.map((s, i) => (
              <RT.Content key={s.title} value={String(i)} className="relative focus-visible:outline-none">
                <p className="sr-only">Step {i + 1} of {STEPS.length}. {s.title}: {s.body}</p>
                <div aria-hidden inert className="mx-auto grid max-w-[68rem] grid-cols-1 items-center justify-items-center px-5 lg:grid-cols-[minmax(0,1fr)_minmax(6rem,0.8fr)_auto_minmax(6rem,0.8fr)_minmax(0,1fr)] lg:px-10">
                  <Portal step={i} />
                  <TrackLine track="portal" step={i} />
                  <Hub step={i} />
                  <TrackLine track="day" step={i} />
                  <Day step={i} />
                </div>
              </RT.Content>
            ))}
          </div>

          <RT.List data-reveal-group aria-label="One request, step by step" className="mt-10 grid gap-x-8 gap-y-8 text-start sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              // `flex flex-col`: the steps share a grid row, which stretches every button to the
              // tallest, and a button centres its content vertically, so a two-line step sat 12px
              // below a three-line one. A flex button lays its content out from the top.
              <RT.Trigger key={s.title} value={String(i)} className="focus-ring group flex flex-col rounded-md text-start">
                {/* A step's NUMBER wears the colour of the place it happens in, always (the same rule
                    as the people above it: every one wears its box, and the ring marks the one that
                    is live). While the step holds, the dots draw in round it and the line runs them
                    as its timer. Its words are one sentence at two volumes, the name in the band's
                    light and the rest in its grey (the card title with its line). The step you are on
                    is the one whose name is lit. */}
                <span data-reveal="rise" className="block">
                  <Dwell active={i === active} onEnd={next} size={36} radius={11} className={HUE[CHAPTER[s.place]]}>
                    <span aria-hidden className={cn('site-tile grid size-7 place-items-center rounded-md text-caption font-medium tabular-nums', HUE[CHAPTER[s.place]])}>{i + 1}</span>
                  </Dwell>
                  <span className="mt-4 block max-w-[34ch] text-h3 leading-6">
                    <span className="text-site-ink-muted transition-colors duration-[var(--site-hover)] ease-hover group-hover:text-site-ink-fg group-data-[state=active]:text-site-ink-fg">{s.title}.</span>{' '}
                    <span className="text-site-ink-muted">{s.body}</span>
                  </span>
                </span>
              </RT.Trigger>
            ))}
          </RT.List>
        </Cell>
      </section>
    </RT.Root>
  );
}
