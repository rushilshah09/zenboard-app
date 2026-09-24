// Horizon — goals by time horizon (month / quarter / year). Linked-work counts
// roll up via the ONE shared rule (lib/goal-rollup): steps + directly linked tasks
// + the linked project's tasks. The ring uses the settled `progress` (reconciled
// at weekly review, not live — goals shouldn't twitch). RLS-scoped. ('month' needs 0008.)
import { goalsV2Supported } from '@/lib/actions/goals';
import { HorizonView, type Goal, type GoalProject } from '@/components/horizon/horizon-view';
import { rollupTallies, type RollupTask } from '@/lib/goal-rollup';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';

export const dynamic = 'force-dynamic';

export default async function HorizonPage() {
  const { supabase, sid } = await pageScope();

  // ONE wave after the page scope; this used to be four in series.
  //  · The linked-work read waited for the goals, only to learn which projects
  //    to filter by. It now asks for every task tied to a goal OR to any
  //    project, and `rollupTallies` counts a task only through its own goal or
  //    a project linked to a goal, so the extra rows change no tally. They are
  //    consumed here on the server: the browser still receives counts.
  //  · The 0026 probe verified the session over the network and ran last, on
  //    its own (see `goalsV2Supported`).
  const [{ data: goals }, { data: milestones }, { data: linked }, { data: projects }, goalsV2] = await Promise.all([
    supabase.from('goals').select('id, title, note, horizon, target_date, status, progress, project_id, retro').eq('space_id', sid).order('created_at'),
    supabase.from('milestones').select('id, goal_id, title, done, sort_order').order('sort_order'),
    supabase.from('tasks').select('id, done, goal_id, project_id, parent_task_id').eq('space_id', sid)
      .or('goal_id.not.is.null,project_id.not.is.null'),
    supabase.from('projects').select('id, name, color').eq('space_id', sid),
    goalsV2Supported(supabase),
  ]);
  const goalRows = (goals as { id: string; project_id: string | null }[]) ?? [];

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


  return (
    <>
      <PageStamp />
      <HorizonView goalsV2={goalsV2} initialGoals={out} projects={projMap} />
    </>
  );
}
