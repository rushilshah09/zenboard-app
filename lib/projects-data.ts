// Shared loader for the Projects hub (used by /projects and /projects/[id]).
// Fetches projects, their tasks (+ subtasks, for x/y rollups), this-week time
// entries, and (if migration 0003 is applied) project deadlines + activity, plus
// (if 0006 is applied) portal settings, client requests, and project docs.
// RLS scopes everything to the signed-in user. Degrades gracefully: missing
// migrations simply disable their features — the hub still works.
//
// ── NINE WAVES BECAME TWO ───────────────────────────────────────────────────
// This was the slowest page in the app (measured: 2.3s of application code) and
// none of it was rendering. It ran NINE serial round trips, and it read the
// `tasks` table FOUR TIMES — once for the data, then three more times for one
// extra column each:
//
//     tasks(…16 columns…)          ← the real read
//     tasks(id, status)            ← wave 3, for one column (retired with the
//                                    status board, 2026-09-10)
//     tasks(id, section_id)        ← wave 6, for one column
//     tasks(id, client_visible)    ← wave 7, for one column
//
// Each split existed for a good reason — "the critical tasks fetch must never
// depend on a column a migration might not have added yet" — but the price was
// a whole ~220ms round trip per optional column, paid by every account
// including the ones where all three columns exist.
//
// The gate is now a RETRY instead of a split: ask for everything, and if the
// database refuses, fall back to the base columns and go get the optional ones
// the old way. A migrated account pays for one query; an unmigrated one pays
// what it used to. Same guarantee, one wave.
//
// The other lever was noticing which queries only LOOKED dependent.
// `form_responses` was fetched with `.in('form_id', …)` after the forms came
// back — but RLS already scopes that table to this user, so asking for all of
// them is the same answer and needs nothing to arrive first.
import type { PProject, PTask, PTime, PActivity, PRequest, PRequestMessage, PApproval, PDoc, PSection, PForm, PMilestone } from '@/components/projects/projects-workspace';
import { currentProfile } from '@/lib/profile';
import { readPropLayout } from '@/lib/property-layout';
import { pageScope } from '@/lib/page-scope';

const BASE_COLS = 'id, name, color, status, client_id, created_at, updated_at';
const PORTAL_COLS =
  'portal_enabled, portal_token, share_progress, share_completed_tasks, share_open_tasks, share_timeline, share_files, share_invoices, allow_requests, portal_intro';

type PFormRow = { id: string; title: string; status: 'draft' | 'live' | 'closed'; share_token: string | null; updated_at: string; project_id: string };
const TASK_COLS = 'id, title, done, priority, estimate_minutes, elapsed_minutes, scheduled_date, due_date, highlight, completed_at, project_id, parent_task_id, created_at, sort_order';
/** Columns added by later migrations. Asked for together, dropped together.
 *  `status` is not among them: the Board's four-state vocabulary is retired
 *  and nothing reads it (see lib/actions/tasks.ts). */
const TASK_OPTIONAL = 'section_id, client_visible';

export async function loadProjectsData() {
  const { supabase, sid } = await pageScope();

  // ── WAVE 1: everything that depends on nothing but the space id ──
  const [
    projectsRes, tasksRes, timesRes, activityRes, requestsRes, messagesRes, docsRes,
    approvalsRes, milestonesRes, sectionsRes, formsRes, responsesRes, clientsRes,
  ] = await Promise.all([
    // Projects: optimistic, with three fallbacks. `icon` (0042) is asked for
    // in the SAME first query rather than getting a probe of its own — a
    // migrated account still pays for exactly one round trip, and the tier
    // below it is the previous cascade unchanged, so an account that has not
    // run 0042 behaves precisely as it did before the column existed.
    (async () => {
      const withIcon = await supabase.from('projects').select(`${BASE_COLS}, icon, deadline, deadline_label, ${PORTAL_COLS}`).eq('space_id', sid).order('created_at');
      if (!withIcon.error) return { rows: withIcon.data as PProject[] | null, deadline: true, portal: true, icon: true };
      const full = await supabase.from('projects').select(`${BASE_COLS}, deadline, deadline_label, ${PORTAL_COLS}`).eq('space_id', sid).order('created_at');
      if (!full.error) return { rows: full.data as PProject[] | null, deadline: true, portal: true, icon: false };
      const withDl = await supabase.from('projects').select(`${BASE_COLS}, deadline, deadline_label`).eq('space_id', sid).order('created_at');
      if (!withDl.error) return { rows: withDl.data as PProject[] | null, deadline: true, portal: false, icon: false };
      const base = await supabase.from('projects').select(BASE_COLS).eq('space_id', sid).order('created_at');
      return { rows: base.data as PProject[] | null, deadline: false, portal: false, icon: false };
    })(),
    // Tasks: one query for the data AND the three optional columns.
    (async () => {
      const q = () => supabase.from('tasks').select(`${TASK_COLS}, ${TASK_OPTIONAL}`)
        .eq('space_id', sid).or('project_id.not.is.null,parent_task_id.not.is.null')
        .order('sort_order').order('created_at');
      const full = await q();
      if (!full.error) return { rows: (full.data as unknown as PTask[]) ?? [], optional: true };
      const base = await supabase.from('tasks').select(TASK_COLS)
        .eq('space_id', sid).or('project_id.not.is.null,parent_task_id.not.is.null')
        .order('sort_order').order('created_at');
      return { rows: (base.data as unknown as PTask[]) ?? [], optional: false };
    })(),
    supabase.from('time_entries').select('id, project_id, task_id, minutes, started_at, billed').not('project_id', 'is', null).order('started_at', { ascending: false }),
    supabase.from('project_activity').select('id, project_id, type, body, created_at').order('created_at', { ascending: false }),
    // Lifecycle columns (title/status/task_id/resolution_note) need 0017 — on
    // error the requests list is simply empty until the migration is applied.
    supabase.from('client_requests').select('id, project_id, name, title, body, status, client_id, task_id, resolution_note, created_at').order('created_at', { ascending: false }),
    supabase.from('request_messages').select('id, request_id, author, body, client_facing, created_at').order('created_at'),
    supabase.from('pages').select('id, project_id, title, type, client_visible, updated_at').not('project_id', 'is', null).order('updated_at', { ascending: false }),
    // Deliverable approvals (0019) — empty until applied.
    supabase.from('approvals').select('id, project_id, page_id, title, status, note, created_at').order('created_at', { ascending: false }),
    // Milestones (0036) and sections (0014) — probed by their own SELECT, in
    // the wave rather than after it.
    // Milestones (0036), minus anything 0041 has already folded into a
    // workstream. `migrated_at` is 0041's stamp, so the retry gate below is
    // also the FEATURE gate: on a database that has not run 0041 the column
    // is absent, every row reads as un-migrated, and the old checkpoint list
    // keeps rendering. Same retry-instead-of-probe pattern as the tasks and
    // sections queries above — one round trip on a migrated account.
    (async () => {
      const full = await supabase.from('milestones')
        .select('id, project_id, title, done, due_date, sort_order, migrated_at')
        .not('project_id', 'is', null).is('migrated_at', null);
      if (!full.error) return full;
      return supabase.from('milestones')
        .select('id, project_id, title, done, due_date, sort_order')
        .not('project_id', 'is', null);
    })(),
    // Sections (0014) + the workstream columns (0040), asked for together and
    // dropped together — the same retry-instead-of-probe gate the tasks query
    // above uses, so a migrated account still pays for exactly one round trip.
    (async () => {
      const full = await supabase.from('sections').select('id, project_id, name, sort_order, client_visible, status, due_date').order('sort_order');
      if (!full.error) return full;
      return supabase.from('sections').select('id, project_id, name, sort_order').order('sort_order');
    })(),
    // Forms (0020) — empty until applied.
    supabase.from('forms').select('id, title, status, share_token, updated_at, project_id').not('project_id', 'is', null).order('updated_at', { ascending: false }),
    // RLS already scopes this to the signed-in user, so it does NOT need the
    // form ids to arrive first — that `.in()` was the only thing making it a
    // second wave.
    supabase.from('form_responses').select('form_id, status'),
    // Client NAMES, for the project header's Client property. In the same
    // wave, so it costs no round trip — and it is a separate query rather
    // than a `clients(name)` embed on the projects read, because that read
    // has fallbacks of its own and an embed that failed would take the whole
    // project list down with it. RLS scopes it to this user.
    supabase.from('clients').select('id, name'),
  ]);

  const deadlineSupported = projectsRes.deadline;
  const iconSupported = projectsRes.icon;
  const portalSupported = projectsRes.portal;
  const projData = projectsRes.rows;
  const tasksArr = tasksRes.rows;
  const activitySupported = !activityRes.error;

  const milestonesSupported = !milestonesRes.error;
  const milestones: PMilestone[] = milestonesSupported ? ((milestonesRes.data as unknown as PMilestone[]) ?? []) : [];
  const sectionsSupported = !sectionsRes.error;
  const sections: PSection[] = sectionsSupported ? ((sectionsRes.data as PSection[]) ?? []) : [];

  // ── WAVE 2, and only for a database that refused the optional columns ──
  // A fully migrated account never reaches this block.
  const taskVisible: Record<string, boolean> = {};
  if (tasksRes.optional) {
    for (const t of tasksArr) {
      const row = t as PTask & { client_visible?: boolean };
      if (typeof row.client_visible === 'boolean') taskVisible[t.id] = row.client_visible;
    }
  } else {
    const [ts, tv] = await Promise.all([
      sectionsSupported
        ? supabase.from('tasks').select('id, section_id').not('section_id', 'is', null)
        : Promise.resolve({ data: null, error: null }),
      portalSupported
        ? supabase.from('tasks').select('id, client_visible').not('project_id', 'is', null)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (!ts.error && ts.data) {
      const m = new Map((ts.data as { id: string; section_id: string | null }[]).map((r) => [r.id, r.section_id]));
      for (const t of tasksArr) t.section_id = m.get(t.id) ?? null;
    }
    if (!tv.error && tv.data) {
      for (const r of tv.data as { id: string; client_visible: boolean }[]) taskVisible[r.id] = r.client_visible;
    }
  }

  const formRows = (formsRes.error ? [] : (formsRes.data as PFormRow[])) ?? [];
  const formTally = new Map<string, { responses: number; partials: number }>();
  for (const r of (responsesRes.error ? [] : (responsesRes.data as { form_id: string; status: string }[])) ?? []) {
    const cur = formTally.get(r.form_id) ?? { responses: 0, partials: 0 };
    if (r.status === 'complete') cur.responses += 1; else cur.partials += 1;
    formTally.set(r.form_id, cur);
  }
  const forms: PForm[] = formRows.map((f) => ({
    id: f.id, title: f.title, status: f.status, shareToken: f.share_token, updatedAt: f.updated_at,
    projectId: f.project_id,
    responses: formTally.get(f.id)?.responses ?? 0, partials: formTally.get(f.id)?.partials ?? 0,
  }));

  const times = timesRes.data;
  // Degrades to "no names": the header then says the project is linked
  // without naming the client, which is what it always said before.
  const clientNames: Record<string, string> = Object.fromEntries(
    ((clientsRes.error ? [] : clientsRes.data) ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
  );

  return {
    projects: projData ?? [],
    // How this person arranged the project header's properties. NOT a round
    // trip: `currentProfile` is request-cached and the (app) layout has already
    // awaited it for the display name, the timezone and the sidebar's pins.
    propertyLayout: readPropLayout((await currentProfile())?.preferences, 'project'),
    forms,
    tasks: tasksArr,
    times: (times as PTime[]) ?? [],
    activity: (activitySupported ? (activityRes.data as PActivity[]) : []) ?? [],
    requests: (requestsRes.error ? [] : (requestsRes.data as PRequest[])) ?? [],
    messages: (messagesRes.error ? [] : (messagesRes.data as PRequestMessage[])) ?? [],
    approvals: (approvalsRes.error ? [] : (approvalsRes.data as PApproval[])) ?? [],
    docs: (docsRes.error ? [] : (docsRes.data as PDoc[])) ?? [],
    taskVisible,
    clientNames,
    sections,
    milestones,
    milestonesSupported,
    deadlineSupported,
    iconSupported,
    activitySupported,
    portalSupported,
    sectionsSupported,
  };
}
