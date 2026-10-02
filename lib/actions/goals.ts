'use server';
// Goal + milestone mutations. RLS scopes to the signed-in user.
import { notReady } from '@/lib/not-ready';
import { createClient } from '@/lib/supabase/server';
import { userTimezone } from '@/lib/user-tz';
import { todayISO } from '@/lib/date';
import { activeSpaceId } from '@/lib/active-space';
import { rollupTallies, tallyToProgress, computeBehind, type RollupTask } from '@/lib/goal-rollup';
import { requireSession } from '@/lib/auth';

async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

export async function addGoal(input: { title: string; horizon: 'month' | 'quarter' | 'year'; targetDate?: string | null; projectId?: string | null }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('goals')
    .insert({ user_id: user.id, space_id: sid, title: input.title.trim(), horizon: input.horizon, target_date: input.targetDate ?? null, project_id: input.projectId ?? null })
    .select('id').single();
  // A check-constraint violation on a MONTH goal is the one failure that means the horizon itself
  // is missing (migration 0008). The client used to assume that for EVERY failed month goal — a
  // dropped connection included — and threw the real reason away.
  if (error?.code === '23514' && input.horizon === 'month') return notReady('Month goals aren’t available yet.', '0008');
  if (error || !data) return { error: error?.message ?? 'Could not add goal.' };
  return { id: data.id };
}

// `paused` and `retro` arrive with 0026. Until it's applied the constraint/column
// rejects them, so those two degrade: a paused goal falls back to staying active
// (the caller is told), and a retro line is simply not stored. Everything else
// behaves identically either way.
export async function updateGoal(id: string, patch: { title?: string; note?: string; horizon?: 'month' | 'quarter' | 'year'; target_date?: string | null; project_id?: string | null; status?: 'active' | 'done' | 'dropped' | 'paused'; progress?: number; retro?: string }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  if (!error) return { ok: true };

  // Retry without the 0026-only fields rather than losing the whole edit.
  const { retro: _retro, ...rest } = patch;
  const degraded = { ...rest, ...(rest.status === 'paused' ? { status: 'active' as const } : {}) };
  if (Object.keys(degraded).length === 0) return { error: error.message };
  const retry = await supabase.from('goals').update(degraded).eq('id', id);
  return retry.error ? { error: error.message } : { ok: true };
}

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0026 applied? Probes the column it adds; cheap, no rows read.
 *
 * A zero-row schema probe, so it takes the page's client and does NOT verify
 * the session: the same shape as `commentsSupported` / `memoriesSupported`. It
 * used to call `requireSession()`, which asks the Auth server over the network,
 * so rendering Horizon or the weekly review paid a whole round trip in series
 * to learn whether a column exists. Row-level security still applies to the
 * query itself.
 */
export async function goalsV2Supported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('goals').select('retro').limit(0);
    return !error;
  } catch {
    return false;
  }
}

export async function addMilestone(goalId: string, title: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  const { data, error } = await supabase.from('milestones')
    .insert({ user_id: user.id, goal_id: goalId, title: title.trim() })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add milestone.' };
  return { id: data.id };
}

export async function toggleMilestone(id: string, done: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('milestones').update({ done }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Recompute every active goal's progress from its rolled-up work (steps + direct
// tasks + its linked project's tasks — see lib/goal-rollup). Run at weekly-review
// time, NOT live — goals should settle once a week, not twitch on every checkbox
// (spec §3.8). `behind` compares settled progress against the fraction of the
// goal's runway elapsed; goals with no target_date can't be "behind".
// Returns the per-goal tallies alongside the update count so the weekly review
// can show "N/M tasks done" without re-running the same three queries (§7G:
// the glance wants linked-work counts, not just a percentage).
export async function recomputeGoalProgress(): Promise<
  { error: string } | { ok: true; updated: number; tallies: Record<string, { done: number; total: number }> }
> {
  const { supabase, user } = await requireSession();
  const sid = await spaceId(supabase, user.id);

  const { data: goalsData } = await supabase
    .from('goals').select('id, created_at, target_date, project_id, status, progress').eq('space_id', sid).eq('status', 'active');
  const goals = (goalsData as { id: string; created_at: string; target_date: string | null; project_id: string | null; status: string; progress: number }[]) ?? [];
  if (goals.length === 0) return { ok: true, updated: 0, tallies: {} };

  const goalIds = goals.map((g) => g.id);
  const projectIds = [...new Set(goals.map((g) => g.project_id).filter((p): p is string => !!p))];

  // Tasks that could belong to any goal: directly linked OR in a linked project.
  let taskQuery = supabase
    .from('tasks').select('id, done, goal_id, project_id, parent_task_id').eq('space_id', sid);
  taskQuery = projectIds.length
    ? taskQuery.or(`goal_id.not.is.null,project_id.in.(${projectIds.join(',')})`)
    : taskQuery.not('goal_id', 'is', null);
  const [tasksRes, milestonesRes] = await Promise.all([
    taskQuery,
    supabase.from('milestones').select('goal_id, done').in('goal_id', goalIds),
  ]);

  const tallies = rollupTallies(
    goals.map((g) => ({ id: g.id, project_id: g.project_id })),
    (tasksRes.data as RollupTask[]) ?? [],
    (milestonesRes.data as { goal_id: string | null; done: boolean }[]) ?? [],
  );

  let updated = 0;
  await Promise.all(goals.map(async (g) => {
    const progress = tallyToProgress(tallies.get(g.id));
    const behind = computeBehind(progress, g.created_at, g.target_date);
    const base = { progress, behind, last_reviewed: todayISO(await userTimezone()) };
    // Carry the outgoing value into progress_at_review FIRST, so the next review
    // can say "up 15% since last week" (§7G's trend). 0026-only — on a DB without
    // it the update retries with just the base fields.
    const { error } = await supabase.from('goals')
      .update({ ...base, progress_at_review: g.progress }).eq('id', g.id);
    if (error) {
      const retry = await supabase.from('goals').update(base).eq('id', g.id);
      if (!retry.error) updated++;
    } else updated++;
  }));

  const out: Record<string, { done: number; total: number }> = {};
  for (const g of goals) out[g.id] = tallies.get(g.id) ?? { done: 0, total: 0 };
  return { ok: true, updated, tallies: out };
}
