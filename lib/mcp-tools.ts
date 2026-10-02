// The MCP tools themselves — what each one reads and writes.
//
// Split out of `app/api/mcp/route.ts`, which keeps the transport and the
// token check, for one reason: the first version of these tools shipped with
// three bugs no test could see, because a route handler that builds its own
// service client cannot be run without a database. Every function here takes
// the client as an argument instead, so each rule below is asserted against a
// fake that records exactly what was asked for.
//
// THE SERVICE ROLE HAS NO RLS. Every read and every write below scopes itself
// to `ctx.userId` explicitly — that line is the security model, not a style.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { captureKind, searchLimit, splitThought } from '@/lib/mcp';
import { intakeTask } from '@/lib/task-intake';
import { inboxCapture } from '@/lib/content';
import { isDocumentPage } from '@/lib/page-kinds';
import { recordHref, type EntityType } from '@/lib/connected';
import { loadDigest } from '@/lib/digest-data';
import { digestBlocks } from '@/lib/digest';
import { todayISO, formatDay } from '@/lib/date';

type DB = SupabaseClient<Database>;

/** Everything a tool needs to know about who is asking. */
export type McpContext = {
  db: DB;
  /** The token's owner. The only user any query may touch. */
  userId: string;
  /** Their zone, via `readTimeZone` — the worker's own clock is UTC. */
  tz: string;
  /** `profiles.preferences`, for work hours. */
  preferences: unknown;
  /** The app's origin, for links the model can hand back. */
  origin: string;
};

/**
 * Where new rows land.
 *
 * `activeSpaceId` cannot be reused: it reads the space choice from a COOKIE,
 * and an MCP client has none. So this mirrors that helper's documented
 * fallback — the first space by `sort_order`, creating a default one if the
 * account has none — which is the same answer the app gives a fresh session.
 * Sorting by `created_at` instead would pick a different space for anyone who
 * has reordered theirs, and a capture would quietly land in the wrong place.
 */
async function spaceOf(ctx: McpContext): Promise<string> {
  const { data } = await ctx.db
    .from('spaces').select('id').eq('user_id', ctx.userId)
    .order('sort_order', { ascending: true }).limit(1).maybeSingle();
  const existing = (data as { id: string } | null)?.id;
  if (existing) return existing;
  const { data: made } = await ctx.db
    .from('spaces').insert({ user_id: ctx.userId, name: 'Personal' }).select('id').single();
  return (made as { id: string }).id;
}

const link = (ctx: McpContext, type: EntityType, id: string) => `${ctx.origin}${recordHref(type, id) ?? ''}`;

// ── capture ─────────────────────────────────────────────────────────────────

export async function capture(ctx: McpContext, args: Record<string, unknown>): Promise<string> {
  const { title, body } = splitThought(String(args.text ?? ''));
  if (!title) return 'Nothing to save. Give it a line of text.';
  const url = typeof args.url === 'string' && args.url.trim() ? args.url.trim() : undefined;
  const spaceId = await spaceOf(ctx);
  const kept = body ? ' The full text is kept with it.' : '';

  if (captureKind(args.kind) === 'idea') {
    // `inboxCapture` is the rule the app's own capture uses: no stage claim,
    // `bucket: 'inbox'` — a thought caught from a chat is not a commitment.
    const { data, error } = await ctx.db.from('pages')
      .insert(inboxCapture({ userId: ctx.userId, spaceId, title, sourceUrl: url, note: body ?? undefined }))
      .select('id').single();
    if (error || !data) return `Could not save that: ${error?.message ?? 'no row came back'}`;
    return `Saved to your Content inbox: “${title}”.${kept}\n${link(ctx, 'content', (data as { id: string }).id)}`;
  }

  // THE INTAKE RULE, not a hand-built row. The first version inserted a task
  // with no project and `is_inbox` left at its default of false — which is in
  // NO pile (lib/task-scopes.ts): it existed, the tool said "added to your
  // inbox", and it appeared nowhere in the app. `intakeTask` makes "a project
  // or the Inbox, never neither" impossible to get wrong.
  //
  // And nothing else: no date, no priority, no `status`. Everything a chat
  // could infer here is a guess, and a guessed due date is worse than none — it
  // puts work on a day nobody chose and then nags about it.
  const notes = [body, url].filter(Boolean).join('\n\n') || null;
  const { data, error } = await ctx.db.from('tasks')
    .insert({
      ...intakeTask({ userId: ctx.userId, spaceId, projectId: null, title, fallbackTitle: 'Captured thought' }),
      notes,
    })
    .select('id').single();
  if (error || !data) return `Could not save that: ${error?.message ?? 'no row came back'}`;
  return `Added to your Inbox: “${title}”.${kept}\n${link(ctx, 'task', (data as { id: string }).id)}`;
}

// ── today ───────────────────────────────────────────────────────────────────

/**
 * The same day the morning digest describes — one loader, one renderer — with
 * the meetings included, because a model answering "what am I doing today" has
 * no calendar open beside it.
 */
export async function today(ctx: McpContext): Promise<string> {
  const day = todayISO(ctx.tz);
  const input = await loadDigest(ctx.db, { userId: ctx.userId, today: day, tz: ctx.tz, preferences: ctx.preferences });
  const blocks = digestBlocks(input, ctx.origin, { meetings: true });
  // The date and zone lead, so the model never has to guess which "today" this
  // is — the user may be asking at 01:00, or from another city.
  const head = `${formatDay(day, { weekday: 'long', long: true, year: true })} (${ctx.tz})`;
  return blocks.length
    ? `${head}\n\n${blocks.join('\n\n')}`
    : `${head}\n\nNothing planned for today, nothing overdue, and nothing new from clients.`;
}

// ── search ──────────────────────────────────────────────────────────────────

export async function search(ctx: McpContext, args: Record<string, unknown>): Promise<string> {
  const q = String(args.query ?? '').trim();
  if (!q) return 'Give it something to look for.';
  const limit = searchLimit(args.limit);
  // PostgREST `ilike` needs its own wildcards, and a user's `%` or `_` would
  // otherwise widen their own search silently.
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const { db, userId } = ctx;

  const [tasks, projects, clients, pages] = await Promise.all([
    // `done`, not `status` — the list writes `done`; `status` is the Board's,
    // null on most rows, so a ticked task used to come back looking open.
    // Open work first: it is what a question about "that task" usually means.
    db.from('tasks').select('id, title, done').eq('user_id', userId).ilike('title', like)
      .order('done', { ascending: true }).limit(limit),
    db.from('projects').select('id, name, status').eq('user_id', userId).ilike('name', like).limit(limit),
    db.from('clients').select('id, name').eq('user_id', userId).ilike('name', like).limit(limit),
    // Archived pages are the trash. Search is not a way back into it.
    db.from('pages').select('id, title, type').eq('user_id', userId).is('archived_at', null)
      .ilike('title', like).limit(limit),
  ]);

  const out: string[] = [];
  const group = <R,>(label: string, rows: R[], line: (r: R) => string) => {
    if (rows.length) out.push(`${label} (${rows.length})\n${rows.map(line).join('\n')}`);
  };
  type TaskRow = { id: string; title: string; done: boolean };
  type ProjectRow = { id: string; name: string; status: string | null };
  type PageRow = { id: string; title: string | null; type: string | null };
  const pageRows = (pages.data ?? []) as PageRow[];

  group('Tasks', (tasks.data ?? []) as TaskRow[], (t) =>
    `• ${t.title}${t.done ? ' (done)' : ''}\n  ${link(ctx, 'task', t.id)}`);
  group('Projects', (projects.data ?? []) as ProjectRow[], (p) =>
    `• ${p.name}${statusNote(p.status)}\n  ${link(ctx, 'project', p.id)}`);
  group('Clients', (clients.data ?? []) as { id: string; name: string }[], (c) =>
    `• ${c.name}\n  ${link(ctx, 'client', c.id)}`);
  // `isDocumentPage` is the one rule for which module owns a pages row, so a
  // content piece is reported — and linked — as content, not as a stray doc.
  group('Documents', pageRows.filter((p) => isDocumentPage(p.type)), (p) =>
    `• ${p.title?.trim() || 'Untitled'}\n  ${link(ctx, 'doc', p.id)}`);
  group('Content', pageRows.filter((p) => !isDocumentPage(p.type)), (p) =>
    `• ${p.title?.trim() || 'Untitled'}\n  ${link(ctx, 'content', p.id)}`);

  return out.length ? out.join('\n\n') : `Nothing matching “${q}”.`;
}

// ── list_projects ───────────────────────────────────────────────────────────

export async function listProjects(ctx: McpContext): Promise<string> {
  const { data } = await ctx.db
    .from('projects')
    .select('id, name, status, clients(name)')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as { id: string; name: string; status: string | null; clients: { name: string } | null }[];
  if (!rows.length) return 'No projects yet.';
  return rows
    .map((p) => `• ${p.name}${statusNote(p.status)}${p.clients?.name ? ` · ${p.clients.name}` : ''}\n  ${link(ctx, 'project', p.id)}`)
    .join('\n');
}

/**
 * A project's status, only when it says something. "Active" is the default —
 * the same rule the project header follows: a row states facts, not defaults.
 */
const statusNote = (status: string | null) => (status && status !== 'active' ? ` · ${status}` : '');

// ── dispatch ────────────────────────────────────────────────────────────────

export async function runTool(ctx: McpContext, name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'capture': return capture(ctx, args);
    case 'today': return today(ctx);
    case 'search': return search(ctx, args);
    case 'list_projects': return listProjects(ctx);
    default: return `Unknown tool: ${name}`;
  }
}
