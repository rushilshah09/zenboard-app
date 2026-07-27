'use server';
// Meeting mutations — a meeting is a client conversation (call/notes/transcript)
// that feedback gets extracted from (the "2.2" card). RLS scopes everything to
// the user. See supabase/migrations/0016_feedback.sql and lib/actions/feedback.ts.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

export async function addMeeting(
  input: { clientId?: string | null; title: string; notes?: string; metAt?: string },
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await activeSpaceId(supabase, user.id);
  const { data, error } = await supabase.from('meetings')
    .insert({ user_id: user.id, space_id: sid, client_id: input.clientId ?? null, title: input.title.trim() || 'Meeting', notes: input.notes?.trim() || null, met_at: input.metAt ?? new Date().toISOString() })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add meeting.' };
  return { id: data.id };
}

export async function updateMeeting(
  id: string,
  patch: { title?: string; notes?: string | null; metAt?: string },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('meetings')
    .update({ ...(patch.title !== undefined && { title: patch.title }), ...(patch.notes !== undefined && { notes: patch.notes }), ...(patch.metAt !== undefined && { met_at: patch.metAt }) })
    .eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteMeeting(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
