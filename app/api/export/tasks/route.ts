// GET /api/export/tasks — every task the signed-in user owns, as CSV
// (principle 11: every object has an exit). RLS scopes the rows; serialization
// lives in lib/export.ts where it's unit-tested.
import { createClient } from '@/lib/supabase/server';
import { tasksToCsv, type ExportTask } from '@/lib/export';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in to export.', { status: 401 });

  const [tasks, projects, sections, spaces, labels, taskLabels] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, notes, done, status, priority, scheduled_date, due_date, estimate_minutes, completed_at, created_at, recurrence, is_inbox, space_id, project_id, section_id, parent_task_id')
      .order('created_at', { ascending: true }),
    supabase.from('projects').select('id, name'),
    supabase.from('sections').select('id, name'),
    supabase.from('spaces').select('id, name'),
    supabase.from('labels').select('id, name'),
    supabase.from('task_labels').select('task_id, label_id'),
  ]);
  const err = tasks.error ?? projects.error ?? sections.error ?? spaces.error ?? labels.error ?? taskLabels.error;
  if (err) return new Response(`Export failed: ${err.message}`, { status: 500 });

  const name = (rows: { id: string; name: string }[] | null) =>
    new Map((rows ?? []).map((r) => [r.id, r.name]));
  const projectName = name(projects.data);
  const sectionName = name(sections.data);
  const spaceName = name(spaces.data);
  const labelName = name(labels.data);
  const titleById = new Map((tasks.data ?? []).map((t) => [t.id, t.title]));
  const labelsByTask = new Map<string, string[]>();
  for (const tl of taskLabels.data ?? []) {
    const n = labelName.get(tl.label_id);
    if (!n) continue;
    const list = labelsByTask.get(tl.task_id) ?? [];
    list.push(n);
    labelsByTask.set(tl.task_id, list);
  }

  const rows: ExportTask[] = (tasks.data ?? []).map((t) => ({
    title: t.title,
    notes: t.notes,
    done: t.done,
    status: t.status,
    priority: t.priority,
    scheduled_date: t.scheduled_date,
    due_date: t.due_date,
    estimate_minutes: t.estimate_minutes,
    completed_at: t.completed_at,
    created_at: t.created_at,
    recurrence: t.recurrence,
    is_inbox: t.is_inbox,
    space: t.space_id ? spaceName.get(t.space_id) ?? null : null,
    project: t.project_id ? projectName.get(t.project_id) ?? null : null,
    section: t.section_id ? sectionName.get(t.section_id) ?? null : null,
    parent: t.parent_task_id ? titleById.get(t.parent_task_id) ?? null : null,
    labels: labelsByTask.get(t.id) ?? [],
  }));

  const date = new Date().toISOString().slice(0, 10);
  return new Response(tasksToCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="zenboard-tasks-${date}.csv"`,
    },
  });
}
