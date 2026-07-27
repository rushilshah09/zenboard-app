// Horizon — goals by time horizon (month / quarter / year). Linked-work counts
// roll up via the ONE shared rule (lib/goal-rollup): steps + directly linked tasks
// + the linked project's tasks. The ring uses the settled `progress` (reconciled
// at weekly review, not live — goals shouldn't twitch). RLS-scoped. ('month' needs 0008.)
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { HorizonView, type Goal, type GoalProject } from '@/components/horizon/horizon-view';
import { rollupTallies, type RollupTask } from '@/lib/goal-rollup';

export const dynamic = 'force-dynamic';

export default async function HorizonPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const { data: goals } = await supabase
    .from('goals').select('id, title, note, horizon, target_date, status, progress, project_id').eq('space_id', sid).order('created_at');
  const goalRows = (goals as { id: string; project_id: string | null }[]) ?? [];
  const projectIds = [...new Set(goalRows.map((g) => g.project_id).filter((p): p is string => !!p))];

  let taskQuery = supabase.from('tasks').select('id, done, goal_id, project_id, parent_task_id').eq('space_id', sid);
  taskQuery = projectIds.length
    ? taskQuery.or(`goal_id.not.is.null,project_id.in.(${projectIds.join(',')})`)
    : taskQuery.not('goal_id', 'is', null);

  const [{ data: milestones }, { data: linked }, { data: projects }] = await Promise.all([
    supabase.from('milestones').select('id, goal_id, title, done, sort_order').order('sort_order'),
    taskQuery,
    supabase.from('projects').select('id, name, color').eq('space_id', sid),
  ]);

  const ms = (milestones as { id: string; goal_id: string; title: string; done: boolean }[]) ?? [];
  // Task-only tally (empty milestones) — the card shows "N/M tasks" vs "N/M steps"
  // separately, so steps must NOT be folded into the task count here. The ring
  // uses the settled blended `progress` (tasks + steps) from the last review.
  const counts = rollupTallies(
    goalRows.map((g) => ({ id: g.id, project_id: g.project_id })),
    (linked as RollupTask[]) ?? [],
    [],
  );
  const projMap: Record<string, GoalProject> = {};
  for (const p of (projects as GoalProject[]) ?? []) projMap[p.id] = p;

  type Raw = Omit<Goal, 'milestones' | 'linkedDone' | 'linkedTotal'>;
  const out: Goal[] = ((goals as Raw[]) ?? []).map((g) => ({
    ...g,
    milestones: ms.filter((m) => m.goal_id === g.id),
    linkedDone: counts.get(g.id)?.done ?? 0,
    linkedTotal: counts.get(g.id)?.total ?? 0,
  }));

  return <HorizonView initialGoals={out} projects={projMap} />;
}
