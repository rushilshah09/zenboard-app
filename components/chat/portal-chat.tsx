'use client';
// ── MESSAGES — THE CLIENT'S SIDE ───────────────────────────────────────────
//
// The same conversation the owner sees, drawn by the same list and composer, reached through the
// portal link instead of an account (CHAT_PLAN.md).
//
// ── WHY A POLL, NOT A SOCKET ───────────────────────────────────────────────
// The owner's side streams over realtime because RLS scopes the stream to their own projects. A
// client has no account and so no RLS identity; streaming to them would need an anonymous read
// policy, which would hand every project's messages to anyone holding the public anon key. So the
// client asks, through the token action, every few seconds while the page is VISIBLE — and at once
// after sending and on returning to the tab. Every ask re-checks the token, so turning the portal
// off ends the conversation for them on the next beat.

import * as React from 'react';
import { MessageCircle } from '@/components/ds/icons';
import { EmptyState, Icon, cardClass } from '@/components/ds/ui';
import { tempId } from '@/lib/temp-id';
import type { ChatMessage } from '@/lib/chat';
import { portalLoadChat, portalMarkRead, portalSendMessage, type ChannelView } from '@/lib/actions/chat';
import { MessageList } from './message-list';
import { Composer } from './composer';

/** Often enough that a reply feels prompt; rare enough that an open tab costs next to nothing. */
const POLL_MS = 4000;

/** Server truth, plus this browser's own messages that the server has not confirmed yet. */
function merge(server: ChatMessage[], local: ChatMessage[]): ChatMessage[] {
  const ids = new Set(server.map((m) => m.id));
  const unconfirmed = local.filter((m) => (m.pending || m.failed) && !ids.has(m.id)
    // An echo: the send landed and the server row is already here under its real id.
    && !(m.pending && server.some((s) => s.author === 'client' && s.body === m.body && !local.some((l) => l.id === s.id))));
  return [...server, ...unconfirmed];
}

export function PortalChat({
  token,
  studio,
  onRead,
  demo,
}: {
  token: string;
  /** Who the client is talking to — the studio's name, as the portal shows it everywhere else. */
  studio: string;
  /** The nav badge clears when the client has seen the conversation. */
  onRead?: () => void;
  demo?: ChannelView;
}) {
  const [view, setView] = React.useState<ChannelView | null>(demo ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const seen = React.useRef<string | null>(null);
  // The latest `onRead`, read through a ref: the parent may pass a fresh arrow every render, and an
  // effect that depended on it would tear down and restart the poll each time the portal re-rendered.
  const onReadRef = React.useRef(onRead);
  React.useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  // In the harness there is no load to mark read on, so opening the conversation is the read.
  React.useEffect(() => { if (demo) onReadRef.current?.(); }, [demo]);

  // ── Load, and keep loading while the page is visible ─────────────────
  React.useEffect(() => {
    if (demo) return;
    let live = true;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await portalLoadChat(token);
      if (!live) return;
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setError(null);
      setView((v) => ({ ...res, messages: merge(res.messages, v?.messages ?? []) }));
      // Reading is seeing: mark read only when something new from the team has arrived.
      const newest = [...res.messages].reverse().find((m) => m.author === 'team')?.createdAt ?? null;
      if (newest && newest !== seen.current) {
        seen.current = newest;
        void portalMarkRead(token);
        onReadRef.current?.();
      }
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    const onVisible = () => { void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, demo]);

  // ── Send ───────────────────────────────────────────────────────────────
  const deliver = async (pendingId: string, body: string) => {
    const res = demo
      ? await new Promise<{ message: ChatMessage }>((r) => setTimeout(() => r({ message: {
          id: tempId(), projectId: 'demo', author: 'client', authorName: demo.names.client, body,
          createdAt: new Date().toISOString(), editedAt: null, deleted: false,
        } }), 250))
      : await portalSendMessage(token, body);
    setView((v) => {
      if (!v) return v;
      if ('error' in res) return { ...v, messages: v.messages.map((m) => (m.id === pendingId ? { ...m, failed: true } : m)) };
      const rest = v.messages.filter((m) => m.id !== pendingId);
      return { ...v, messages: rest.some((m) => m.id === res.message.id) ? rest : [...rest, res.message] };
    });
  };

  const onSend = (body: string) => {
    if (!view) return;
    const id = tempId();
    setView({
      ...view,
      messages: [...view.messages, {
        id, projectId: 'portal', author: 'client', authorName: view.names.client, body,
        createdAt: new Date().toISOString(), editedAt: null, deleted: false, pending: true,
      }],
    });
    void deliver(id, body);
  };

  const onRetry = (m: ChatMessage) => {
    setView((v) => (v ? { ...v, messages: v.messages.map((x) => (x.id === m.id ? { ...x, failed: false } : x)) } : v));
    void deliver(m.id, m.body);
  };

  if (error && !view) {
    return <p className="py-10 text-center text-ui text-ink-700" role="alert">{error}</p>;
  }

  return (
    // A fixed-height card: the portal scrolls as a document, and a conversation needs its own
    // scroll with the composer pinned under it.
    <div className={cardClass('flex h-[min(70vh,640px)] flex-col overflow-hidden')}>
      {!view ? (
        <div className="flex-1" aria-busy="true" />
      ) : (
        <>
          <MessageList
            messages={view.messages}
            me="client"
            lastReadAt={view.lastReadAt}
            onRetry={onRetry}
            empty={
              <EmptyState
                illustration={<Icon icon={MessageCircle} size={20} />}
                title={`Message ${studio}`}
                description="Ask anything — they’ll see it straight away."
              />
            }
          />
          <Composer placeholder={`Message ${studio}`} onSend={onSend} />
        </>
      )}
    </div>
  );
}
