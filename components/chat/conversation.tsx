'use client';
// ── ONE CONVERSATION, TWO TRANSPORTS ───────────────────────────────────────
//
// Everything a conversation DOES lives here exactly once: sending optimistically, retrying a failed
// send, editing in place (and Slack's ↑ to edit your last), deleting behind a confirm, copying, and
// loading older history. Each side of chat supplies only its TRANSPORT — the owner's session
// actions, the client's token actions, or the preview harness's fakes.
//
// Before this file both sides carried their own copy of send-and-reconcile. Adding edit, delete and
// history to both would have doubled that; two copies of the same state machine is exactly how the
// task row and the table drifted apart in colour and speed without either file showing it.
//
// The parent owns `view`, because only the parent knows how new messages ARRIVE (a realtime stream
// on one side, a poll on the other). This component owns how the person ACTS on them.

import * as React from 'react';
import { toast, useConfirm } from '@/components/ds/ui';
import { tempId } from '@/lib/temp-id';
import { lastEditable, type ChatAuthor, type ChatMessage } from '@/lib/chat';
import type { ChannelView } from '@/lib/actions/chat';
import { MessageList } from './message-list';
import { Composer } from './composer';

export type ConversationApi = {
  send: (body: string) => Promise<{ error: string } | { message: ChatMessage }>;
  edit: (id: string, body: string) => Promise<{ error: string } | { message: ChatMessage }>;
  remove: (id: string) => Promise<{ error: string } | { ok: true }>;
  older: (before: string) => Promise<{ error: string } | { messages: ChatMessage[]; hasMore: boolean }>;
};

export function Conversation({
  view, setView, me, api, placeholder, empty, tz, autoFocus,
}: {
  view: ChannelView;
  setView: React.Dispatch<React.SetStateAction<ChannelView | null>>;
  me: ChatAuthor;
  api: ConversationApi;
  placeholder: string;
  empty: React.ReactNode;
  tz?: string;
  autoFocus?: boolean;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [confirm, confirmUI] = useConfirm();
  // Where focus goes when an edit or a delete ENDS: back to the composer, as in Slack. Focusing it
  // BEFORE the editor unmounts means focus never falls to <body> in between, so a keyboard reader
  // never loses their place (lib/use-focus-return.ts's rule, met from the other side).
  const composer = React.useRef<HTMLTextAreaElement>(null);
  const backToComposer = () => composer.current?.focus({ preventScroll: true });

  /** Apply a change to one message, wherever it sits in the list. */
  const patch = React.useCallback((id: string, fn: (m: ChatMessage) => ChatMessage | null) => {
    setView((v) => {
      if (!v) return v;
      const messages = v.messages.flatMap((m) => {
        if (m.id !== id) return [m];
        const next = fn(m);
        return next ? [next] : [];
      });
      return { ...v, messages };
    });
  }, [setView]);

  // ── Send ─────────────────────────────────────────────────────────────
  const deliver = async (pendingId: string, body: string) => {
    const res = await api.send(body);
    setView((v) => {
      if (!v) return v;
      if ('error' in res) {
        return { ...v, messages: v.messages.map((m) => (m.id === pendingId ? { ...m, failed: true } : m)) };
      }
      // The live stream may have delivered the confirmed row already; never show it twice.
      const rest = v.messages.filter((m) => m.id !== pendingId);
      return { ...v, messages: rest.some((m) => m.id === res.message.id) ? rest : [...rest, res.message] };
    });
  };

  const onSend = (body: string) => {
    const id = tempId();
    setView((v) => (v ? {
      ...v,
      messages: [...v.messages, {
        id, projectId: v.messages[0]?.projectId ?? '', author: me, authorName: v.names[me], body,
        createdAt: new Date().toISOString(), editedAt: null, deleted: false, pending: true,
      }],
    } : v));
    void deliver(id, body);
  };

  const onRetry = (m: ChatMessage) => {
    patch(m.id, (x) => ({ ...x, failed: false }));
    void deliver(m.id, m.body);
  };

  // ── Edit ─────────────────────────────────────────────────────────────
  const onEditSave = async (m: ChatMessage, body: string) => {
    setEditingId(null);
    backToComposer();
    if (body === m.body) return; // nothing changed: nothing to save, nothing to mark "(edited)"
    const before = m;
    // Optimistic: the new words show at once, as they do in Slack.
    patch(m.id, (x) => ({ ...x, body, editedAt: new Date().toISOString() }));
    const res = await api.edit(m.id, body);
    if ('error' in res) {
      patch(m.id, () => before);
      toast({ message: res.error, variant: 'error' });
      return;
    }
    patch(m.id, () => res.message);
  };

  /** ↑ in an empty composer. Returns whether there was anything to edit. */
  const onEditLast = () => {
    const last = lastEditable(view.messages, me);
    if (!last) return false;
    setEditingId(last.id);
    return true;
  };

  // ── Delete ───────────────────────────────────────────────────────────
  const onDelete = async (m: ChatMessage) => {
    const ok = await confirm({
      title: 'Delete this message?',
      // Honest about what deleting does: the words are overwritten, for both sides, for good.
      body: 'It is removed for everyone in this conversation. This can’t be undone.',
      actionLabel: 'Delete message',
      tone: 'danger',
    });
    if (!ok) return;
    const before = m;
    patch(m.id, (x) => ({ ...x, deleted: true, body: '' }));
    // The message's toolbar (and the Delete button focus would return to) is gone with its words.
    backToComposer();
    const res = await api.remove(m.id);
    if ('error' in res) {
      patch(m.id, () => before);
      toast({ message: res.error, variant: 'error' });
    }
  };

  // ── Copy ─────────────────────────────────────────────────────────────
  const onCopy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.body);
      toast({ message: 'Copied' });
    } catch {
      toast({ message: 'Could not copy. Your browser blocked the clipboard.', variant: 'error' });
    }
  };

  // ── Older history ────────────────────────────────────────────────────
  const onLoadOlder = async () => {
    const oldest = view.messages.find((m) => !m.pending);
    if (!oldest || !view.hasMore || loadingOlder) return;
    setLoadingOlder(true);
    const res = await api.older(oldest.createdAt);
    setLoadingOlder(false);
    if ('error' in res) {
      toast({ message: res.error, variant: 'error' });
      return;
    }
    setView((v) => {
      if (!v) return v;
      const have = new Set(v.messages.map((m) => m.id));
      return { ...v, hasMore: res.hasMore, messages: [...res.messages.filter((m) => !have.has(m.id)), ...v.messages] };
    });
  };

  return (
    <>
      <MessageList
        messages={view.messages}
        me={me}
        lastReadAt={view.lastReadAt}
        tz={tz}
        onRetry={onRetry}
        empty={empty}
        editingId={editingId}
        onEditStart={(m) => setEditingId(m.id)}
        onEditSave={onEditSave}
        onEditCancel={() => { setEditingId(null); backToComposer(); }}
        onDelete={onDelete}
        onCopy={onCopy}
        hasMore={view.hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={onLoadOlder}
      />
      <Composer placeholder={placeholder} onSend={onSend} onEditLast={onEditLast} autoFocus={autoFocus} inputRef={composer} />
      {confirmUI}
    </>
  );
}
