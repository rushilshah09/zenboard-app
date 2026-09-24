'use client';
// Dev-only harness for the Money hub overview — staged records so the KPI strip,
// filters, invoices table, recent payments, and the new-invoice modal (unbilled
// time + line items) can be verified without a session. 404s in prod.
import { notFound } from 'next/navigation';
import { MoneyView, type Invoice, type ClientLite, type UnbilledLog, type PaymentRow } from '@/components/money/money-view';

const iso = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const ymd = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); // n days ago
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

const CLIENTS: ClientLite[] = [
  { id: 'c1', name: 'Meridian Studio' },
  { id: 'c2', name: 'Fernwood Hotels' },
  { id: 'c3', name: 'Atlas Coffee' },
];

const INVOICES: Invoice[] = [
  { id: 'i-021', number: 'INV-021', client_id: 'c1', project_id: 'p1', status: 'draft', due_date: null, notes: null, created_at: iso(1), total: 3200, itemCount: 3, paid: 0 },
  { id: 'i-020', number: 'INV-020', client_id: 'c2', project_id: null, status: 'sent', due_date: ymd(-10), notes: null, created_at: iso(5), total: 2800, itemCount: 2, paid: 0 },
  { id: 'i-019', number: 'INV-019', client_id: 'c1', project_id: 'p2', status: 'sent', due_date: ymd(6), notes: null, created_at: iso(20), total: 1500, itemCount: 1, paid: 0 },
  { id: 'i-018', number: 'INV-018', client_id: 'c3', project_id: null, status: 'paid', due_date: ymd(30), notes: null, created_at: iso(35), total: 4200, itemCount: 4, paid: 4200 },
  { id: 'i-017', number: 'INV-017', client_id: 'c2', project_id: null, status: 'void', due_date: ymd(50), notes: null, created_at: iso(55), total: 900, itemCount: 1, paid: 0 },
];

const UNBILLED: UnbilledLog[] = [
  { id: 't1', project_id: 'p1', project_name: 'Brand identity', client_id: 'c1', minutes: 180, started_at: iso(2), value: 300 },
  { id: 't2', project_id: 'p2', project_name: 'Website rebuild', client_id: 'c1', minutes: 90, started_at: iso(4), value: 150 },
  { id: 't3', project_id: 'p1', project_name: 'Brand identity', client_id: 'c1', minutes: 120, started_at: iso(6), value: 200 },
];

const PAYMENTS: PaymentRow[] = [
  { id: 'pm1', invoice_id: 'i-018', amount: 4200, paid_on: ymd(3), method: 'Bank transfer', number: 'INV-018', client_id: 'c3' },
  { id: 'pm2', invoice_id: 'i-016', amount: 1800, paid_on: ymd(12), method: 'Stripe', number: 'INV-016', client_id: 'c1' },
];

export default function MoneyPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)' }}>
      <MoneyView invoices={INVOICES} clients={CLIENTS} unbilled={UNBILLED} payments={PAYMENTS} monthStart={monthStart} rate={100} />
    </div>
  );
}
