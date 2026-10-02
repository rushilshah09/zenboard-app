'use client';
// Dev-only harness for the invoice detail — a draft with line items so the
// header/badge, read-only table, EDIT grid (TextInputs), totals, and the
// record-payment modal path can be verified without a session. 404s in prod.
import { notFound } from 'next/navigation';
import { InvoiceDetail, type InvoiceFull, type ItemRow, type PaymentLine } from '@/components/money/invoice-detail';

const iso = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const INVOICE: InvoiceFull = { id: 'i-021', number: 'INV-021', client_id: 'c1', project_id: 'p1', status: 'draft', due_date: null, notes: null, created_at: iso(1) };
const ITEMS: ItemRow[] = [
  { id: 'it1', description: 'Brand identity — discovery workshop', quantity: 6, unit_amount: 150, time_entry_id: 't1', sort_order: 0 },
  { id: 'it2', description: 'Logo exploration (3 routes)', quantity: 10, unit_amount: 120, time_entry_id: null, sort_order: 1 },
  { id: 'it3', description: 'Type system', quantity: 4, unit_amount: 140, time_entry_id: null, sort_order: 2 },
];
const PAYMENTS: PaymentLine[] = [];

export default function InvoicePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)' }}>
      <InvoiceDetail invoice={INVOICE} items={ITEMS} payments={PAYMENTS} clientName="Meridian Studio" voidSupported />
    </div>
  );
}
