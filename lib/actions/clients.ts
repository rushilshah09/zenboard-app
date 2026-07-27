'use server';
// Client (CRM) + lead (pipeline) mutations. RLS scopes everything to the user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}
async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

export async function addClient(input: { name: string; role?: string; contact?: string; email?: string }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('clients')
    .insert({ user_id: user.id, space_id: sid, name: input.name.trim(), role: input.role?.trim() || null, contact: input.contact?.trim() || null, email: input.email?.trim() || null, status: 'active', health: 'good' })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add client.' };
  return { id: data.id };
}

export async function updateClient(
  id: string,
  patch: { status?: 'active' | 'past'; health?: 'good' | 'attention' | 'risk'; next_step?: string | null; role?: string | null; contact?: string | null; email?: string | null; since?: string | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('clients').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

export async function addClientNote(clientId: string, body: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('client_notes')
    .insert({ user_id: user.id, client_id: clientId, body: body.trim() })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add note.' };
  return { id: data.id };
}

export async function addLead(input: { name: string; value?: number; source?: string; contact?: string; note?: string }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('leads')
    .insert({ user_id: user.id, name: input.name.trim(), value: input.value ?? 0, source: input.source?.trim() || null, contact: input.contact?.trim() || null, note: input.note?.trim() || null, stage: 'lead' })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add lead.' };
  return { id: data.id };
}

export async function convertLead(leadId: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data: lead } = await supabase.from('leads').select('name, contact').eq('id', leadId).maybeSingle();
  if (!lead) return { error: 'Lead not found.' };
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('clients')
    .insert({ user_id: user.id, space_id: sid, name: lead.name, contact: lead.contact ?? null, status: 'active', health: 'good' })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not convert lead.' };
  await supabase.from('leads').delete().eq('id', leadId);
  return { id: data.id };
}

export async function updateLead(
  id: string,
  patch: { stage?: 'lead' | 'contacted' | 'proposal' | 'won'; value?: number; name?: string; note?: string | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('leads').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
