'use server';
// ── CHAT: THE SERVER ACTIONS ────────────────────────────────────────────────
//
// Two sides, two doors. See CHAT_PLAN.md for why.
//
//   · The OWNER comes through the session. Every read and write is under RLS (0043's policies,
//     resolved through the message's project), so an owner can only ever touch their own projects —
//     and the database, not this file, refuses a `client`-authored insert from them.
//   · The CLIENT comes through the portal token. There is NO RLS policy for them at all: every call
//     re-resolves the token (unknown, short, or portal disabled ⇒ nothing), then acts on the
//     service role, scoped to that one project, and can only ever author as `client`.
//
// Every action RETURNS `{ error }` rather than throwing (house rule), so a caller can say what went
// wrong and keep what the person typed.

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { normalizeBody, toMessage, type ChatMessage } from '@/lib/chat';

type DB = Awaited<ReturnType<typeof createClient>>;

const COLS = 'id,project_id,author,author_name,body,created_at,edited_at,deleted_at';
/** How much history a channel opens with. Older pages are C2. */
const PAGE = 200;
/**
 * A leaked portal link must not become a way to flood someone's channel. A person typing sends a
 * handful of messages a minute; this is several times that, and still a wall to a script.
 */
const CLIENT_BURST_PER_MINUTE = 20;

const NOT_READY = { error: 'Messages need migration 0043.' } as const;

/** Is migration 0043 applied? A zero-row probe — the house capability pattern. */
export async function chatSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? (await createClient());
    const { error } = await supabase.from('project_messages').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

export type ChannelView = {
  messages: ChatMessage[];
  lastReadAt: string | null;
  names: { team: string; client: string };
};

type Row = {
  id: string; project_id: string; author: string; author_name: string | null; body: string;
  created_at: string; edited_at: string | null; deleted_at: string | null;
};

// ── THE OWNER ──────────────────────────────────────────────────────────────

async function ownerName(db: DB, userId: string): Promise<string> {
  const { data } = await db.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  return ((data as { full_name: string | null } | null)?.full_name ?? '').trim() || 'You';
}

/** One channel's history, oldest first, and where the owner has read up to. */
export async function loadChannel(projectId: string): Promise<{ error: string } | ChannelView> {
  const { supabase, user } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY;

  const { data: project } = await supabase.from('projects').select('id,client_id').eq('id', projectId).maybeSingle();
  if (!project) return { error: 'That conversation is not available.' };
  const p = project as { id: string; client_id: string | null };

  const [msgs, read, client, team] = await Promise.all([
    supabase.from('project_messages').select(COLS).eq('project_id', projectId).order('created_at', { ascending: false }).limit(PAGE),
    supabase.from('project_message_reads').select('last_read_at').eq('project_id', projectId).eq('reader', 'team').maybeSingle(),
    p.client_id ? supabase.from('clients').select('name').eq('id', p.client_id).maybeSingle() : Promise.resolve({ data: null }),
    ownerName(supabase, user.id),
  ]);
  if (msgs.error) return { error: 'Could not load this conversation.' };

  const names = { team, client: ((client.data as { name: string } | null)?.name ?? '').trim() || 'Client' };
  return {
    messages: (msgs.data as Row[]).reverse().map((r) => toMessage(r, names)),
    lastReadAt: (read.data as { last_read_at: string } | null)?.last_read_at ?? null,
    names,
  };
}

/** Post as the team. RLS refuses anything else; the body is checked here first so the error is kind. */
export async function sendMessage(projectId: string, raw: string): Promise<{ error: string } | { message: ChatMessage }> {
  const checked = normalizeBody(raw);
  if (!checked.ok) return { error: checked.error };
  const { supabase, user } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY;

  const name = await ownerName(supabase, user.id);
  const { data, error } = await supabase
    .from('project_messages')
    .insert({ project_id: projectId, author: 'team', author_name: name, body: checked.body })
    .select(COLS).single();
  if (error || !data) return { error: 'Could not send. Your message is still here.' };
  return { message: toMessage(data as Row, { team: name, client: 'Client' }) };
}

/** The owner has seen everything up to now. */
export async function markChannelRead(projectId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY;
  const { error } = await supabase
    .from('project_message_reads')
    .upsert({ project_id: projectId, reader: 'team', last_read_at: new Date().toISOString() });
  return error ? { error: 'Could not mark this conversation read.' } : { ok: true };
}

// ── THE CLIENT ─────────────────────────────────────────────────────────────

/**
 * The gate every client call shares. NOT exported: in a 'use server' file every exported async
 * function is a callable action, and this one hands back a service-role client.
 *
 * The rules are `loadPortalByToken`'s: a short or unknown token, or a portal the owner switched
 * off, resolves to nothing — so turning the portal off ends the client's access to the chat in the
 * same instant it ends their access to everything else.
 */
async function resolvePortal(token: string) {
  if (typeof token !== 'string' || token.length < 8) return null;
  const svc = createServiceClient() as unknown as DB;
  const { data } = await svc
    .from('projects').select('id,user_id,client_id,portal_enabled').eq('portal_token', token).maybeSingle();
  const p = data as { id: string; user_id: string; client_id: string | null; portal_enabled: boolean } | null;
  if (!p || !p.portal_enabled) return null;
  if (!(await chatSupported(svc))) return null;
  const [client, team] = await Promise.all([
    p.client_id ? svc.from('clients').select('name').eq('id', p.client_id).maybeSingle() : Promise.resolve({ data: null }),
    ownerName(svc, p.user_id),
  ]);
  const names = { team, client: ((client.data as { name: string } | null)?.name ?? '').trim() || 'Client' };
  return { svc, projectId: p.id, names };
}

const GONE = { error: 'This conversation is not available.' } as const;

/** The client's view of their project's channel: the same history, read from their side. */
export async function portalLoadChat(token: string): Promise<{ error: string } | ChannelView> {
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  const [msgs, read] = await Promise.all([
    portal.svc.from('project_messages').select(COLS).eq('project_id', portal.projectId).order('created_at', { ascending: false }).limit(PAGE),
    portal.svc.from('project_message_reads').select('last_read_at').eq('project_id', portal.projectId).eq('reader', 'client').maybeSingle(),
  ]);
  if (msgs.error) return { error: 'Could not load the conversation.' };
  return {
    messages: (msgs.data as Row[]).reverse().map((r) => toMessage(r, portal.names)),
    lastReadAt: (read.data as { last_read_at: string } | null)?.last_read_at ?? null,
    names: portal.names,
  };
}

/** Post as the client — and only ever as the client, whatever the caller sends. */
export async function portalSendMessage(token: string, raw: string): Promise<{ error: string } | { message: ChatMessage }> {
  const checked = normalizeBody(raw);
  if (!checked.ok) return { error: checked.error };
  const portal = await resolvePortal(token);
  if (!portal) return GONE;

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await portal.svc
    .from('project_messages').select('id', { count: 'exact', head: true })
    .eq('project_id', portal.projectId).eq('author', 'client').gte('created_at', since);
  if ((count ?? 0) >= CLIENT_BURST_PER_MINUTE) return { error: 'That is a lot of messages at once. Please wait a moment.' };

  const { data, error } = await portal.svc
    .from('project_messages')
    .insert({ project_id: portal.projectId, author: 'client', author_name: portal.names.client, body: checked.body })
    .select(COLS).single();
  if (error || !data) return { error: 'Could not send. Your message is still here.' };
  return { message: toMessage(data as Row, portal.names) };
}

/** The client has seen everything up to now. */
export async function portalMarkRead(token: string): Promise<{ error: string } | { ok: true }> {
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  const { error } = await portal.svc
    .from('project_message_reads')
    .upsert({ project_id: portal.projectId, reader: 'client', last_read_at: new Date().toISOString() });
  return error ? { error: 'Could not mark the conversation read.' } : { ok: true };
}
