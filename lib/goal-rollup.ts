// The ONE rule for "how done is a goal", shared by the Horizon display, the
// weekly-review glance, and the persisted recompute so all three always agree.
//
// A goal's work is the union of three sources, deduped by task id:
//   1. its steps           — milestones.goal_id
//   2. directly linked tasks — tasks.goal_id
//   3. its project's tasks  — every TOP-LEVEL task in the linked project
//                             (goals.project_id → tasks.project_id)
// (3) is the link that used to render as a chip but count for nothing; folding it
// in is what makes "link a goal to a project" actually move the needle (§7G).
//
// Only top-level tasks count (subtasks roll up into their parent, exactly as the
// portal/project progress bars already treat them) so one checklist can't inflate
// a goal. progress = done / total, rounded to 0.01, in [0,1].

export type RollupTask = {
  id: string; done: boolean;
  goal_id: string | null; project_id: string | null; parent_task_id: string | null;
};
export type RollupMilestone = { goal_id: string | null; done: boolean };
export type RollupGoal = { id: string; project_id: string | null };

export type GoalTally = { done: number; total: number };

/** done/total for every passed goal (each goal always gets an entry, even 0/0). */
export function rollupTallies(
  goals: RollupGoal[], tasks: RollupTask[], milestones: RollupMilestone[],
): Map<string, GoalTally> {
  const byGoal = new Map<string, GoalTally>();
  const ensure = (gid: string): GoalTally => {
    let e = byGoal.get(gid);
    if (!e) { e = { done: 0, total: 0 }; byGoal.set(gid, e); }
    return e;
  };
  for (const g of goals) ensure(g.id);

  // project id → the goals linked to it (a project can back more than one goal).
  const goalsByProject = new Map<string, string[]>();
  for (const g of goals) if (g.project_id) {
    const a = goalsByProject.get(g.project_id) ?? [];
    a.push(g.id); goalsByProject.set(g.project_id, a);
  }

  // Dedupe: a task that is BOTH directly linked and in the linked project must
  // count once per goal, not twice.
  const seen = new Set<string>();
  const countTask = (gid: string, t: RollupTask) => {
    const key = `${gid}:${t.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const e = ensure(gid); e.total++; if (t.done) e.done++;
  };

  for (const t of tasks) {
    if (t.parent_task_id) continue; // subtasks roll up into their parent
    if (t.goal_id) countTask(t.goal_id, t);
    if (t.project_id) for (const gid of goalsByProject.get(t.project_id) ?? []) countTask(gid, t);
  }
  for (const m of milestones) {
    if (!m.goal_id) continue;
    const e = ensure(m.goal_id); e.total++; if (m.done) e.done++;
  }
  return byGoal;
}

/** A tally reduced to a 0..1 progress fraction (0 when there's no work yet). */
export function tallyToProgress(t: GoalTally | undefined): number {
  return t && t.total > 0 ? Math.round((t.done / t.total) * 100) / 100 : 0;
}

/**
 * Is a goal behind its runway? Compares settled progress against the fraction of
 * time elapsed from creation to target_date, with a 10% grace band. Goals with no
 * target date can't be "behind" (nothing to be late against).
 */
export function computeBehind(progress: number, createdAt: string, targetDate: string | null): boolean {
  if (!targetDate) return false;
  const start = new Date(createdAt).getTime();
  const end = new Date(targetDate + 'T23:59:59').getTime();
  const now = Date.now();
  if (!(end > start)) return false;
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return elapsed > 0.1 && progress < elapsed - 0.1;
}
