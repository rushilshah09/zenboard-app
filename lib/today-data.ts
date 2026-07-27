// Loader for the Today home (/today). Pulls the day's top-level tasks (scheduled
// today, plus undated highlights), their subtask counts + project chips, today's
// calendar events, and active habits with today's check-off and current streak.
// Each source is fetched independently so one failure can't blank the page.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import type { TodayTask, TodayHabit, TodayEvent, ProjectChip } from '@/components/today/today-view';

function dayBounds() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  return { today, startISO: start.toISOString(), endISO: end.toISOString() };
}

// Longest run of consecutive days (ending today or yesterday) with a done log.
function streakFrom(dates: Set<string>): number {
  let streak = 0;
  const d = new Date();
  // allow the streak to count even if today isn't checked yet (start at yesterday)
  if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export type TodayData = {
  tasks: TodayTask[];
  subByParent: Record<string, { done: number; total: number }>;
  projects: Record<string, ProjectChip>;
  habits: TodayHabit[];
  events: TodayEvent[];
  today: string;
  errors: { tasks: boolean; habits: boolean; events: boolean };
};

// Active habits with today's check-off + current streak. Shared by the Today
// home and the dedicated Habits page so the two never drift.
async function fetchHabits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sid: string,
  today: string,
): Promise<{ habits: TodayHabit[]; error: boolean }> {
  const habitsRes = await supabase
    .from('habits')
    .select('id, title')
    .eq('space_id', sid)
    .eq('active', true)
    .order('created_at');
  const habitRows = (habitsRes.data as { id: string; title: string }[]) ?? [];
  let habits: TodayHabit[] = [];
  if (habitRows.length) {
    const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    const logsRes = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, done')
      .gte('log_date', since)
      .eq('done', true);
    const byHabit = new Map<string, Set<string>>();
    for (const l of (logsRes.data as { habit_id: string; log_date: string }[]) ?? []) {
      const set = byHabit.get(l.habit_id) ?? new Set<string>();
      set.add(l.log_date);
      byHabit.set(l.habit_id, set);
    }
    habits = habitRows.map((h) => {
      const dates = byHabit.get(h.id) ?? new Set<string>();
      return { id: h.id, title: h.title, doneToday: dates.has(today), streak: streakFrom(dates) };
    });
  }
  return { habits, error: !!habitsRes.error };
}

// Loader for the dedicated Habits page (/habits).
export async function loadHabits(): Promise<{ habits: TodayHabit[]; error: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const { today } = dayBounds();
  return fetchHabits(supabase, sid, today);
}

export async function loadTodayData(): Promise<TodayData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const { today, startISO, endISO } = dayBounds();

  // ── Tasks: top-level tasks scheduled today, plus undated highlights ──
  const tasksRes = await supabase
    .from('tasks')
    .select('id, title, done, priority, highlight, estimate_minutes, elapsed_minutes, scheduled_date, project_id, parent_task_id, completed_at, created_at, sort_order')
    .eq('space_id', sid)
    .is('parent_task_id', null)
    .or(`scheduled_date.eq.${today},and(highlight.eq.true,scheduled_date.is.null)`)
    .order('sort_order')
    .order('created_at');
  const tasks = (tasksRes.data as TodayTask[]) ?? [];

  // Subtask counts for those parents (single query, scoped to the day's tasks).
  const parentIds = tasks.map((t) => t.id);
  const subByParent: Record<string, { done: number; total: number }> = {};
  if (parentIds.length) {
    const subRes = await supabase
      .from('tasks')
      .select('parent_task_id, done')
      .in('parent_task_id', parentIds);
    for (const s of (subRes.data as { parent_task_id: string; done: boolean }[]) ?? []) {
      const e = subByParent[s.parent_task_id] ?? { done: 0, total: 0 };
      e.total++;
      if (s.done) e.done++;
      subByParent[s.parent_task_id] = e;
    }
  }

  // Project chips for any tasks that belong to a project.
  const projectIds = [...new Set(tasks.map((t) => t.project_id).filter(Boolean))] as string[];
  const projects: Record<string, ProjectChip> = {};
  if (projectIds.length) {
    const projRes = await supabase.from('projects').select('id, name, color').in('id', projectIds);
    for (const p of (projRes.data as ProjectChip[]) ?? []) projects[p.id] = p;
  }

  // ── Calendar events for today ──
  const evRes = await supabase
    .from('calendar_events')
    .select('id, title, starts_at, ends_at, all_day, source')
    .eq('space_id', sid)
    .gte('starts_at', startISO)
    .lt('starts_at', endISO)
    .order('starts_at');
  const events = (evRes.data as TodayEvent[]) ?? [];

  // ── Habits: active habits + today's check-off + streak ──
  const { habits, error: habitsError } = await fetchHabits(supabase, sid, today);

  return {
    tasks,
    subByParent,
    projects,
    habits,
    events,
    today,
    errors: { tasks: !!tasksRes.error, habits: habitsError, events: !!evRes.error },
  };
}
