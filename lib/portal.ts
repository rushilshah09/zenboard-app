import 'server-only';
// The client-portal projection. ONE place decides what a client may ever see —
// used identically by the public token route and by owner "Preview as client",
// so the preview is guaranteed to match the live portal 1:1.
//
// Security rules baked in here:
//   • Only safe columns are ever selected (no notes, estimates, time, money).
//   • Each section is gated by its share_* flag; per-item client_visible can
//     additively expose individual tasks.
//   • The timeline is derived ONLY from completed-task titles/dates — internal
//     notes / activity are never read, so they cannot leak.
//   • Everything is scoped to a single project + its space name. No other
//     project, no client list, no owner data is ever queried.
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { toBlocks, blocksToText } from '@/lib/blocks';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type DB = SupabaseClient<Database>;

const PROJECT_COLS =
  'id, space_id, name, status, portal_enabled, portal_token, share_progress, share_completed_tasks, share_open_tasks, share_timeline, share_files, share_invoices, allow_requests, portal_intro';

export type PortalTask = { id: string; title: string };
export type PortalEvent = { at: string; title: string };
export type PortalDoc = { id: string; title: string; text: string; updated_at: string };
export type PortalInvoice = { id: string; number: string; status: 'sent' | 'paid' | 'overdue'; total: number; dueDate: string | null };
export type PortalApproval = { id: string; title: string; status: 'awaiting' | 'approved' | 'changes_requested'; note: string | null };
/** A form the studio has asked this client to fill in, surfaced in the portal. */
export type PortalForm = { id: string; title: string; description: string | null; token: string };

export type PortalView = {
  studio: string;
  projectName: string;
  status: string;
  intro: string | null;
  allowRequests: boolean;
  progress: { done: number; total: number; pct: number } | null;
  completed: PortalTask[] | null;
  open: PortalTask[] | null;
  timeline: PortalEvent[] | null;
  docs: PortalDoc[] | null;
  invoices: PortalInvoice[] | null;
  approvals: PortalApproval[] | null;
  forms: PortalForm[] | null;
};

type ProjectRow = {
  id: string; space_id: string; name: string; status: string;
  portal_enabled: boolean; portal_token: string | null;
  share_progress: boolean; share_completed_tasks: boolean; share_open_tasks: boolean;
  share_timeline: boolean; share_files: boolean; share_invoices: boolean; allow_requests: boolean;
  portal_intro: string | null;
};

// Issued invoices for a project, reduced to the safe client-facing shape.
// Only sent/paid/overdue are ever returned — draft and void never leave the studio.
// Totals are summed from line items; notes and internal fields are never selected.
async function loadInvoices(db: DB, projectId: string): Promise<PortalInvoice[]> {
  const { data: rows } = await db
    .from('invoices')
    .select('id, number, status, due_date')
    .eq('project_id', projectId)
    .in('status', ['sent', 'paid', 'overdue'])
    .order('created_at', { ascending: false });
  const invoices = (rows as { id: string; number: string; status: PortalInvoice['status']; due_date: string | null }[]) ?? [];
  if (invoices.length === 0) return [];

  const { data: itemRows } = await db
    .from('invoice_items')
    .select('invoice_id, quantity, unit_amount')
    .in('invoice_id', invoices.map((i) => i.id));
  const totals = new Map<string, number>();
  for (const it of (itemRows as { invoice_id: string; quantity: number; unit_amount: number }[]) ?? []) {
    totals.set(it.invoice_id, (totals.get(it.invoice_id) ?? 0) + (it.quantity ?? 0) * (it.unit_amount ?? 0));
  }

  return invoices.map((i) => ({ id: i.id, number: i.number, status: i.status, total: totals.get(i.id) ?? 0, dueDate: i.due_date }));
}

// Deliverable approvals the owner has asked the client to act on. Awaiting ones
// come first (they need the client), then resolved ones as history.
async function loadApprovals(db: DB, projectId: string): Promise<PortalApproval[]> {
  const { data } = await db
    .from('approvals')
    .select('id, title, status, note')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  const rows = (data as { id: string; title: string | null; status: PortalApproval['status']; note: string | null }[]) ?? [];
  const rank = (s: PortalApproval['status']) => (s === 'awaiting' ? 0 : 1);
  return rows
    .map((r) => ({ id: r.id, title: r.title?.trim() || 'Deliverable', status: r.status, note: r.note }))
    .sort((a, b) => rank(a.status) - rank(b.status));
}

// Live forms this project has chosen to surface in the portal. Only the share
// token travels — the client fills them on /f/[token] exactly as any other
// respondent would, so there is one filling path and one security gate.
async function loadPortalForms(db: DB, projectId: string): Promise<PortalForm[]> {
  const { data } = await db
    .from('forms')
    .select('id, title, description, share_token')
    .eq('project_id', projectId)
    .eq('status', 'live')
    .eq('show_in_portal', true)
    .not('share_token', 'is', null)
    .order('updated_at', { ascending: false });
  const rows = (data as { id: string; title: string; description: string | null; share_token: string | null }[]) ?? [];
  return rows
    .filter((r) => !!r.share_token)
    .map((r) => ({ id: r.id, title: r.title, description: r.description, token: r.share_token! }));
}

// Coerce a page's jsonb content into plain display text (no markup, no leakage).
// Handles the block model, the legacy { text } prose shape, and raw strings.
function docText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return blocksToText(toBlocks(content));
}

// Fetch the safe raw rows for a project and build the gated projection. Used by
// both the public (service-role) and preview (owner RLS) entry points with the
// SAME client interface, guaranteeing identical output.
async function build(db: DB, project: ProjectRow): Promise<PortalView> {
  const [spaceRes, tasksRes, docsRes, invoices, approvalsAll, formsAll] = await Promise.all([
    db.from('spaces').select('name').eq('id', project.space_id).maybeSingle(),
    // titles + flags ONLY — never notes/estimate/elapsed/$.
    db.from('tasks').select('id, title, done, completed_at, client_visible, parent_task_id')
      .eq('project_id', project.id).is('parent_task_id', null).order('sort_order').order('created_at'),
    project.share_files
      ? db.from('pages').select('id, title, content, updated_at, client_visible')
          .eq('project_id', project.id).eq('client_visible', true).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    project.share_invoices ? loadInvoices(db, project.id) : Promise.resolve(null),
    loadApprovals(db, project.id),
    // Errors (table absent until 0020 is applied) degrade to no Forms section.
    loadPortalForms(db, project.id).catch(() => [] as PortalForm[]),
  ]);

  const studio = (spaceRes.data as { name: string } | null)?.name?.trim() || 'Studio';
  const tasks = (tasksRes.data as { id: string; title: string; done: boolean; completed_at: string | null; client_visible: boolean }[]) ?? [];

  const doneTasks = tasks.filter((t) => t.done);
  const openTasks = tasks.filter((t) => !t.done);

  const progress = project.share_progress
    ? { done: doneTasks.length, total: tasks.length, pct: tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0 }
    : null;

  // bucket flag OR per-task override
  const completed = project.share_completed_tasks
    ? doneTasks.map((t) => ({ id: t.id, title: t.title }))
    : doneTasks.filter((t) => t.client_visible).map((t) => ({ id: t.id, title: t.title }));

  const open = project.share_open_tasks
    ? openTasks.map((t) => ({ id: t.id, title: t.title }))
    : openTasks.filter((t) => t.client_visible).map((t) => ({ id: t.id, title: t.title }));

  // Timeline is derived ONLY from completed-task titles + dates (always safe).
  const timeline = project.share_timeline
    ? doneTasks
        .filter((t) => t.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
        .slice(0, 30)
        .map((t) => ({ at: t.completed_at!, title: t.title }))
    : null;

  const docs = project.share_files
    ? ((docsRes.data as { id: string; title: string | null; content: unknown; updated_at: string }[]) ?? []).map((d) => ({
        id: d.id, title: d.title?.trim() || 'Untitled', text: docText(d.content), updated_at: d.updated_at,
      }))
    : null;

  return {
    studio,
    projectName: project.name,
    status: project.status,
    intro: project.portal_intro?.trim() || null,
    allowRequests: project.allow_requests,
    progress,
    // null = section not shared (hidden). Empty array = shared but nothing yet.
    completed: project.share_completed_tasks || completed.length ? completed : null,
    open: project.share_open_tasks || open.length ? open : null,
    timeline,
    docs,
    invoices,
    // Empty → null so the portal simply omits the section when there's nothing to review.
    approvals: approvalsAll.length ? approvalsAll : null,
    forms: formsAll.length ? formsAll : null,
  };
}

// PUBLIC entry: validate token via service role (bypasses RLS) and return the
// projection. Returns null if the token is unknown or the portal is disabled.
export async function loadPortalByToken(token: string): Promise<PortalView | null> {
  if (!token || token.length < 8) return null;
  const svc = createServiceClient() as unknown as DB;
  const { data, error } = await svc.from('projects').select(PROJECT_COLS).eq('portal_token', token).maybeSingle();
  if (error || !data) return null;
  const project = data as ProjectRow;
  if (!project.portal_enabled) return null;
  return build(svc, project);
}

// PREVIEW entry: owner is authenticated; RLS scopes to their own project. Shows
// the projection regardless of portal_enabled so the owner can preview before
// turning it on. Same build() ⇒ identical to the live portal.
export async function loadPortalPreview(projectId: string): Promise<PortalView | null> {
  const db = (await createClient()) as unknown as DB;
  const { data, error } = await db.from('projects').select(PROJECT_COLS).eq('id', projectId).maybeSingle();
  if (error || !data) return null;
  return build(db, data as ProjectRow);
}
