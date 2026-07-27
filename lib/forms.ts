import 'server-only';
// The forms data layer. Mirrors lib/portal.ts: ONE gated projection decides what
// a respondent may ever see (`loadFormByToken`), so the builder's Preview and the
// live form are the same render of the same shape and cannot drift.
//
// Security: the public entry uses the service role (respondents are anonymous)
// but only ever reads the single form matching the token, only when it is live
// and still accepting, and returns a fixed safe shape — never owner columns,
// never other forms, never responses.
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { toFormContent, toFormSettings, type Answers, type FormBlock, type FormSettings } from '@/lib/form-schema';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type DB = SupabaseClient<Database>;

export type FormStatus = 'draft' | 'live' | 'closed';

/** What a respondent receives. No owner data, no ids beyond the block ids. */
export type PublicForm = {
  id: string;
  version: number;
  title: string;
  description: string | null;
  blocks: FormBlock[];
  settings: FormSettings;
  studio: string;
};

/** A row in the Forms panel (client detail / project tab). */
export type FormSummary = {
  id: string;
  title: string;
  status: FormStatus;
  shareToken: string | null;
  updatedAt: string;
  responses: number;   // complete only — the number that matters
  partials: number;
};

/** A form in the global hub — a summary plus which client/project it lives under. */
export type FormHubItem = FormSummary & {
  context: { kind: 'client' | 'project'; id: string; name: string } | null;
};

/** The full record the builder edits. */
export type FormRecord = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  blocks: FormBlock[];
  settings: FormSettings;
  version: number;
  shareToken: string | null;
  clientId: string | null;
  projectId: string | null;
  studio: string;      // space name — what the respondent sees as the brand
  views: number;       // coarse open count, for the completion rate
  showInPortal: boolean;
};

export type ResponseRecord = {
  id: string;
  status: 'partial' | 'complete';
  formVersion: number;
  answers: Answers;
  respondent: { name?: string; email?: string } | null;
  meta: { source?: string; started_at?: string; completed_at?: string; duration_s?: number; last_field_id?: string };
  createdAt: string;
  taskId: string | null;   // set once this response has been turned into a task
};

const asAnswers = (raw: unknown): Answers => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Answers) : {});

// ── PUBLIC ────────────────────────────────────────────────────────────────
// Validate the token and return the projection, or null when the link isn't
// usable (unknown token, not live, past its close date, or at its response cap).
// Callers render one calm "this link isn't available" page for every null.
export async function loadFormByToken(token: string): Promise<PublicForm | null> {
  if (!token || token.length < 8) return null;
  const svc = createServiceClient() as unknown as DB;

  const { data, error } = await svc
    .from('forms')
    .select('id, title, description, status, content, settings, version, space_id')
    .eq('share_token', token)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string; title: string; description: string | null; status: FormStatus;
    content: unknown; settings: unknown; version: number; space_id: string | null;
  };
  if (row.status !== 'live') return null;

  const settings = toFormSettings(row.settings);
  if (!(await isAccepting(svc, row.id, settings))) return null;

  // Views are a coarse counter, not analytics: an atomic +1 via SQL function so
  // concurrent loads can't clobber each other. Fire-and-forget — a failed count
  // must never stop someone from filling the form.
  void (svc as unknown as { rpc: (fn: string, args: object) => Promise<unknown> })
    .rpc('increment_form_views', { p_form_id: row.id })
    .catch(() => {});

  const studio = row.space_id ? await spaceName(svc, row.space_id) : 'Studio';

  return {
    id: row.id,
    version: row.version,
    title: row.title,
    description: row.description,
    blocks: toFormContent(row.content).blocks,
    settings,
    studio,
  };
}

/** Shared gate: is this form still taking answers? Used by loader AND actions. */
export async function isAccepting(db: DB, formId: string, settings: FormSettings): Promise<boolean> {
  if (settings.closeAt) {
    const closes = new Date(settings.closeAt).getTime();
    if (Number.isFinite(closes) && Date.now() > closes) return false;
  }
  if (settings.limit && settings.limit > 0) {
    const { count } = await db
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', formId)
      .eq('status', 'complete');
    if ((count ?? 0) >= settings.limit) return false;
  }
  return true;
}

async function spaceName(db: DB, spaceId: string): Promise<string> {
  const { data } = await db.from('spaces').select('name').eq('id', spaceId).maybeSingle();
  return (data as { name: string } | null)?.name?.trim() || 'Studio';
}

// ── OWNER (RLS-scoped) ────────────────────────────────────────────────────
export async function loadForms(scope: { clientId?: string; projectId?: string }): Promise<FormSummary[]> {
  const db = (await createClient()) as unknown as DB;
  let q = db.from('forms').select('id, title, status, share_token, updated_at').order('updated_at', { ascending: false });
  if (scope.clientId) q = q.eq('client_id', scope.clientId);
  else if (scope.projectId) q = q.eq('project_id', scope.projectId);
  else return [];

  const { data } = await q;
  const rows = (data as unknown as { id: string; title: string; status: FormStatus; share_token: string | null; updated_at: string }[]) ?? [];
  if (rows.length === 0) return [];

  // One extra query tallies both counts for every form in scope.
  const { data: respRows } = await db
    .from('form_responses')
    .select('form_id, status')
    .in('form_id', rows.map((r) => r.id));
  const tally = new Map<string, { responses: number; partials: number }>();
  for (const r of (respRows as unknown as { form_id: string; status: string }[]) ?? []) {
    const cur = tally.get(r.form_id) ?? { responses: 0, partials: 0 };
    if (r.status === 'complete') cur.responses += 1; else cur.partials += 1;
    tally.set(r.form_id, cur);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    shareToken: r.share_token,
    updatedAt: r.updated_at,
    responses: tally.get(r.id)?.responses ?? 0,
    partials: tally.get(r.id)?.partials ?? 0,
  }));
}

// Every form the user owns (RLS-scoped), newest first, each tagged with its home
// client or project so the global hub can show "where it lives". A form always
// belongs to exactly one of the two (the 0020 CHECK), so context is only null for
// a row whose home was deleted out from under it.
export async function loadAllForms(): Promise<FormHubItem[]> {
  const db = (await createClient()) as unknown as DB;
  const { data } = await db
    .from('forms')
    .select('id, title, status, share_token, updated_at, client_id, project_id')
    .order('updated_at', { ascending: false });
  const rows = (data as unknown as {
    id: string; title: string; status: FormStatus; share_token: string | null;
    updated_at: string; client_id: string | null; project_id: string | null;
  }[]) ?? [];
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((r) => r.client_id).filter((x): x is string => !!x))];
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter((x): x is string => !!x))];

  const [respRes, clientRes, projectRes] = await Promise.all([
    db.from('form_responses').select('form_id, status').in('form_id', rows.map((r) => r.id)),
    clientIds.length ? db.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] }),
    projectIds.length ? db.from('projects').select('id, name').in('id', projectIds) : Promise.resolve({ data: [] }),
  ]);

  const tally = new Map<string, { responses: number; partials: number }>();
  for (const r of (respRes.data as unknown as { form_id: string; status: string }[]) ?? []) {
    const cur = tally.get(r.form_id) ?? { responses: 0, partials: 0 };
    if (r.status === 'complete') cur.responses += 1; else cur.partials += 1;
    tally.set(r.form_id, cur);
  }
  const clientName = new Map((clientRes.data as { id: string; name: string }[] ?? []).map((c) => [c.id, c.name]));
  const projectName = new Map((projectRes.data as { id: string; name: string }[] ?? []).map((p) => [p.id, p.name]));

  return rows.map((r) => {
    let context: FormHubItem['context'] = null;
    if (r.project_id) context = { kind: 'project', id: r.project_id, name: projectName.get(r.project_id) ?? 'Project' };
    else if (r.client_id) context = { kind: 'client', id: r.client_id, name: clientName.get(r.client_id) ?? 'Client' };
    return {
      id: r.id, title: r.title, status: r.status, shareToken: r.share_token, updatedAt: r.updated_at,
      responses: tally.get(r.id)?.responses ?? 0, partials: tally.get(r.id)?.partials ?? 0,
      context,
    };
  });
}

export async function loadForm(id: string): Promise<FormRecord | null> {
  const db = (await createClient()) as unknown as DB;
  const { data } = await db
    .from('forms')
    .select('id, title, description, status, content, settings, version, share_token, client_id, project_id, space_id, view_count, show_in_portal')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    id: string; title: string; description: string | null; status: FormStatus; content: unknown;
    settings: unknown; version: number; share_token: string | null; client_id: string | null;
    project_id: string | null; space_id: string | null; view_count: number | null; show_in_portal: boolean | null;
  };
  return {
    views: row.view_count ?? 0,
    showInPortal: row.show_in_portal ?? false,
    studio: row.space_id ? await spaceName(db, row.space_id) : 'Studio',
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    blocks: toFormContent(row.content).blocks,
    settings: toFormSettings(row.settings),
    version: row.version,
    shareToken: row.share_token,
    clientId: row.client_id,
    projectId: row.project_id,
  };
}

export async function loadFormResponses(formId: string): Promise<ResponseRecord[]> {
  const db = (await createClient()) as unknown as DB;
  const { data } = await db
    .from('form_responses')
    .select('id, status, form_version, answers, respondent, meta, created_at, task_id')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data as unknown as {
    id: string; status: 'partial' | 'complete'; form_version: number;
    answers: unknown; respondent: unknown; meta: unknown; created_at: string; task_id: string | null;
  }[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    formVersion: r.form_version,
    answers: asAnswers(r.answers),
    respondent: (r.respondent && typeof r.respondent === 'object' ? r.respondent : null) as ResponseRecord['respondent'],
    meta: (r.meta && typeof r.meta === 'object' ? r.meta : {}) as ResponseRecord['meta'],
    createdAt: r.created_at,
    taskId: r.task_id ?? null,
  }));
}
