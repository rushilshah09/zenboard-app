// ── AN INVOICE, AS NUMBERS AND DATES ────────────────────────────────────────
//
// What the owner's invoice page and the client's copy of it must agree on to the cent: what it
// adds up to, what is still owed, and what its dates say. Pure, so the document the owner reviews
// and the one the client pays from are computed by the same lines.

import { formatDay } from '@/lib/date';

export type InvoiceLine = { quantity: number; unit_amount: number };

export type InvoiceTotals = {
  subtotal: number;
  /** What the invoice asks for. Equal to the subtotal until tax exists — when it does, it lands here. */
  total: number;
  paid: number;
  /** What is still owed. Never negative: an overpayment is not a debt the client has. */
  due: number;
};

/** Added in CENTS, so a document someone pays from never shows 0.1 + 0.2 as 0.30000000000000004. */
const cents = (n: number) => Math.round((Number(n) || 0) * 100);

/** One line's amount, rounded to the cent the way the document shows it. */
export function lineAmount(l: InvoiceLine): number {
  return cents(Number(l.quantity) * Number(l.unit_amount)) / 100;
}

export function invoiceTotals(lines: InvoiceLine[], payments: { amount: number }[] = []): InvoiceTotals {
  // Sum the ROUNDED lines, so the subtotal is the sum of the amounts printed above it.
  const subtotal = lines.reduce((a, l) => a + cents(Number(l.quantity) * Number(l.unit_amount)), 0);
  const paid = payments.reduce((a, p) => a + cents(p.amount), 0);
  const total = subtotal;
  return { subtotal: subtotal / 100, total: total / 100, paid: paid / 100, due: Math.max(0, total - paid) / 100 };
}

/** Where an invoice stands on money and time — the one line a client reads first. */
export type DueState =
  | { kind: 'draft' }
  | { kind: 'void' }
  | { kind: 'paid' }
  | { kind: 'undated' }
  | { kind: 'due'; date: string; days: number }
  | { kind: 'overdue'; date: string; days: number };

const DAY_MS = 86_400_000;
/** Whole days from one day id to another; day ids carry no zone, so neither does this. */
const daysFrom = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

export function dueState(inv: { status: string; due_date: string | null }, totals: InvoiceTotals, today: string): DueState {
  if (inv.status === 'void') return { kind: 'void' };
  // Paid is a fact about the money as much as the status: an invoice paid in full reads paid even
  // if its status has not caught up yet (the payment is optimistic; the status write is next).
  if (inv.status === 'paid' || (inv.status !== 'draft' && totals.total > 0 && totals.due === 0)) return { kind: 'paid' };
  if (inv.status === 'draft') return { kind: 'draft' };
  if (!inv.due_date) return { kind: 'undated' };
  const days = daysFrom(today, inv.due_date);
  return days < 0 ? { kind: 'overdue', date: inv.due_date, days: -days } : { kind: 'due', date: inv.due_date, days };
}

/** A document date: always with the year, month spelled out ("20 June 2026"). */
export const docDate = (d: string | null | undefined): string => (d ? formatDay(d, { year: true, long: true }) ?? '–' : '–');

/** The due state in words, as the sheet prints it under the amount. */
export function dueLine(s: DueState, dueDate: string | null): string {
  switch (s.kind) {
    case 'paid': return 'Paid in full';
    case 'void': return 'This invoice was voided';
    case 'draft': return dueDate ? `Draft · due ${docDate(dueDate)}` : 'Draft · no due date yet';
    case 'undated': return 'No due date';
    case 'overdue': return s.days === 1 ? 'Overdue by 1 day' : `Overdue by ${s.days} days`;
    case 'due':
      if (s.days === 0) return 'Due today';
      if (s.days === 1) return 'Due tomorrow';
      return `Due ${docDate(s.date)}`;
  }
}
