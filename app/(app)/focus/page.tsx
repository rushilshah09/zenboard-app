// Focus — immersive single-task mode (HiFi design): the day's open tasks with
// subtasks, notes, and a session log. RLS + active-space scoped.
import { userTimezone } from '@/lib/user-tz';
import { todayISO as todayId } from '@/lib/date';
import { FocusView, type FocusTask, type FocusSub, type FocusProject } from '@/components/focus/focus-view';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';

export const dynamic = 'force-dynamic';

export default async function FocusPage() {
  const { supabase, sid } = await pageScope();
  const todayISO = todayId(await userTimezone());
  // The projects go out WITH the day's tasks. They used to wait behind the tasks
  // and then their subtasks: two round trips in series for a read that needs
  // neither. The subtasks do need the task ids, so they stay a second wave.
  const [{ data: tasks }, { data: projs }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, done, priority, highlight, estimate_minutes, elapsed_minutes, project_id, notes')
      .eq('space_id', sid)
      .eq('scheduled_date', todayISO)
      .is('parent_task_id', null)
      .order('done')
      .order('sort_order'),
    supabase.from('projects').select('id, name, color').eq('space_id', sid),
  ]);

  const list = (tasks as FocusTask[]) ?? [];
  const ids = list.map((t) => t.id);
  const subsByTask: Record<string, FocusSub[]> = {};
  if (ids.length) {
    const { data: subs } = await supabase
      .from('tasks').select('id, title, done, parent_task_id').in('parent_task_id', ids).order('created_at');
    for (const s of (subs as (FocusSub & { parent_task_id: string })[]) ?? []) {
      (subsByTask[s.parent_task_id] ??= []).push({ id: s.id, title: s.title, done: s.done });
    }
  }
  const projects: Record<string, FocusProject> = {};
  for (const p of (projs as FocusProject[]) ?? []) projects[p.id] = p;

  return (
    <>
      <PageStamp />
      <FocusView initialTasks={list} subsByTask={subsByTask} projects={projects} />
    </>
  );
}
