// What a comment IS, and how comments become conversations — §7H block comments.
//
// Pure, so it can be tested without a database and imported from either side.
// Everything that touches Supabase lives in `lib/actions/comments.ts`.
//
// THE MODEL, in one line: a comment is a row anchored to `(page, block)`, and a
// THREAD is the set of comments sharing a `threadId`. The anchor says *where the
// conversation is*; the thread id says *which conversation it is*. Two questions
// about the same paragraph are two threads, and resolving one leaves the other
// open — which is the behaviour Notion has and the reason the id is not just the
// anchor.
//
// LEGACY COMMENTS. Before 0037, a page's comments were an array inside
// `pages.content`. Those are still read (see `fromLegacy`) so nothing a user
// wrote disappears the day the migration lands; they are page-level by
// construction, they cannot be replied to or resolved, and they are the only
// comments deleted by patching the document. New writes always go to the table.

/** A comment, whichever store it came from. */
export type Comment = {
  id: string;
  threadId: string;
  /** null = the document as a whole. */
  blockId: string | null;
  body: string;
  authorName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** True for a comment still living in `pages.content` (pre-0037). */
  legacy?: boolean;
};

/** A conversation: comments sharing a thread id, oldest first. */
export type CommentThread = {
  id: string;
  blockId: string | null;
  comments: Comment[];
  resolved: boolean;
  /** The anchor names a block that is no longer in the document. */
  orphan: boolean;
  /** Newest activity, for ordering threads that share an anchor. */
  lastAt: string;
};

/**
 * The composer's name for "the document itself".
 *
 * A thread's anchor is `string | null`, and `null` already means "no composer is
 * open" in the UI state — so the page needs a name that is not null. It is a
 * sentinel rather than a real block id, which is why it is stated once here
 * instead of being spelled differently in the view, the hook and the tests.
 */
export const PAGE_ANCHOR = '__page__';

const MAX_BODY = 2000;

/**
 * Trim and bound a comment body. `null` when there is nothing to post — which is
 * the whole validation, stated once, so the composer, the action and the tests
 * cannot disagree about what an empty comment is.
 */
export function normalizeBody(raw: string): string | null {
  const body = raw.trim();
  if (!body) return null;
  return body.length > MAX_BODY ? body.slice(0, MAX_BODY) : body;
}

export const COMMENT_MAX = MAX_BODY;

/**
 * Group comments into threads.
 *
 * `liveBlockIds` is the set of block ids currently in the document. An anchor
 * outside it is an ORPHAN — its block was deleted after the conversation
 * started. Orphans are kept and marked, never dropped: a comment that vanishes
 * because someone deleted the paragraph it was about reads as a bug, and it
 * loses the one record of why a change was made.
 *
 * Pass `undefined` when the document is not loaded yet; nothing is called an
 * orphan on the strength of not knowing.
 */
export function toThreads(comments: Comment[], liveBlockIds?: ReadonlySet<string>): CommentThread[] {
  const byThread = new Map<string, Comment[]>();
  for (const c of comments) {
    byThread.set(c.threadId, [...(byThread.get(c.threadId) ?? []), c]);
  }

  const threads: CommentThread[] = [];
  for (const [id, list] of byThread) {
    const ordered = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const blockId = ordered[0].blockId;
    threads.push({
      id,
      blockId,
      comments: ordered,
      // A thread is resolved when its OPENING comment is — resolve stamps every
      // row it finds, so a reply that arrived mid-flight must not un-resolve the
      // conversation just by being unstamped.
      resolved: !!ordered[0].resolvedAt,
      orphan: !!blockId && !!liveBlockIds && !liveBlockIds.has(blockId),
      lastAt: ordered[ordered.length - 1].createdAt,
    });
  }
  return threads.sort((a, b) => a.lastAt.localeCompare(b.lastAt));
}

/**
 * Open threads keyed by anchor — `null` is the document itself.
 *
 * ONE grouping function, not three. The editor needs "this block's threads" per
 * row and the page panel needs the null key; both are this map, and the arrays
 * it returns are stable enough to key a memoized row off.
 *
 * AN ORPHAN FALLS BACK TO THE PAGE. Its block is gone, so it cannot be drawn
 * where it was written — but it is still an OPEN question, and filing it with
 * the resolved threads would bury something nobody answered under a heading
 * that claims they did. (It also made that heading lie: "3 resolved" counting
 * one orphan, which is how this rule was found.) The thread itself says its
 * block was deleted, so the reader is never misled about where it came from.
 */
export function openThreadsByAnchor(threads: CommentThread[]): Map<string | null, CommentThread[]> {
  const out = new Map<string | null, CommentThread[]>();
  for (const t of threads) {
    if (t.resolved) continue;
    const key = t.orphan ? null : t.blockId;
    out.set(key, [...(out.get(key) ?? []), t]);
  }
  return out;
}

/** Resolved threads — exactly what the "N resolved" disclosure holds, so the
 *  count it prints is the thing it names. */
export function archivedThreads(threads: CommentThread[]): CommentThread[] {
  return threads.filter((t) => t.resolved);
}

// ── the legacy store (pre-0037, inside pages.content) ────────────────────────

/** The shape written into `pages.content.comments` before this migration. */
export type LegacyComment = { id: string; text: string; at: string };

/**
 * Lift pre-0037 comments into the one shape. Each becomes its own thread — they
 * were a flat list with no replies, and inventing a conversation out of adjacency
 * would put words in someone's mouth.
 */
export function fromLegacy(list: readonly LegacyComment[] | undefined, authorName: string | null): Comment[] {
  return (list ?? [])
    .filter((c) => c && typeof c.text === 'string' && c.text.trim())
    .map((c) => ({
      id: c.id,
      threadId: c.id,
      blockId: null,
      body: c.text,
      authorName,
      createdAt: c.at,
      resolvedAt: null,
      legacy: true,
    }));
}

/** First letter for an avatar. One rule, so every comment surface agrees. */
export function initialOf(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}
