'use client';
// ── MESSAGES — THE CLIENT'S SIDE ───────────────────────────────────────────
//
// The same conversation the owner sees, drawn and driven by the same <Conversation>, reached
// through the portal link instead of an account (CHAT_PLAN.md). This file owns only the client's
// TRANSPORT: how messages arrive (a poll) and how actions reach the server (the token actions).
//
// ── WHY A POLL, NOT A SOCKET ───────────────────────────────────────────────
// The owner's side streams over realtime because RLS scopes the stream to their own projects. A
// client has no account and so no RLS identity; streaming to them would need an anonymous read
// policy, which would hand every project's messages to anyone holding the public anon key. So the
// client asks, through the token action, every few seconds while the page is VISIBLE — and at once
// on returning to the tab. Every ask re-checks the token, so turning the portal off ends the
// conversation for them on the next beat.

import * as React from 'react';
import { MessageCircle } from '@/components/ds/icons';
import { EmptyState, Icon, cardClass } from '@/components/ds/ui';
import { tempId } from '@/lib/temp-id';
import type { ChatMessage } from '@/lib/chat';
import {
  portalDeleteMessage, portalEditMessage, portalLoadChat, portalLoadOlder, portalMarkRead, portalSendMessage,
  type ChannelView,
} from '@/lib/actions/chat';
import { Conversation, type ConversationApi } from './conversation';

/** Often enough that a reply feels prompt; rare enough that an open tab costs next to nothing. */
const POLL_MS = 4000;

/**
 * A poll's answer, folded into what this browser already holds. The poll returns only the LATEST
 * page, so three kinds of local message must survive it:
 *   · history the client scrolled up to load (older than anything in the page) — dropping it would
 *     yank the view out from under them every four seconds;
 *   · their own sends the server has not confirmed yet;
 *   · failed sends, which wait for Retry.
 */
export function mergePoll(server: ChatMessage[], local: ChatMessage[]): ChatMessage[] {
  const ids = new Set(server.map((m) => m.id));
  const oldestServer = server[0]?.createdAt;
  const history = oldestServer
    ? local.filter((m) => !m.pending && !m.failed && !ids.has(m.id) && m.createdAt < oldestServer)
    : [];
  const unconfirmed = local.filter((m) => (m.pending || m.failed) && !ids.has(m.id)
    // An echo: the send landed and the server row is already here under its real id.
    && !(m.pending && server.some((s) => s.author === 'client' && s.body === m.body && !local.some((l) => l.id === s.id))));
  return [...history, ...server, ...unconfirmed];
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
      setView((v) => {
        // Once older history is loaded, whether MORE exists is known from that history, not from
        // the latest page (which always says "there is more" once a conversation outgrows it).
        const oldest = res.messages[0]?.createdAt;
        const holdsHistory = !!v && !!oldest && v.messages.some((m) => !m.pending && !m.failed && m.createdAt < oldest);
        return { ...res, messages: mergePoll(res.messages, v?.messages ?? []), hasMore: holdsHistory ? v!.hasMore : res.hasMore };
      });
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

  // ── The transport. Everything a conversation DOES lives once in <Conversation>. ──
  const api = React.useMemo<ConversationApi>(() => (demo ? portalDemoApi(demo) : {
    send: (body) => portalSendMessage(token, body),
    edit: (id, body) => portalEditMessage(token, id, body),
    remove: (id) => portalDeleteMessage(token, id),
    older: (before) => portalLoadOlder(token, before),
  }), [token, demo]);

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
        <Conversation
          view={view}
          setView={setView}
          me="client"
          api={api}
          placeholder={`Message ${studio}`}
          empty={
            <EmptyState
              illustration={<Icon icon={MessageCircle} size={20} />}
              title={`Message ${studio}`}
              description="Ask anything and they’ll see it straight away."
            />
          }
        />
      )}
    </div>
  );
}

/** The harness's client-side transport: the same contract, answered locally after a beat. */
function portalDemoApi(demo: ChannelView): ConversationApi {
  const beat = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
  const known = new Map(demo.messages.map((m) => [m.id, m]));
  return {
    send: (body) => {
      const message: ChatMessage = {
        id: tempId(), projectId: 'demo', author: 'client', authorName: demo.names.client, body,
        createdAt: new Date().toISOString(), editedAt: null, deleted: false,
      };
      known.set(message.id, message);
      return beat({ message });
    },
    edit: (id, body) => {
      const m = known.get(id);
      if (!m || m.author !== 'client') return beat({ error: 'You can only edit your own messages.' });
      const message = { ...m, body, editedAt: new Date().toISOString() };
      known.set(id, message);
      return beat({ message });
    },
    remove: () => beat({ ok: true as const }),
    older: () => beat({ messages: [], hasMore: false }),
  };
}
