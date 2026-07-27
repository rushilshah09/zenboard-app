// Focus — immersive single-task mode (HiFi design): the day's open tasks with
// subtasks, notes, and a session log. RLS + active-space scoped.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { FocusView, type FocusTask, type FocusSub, type FocusProject } from '@/components/focus/focus-view';

export const dynamic = 'force-dynamic';

export default async function FocusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, done, priority, highlight, estimate_minutes, elapsed_minutes, project_id, notes')
    .eq('space_id', sid)
    .eq('scheduled_date', todayISO)
    .is('parent_task_id', null)
    .order('done')
    .order('sort_order');

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
  const { data: projs } = await supabase.from('projects').select('id, name, color').eq('space_id', sid);
  const projects: Record<string, FocusProject> = {};
  for (const p of (projs as FocusProject[]) ?? []) projects[p.id] = p;

  return <FocusView initialTasks={list} subsByTask={subsByTask} projects={projects} />;
}
