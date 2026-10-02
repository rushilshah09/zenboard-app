// GET /api/export/finance?sheet=invoices|items|payments — the accountant's exit
// (§7N). RLS scopes the rows; serialization lives in lib/export.ts where it is
// unit-tested.
//
// THREE SHEETS, ONE ROUTE. An invoice has many line items and many payments, so
// a single flat CSV would either repeat every invoice per line or collapse the
// lines into one unreadable cell. Three sheets is what a bookkeeper actually
// opens; one route because they come from exactly the same query.
import { createClient } from '@/lib/supabase/server';
import { invoicesToCsv, invoiceItemsToCsv, paymentsToCsv, type ExportInvoice } from '@/lib/export';

const SHEETS = {
  invoices: { csv: invoicesToCsv, name: 'invoices' },
  items: { csv: invoiceItemsToCsv, name: 'invoice-items' },
  payments: { csv: paymentsToCsv, name: 'payments' },
} as const;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in to export.', { status: 401 });

  const key = new URL(request.url).searchParams.get('sheet') ?? 'invoices';
  const sheet = SHEETS[key as keyof typeof SHEETS];
  if (!sheet) return new Response('Unknown sheet.', { status: 400 });

  const [invoices, items, payments, clients, projects] = await Promise.all([
    supabase.from('invoices')
      .select('id, number, status, client_id, project_id, issue_date, due_date, notes, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('invoice_items').select('invoice_id, description, quantity, unit_amount, sort_order'),
    supabase.from('payments').select('invoice_id, amount, paid_on, method'),
    supabase.from('clients').select('id, name'),
    supabase.from('projects').select('id, name'),
  ]);
  const err = invoices.error ?? items.error ?? payments.error ?? clients.error ?? projects.error;
  if (err) return new Response(`Export failed: ${err.message}`, { status: 500 });

  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const projectName = new Map((projects.data ?? []).map((p) => [p.id, p.name]));

  const itemsBy = new Map<string, ExportInvoice['items']>();
  for (const i of [...(items.data ?? [])].sort((a, b) => a.sort_order - b.sort_order)) {
    const list = itemsBy.get(i.invoice_id) ?? [];
    list.push({ description: i.description, quantity: i.quantity, unit_amount: i.unit_amount });
    itemsBy.set(i.invoice_id, list);
  }
  const paymentsBy = new Map<string, ExportInvoice['payments']>();
  for (const p of payments.data ?? []) {
    const list = paymentsBy.get(p.invoice_id) ?? [];
    list.push({ amount: p.amount, paid_on: p.paid_on, method: p.method });
    paymentsBy.set(p.invoice_id, list);
  }

  const rows: ExportInvoice[] = (invoices.data ?? []).map((inv) => ({
    number: inv.number,
    status: inv.status,
    client: inv.client_id ? clientName.get(inv.client_id) ?? null : null,
    project: inv.project_id ? projectName.get(inv.project_id) ?? null : null,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    items: itemsBy.get(inv.id) ?? [],
    payments: paymentsBy.get(inv.id) ?? [],
    notes: inv.notes,
    created_at: inv.created_at,
  }));

  const date = new Date().toISOString().slice(0, 10);
  return new Response(sheet.csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="zenboard-${sheet.name}-${date}.csv"`,
    },
  });
}
