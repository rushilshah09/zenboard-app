'use client';
// The one comment surface — §7H block comments.
//
// ONE COMPONENT, TWO ANCHORS. A conversation about a paragraph and a
// conversation about the whole document differ only in where they are drawn, so
// they are the same component with a different anchor. The alternative was a
// second "page comments" widget beside a "block comments" widget, which is how
// two comment vocabularies end up in one product.
//
// BENCHMARK — Notion. Notion opens block comments in a right-hand rail on a wide
// window and inline underneath on a narrow one, with a yellow highlight on the
// commented text. **Ours is always inline, directly under the block**, and that
// is a deliberate difference, for two reasons: a rail needs a column the reading
// layout does not have below `xl` (so the rail would be the exception, not the
// rule), and a comment about a paragraph read three inches away from it is a
// footnote. What we take from Notion is the lifecycle, which is the part that
// matters: a thread is opened, replied to, and RESOLVED rather than deleted, and
// resolved threads leave the page but stay reachable.
import { useState } from 'react';
import { Icon, Button } from '@/components/ds/ui';
import { Check, X, ArrowUp, RotateCcw } from '@/components/ds/icons';
import { formatAgo } from '@/lib/date';
import { initialOf, COMMENT_MAX, type Comment, type CommentThread } from '@/lib/comments';

/** Elapsed time on a comment asks for the `precise` scale — minutes matter in a
 *  reply thread, where "2 Jun" would say nothing. Same call the document body
 *  already makes, through the one vocabulary. */
const ago = (iso: string) => formatAgo(iso, { precise: true }) ?? '';

export type CommentActions = {
  reply: (threadId: string, body: string) => void;
  post: (blockId: string | null, body: string) => void;
  remove: (comment: Comment) => void;
  setResolved: (threadId: string, resolved: boolean) => void;
};

function Avatar({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-sm bg-surface-fill text-ui font-normal leading-none text-ink-700"
    >
      {initialOf(name)}
    </span>
  );
}

/**
 * The composer. A textarea rather than an input because a comment is prose:
 * Enter posts, ⇧Enter starts a line, Esc abandons — the grammar Notion uses and
 * the one a chat box has trained everyone to expect.
 */
export function CommentComposer({ placeholder, autoFocus, onPost, onCancel }: {
  placeholder: string;
  autoFocus?: boolean;
  onPost: (body: string) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const ready = draft.trim().length > 0;
  const post = () => { if (!ready) return; onPost(draft); setDraft(''); };
  return (
    <div className="flex items-start gap-2 py-0.5">
      <textarea data-chromeless
        autoFocus={autoFocus}
        value={draft}
        rows={1}
        maxLength={COMMENT_MAX}
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(''); onCancel?.(); }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-6 flex-1 resize-none border-0 bg-transparent p-0 text-ui leading-6 text-ink-900 outline-none placeholder:text-ink-500"
      />
      {ready && (
        <button
          type="button" onClick={post} aria-label="Post comment"
          className="focus-ring grid size-6 shrink-0 place-items-center rounded-full border-0 bg-ink-900 text-paper"
        >
          <Icon icon={ArrowUp} size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}

function Row({ comment, actions }: { comment: Comment; actions: CommentActions }) {
  return (
    <div className="group/comment flex items-start gap-2 py-[3px]">
      <Avatar name={comment.authorName} />
      <div className="min-w-0 flex-1 pt-0.5">
        <span className="whitespace-pre-wrap break-words text-ui leading-5 text-ink-800">{comment.body}</span>
        <time dateTime={comment.createdAt} className="ml-2 whitespace-nowrap text-caption text-ink-500">
          {ago(comment.createdAt)}
        </time>
      </div>
      <button
        type="button" onClick={() => actions.remove(comment)} aria-label="Delete comment"
        className="focus-ring reveal-on-hover mt-0.5 grid size-5 place-items-center rounded-xs border-0 bg-transparent text-ink-500"
      >
        <Icon icon={X} size={12} />
      </button>
    </div>
  );
}

/**
 * One conversation.
 *
 * `resolve` is the primary lifecycle act and sits at the thread level, never on
 * a comment: you finish a discussion, you do not finish a sentence. Deleting
 * stays available per comment for the thing it is actually for — removing
 * something you did not mean to send.
 */
export function Thread({ thread, actions, showReply = true }: {
  thread: CommentThread;
  actions: CommentActions;
  /** Resolved and orphaned threads are read-only until reopened. */
  showReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const legacy = thread.comments.every((c) => c.legacy);
  return (
    <section
      aria-label={thread.resolved ? 'Resolved comment thread' : 'Comment thread'}
      className="group/thread flex flex-col gap-0.5"
    >
      {thread.orphan && (
        // Kept, not hidden. A comment that vanished with the paragraph it was
        // about takes the record of why the change was made with it.
        <p className="text-caption text-ink-500">On a block that has since been deleted.</p>
      )}
      {thread.comments.map((c) => <Row key={c.id} comment={c} actions={actions} />)}

      {showReply && !thread.resolved && !legacy && (
        replying
          ? (
            <div className="pl-8">
              <CommentComposer
                autoFocus placeholder="Reply…"
                onPost={(body) => { actions.reply(thread.id, body); setReplying(false); }}
                onCancel={() => setReplying(false)}
              />
            </div>
          )
          : (
            <div className="flex items-center gap-1 pl-8">
              <Button size="xs" variant="ghost" onClick={() => setReplying(true)}>Reply</Button>
              <Button
                size="xs" variant="ghost"
                icon={<Icon icon={Check} size={14} />}
                onClick={() => actions.setResolved(thread.id, true)}
              >
                Resolve
              </Button>
            </div>
          )
      )}

      {thread.resolved && (
        <div className="pl-8">
          <Button
            size="xs" variant="ghost"
            icon={<Icon icon={RotateCcw} size={14} />}
            onClick={() => actions.setResolved(thread.id, false)}
          >
            Reopen
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * The DOCUMENT's conversations, under the property zone.
 *
 * Two lists. The open ones include any thread whose block was deleted — it is
 * still an unanswered question, and the page is the only place left that can
 * hold it. RESOLVED threads sit below, behind a disclosure, so finishing a
 * conversation takes it out of the way without taking it away: "resolved" and
 * "deleted" have to stay different claims or nobody resolves anything. Notion
 * puts the same list behind a "Resolved comments" toggle.
 */
export function DocThreads({ open, archived, composing, actions, onCloseComposer }: {
  open: CommentThread[];
  archived: CommentThread[];
  composing: boolean;
  actions: CommentActions;
  onCloseComposer: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  if (!open.length && !archived.length && !composing) return null;
  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {open.map((t) => <Thread key={t.id} thread={t} actions={actions} />)}
      {composing && (
        <CommentComposer
          autoFocus placeholder="Add a comment…"
          onPost={(body) => { actions.post(null, body); onCloseComposer(); }}
          onCancel={onCloseComposer}
        />
      )}
      {archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            size="xs" variant="ghost" className="self-start"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide' : 'Show'} {archived.length} resolved
          </Button>
          {showArchived && archived.map((t) => <Thread key={t.id} thread={t} actions={actions} />)}
        </div>
      )}
    </div>
  );
}

/**
 * Every open conversation anchored to one block, plus a composer when one has
 * just been asked for. Renders nothing at all when there is neither — an editor
 * carrying an empty comment affordance under every paragraph is noise.
 */
export function BlockComments({ threads, composing, blockId, actions, onCloseComposer }: {
  threads: CommentThread[];
  composing: boolean;
  blockId: string | null;
  actions: CommentActions;
  onCloseComposer: () => void;
}) {
  if (!threads.length && !composing) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-2 border-l border-line-strong pl-3">
      {threads.map((t) => <Thread key={t.id} thread={t} actions={actions} />)}
      {composing && (
        <CommentComposer
          autoFocus placeholder="Add a comment…"
          onPost={(body) => { actions.post(blockId, body); onCloseComposer(); }}
          onCancel={onCloseComposer}
        />
      )}
    </div>
  );
}
