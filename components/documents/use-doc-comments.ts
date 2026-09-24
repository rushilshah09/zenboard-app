'use client';
// Everything a document needs to hold a conversation — §7H block comments.
//
// One hook, because the state is genuinely shared: the page-level panel, every
// block's inline thread, and the "resolved" drawer all read the same list, and
// splitting it would mean three fetches and three chances to disagree about
// whether a thread is open.
//
// LEGACY. Before 0037 a page's comments were an array inside `pages.content`.
// Those are merged in and rendered like any other, so nothing a user wrote
// disappears the day the migration lands — they simply cannot be replied to or
// resolved (they have no thread), and deleting one patches the document instead
// of the table. `lib/comments.ts` marks them; this file routes them.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ds/ui';
import { addComment, deleteComment, listComments, setThreadResolved } from '@/lib/actions/comments';
import {
  toThreads, openThreadsByAnchor, archivedThreads, fromLegacy, normalizeBody,
  type Comment, type CommentThread, type LegacyComment,
} from '@/lib/comments';
import { tempId, isTempId } from '@/lib/temp-id';
import type { CommentActions } from '@/components/documents/comment-thread';

const NONE: Comment[] = [];

export type DocComments = {
  /** Open threads by anchor — feeds the editor's `comments.byBlock`. */
  byBlock: Map<string | null, CommentThread[]>;
  /** Threads on the document itself. */
  pageThreads: CommentThread[];
  /** Resolved or orphaned — reachable, but out of the document body. */
  archived: CommentThread[];
  openCountForPage: number;
  composingFor: string | null;
  open: (blockId: string) => void;
  close: () => void;
  actions: CommentActions;
};

export function useDocComments({ pageId, enabled, blockIds, legacy, authorName, onDeleteLegacy }: {
  pageId: string | null;
  /** Is 0037 applied? Probed once on the server and handed down. */
  enabled: boolean;
  /** Every block id currently in the document — decides what is an orphan. */
  blockIds: ReadonlySet<string>;
  legacy: LegacyComment[] | undefined;
  authorName: string | null;
  onDeleteLegacy: (id: string) => void;
}): DocComments {
  const [loaded, setLoaded] = useState<{ pageId: string; rows: Comment[] } | null>(null);
  // Scoped to its page rather than cleared when the page changes: an open
  // composer belongs to the document it was opened in, and deriving that is one
  // comparison where resetting it would be an effect that runs a frame late.
  const [composing, setComposing] = useState<{ pageId: string; blockId: string } | null>(null);
  const composingFor = composing?.pageId === pageId ? composing.blockId : null;

  useEffect(() => {
    if (!enabled || !pageId || isTempId(pageId)) return;
    let live = true;
    listComments(pageId).then((rows) => { if (live) setLoaded({ pageId, rows }); });
    return () => { live = false; };
  }, [enabled, pageId]);

  // Derived, never reset in an effect — the same rule the acceptance state
  // follows, and for the same reason: clearing on the way out leaves a frame in
  // which the PREVIOUS document's comments render on this one.
  const rows = loaded?.pageId === pageId ? loaded.rows : NONE;

  const all = useMemo(
    () => [...fromLegacy(legacy, authorName), ...rows],
    [legacy, authorName, rows],
  );

  const threads = useMemo(() => toThreads(all, blockIds), [all, blockIds]);
  // Memoized because the editor keys its row memo off the arrays this returns:
  // a fresh Map per render would re-render every block on every keystroke.
  const byBlock = useMemo(() => openThreadsByAnchor(threads), [threads]);
  const archived = useMemo(() => archivedThreads(threads), [threads]);
  const pageThreads = useMemo(() => byBlock.get(null) ?? [], [byBlock]);

  const patch = useCallback((fn: (rows: Comment[]) => Comment[]) => {
    setLoaded((cur) => (cur ? { ...cur, rows: fn(cur.rows) } : cur));
  }, []);

  const post = useCallback((blockId: string | null, threadId: string | null, raw: string) => {
    const body = normalizeBody(raw);
    if (!body || !pageId) return;
    if (!enabled) { toast({ message: 'Comments need migration 0037.', variant: 'error' }); return; }

    // Optimistic, with a real rollback. An appearing-then-vanishing comment with
    // no explanation is worse than a spinner (§the optimistic-creation rule).
    const draft: Comment = {
      id: tempId(), threadId: threadId ?? tempId(), blockId,
      body, authorName, createdAt: new Date().toISOString(), resolvedAt: null,
    };
    patch((cur) => [...cur, draft]);

    addComment({ pageId, blockId, threadId, body }).then((res) => {
      if ('error' in res) {
        patch((cur) => cur.filter((c) => c.id !== draft.id));
        toast({ message: res.error, variant: 'error' });
        return;
      }
      patch((cur) => cur.map((c) => (c.id === draft.id ? res.comment : c)));
    });
  }, [pageId, enabled, authorName, patch]);

  const actions: CommentActions = useMemo(() => ({
    post: (blockId, body) => post(blockId, null, body),
    reply: (threadId, body) => {
      // A reply to a thread whose opening comment has not been written yet has
      // no id to join. Rare (it needs a reply inside the round trip) and cheap
      // to refuse honestly rather than silently starting a second thread.
      if (isTempId(threadId)) { toast({ message: 'Still saving — try again in a moment.' }); return; }
      const anchor = threads.find((t) => t.id === threadId)?.blockId ?? null;
      post(anchor, threadId, body);
    },
    remove: (comment) => {
      if (comment.legacy) { onDeleteLegacy(comment.id); return; }
      patch((cur) => cur.filter((c) => c.id !== comment.id));
      deleteComment(comment.id).then((res) => {
        if ('error' in res) {
          patch((cur) => [...cur, comment]);
          toast({ message: res.error, variant: 'error' });
        }
      });
    },
    setResolved: (threadId, resolved) => {
      const at = resolved ? new Date().toISOString() : null;
      // Rolling back means restoring what each row HELD, not the opposite of
      // what we wrote: reopening a thread erases timestamps we would otherwise
      // have to invent, and a failed reopen would leave it looking reopened.
      const before = new Map<string, string | null>();
      patch((cur) => cur.map((c) => {
        if (c.threadId !== threadId) return c;
        before.set(c.id, c.resolvedAt);
        return { ...c, resolvedAt: at };
      }));
      setThreadResolved(threadId, resolved).then((res) => {
        if ('error' in res) {
          patch((cur) => cur.map((c) => (before.has(c.id) ? { ...c, resolvedAt: before.get(c.id)! } : c)));
          toast({ message: res.error, variant: 'error' });
        }
      });
    },
  }), [post, patch, onDeleteLegacy, threads]);

  return {
    byBlock,
    pageThreads,
    archived,
    openCountForPage: pageThreads.length,
    composingFor,
    open: useCallback((blockId: string) => { if (pageId) setComposing({ pageId, blockId }); }, [pageId]),
    close: useCallback(() => setComposing(null), []),
    actions,
  };
}
