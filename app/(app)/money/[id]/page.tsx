// Invoice detail — header, line items, totals, payments, and actions.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvoiceDetail, type InvoiceFull, type ItemRow, type PaymentLine } from '@/components/money/invoice-detail';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // The client's name rides the invoice read as an embed. It used to be a read
  // of EVERY client this person has, made to find one name.
  const { data } = await supabase
    .from('invoices').select('id, number, client_id, project_id, status, due_date, notes, created_at, client:clients(name)')
    .eq('id', id).maybeSingle();
  if (!data) notFound();
  const { client, ...invoice } = data as unknown as InvoiceFull & { client: { name: string } | null };

  // One wave for everything else. The 0004 probe (→ enables Void) used to wait
  // for this wave and then run alone: a round trip to learn a column exists.
  const [{ data: items }, { data: payments }, ext] = await Promise.all([
    supabase.from('invoice_items').select('id, description, quantity, unit_amount, time_entry_id, sort_order').eq('invoice_id', id).order('sort_order'),
    supabase.from('payments').select('id, amount, paid_on, method').eq('invoice_id', id).order('paid_on', { ascending: false }),
    supabase.from('invoices').select('id, issue_date').limit(1),
  ]);
  const voidSupported = !ext.error;

  const clientName = invoice.client_id ? client?.name ?? 'Client' : 'No client';

  return (
    <>
      <PageStamp />
      <InvoiceDetail
        invoice={invoice as InvoiceFull}
        items={(items as ItemRow[]) ?? []}
        payments={(payments as PaymentLine[]) ?? []}
        clientName={clientName}
        voidSupported={voidSupported}
      />
    </>
  );
}
