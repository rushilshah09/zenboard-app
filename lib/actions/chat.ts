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

import { notReady } from '@/lib/not-ready';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { DELETED_BODY, isReaction, normalizeBody, toMessage, type ChatMessage, type ReactionRow } from '@/lib/chat';

type DB = Awaited<ReturnType<typeof createClient>>;

const COLS = 'id,project_id,author,author_name,body,created_at,edited_at,deleted_at';
/**
 * The same columns with each message's reactions EMBEDDED (0044), so reactions cost no round trip of
 * their own: they arrive in the one read that brings the page. Only asked for once the probe says the
 * table exists — before 0044, embedding it would fail the whole read.
 */
const COLS_REACT = `${COLS},project_message_reactions(reactor,emoji,created_at,removed_at)`;
const cols = (reactions: boolean): string => (reactions ? COLS_REACT : COLS);
/** How much history a channel opens with. Older pages are C2. */
const PAGE = 200;
/**
 * A leaked portal link must not become a way to flood someone's channel. A person typing sends a
 * handful of messages a minute; this is several times that, and still a wall to a script.
 */
const CLIENT_BURST_PER_MINUTE = 20;

const NOT_READY = () => notReady('Messages aren’t available yet.', '0043');
const REACTIONS_NOT_READY = () => notReady('Reactions aren’t available yet.', '0044');
const NO_SUCH_REACTION = { error: 'That reaction is not available.' } as const;

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

/** Is migration 0044 applied? The same zero-row probe. */
export async function reactionsSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? (await createClient());
    const { error } = await supabase.from('project_message_reactions').select('message_id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

export type ChannelView = {
  messages: ChatMessage[];
  lastReadAt: string | null;
  names: { team: string; client: string };
  /** There is history older than `messages[0]` — scrolling to the top loads it. */
  hasMore: boolean;
  /** Reactions are available (0044 applied). Until they are, no reaction control is drawn. */
  reactions: boolean;
};

/**
 * One page, oldest first. Asking for ONE row more than a page is how we know older history exists
 * without a second (count) query: round trips are this app's main cost.
 */
function page(rows: Row[], names: { team: string; client: string }): { messages: ChatMessage[]; hasMore: boolean } {
  const hasMore = rows.length > PAGE;
  return { messages: rows.slice(0, PAGE).reverse().map((r) => toMessage(r, names)), hasMore };
}

/** A message id from the browser, checked before it reaches a query. */
function validId(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** A timestamp from the browser, checked before it reaches a query. */
function validInstant(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

type Row = {
  id: string; project_id: string; author: string; author_name: string | null; body: string;
  created_at: string; edited_at: string | null; deleted_at: string | null;
  project_message_reactions?: ReactionRow[] | null;
};

// ── THE OWNER ──────────────────────────────────────────────────────────────

async function ownerName(db: DB, userId: string): Promise<string> {
  const { data } = await db.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  return ((data as { full_name: string | null } | null)?.full_name ?? '').trim() || 'You';
}

/** One channel's history, oldest first, and where the owner has read up to. */
export async function loadChannel(projectId: string): Promise<{ error: string } | ChannelView> {
  const { supabase, user } = await requireSession();
  // The two probes and the project are independent, so they share one round trip (round trips are
  // this app's main cost — this used to be three in a row before the page was even asked for).
  const [chat, reactions, { data: project }] = await Promise.all([
    chatSupported(supabase),
    reactionsSupported(supabase),
    supabase.from('projects').select('id,client_id').eq('id', projectId).maybeSingle(),
  ]);
  if (!chat) return NOT_READY();
  if (!project) return { error: 'That conversation is not available.' };
  const p = project as { id: string; client_id: string | null };

  const [msgs, read, client, team] = await Promise.all([
    supabase.from('project_messages').select(cols(reactions)).eq('project_id', projectId).order('created_at', { ascending: false }).limit(PAGE + 1),
    supabase.from('project_message_reads').select('last_read_at').eq('project_id', projectId).eq('reader', 'team').maybeSingle(),
    p.client_id ? supabase.from('clients').select('name').eq('id', p.client_id).maybeSingle() : Promise.resolve({ data: null }),
    ownerName(supabase, user.id),
  ]);
  if (msgs.error) return { error: 'Could not load this conversation.' };

  const names = { team, client: ((client.data as { name: string } | null)?.name ?? '').trim() || 'Client' };
  return {
    ...page(msgs.data as unknown as Row[], names),
    lastReadAt: (read.data as { last_read_at: string } | null)?.last_read_at ?? null,
    names,
    reactions,
  };
}

/** The page of history before `before`, for scrolling up. */
export async function loadOlder(projectId: string, before: string): Promise<{ error: string } | { messages: ChatMessage[]; hasMore: boolean }> {
  if (!validInstant(before)) return { error: 'Could not load earlier messages.' };
  const { supabase, user } = await requireSession();
  const [chat, reactions, team] = await Promise.all([chatSupported(supabase), reactionsSupported(supabase), ownerName(supabase, user.id)]);
  if (!chat) return NOT_READY();
  const { data, error } = await supabase.from('project_messages').select(cols(reactions)).eq('project_id', projectId).lt('created_at', before)
    .order('created_at', { ascending: false }).limit(PAGE + 1);
  if (error) return { error: 'Could not load earlier messages.' };
  return page(data as unknown as Row[], { team, client: 'Client' });
}

/**
 * Change the words of one of the TEAM's messages. RLS (`owner_upd`) already confines this to the
 * owner's projects and to team-authored rows; the filters here say the same thing out loud so a
 * refused edit reads as "not yours" instead of silently updating nothing.
 */
export async function editMessage(id: string, raw: string): Promise<{ error: string } | { message: ChatMessage }> {
  const checked = normalizeBody(raw);
  if (!checked.ok) return { error: checked.error };
  const { supabase, user } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY();
  const { data, error } = await supabase
    .from('project_messages')
    .update({ body: checked.body, edited_at: new Date().toISOString() })
    .eq('id', id).eq('author', 'team').is('deleted_at', null)
    .select(COLS).maybeSingle();
  if (error) return { error: 'Could not save the edit. Your words are still here.' };
  if (!data) return { error: 'You can only edit your own messages.' };
  return { message: toMessage(data as Row, { team: await ownerName(supabase, user.id), client: 'Client' }) };
}

/** Delete one of the TEAM's messages — the words are overwritten, not hidden. */
export async function deleteMessage(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY();
  const { data, error } = await supabase
    .from('project_messages')
    .update({ body: DELETED_BODY, deleted_at: new Date().toISOString() })
    .eq('id', id).eq('author', 'team').is('deleted_at', null)
    .select('id').maybeSingle();
  if (error) return { error: 'Could not delete the message.' };
  if (!data) return { error: 'You can only delete your own messages.' };
  return { ok: true };
}

/** Post as the team. RLS refuses anything else; the body is checked here first so the error is kind. */
export async function sendMessage(projectId: string, raw: string): Promise<{ error: string } | { message: ChatMessage }> {
  const checked = normalizeBody(raw);
  if (!checked.ok) return { error: checked.error };
  const { supabase, user } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY();

  const name = await ownerName(supabase, user.id);
  const { data, error } = await supabase
    .from('project_messages')
    .insert({ project_id: projectId, author: 'team', author_name: name, body: checked.body })
    .select(COLS).single();
  if (error || !data) return { error: 'Could not send. Your message is still here.' };
  return { message: toMessage(data as Row, { team: name, client: 'Client' }) };
}

/**
 * The team puts a reaction on, or takes it back. The browser sends the state it WANTS, not "toggle":
 * a double click then settles where the person left it, instead of flipping once per request.
 * Taking one back is an update, never a delete (0044 explains why). RLS (`owner_ins`/`owner_upd`)
 * confines both to this owner's projects and to the team's side.
 */
export async function reactToMessage(messageId: string, emoji: string, on: boolean): Promise<{ error: string } | { ok: true }> {
  if (!validId(messageId) || !isReaction(emoji) || typeof on !== 'boolean') return NO_SUCH_REACTION;
  const { supabase } = await requireSession();
  const now = new Date().toISOString();
  const { error } = on
    ? await supabase.from('project_message_reactions').upsert(
      { message_id: messageId, reactor: 'team', emoji, created_at: now, removed_at: null },
      { onConflict: 'message_id,reactor,emoji' },
    )
    : await supabase.from('project_message_reactions').update({ removed_at: now })
      .eq('message_id', messageId).eq('reactor', 'team').eq('emoji', emoji).is('removed_at', null);
  if (error) return (await reactionsSupported(supabase)) ? { error: on ? 'Could not add the reaction.' : 'Could not remove the reaction.' } : REACTIONS_NOT_READY();
  return { ok: true };
}

/** The owner has seen everything up to now. */
export async function markChannelRead(projectId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await chatSupported(supabase))) return NOT_READY();
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
  // Independent of each other, so one round trip — every client call pays for this gate.
  const [chat, reactions, client, team] = await Promise.all([
    chatSupported(svc),
    reactionsSupported(svc),
    p.client_id ? svc.from('clients').select('name').eq('id', p.client_id).maybeSingle() : Promise.resolve({ data: null }),
    ownerName(svc, p.user_id),
  ]);
  if (!chat) return null;
  const names = { team, client: ((client.data as { name: string } | null)?.name ?? '').trim() || 'Client' };
  return { svc, projectId: p.id, names, reactions };
}

const GONE = { error: 'This conversation is not available.' } as const;

/** The client's view of their project's channel: the same history, read from their side. */
export async function portalLoadChat(token: string): Promise<{ error: string } | ChannelView> {
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  const [msgs, read] = await Promise.all([
    portal.svc.from('project_messages').select(cols(portal.reactions)).eq('project_id', portal.projectId).order('created_at', { ascending: false }).limit(PAGE + 1),
    portal.svc.from('project_message_reads').select('last_read_at').eq('project_id', portal.projectId).eq('reader', 'client').maybeSingle(),
  ]);
  if (msgs.error) return { error: 'Could not load the conversation.' };
  return {
    ...page(msgs.data as unknown as Row[], portal.names),
    lastReadAt: (read.data as { last_read_at: string } | null)?.last_read_at ?? null,
    names: portal.names,
    reactions: portal.reactions,
  };
}

/** Earlier history, for the client scrolling up — the token's project only. */
export async function portalLoadOlder(token: string, before: string): Promise<{ error: string } | { messages: ChatMessage[]; hasMore: boolean }> {
  if (!validInstant(before)) return { error: 'Could not load earlier messages.' };
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  const { data, error } = await portal.svc
    .from('project_messages').select(cols(portal.reactions)).eq('project_id', portal.projectId).lt('created_at', before)
    .order('created_at', { ascending: false }).limit(PAGE + 1);
  if (error) return { error: 'Could not load earlier messages.' };
  return page(data as unknown as Row[], portal.names);
}

/**
 * Edit one of the CLIENT's messages. Three scopes, every one of them load-bearing: the token's own
 * project, the client's own side, and a message that still exists. Without the project scope a link
 * could rewrite another project's history; without the author scope it could put words in the
 * studio's mouth.
 */
export async function portalEditMessage(token: string, id: string, raw: string): Promise<{ error: string } | { message: ChatMessage }> {
  const checked = normalizeBody(raw);
  if (!checked.ok) return { error: checked.error };
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  const { data, error } = await portal.svc
    .from('project_messages')
    .update({ body: checked.body, edited_at: new Date().toISOString() })
    .eq('id', id).eq('project_id', portal.projectId).eq('author', 'client').is('deleted_at', null)
    .select(COLS).maybeSingle();
  if (error) return { error: 'Could not save the edit. Your words are still here.' };
  if (!data) return { error: 'You can only edit your own messages.' };
  return { message: toMessage(data as Row, portal.names) };
}

/** Delete one of the CLIENT's messages, under the same three scopes. The words are overwritten. */
export async function portalDeleteMessage(token: string, id: string): Promise<{ error: string } | { ok: true }> {
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  const { data, error } = await portal.svc
    .from('project_messages')
    .update({ body: DELETED_BODY, deleted_at: new Date().toISOString() })
    .eq('id', id).eq('project_id', portal.projectId).eq('author', 'client').is('deleted_at', null)
    .select('id').maybeSingle();
  if (error) return { error: 'Could not delete the message.' };
  if (!data) return { error: 'You can only delete your own messages.' };
  return { ok: true };
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

/**
 * The client puts a reaction on, or takes it back — under the same scopes as an edit. The message
 * must be the token's project's and still there (without that, a link could react across projects:
 * the reaction table has no project of its own to scope by); the side is forced to `client`; the
 * emoji must be one on offer.
 *
 * No burst cap, unlike sending: a reaction cannot flood a conversation. There are eight, each side
 * holds each at most once per message, and pressing one again only takes it back.
 */
export async function portalReactToMessage(
  token: string, messageId: string, emoji: string, on: boolean,
): Promise<{ error: string } | { ok: true }> {
  if (!validId(messageId) || !isReaction(emoji) || typeof on !== 'boolean') return NO_SUCH_REACTION;
  const portal = await resolvePortal(token);
  if (!portal) return GONE;
  if (!portal.reactions) return REACTIONS_NOT_READY();
  const { data: message } = await portal.svc
    .from('project_messages').select('id')
    .eq('id', messageId).eq('project_id', portal.projectId).is('deleted_at', null)
    .maybeSingle();
  if (!message) return { error: 'That message is not available.' };
  const now = new Date().toISOString();
  const { error } = on
    ? await portal.svc.from('project_message_reactions').upsert(
      { message_id: messageId, reactor: 'client', emoji, created_at: now, removed_at: null },
      { onConflict: 'message_id,reactor,emoji' },
    )
    : await portal.svc.from('project_message_reactions').update({ removed_at: now })
      .eq('message_id', messageId).eq('reactor', 'client').eq('emoji', emoji).is('removed_at', null);
  return error ? { error: on ? 'Could not add the reaction.' : 'Could not remove the reaction.' } : { ok: true };
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
