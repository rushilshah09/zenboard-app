// Shared loader for the Projects hub (used by /projects and /projects/[id]).
// Fetches projects, their tasks (+ subtasks, for x/y rollups), this-week time
// entries, and (if migration 0003 is applied) project deadlines + activity, plus
// (if 0006 is applied) portal settings, client requests, and project docs.
// RLS scopes everything to the signed-in user. Degrades gracefully: missing
// migrations simply disable their features — the hub still works.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import type { PProject, PTask, PTime, PActivity, PRequest, PRequestMessage, PApproval, PDoc, PSection, PForm } from '@/components/projects/projects-workspace';

export function weekStartISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const BASE_COLS = 'id, name, color, status, client_id, created_at, updated_at';
const PORTAL_COLS =
  'portal_enabled, portal_token, share_progress, share_completed_tasks, share_open_tasks, share_timeline, share_files, share_invoices, allow_requests, portal_intro';

type PFormRow = { id: string; title: string; status: 'draft' | 'live' | 'closed'; share_token: string | null; updated_at: string; project_id: string };
export async function loadProjectsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const weekStart = weekStartISO();

  // Projects — try with deadline + portal columns; fall back as migrations allow.
  let deadlineSupported = true;
  let portalSupported = true;
  const full = await supabase.from('projects').select(`${BASE_COLS}, deadline, deadline_label, ${PORTAL_COLS}`).eq('space_id', sid).order('created_at');
  let projData = full.data as PProject[] | null;
  if (full.error) {
    portalSupported = false;
    const withDl = await supabase.from('projects').select(`${BASE_COLS}, deadline, deadline_label`).eq('space_id', sid).order('created_at');
    if (withDl.error) {
      deadlineSupported = false;
      const base = await supabase.from('projects').select(BASE_COLS).eq('space_id', sid).order('created_at');
      projData = base.data as PProject[] | null;
    } else {
      projData = withDl.data as PProject[] | null;
    }
  }

  const [{ data: tasks }, { data: times }, activityRes, requestsRes, messagesRes, docsRes, approvalsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, done, priority, estimate_minutes, elapsed_minutes, scheduled_date, due_date, highlight, completed_at, project_id, parent_task_id, created_at, sort_order')
      .eq('space_id', sid)
      .or('project_id.not.is.null,parent_task_id.not.is.null')
      .order('sort_order')
      .order('created_at'),
    supabase.from('time_entries').select('id, project_id, task_id, minutes, started_at, billed').not('project_id', 'is', null).order('started_at', { ascending: false }),
    supabase.from('project_activity').select('id, project_id, type, body, created_at').order('created_at', { ascending: false }),
    // Lifecycle columns (title/status/task_id/resolution_note) need 0017 — on
    // error the requests list is simply empty until the migration is applied.
    supabase.from('client_requests').select('id, project_id, name, title, body, status, client_id, task_id, resolution_note, created_at').order('created_at', { ascending: false }),
    supabase.from('request_messages').select('id, request_id, author, body, client_facing, created_at').order('created_at'),
    supabase.from('pages').select('id, project_id, title, type, client_visible, updated_at').not('project_id', 'is', null).order('updated_at', { ascending: false }),
    // Deliverable approvals (0019) — empty until applied.
    supabase.from('approvals').select('id, project_id, page_id, title, status, note, created_at').order('created_at', { ascending: false }),
  ]);

  const activitySupported = !activityRes.error;

  // Board status (migration 0011) — fetched separately so the critical tasks
  // fetch above never depends on the new column. Merged onto the loaded tasks.
  let statusSupported = false;
  const tasksArr = (tasks as PTask[]) ?? [];
  const st = await supabase.from('tasks').select('id, status').or('project_id.not.is.null,parent_task_id.not.is.null');
  if (!st.error) {
    statusSupported = true;
    const m = new Map((st.data as { id: string; status: string | null }[]).map((r) => [r.id, r.status]));
    for (const t of tasksArr) t.status = m.get(t.id) ?? null;
  }

  // Sections (migration 0014) — probed separately so the critical tasks fetch
  // never depends on the new table/column. Missing → feature stays hidden.
  let sectionsSupported = false;
  let sections: PSection[] = [];
  const sec = await supabase.from('sections').select('id, project_id, name, sort_order').order('sort_order');
  if (!sec.error) {
    sectionsSupported = true;
    sections = (sec.data as PSection[]) ?? [];
    const ts = await supabase.from('tasks').select('id, section_id').not('section_id', 'is', null);
    if (!ts.error) {
      const m = new Map((ts.data ?? []).map((r) => [r.id, r.section_id]));
      for (const t of tasksArr) t.section_id = m.get(t.id) ?? null;
    }
  }

  // Per-task client_visible map — fetched separately (and only when 0006 is
  // applied) so the critical tasks fetch above never depends on the new column.
  const taskVisible: Record<string, boolean> = {};
  if (portalSupported) {
    const tv = await supabase.from('tasks').select('id, client_visible').not('project_id', 'is', null);
    if (!tv.error) for (const r of (tv.data as { id: string; client_visible: boolean }[])) taskVisible[r.id] = r.client_visible;
  }

  // Forms per project + their response tallies. Errors (table absent until 0020
  // is applied) degrade to an empty list, exactly like the other gated loads.
  const formsRes = await supabase
    .from('forms').select('id, title, status, share_token, updated_at, project_id')
    .not('project_id', 'is', null).order('updated_at', { ascending: false });
  const formRows = (formsRes.error ? [] : (formsRes.data as PFormRow[])) ?? [];
  const formTally = new Map<string, { responses: number; partials: number }>();
  if (formRows.length > 0) {
    const rr = await supabase.from('form_responses').select('form_id, status').in('form_id', formRows.map((f) => f.id));
    for (const r of (rr.error ? [] : (rr.data as { form_id: string; status: string }[])) ?? []) {
      const cur = formTally.get(r.form_id) ?? { responses: 0, partials: 0 };
      if (r.status === 'complete') cur.responses += 1; else cur.partials += 1;
      formTally.set(r.form_id, cur);
    }
  }
  const forms: PForm[] = formRows.map((f) => ({
    id: f.id, title: f.title, status: f.status, shareToken: f.share_token, updatedAt: f.updated_at,
    projectId: f.project_id,
    responses: formTally.get(f.id)?.responses ?? 0, partials: formTally.get(f.id)?.partials ?? 0,
  }));

  return {
    projects: projData ?? [],
    forms,
    tasks: tasksArr,
    times: (times as PTime[]) ?? [],
    activity: (activitySupported ? (activityRes.data as PActivity[]) : []) ?? [],
    requests: (requestsRes.error ? [] : (requestsRes.data as PRequest[])) ?? [],
    messages: (messagesRes.error ? [] : (messagesRes.data as PRequestMessage[])) ?? [],
    approvals: (approvalsRes.error ? [] : (approvalsRes.data as PApproval[])) ?? [],
    docs: (docsRes.error ? [] : (docsRes.data as PDoc[])) ?? [],
    taskVisible,
    weekStart,
    sections,
    deadlineSupported,
    activitySupported,
    portalSupported,
    statusSupported,
    sectionsSupported,
  };
}
