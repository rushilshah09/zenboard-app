'use server';
// Label + section mutations (migration 0014, applied 2026-07-17). Reads happen
// through the browser client (RLS-scoped) so each surface can probe support
// and degrade gracefully; writes go through here, never directly from the
// client. Every action returns { error } instead of throwing.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

export async function createLabel(name: string, color?: string): Promise<{ error: string } | { id: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Label name is required' };
  const { supabase, user } = await requireUser();
  const spaceId = await activeSpaceId(supabase, user.id);
  // §4.8: colour is meaning on tags — default to `stone`, the user picks the hue.
  const { data, error } = await supabase
    .from('labels')
    .insert({ user_id: user.id, space_id: spaceId, name: trimmed, color: color ?? 'stone' })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

// Recolour an existing label (the picker in the task detail drawer).
export async function setLabelColor(labelId: string, color: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('labels').update({ color }).eq('id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteLabel(labelId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('labels').delete().eq('id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function setTaskLabel(taskId: string, labelId: string, on: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = on
    ? await supabase.from('task_labels').upsert({ task_id: taskId, label_id: labelId, user_id: user.id })
    : await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function createSection(projectId: string, name: string): Promise<{ error: string } | { id: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Section name is required' };
  const { supabase, user } = await requireUser();
  // Append after the project's current last section.
  const { data: last } = await supabase
    .from('sections').select('sort_order').eq('project_id', projectId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from('sections')
    .insert({ user_id: user.id, project_id: projectId, name: trimmed, sort_order: (last?.sort_order ?? -1) + 1 })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function setTaskSection(taskId: string, sectionId: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('tasks').update({ section_id: sectionId }).eq('id', taskId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function renameSection(sectionId: string, name: string): Promise<{ error: string } | { ok: true }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Section name is required' };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('sections').update({ name: trimmed }).eq('id', sectionId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

// Delete a section. Its tasks are NOT deleted — the FK is `on delete set null`,
// so they simply fall back to the loose (un-sectioned) group.
export async function deleteSection(sectionId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('sections').delete().eq('id', sectionId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}
