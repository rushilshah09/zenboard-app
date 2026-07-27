// Loader for the Money hub overview (/money). Pulls invoices (+ computed totals
// and payments-applied), clients, unbilled billable time (valued at the user's
// hourly rate), and recent payments. RLS scopes everything to the user.
import { createClient } from '@/lib/supabase/server';
import type { Invoice, ClientLite, UnbilledLog, PaymentRow } from '@/components/money/money-view';

export function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export async function loadMoneyData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: invoices }, { data: items }, { data: payments }, { data: clients }, { data: projects }, { data: times }, { data: profile }] = await Promise.all([
    supabase.from('invoices').select('id, number, client_id, project_id, status, due_date, notes, created_at').order('created_at', { ascending: false }),
    supabase.from('invoice_items').select('invoice_id, quantity, unit_amount'),
    supabase.from('payments').select('id, invoice_id, amount, paid_on, method').order('paid_on', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('projects').select('id, name, client_id'),
    supabase.from('time_entries').select('id, project_id, task_id, minutes, started_at, billed').eq('billed', false).not('minutes', 'is', null),
    user ? supabase.from('profiles').select('hourly_rate').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Detect migration 0004 (per-log billing fields + 'void' status).
  const ext = await supabase.from('time_entries').select('id, billable').limit(1);
  const extendedMoney = !ext.error;

  const rate = Number((profile as { hourly_rate?: number } | null)?.hourly_rate ?? 0);
  const its = (items as { invoice_id: string; quantity: number; unit_amount: number }[]) ?? [];
  const pays = (payments as { id: string; invoice_id: string; amount: number; paid_on: string; method: string | null }[]) ?? [];
  const projs = (projects as { id: string; name: string; client_id: string | null }[]) ?? [];

  const invs: Invoice[] = ((invoices as Omit<Invoice, 'total' | 'itemCount' | 'paid'>[]) ?? []).map((inv) => {
    const lines = its.filter((i) => i.invoice_id === inv.id);
    return {
      ...inv,
      total: lines.reduce((a, i) => a + Number(i.quantity) * Number(i.unit_amount), 0),
      itemCount: lines.length,
      paid: pays.filter((p) => p.invoice_id === inv.id).reduce((a, p) => a + Number(p.amount), 0),
    };
  });

  const unbilled: UnbilledLog[] = ((times as { id: string; project_id: string | null; task_id: string | null; minutes: number | null; started_at: string }[]) ?? []).map((t) => {
    const proj = projs.find((p) => p.id === t.project_id);
    return { id: t.id, project_id: t.project_id, project_name: proj?.name ?? null, client_id: proj?.client_id ?? null, minutes: t.minutes ?? 0, started_at: t.started_at, value: ((t.minutes ?? 0) / 60) * rate };
  });

  const recentPayments: PaymentRow[] = pays.slice(0, 8).map((p) => {
    const inv = invs.find((i) => i.id === p.invoice_id);
    return { ...p, number: inv?.number ?? '—', client_id: inv?.client_id ?? null };
  });

  return { invoices: invs, clients: (clients as ClientLite[]) ?? [], unbilled, payments: recentPayments, monthStart: monthStartISO(), rate, extendedMoney };
}
