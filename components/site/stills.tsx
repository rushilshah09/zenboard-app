'use client';
// ── THE PRODUCT, AT REST ────────────────────────────────────────────────────
//
// Every picture of Zenboard on the website is drawn with Zenboard's own parts — Panel, Checkbox,
// Badge, Progress, DataTable, the mark — never a screenshot. A screenshot goes stale the week the
// product changes; these cannot, because they ARE the product's components (the sign-in screen's
// rule, applied to the whole site).
//
// Each still is INERT: hidden from assistive tech (the section's own words carry the meaning),
// unclickable, and out of the tab order. They show a sample studio — Alex and three clients —
// the same one the sign-in screen shows, and they name no real client.
//
// A CLIENT module: the stills use the DS's client parts (Avatar, DataTable, whose columns are
// functions), and a picture has nothing to fetch — the page around them stays a server component.

import * as React from 'react';
import {
  Calendar as CalendarIcon, FileText, Flame, Folder, House, Landmark, MessageCircle, SquarePen, Users,
} from '@/components/ds/icons';
import {
  Avatar, Badge, Checkbox, DataTable, Icon, Logo, Mark, Panel, PanelBody, PanelHeader, Progress, Stat, cardClass,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';

/** The inert frame every still shares: part of the page's picture, none of its controls. */
function Inert({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div aria-hidden inert className={cn('pointer-events-none select-none', className)}>
      {children}
    </div>
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Home', icon: House, on: true },
  { label: 'Tasks', icon: SquarePen },
  { label: 'Calendar', icon: CalendarIcon },
  { label: 'Projects', icon: Folder },
  { label: 'Clients', icon: Users },
  { label: 'Documents', icon: FileText },
  { label: 'Messages', icon: MessageCircle },
  { label: 'Finance', icon: Landmark },
];

const PLAN: { title: string; where: string; done?: boolean }[] = [
  { title: 'Finish the logo presentation', where: 'Ridgeline rebrand' },
  { title: 'Reply to Beacon about scope', where: 'Beacon Health site' },
  { title: 'Review the launch checklist', where: 'Copper Row launch' },
  { title: 'Weekly review', where: 'Done 9:40', done: true },
];

const DAY = [
  { when: '09:00', what: 'Deep work: logo presentation' },
  { when: '11:30', what: 'Ridgeline call', now: true },
  { when: '14:00', what: 'Beacon Health — sitemap review' },
  { when: '16:30', what: 'Invoices and admin' },
];

/** Zenboard's Home, inside the app's own frame: the sidebar and the page you open every morning. */
export function HomeStill({ className }: { className?: string }) {
  return (
    <Inert className={cn('sheet flex w-[1180px] overflow-hidden', className)}>
      {/* On a phone the sidebar would be all the picture shows, so there it is left out: Home is what
          a thumb should see first — the same call the app makes at that width. */}
      <nav className="flex w-[232px] shrink-0 flex-col gap-0.5 border-e border-line-soft bg-sidebar px-3 py-4 max-sm:hidden">
        <div className="mb-4 px-2"><Logo height={22} /></div>
        {NAV.map((n) => (
          <span
            key={n.label}
            className={cn(
              'flex h-[var(--row-nav)] items-center gap-2.5 rounded-md px-2.5 text-ui',
              n.on ? 'bg-surface-active font-medium text-ink-900' : 'text-ink-700',
            )}
          >
            <Icon icon={n.icon} size={16} className={n.on ? 'text-ink-900' : 'text-ink-500'} />
            {n.label}
          </span>
        ))}
      </nav>

      <div className="min-w-0 flex-1 px-10 pb-12 pt-9">
        <header>
          <div className="mb-2 flex items-center gap-2">
            <Mark size={24} tone="brand" />
            <h3 className="font-editorial text-title-2 leading-none font-medium text-ink-900">Good morning, Alex.</h3>
          </div>
          <p className="text-ui text-ink-500">
            You’ve committed to <b className="font-medium text-ink-800">4 tasks</b> and 2 meetings. Highlight:{' '}
            <span className="font-medium text-ink-800">Send the Ridgeline invoice.</span>
          </p>
        </header>

        <div className="mt-7 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-5">
          <div className="flex flex-col gap-5">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={Flame} size={20} className="text-accent" />} title="Today’s highlight" summary="Do this first" />
              <PanelBody>
                <div className="flex w-full flex-col gap-2 px-[var(--panel-px)] py-4">
                  <span className="text-title-3 font-medium text-ink-900">Send the Ridgeline invoice</span>
                  <span className="flex items-center gap-3 text-caption text-ink-500">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-xs bg-accent" />Finance</span>
                    <span>15m</span>
                    <span>High</span>
                  </span>
                </div>
              </PanelBody>
            </Panel>

            <Panel frame="shadow">
              <PanelHeader title="Plan" count={PLAN.length} />
              <PanelBody>
                {PLAN.map((t, i) => (
                  <div key={t.title} className={cn('flex h-[var(--row-task)] w-full items-center gap-3 px-[var(--panel-px)]', i > 0 && 'border-t border-line-soft')}>
                    <Checkbox checked={!!t.done} tabIndex={-1} aria-hidden />
                    <span className={cn('min-w-0 flex-1 truncate text-ui', t.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{t.title}</span>
                    <span className="shrink-0 text-caption text-ink-500">{t.where}</span>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          </div>

          <div className="flex flex-col gap-5">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={CalendarIcon} size={20} className="text-ink-500" />} title="Schedule" summary="Thursday" />
              <PanelBody>
                {DAY.map((d, i) => (
                  <div key={d.when} className={cn('flex h-[var(--row-task)] w-full items-center gap-3 px-[var(--panel-px)]', i > 0 && 'border-t border-line-soft')}>
                    <span className="w-11 shrink-0 text-caption tabular-nums text-ink-500">{d.when}</span>
                    <span className={cn('min-w-0 flex-1 truncate text-ui', d.now ? 'font-medium text-ink-900' : 'text-ink-800')}>{d.what}</span>
                    {d.now && <Badge status="info">Now</Badge>}
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <Panel frame="shadow">
              <PanelHeader title="Waiting on" summary="Their move" />
              <PanelBody>
                <div className="flex w-full items-center gap-3 px-[var(--panel-px)] py-3">
                  <Avatar name="Priya Nair" size="sm" decorative />
                  <span className="min-w-0 flex-1 truncate text-ui text-ink-800">Beacon — sign-off on the sitemap</span>
                  <span className="shrink-0 text-caption text-ink-500">2 days</span>
                </div>
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </Inert>
  );
}

// ── PROJECTS ─────────────────────────────────────────────────────────────────

const PROJECTS = [
  { name: 'Ridgeline rebrand', client: 'Ridgeline', due: 'Due Friday', done: 18, total: 25, next: 'Logo presentation' },
  { name: 'Beacon Health site', client: 'Beacon Health', due: 'Due 14 Nov', done: 9, total: 22, next: 'Sitemap sign-off' },
  { name: 'Copper Row launch', client: 'Copper Row', due: 'Starts Monday', done: 2, total: 16, next: 'Kick-off call' },
];

/** Projects, each carrying its client, its progress and its next move. */
export function ProjectsStill({ className }: { className?: string }) {
  return (
    <Inert className={cn('grid gap-4 sm:grid-cols-3', className)}>
      {PROJECTS.map((p) => {
        const pct = Math.round((p.done / p.total) * 100);
        return (
          <div key={p.name} className={cardClass('flex flex-col gap-4 p-5')}>
            <div className="flex items-center gap-2.5">
              <Avatar name={p.client} size="sm" decorative />
              <span className="truncate text-caption text-ink-500">{p.client}</span>
            </div>
            <div>
              <p className="font-editorial text-title-3 text-ink-900">{p.name}</p>
              <p className="mt-1 text-caption text-ink-500">{p.due}</p>
            </div>
            <Progress value={pct} size="sm" valueText={`${p.done} of ${p.total} tasks done`} />
            <div className="flex items-center justify-between border-t border-line-soft pt-3 text-caption">
              <span className="text-ink-500">Next</span>
              <span className="truncate text-ink-800">{p.next}</span>
            </div>
          </div>
        );
      })}
    </Inert>
  );
}

// ── THE CLIENT PORTAL ────────────────────────────────────────────────────────

/** What a CLIENT sees: their project, what needs them, and a conversation — nothing internal. */
export function PortalStill({ className }: { className?: string }) {
  return (
    <Inert className={cn('sheet w-full max-w-[720px] p-8', className)}>
      <p className="text-caption text-ink-500">Shared by Northlight Studio</p>
      <h3 className="mt-1 font-editorial text-title-1 text-ink-900">Ridgeline rebrand</h3>
      <div className="mt-6 grid grid-cols-3 gap-6 border-y border-line-soft py-5">
        <Stat label="Progress" value="72%" />
        <Stat label="Needs you" value="1" />
        <Stat label="Balance due" value="$4,200" />
      </div>
      <div className="mt-6 flex items-center gap-4 rounded-lg border border-line p-4">
        <div className="min-w-0 flex-1">
          <p className="text-ui font-medium text-ink-900">Logo presentation</p>
          <p className="mt-0.5 text-caption text-ink-500">Three routes, ready for your decision</p>
        </div>
        <Badge status="warning">Awaiting you</Badge>
      </div>
      <div className="mt-6 flex gap-3">
        <Avatar name="Alex Morgan" size="md" decorative />
        <div>
          <p className="text-ui"><span className="font-medium text-ink-900">Alex</span> <span className="text-caption text-ink-500">10:42</span></p>
          <p className="mt-0.5 text-body text-ink-800">The routes are up. Route B is my pick, and I’ve noted why on each.</p>
        </div>
      </div>
    </Inert>
  );
}

// ── A DOCUMENT ───────────────────────────────────────────────────────────────

/** A brief, where the work is: properties at the top, then writing and a checklist. */
export function DocStill({ className }: { className?: string }) {
  const checks = [
    { text: 'Three logo routes', done: true },
    { text: 'Type and colour system', done: true },
    { text: 'Brand guidelines, 12 pages', done: false },
  ];
  return (
    <Inert className={cn('sheet w-full max-w-[720px] px-10 py-9', className)}>
      <h3 className="font-editorial text-title-1 text-ink-900">Ridgeline — brand brief</h3>
      <dl className="mt-4 grid grid-cols-[96px_1fr] gap-y-2 text-ui">
        <dt className="text-ink-500">Client</dt><dd className="text-ink-900">Ridgeline</dd>
        <dt className="text-ink-500">Status</dt><dd><Badge status="info">In review</Badge></dd>
        <dt className="text-ink-500">Due</dt><dd className="text-ink-900">Friday</dd>
      </dl>
      <div className="mt-6 flex max-w-[60ch] flex-col gap-3 border-t border-line-soft pt-6 text-body text-ink-800">
        <p>Ridgeline builds outdoor gear that lasts twenty years. The brand should feel the same: quiet, sure of itself, made to be used.</p>
        <p className="text-overline text-ink-500">Deliverables</p>
        {checks.map((c) => (
          <span key={c.text} className="flex items-center gap-3">
            <Checkbox checked={c.done} tabIndex={-1} aria-hidden />
            <span className={c.done ? 'text-ink-500 line-through' : 'text-ink-900'}>{c.text}</span>
          </span>
        ))}
      </div>
    </Inert>
  );
}

// ── FINANCE ──────────────────────────────────────────────────────────────────

type Inv = { id: string; number: string; client: string; status: 'Sent' | 'Paid' | 'Overdue'; due: string; amount: string };
const INVOICES: Inv[] = [
  { id: '1', number: 'INV-021', client: 'Ridgeline', status: 'Sent', due: '20 Oct', amount: '$4,200' },
  { id: '2', number: 'INV-020', client: 'Beacon Health', status: 'Paid', due: '2 Oct', amount: '$2,650' },
  { id: '3', number: 'INV-019', client: 'Copper Row', status: 'Overdue', due: '28 Sep', amount: '$1,800' },
];
const TONE = { Sent: 'info', Paid: 'success', Overdue: 'danger' } as const;

/** What is owed, what came in, and the invoices behind both. */
export function FinanceStill({ className }: { className?: string }) {
  return (
    <Inert className={cn('flex w-full flex-col gap-4', className)}>
      <div className={cardClass('grid grid-cols-3 gap-6 p-5')}>
        <Stat label="Outstanding" value="$6,000" />
        <Stat label="Paid this month" value="$12,400" />
        <Stat label="Overdue" value="$1,800" />
      </div>
      <DataTable
        caption="Invoices"
        rows={INVOICES}
        rowKey={(r) => r.id}
        columns={[
          { key: 'number', header: 'Invoice', mono: true, cell: (r) => r.number },
          { key: 'client', header: 'Client', cell: (r) => <span className="text-ink-900">{r.client}</span> },
          { key: 'status', header: 'Status', cell: (r) => <Badge status={TONE[r.status]}>{r.status}</Badge> },
          { key: 'due', header: 'Due', cell: (r) => <span className="text-ink-600">{r.due}</span> },
          { key: 'amount', header: 'Amount', numeric: true, cell: (r) => <span className="font-medium text-ink-900">{r.amount}</span> },
        ]}
      />
    </Inert>
  );
}
