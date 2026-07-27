// Invoice detail — header, line items, totals, payments, and actions.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvoiceDetail, type InvoiceFull, type ItemRow, type PaymentLine } from '@/components/money/invoice-detail';

export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from('invoices').select('id, number, client_id, project_id, status, due_date, notes, created_at')
    .eq('id', id).maybeSingle();
  if (!invoice) notFound();

  const [{ data: items }, { data: payments }, { data: clients }] = await Promise.all([
    supabase.from('invoice_items').select('id, description, quantity, unit_amount, time_entry_id, sort_order').eq('invoice_id', id).order('sort_order'),
    supabase.from('payments').select('id, amount, paid_on, method').eq('invoice_id', id).order('paid_on', { ascending: false }),
    supabase.from('clients').select('id, name'),
  ]);

  // Detect migration 0004 → enables Void.
  const ext = await supabase.from('invoices').select('id, issue_date').limit(1);
  const voidSupported = !ext.error;

  const clientName = (invoice as InvoiceFull).client_id
    ? ((clients as { id: string; name: string }[]) ?? []).find((c) => c.id === (invoice as InvoiceFull).client_id)?.name ?? 'Client'
    : 'No client';

  return (
    <InvoiceDetail
      invoice={invoice as InvoiceFull}
      items={(items as ItemRow[]) ?? []}
      payments={(payments as PaymentLine[]) ?? []}
      clientName={clientName}
      voidSupported={voidSupported}
    />
  );
}
