'use server';
// Feedback (fabric) mutations — the loop from MASTER_PRODUCT_PLAN.md. A feedback
// item is customer signal made durable: captured, linked to the deals that want
// it (revenue rollup), then shipped by promoting it to a task. RLS scopes all of
// it to the user. See supabase/migrations/0016_feedback.sql.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

export async function addFeedback(
  input: { title: string; body?: string; source?: string; dealIds?: string[]; clientId?: string; meetingId?: string },
): Promise<{ error: string } | { id: string; number: number }> {
  const { supabase, user } = await requireUser();
  const sid = await activeSpaceId(supabase, user.id);
  // Per-user contiguous number (#34). Fine for a business-of-one; the worst a
  // race does is reuse a number, which is cosmetic.
  const { data: last } = await supabase.from('feedback')
    .select('number').eq('user_id', user.id).order('number', { ascending: false }).limit(1).maybeSingle();
  const number = (last?.number ?? 0) + 1;
  const { data, error } = await supabase.from('feedback')
    .insert({ user_id: user.id, space_id: sid, number, title: input.title.trim(), body: input.body?.trim() || null, source: input.source?.trim() || 'manual', client_id: input.clientId ?? null, meeting_id: input.meetingId ?? null, status: 'open' })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not log feedback.' };
  const deals = (input.dealIds ?? []).filter(Boolean);
  if (deals.length) {
    await supabase.from('feedback_deals').insert(deals.map((lead_id) => ({ feedback_id: data.id, lead_id, user_id: user.id })));
  }
  return { id: data.id, number };
}

export async function updateFeedback(
  id: string,
  patch: { status?: FeedbackStatus; title?: string; body?: string | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('feedback').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

export async function linkFeedbackDeal(feedbackId: string, leadId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('feedback_deals')
    .upsert({ feedback_id: feedbackId, lead_id: leadId, user_id: user.id }, { onConflict: 'feedback_id,lead_id' });
  return error ? { error: error.message } : { ok: true };
}

export async function unlinkFeedbackDeal(feedbackId: string, leadId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('feedback_deals').delete().eq('feedback_id', feedbackId).eq('lead_id', leadId);
  return error ? { error: error.message } : { ok: true };
}

// "Ship it" — the loop's hinge. Turn the feedback into real work: create a task,
// point the feedback at it, and move it to in-progress. Returns the new task id.
export async function shipFeedback(id: string): Promise<{ error: string } | { taskId: string }> {
  const { supabase, user } = await requireUser();
  const { data: fb } = await supabase.from('feedback').select('title, task_id').eq('id', id).maybeSingle();
  if (!fb) return { error: 'Feedback not found.' };
  if (fb.task_id) return { taskId: fb.task_id }; // already shipping
  const sid = await activeSpaceId(supabase, user.id);
  const { data: task, error: tErr } = await supabase.from('tasks')
    .insert({ user_id: user.id, space_id: sid, title: fb.title, is_inbox: true, priority: 'high' })
    .select('id').single();
  if (tErr || !task) return { error: tErr?.message ?? 'Could not create task.' };
  await supabase.from('feedback').update({ task_id: task.id, status: 'in_progress' }).eq('id', id);
  return { taskId: task.id };
}
