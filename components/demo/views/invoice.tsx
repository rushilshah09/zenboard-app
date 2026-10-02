'use client';
// An invoice, opened on its own (`/money/<id>`): the product's own invoice page — its lines, totals,
// payments and actions.
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { InvoiceDetail } from '@/components/money/invoice-detail';
import { invoiceData } from './money-data';

export default function InvoiceDemo() {
  const id = usePathname()?.split('/')[2] ?? 'in-021';
  const d = React.useMemo(() => invoiceData(id), [id]);
  // The invoice row as its route reads it (InvoiceFull): Finance's list adds totals the page computes itself.
  const { id: invoiceId, number, client_id, project_id, status, due_date, notes, created_at } = d.invoice;
  return (
    <InvoiceDetail
      invoice={{ id: invoiceId, number, client_id, project_id, status, due_date, notes, created_at }}
      items={d.items}
      payments={d.payments}
      clientName={d.clientName}
      voidSupported
    />
  );
}
