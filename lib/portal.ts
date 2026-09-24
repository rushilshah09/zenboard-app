import 'server-only';
// The client-portal projection. ONE place decides what a client may ever see —
// used identically by the public token route and by owner "Preview as client",
// so the preview is guaranteed to match the live portal 1:1.
//
// Security rules baked in here:
//   • Only safe columns are ever selected (no notes, estimates, time, money).
//   • Each section is gated by its share_* flag; per-item client_visible can
//     additively expose individual tasks.
//   • The timeline is derived ONLY from completed-task titles/dates.
//   • Activity IS read now, and narrowly (S2): only rows whose `type` says
//     they were addressed to the client, and only their body and date. The old
//     rule here was "activity is never read, so it cannot leak" — safe, and the
//     reason the portal read like a changelog instead of like us. The query
//     itself is the gate: a private note is never fetched at all.
//   • Everything is scoped to a single project + its space name. No other
//     project, no client list, no owner data is ever queried.
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { clientVisible, readChannels } from '@/lib/visibility';
import { clientGroups, type Workstream } from '@/lib/workstreams';
import { clientUpdates, CLIENT_UPDATE, type UpdateRow } from '@/lib/updates';
import { attachmentKind, type Attachment } from '@/lib/attachments';
import { toBlocks, blocksToText, type Block } from '@/lib/blocks';
import type { LineItem } from '@/lib/line-items';
import type { AcceptTerms, Acceptance } from '@/lib/acceptance';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type DB = SupabaseClient<Database>;

const PROJECT_COLS =
  'id, space_id, name, status, portal_enabled, portal_token, share_progress, share_completed_tasks, share_open_tasks, share_timeline, share_files, share_invoices, allow_requests, portal_intro';

export type PortalTask = { id: string; title: string };
export type PortalEvent = { at: string; title: string };
/**
 * Something the studio WROTE to this client (S2, lib/updates.ts).
 *
 * The one thing in this projection that is a sentence rather than a record.
 * `lib/portal.ts`'s comment used to say activity is "never read, so it cannot
 * leak" — it is read now, and narrowly: only rows whose type says they were
 * addressed, and only the body and the date.
 */
export type PortalUpdate = { id: string; at: string; body: string };
/**
 * A client-facing workstream (0040) with the work inside it.
 *
 * Only streams the owner marked appear, and a stream with nothing visible in it
 * does not appear at all — see lib/workstreams.ts. `pct` counts only the tasks
 * the client can see, so the bar always agrees with the rows underneath it;
 * showing true internal progress here would leak how much work is hidden.
 */
export type PortalStream = { id: string; name: string; open: PortalTask[]; completed: PortalTask[]; pct: number };
/** A file the studio handed over. Never a URL — the portal mints one per click. */
export type PortalFile = { id: string; filename: string; size: number | null; kind: string };
/**
  * An accept block the client can sign (§7M), projected STRUCTURALLY rather than
  * flattened into `text`.
  *
  * This is the shape the portal's security rule forces, and it is also the right
  * shape: the portal deliberately reduces a document to safe plain text, so the
  * answer to "the client must be able to sign" is not "render arbitrary blocks
  * out here" — it is to project the two paperwork blocks explicitly, review them
  * once, and leave every other block flattened exactly as before.
  */
export type PortalAccept = { blockId: string; terms: AcceptTerms; acceptance: Acceptance | null };
export type PortalDoc = {
  id: string; title: string; text: string; updated_at: string;
  /** Prices, if the document quotes any. Read-only out here. */
  items: LineItem[] | null;
  accepts: PortalAccept[];
};
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
  /** Client-facing workstreams. `null` when the project has none — the Work
   *  section then looks exactly as it did before workstreams existed. */
  streams: PortalStream[] | null;
  /** What the studio has told this client, newest first. */
  updates: PortalUpdate[] | null;
  timeline: PortalEvent[] | null;
  docs: PortalDoc[] | null;
  files: PortalFile[] | null;
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
//
// The two paperwork blocks are REMOVED here rather than flattened: the portal
// renders them properly (prices as a table, the accept block as a form), and
// leaving them in `text` as well would print the statement and every price
// twice — once as prose above, once as the thing itself below.
function docText(content: unknown, blocks: Block[]): string {
  if (!content) return '';
  if (typeof content === 'string') return content;   // pre-block-model rows
  return blocksToText(blocks.filter((b) => b.type !== 'lineitems' && b.type !== 'accept'));
}

// Every price the document quotes, in document order. Multiple line-items
// blocks are concatenated — a proposal that prices phases separately is one
// list to the client, who only ever sees a total.
const docItems = (blocks: Block[]): LineItem[] =>
  blocks.filter((b) => b.type === 'lineitems').flatMap((b) => b.items ?? []);

// Signatures on the project's shared docs. Absent table (0034 not applied) or
// any error degrades to "nothing signed yet" — the accept block still renders,
// and the write path refuses politely rather than the portal failing to load.
async function loadAcceptances(db: DB, pageIds: string[]): Promise<Map<string, Acceptance[]>> {
  const by = new Map<string, Acceptance[]>();
  if (!pageIds.length) return by;
  const { data, error } = await db.from('acceptances')
    .select('id, page_id, block_id, signer_name, signer_email, accepted_at, statement, content_hash, amount')
    .in('page_id', pageIds);
  if (error || !data) return by;
  for (const r of data) {
    const list = by.get(r.page_id) ?? [];
    list.push({
      id: r.id, blockId: r.block_id, signerName: r.signer_name, signerEmail: r.signer_email,
      acceptedAt: r.accepted_at, statement: r.statement, contentHash: r.content_hash,
      amount: r.amount === null ? null : Number(r.amount),
      // The portal never shows the owner's invoicing. Always null out here.
      invoiceId: null,
    });
    by.set(r.page_id, list);
  }
  return by;
}

// Fetch the safe raw rows for a project and build the gated projection. Used by
// both the public (service-role) and preview (owner RLS) entry points with the
// SAME client interface, guaranteeing identical output.
async function build(db: DB, project: ProjectRow): Promise<PortalView> {
  const [spaceRes, tasksRes, docsRes, invoices, approvalsAll, formsAll, streamRes, fileRes, updateRes] = await Promise.all([
    db.from('spaces').select('name').eq('id', project.space_id).maybeSingle(),
    // titles + flags ONLY — never notes/estimate/elapsed/$.
    db.from('tasks').select('id, title, done, completed_at, client_visible, parent_task_id, section_id')
      .eq('project_id', project.id).is('parent_task_id', null).order('sort_order').order('created_at'),
    project.share_files
      ? db.from('pages').select('id, title, content, updated_at, client_visible')
          .eq('project_id', project.id).eq('client_visible', true).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    project.share_invoices ? loadInvoices(db, project.id) : Promise.resolve(null),
    loadApprovals(db, project.id),
    // Errors (table absent until 0020 is applied) degrade to no Forms section.
    loadPortalForms(db, project.id).catch(() => [] as PortalForm[]),
    // Workstreams (0040). Only the marked ones are ever fetched, so an
    // internal stream's NAME never reaches this process, let alone the client.
    db.from('sections').select('id, project_id, name, sort_order, client_visible')
      .eq('project_id', project.id).eq('client_visible', true).order('sort_order'),
    // Files (0039). Same channel as documents, same per-item rule. Only the
    // display columns — never the storage `path`, which the portal has no use
    // for and which is the one field worth guarding.
    project.share_files
      ? db.from('attachments').select('id, filename, size_bytes, mime_type, client_visible')
          .eq('project_id', project.id).eq('client_visible', true).order('created_at')
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // Authored updates (S2). This file used to say activity is "never read, so
    // it cannot leak"; it is read now, and the query itself is the gate —
    // `eq('type', CLIENT_UPDATE)` means a private note is never fetched, so it
    // cannot reach this process, let alone the projection. Only the body and
    // the date are selected.
    project.share_timeline
      ? db.from('project_activity').select('id, type, body, created_at')
          .eq('project_id', project.id).eq('type', CLIENT_UPDATE)
          .order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  const studio = (spaceRes.data as { name: string } | null)?.name?.trim() || 'Studio';
  const tasks = (tasksRes.data as { id: string; title: string; done: boolean; completed_at: string | null; client_visible: boolean; section_id: string | null }[]) ?? [];

  const doneTasks = tasks.filter((t) => t.done);
  const openTasks = tasks.filter((t) => !t.done);

  const progress = project.share_progress
    ? { done: doneTasks.length, total: tasks.length, pct: tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0 }
    : null;

  // ── BOTH GATES, NOT EITHER ────────────────────────────────────────────────
  // This used to read "bucket flag OR per-task override": with
  // `share_completed_tasks` ON, EVERY completed task went to the client and
  // `client_visible` was ignored entirely. So the per-task switch — the whole
  // internal-vs-client-facing distinction — was defeated by the one project
  // switch an agency would obviously turn on, and "share what we finished"
  // silently meant "publish our internal task list".
  //
  // The rule is now `lib/visibility.ts`: the channel must be on AND the item
  // must be marked. Nothing reaches a client that someone did not point at.
  // Migration 0039 backfills `client_visible` for projects that had the bucket
  // flags on, so no portal loses anything it is showing today — after that,
  // new work is internal until you say otherwise.
  const channels = readChannels(project as unknown as Record<string, unknown>);

  // ── WORKSTREAMS (0040) ────────────────────────────────────────────────────
  // A third gate, above the two: a stream the owner kept internal hides
  // everything inside it whatever the individual tasks say. That is what "keep
  // this workstream internal" has to mean — otherwise you would have to also
  // un-mark every task in it, and forgetting one would leak the stream.
  //
  // Tasks belonging to NO stream are unaffected and still flow through the two
  // gates below, so a project that has never used workstreams sees no change.
  // `streamRes` errors when `sections` (0014) or `client_visible` (0040) is
  // absent. Then workstreams are not in play at all and sectioned tasks keep
  // flowing through the flat lists below, exactly as they did before — a
  // missing migration must never silently empty a live portal.
  const streamsSupported = !streamRes.error;
  const streamRows = streamsSupported ? ((streamRes.data as unknown as Workstream[]) ?? []) : [];
  const groups = clientGroups(tasks, streamRows, channels);
  const streams: PortalStream[] | null = groups.length
    ? groups.map((g) => ({
        id: g.stream!.id,
        name: g.stream!.name,
        open: g.tasks.filter((t) => !t.done).map((t) => ({ id: t.id, title: t.title })),
        completed: g.tasks.filter((t) => t.done).map((t) => ({ id: t.id, title: t.title })),
        pct: g.progress.pct,
      }))
    : null;

  // The flat lists now hold only work that belongs to NO workstream. A task
  // inside one is governed entirely by that stream: shown under its heading if
  // the stream is client-facing, and shown nowhere if it is not. Filtering on
  // "is in a VISIBLE stream" instead would have let every task in an internal
  // stream fall straight through into this list — the leak the third gate
  // exists to close.
  const loose = <T extends { section_id?: string | null }>(list: T[]) =>
    (streamsSupported ? list.filter((t) => !t.section_id) : list);
  const completed = clientVisible('task', loose(doneTasks), channels).map((t) => ({ id: t.id, title: t.title }));
  const open = clientVisible('task', loose(openTasks), channels).map((t) => ({ id: t.id, title: t.title }));

  // Timeline is derived ONLY from completed-task titles + dates — and now only
  // from the ones marked for the client. It used to draw on every completed
  // task, which meant the timeline leaked exactly what the list above stopped
  // leaking: a section can't be "always safe" if its source isn't.
  // …and it obeys the stream gate too, for the same reason: an internal
  // workstream whose finished tasks scrolled past in "Recent updates" would be
  // hidden in one section and published in another.
  const inReach = (t: { section_id?: string | null }) =>
    !streamsSupported || !t.section_id || streamRows.some((s) => s.id === t.section_id);
  const timeline = project.share_timeline
    ? clientVisible('task', doneTasks.filter(inReach), { ...channels, completedTasks: true })
        .filter((t) => t.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
        .slice(0, 30)
        .map((t) => ({ at: t.completed_at!, title: t.title }))
    : null;

  const docRows = project.share_files
    ? ((docsRes.data as { id: string; title: string | null; content: unknown; updated_at: string }[]) ?? [])
    : [];
  // One query for every shared doc's signatures, not one per doc.
  const signed = await loadAcceptances(db, docRows.map((d) => d.id)).catch(() => new Map<string, Acceptance[]>());
  const docs = project.share_files
    ? docRows.map((d) => {
        const blocks = toBlocks(d.content);
        const items = docItems(blocks);
        const mine = signed.get(d.id) ?? [];
        return {
          id: d.id, title: d.title?.trim() || 'Untitled', text: docText(d.content, blocks), updated_at: d.updated_at,
          items: items.length ? items : null,
          accepts: blocks.filter((b) => b.type === 'accept').map((b) => ({
            blockId: b.id,
            terms: b.accept ?? {},
            acceptance: mine.find((a) => a.blockId === b.id) ?? null,
          })),
        };
      })
    : null;

  // Files travel through the SAME channel as documents (`share_files`) and the
  // same per-item mark, because a deliverable is a deliverable whether it was
  // written here or uploaded. `null` when the channel is off, so the portal
  // omits the section rather than showing an empty one.
  const fileRows = (!fileRes.error ? ((fileRes.data as unknown as Attachment[]) ?? []) : []);
  const files: PortalFile[] | null = project.share_files
    ? clientVisible('file', fileRows, channels).map((f) => ({
        id: f.id, filename: f.filename, size: f.size_bytes,
        kind: attachmentKind(f.mime_type, f.filename),
      }))
    : null;

  // The query already narrowed to addressed rows; `clientUpdates` is applied
  // anyway so the rule that decides this — not a `.eq()` written out here —
  // is the thing the portal obeys. Belt and braces on the one section whose
  // source is free text somebody typed.
  const updateRows = (!updateRes.error ? ((updateRes.data as unknown as UpdateRow[]) ?? []) : []);
  const updates: PortalUpdate[] | null = project.share_timeline
    ? clientUpdates(updateRows, channels).map((u) => ({ id: u.id, at: u.created_at, body: (u.body ?? '').trim() }))
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
    streams,
    updates,
    timeline,
    docs,
    files,
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
