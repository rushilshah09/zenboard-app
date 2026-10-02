'use client';
// ── PRODUCT SCREENS FOR THE WEBSITE'S PICTURES ──────────────────────────────
//
// True pieces of Zenboard for the chapter pictures (areas.tsx): each is one screen the product really
// has, drawn with the product's own components on the sample studio's data.
//
// REBUILT 2026-09-29 on the user's brief: "they look too basic and the build quality is low … bugs and
// inconsistencies, especially the bubble layers, duplicate file layers, spacing, alignment … I want
// proper UI snippets and interface elements integrated, so they feel detailed, realistic and
// professionally designed." What was wrong, measured on the page:
//
//   · THE DUPLICATE LAYERS. Every card had two "stack" cards peeking above it, anchored to a wrapper
//     that ran the stage's FULL width while the card itself was capped at 28 to 36rem, so the ghosts
//     stuck out past the card's right edge by up to 180px. They are gone: a picture's depth now comes
//     from the product's own furniture (a header, a menu, a toast), not from copies of itself.
//   · THE BUBBLES. Two floating chips per picture, pinned to fixed corners whatever was under them, so
//     some sat on a row's words ("Weekly review done" over "Beacon") and two claimed features the
//     product does not have (invoice reminders are planned, not live; there is no nudge). A picture now
//     carries at most ONE piece of context, drawn as the product draws it (a toast is the Toaster's
//     toast), on the bottom edge where the card's padding is, reaching out on the side away from the
//     words, and saying only what the product does.
//   · THE SIZES. Pictures in one chapter were 22 to 36rem wide, so the frame jumped as the list turned
//     its pages. Every screen is `SCREEN_WIDTH` now.
//   · THE DETAIL. A card with a title and three rows is a slide, not a screen. Each is framed as the app
//     frames a page, with its place and page in a header and the page's own controls on the right, and
//     carries the parts that page really has: avatars, labels, durations, statuses, a chart.
//
// They are pictures, not controls, so they are inert, except where the feature is ABOUT doing
// something, which is what the demos in ./demos.tsx are for.

import * as React from 'react';
import {
  ArrowRight, Calendar as CalendarIcon, CalendarCheck, Check, CheckCircle, ChevronRight, Clock, Download, Eye,
  FileText, Folder, House, Inbox, Landmark, Lock, MessageCircle, Moon, MoreHorizontal, Pencil, Receipt,
  SquareCheck, Star, Timer, type IconType,
} from '@/components/ds/icons';
import { Avatar, AvatarGroup, Badge, Button, Checkbox, Icon, Kbd, Mark, Stat, button, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { BoardDemo, DocDemo, InvoiceDemo, TimeboxDemo } from './demos';
import { FACES } from './faces';

/** The width every chapter's pictures share, so one gives way to the next without the frame jumping. */
export const SCREEN_WIDTH = 'max-w-[34rem]';

/**
 * A SCREEN OF THE PRODUCT, as it sits in the app: its place and page in the header, the page's own
 * controls on the right, and the page below, in the glass every picture's product lies in. `overlay` is
 * the one piece of context a picture may carry (`SceneToast`); it is placed against the screen, outside
 * the card, so it can never sit on the page's words.
 */
export function Screen({ icon, place, page, actions, inert = true, className, bodyClassName, overlay, children }: {
  icon: IconType;
  place: string;
  page?: string;
  actions?: React.ReactNode;
  inert?: boolean;
  className?: string;
  bodyClassName?: string;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('relative w-full', SCREEN_WIDTH, className)}>
      <div aria-hidden={inert || undefined} inert={inert} className={cardClass(cn('site-glass relative w-full overflow-hidden rounded-xl', inert && 'select-none'))}>
        <div className="flex h-11 items-center gap-1.5 border-b border-line-soft px-4 sm:px-5">
          <Icon icon={icon} size={16} className="shrink-0 text-ink-500" />
          <span className="shrink-0 text-caption text-ink-500">{place}</span>
          {page && (
            <>
              <Icon icon={ChevronRight} size={12} className="shrink-0 text-ink-500" />
              <span className="min-w-0 truncate text-caption font-medium text-ink-900">{page}</span>
            </>
          )}
          {actions && <span className="ms-auto flex shrink-0 items-center gap-2 ps-3">{actions}</span>}
        </div>
        <div className={cn('p-5 sm:p-6', bodyClassName)}>{children}</div>
      </div>
      {overlay}
    </div>
  );
}

/** A toast, as the product's Toaster draws one (components/ds/ui/toast.tsx): a bar in its tone, then the
 *  sentence. It sits on the screen's bottom edge, over the card's padding, reaching out on the side away
 *  from the words (`outer`), so it never covers a row. */
const TOAST_BAR = { success: 'bg-success-600', info: 'bg-info-600' } as const;
export function SceneToast({ tone = 'success', outer, children, className }: {
  tone?: keyof typeof TOAST_BAR; outer: 'start' | 'end'; children: React.ReactNode; className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'plot-panel absolute -bottom-6 z-10 flex h-10 w-max max-w-[19rem] items-center gap-3 rounded-lg ps-3 pe-4',
        outer === 'end' ? 'end-4 sm:-end-6' : 'start-4 sm:-start-6',
        className,
      )}
    >
      <span className={cn('h-5 w-[3px] shrink-0 rounded-xs', TOAST_BAR[tone])} />
      <span className="truncate text-caption text-ink-800">{children}</span>
    </div>
  );
}

/** A drawn control: the product's own button classes on an inert span, because in a picture a button is
 *  part of the picture, and the pointer is given nothing to do in it. */
function Drawn({ variant = 'secondary', size = 'xs', icon, className, children }: {
  variant?: 'primary' | 'secondary' | 'ghost'; size?: 'xs' | 'sm'; icon?: IconType; className?: string; children: React.ReactNode;
}) {
  return (
    <span className={cn(button({ variant, size }), 'pointer-events-none gap-1.5', className)}>
      {icon && <Icon icon={icon} size={14} />}{children}
    </span>
  );
}

/** A project, as the product labels one: its colour and its name. */
const LABEL = { ridgeline: 'var(--color-label-plum)', beacon: 'var(--color-label-teal)', copper: 'var(--color-label-ochre)', studio: 'var(--color-label-slate)' } as const;
function Project({ label, children }: { label: keyof typeof LABEL; children: React.ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-caption text-ink-500">
      <span className="size-2 rounded-xs" style={{ background: LABEL[label] }} />{children}
    </span>
  );
}

/** A heading inside a page: its title in the titling face, and one line under it. */
function Heading({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="font-editorial text-title-3 text-ink-900">{children}</p>
      {sub && <p className="mt-1 text-caption text-ink-500">{sub}</p>}
    </div>
  );
}

// ── YOUR DAY ────────────────────────────────────────────────────────────────

const ALEX = <Avatar name="Alex Moreau" src={FACES.alex} size="xs" decorative />;
const WAITING_PEOPLE = [
  { name: 'Daniel Okafor', src: FACES.daniel },
  { name: 'Maya Chen', src: FACES.maya },
  { name: 'Priya Nair', src: FACES.priya },
];

/** Home, assembled: the greeting, the highlight, the day in the order it happens (meetings and tasks
 *  together), and what is waiting on other people. */
export function HomeScreen() {
  const day = [
    { at: '9:40', t: 'Weekly review', done: true, meta: <span className="text-caption text-ink-500">Done</span> },
    { at: '11:30', t: 'Ridgeline call', event: true, meta: <span className="text-caption text-ink-500">30m</span> },
    { t: 'Finish the logo presentation', meta: <Project label="ridgeline">Ridgeline rebrand</Project> },
    { t: 'Reply to Beacon about scope', meta: <Project label="beacon">Beacon Health site</Project> },
    { at: '15:00', t: 'Copper Row check-in', event: true, meta: <span className="text-caption text-ink-500">20m</span> },
  ];
  return (
    <Screen icon={House} place="Home" actions={<><Drawn>Plan day</Drawn>{ALEX}</>}>
      <div className="flex items-center gap-2.5">
        <Mark size={20} tone="brand" />
        <p className="font-editorial text-title-3 text-ink-900">Good morning, Alex.</p>
      </div>
      <p className="mt-1 text-caption text-ink-500">Thursday · 4 tasks, 2 meetings, 3 waiting on others</p>

      {/* The highlight: the one task the day leads with, and how far through its time it is. */}
      <div className="mt-4 flex items-center gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-[color-mix(in_oklab,var(--accent)_22%,transparent)] bg-[linear-gradient(135deg,var(--accent-soft),transparent_72%)]">
        <span className="relative grid size-9 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="16" fill="none" strokeWidth="2.5" className="stroke-line" />
            <circle cx="18" cy="18" r="16" fill="none" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray="35 100" className="stroke-accent" />
          </svg>
          <Icon icon={Star} size={14} weight="fill" className="text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-accent-text">Today’s highlight</p>
          <p className="truncate text-ui font-medium text-ink-900">Send the Ridgeline invoice</p>
        </div>
        <Project label="ridgeline">15m</Project>
      </div>

      <p className="mt-5 text-overline">Today</p>
      <ul className="mt-1.5 flex flex-col">
        {day.map((r, i) => (
          <li key={r.t} className={cn('flex h-[var(--row-task)] items-center gap-3', i > 0 && 'border-t border-line-soft')}>
            {r.event ? (
              <span className="flex w-4 shrink-0 justify-center"><span className="h-4 w-[3px] rounded-xs" style={{ background: 'var(--color-label-slate)' }} /></span>
            ) : (
              <Checkbox size="sm" checked={!!r.done} tabIndex={-1} className="ms-px" />
            )}
            <span className={cn('min-w-0 flex-1 truncate text-ui', r.done ? 'text-ink-500 line-through decoration-ink-400' : 'text-ink-900')}>
              {r.at && <span className="me-2 tabular-nums text-ink-500">{r.at}</span>}{r.t}
            </span>
            {r.meta}
          </li>
        ))}
      </ul>

      {/* What is someone else's move: on Home, never on the plan. */}
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-fill px-3 py-2.5">
        <AvatarGroup people={WAITING_PEOPLE} size="xs" />
        <p className="min-w-0 flex-1 truncate text-caption text-ink-800">Waiting on 3 · Beacon, Copper Row, Ridgeline</p>
        <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-500" />
      </div>
    </Screen>
  );
}

/** One highlight a day: the day's list, the slot at its head still empty, and the menu that fills it
 *  open on the task that matters, with the key that does the same thing. */
export function HighlightScreen() {
  const tasks = [
    { t: 'Finish the logo presentation', p: 'ridgeline' as const, d: '2h' },
    { t: 'Send the Ridgeline invoice', p: 'ridgeline' as const, d: '15m', picked: true },
    { t: 'Reply to Beacon about scope', p: 'beacon' as const, d: '30m' },
    { t: 'Invoices and admin', p: 'studio' as const, d: '45m' },
    { t: 'Copper Row asset review', p: 'copper' as const, d: '1h 15m' },
    { t: 'Beacon sitemap edits', p: 'beacon' as const, d: '1h' },
  ];
  const MENU: { icon: IconType; label: string; keys?: string[]; on?: boolean }[] = [
    { icon: Star, label: 'Make today’s highlight', keys: ['H'], on: true },
    { icon: CalendarIcon, label: 'Schedule', keys: ['S'] },
    { icon: ArrowRight, label: 'Move to tomorrow', keys: ['T'] },
    { icon: Pencil, label: 'Rename', keys: ['R'] },
  ];
  return (
    <Screen icon={SquareCheck} place="Tasks" page="Today" actions={<Drawn icon={Star}>Highlight</Drawn>}>
      {/* The slot the highlight will take, waiting for it. */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-3.5 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-fill">
          <Icon icon={Star} size={14} className="text-ink-500" />
        </span>
        <div className="min-w-0">
          <p className="text-caption font-medium text-ink-500">Today’s highlight</p>
          <p className="text-ui text-ink-600">Pick the one task that matters most today.</p>
        </div>
      </div>

      <div className="relative mt-4">
        <ul className="flex flex-col">
          {tasks.map((r, i) => (
            <li key={r.t} className={cn('flex h-[var(--row-task)] items-center gap-3 rounded-md px-2', i > 0 && !r.picked && !tasks[i - 1].picked && 'border-t border-line-soft', r.picked && 'bg-surface-selected')}>
              <Checkbox size="sm" checked={false} tabIndex={-1} />
              <span className={cn('min-w-0 flex-1 truncate text-ui', r.picked ? 'font-medium text-ink-900' : 'text-ink-900')}>{r.t}</span>
              <Project label={r.p}>{r.d}</Project>
              <Icon icon={MoreHorizontal} size={16} className={r.picked ? 'text-ink-700' : 'text-transparent'} />
            </li>
          ))}
        </ul>
        {/* The task's menu, open under its row, drawn as the product's menus are (OVERLAY_CLASS: one
            panel, 32px items, the key at the end of the item). */}
        <div className="plot-panel absolute end-2 top-[calc(2*var(--row-task)+4px)] z-[1] w-[15.5rem] rounded-lg p-1">
          {MENU.map((m) => (
            <span key={m.label} className={cn('flex h-8 items-center gap-2.5 rounded-md px-2 text-ui', m.on ? 'bg-surface-hover text-ink-900' : 'text-ink-800')}>
              <Icon icon={m.icon} size={16} state={m.on} className={m.on ? 'text-accent' : 'text-ink-500'} />
              <span className="flex-1">{m.label}</span>
              {m.keys && <Kbd keys={m.keys} />}
            </span>
          ))}
        </div>
      </div>
    </Screen>
  );
}

/** A plan that fits your hours: the day's capacity, the tasks that fit it with their estimates, and the
 *  two that did not, moved to tomorrow. The arithmetic is lib/capacity.ts's: 8 working hours, 1h 30m of
 *  meetings, 5h 45m planned, 45m free. */
export function CapacityScreen() {
  const seg = [
    { w: 18.75, cls: 'bg-line-strong', label: 'Meetings', v: '1h 30m' },
    { w: 71.9, cls: 'bg-ink-800', label: 'Planned', v: '5h 45m' },
    { w: 9.35, cls: 'bg-surface-fill ring-1 ring-inset ring-line', label: 'Free', v: '45m' },
  ];
  const kept = [
    ['Finish the logo presentation', '2h'], ['Copper Row asset review', '1h 15m'], ['Beacon sitemap edits', '1h'],
    ['Invoices and admin', '45m'], ['Reply to Beacon about scope', '30m'], ['Send the Ridgeline invoice', '15m'],
  ];
  const moved = [['Type and color system', '3h'], ['Brand guidelines draft', '2h']];
  return (
    <Screen
      icon={House} place="Home" page="Plan the day" actions={ALEX}
      overlay={<SceneToast outer="end">2 tasks moved to tomorrow, so today still fits</SceneToast>}
    >
      <Heading sub="Thursday · 9:00 – 17:00 · 8 working hours">A plan that fits the day</Heading>
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-xs">
        {seg.map((s) => <span key={s.label} className={cn('rounded-[2px]', s.cls)} style={{ width: `${s.w}%` }} />)}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {seg.map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1.5 text-caption text-ink-500"><span className={cn('size-2 rounded-xs', s.cls)} />{s.label}</dt>
            <dd className="mt-0.5 text-ui font-medium tabular-nums text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-col border-t border-line-soft">
        {kept.map(([t, d]) => (
          <li key={t} className="flex h-8 items-center gap-3 border-b border-line-soft">
            <Checkbox size="sm" checked={false} tabIndex={-1} />
            <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{t}</span>
            <span className="text-caption tabular-nums text-ink-500">{d}</span>
          </li>
        ))}
        {moved.map(([t, d]) => (
          <li key={t} className="flex h-8 items-center gap-3 border-b border-line-soft last:border-b-0">
            <Icon icon={ArrowRight} size={14} className="w-4 shrink-0 text-ink-500" />
            <span className="min-w-0 flex-1 truncate text-ui text-ink-500">{t}</span>
            <span className="text-caption tabular-nums text-ink-500">{d}</span>
            <Badge status="neutral">Tomorrow</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Drawn variant="ghost" size="sm">Edit plan</Drawn>
        <Drawn variant="primary" size="sm">Start the day</Drawn>
      </div>
    </Screen>
  );
}

/** Close the day: the shutdown's three steps, what got done, what carries to tomorrow, and the note left
 *  for the morning. */
export function ShutdownScreen() {
  const steps = ['Review', 'Carry over', 'Note'];
  return (
    <Screen
      icon={Moon} place="Home" page="Shutdown" actions={ALEX}
      overlay={<SceneToast outer="end">Day closed at 18:40. See you tomorrow.</SceneToast>}
    >
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-5 bg-line-strong" />}
            <span className={cn('grid size-5 place-items-center rounded-full text-micro font-medium',
              i < 2 ? 'bg-ink-900 text-onsolid' : 'ring-1 ring-inset ring-ink-900 text-ink-900')}>
              {i < 2 ? <Icon icon={Check} size={12} className="w-2.5" /> : i + 1}
            </span>
            <span className={cn('text-caption', i === 2 ? 'font-medium text-ink-900' : 'text-ink-500')}>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5"><Heading sub="3 done · 1 carried to tomorrow">Close the day</Heading></div>
      <ul className="mt-3 flex flex-col">
        {['Send the Ridgeline invoice', 'Finish the logo presentation', 'Reply to Beacon about scope'].map((t, i) => (
          <li key={t} className={cn('flex h-8 items-center gap-3', i > 0 && 'border-t border-line-soft')}>
            <Checkbox size="sm" checked tabIndex={-1} />
            <span className="min-w-0 flex-1 truncate text-ui text-ink-500 line-through decoration-ink-400">{t}</span>
          </li>
        ))}
        <li className="flex h-8 items-center gap-3 border-t border-line-soft">
          <Checkbox size="sm" checked={false} tabIndex={-1} />
          <span className="min-w-0 flex-1 truncate text-ui text-ink-900">Type and color system</span>
          <Badge status="neutral">Tomorrow</Badge>
        </li>
      </ul>
      <p className="mt-4 text-caption font-medium text-ink-600">A note for tomorrow</p>
      {/* A field, as the product draws one at rest: the field wash, not a card. */}
      <p className="mt-1.5 rounded-lg bg-surface-fill px-3 py-2.5 text-ui text-ink-900">
        Good day. Start with the type system in the morning.<span className="ms-0.5 inline-block h-4 w-px translate-y-0.5 bg-ink-900" />
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Drawn variant="ghost" size="sm">Back</Drawn>
        <Drawn variant="primary" size="sm" icon={Moon}>Close the day</Drawn>
      </div>
    </Screen>
  );
}

// ── PROJECTS ────────────────────────────────────────────────────────────────

/** Waiting on: what is someone else's move, who owes it, what kind of move it is, and since when. When
 *  they make it, it comes back to your plan, which is what the toast says. */
export function WaitingScreen() {
  const rows = [
    { face: FACES.daniel, who: 'Daniel Okafor', p: 'beacon' as const, project: 'Beacon Health site', what: 'Sign-off on the sitemap', kind: 'Approval', since: '2 days' },
    { face: FACES.maya, who: 'Maya Chen', p: 'copper' as const, project: 'Copper Row', what: 'Brand assets for the site', kind: 'Answer', since: 'Since Monday' },
    { face: FACES.priya, who: 'Priya Nair', p: 'ridgeline' as const, project: 'Ridgeline rebrand', what: 'Feedback on route B', kind: 'Answer', since: 'Today' },
  ];
  return (
    <Screen
      icon={House} place="Home" page="Waiting on" actions={ALEX}
      overlay={<SceneToast outer="start" tone="info">Maya replied. It’s back on your plan.</SceneToast>}
    >
      <Heading sub="Their move, not yours, so it stays off your plan.">Waiting on</Heading>
      <ul className="mt-4 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.who} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-line-soft')}>
            <Avatar name={r.who} src={r.face} size="md" decorative />
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui text-ink-900">{r.what}</p>
              <p className="mt-0.5 flex items-center gap-2 truncate text-caption text-ink-500">{r.who}<span aria-hidden>·</span><Project label={r.p}>{r.project}</Project></p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge status={r.kind === 'Approval' ? 'info' : 'neutral'}>{r.kind}</Badge>
              <span className="text-caption text-ink-500">{r.since}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3 text-caption text-ink-500">
        <Icon icon={Clock} size={14} />Oldest first. Nothing here is on today’s plan.
      </p>
    </Screen>
  );
}

// ── MONEY ───────────────────────────────────────────────────────────────────

/** What's owed, at a glance: the three figures, what was paid month by month, and the invoices behind
 *  the figures. Outstanding is what is sent plus what is overdue ($4,200 + $1,800). */
export function FinanceScreen() {
  const months = [['Apr', 0.46], ['May', 0.62], ['Jun', 0.38], ['Jul', 0.71], ['Aug', 0.58], ['Sep', 1]] as const;
  const rows = [
    { n: 'INV-021', c: 'Ridgeline', p: 'ridgeline' as const, due: 'Due Oct 20', s: 'Sent', tone: 'info' as const, a: '$4,200' },
    { n: 'INV-020', c: 'Beacon Health', p: 'beacon' as const, due: 'Paid Sep 28', s: 'Paid', tone: 'success' as const, a: '$2,650' },
    { n: 'INV-019', c: 'Copper Row', p: 'copper' as const, due: '12 days late', s: 'Overdue', tone: 'danger' as const, a: '$1,800' },
  ];
  return (
    <Screen
      icon={Landmark} place="Finance" page="Overview" actions={<Drawn icon={Receipt}>New invoice</Drawn>}
      overlay={<SceneToast outer="start">Payment recorded. INV-020 is paid, $2,650.</SceneToast>}
    >
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Outstanding" value="$6,000" />
        <Stat label="Paid this month" value="$12,400" />
        <Stat label="Overdue" value="$1,800" />
      </div>
      {/* Paid by month: this month is the ink, the ones before it the line. */}
      <div className="mt-5 rounded-lg bg-surface-fill px-3.5 pb-2.5 pt-3">
        <p className="text-caption text-ink-500">Paid by month</p>
        <div className="mt-2 flex h-16 items-end gap-2">
          {months.map(([m, h]) => (
            <span key={m} className="flex flex-1 flex-col items-center gap-1">
              <span className={cn('w-full rounded-[3px]', h === 1 ? 'bg-ink-900' : 'bg-line-strong')} style={{ height: `${h * 44}px` }} />
              <span className={cn('text-micro', h === 1 ? 'font-medium text-ink-900' : 'text-ink-500')}>{m}</span>
            </span>
          ))}
        </div>
      </div>
      <ul className="mt-4 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.n} className={cn('grid grid-cols-[4.25rem_minmax(0,1fr)_auto_4.25rem] items-center gap-3 py-2.5', i > 0 && 'border-t border-line-soft')}>
            <span className="font-mono text-caption text-ink-500">{r.n}</span>
            <span className="min-w-0">
              <span className="block truncate text-ui text-ink-900">{r.c}</span>
              <span className={cn('block truncate text-caption', r.tone === 'danger' ? 'text-danger-600' : 'text-ink-500')}>{r.due}</span>
            </span>
            <Badge status={r.tone}>{r.s}</Badge>
            <span className="text-end text-ui font-medium tabular-nums text-ink-900">{r.a}</span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Ready for your accountant: a period, and the three sheets for it, each its own download. */
export function ExportScreen() {
  const files = [
    { name: 'Invoices with totals and balances', meta: '24 invoices · invoices-sep.csv' },
    { name: 'Their line items', meta: '61 lines · invoice-lines-sep.csv' },
    { name: 'Payments received', meta: '19 payments · payments-sep.csv' },
  ];
  const periods = ['This month', 'Last month', 'This year'];
  return (
    <Screen
      icon={Landmark} place="Finance" page="Export" actions={ALEX}
      overlay={<SceneToast outer="start">payments-sep.csv downloaded</SceneToast>}
    >
      <Heading sub="Three sheets, ready for a spreadsheet.">For your accountant</Heading>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* The period, as the product's segmented control draws it. */}
        <span className="flex rounded-lg bg-surface-fill p-0.5">
          {periods.map((p, i) => (
            <span key={p} className={cn('rounded-md px-2.5 py-1 text-caption', i === 1 ? 'bg-surface-raised font-medium text-ink-900 shadow-xs' : 'text-ink-600')}>{p}</span>
          ))}
        </span>
        <span className="flex items-center gap-1.5 text-caption text-ink-500"><Icon icon={CalendarIcon} size={14} />Sep 1 – Sep 30</span>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {files.map((f, i) => (
          <li key={f.name} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', i === 2 ? 'border-line-strong bg-surface-selected' : 'border-line')}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-field-sage font-mono text-micro font-medium text-ink-900">CSV</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui text-ink-900">{f.name}</span>
              <span className="block truncate text-caption text-ink-500">{f.meta}</span>
            </span>
            {i === 2
              ? <Icon icon={Check} size={16} className="shrink-0 text-success-600" />
              : <Icon icon={Download} size={16} className="shrink-0 text-ink-500" />}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-ink-500">Amounts in USD. Opens in Excel, Numbers and Google Sheets.</p>
    </Screen>
  );
}

/** Invoices from tracked time: the hours not billed yet, and the one step that turns them into an
 *  invoice. The one money picture you can press; "Start over" puts it back. */
export function UnbilledScreen() {
  const [made, setMade] = React.useState(false);
  // 10 hours at $150 is the $1,500.00 the invoice is made for.
  const entries = [
    { day: 'Mon', t: 'Logo exploration', h: '4h 00m' },
    { day: 'Tue', t: 'Route B refinements', h: '1h 30m' },
    { day: 'Wed', t: 'Presentation deck', h: '2h 00m' },
    { day: 'Today', t: 'Type and color system', h: '2h 30m', timer: true },
  ];
  return (
    <Screen
      icon={Landmark} place="Finance" page="Unbilled time" inert={false} actions={ALEX}
      overlay={made ? <SceneToast outer="start" className="site-swap zb-enter">INV-022 created, ready to send</SceneToast> : undefined}
    >
      <Heading sub="Ridgeline rebrand · $150 an hour">Time not billed yet</Heading>
      <div className="mt-4 overflow-hidden rounded-lg border border-line">
        <p className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 border-b border-line-soft bg-surface-fill px-3 py-1.5 text-caption text-ink-500">
          <span>Day</span><span>Task</span><span>Time</span>
        </p>
        {entries.map((e) => (
          <p key={e.t} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft px-3 py-2.5 last:border-b-0">
            <span className="text-caption text-ink-500">{e.day}</span>
            <span className="flex min-w-0 items-center gap-2 text-ui text-ink-900">
              <span className="truncate">{e.t}</span>
              {e.timer && <Icon icon={Timer} size={14} className="shrink-0 text-ink-500" />}
            </span>
            <span className="text-ui tabular-nums text-ink-900">{e.h}</span>
          </p>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-ui text-ink-800"><span className="font-medium tabular-nums">10h 00m</span> · <span className="tabular-nums">$1,500.00</span></p>
        {made ? (
          <span className="flex items-center gap-2">
            <span key="made" className="site-swap zb-enter flex items-center gap-1.5 text-ui text-ink-800"><Icon icon={Check} size={14} className="text-success-600" />INV-022</span>
            <Button size="sm" variant="ghost" onClick={() => setMade(false)}>Start over</Button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" icon={<Icon icon={Receipt} size={14} />} onClick={() => setMade(true)}>Create invoice</Button>
        )}
      </div>
    </Screen>
  );
}

// ── THE DEMOS, FRAMED ───────────────────────────────────────────────────────
// The four pictures that are the real interaction (demos.tsx), each in the page it lives on. Named here
// once, so the home page's chapters and the product pages show the same screen.

export function BoardScreen() {
  return <Screen icon={Folder} place="Projects" page="Ridgeline rebrand" inert={false}><BoardDemo /></Screen>;
}
export function CalendarScreen() {
  return (
    <Screen icon={CalendarIcon} place="Calendar" page="Thursday" inert={false}
      actions={<span className="flex items-center gap-1.5 text-caption text-ink-500"><Icon icon={CalendarCheck} size={14} />Google Calendar</span>}>
      <TimeboxDemo />
    </Screen>
  );
}
export function BriefScreen() {
  return <Screen icon={FileText} place="Documents" page="Ridgeline, brand brief" inert={false}><DocDemo /></Screen>;
}
export function InvoiceScreen() {
  return <Screen icon={Landmark} place="Finance" page="INV-021" inert={false}><InvoiceDemo /></Screen>;
}

// ── THE CLIENT'S SIDE ───────────────────────────────────────────────────────

/** The client's portal page for one project, as they open it from the link: where things stand, what
 *  needs them, what they asked for, and what is due. */
export function PortalScreen() {
  const requests = [
    { t: 'A heavier wordmark', s: 'In progress', tone: 'info' as const },
    { t: 'Add the tagline to the business cards', s: 'Done', tone: 'success' as const },
  ];
  return (
    <Screen
      icon={Lock} place="Northlight Studio" page="Ridgeline rebrand"
      actions={<span className="flex items-center gap-1.5 text-caption text-ink-500"><Icon icon={Eye} size={14} />Priya’s view</span>}
    >
      <div className="flex items-center gap-2.5">
        <p className="font-editorial text-title-3 text-ink-900">Ridgeline rebrand</p>
        <Badge status="success">Active</Badge>
      </div>
      <p className="mt-1 text-caption text-ink-500">Here is where things stand. No login needed.</p>

      <div className="mt-4 flex items-center gap-4 rounded-lg bg-surface-fill px-4 py-3">
        <span className="relative grid size-11 shrink-0 place-items-center">
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-line" />
            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray="64 100" className="stroke-ink-900" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-medium tabular-nums text-ink-900">64% · 18 of 28 tasks done</span>
          <span className="block truncate text-caption text-ink-500">Next: the logo presentation, Friday</span>
        </span>
      </div>

      <p className="mt-5 text-overline">To review</p>
      <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset ring-line-strong">
        <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />
        <span className="min-w-0 flex-1 truncate text-ui text-ink-900">Logo presentation, version 3</span>
        <Drawn variant="primary">Review</Drawn>
      </div>

      <p className="mt-5 text-overline">Your requests</p>
      <ul className="mt-1 flex flex-col">
        {requests.map((r, i) => (
          <li key={r.t} className={cn('flex h-10 items-center gap-3', i > 0 && 'border-t border-line-soft')}>
            <Icon icon={MessageCircle} size={16} className="shrink-0 text-ink-500" />
            <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{r.t}</span>
            <Badge status={r.tone}>{r.s}</Badge>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-overline">Invoices</p>
      <div className="mt-1 flex h-10 items-center gap-3">
        <span className="font-mono text-caption text-ink-500">INV-021</span>
        <span className="min-w-0 flex-1 truncate text-ui text-ink-900">Due Oct 20</span>
        <Badge status="info">Sent</Badge>
        <span className="w-16 text-end text-ui font-medium tabular-nums text-ink-900">$4,200</span>
      </div>
    </Screen>
  );
}

/** An approval, on the record: the file, its versions, and the answer that stays with it. */
export function ApprovalScreen() {
  const versions = [
    { v: 'v3', note: 'Shared Tuesday', current: true },
    { v: 'v2', note: 'Priya asked for a heavier wordmark' },
    { v: 'v1', note: 'Three routes, shared last week' },
  ];
  return (
    <Screen
      icon={Folder} place="Ridgeline rebrand" page="Logo presentation" actions={ALEX}
      overlay={<SceneToast outer="end">Priya approved version 3</SceneToast>}
    >
      {/* The file itself: three routes, the chosen one marked. */}
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-fill p-2">
        {['A', 'B', 'C'].map((r) => (
          <span key={r} className={cn('flex aspect-[4/3] flex-col justify-between rounded-md bg-surface-raised p-2', r === 'B' ? 'ring-2 ring-inset ring-ink-900' : 'ring-1 ring-inset ring-line')}>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-[3px]" style={{ background: r === 'B' ? 'var(--color-label-plum)' : 'var(--color-label-stone)' }} />
              <span className={cn('h-1.5 rounded-full', r === 'B' ? 'w-10 bg-ink-800' : 'w-8 bg-line-strong')} />
            </span>
            <span className="text-micro font-medium text-ink-600">Route {r}</span>
          </span>
        ))}
      </div>
      <ul className="mt-4 flex flex-col">
        {versions.map((x, i) => (
          <li key={x.v} className={cn('flex h-10 items-center gap-3', i > 0 && 'border-t border-line-soft')}>
            <span className={cn('rounded-xs px-1.5 font-mono text-micro leading-5', x.current ? 'bg-ink-900 text-onsolid' : 'bg-surface-fill text-ink-600')}>{x.v}</span>
            <span className={cn('min-w-0 flex-1 truncate text-ui', x.current ? 'text-ink-900' : 'text-ink-600')}>{x.note}</span>
          </li>
        ))}
      </ul>
      {/* The answer, kept with the file: who, when, and what they said. */}
      <div className="mt-4 flex items-start gap-3 rounded-lg bg-success-100 px-3.5 py-3">
        <Icon icon={CheckCircle} size={16} weight="fill" className="mt-0.5 shrink-0 text-success-600" />
        <span className="min-w-0">
          <span className="block text-ui font-medium text-ink-900">Approved by Priya Nair · Thu 10:42</span>
          <span className="block text-caption text-ink-600">“Route B, with the heavier weight. Let’s go.”</span>
        </span>
      </div>
    </Screen>
  );
}

/** Requests becoming tasks: what the client asked, and what each became once you said yes. */
export function RequestsScreen() {
  const rows = [
    { who: 'Priya Nair', face: FACES.priya, t: 'Add the tagline to the business cards', when: 'Mon', state: 'task' as const },
    { who: 'Priya Nair', face: FACES.priya, t: 'A heavier wordmark', when: 'Tue', state: 'task' as const },
    { who: 'Priya Nair', face: FACES.priya, t: 'Can we see a dark version of route B?', when: 'Today', state: 'new' as const },
  ];
  return (
    <Screen icon={Inbox} place="Ridgeline rebrand" page="Requests" actions={ALEX}>
      <ul className="flex flex-col">
        {rows.map((r, i) => (
          <li key={r.t} className={cn('flex flex-col gap-2.5 py-3.5', i > 0 && 'border-t border-line-soft')}>
            <span className="flex items-center gap-2.5">
              <Avatar name={r.who} src={r.face} size="xs" decorative />
              <span className="text-caption font-medium text-ink-900">{r.who}</span>
              <span className="text-caption text-ink-500">via portal · {r.when}</span>
            </span>
            <p className="text-ui text-ink-900">{r.t}</p>
            {r.state === 'task' ? (
              <span className="flex items-center gap-2 text-caption text-ink-600">
                <Icon icon={Check} size={14} className="text-success-600" />Became a task in Ridgeline rebrand
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Drawn variant="primary">Approve as a task</Drawn>
                <Drawn>Reply</Drawn>
              </span>
            )}
          </li>
        ))}
      </ul>
    </Screen>
  );
}

// ── DOCS AND SWITCHING ──────────────────────────────────────────────────────

/** A doc with a database in it: the deliverables of a brief as a table, with the views it has. */
export function DatabaseScreen() {
  const rows = [
    { t: 'Three logo routes', s: 'Done', tone: 'success' as const, d: 'Sep 19' },
    { t: 'Logo presentation', s: 'In review', tone: 'info' as const, d: 'Fri' },
    { t: 'Type and color system', s: 'In progress', tone: 'neutral' as const, d: 'Oct 10' },
    { t: 'Brand guidelines, 12 pages', s: 'Not started', tone: 'neutral' as const, d: 'Nov 14' },
  ];
  const views = ['Table', 'Board', 'Gallery', 'List'];
  return (
    <Screen icon={FileText} place="Documents" page="Ridgeline, deliverables" actions={ALEX}>
      <p className="font-editorial text-title-3 text-ink-900">Deliverables</p>
      <p className="mt-1 text-caption text-ink-500">A database in the brief: four items, one view each way you need them.</p>
      <div className="mt-4 flex items-center gap-1 border-b border-line-soft">
        {views.map((v, i) => (
          <span key={v} className={cn('-mb-px border-b-2 px-2.5 pb-2 text-caption', i === 0 ? 'border-ink-900 font-medium text-ink-900' : 'border-transparent text-ink-500')}>{v}</span>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <p className="grid grid-cols-[minmax(0,1fr)_6.5rem_3.5rem] gap-3 border-b border-line-soft bg-surface-fill px-3 py-1.5 text-caption text-ink-500">
          <span>Name</span><span>Status</span><span className="text-end">Due</span>
        </p>
        {rows.map((r) => (
          <p key={r.t} className="grid grid-cols-[minmax(0,1fr)_6.5rem_3.5rem] items-center gap-3 border-b border-line-soft px-3 py-2.5 last:border-b-0">
            <span className="truncate text-ui text-ink-900">{r.t}</span>
            <span><Badge status={r.tone}>{r.s}</Badge></span>
            <span className="text-end text-caption tabular-nums text-ink-500">{r.d}</span>
          </p>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-caption text-ink-500">
        <Icon icon={Folder} size={14} />Linked to Ridgeline rebrand · 4 tasks
      </p>
    </Screen>
  );
}

/** Switching in: what Zenboard imports today, and one import finished. The sources are the plan's truth
 *  table and nothing more: Notion pages from its Markdown export; tasks from Todoist, TickTick or any
 *  spreadsheet. */
export function ImportScreen() {
  const sources = [
    { name: 'Notion', what: 'Pages, from Notion’s Markdown export', done: '42 pages imported' },
    { name: 'Todoist', what: 'Tasks, with their projects and due dates' },
    { name: 'TickTick', what: 'Tasks, with their lists and due dates' },
    { name: 'A spreadsheet', what: 'Tasks from any CSV file' },
  ];
  return (
    <Screen
      icon={Download} place="Settings" page="Import" actions={ALEX}
      overlay={<SceneToast outer="end">42 Notion pages are in Documents</SceneToast>}
    >
      <p className="font-editorial text-title-3 text-ink-900">Bring your work with you</p>
      <p className="mt-1 text-caption text-ink-500">Nothing is deleted where it came from.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {sources.map((x) => (
          <li key={x.name} className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3', x.done ? 'border-line-strong bg-surface-selected' : 'border-line')}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-fill text-ui font-semibold text-ink-800">{x.name[0]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-ui font-medium text-ink-900">{x.name}</span>
              <span className="block truncate text-caption text-ink-500">{x.done ?? x.what}</span>
            </span>
            {x.done ? <Icon icon={CheckCircle} size={16} weight="fill" className="shrink-0 text-success-600" /> : <Drawn>Import</Drawn>}
          </li>
        ))}
      </ul>
    </Screen>
  );
}
