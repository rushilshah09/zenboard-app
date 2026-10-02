// The studio's invoices, shared by Finance (views/money.tsx) and an invoice opened on its own
// (views/invoice.tsx), so the list and the invoice always agree.
import type { ClientLite, Invoice, PaymentRow, UnbilledLog } from '@/components/money/money-view';
import type { ItemRow, PaymentLine } from '@/components/money/invoice-detail';
import { dayFromToday } from '../fixtures';

const iso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const CLIENTS: ClientLite[] = [
  { id: 'c-ridgeline', name: 'Ridgeline' },
  { id: 'c-beacon', name: 'Beacon Health' },
  { id: 'c-copper', name: 'Copper Row' },
];

export function financeData() {
  const invoices: Invoice[] = [
    { id: 'in-022', number: 'INV-022', client_id: 'c-ridgeline', project_id: 'p-ridgeline', status: 'draft', due_date: null, notes: null, created_at: iso(0), total: 450, itemCount: 1, paid: 0 },
    { id: 'in-021', number: 'INV-021', client_id: 'c-ridgeline', project_id: 'p-ridgeline', status: 'paid', due_date: dayFromToday(-2), notes: null, created_at: iso(24), total: 4200, itemCount: 3, paid: 4200 },
    { id: 'in-020', number: 'INV-020', client_id: 'c-beacon', project_id: 'p-beacon', status: 'sent', due_date: dayFromToday(6), notes: null, created_at: iso(9), total: 3600, itemCount: 2, paid: 0 },
    { id: 'in-018', number: 'INV-018', client_id: 'c-copper', project_id: 'p-copper', status: 'sent', due_date: dayFromToday(-3), notes: null, created_at: iso(33), total: 2800, itemCount: 2, paid: 0 },
    { id: 'in-017', number: 'INV-017', client_id: 'c-beacon', project_id: 'p-beacon', status: 'paid', due_date: dayFromToday(-20), notes: null, created_at: iso(48), total: 1800, itemCount: 1, paid: 1800 },
  ];
  const unbilled: UnbilledLog[] = [
    { id: 'tl-1', project_id: 'p-ridgeline', project_name: 'Ridgeline rebrand', client_id: 'c-ridgeline', minutes: 150, started_at: iso(1), value: 375 },
    { id: 'tl-2', project_id: 'p-beacon', project_name: 'Beacon Health site', client_id: 'c-beacon', minutes: 240, started_at: iso(2), value: 600 },
    { id: 'tl-3', project_id: 'p-ridgeline', project_name: 'Ridgeline rebrand', client_id: 'c-ridgeline', minutes: 90, started_at: iso(4), value: 225 },
  ];
  const payments: PaymentRow[] = [
    { id: 'pm-1', invoice_id: 'in-021', amount: 4200, paid_on: dayFromToday(-1), method: 'Bank transfer', number: 'INV-021', client_id: 'c-ridgeline' },
    { id: 'pm-2', invoice_id: 'in-017', amount: 1800, paid_on: dayFromToday(-19), method: 'Card', number: 'INV-017', client_id: 'c-beacon' },
  ];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return { invoices, unbilled, payments, monthStart };
}

/** An invoice's lines. Every one sums to the total Finance lists for it. */
const ITEMS: Record<string, [string, number, number][]> = {
  'in-022': [['Social sizes of the logo', 3, 150]],
  'in-021': [['Logo exploration, three routes', 1, 2400], ['Brand audit', 1, 1200], ['Stakeholder interviews', 4, 150]],
  'in-020': [['Sitemap and wireframes', 1, 2400], ['Content workshop', 1, 1200]],
  'in-018': [['Menu design, dinner and drinks', 1, 2200], ['Print-ready files', 1, 600]],
  'in-017': [['Discovery workshop', 1, 1800]],
};

export function invoiceData(id: string) {
  const f = financeData();
  const invoice = f.invoices.find((i) => i.id === id) ?? f.invoices[1];
  const items: ItemRow[] = (ITEMS[invoice.id] ?? []).map(([description, quantity, unit_amount], i) => ({
    id: `${invoice.id}-item-${i}`, description, quantity, unit_amount, time_entry_id: null, sort_order: i,
  }));
  const payments: PaymentLine[] = f.payments.filter((p) => p.invoice_id === invoice.id).map((p) => ({ id: p.id, amount: p.amount, paid_on: p.paid_on, method: p.method }));
  const clientName = CLIENTS.find((c) => c.id === invoice.client_id)?.name ?? 'No client';
  return { invoice, items, payments, clientName };
}
