'use server';
// Comments, write side — §7H block comments, migration 0037. The rules live in
// lib/comments.ts; this file only performs them.
//
// GATED. Until 0037 is applied `commentsSupported()` reports false, every action
// here returns a clean "not available yet", and the document falls back to the
// pre-0037 page-level comments stored inside `pages.content`. Nothing a user has
// already written disappears at any point, in either direction — rule 2.
//
// NOTE FOR A FUTURE PORTAL SPRINT: RLS here is `user_id = auth.uid()`, so a
// portal guest cannot write through it. `author_name` is stored rather than
// joined precisely so guest comments can arrive later through the service role
// without a schema change.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';
import { normalizeBody, COMMENT_MAX, type Comment } from '@/lib/comments';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0037 applied? A zero-row probe — the same fetch-time capability
 * pattern as `memoriesSupported` / `attachmentsSupported`. Probing the TABLE is
 * correct: 0037's whole contribution is one new table.
 */
export async function commentsSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('comments').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = { error: 'Comments need migration 0037.' } as const;

const COLUMNS = 'id,thread_id,block_id,body,author_name,created_at,resolved_at';

type Row = {
  id: string; thread_id: string; block_id: string | null; body: string;
  author_name: string | null; created_at: string; resolved_at: string | null;
};

function toComment(r: Row): Comment {
  return {
    id: r.id,
    threadId: r.thread_id,
    blockId: r.block_id,
    body: r.body,
    authorName: r.author_name,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export type CommentResult = { error: string } | { ok: true; comment: Comment };

/** Every comment on a page. Empty — never an error — when 0037 is not applied,
 *  because a document that will not open because commenting is unavailable is a
 *  worse failure than a document with no comments. */
export async function listComments(pageId: string): Promise<Comment[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('comments').select(COLUMNS).eq('page_id', pageId).order('created_at');
    if (error) return [];
    return ((data as unknown as Row[]) ?? []).map(toComment);
  } catch {
    return [];
  }
}

/**
 * Post a comment. Omit `threadId` to start a conversation; pass one to reply.
 *
 * `blockId` is not validated against the document on purpose. The block it names
 * may legitimately not exist by the time this runs (another tab deleted it), and
 * rejecting the write would lose the words someone just typed to protect an
 * anchor the read path already knows how to show as an orphan.
 */
export async function addComment(input: {
  pageId: string; blockId?: string | null; threadId?: string | null; body: string;
}): Promise<CommentResult> {
  const body = normalizeBody(input.body);
  if (!body) return { error: 'Write the comment first.' };
  if (input.body.trim().length > COMMENT_MAX) {
    return { error: `A comment is ${COMMENT_MAX} characters at most.` };
  }

  const { supabase, user } = await requireSession();
  if (!await commentsSupported(supabase)) return NOT_READY;

  const sid = await activeSpaceId(supabase, user.id);
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const authorName = (profile as { full_name?: string | null } | null)?.full_name?.trim()
    || user.email?.split('@')[0] || null;

  const { data, error } = await supabase.from('comments').insert({
    user_id: user.id,
    space_id: sid,
    page_id: input.pageId,
    block_id: input.blockId ?? null,
    // Omitted entirely when starting a thread, so the column default mints one —
    // the id is the database's to invent, not the client's.
    ...(input.threadId ? { thread_id: input.threadId } : {}),
    body,
    author_name: authorName,
  }).select(COLUMNS).single();

  if (error || !data) return { error: error?.message ?? 'Could not post the comment.' };
  return { ok: true, comment: toComment(data as unknown as Row) };
}

/**
 * Resolve or reopen a whole conversation.
 *
 * Stamps every row sharing the thread id, so a thread cannot end up half
 * resolved — and `toThreads` still reads the state off the OPENING comment, so a
 * reply that lands between the read and the write does not silently reopen it.
 */
export async function setThreadResolved(threadId: string, resolved: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!await commentsSupported(supabase)) return NOT_READY;

  const { error } = await supabase
    .from('comments')
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq('thread_id', threadId);
  if (error) return { error: error.message };
  return { ok: true };
}

/** Delete one comment. Deleting the last of a thread deletes the thread, since a
 *  thread is only ever the rows that share an id. */
export async function deleteComment(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!await commentsSupported(supabase)) return NOT_READY;

  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}
