'use client';
// Money hub overview — one quiet KPI strip (Unbilled · Outstanding · Paid this
// month · Overdue), a filterable invoices table, recent payments, and the
// new-invoice flow that pulls a client's unbilled time as suggested line items.
// All values from real records. Built on DS primitives (Stat, Badge, Checkbox,
// Modal, Select, Field, toast); optimistic, reconciles server/realtime props.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Landmark, Search, X, Clock } from '@/components/ds/icons';
import { PageHeader } from '@/components/ui/page-header';
import { ViewContainer } from '@/components/ui/view-container';
import {
  Icon, Button, IconButton, Badge, Stat, Checkbox, EmptyState,
  Modal, Field, TextInput, Select, Toaster, toast,
  type BadgeStatus,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { addInvoice } from '@/lib/actions/money';
import { useViewWidth } from '@/components/shell/view-width';

export type ClientLite = { id: string; name: string };
export type Invoice = { id: string; number: string; client_id: string | null; project_id: string | null; status: string; due_date: string | null; notes: string | null; created_at: string; total: number; itemCount: number; paid: number };
export type UnbilledLog = { id: string; project_id: string | null; project_name: string | null; client_id: string | null; minutes: number; started_at: string; value: number };
export type PaymentRow = { id: string; invoice_id: string; amount: number; paid_on: string; method: string | null; number: string; client_id: string | null };

export const usd = (n: number) => '$' + Math.round(n).toLocaleString();
const todayISO = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d: string | null) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—');
export const fmtDur = (m: number) => (m <= 0 ? '0m' : m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`);

// 'sent' past its due date reads as 'overdue' (underlying status stays 'sent').
export function displayStatus(inv: { status: string; due_date: string | null }): string {
  if (inv.status === 'sent' && inv.due_date && inv.due_date < todayISO()) return 'overdue';
  return inv.status;
}
// Status → DS Badge tone. Shared with invoice-detail.
export const STATUS_TONE: Record<string, BadgeStatus> = { draft: 'neutral', sent: 'info', paid: 'success', overdue: 'danger', void: 'neutral' };

const NONE = '__none__'; // Radix Select reserves '' — sentinel for "No client".
const GRID = '110px 1fr 70px 96px 96px 100px';
const STATUS_ORDER = ['all', 'draft', 'sent', 'overdue', 'paid'];

type Line = { description: string; quantity: string; unit_amount: string };

// One KPI cell in the strip: DS Stat (label + mono value) + a quiet hint line.
function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface-raised px-5 py-[18px]">
      <Stat label={label} value={value} />
      <p className="mt-1.5 text-caption text-ink-500">{hint}</p>
    </div>
  );
}

// A single-select filter chip with a count. Quiet by default (borderless text so
// the row reads as one calm group, not six competing outlined pills); the
// selected chip lifts into a raised pill with a hairline ring. Not a view toggle,
// so not a SegmentedControl (which can't carry per-option counts).
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-caption font-medium transition-colors duration-fast',
        active
          ? 'bg-surface-raised text-ink-900 shadow-[inset_0_0_0_1px_var(--color-line)]'
          : 'text-ink-500 hover:bg-surface-hover hover:text-ink-800',
      )}
    >
      {children}
    </button>
  );
}

export function MoneyView({ invoices: initInvoices, clients, unbilled, payments, monthStart, rate }: {
  invoices: Invoice[]; clients: ClientLite[]; unbilled: UnbilledLog[]; payments: PaymentRow[]; monthStart: string; rate: number;
}) {
  const router = useRouter();
  const { full } = useViewWidth();
  const [invoices, setInvoices] = useState(initInvoices);
  useEffect(() => { setInvoices(initInvoices); }, [initInvoices]);
  const [composing, setComposing] = useState(false);

  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? 'Client' : 'No client');

  // filters
  const [statusF, setStatusF] = useState('all');
  const [clientF, setClientF] = useState('all');
  const [search, setSearch] = useState('');

  // KPIs (real)
  const unbilledTotal = unbilled.reduce((a, t) => a + t.value, 0);
  const unbilledMin = unbilled.reduce((a, t) => a + t.minutes, 0);
  const outstandingInvoices = invoices.filter((i) => { const s = displayStatus(i); return s === 'sent' || s === 'overdue'; });
  const outstanding = outstandingInvoices.reduce((a, i) => a + (i.total - i.paid), 0);
  const paidThisList = payments.filter((p) => p.paid_on >= monthStart);
  const paidThisMonth = paidThisList.reduce((a, p) => a + Number(p.amount), 0);
  const overdueCount = invoices.filter((i) => displayStatus(i) === 'overdue').length;

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: invoices.length };
    for (const i of invoices) { const s = displayStatus(i); c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [invoices]);
  const hasVoid = (statusCounts.void ?? 0) > 0;
  const statusPills = [...STATUS_ORDER, ...(hasVoid ? ['void'] : [])];

  const filtered = invoices
    .filter((i) => (statusF === 'all' ? true : displayStatus(i) === statusF))
    .filter((i) => (clientF === 'all' ? true : i.client_id === clientF))
    .filter((i) => { const q = search.trim().toLowerCase(); return !q || (i.number + ' ' + clientName(i.client_id)).toLowerCase().includes(q); });

  async function create(input: { clientId: string | null; dueDate: string | null; items: { description: string; quantity: number; unit_amount: number; timeEntryId?: string | null }[] }) {
    if (!input.items.length) return;
    setComposing(false);
    const total = input.items.reduce((a, i) => a + i.quantity * i.unit_amount, 0);
    const tmp = 'tmp-' + Date.now();
    setInvoices((iv) => [{ id: tmp, number: '…', client_id: input.clientId, project_id: null, status: 'draft', due_date: input.dueDate, notes: null, created_at: new Date().toISOString(), total, itemCount: input.items.length, paid: 0 }, ...iv]);
    const res = await addInvoice({ clientId: input.clientId, dueDate: input.dueDate, items: input.items });
    if ('id' in res) { toast({ message: `${res.number} created`, variant: 'info' }); router.refresh(); }
    else { setInvoices((iv) => iv.filter((x) => x.id !== tmp)); toast({ message: res.error, variant: 'error' }); }
  }

  return (
    <ViewContainer full={full} className="relative pb-[var(--view-pb)] pt-8" style={{ animation: 'fadein 220ms' }}>
      <PageHeader hideTitle icon={Landmark} title="Finance" subtitle="Log time, bill it, get paid." style={{ marginBottom: 20 }}
        actions={<Button variant="primary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setComposing(true)}>New invoice</Button>} />

      {/* KPIs — one bordered strip of hairline-divided cells (not four tiles). */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Kpi label="Unbilled" value={usd(unbilledTotal)} hint={unbilled.length ? `${fmtDur(unbilledMin)} · ${unbilled.length} entr${unbilled.length === 1 ? 'y' : 'ies'}` : 'all billed'} />
        <Kpi label="Outstanding" value={usd(outstanding)} hint={`${outstandingInvoices.length} invoice${outstandingInvoices.length === 1 ? '' : 's'}`} />
        <Kpi label="Paid this month" value={usd(paidThisMonth)} hint={paidThisList.length ? `${paidThisList.length} payment${paidThisList.length === 1 ? '' : 's'}` : 'none yet'} />
        <Kpi label="Overdue" value={String(overdueCount)} hint={overdueCount ? 'need a nudge' : 'all current'} />
      </div>

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="flex h-8 min-w-[180px] flex-[1_1_220px] items-center gap-2 rounded-md border border-line-soft bg-surface-raised px-3">
          <Icon icon={Search} size={14} className="shrink-0 text-ink-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client or number" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="min-w-0 flex-1 border-0 bg-transparent text-ui text-ink-900 outline-none placeholder:text-ink-400" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="focus-ring shrink-0 rounded-xs text-ink-500 hover:text-ink-800"><Icon icon={X} size={14} /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusPills.map((s) => (
            <FilterChip key={s} active={statusF === s} onClick={() => setStatusF(s)}>
              {s === 'overdue' && (statusCounts.overdue ?? 0) > 0 && <span aria-hidden className="size-1.5 rounded-full bg-danger-500" />}
              <span className="capitalize">{s}</span>
              <span className="tabular-nums text-ink-400">{statusCounts[s] ?? 0}</span>
            </FilterChip>
          ))}
        </div>
        {clients.length > 0 && (
          <Select
            aria-label="Filter by client"
            value={clientF}
            onValueChange={setClientF}
            size="sm"
            className="w-auto min-w-[140px]"
            groups={[{ options: [{ value: 'all', label: 'All clients' }, ...clients.map((c) => ({ value: c.id, label: c.name }))] }]}
          />
        )}
      </div>

      {/* Invoices table */}
      {invoices.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-raised">
          <EmptyState
            illustration={<Icon icon={Landmark} size={20} />}
            title="No invoices yet"
            description="Create one to bill a client and track what you're owed."
            primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setComposing(true)}>New invoice</Button>}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
          {/* Fixed-column table: swipes horizontally on narrow screens rather
              than clipping the Due/Total columns. */}
          <div className="overflow-x-auto overflow-y-hidden">
            <div className="min-w-[640px]">
              <div className="grid gap-3 border-b border-line-soft px-4 py-2.5 text-overline uppercase tracking-wide text-ink-500" style={{ gridTemplateColumns: GRID }}>
                <div>Number</div><div>Client</div><div className="text-right">Items</div><div>Status</div><div>Due</div><div className="text-right">Total</div>
              </div>
              {filtered.length === 0 && <div className="px-4 py-9 text-center text-ui text-ink-500">No invoices match these filters.</div>}
              {filtered.map((inv, i) => {
                const dstat = displayStatus(inv);
                const row = (
                  <div className={cn('grid items-center gap-3 px-4 py-3 text-ui', i > 0 && 'border-t border-line-soft')} style={{ gridTemplateColumns: GRID }}>
                    <div className="truncate font-mono text-caption text-ink-500">{inv.number}</div>
                    <div className="truncate font-medium text-ink-900">{clientName(inv.client_id)}</div>
                    <div className="text-right tabular-nums text-ink-500">{inv.itemCount}</div>
                    <div><Badge status={STATUS_TONE[dstat] ?? 'neutral'} className="capitalize">{dstat}</Badge></div>
                    <div className={cn('text-caption tabular-nums', dstat === 'overdue' ? 'text-danger-600' : 'text-ink-500')}>{fmtDate(inv.due_date)}</div>
                    <div className="text-right font-medium tabular-nums text-ink-900">{usd(inv.total)}</div>
                  </div>
                );
                return inv.id.startsWith('tmp-')
                  ? <div key={inv.id} className="opacity-60">{row}</div>
                  : <Link key={inv.id} href={`/money/${inv.id}`} className="block transition-colors hover:bg-surface-hover">{row}</Link>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <section className="mt-8">
          <div className="mb-2.5 flex items-center gap-2">
            <h2 className="text-title-4 text-ink-900">Recent payments</h2>
            <span className="tabular-nums text-caption text-ink-500">{payments.length}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
            {payments.map((p, i) => (
              <div key={p.id} className={cn('flex items-center gap-3 px-4 py-3 text-ui', i > 0 && 'border-t border-line-soft')}>
                <span className="w-20 shrink-0 truncate font-mono text-caption text-ink-500">{p.number}</span>
                <span className="min-w-0 flex-1 truncate text-ink-800">{clientName(p.client_id)}</span>
                {p.method && <span className="shrink-0 text-caption text-ink-500">{p.method}</span>}
                <span className="shrink-0 text-caption tabular-nums text-ink-500">{fmtDate(p.paid_on)}</span>
                <span className="w-24 shrink-0 text-right font-medium tabular-nums text-success-600">{usd(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Toaster />
      {composing && <NewInvoiceModal clients={clients} unbilled={unbilled} rate={rate} onClose={() => setComposing(false)} onCreate={create} />}
    </ViewContainer>
  );
}

// ── New invoice flow ──
function NewInvoiceModal({ clients, unbilled, rate, onClose, onCreate }: {
  clients: ClientLite[]; unbilled: UnbilledLog[]; rate: number;
  onClose: () => void; onCreate: (input: { clientId: string | null; dueDate: string | null; items: { description: string; quantity: number; unit_amount: number; timeEntryId?: string | null }[] }) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: '1', unit_amount: '' }]);

  const clientLogs = clientId ? unbilled.filter((t) => t.client_id === clientId) : [];
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const logItems = clientLogs.filter((t) => picked.has(t.id)).map((t) => ({
    description: `${t.project_name ?? 'Time'} — ${fmtDate(t.started_at)} (${fmtDur(t.minutes)})`,
    quantity: Math.round((t.minutes / 60) * 100) / 100,
    unit_amount: rate,
    timeEntryId: t.id,
  }));
  const manualItems = lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), quantity: parseFloat(l.quantity) || 1, unit_amount: parseFloat(l.unit_amount) || 0 }));
  const items = [...logItems, ...manualItems];
  const total = items.reduce((a, i) => a + i.quantity * i.unit_amount, 0);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="lg" title="New invoice"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={items.length === 0} onClick={() => onCreate({ clientId: clientId || null, dueDate: dueDate || null, items })}>Create invoice</Button>
      </>}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-3">
          <Field label="Client" className="min-w-[180px] flex-1">
            <Select
              aria-label="Client"
              value={clientId || NONE}
              onValueChange={(v) => { setClientId(v === NONE ? '' : v); setPicked(new Set()); }}
              groups={[{ options: [{ value: NONE, label: 'No client' }, ...clients.map((c) => ({ value: c.id, label: c.name }))] }]}
            />
          </Field>
          <Field label="Due date" id="inv-due" className="w-40">
            <input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="focus-ring h-9 w-full rounded-md border border-line bg-surface-raised px-3 text-ui text-ink-900" />
          </Field>
        </div>

        {/* Unbilled time suggestions */}
        {clientId && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-caption font-medium text-ink-500">
              <Icon icon={Clock} size={13} /> Unbilled time {rate > 0 ? `· $${rate}/hr` : '· set a rate in Settings'}
            </div>
            {clientLogs.length === 0 ? (
              <p className="px-0.5 text-caption text-ink-500">No unbilled time for this client.</p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                {clientLogs.map((t) => {
                  const on = picked.has(t.id);
                  return (
                    <label key={t.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors', on ? 'border-line-strong bg-surface-active' : 'border-line-soft bg-surface-raised hover:bg-surface-hover')}>
                      <Checkbox checked={on} onCheckedChange={() => toggle(t.id)} />
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{t.project_name ?? 'Time'} · {fmtDate(t.started_at)}</span>
                      <span className="shrink-0 tabular-nums text-caption text-ink-500">{fmtDur(t.minutes)}</span>
                      <span className="w-16 shrink-0 text-right font-medium tabular-nums text-ink-900">{usd(t.value)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Manual line items */}
        <div>
          <div className="mb-2 text-caption font-medium text-ink-500">Line items</div>
          <div className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description" autoComplete="off" data-1p-ignore data-lpignore="true" />
                </div>
                <div className="w-14">
                  <TextInput value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Qty" inputMode="decimal" aria-label="Quantity" className="text-right" />
                </div>
                <span aria-hidden className="text-ink-400">×</span>
                <div className="w-20">
                  <TextInput value={l.unit_amount} onChange={(e) => setLine(i, { unit_amount: e.target.value })} placeholder="$" inputMode="decimal" aria-label="Unit amount" className="text-right" />
                </div>
                <IconButton label="Remove line" icon={<Icon icon={X} size={14} />} variant="ghost" size="sm" disabled={lines.length === 1} onClick={() => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)))} />
              </div>
            ))}
          </div>
          <Button variant="ghost" size="xs" icon={<Icon icon={Plus} size={14} />} className="mt-2" onClick={() => setLines((ls) => [...ls, { description: '', quantity: '1', unit_amount: '' }])}>Add line</Button>
        </div>

        {/* Total */}
        <div className="flex items-center justify-end gap-3 border-t border-line-soft pt-4">
          <span className="text-caption text-ink-500">Total</span>
          <span className="text-title-3 tabular-nums text-ink-900">{usd(total)}</span>
        </div>
      </div>
    </Modal>
  );
}
