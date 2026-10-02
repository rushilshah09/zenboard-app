'use server';
// List mutations (migration 0038). A list is a pile you keep your own work in —
// see lib/task-scopes.ts for why it is not a project and not a label.
//
// Reads happen in the route (RLS-scoped) so it can probe support and hide the
// section when 0038 hasn't been applied; writes go through here. Same shape as
// lib/actions/saved-views.ts, including the untyped accessor at the edge, so a
// missing table degrades to an error string rather than a crashed render.
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (supabase: unknown, table: string): any => (supabase as { from: (t: string) => any }).from(table);

/** Postgres 23505 — the (space_id, lower(name)) unique index. Two rail rows
 *  reading "Priority" is a state you cannot click your way out of, so the
 *  database refuses it and this turns the refusal into a sentence. */
const DUPLICATE = '23505';

export async function createTaskList(name: string, color?: string | null): Promise<{ error: string } | { id: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'List name is required' };
  if (trimmed.length > 60) return { error: 'List name is too long' };
  const { supabase, user } = await requireSession();
  const spaceId = await activeSpaceId(supabase, user.id);

  const { data: last } = await tbl(supabase, 'task_lists').select('sort_order').eq('space_id', spaceId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await tbl(supabase, 'task_lists')
    .insert({ user_id: user.id, space_id: spaceId, name: trimmed, color: color ?? null, sort_order: ((last?.sort_order as number | null) ?? -1) + 1 })
    .select('id').single();
  if (error) return { error: error.code === DUPLICATE ? `You already have a list called “${trimmed}”` : error.message };
  return { id: data.id };
}

export async function renameTaskList(id: string, name: string): Promise<{ error: string } | { ok: true }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'List name is required' };
  const { supabase, user } = await requireSession();
  const { error } = await tbl(supabase, 'task_lists').update({ name: trimmed }).eq('id', id).eq('user_id', user.id);
  if (error) return { error: error.code === DUPLICATE ? `You already have a list called “${trimmed}”` : error.message };
  return { ok: true };
}

export async function setTaskListColor(id: string, color: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await tbl(supabase, 'task_lists').update({ color }).eq('id', id).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Delete a list. The tasks inside it survive — 0038's FK is ON DELETE SET NULL,
 * so they fall back to having no list and reappear under "No list", which is a
 * state the board already draws. Deleting a pile must never delete the work in
 * it, and encoding that in the schema means no call site can get it wrong.
 */
export async function deleteTaskList(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await tbl(supabase, 'task_lists').delete().eq('id', id).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

/** Reorder the rail. One round trip per moved list, which is fine: a person
 *  drags one list at a time and there are rarely more than a dozen. */
export async function reorderTaskLists(order: { id: string; sortOrder: number }[]): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  for (const o of order) {
    const { error } = await tbl(supabase, 'task_lists').update({ sort_order: o.sortOrder }).eq('id', o.id).eq('user_id', user.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

/**
 * File a task into a list, or out of every list (`null`).
 *
 * Deliberately does NOT touch `project_id`. A task can be in a project and a
 * list at once — they answer different questions — and a "move" that silently
 * un-filed the client work would lose the one fact that decides who is billed.
 * It does clear `is_inbox`, because filing something IS processing it, which is
 * exactly what `moveTaskToProject` already does.
 */
export async function setTaskList(id: string, listId: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await tbl(supabase, 'tasks')
    .update({ list_id: listId, ...(listId ? { is_inbox: false } : {}) })
    .eq('id', id).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}
