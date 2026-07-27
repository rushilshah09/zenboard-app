'use client';
// Invoice detail — header, line-item table, totals, payments, and actions
// (Edit draft · Mark sent · Record payment · Duplicate · Void). Totals computed
// from items. Optimistic; reconciles via router.refresh. Built on DS primitives.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, X, Check } from '@/components/ds/icons';
import { Icon, Button, IconButton, Badge, TextInput, Field, Modal, Toaster, toast } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { updateInvoiceStatus, recordPayment, voidInvoice, duplicateInvoice, updateInvoiceDraft } from '@/lib/actions/money';
import { usd, fmtDate, displayStatus, STATUS_TONE } from '@/components/money/money-view';

export type InvoiceFull = { id: string; number: string; client_id: string | null; project_id: string | null; status: string; due_date: string | null; notes: string | null; created_at: string };
export type ItemRow = { id: string; description: string; quantity: number; unit_amount: number; time_entry_id: string | null; sort_order: number };
export type PaymentLine = { id: string; amount: number; paid_on: string; method: string | null };
type Line = { description: string; quantity: string; unit_amount: string };

const dateInputClass = 'focus-ring h-9 rounded-md border border-line bg-surface-raised px-3 text-ui text-ink-900';

export function InvoiceDetail({ invoice, items: initItems, payments: initPayments, clientName, voidSupported }: {
  invoice: InvoiceFull; items: ItemRow[]; payments: PaymentLine[]; clientName: string; voidSupported: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(invoice.status);
  const [items, setItems] = useState(initItems);
  const [payments, setPayments] = useState(initPayments);

  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '');
  const [lines, setLines] = useState<Line[]>(initItems.length ? initItems.map((i) => ({ description: i.description, quantity: String(i.quantity), unit_amount: String(i.unit_amount) })) : [{ description: '', quantity: '1', unit_amount: '' }]);
  const [paying, setPaying] = useState(false);

  const subtotal = items.reduce((a, i) => a + Number(i.quantity) * Number(i.unit_amount), 0);
  const tax = 0;
  const total = subtotal + tax;
  const paid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const balance = total - paid;
  const ds = displayStatus({ status, due_date: invoice.due_date });

  async function markSent() {
    setStatus('sent'); await updateInvoiceStatus(invoice.id, 'sent'); toast({ message: 'Marked as sent', variant: 'info' }); router.refresh();
  }
  async function doVoid() {
    if (!voidSupported) { toast({ message: 'Voiding needs migration 0004', variant: 'error' }); return; }
    const prev = status; setStatus('void');
    const r = await voidInvoice(invoice.id);
    if ('error' in r) { setStatus(prev); toast({ message: 'Could not void', variant: 'error' }); } else { toast({ message: 'Invoice voided', variant: 'info' }); router.refresh(); }
  }
  async function doDuplicate() {
    const r = await duplicateInvoice(invoice.id);
    if ('id' in r) { toast({ message: `${r.number} created`, variant: 'info' }); router.push(`/money/${r.id}`); } else toast({ message: 'Could not duplicate', variant: 'error' });
  }
  async function pay(amount: number, paidOn: string, method: string) {
    setPaying(false);
    const tmp = 'tmp-' + Date.now();
    setPayments((p) => [{ id: tmp, amount, paid_on: paidOn, method: method || null }, ...p]);
    if (paid + amount >= total && total > 0) setStatus('paid');
    const r = await recordPayment({ invoiceId: invoice.id, amount, paidOn, method });
    if ('error' in r) { setPayments((p) => p.filter((x) => x.id !== tmp)); toast({ message: r.error, variant: 'error' }); } else { toast({ message: 'Payment recorded', variant: 'info' }); router.refresh(); }
  }
  async function saveDraft() {
    const its = lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), quantity: parseFloat(l.quantity) || 1, unit_amount: parseFloat(l.unit_amount) || 0 }));
    setItems(its.map((i, idx) => ({ id: 'tmp-' + idx, description: i.description, quantity: i.quantity, unit_amount: i.unit_amount, time_entry_id: null, sort_order: idx })));
    setEditing(false);
    const r = await updateInvoiceDraft({ invoiceId: invoice.id, dueDate: dueDate || null, items: its });
    if ('error' in r) toast({ message: 'Could not save', variant: 'error' }); else { toast({ message: 'Saved', variant: 'info' }); router.refresh(); }
  }
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const headCols = '1fr 70px 90px 90px' + (editing ? ' 32px' : '');

  return (
    <div className="relative mx-auto max-w-[820px] px-[clamp(18px,3vw,40px)] pb-[var(--view-pb)] pt-8" style={{ animation: 'fadein 220ms' }}>
      <Link href="/money" className="focus-ring mb-4 inline-flex items-center gap-1 rounded-xs text-ui text-ink-500 transition-colors hover:text-ink-800">
        <Icon icon={ChevronLeft} size={16} /> Finance
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-title-2 tabular-nums text-ink-900">{invoice.number}</h1>
            <Badge status={STATUS_TONE[ds] ?? 'neutral'} className="capitalize">{ds}</Badge>
          </div>
          <div className="mt-1 text-ui text-ink-500">{clientName} · issued {fmtDate(invoice.created_at)} · due {fmtDate(invoice.due_date)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'draft' && !editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          {status === 'draft' && !editing && <Button size="sm" variant="primary" icon={<Icon icon={Check} size={16} />} onClick={markSent}>Mark sent</Button>}
          {(ds === 'sent' || ds === 'overdue') && <Button size="sm" variant="primary" onClick={() => setPaying(true)}>Record payment</Button>}
          {status !== 'void' && <Button size="sm" variant="ghost" onClick={doDuplicate}>Duplicate</Button>}
          {status !== 'paid' && status !== 'void' && <Button size="sm" variant="dangerGhost" onClick={doVoid}>Void</Button>}
        </div>
      </div>

      {/* Line items */}
      <div className="mb-4 overflow-hidden rounded-lg border border-line-soft bg-surface-raised">
        <div className="grid gap-2 border-b border-line-soft px-4 py-2.5 text-overline uppercase tracking-wide text-ink-500" style={{ gridTemplateColumns: headCols }}>
          <div>Description</div><div className="text-right">Qty</div><div className="text-right">Rate</div><div className="text-right">Amount</div>{editing && <div />}
        </div>
        {!editing ? (
          items.length === 0 ? <div className="px-4 py-5 text-ui text-ink-500">No line items.</div> : items.map((it, i) => (
            <div key={it.id} className={cn('grid items-center gap-2 px-4 py-3 text-ui', i > 0 && 'border-t border-line-soft')} style={{ gridTemplateColumns: '1fr 70px 90px 90px' }}>
              <div className="text-ink-900">{it.description}{it.time_entry_id && <span className="ml-1.5 text-caption text-ink-500">· time</span>}</div>
              <div className="text-right tabular-nums text-ink-500">{it.quantity}</div>
              <div className="text-right tabular-nums text-ink-500">{usd(Number(it.unit_amount))}</div>
              <div className="text-right font-medium tabular-nums text-ink-900">{usd(Number(it.quantity) * Number(it.unit_amount))}</div>
            </div>
          ))
        ) : (
          <div className="p-3">
            {lines.map((l, i) => (
              <div key={i} className="mb-2 grid items-center gap-2" style={{ gridTemplateColumns: '1fr 70px 90px 90px 32px' }}>
                <TextInput value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description" autoComplete="off" data-1p-ignore data-lpignore="true" />
                <TextInput value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} inputMode="decimal" aria-label="Quantity" className="text-right" />
                <TextInput value={l.unit_amount} onChange={(e) => setLine(i, { unit_amount: e.target.value })} inputMode="decimal" placeholder="$" aria-label="Rate" className="text-right" />
                <div className="text-right text-caption tabular-nums text-ink-500">{usd((parseFloat(l.quantity) || 0) * (parseFloat(l.unit_amount) || 0))}</div>
                <IconButton label="Remove line" icon={<Icon icon={X} size={14} />} variant="ghost" size="sm" disabled={lines.length === 1} onClick={() => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)))} />
              </div>
            ))}
            <Button variant="ghost" size="xs" icon={<Icon icon={Plus} size={14} />} onClick={() => setLines((ls) => [...ls, { description: '', quantity: '1', unit_amount: '' }])}>Add line</Button>
            <div className="mt-3 flex items-center gap-2.5 border-t border-line-soft pt-3">
              <label htmlFor="inv-due" className="text-caption text-ink-500">Due</label>
              <input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={dateInputClass} />
              <div className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={saveDraft}>Save</Button>
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="mb-6 flex justify-end">
        <div className="w-60 text-ui">
          <Row label="Subtotal" value={usd(subtotal)} />
          <Row label="Tax" value={usd(tax)} />
          <div className="my-1.5 h-px bg-line-soft" />
          <Row label="Total" value={usd(total)} strong />
          {paid > 0 && <Row label="Paid" value={'− ' + usd(paid)} positive />}
          {paid > 0 && <Row label="Balance" value={usd(balance)} strong />}
        </div>
      </div>

      {/* Payments */}
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="text-title-4 text-ink-900">Payments</h2>
        <span className="tabular-nums text-caption text-ink-500">{payments.length}</span>
        <span className="flex-1" />
        {(ds === 'sent' || ds === 'overdue') && <Button size="sm" variant="ghost" icon={<Icon icon={Plus} size={16} />} onClick={() => setPaying(true)}>Record</Button>}
      </div>
      {payments.length === 0 ? (
        <p className="px-0.5 text-caption text-ink-500">No payments recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-raised">
          {payments.map((p, i) => (
            <div key={p.id} className={cn('flex items-center gap-3 px-4 py-3 text-ui', i > 0 && 'border-t border-line-soft')}>
              <span className="w-[70px] shrink-0 text-caption tabular-nums text-ink-500">{fmtDate(p.paid_on)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-500">{p.method || 'Payment'}</span>
              <span className="shrink-0 font-medium tabular-nums text-success-600">{usd(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}

      <Toaster />
      {paying && <PaymentModal balance={balance > 0 ? balance : total} onClose={() => setPaying(false)} onSave={pay} />}
    </div>
  );
}

function Row({ label, value, strong, positive }: { label: string; value: string; strong?: boolean; positive?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-ink-500">{label}</span>
      <span className={cn('tabular-nums', strong ? 'font-semibold text-ink-900' : positive ? 'text-success-600' : 'text-ink-800')}>{value}</span>
    </div>
  );
}

function PaymentModal({ balance, onClose, onSave }: { balance: number; onClose: () => void; onSave: (amount: number, paidOn: string, method: string) => void }) {
  const [amount, setAmount] = useState(balance ? String(Math.round(balance)) : '');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Bank transfer');
  const submit = () => { const a = parseFloat(amount); if (!a || a <= 0) return; onSave(a, paidOn, method.trim()); };
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title="Record payment"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!(parseFloat(amount) > 0)} onClick={submit}>Record</Button>
      </>}>
      <div className="flex flex-col gap-4">
        <Field label="Amount ($)">
          <TextInput autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} inputMode="decimal" />
        </Field>
        <Field label="Date" id="pay-date">
          <input id="pay-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={cn(dateInputClass, 'w-full')} />
        </Field>
        <Field label="Method">
          <TextInput value={method} onChange={(e) => setMethod(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Bank transfer, Stripe…" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
      </div>
    </Modal>
  );
}
