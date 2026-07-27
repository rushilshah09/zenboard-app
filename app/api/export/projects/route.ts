// GET /api/export/projects — every project as Markdown with its sections and
// task checklists (principle 11). RLS scopes the rows; serialization lives in
// lib/export.ts where it's unit-tested.
import { createClient } from '@/lib/supabase/server';
import { projectsToMarkdown, type ExportProject, type ExportProjectTask } from '@/lib/export';

type TaskRow = {
  id: string; title: string; notes: string | null; done: boolean;
  scheduled_date: string | null; due_date: string | null; estimate_minutes: number | null;
  project_id: string | null; section_id: string | null; parent_task_id: string | null;
  sort_order: number;
};

type TreeNode = ExportProjectTask & { section_id: string | null };

// Children nest under parents (∞ schema); orphaned rows fall back to the top.
function buildTree(rows: TaskRow[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(rows.map((r) => [r.id, {
    section_id: r.section_id, title: r.title, done: r.done, notes: r.notes,
    scheduled_date: r.scheduled_date, due_date: r.due_date, estimate_minutes: r.estimate_minutes,
    subtasks: [],
  }]));
  const roots: TreeNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parent_task_id ? nodes.get(r.parent_task_id) : undefined;
    if (parent) parent.subtasks.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sign in to export.', { status: 401 });

  const [projects, tasks, sections, spaces, clients] = await Promise.all([
    supabase.from('projects').select('id, name, status, client_id, space_id, created_at').order('created_at', { ascending: true }),
    supabase.from('tasks')
      .select('id, title, notes, done, scheduled_date, due_date, estimate_minutes, project_id, section_id, parent_task_id, sort_order')
      .not('project_id', 'is', null)
      .order('sort_order', { ascending: true }),
    supabase.from('sections').select('id, name, project_id, sort_order').order('sort_order', { ascending: true }),
    supabase.from('spaces').select('id, name'),
    supabase.from('clients').select('id, name'),
  ]);
  const err = projects.error ?? tasks.error ?? sections.error ?? spaces.error ?? clients.error;
  if (err) return new Response(`Export failed: ${err.message}`, { status: 500 });

  const spaceName = new Map((spaces.data ?? []).map((s) => [s.id, s.name]));
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));

  const out: ExportProject[] = (projects.data ?? []).map((p) => {
    const projectTasks = ((tasks.data ?? []) as TaskRow[]).filter((t) => t.project_id === p.id);
    const roots = buildTree(projectTasks);
    const projectSections = (sections.data ?? []).filter((s) => s.project_id === p.id);
    return {
      name: p.name,
      status: p.status,
      client: p.client_id ? clientName.get(p.client_id) ?? null : null,
      space: p.space_id ? spaceName.get(p.space_id) ?? null : null,
      created_at: p.created_at,
      sections: projectSections.map((s) => ({
        name: s.name,
        tasks: roots.filter((t) => t.section_id === s.id),
      })),
      tasks: roots.filter((t) => !t.section_id || !projectSections.some((s) => s.id === t.section_id)),
    };
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(projectsToMarkdown(out, date), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="zenboard-projects-${date}.md"`,
    },
  });
}
