// The fabric, read side — master plan §3.4.
//
// ONE projection that answers a single question for any entity: "what else in this
// workspace is attached to this?" Every drawer and detail view renders the result
// through <ConnectedPanel>, so the graph looks and behaves identically everywhere
// and a new edge type is added in exactly one file.
//
// THE KEY IDEA: most of the graph already exists. task→project, invoice→client,
// doc→client, time_entry→invoice are ordinary foreign keys that nobody was reading
// back. Those "structural" edges need NO migration and ship today. The `mentions`
// table (0027, drafted) only adds the third kind — the ones a person typed — and is
// gated behind `mentionsSupported()`. Without it the panel is smaller, never broken.
//
// Every source is fetched independently and failures are swallowed per-source (the
// same doctrine as lib/today-data.ts): a Connected panel that renders four of five
// groups is useful; one that throws because `feedback` predates a migration is not.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { formatMoney } from '@/lib/money';
import { formatDay } from '@/lib/date';
import { readContent, STAGE_LABEL } from '@/lib/content';

type DB = SupabaseClient<Database>;

export type EntityType =
  | 'task' | 'project' | 'client' | 'doc' | 'invoice'
  | 'goal' | 'meeting' | 'request' | 'feedback' | 'form'
  // Content joined when it got a record route. PRODUCT_CONTEXT §15: a piece
  // connects to its project, its client and its calendar — and the answer to
  // "what have we made for Acme" lives nowhere else.
  | 'content'
  // Calendar events became addressable when meetings needed somewhere to come
  // FROM (PRODUCT_CONTEXT §14: calendar event → meeting → notes → tasks). §13
  // wants the same thing from the other side: "the calendar should connect time
  // with context", which it cannot do while an event is not a record.
  | 'event'
  // Memory joined at M2 (§7X), and the criterion was the one written below: a
  // type belongs here once it has a RECORD ROUTE. It was deliberately kept out
  // at M1 — with no `/memory` page, `recordHref` could only have returned
  // undefined and the type would have been dead weight in three total maps.
  | 'memory';

export type EntityRef = { type: EntityType; id: string };

export type ConnectedEdge = {
  /** Stable React key — type+id is not unique when the same entity arrives twice by two paths. */
  key: string;
  type: EntityType;
  id: string;
  label: string;
  /** Small trailing note: a status, an amount, a count. Never a sentence. */
  meta?: string;
  /** Deep link, or undefined when the target has no addressable route yet (see recordHref). */
  href?: string;
  /** How an indirect edge got here — "via Acme rebrand". Only set for 2-hop edges. */
  via?: string;
  origin: 'structural' | 'mention';
  /** The sentence an @-mention appeared in, snapshotted at write time. */
  context?: string;
  /** A mention whose target no longer resolves (§7H: "deleting a mentioned doc → tombstones"). */
  tombstone?: boolean;
};

export type ConnectedGroup = { type: EntityType; label: string; items: ConnectedEdge[] };

// Plural group headings, in the order they read best: the containers a thing belongs
// to first, then its parts, then the money, then the softer references.
// `memory` is DELIBERATELY ABSENT — this array is also the filter, so a memory
// edge never renders as a Connected group. A fact is a sentence and this panel's
// rows are references (label · status · chevron); `<MemoryPanel>` owns how facts
// read, and it sits directly above this one on every surface that hosts both.
const GROUP_ORDER: EntityType[] = [
  'project', 'client', 'goal', 'task', 'doc', 'content', 'invoice', 'event', 'meeting', 'request', 'feedback', 'form',
];
const GROUP_LABEL: Record<EntityType, string> = {
  project: 'Projects', client: 'Clients', goal: 'Goals', task: 'Tasks', doc: 'Documents',
  invoice: 'Invoices', meeting: 'Meetings', request: 'Requests', feedback: 'Feedback', form: 'Forms',
  content: 'Content', event: 'Calendar', memory: 'Memory',
};

/**
 * Every entity type, at RUNTIME — derived from the exhaustive record above
 * rather than typed out again. `Record<EntityType, …>` is already a compile
 * error when a member is missing, so its keys cannot drift from the union; a
 * second hand-written list could.
 *
 * Needed wherever a type arrives as a string and has to be checked: a pin read
 * back out of JSON, a search result, a URL param.
 */
export const ENTITY_TYPES = Object.keys(GROUP_LABEL) as EntityType[];

// Deep links (§7J). The ONE place in the app that knows how to address a record,
// so a new route lights up every Connected row of that type at once. Exported
// because search results and the command palette need the same answer.
//
// A row with no href still renders — knowing this task belongs to Acme is worth
// showing — it just isn't dressed as a link it can't honour. Goals, client
// requests and feedback have no record-level route yet; they are the remaining
// §7J work, and each is a one-line addition here once it exists. (Meetings had
// the same gap until the panel moved into the URL — every meeting row the
// meeting→task edges produce was unclickable.)
export function recordHref(type: EntityType, id: string): string | undefined {
  switch (type) {
    case 'task': return `/tasks?task=${id}`;          // drawer, opens over any page
    case 'client': return `/clients?c=${id}`;         // hub selection (useRecordParam)
    case 'doc': return `/documents?page=${id}`;       // read server-side as initialPageId
    case 'invoice': return `/money/${id}`;
    case 'project': return `/projects/${id}`;
    case 'form': return `/forms/${id}`;
    case 'memory': return `/memory?m=${id}`;   // hub selection (useRecordParam)
    case 'content': return `/content?piece=${id}`;
    // The id is enough: Clients resolves the meeting's own client from it, so a
    // link from a task's Connected panel — which knows nothing about the client
    // — still lands on the right page with the right panel open.
    case 'meeting': return `/clients?meeting=${id}`;
    case 'event': return `/calendar?event=${id}`;
    default: return undefined;
  }
}

/**
 * The inverse of `recordHref` — an internal link back into the entity it names.
 *
 * This is what makes an @-mention possible without a new inline node type: a
 * mention IS a link to a record, so anything already linked (a "Copy link" URL
 * pasted into a doc, a crumb dragged in) becomes a real edge in the fabric the
 * moment the document saves. Notion behaves the same way — linking a page is
 * what creates its backlink.
 *
 * Absolute URLs are accepted because that is what `share()` puts on the
 * clipboard (`${origin}/documents?page=…`); anything pointing at another origin
 * is an external link and returns null.
 *
 * KEEP THIS BESIDE `recordHref`. They are one mapping written twice, and a
 * route that changes in one and not the other silently stops producing
 * backlinks — a failure with no error and no visible symptom.
 */
export function parseRecordHref(href: string, origin?: string): EntityRef | null {
  if (!href) return null;
  let path: string;
  let params: URLSearchParams;
  try {
    // A relative href needs a base; the base is discarded unless `href` was
    // absolute, in which case it has to match the app's own origin.
    const base = origin || 'http://internal.invalid';
    const u = new URL(href, base);
    if (origin && u.origin !== new URL(origin).origin) return null;
    if (!origin && u.origin !== 'http://internal.invalid' && !href.startsWith('/')) return null;
    path = u.pathname;
    params = u.searchParams;
  } catch {
    return null;
  }

  const uuid = (v: string | null) => (v && /^[0-9a-f-]{16,}$/i.test(v) ? v : null);
  const seg = path.split('/').filter(Boolean);

  if (path === '/tasks') { const id = uuid(params.get('task')); return id ? { type: 'task', id } : null; }
  if (path === '/clients') {
    // `meeting` is checked FIRST because the client branch returns early: a
    // trailing `/clients?meeting=` case placed after it is unreachable, which
    // is exactly how it was written the first time.
    const meeting = uuid(params.get('meeting'));
    if (meeting) return { type: 'meeting', id: meeting };
    const id = uuid(params.get('c'));
    return id ? { type: 'client', id } : null;
  }
  if (path === '/documents') { const id = uuid(params.get('page')); return id ? { type: 'doc', id } : null; }
  if (seg[0] === 'money' && seg.length === 2) { const id = uuid(seg[1]); return id ? { type: 'invoice', id } : null; }
  if (seg[0] === 'projects' && seg.length === 2) { const id = uuid(seg[1]); return id ? { type: 'project', id } : null; }
  if (seg[0] === 'forms' && seg.length === 2) { const id = uuid(seg[1]); return id ? { type: 'form', id } : null; }
  if (path === '/memory') { const id = uuid(params.get('m')); return id ? { type: 'memory', id } : null; }
  if (path === '/content') { const id = uuid(params.get('piece')); return id ? { type: 'content', id } : null; }
  if (path === '/calendar') { const id = uuid(params.get('event')); return id ? { type: 'event', id } : null; }
  return null;
}

// Run a source query; on any failure return the empty result rather than rejecting.
// Covers both real errors and tables/columns that predate an unapplied migration.
async function safe<T>(run: () => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try {
    const { data } = await run();
    return data ?? [];
  } catch {
    return [];
  }
}
async function safeOne<T>(run: () => PromiseLike<{ data: T | null }>): Promise<T | null> {
  try {
    const { data } = await run();
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Does the `mentions` table (0027) exist? A zero-row probe, the same fetch-time
 * capability pattern used for `deadlineSupported` / `goalsV2Supported`.
 */
export async function mentionsSupported(db: DB): Promise<boolean> {
  try {
    const { error } = await db.from('mentions').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

function edge(
  type: EntityType, id: string, label: string,
  extra: Partial<Omit<ConnectedEdge, 'type' | 'id' | 'label' | 'key'>> = {},
): ConnectedEdge {
  return {
    key: `${extra.origin ?? 'structural'}:${type}:${id}:${extra.via ?? ''}`,
    type, id,
    label: label?.trim() || 'Untitled',
    href: recordHref(type, id),
    origin: 'structural',
    ...extra,
  };
}

const money = (n: number) => formatMoney(n, { exact: true });

// Raw enum values (`in_progress`, `needs_info`) are database vocabulary. The meta
// column is UI copy and the constitution says sentence case, so they get converted
// once here rather than at nine call sites.
export function statusMeta(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "2 Jun" / "2 Jun 2025" — a meta column is four words wide, and a raw ISO date
// there reads as a database leak. The year appears only when it isn't this one.
// This was a hand-written copy of `formatDay`, down to the same drop-the-year-
// inside-this-year rule — but reading the ambient locale, so it disagreed with
// every other date on the page.
const shortDate = (iso: string | null): string | undefined => formatDay(iso);

// ── Structural edges, per source type ──────────────────────────────────────────

// The set of groups a host surface renders itself. Sources consult it so an
// omitted group costs no query, not just no row — the task drawer omits `task`
// and must not pay for a subtasks fetch it will discard.
type Skip = Set<EntityType>;

async function taskEdges(db: DB, id: string, skip: Skip): Promise<ConnectedEdge[]> {
  const task = await safeOne<{
    project_id: string | null; goal_id: string | null; parent_task_id: string | null; request_id: string | null;
  }>(() => db.from('tasks').select('project_id,goal_id,parent_task_id,request_id').eq('id', id).maybeSingle());
  if (!task) return [];

  // `projects` is fetched whenever either the project OR the client group is
  // wanted — the client is reached through it.
  const [project, goal, parent, subtasks, request, fb, entries] = await Promise.all([
    task.project_id && (!skip.has('project') || !skip.has('client'))
      ? safeOne<{ id: string; name: string; status: string; client_id: string | null }>(() =>
          db.from('projects').select('id,name,status,client_id').eq('id', task.project_id!).maybeSingle())
      : null,
    task.goal_id && !skip.has('goal')
      ? safeOne<{ id: string; title: string; horizon: string }>(() =>
          db.from('goals').select('id,title,horizon').eq('id', task.goal_id!).maybeSingle())
      : null,
    task.parent_task_id && !skip.has('task')
      ? safeOne<{ id: string; title: string; done: boolean }>(() =>
          db.from('tasks').select('id,title,done').eq('id', task.parent_task_id!).maybeSingle())
      : null,
    skip.has('task') ? [] : safe<{ id: string; title: string; done: boolean }>(() =>
      db.from('tasks').select('id,title,done').eq('parent_task_id', id).order('sort_order')),
    task.request_id && !skip.has('request')
      ? safeOne<{ id: string; title: string | null; body: string; status: string }>(() =>
          db.from('client_requests').select('id,title,body,status').eq('id', task.request_id!).maybeSingle())
      : null,
    skip.has('feedback') ? [] : safe<{ id: string; title: string; status: string }>(() =>
      db.from('feedback').select('id,title,status').eq('task_id', id)),
    skip.has('invoice') ? [] : safe<{ invoiced_invoice_id: string | null }>(() =>
      db.from('time_entries').select('invoiced_invoice_id').eq('task_id', id).not('invoiced_invoice_id', 'is', null)),
  ]);

  const out: ConnectedEdge[] = [];
  // `project` may have been fetched only to reach the client, so guard the push
  // as well as the query.
  if (project && !skip.has('project')) out.push(edge('project', project.id, project.name, { meta: statusMeta(project.status) }));
  if (goal) out.push(edge('goal', goal.id, goal.title, { meta: statusMeta(goal.horizon) }));
  if (parent) out.push(edge('task', parent.id, parent.title, { meta: 'Parent' }));
  for (const s of subtasks) out.push(edge('task', s.id, s.title, { meta: s.done ? 'Done' : undefined }));
  if (request) out.push(edge('request', request.id, request.title || request.body, { meta: statusMeta(request.status) }));
  for (const f of fb) out.push(edge('feedback', f.id, f.title, { meta: statusMeta(f.status) }));

  // The client is two hops away (task → project → client) and worth the extra read:
  // "who is this actually for" is the question a task page can never answer alone.
  if (project?.client_id && !skip.has('client')) {
    const client = await safeOne<{ id: string; name: string }>(() =>
      db.from('clients').select('id,name').eq('id', project.client_id!).maybeSingle());
    if (client) out.push(edge('client', client.id, client.name, { via: project.name }));
  }

  // Billed time is the only path from a task to an invoice, and it is the one that
  // answers "did I ever get paid for this?".
  const invoiceIds = [...new Set(entries.map((e) => e.invoiced_invoice_id).filter(Boolean) as string[])];
  if (invoiceIds.length) {
    const invoices = await safe<{ id: string; number: string; status: string }>(() =>
      db.from('invoices').select('id,number,status').in('id', invoiceIds));
    for (const i of invoices) out.push(edge('invoice', i.id, i.number, { meta: statusMeta(i.status), via: 'billed time' }));
  }
  return out;
}

async function clientEdges(db: DB, id: string, skip: Skip): Promise<ConnectedEdge[]> {
  // The client page omits four groups it renders itself, so this used to fetch
  // four result sets and throw them away. Each source is now gated on actually
  // being wanted — six requests become two on that surface.
  //
  // `projects` is the exception: it is also how the task rows learn their `via`
  // project name, so it is fetched whenever EITHER group is wanted.
  const needProjects = !skip.has('project') || !skip.has('task');

  const [projects, invoices, docs, meetings, fb, forms, content] = await Promise.all([
    needProjects ? safe<{ id: string; name: string; status: string }>(() =>
      db.from('projects').select('id,name,status').eq('client_id', id).order('created_at', { ascending: false })) : [],
    skip.has('invoice') ? [] : safe<{ id: string; number: string; status: string }>(() =>
      db.from('invoices').select('id,number,status').eq('client_id', id).order('created_at', { ascending: false })),
    skip.has('doc') ? [] : safe<{ id: string; title: string | null }>(() =>
      // `neq('type','content')`: a content piece is a page, and without this it
      // arrives in the client's DOCUMENTS group — the same object filed under a
      // heading that is not its own. It gets its own group below.
      db.from('pages').select('id,title').eq('client_id', id).neq('type', 'content').is('archived_at', null).order('updated_at', { ascending: false })),
    skip.has('meeting') ? [] : safe<{ id: string; title: string; met_at: string }>(() =>
      db.from('meetings').select('id,title,met_at').eq('client_id', id).order('met_at', { ascending: false })),
    skip.has('feedback') ? [] : safe<{ id: string; title: string; status: string }>(() =>
      db.from('feedback').select('id,title,status').eq('client_id', id)),
    skip.has('form') ? [] : safe<{ id: string; title: string; status: string }>(() =>
      db.from('forms').select('id,title,status').eq('client_id', id)),
    // "What have we made for Acme" — an answer that lived nowhere before.
    skip.has('content') ? [] : safe<{ id: string; title: string | null; content: unknown }>(() =>
      db.from('pages').select('id,title,content').eq('client_id', id).eq('type', 'content').is('archived_at', null).order('updated_at', { ascending: false })),
  ]);

  const out: ConnectedEdge[] = [];
  for (const p of projects) out.push(edge('project', p.id, p.name, { meta: statusMeta(p.status) }));
  for (const i of invoices) out.push(edge('invoice', i.id, i.number, { meta: statusMeta(i.status) }));
  for (const d of docs) out.push(edge('doc', d.id, d.title ?? 'Untitled'));
  for (const m of meetings) out.push(edge('meeting', m.id, m.title, { meta: shortDate(m.met_at) }));
  for (const f of fb) out.push(edge('feedback', f.id, f.title, { meta: statusMeta(f.status) }));
  for (const f of forms) out.push(edge('form', f.id, f.title, { meta: statusMeta(f.status) }));
  for (const c of content) out.push(edge('content', c.id, c.title ?? 'Untitled', { meta: STAGE_LABEL[readContent(c.content).stage] }));

  // Open work across every project for this client — the "what am I on the hook
  // for" line. Capped: a Connected panel is a map, not a task list.
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length && !skip.has('task')) {
    const tasks = await safe<{ id: string; title: string; project_id: string | null }>(() =>
      db.from('tasks').select('id,title,project_id').in('project_id', projectIds)
        .eq('done', false).is('parent_task_id', null).order('sort_order').limit(8));
    const nameOf = new Map(projects.map((p) => [p.id, p.name]));
    for (const t of tasks) {
      out.push(edge('task', t.id, t.title, { via: t.project_id ? nameOf.get(t.project_id) : undefined }));
    }
  }
  return out;
}

async function docEdges(db: DB, id: string, skip: Skip): Promise<ConnectedEdge[]> {
  const doc = await safeOne<{ project_id: string | null; client_id: string | null; parent_id: string | null }>(() =>
    db.from('pages').select('project_id,client_id,parent_id').eq('id', id).maybeSingle());
  if (!doc) return [];

  const [project, client, parent, children] = await Promise.all([
    doc.project_id && !skip.has('project')
      ? safeOne<{ id: string; name: string; status: string }>(() =>
          db.from('projects').select('id,name,status').eq('id', doc.project_id!).maybeSingle())
      : null,
    doc.client_id && !skip.has('client')
      ? safeOne<{ id: string; name: string }>(() =>
          db.from('clients').select('id,name').eq('id', doc.client_id!).maybeSingle())
      : null,
    doc.parent_id && !skip.has('doc')
      ? safeOne<{ id: string; title: string | null }>(() =>
          db.from('pages').select('id,title').eq('id', doc.parent_id!).maybeSingle())
      : null,
    skip.has('doc') ? [] : safe<{ id: string; title: string | null }>(() =>
      db.from('pages').select('id,title').eq('parent_id', id).is('archived_at', null).order('sort_index')),
  ]);

  const out: ConnectedEdge[] = [];
  if (project) out.push(edge('project', project.id, project.name, { meta: statusMeta(project.status) }));
  if (client) out.push(edge('client', client.id, client.name));
  if (parent) out.push(edge('doc', parent.id, parent.title ?? 'Untitled', { meta: 'Parent' }));
  for (const c of children) out.push(edge('doc', c.id, c.title ?? 'Untitled'));
  return out;
}

async function invoiceEdges(db: DB, id: string, skip: Skip): Promise<ConnectedEdge[]> {
  const inv = await safeOne<{ client_id: string | null; project_id: string | null }>(() =>
    db.from('invoices').select('client_id,project_id').eq('id', id).maybeSingle());
  if (!inv) return [];

  const [client, project, entries] = await Promise.all([
    inv.client_id && !skip.has('client')
      ? safeOne<{ id: string; name: string }>(() =>
          db.from('clients').select('id,name').eq('id', inv.client_id!).maybeSingle())
      : null,
    inv.project_id && !skip.has('project')
      ? safeOne<{ id: string; name: string; status: string }>(() =>
          db.from('projects').select('id,name,status').eq('id', inv.project_id!).maybeSingle())
      : null,
    skip.has('task') ? [] : safe<{ task_id: string | null; minutes: number | null }>(() =>
      db.from('time_entries').select('task_id,minutes').eq('invoiced_invoice_id', id).not('task_id', 'is', null)),
  ]);

  const out: ConnectedEdge[] = [];
  if (client) out.push(edge('client', client.id, client.name));
  if (project) out.push(edge('project', project.id, project.name, { meta: statusMeta(project.status) }));

  // Which work this invoice actually bills. Minutes are summed per task so the
  // same task billed across three sessions reads as one line.
  const byTask = new Map<string, number>();
  for (const e of entries) {
    if (e.task_id) byTask.set(e.task_id, (byTask.get(e.task_id) ?? 0) + (e.minutes ?? 0));
  }
  if (byTask.size) {
    const tasks = await safe<{ id: string; title: string }>(() =>
      db.from('tasks').select('id,title').in('id', [...byTask.keys()]));
    for (const t of tasks) {
      const mins = byTask.get(t.id) ?? 0;
      out.push(edge('task', t.id, t.title, {
        meta: mins ? `${Math.round((mins / 60) * 10) / 10}h` : undefined,
        via: 'billed time',
      }));
    }
  }

  const payments = await safe<{ id: string; amount: number; paid_on: string }>(() =>
    db.from('payments').select('id,amount,paid_on').eq('invoice_id', id).order('paid_on', { ascending: false }));
  if (payments.length) {
    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    // Payments have no page of their own — surfaced as one summary line on the
    // invoice group rather than N rows that go nowhere.
    out.push(edge('invoice', id, `${payments.length} payment${payments.length === 1 ? '' : 's'}`, {
      meta: money(total), via: 'received',
    }));
  }
  return out;
}

// ── Mention edges (0027; absent until the migration lands) ─────────────────────

type MentionRow = {
  id: string; source_type: string; source_id: string;
  target_type: string; target_id: string; context: string | null;
};

/**
 * Resolve a batch of polymorphic refs to display labels.
 *
 * Anything that doesn't come back is a TOMBSTONE: the reference is kept and
 * shown struck-through rather than vanishing, because a link that silently
 * disappears reads as a bug rather than as a deleted target. That rule belongs
 * to every surface rendering a reference, which is why this is exported — the
 * relation property resolves its chips through this call rather than growing a
 * second, differently-behaved copy of "what is this id called".
 *
 * Keyed `type:id`, one query per type, ids de-duplicated.
 */
export async function resolveRefs(db: DB, refs: EntityRef[]): Promise<Map<string, string>> {
  const found = await resolveSummaries(db, refs);
  return new Map([...found].map(([key, s]) => [key, s.label]));
}

/** What a reference IS, in the two lines a card or a chip can show. */
export type RecordSummary = {
  type: EntityType;
  id: string;
  label: string;
  /** Small trailing note: a status, a date, an amount. Never a sentence. */
  meta?: string;
};

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/**
 * Where each entity's label and second line come from.
 *
 * `extra` names the columns `meta` needs. Every one of them is copied from a
 * select that already ships elsewhere in the app rather than guessed, because a
 * column that does not exist fails the whole query — and `safe()` swallows it,
 * so the symptom would be every reference of that type rendering as a
 * TOMBSTONE. The fallback below makes that degrade instead of lie.
 */
const SOURCES: Partial<Record<EntityType, {
  table: string; label: string; extra?: string; meta?: (row: Row) => string | undefined;
}>> = {
  task: {
    table: 'tasks', label: 'title', extra: 'done,scheduled_date',
    meta: (r) => (r.done ? 'Done' : formatDay(str(r.scheduled_date))),
  },
  project: { table: 'projects', label: 'name', extra: 'status', meta: (r) => statusMeta(str(r.status)) },
  client: { table: 'clients', label: 'name', extra: 'status', meta: (r) => statusMeta(str(r.status)) },
  doc: {
    table: 'pages', label: 'title', extra: 'updated_at',
    meta: (r) => { const d = formatDay(str(r.updated_at)); return d ? `Edited ${d}` : undefined; },
  },
  invoice: { table: 'invoices', label: 'number', extra: 'status', meta: (r) => statusMeta(str(r.status)) },
  goal: { table: 'goals', label: 'title', extra: 'horizon', meta: (r) => statusMeta(str(r.horizon)) },
  meeting: { table: 'meetings', label: 'title', extra: 'met_at', meta: (r) => formatDay(str(r.met_at)) },
  event: { table: 'calendar_events', label: 'title', extra: 'starts_at', meta: (r) => formatDay(str(r.starts_at)) },
  // A content piece is a `pages` row; its meta is the stage, which is inside the
  // content JSON — so it is read through the one projection that knows how.
  content: {
    table: 'pages', label: 'title', extra: 'content',
    meta: (r) => STAGE_LABEL[readContent(r.content).stage],
  },
  form: { table: 'forms', label: 'title', extra: 'status', meta: (r) => statusMeta(str(r.status)) },
  feedback: { table: 'feedback', label: 'title', extra: 'status', meta: (r) => statusMeta(str(r.status)) },
  // A memory's "label" is its whole body — the fact IS the name. `kind` is the
  // second line, which is why the row's meta reads "Preference" rather than a
  // date: what matters about a recalled fact is what kind of thing it claims.
  memory: { table: 'memories', label: 'body', extra: 'kind', meta: (r) => statusMeta(str(r.kind)) },
};

/**
 * Resolve a batch of refs to what they ARE — the label plus one line of context.
 *
 * The richer half of `resolveRefs`, which is now a projection of this so the app
 * never grows a second answer to "what is this id". Same contract otherwise:
 * keyed `type:id`, one query per type, ids de-duplicated, and anything missing
 * is a tombstone the caller keeps and strikes through.
 *
 * If the enriched select fails, it retries with the label alone. That is not
 * defensive noise: the extra columns are the only new way this can fail, and
 * without the retry a single wrong column name would turn every reference of
 * that type into a tombstone — a silent, total failure with no error anywhere.
 */
export async function resolveSummaries(db: DB, refs: EntityRef[]): Promise<Map<string, RecordSummary>> {
  const byType = new Map<EntityType, string[]>();
  for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);

  const found = new Map<string, RecordSummary>();
  await Promise.all([...byType].map(async ([type, ids]) => {
    const src = SOURCES[type];
    if (!src) return;
    const unique = [...new Set(ids)];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = (cols: string) => (db.from(src.table as any) as any).select(cols).in('id', unique);

    let rows = await safe<Row>(() => query(`id,${src.label}${src.extra ? `,${src.extra}` : ''}`));
    let enriched = true;
    if (!rows.length && src.extra) {
      rows = await safe<Row>(() => query(`id,${src.label}`));
      enriched = false;
    }
    for (const row of rows) {
      const id = row.id as string;
      found.set(`${type}:${id}`, {
        type, id,
        // `|| 'Untitled'`, not `?? 'Untitled'`. A row with an empty title is not
        // a row without a title column: `str()` hands back `''`, which `??` sails
        // straight past — and the caller then renders a blank label. It surfaced
        // as an unnamed group heading on /memory, but the same empty string was
        // reaching every mention edge and relation chip in the app.
        label: str(row[src.label])?.trim() || 'Untitled',
        meta: enriched ? src.meta?.(row) : undefined,
      });
    }
  }));
  return found;
}

async function mentionEdges(db: DB, self: EntityRef): Promise<ConnectedEdge[]> {
  const [outgoing, incoming] = await Promise.all([
    safe<MentionRow>(() => db.from('mentions')
      .select('id,source_type,source_id,target_type,target_id,context')
      .eq('source_type', self.type).eq('source_id', self.id)),
    safe<MentionRow>(() => db.from('mentions')
      .select('id,source_type,source_id,target_type,target_id,context')
      .eq('target_type', self.type).eq('target_id', self.id)),
  ]);

  const refs: EntityRef[] = [
    ...outgoing.map((m) => ({ type: m.target_type as EntityType, id: m.target_id })),
    ...incoming.map((m) => ({ type: m.source_type as EntityType, id: m.source_id })),
  ];
  if (!refs.length) return [];
  // Summaries, not just labels: a mentioned task showed its name while a
  // structurally-linked one beside it showed "Done" — the same row, described
  // two different ways depending on how it got into the panel. Costs nothing
  // extra; it is the same query with more columns.
  const found = await resolveSummaries(db, refs);

  const toEdge = (type: EntityType, id: string, context: string | null, mentionId: string): ConnectedEdge => {
    const summary = found.get(`${type}:${id}`);
    return {
      key: `mention:${mentionId}`,
      type, id,
      label: summary?.label ?? 'Deleted',
      meta: summary?.meta,
      href: summary ? recordHref(type, id) : undefined,
      origin: 'mention',
      context: context ?? undefined,
      tombstone: !summary,
    };
  };

  return [
    ...outgoing.map((m) => toEdge(m.target_type as EntityType, m.target_id, m.context, m.id)),
    ...incoming.map((m) => toEdge(m.source_type as EntityType, m.source_id, m.context, m.id)),
  ];
}

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Every edge touching `self`, grouped by the type of the thing on the other end.
 * Structural edges always; mention edges only where 0027 has been applied.
 * Never throws — a source that fails contributes nothing.
 */
export async function loadConnected(
  db: DB,
  self: EntityRef,
  opts: { mentions?: boolean; omit?: EntityType[] } = {},
): Promise<ConnectedGroup[]> {
  const skip: Skip = new Set(opts.omit ?? []);
  const structural =
    self.type === 'task' ? taskEdges(db, self.id, skip)
      : self.type === 'client' ? clientEdges(db, self.id, skip)
        // A content piece IS a page, so its project/client edges are exactly
        // what `docEdges` already reads. A second builder would be the same
        // three columns queried twice and drifting apart.
        : self.type === 'doc' || self.type === 'content' ? docEdges(db, self.id, skip)
          : self.type === 'invoice' ? invoiceEdges(db, self.id, skip)
            : Promise.resolve<ConnectedEdge[]>([]);

  const [structuralEdges, mentioned] = await Promise.all([
    structural,
    opts.mentions ? mentionEdges(db, self) : Promise.resolve<ConnectedEdge[]>([]),
  ]);

  return groupEdges([...structuralEdges, ...mentioned], self, opts.omit);
}

/**
 * Group, de-duplicate and order edges. Exported for tests — the grouping rules are
 * the part worth pinning down, and they need no database to exercise.
 *
 * `omit` drops whole groups the host surface already renders itself. The task
 * drawer lists subtasks in its own section and the parent in its breadcrumb, so
 * repeating them under Connected is noise, not fabric.
 */
export function groupEdges(
  edges: ConnectedEdge[], self?: EntityRef, omit?: EntityType[],
): ConnectedGroup[] {
  const seen = new Set<string>();
  const byType = new Map<EntityType, ConnectedEdge[]>();
  const skip = new Set(omit ?? []);

  for (const e of edges) {
    if (skip.has(e.type)) continue;
    // An entity is never connected to itself, and the same target reached by two
    // paths (a structural FK and an @-mention of the same thing) is one row —
    // structural wins because it carries the richer meta.
    if (self && e.type === self.type && e.id === self.id && e.origin === 'mention') continue;
    const identity = `${e.type}:${e.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    byType.set(e.type, [...(byType.get(e.type) ?? []), e]);
  }

  return GROUP_ORDER
    .filter((t) => byType.get(t)?.length)
    .map((t) => ({ type: t, label: GROUP_LABEL[t], items: byType.get(t)! }));
}

export function edgeCount(groups: ConnectedGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
