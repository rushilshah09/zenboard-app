'use server';
// Project mutations. RLS scopes to the user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { PROJECT_TEMPLATES, buildTemplatePlan } from '@/lib/project-templates';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}
async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

const COLORS = ['#9A1B6F', '#7B8B5F', '#C88A3B', '#2B5CB0', '#5C4FB8'];

export async function addProject(input: { name: string; color?: string; clientId?: string | null }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('projects')
    .insert({ user_id: user.id, space_id: sid, name: input.name.trim(), color: input.color ?? COLORS[0], client_id: input.clientId ?? null, status: 'active' })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add project.' };
  return { id: data.id };
}

// Create a project from a built-in template (§7E). Seeds the template's sections
// and its tasks with relative, weekend-adjusted dates — one server round-trip so
// the freelancer lands on a project already shaped for the engagement. Section /
// dated-task inserts degrade gracefully on DBs predating 0014 / 0009.
export async function createProjectFromTemplate(input: {
  name: string; color?: string; clientId?: string | null; deadline?: string | null; deadlineLabel?: string | null; templateKey: string;
}): Promise<{ error: string } | { id: string }> {
  const tpl = PROJECT_TEMPLATES.find((t) => t.key === input.templateKey);
  if (!tpl) return { error: 'Unknown template.' };
  const name = input.name.trim();
  if (!name) return { error: 'Project name is required.' };
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const plan = buildTemplatePlan(tpl);

  // 1) The project.
  const proj = await supabase.from('projects').insert({
    user_id: user.id, space_id: sid, name, color: input.color ?? COLORS[0], client_id: input.clientId ?? null, status: 'active',
    ...(input.deadline ? { deadline: input.deadline, deadline_label: input.deadlineLabel?.trim() || null } : {}),
  }).select('id').single();
  if (proj.error || !proj.data) return { error: proj.error?.message ?? 'Could not create project.' };
  const projectId = (proj.data as { id: string }).id;

  // 2) Sections (best-effort — a missing table just leaves the tasks loose).
  const idByName = new Map<string, string>();
  if (plan.sections.length) {
    const rows = plan.sections.map((sname, i) => ({ user_id: user.id, project_id: projectId, name: sname, sort_order: i }));
    const secs = await supabase.from('sections').insert(rows).select('id, name');
    if (!secs.error) for (const s of (secs.data as { id: string; name: string }[])) idByName.set(s.name, s.id);
  }

  // 3) Dated tasks, filed into their sections.
  if (plan.tasks.length) {
    const rows = plan.tasks.map((t) => ({
      user_id: user.id, space_id: sid, project_id: projectId, title: t.title, priority: t.priority,
      scheduled_date: t.scheduledDate,
      ...(t.section && idByName.has(t.section) ? { section_id: idByName.get(t.section) } : {}),
    }));
    const res = await supabase.from('tasks').insert(rows);
    if (res.error) {
      // Degrade for DBs predating scheduled_date (0009) / section_id (0014).
      const bare = plan.tasks.map((t) => ({ user_id: user.id, space_id: sid, project_id: projectId, title: t.title, priority: t.priority }));
      await supabase.from('tasks').insert(bare);
    }
  }
  return { id: projectId };
}

export async function setProjectClient(projectId: string, clientId: string | null): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('projects').update({ client_id: clientId }).eq('id', projectId);
  return error ? { error: error.message } : { ok: true };
}

// Patch a project's editable fields (Edit action in the hub). status is free
// text (active | paused | completed | archived). deadline/deadline_label require
// migration 0003 — only sent when the columns exist (UI-gated).
export async function updateProject(
  id: string,
  patch: { name?: string; color?: string; status?: string; deadline?: string | null; deadline_label?: string | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const clean: { name?: string; color?: string; status?: string; deadline?: string | null; deadline_label?: string | null } = {};
  if (patch.name != null) clean.name = patch.name.trim();
  if (patch.color != null) clean.color = patch.color;
  if (patch.status != null) clean.status = patch.status;
  if (patch.deadline !== undefined) clean.deadline = patch.deadline || null;
  if (patch.deadline_label !== undefined) clean.deadline_label = patch.deadline_label?.trim() || null;
  if (!Object.keys(clean).length) return { ok: true };
  const { error } = await supabase.from('projects').update(clean).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Append a project-level activity entry (manual note or status change).
// Requires migration 0003 (project_activity). UI only calls this when the
// table exists; a missing-table error is returned, not thrown.
export async function logProjectActivity(
  projectId: string,
  body: string,
  type: 'note' | 'status_change' = 'note',
): Promise<{ error: string } | { id: string; created_at: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('project_activity')
    .insert({ project_id: projectId, user_id: user.id, type, body: body.trim() })
    .select('id, created_at').single();
  if (error || !data) return { error: error?.message ?? 'Could not log activity.' };
  return { id: data.id, created_at: data.created_at };
}

export async function addProjectTask(projectId: string, title: string, sectionId?: string | null): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data: proj } = await supabase.from('projects').select('space_id').eq('id', projectId).maybeSingle();
  if (!proj) return { error: 'Project not found.' };
  const { data, error } = await supabase.from('tasks')
    .insert({
      user_id: user.id, space_id: proj.space_id, project_id: projectId, title: title.trim(), priority: 'low',
      // Only touch section_id when a section is targeted — keeps the plain-add
      // path identical for DBs that predate the sections migration (0014).
      ...(sectionId ? { section_id: sectionId } : {}),
    })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add task.' };
  return { id: data.id };
}
