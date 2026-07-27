'use server';
// Goal + milestone mutations. RLS scopes to the signed-in user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { rollupTallies, tallyToProgress, computeBehind, type RollupTask } from '@/lib/goal-rollup';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

export async function addGoal(input: { title: string; horizon: 'month' | 'quarter' | 'year'; targetDate?: string | null; projectId?: string | null }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('goals')
    .insert({ user_id: user.id, space_id: sid, title: input.title.trim(), horizon: input.horizon, target_date: input.targetDate ?? null, project_id: input.projectId ?? null })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add goal.' };
  return { id: data.id };
}

export async function updateGoal(id: string, patch: { title?: string; note?: string; horizon?: 'month' | 'quarter' | 'year'; target_date?: string | null; project_id?: string | null; status?: 'active' | 'done' | 'dropped'; progress?: number }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

export async function addMilestone(goalId: string, title: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('milestones')
    .insert({ user_id: user.id, goal_id: goalId, title: title.trim() })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add milestone.' };
  return { id: data.id };
}

export async function toggleMilestone(id: string, done: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('milestones').update({ done }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Recompute every active goal's progress from its rolled-up work (steps + direct
// tasks + its linked project's tasks — see lib/goal-rollup). Run at weekly-review
// time, NOT live — goals should settle once a week, not twitch on every checkbox
// (spec §3.8). `behind` compares settled progress against the fraction of the
// goal's runway elapsed; goals with no target_date can't be "behind".
export async function recomputeGoalProgress(): Promise<{ error: string } | { ok: true; updated: number }> {
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);

  const { data: goalsData } = await supabase
    .from('goals').select('id, created_at, target_date, project_id, status').eq('space_id', sid).eq('status', 'active');
  const goals = (goalsData as { id: string; created_at: string; target_date: string | null; project_id: string | null; status: string }[]) ?? [];
  if (goals.length === 0) return { ok: true, updated: 0 };

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
    const { error } = await supabase.from('goals')
      .update({ progress, behind, last_reviewed: new Date().toISOString().slice(0, 10) }).eq('id', g.id);
    if (!error) updated++;
  }));
  return { ok: true, updated };
}
