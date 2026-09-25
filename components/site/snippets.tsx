'use client';
// ── PRODUCT SNIPPETS ────────────────────────────────────────────────────────
//
// Small, true pieces of Zenboard for the website's pictures: each is one screen-part the product
// really has (the highlight, the capacity of a day, the shutdown, Waiting on, a project conversation,
// Finance, the accountant export), drawn with the product's own components and the sample studio.
//
// Each lies on a printed stage as a card of the product, lifted (`Sheet`). They are pictures, not
// controls, so they are inert, except where the section is ABOUT doing something, which is what the
// demos in ./demos.tsx are for.

import * as React from 'react';
import { Check, Download, Highlight, MessageCircle, Pause, Timer } from '@/components/ds/icons';
import { Avatar, Badge, Button, Checkbox, Icon, Mark, Stat, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { FACES } from './faces';


/** The product's own card, lifted off the printed stage it lies on. */
export function Sheet({ className, children, inert = true }: { className?: string; children: React.ReactNode; inert?: boolean }) {
  return (
    <div aria-hidden={inert || undefined} inert={inert} className={cardClass(cn('site-lift w-full rounded-xl p-5 sm:p-6', inert && 'select-none', className))}>
      {children}
    </div>
  );
}

function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="font-editorial text-title-3 text-ink-900">{children}</p>
      {sub && <p className="mt-1 text-caption text-ink-500">{sub}</p>}
    </div>
  );
}

// ── YOUR DAY ────────────────────────────────────────────────────────────────

export function PlanSnippet() {
  const rows = [
    { t: 'Finish the logo presentation', w: 'Ridgeline rebrand', done: false },
    { t: 'Reply to Beacon about scope', w: 'Beacon Health site', done: false },
    { t: 'Weekly review', w: 'Done 9:40', done: true },
  ];
  return (
    <Sheet className="max-w-[30rem]">
      <div className="flex items-center gap-2">
        <Mark size={20} tone="brand" />
        <p className="font-editorial text-title-3 text-ink-900">Good morning, Alex.</p>
      </div>
      <div className="mt-4 rounded-xl border border-line p-4">
        <p className="text-caption font-medium text-ink-500">Today’s highlight</p>
        <p className="mt-1 text-body-lg font-medium text-ink-900">Send the Ridgeline invoice</p>
        <p className="mt-1 flex items-center gap-3 text-caption text-ink-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-xs bg-accent" />Finance</span>15m</p>
      </div>
      <ul className="mt-3 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.t} className={cn('flex h-[var(--row-task)] items-center gap-3', i > 0 && 'border-t border-line-soft')}>
            <Checkbox checked={r.done} tabIndex={-1} />
            <span className={cn('min-w-0 flex-1 truncate text-ui', r.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{r.t}</span>
            <span className="hidden shrink-0 text-caption text-ink-500 sm:inline">{r.w}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function HighlightSnippet() {
  const options = ['Finish the logo presentation', 'Send the Ridgeline invoice', 'Reply to Beacon about scope'];
  return (
    <Sheet className="max-w-[28rem]">
      <Title sub="The one task that matters most today.">Pick today’s highlight</Title>
      <ul className="mt-4 flex flex-col gap-2">
        {options.map((o, i) => (
          <li key={o} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3 text-ui', i === 1 ? 'bg-surface-selected font-medium text-ink-900 ring-1 ring-line-strong' : 'text-ink-700')}>
            <Icon icon={Highlight} size={16} weight={i === 1 ? 'fill' : 'regular'} className={i === 1 ? 'text-ink-900' : 'text-ink-500'} />
            <span className="min-w-0 flex-1 truncate">{o}</span>
            {i === 1 && <Badge status="accent">Highlight</Badge>}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function CapacitySnippet() {
  // 8 working hours: 1h 30m of meetings, 5h 45m planned, 45m left — the same arithmetic as lib/capacity.ts.
  const seg = [
    { w: 18.75, cls: 'bg-line-strong', label: 'Meetings', v: '1h 30m' },
    { w: 71.9, cls: 'bg-ink-800', label: 'Planned', v: '5h 45m' },
    { w: 9.35, cls: 'bg-surface-fill', label: 'Free', v: '45m' },
  ];
  return (
    <Sheet className="max-w-[30rem]">
      <Title sub="Thursday · 9:00 – 17:00">A plan that fits the day</Title>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full">
        {seg.map((s) => <span key={s.label} className={s.cls} style={{ width: `${s.w}%` }} />)}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {seg.map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1.5 text-caption text-ink-500"><span className={cn('size-2 rounded-xs', s.cls)} />{s.label}</dt>
            <dd className="mt-0.5 text-ui tabular-nums font-medium text-ink-900">{s.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 flex items-center gap-2 rounded-lg bg-surface-fill px-3 py-2 text-caption text-ink-700">
        <Icon icon={Check} size={14} className="text-success-600" />Type and color system moved to tomorrow, so today still fits.
      </p>
    </Sheet>
  );
}

export function CloseDaySnippet() {
  return (
    <Sheet className="max-w-[28rem]">
      <Title sub="3 done · 1 carried to tomorrow">Close the day</Title>
      <ul className="mt-4 flex flex-col gap-2 text-ui">
        {['Send the Ridgeline invoice', 'Finish the logo presentation', 'Reply to Beacon about scope'].map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-ink-500 line-through">
            <Icon icon={Check} size={14} className="text-success-600" />{t}
          </li>
        ))}
        <li className="flex items-center gap-2.5 text-ink-900">
          <span className="size-3.5 rounded-xs border border-line-strong" />Type and color system
          <Badge status="neutral" className="ms-auto">Tomorrow</Badge>
        </li>
      </ul>
      <p className="mt-4 rounded-lg bg-surface-fill px-3 py-2 text-ui text-ink-700">Good day. Start with the type system in the morning.</p>
    </Sheet>
  );
}

/** Focus mode, running — only while `running` (its picture is showing), the tab is visible, and motion is welcome. */
export function FocusSnippet({ running }: { running: boolean }) {
  const [left, setLeft] = React.useState(24 * 60 + 12);
  React.useEffect(() => {
    if (!running || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setLeft((s) => (s > 0 ? s - 1 : 25 * 60));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);
  const R = 58;
  const C = 2 * Math.PI * R;
  const pct = 1 - left / (25 * 60);
  return (
    <Sheet className="flex max-w-[22rem] flex-col items-center gap-4 py-8">
      <p className="flex items-center gap-1.5 text-caption font-medium text-ink-500"><Icon icon={Timer} size={14} />Focus</p>
      <div className="relative grid size-[136px] place-items-center">
        <svg viewBox="0 0 136 136" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="68" cy="68" r={R} fill="none" strokeWidth="4" className="stroke-line" />
          <circle cx="68" cy="68" r={R} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-ink-900" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        </svg>
        <span className="text-title-1 tabular-nums text-ink-900">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>
      </div>
      <p className="max-w-[22ch] text-center font-editorial text-title-3 text-ink-900">Finish the logo presentation</p>
      <Button size="sm" variant="secondary" tabIndex={-1} icon={<Icon icon={Pause} size={14} />}>Pause</Button>
    </Sheet>
  );
}

// ── PROJECTS ────────────────────────────────────────────────────────────────

export function WaitingSnippet() {
  const rows = [
    { face: FACES.daniel, who: 'Daniel Okafor', what: 'Beacon · sign-off on the sitemap', since: '2 days' },
    { face: FACES.maya, who: 'Maya Chen', what: 'Copper Row · brand assets', since: 'since Monday' },
    { face: FACES.priya, who: 'Priya Nair', what: 'Ridgeline · feedback on route B', since: 'today' },
  ];
  return (
    <Sheet className="max-w-[30rem]">
      <Title sub="Their move, not yours, so it stays off your plan.">Waiting on</Title>
      <ul className="mt-4 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.who} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-line-soft')}>
            <Avatar name={r.who} src={r.face} size="md" decorative />
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui text-ink-900">{r.what}</p>
              <p className="truncate text-caption text-ink-500">{r.who}</p>
            </div>
            <span className="shrink-0 text-caption text-ink-500">{r.since}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ── THE CLIENT PORTAL ───────────────────────────────────────────────────────

export function ChatSnippet() {
  const msgs = [
    { face: FACES.priya, who: 'Priya', at: '10:12', text: 'Could the wordmark be a touch heavier? It feels thin next to the mark.' },
    { face: FACES.alex, who: 'Alex', at: '10:40', text: 'Done. Version 3 is in the portal, with the heavier weight.' },
    { face: FACES.priya, who: 'Priya', at: '10:41', text: 'Perfect. Approving it now.' },
  ];
  return (
    <Sheet className="max-w-[30rem]">
      <div className="flex items-center gap-2 border-b border-line-soft pb-3">
        <Icon icon={MessageCircle} size={16} className="text-ink-500" />
        <p className="text-ui font-medium text-ink-900">Ridgeline rebrand</p>
        <span className="text-caption text-ink-500">· shared with Ridgeline</span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {msgs.map((m) => (
          <li key={m.at} className="flex gap-3">
            <Avatar name={m.who} src={m.face} size="md" decorative />
            <div className="min-w-0">
              <p className="text-ui"><span className="font-medium text-ink-900">{m.who}</span> <span className="text-caption tabular-nums text-ink-500">{m.at}</span></p>
              <p className="text-body text-ink-800">{m.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg border border-line px-3 py-2 text-ui text-ink-500">Message Northlight Studio</p>
    </Sheet>
  );
}

// ── MONEY ───────────────────────────────────────────────────────────────────

export function FinanceSnippet() {
  const rows = [
    { n: 'INV-021', c: 'Ridgeline', s: 'Sent', tone: 'info' as const, a: '$4,200' },
    { n: 'INV-020', c: 'Beacon Health', s: 'Paid', tone: 'success' as const, a: '$2,650' },
    { n: 'INV-019', c: 'Copper Row', s: 'Overdue', tone: 'danger' as const, a: '$1,800' },
  ];
  return (
    <Sheet className="max-w-[34rem]">
      <div className="grid grid-cols-3 gap-4 border-b border-line-soft pb-4">
        <Stat label="Outstanding" value="$6,000" />
        <Stat label="Paid this month" value="$12,400" />
        <Stat label="Overdue" value="$1,800" />
      </div>
      <ul className="mt-2 flex flex-col">
        {rows.map((r, i) => (
          <li key={r.n} className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)_auto_4.5rem] items-center gap-3 py-2.5 text-ui', i > 0 && 'border-t border-line-soft')}>
            <span className="font-mono text-caption text-ink-500">{r.n}</span>
            <span className="truncate text-ink-900">{r.c}</span>
            <Badge status={r.tone}>{r.s}</Badge>
            <span className="text-end tabular-nums font-medium text-ink-900">{r.a}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function ExportSnippet() {
  const files = ['Invoices with totals and balances', 'Their line items', 'Payments received'];
  return (
    <Sheet className="max-w-[28rem]">
      <Title sub="Three sheets, ready for a spreadsheet.">For your accountant</Title>
      <ul className="mt-4 flex flex-col gap-2">
        {files.map((f) => (
          <li key={f} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-field-sage text-caption font-medium text-ink-900">CSV</span>
            <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{f}</span>
            <Icon icon={Download} size={16} className="text-ink-500" />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Tracked time becoming an invoice — the one money snippet you can press. */
export function TimeToInvoice() {
  const [made, setMade] = React.useState(false);
  return (
    <Sheet inert={false} className="max-w-[30rem]">
      <Title sub="Ridgeline rebrand · at $150 an hour">Time not billed yet</Title>
      <ul className="mt-4 flex flex-col text-ui">
        {[['Logo exploration', '4h 00m'], ['Type and color system', '2h 30m']].map(([t, h]) => (
          <li key={t} className="flex items-center justify-between border-b border-line-soft py-2.5">
            <span className="text-ink-900">{t}</span><span className="tabular-nums text-ink-600">{h}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3">
        {made ? (
          <p key="made" className="site-swap zb-enter flex items-center gap-1.5 text-ui text-ink-800">
            <Icon icon={Check} size={14} className="text-success-600" />INV-022 · 6h 30m · $975.00
          </p>
        ) : (
          <p className="text-ui text-ink-800"><span className="tabular-nums font-medium">6h 30m</span> · $975.00</p>
        )}
        <Button size="sm" variant={made ? 'ghost' : 'secondary'} onClick={() => setMade((m) => !m)}>{made ? 'Start over' : 'Create invoice'}</Button>
      </div>
    </Sheet>
  );
}
