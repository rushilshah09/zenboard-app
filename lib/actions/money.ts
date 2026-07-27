'use server';
// Money mutations. RLS scopes invoices/payments by user_id; invoice_items by the
// parent invoice's owner. Totals are computed from line items (never stored), so
// the loop works whether or not migration 0004 is applied. Where 0004 adds
// columns (time_entries.invoiced_invoice_id, invoices 'void'), we degrade.
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

async function nextNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true });
  return `INV-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

export type LineInput = { description: string; quantity: number; unit_amount: number; timeEntryId?: string | null };

export async function addInvoice(input: {
  clientId?: string | null; projectId?: string | null; dueDate?: string | null; notes?: string | null; items: LineInput[];
}): Promise<{ error: string } | { id: string; number: string }> {
  const { supabase, user } = await requireUser();
  const number = await nextNumber(supabase);
  const { data: inv, error } = await supabase.from('invoices')
    .insert({ user_id: user.id, number, client_id: input.clientId ?? null, project_id: input.projectId ?? null, due_date: input.dueDate || null, notes: input.notes?.trim() || null, status: 'draft' })
    .select('id').single();
  if (error || !inv) return { error: error?.message ?? 'Could not create invoice.' };

  const clean = input.items.filter((i) => i.description.trim());
  if (clean.length) {
    const rows = clean.map((i, idx) => ({ invoice_id: inv.id, description: i.description.trim(), quantity: i.quantity || 1, unit_amount: i.unit_amount || 0, time_entry_id: i.timeEntryId ?? null, sort_order: idx }));
    const { error: ie } = await supabase.from('invoice_items').insert(rows);
    if (ie) return { error: ie.message };
    // Mark linked time logs as billed so they leave Unbilled.
    const teIds = clean.map((i) => i.timeEntryId).filter((x): x is string => !!x);
    if (teIds.length) await supabase.from('time_entries').update({ billed: true }).in('id', teIds);
  }
  return { id: inv.id, number };
}

export async function updateInvoiceStatus(id: string, status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void'): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Record a manual payment; if the invoice is now fully covered, mark it paid.
export async function recordPayment(input: { invoiceId: string; amount: number; paidOn?: string | null; method?: string | null; note?: string | null }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const amount = Number(input.amount);
  if (!amount || amount <= 0) return { error: 'Enter a positive amount.' };
  const { data: pay, error } = await supabase.from('payments')
    .insert({ user_id: user.id, invoice_id: input.invoiceId, amount, paid_on: input.paidOn || new Date().toISOString().slice(0, 10), method: input.method?.trim() || null })
    .select('id').single();
  if (error || !pay) return { error: error?.message ?? 'Could not record payment.' };

  // Recompute: total (from items) vs sum of payments → flip to paid when covered.
  const [{ data: items }, { data: pays }] = await Promise.all([
    supabase.from('invoice_items').select('quantity, unit_amount').eq('invoice_id', input.invoiceId),
    supabase.from('payments').select('amount').eq('invoice_id', input.invoiceId),
  ]);
  const total = (items ?? []).reduce((a, i) => a + Number(i.quantity) * Number(i.unit_amount), 0);
  const paid = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
  if (total > 0 && paid >= total) await supabase.from('invoices').update({ status: 'paid' }).eq('id', input.invoiceId);
  return { id: pay.id };
}

// Void requires migration 0004 (status CHECK includes 'void'). Returns the
// constraint error if not applied so the UI can roll back + explain.
export async function voidInvoice(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Duplicate an invoice as a fresh draft (copies line items, not payments/links).
export async function duplicateInvoice(id: string): Promise<{ error: string } | { id: string; number: string }> {
  const { supabase, user } = await requireUser();
  const { data: src } = await supabase.from('invoices').select('client_id, project_id, notes').eq('id', id).maybeSingle();
  if (!src) return { error: 'Invoice not found.' };
  const number = await nextNumber(supabase);
  const { data: inv, error } = await supabase.from('invoices')
    .insert({ user_id: user.id, number, client_id: src.client_id, project_id: src.project_id, notes: src.notes, status: 'draft' })
    .select('id').single();
  if (error || !inv) return { error: error?.message ?? 'Could not duplicate.' };
  const { data: items } = await supabase.from('invoice_items').select('description, quantity, unit_amount, sort_order').eq('invoice_id', id);
  if (items && items.length) {
    await supabase.from('invoice_items').insert(items.map((i) => ({ invoice_id: inv.id, description: i.description, quantity: i.quantity, unit_amount: i.unit_amount, sort_order: i.sort_order })));
  }
  return { id: inv.id, number };
}

// Edit a draft invoice: update due date + replace its line items (delete & insert).
// Draft-only is enforced in the UI; here we just write what's given.
export async function updateInvoiceDraft(input: { invoiceId: string; dueDate?: string | null; items: LineInput[] }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error: ue } = await supabase.from('invoices').update({ due_date: input.dueDate || null }).eq('id', input.invoiceId);
  if (ue) return { error: ue.message };
  const { error: de } = await supabase.from('invoice_items').delete().eq('invoice_id', input.invoiceId);
  if (de) return { error: de.message };
  const clean = input.items.filter((i) => i.description.trim());
  if (clean.length) {
    const rows = clean.map((i, idx) => ({ invoice_id: input.invoiceId, description: i.description.trim(), quantity: i.quantity || 1, unit_amount: i.unit_amount || 0, sort_order: idx }));
    const { error: ie } = await supabase.from('invoice_items').insert(rows);
    if (ie) return { error: ie.message };
  }
  return { ok: true };
}

// Turn a project's unbilled time into a draft invoice — the Time → Finance
// bridge. Reads the unbilled entries server-side (never trusts the client),
// one invoice line per entry (date-labelled, hours × rate), links each line to
// its time_entry and marks it billed so it leaves Unbilled. Rate precedence:
// per-entry rate (0004) → the user's default hourly_rate → 0 (a $0 draft the
// user prices before sending). Idempotent-ish: entries already billed are
// skipped, so a second click on the same project invoices nothing.
export async function invoiceUnbilledTime(projectId: string): Promise<{ error: string } | { id: string; number: string; lineCount: number }> {
  const { supabase, user } = await requireUser();

  const [proj, prof, entriesRes] = await Promise.all([
    supabase.from('projects').select('client_id, name').eq('id', projectId).maybeSingle(),
    supabase.from('profiles').select('hourly_rate').eq('id', user.id).maybeSingle(),
    supabase.from('time_entries').select('id, minutes, started_at, rate, note').eq('project_id', projectId).eq('billed', false).order('started_at'),
  ]);
  const entries = (entriesRes.data ?? []).filter((e) => (e.minutes ?? 0) > 0);
  if (entries.length === 0) return { error: 'No unbilled time on this project.' };

  const defaultRate = Number(prof.data?.hourly_rate ?? 0);
  const projName = proj.data?.name ?? 'Project';
  const clientId = proj.data?.client_id ?? null;

  const number = await nextNumber(supabase);
  const { data: inv, error } = await supabase.from('invoices')
    .insert({ user_id: user.id, number, client_id: clientId, project_id: projectId, status: 'draft' })
    .select('id').single();
  if (error || !inv) return { error: error?.message ?? 'Could not create invoice.' };

  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rows = entries.map((e, idx) => ({
    invoice_id: inv.id,
    description: e.note?.trim() || `${projName} — ${dayLabel(e.started_at)}`,
    quantity: Math.round(((e.minutes ?? 0) / 60) * 100) / 100, // hours, 2dp
    unit_amount: e.rate ?? defaultRate,
    time_entry_id: e.id,
    sort_order: idx,
  }));
  const { error: ie } = await supabase.from('invoice_items').insert(rows);
  if (ie) return { error: ie.message };

  // Mark the entries billed and link them to the invoice — they leave Unbilled.
  const ids = entries.map((e) => e.id);
  await supabase.from('time_entries').update({ billed: true, invoiced_invoice_id: inv.id }).in('id', ids);

  return { id: inv.id, number, lineCount: rows.length };
}

// Manual time log against a project (and optionally a task). Lands in Unbilled.
export async function addTimeEntry(input: { projectId: string; taskId?: string | null; minutes: number; loggedAt?: string | null }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const minutes = Math.round(Number(input.minutes));
  if (!minutes || minutes <= 0) return { error: 'Enter minutes greater than zero.' };
  const ended = input.loggedAt ? new Date(input.loggedAt + 'T12:00:00') : new Date();
  const started = new Date(ended.getTime() - minutes * 60000);
  const { data, error } = await supabase.from('time_entries')
    .insert({ user_id: user.id, project_id: input.projectId, task_id: input.taskId ?? null, minutes, source: 'manual', billed: false, started_at: started.toISOString(), ended_at: ended.toISOString() })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not log time.' };
  return { id: data.id };
}
