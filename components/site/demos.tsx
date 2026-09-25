'use client';
// ── THE TOUR'S DEMOS ────────────────────────────────────────────────────────
//
// Four small working pieces of Zenboard, one per stop on the product tour. Each does ONE thing the
// real product does, with the real parts (Checkbox, Badge, SegmentedControl, Tooltip, Button), and
// nothing it doesn't — a website that shows a feature the product lacks is a promise the product
// then breaks. Nothing is saved; "Start over" puts each one back.

import * as React from 'react';
import { Check, Clock, RotateCcw } from '@/components/ds/icons';
import { Badge, Button, Checkbox, Icon, SegmentedControl, Tooltip, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

const money = (n: number) => formatMoney(n, { exact: true });

// ── PLAN THE WEEK: timeboxing ────────────────────────────────────────────────

const DAY_START = 9 * 60;
const DAY_END = 17 * 60;
const PX_PER_MIN = 0.62;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type Block = { id: string; title: string; start: number; end: number; event?: boolean };
const EVENTS: Block[] = [
  { id: 'call', title: 'Ridgeline call', start: 11 * 60 + 30, end: 12 * 60, event: true },
  { id: 'lunch', title: 'Lunch', start: 13 * 60, end: 14 * 60, event: true },
];
const QUEUE = [
  { id: 'logo', title: 'Finish the logo presentation', mins: 120 },
  { id: 'beacon', title: 'Reply to Beacon about scope', mins: 30 },
  { id: 'admin', title: 'Invoices and admin', mins: 45 },
];

/** The earliest quarter hour where `mins` fits between what is already on the day. */
function nextSlot(mins: number, taken: Block[]): number | null {
  for (let t = DAY_START; t + mins <= DAY_END; t += 15) {
    if (taken.every((b) => t + mins <= b.start || t >= b.end)) return t;
  }
  return null;
}

export function TimeboxDemo() {
  const [placed, setPlaced] = React.useState<Block[]>([]);
  const day = [...EVENTS, ...placed];

  const schedule = (q: (typeof QUEUE)[number]) => {
    const start = nextSlot(q.mins, day);
    if (start === null) return;
    setPlaced((p) => [...p, { id: q.id, title: q.title, start, end: start + q.mins }]);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <p className="text-overline text-ink-500">To schedule</p>
        {QUEUE.map((q) => {
          const at = placed.find((p) => p.id === q.id);
          return (
            <div key={q.id} className={cardClass('flex items-center gap-3 px-3 py-2.5')}>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-ui', at ? 'text-ink-500' : 'text-ink-900')}>{q.title}</p>
                <p className="text-caption tabular-nums text-ink-500">
                  {at ? `${hhmm(at.start)} – ${hhmm(at.end)}` : q.mins >= 60 ? `${q.mins / 60}h` : `${q.mins}m`}
                </p>
              </div>
              {at ? (
                <Icon icon={Check} size={16} className="shrink-0 text-success-600" aria-label="Scheduled" />
              ) : (
                <Button size="xs" variant="secondary" onClick={() => schedule(q)}>Schedule</Button>
              )}
            </div>
          );
        })}
        {placed.length > 0 && (
          <Button size="xs" variant="ghost" className="self-start" icon={<Icon icon={RotateCcw} size={14} />} onClick={() => setPlaced([])}>
            Start over
          </Button>
        )}
      </div>

      <div className={cardClass('relative')} style={{ height: (DAY_END - DAY_START) * PX_PER_MIN + 16 }}>
        {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => (
          <div key={i} className="absolute inset-x-0 flex items-center gap-2 px-2" style={{ top: 8 + i * 60 * PX_PER_MIN }}>
            <span className="w-10 -translate-y-1/2 text-caption tabular-nums text-ink-500">{hhmm(DAY_START + i * 60)}</span>
            <span className="h-px flex-1 -translate-y-1/2 bg-line-soft" />
          </div>
        ))}
        {day.map((b) => (
          <div
            key={b.id}
            className={cn(
              'absolute end-2 start-14 overflow-hidden rounded-md px-2.5 py-1',
              b.event ? 'bg-surface-fill text-ink-800' : 'site-swap zb-enter border border-line-strong bg-surface-selected text-ink-900',
            )}
            style={{ top: 8 + (b.start - DAY_START) * PX_PER_MIN, height: (b.end - b.start) * PX_PER_MIN - 2 }}
          >
            <p className="truncate text-caption font-medium">{b.title}</p>
            {(b.end - b.start) >= 45 && (
              <p className="truncate text-caption text-ink-500">{b.event ? 'Google Calendar' : `${hhmm(b.start)} – ${hhmm(b.end)}`}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RUN EVERY PROJECT: one task, two views ────────────────────────────────────

type PTask = { id: string; title: string; stream: string; done: boolean; due?: string };
const STREAMS = ['Discovery', 'Design', 'Delivery'];
const PROJECT: PTask[] = [
  { id: 'kick', title: 'Kick-off workshop', stream: 'Discovery', done: true },
  { id: 'audit', title: 'Competitor audit', stream: 'Discovery', done: true },
  { id: 'routes', title: 'Three logo routes', stream: 'Design', done: true },
  { id: 'present', title: 'Logo presentation', stream: 'Design', done: false, due: 'Fri' },
  { id: 'type', title: 'Type and color system', stream: 'Design', done: false },
  { id: 'guide', title: 'Brand guidelines', stream: 'Delivery', done: false, due: 'Nov 14' },
  { id: 'handover', title: 'Asset handover', stream: 'Delivery', done: false },
];

/** One task, the same in both views. Top level, so ticking it never remounts the box under the pointer. */
function TaskLine({ t, onToggle }: { t: PTask; onToggle: (id: string) => void }) {
  return (
    <>
      <Checkbox checked={t.done} onCheckedChange={() => onToggle(t.id)} aria-label={t.done ? `Mark “${t.title}” as not done` : `Complete “${t.title}”`} />
      <span className={cn('min-w-0 flex-1 truncate text-ui transition-colors duration-fast ease-hover', t.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{t.title}</span>
      {t.due && <span className="shrink-0 text-caption text-ink-500">{t.due}</span>}
    </>
  );
}

export function BoardDemo() {
  const [view, setView] = React.useState<'list' | 'board'>('list');
  const [tasks, setTasks] = React.useState(PROJECT);
  const toggle = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-editorial text-title-3 text-ink-900">Ridgeline rebrand</p>
        <SegmentedControl
          aria-label="View"
          fit="content"
          value={view}
          onValueChange={(v) => setView(v as 'list' | 'board')}
          options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }]}
        />
      </div>

      {/* Keyed on the view: switching is a new arrangement of the SAME tasks — tick one, switch, it is still ticked. */}
      <div key={view} className="site-swap zb-enter">
        {view === 'list' ? (
          <div className={cardClass('overflow-hidden')}>
            {STREAMS.map((s) => {
              const rows = tasks.filter((t) => t.stream === s);
              return (
                <div key={s}>
                  <p className="flex items-center gap-2 border-b border-line-soft bg-surface-fill px-4 py-1.5 text-caption font-medium text-ink-700">
                    {s}<span className="tabular-nums text-ink-500">{rows.filter((t) => t.done).length}/{rows.length}</span>
                  </p>
                  {rows.map((t) => (
                    <div key={t.id} className="flex h-[var(--row-task)] items-center gap-3 border-b border-line-soft px-4 last:border-b-0">
                      <TaskLine t={t} onToggle={toggle} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {STREAMS.map((s) => (
              <div key={s} className="flex flex-col gap-2 rounded-lg bg-surface-fill p-2">
                <p className="px-1.5 pt-1 text-caption font-medium text-ink-700">{s}</p>
                {tasks.filter((t) => t.stream === s).map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-md border border-line bg-paper px-2.5 py-2">
                    <TaskLine t={t} onToggle={toggle} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── WRITE WHERE THE WORK IS: a brief that knows what it is about ─────────────

export function DocDemo() {
  const [checks, setChecks] = React.useState([
    { text: 'Three logo routes', done: true },
    { text: 'Type and color system', done: false },
    { text: 'Brand guidelines, 12 pages', done: false },
  ]);
  return (
    <div className="w-full">
      <p className="font-editorial text-title-1 text-ink-900">Ridgeline, brand brief</p>
      <dl className="mt-4 grid grid-cols-[88px_1fr] gap-y-2 text-ui">
        <dt className="text-ink-500">Client</dt><dd className="text-ink-900">Ridgeline</dd>
        <dt className="text-ink-500">Status</dt><dd><Badge status="info">In review</Badge></dd>
      </dl>
      <div className="mt-6 flex flex-col gap-3 border-t border-line-soft pt-6 text-body text-ink-800">
        <p>
          The brand should feel like the gear: quiet, sure of itself, made to be used. We present the routes in{' '}
          <Tooltip content="Task in Ridgeline rebrand · due Friday">
            <button type="button" className="focus-ring rounded-xs bg-surface-fill px-1 font-medium text-ink-900 underline decoration-line-strong underline-offset-2 transition-colors duration-fast ease-hover hover:bg-surface-active">
              Logo presentation
            </button>
          </Tooltip>
          , then build out the chosen one.
        </p>
        <p className="text-overline text-ink-500">Deliverables</p>
        {checks.map((c, i) => (
          <Checkbox
            key={c.text}
            checked={c.done}
            onCheckedChange={() => setChecks((cs) => cs.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            label={<span className={cn('text-body transition-colors duration-fast ease-hover', c.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{c.text}</span>}
          />
        ))}
      </div>
    </div>
  );
}

// ── GET PAID: an invoice, and the payment that settles it ─────────────────────

const LINES = [
  { what: 'Discovery workshop', qty: 6, rate: 150 },
  { what: 'Logo exploration, three routes', qty: 18, rate: 120 },
  { what: 'Type and color system', qty: 8, rate: 135 },
];

export function InvoiceDemo() {
  const [paid, setPaid] = React.useState(false);
  const total = LINES.reduce((a, l) => a + l.qty * l.rate, 0);
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-overline text-ink-500">Invoice to Ridgeline</p>
          <p className="mt-1 font-mono text-ui text-ink-900">INV-021</p>
        </div>
        <Badge status={paid ? 'success' : 'info'}>{paid ? 'Paid' : 'Sent'}</Badge>
      </div>

      <div className="mt-6 border-t border-line">
        {LINES.map((l) => (
          <div key={l.what} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line-soft py-2.5 text-ui sm:grid-cols-[1fr_auto_auto]">
            <span className="min-w-0 truncate text-ink-900">{l.what}</span>
            <span className="hidden text-caption tabular-nums text-ink-500 sm:inline">{l.qty} × {money(l.rate)}</span>
            <span className="text-end tabular-nums font-medium text-ink-900">{money(l.qty * l.rate)}</span>
          </div>
        ))}
      </div>

      <dl className="ms-auto mt-4 grid max-w-[260px] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-ui">
        <dt className="text-ink-600">Total</dt><dd className="text-end tabular-nums text-ink-900">{money(total)}</dd>
        {paid && (
          <>
            <dt className="site-swap zb-enter text-ink-600">Paid today</dt>
            <dd className="site-swap zb-enter text-end tabular-nums text-success-600">−{money(total)}</dd>
          </>
        )}
        <dt className="border-t border-line pt-2 font-medium text-ink-900">Balance</dt>
        <dd className="border-t border-line pt-2 text-end tabular-nums font-semibold text-ink-900">{money(paid ? 0 : total)}</dd>
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
        <p className="flex items-center gap-1.5 text-caption text-ink-500">
          <Icon icon={Clock} size={14} />
          {paid ? 'Ridgeline’s portal shows it paid' : 'Due Oct 20 · visible in Ridgeline’s portal'}
        </p>
        {paid ? (
          <Button size="sm" variant="ghost" icon={<Icon icon={RotateCcw} size={14} />} onClick={() => setPaid(false)}>Start over</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setPaid(true)}>Record payment</Button>
        )}
      </div>
    </div>
  );
}
