'use server';
// Task dependencies, write side — master plan §7B. The rules live in
// lib/task-links.ts; this file only performs them.
//
// GATED. Migration 0032 adds `task_links`; until it is applied
// `taskLinksSupported()` reports false, every action here returns a clean "not
// available yet", and the UI hides the affordance. The app is correct before
// and after.
import { createClient } from '@/lib/supabase/server';
import { checkLink, REFUSAL_TEXT, type TaskLink } from '@/lib/task-links';
import { requireSession } from '@/lib/auth';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0032 applied? A zero-row probe, the same fetch-time capability
 * pattern as `remindersSupported` / `taskEventsSupported`. Probing the TABLE is
 * correct here — unlike 0030 and 0031, which added columns to a table that
 * already existed, this migration's whole contribution is a new table.
 */
export async function taskLinksSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('task_links').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = { error: 'Dependencies need migration 0032.' } as const;

/**
 * Make `taskId` wait for `blockerId`.
 *
 * The cycle check reads the CURRENT graph on the server rather than trusting
 * what the client had when it opened the picker: two tabs adding the opposite
 * halves of a loop at the same time is exactly the case a client-side check
 * cannot see. The picker runs the same `checkLink` for instant feedback; this
 * is the one that decides.
 */
export async function addBlocker(taskId: string, blockerId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  if (!(await taskLinksSupported(supabase))) return NOT_READY;

  const { data, error: readErr } = await supabase.from('task_links').select('task_id, blocked_by_task_id');
  if (readErr) return { error: readErr.message };

  const refusal = checkLink((data ?? []) as TaskLink[], taskId, blockerId);
  if (refusal) return { error: REFUSAL_TEXT[refusal] };

  const { error } = await supabase.from('task_links').insert({
    user_id: user.id, task_id: taskId, blocked_by_task_id: blockerId,
  });
  // The unique index is the backstop for the duplicate two tabs can both miss.
  // A dependency that already exists is the state the caller wanted, so this is
  // success, not an error to show them.
  if (error && error.code === '23505') return { ok: true };
  return error ? { error: error.message } : { ok: true };
}

/** Stop `taskId` waiting for `blockerId`. Idempotent. */
export async function removeBlocker(taskId: string, blockerId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await taskLinksSupported(supabase))) return NOT_READY;
  const { error } = await supabase.from('task_links')
    .delete()
    .eq('task_id', taskId)
    .eq('blocked_by_task_id', blockerId);
  return error ? { error: error.message } : { ok: true };
}
