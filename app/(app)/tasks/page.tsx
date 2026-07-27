// Tasks — the to-do hub, with two views of the same tasks: List (filterable
// to-do list) and Week (drag-by-day board). ?view=week selects the board;
// ?w=<offset> selects the week. Both load only what they need (RLS-scoped).
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { getWeekDays, weekRangeLabel } from '@/lib/date';
import { TasksView, type TaskItem, type TaskProject } from '@/components/tasks/tasks-view';
import { WeekView, type WeekTask, type WeekProject } from '@/components/week/week-view';
import { TaskViewToggle } from '@/components/tasks/task-view-toggle';

export const dynamic = 'force-dynamic';

async function subtaskCounts(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const subByParent: Record<string, { done: number; total: number }> = {};
  if (ids.length) {
    const { data: subs } = await supabase.from('tasks').select('parent_task_id, done').in('parent_task_id', ids);
    for (const s of (subs as { parent_task_id: string; done: boolean }[]) ?? []) {
      const e = subByParent[s.parent_task_id] ?? { done: 0, total: 0 };
      e.total++; if (s.done) e.done++; subByParent[s.parent_task_id] = e;
    }
  }
  return subByParent;
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; w?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);

  // ── Week view ──
  if (sp.view === 'week') {
    const offset = Number.parseInt(sp.w ?? '0', 10) || 0;
    const days = getWeekDays(new Date(Date.now() + offset * 7 * 86400000));
    const start = days[0].id, end = days[6].id;
    const [{ data: tasks }, { data: projects }] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, done, priority, highlight, estimate_minutes, scheduled_date, is_inbox, project_id, parent_task_id, sort_order, recurrence')
        .eq('space_id', sid)
        .is('parent_task_id', null)
        .or(`and(scheduled_date.gte.${start},scheduled_date.lte.${end}),is_inbox.eq.true`)
        .order('sort_order').order('created_at'),
      supabase.from('projects').select('id, name, color').eq('space_id', sid),
    ]);
    const weekTasks = (tasks as WeekTask[]) ?? [];
    const subByParent = await subtaskCounts(supabase, weekTasks.map((t) => t.id));
    const projMap: Record<string, WeekProject> = {};
    for (const p of (projects as WeekProject[]) ?? []) projMap[p.id] = p;
    return (
      <WeekView days={days} initialTasks={weekTasks} projects={projMap} subByParent={subByParent}
        rangeLabel={weekRangeLabel(days)} offset={offset} viewSwitch={<TaskViewToggle view="week" />} />
    );
  }

  // ── List view (default) ──
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, done, priority, highlight, estimate_minutes, scheduled_date, is_inbox, project_id, recurrence, parent_task_id')
      .eq('space_id', sid)
      .is('parent_task_id', null)
      .order('sort_order').order('created_at'),
    supabase.from('projects').select('id, name, color').eq('space_id', sid),
  ]);
  const items = (tasks as TaskItem[]) ?? [];
  const subByParent = await subtaskCounts(supabase, items.map((t) => t.id));
  const projMap: Record<string, TaskProject> = {};
  for (const p of (projects as TaskProject[]) ?? []) projMap[p.id] = p;

  // Labels (migration 0014) — probed separately so the critical fetches above
  // never depend on the new tables; missing → the label filter stays hidden.
  let labelList: { id: string; name: string; color: string | null }[] = [];
  const taskLabels: Record<string, string[]> = {};
  const lab = await supabase.from('labels').select('id, name, color').eq('space_id', sid).order('sort_order').order('name');
  if (!lab.error) {
    labelList = lab.data ?? [];
    const tl = await supabase.from('task_labels').select('task_id, label_id');
    if (!tl.error) for (const r of tl.data ?? []) (taskLabels[r.task_id] ??= []).push(r.label_id);
  }

  // Saved views (migration 0015) — probed separately; missing → section hidden.
  let savedViews: { id: string; name: string; filter: Record<string, unknown> }[] = [];
  const sv = await supabase.from('saved_views').select('id, name, filter').eq('space_id', sid).order('sort_order');
  const savedViewsSupported = !sv.error;
  if (savedViewsSupported) savedViews = (sv.data as { id: string; name: string; filter: Record<string, unknown> }[]) ?? [];

  return <TasksView initialTasks={items} projects={projMap} subByParent={subByParent} labels={labelList} taskLabels={taskLabels} savedViews={savedViews} savedViewsSupported={savedViewsSupported} viewSwitch={<TaskViewToggle view="list" />} />;
}
