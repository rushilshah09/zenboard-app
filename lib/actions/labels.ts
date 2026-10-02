'use server';
// Label + section mutations (migration 0014, applied 2026-07-17). Reads happen
// through the browser client (RLS-scoped) so each surface can probe support
// and degrade gracefully; writes go through here, never directly from the
// client. Every action returns { error } instead of throwing.
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';

export async function createLabel(name: string, color?: string): Promise<{ error: string } | { id: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Label name is required' };
  const { supabase, user } = await requireSession();
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
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('labels').update({ color }).eq('id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

// Rename a label in place. Every task wearing it follows automatically — the
// chip reads through `label_id`, so there is nothing to migrate.
export async function renameLabel(labelId: string, name: string): Promise<{ error: string } | { ok: true }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Label name is required' };
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('labels').update({ name: trimmed }).eq('id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

// Deleting a label drops it from every task that wears it (task_labels cascades
// on the FK). The task itself is untouched — a label is a view over tasks, never
// a container for them.
export async function deleteLabel(labelId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('labels').delete().eq('id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function setTaskLabel(taskId: string, labelId: string, on: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = on
    ? await supabase.from('task_labels').upsert({ task_id: taskId, label_id: labelId, user_id: user.id })
    : await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function createSection(projectId: string, name: string): Promise<{ error: string } | { id: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Section name is required' };
  const { supabase, user } = await requireSession();
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
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('tasks').update({ section_id: sectionId }).eq('id', taskId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function renameSection(sectionId: string, name: string): Promise<{ error: string } | { ok: true }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Section name is required' };
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('sections').update({ name: trimmed }).eq('id', sectionId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

// Delete a section. Its tasks are NOT deleted — the FK is `on delete set null`,
// so they simply fall back to the loose (un-sectioned) group.
export async function deleteSection(sectionId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('sections').delete().eq('id', sectionId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Persist workstream order.
 *
 * `sections.sort_order` has existed since 0014 and every reader has always
 * ordered by it — but nothing has ever been able to CHANGE it, so a project's
 * streams were stuck in creation order for the life of the project. On a job
 * whose streams are phases (Discovery → Design → Handover) that is the one
 * order you are guaranteed not to want, because you rarely think of them in
 * the order you happened to type them.
 *
 * Takes the whole new order rather than a swap: absolute, so a retry cannot
 * shuffle anything, and the caller's optimistic array is the source of truth
 * for what the order should be.
 */
export async function setSectionOrder(
  updates: { id: string; sortOrder: number }[],
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  for (const u of updates) {
    const { error } = await supabase
      .from('sections').update({ sort_order: u.sortOrder })
      .eq('id', u.id).eq('user_id', user.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

/**
 * A workstream's own deadline (0040's `due_date`).
 *
 * The column has existed since 0040 and nothing has ever written to it — the
 * migration added status, a deadline and client visibility, and only the third
 * was ever wired. A phase that cannot carry a date is a heading, which is
 * exactly what 0040 was written to stop it being.
 *
 * A CALENDAR DATE (`YYYY-MM-DD`) or null, never a timestamp: see lib/date.ts
 * for why the distinction is load-bearing.
 */
export async function setSectionDate(sectionId: string, dueDate: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await supabase
    .from('sections').update({ due_date: dueDate })
    .eq('id', sectionId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * A workstream's explicit status, or `null` to let progress speak.
 *
 * `lib/workstreams.ts:statusOf` already states the rule this serves: a status
 * is DERIVED from progress unless somebody set one, because "paused" is a fact
 * about intent that progress cannot know. Nothing could set one until now.
 *
 * Only `paused` is offered by the UI. Active and completed are already visible
 * in the progress figure beside the name, and a control that lets you assert
 * "completed" over a stream with open tasks in it buys a contradiction.
 */
export async function setSectionStatus(sectionId: string, status: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await supabase
    .from('sections').update({ status })
    .eq('id', sectionId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}
