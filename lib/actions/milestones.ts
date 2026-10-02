'use server';
// Project milestones, write side — master plan §7E. The rules live in
// lib/milestones.ts; this file only performs them.
//
// GATED. Migration 0036 adds `milestones.project_id` and `milestones.due_date`;
// until it is applied `projectMilestonesSupported()` reports false, the Overview
// card is hidden, and goals' milestones carry on exactly as before.
//
// WHY THIS FILE EXISTS SEPARATELY FROM lib/actions/goals.ts, which already has
// `addMilestone` and `toggleMilestone`: those take a goal id and are Horizon's.
// Only the writes that DIFFER for a project owner (a project id, a date) are
// here. `toggleMilestone` is genuinely shared — done is done, whoever owns the
// row — so callers import it from `@/lib/actions/goals`, where it lives.
//
// It is deliberately NOT re-exported from here, and that is a Next.js
// constraint rather than taste: a `'use server'` module must export only async
// functions it defines, so a single `export { x } from '...'` line makes the
// build treat the WHOLE file as having no exports at all. `tsc` accepts it
// happily — the error only appears at bundle time — so this comment is the
// warning the type system cannot give.
import { notReady } from '@/lib/not-ready';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0036 applied? A zero-row probe against the column — `milestones`
 * has existed since 0001, so probing the table would report the feature as
 * available on every unmigrated database.
 */
export async function projectMilestonesSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('milestones').select('project_id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = () => notReady('Milestones aren’t available yet.', '0036');

/**
 * Add a dated checkpoint to a project.
 *
 * `goal_id` is deliberately not sent. Before 0036 the column was NOT NULL, so
 * omitting it would fail; after 0036 it is nullable and the `milestones_one_owner`
 * CHECK requires it to stay null when `project_id` is set. The gate above is
 * what makes that safe to assume.
 */
export async function addProjectMilestone(
  projectId: string,
  title: string,
  dueDate: string | null = null,
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  if (!(await projectMilestonesSupported(supabase))) return NOT_READY();

  const clean = title.trim();
  if (!clean) return { error: 'A milestone needs a name.' };

  const { data, error } = await supabase.from('milestones')
    .insert({ user_id: user.id, project_id: projectId, title: clean, due_date: dueDate })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add the milestone.' };
  return { id: data.id };
}

/** Date or un-date a checkpoint. `null` returns it to "undated". */
export async function setMilestoneDate(id: string, dueDate: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await projectMilestonesSupported(supabase))) return NOT_READY();
  const { error } = await supabase.from('milestones').update({ due_date: dueDate }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/** Rename a checkpoint. */
export async function renameMilestone(id: string, title: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const clean = title.trim();
  if (!clean) return { error: 'A milestone needs a name.' };
  const { error } = await supabase.from('milestones').update({ title: clean }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Delete a checkpoint. Unlike completing a task, this is a real deletion with
 * nothing downstream of it — a milestone owns no other rows — so it needs no
 * cascade handling here.
 */
export async function deleteMilestone(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('milestones').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
