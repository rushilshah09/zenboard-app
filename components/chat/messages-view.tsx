'use client';
// ── MESSAGES — THE OWNER'S SIDE ────────────────────────────────────────────
//
// Slack's shape in the house's hub: channels in the rail, grouped by client the way Slack groups
// channels into sections; the open conversation beside it. A channel is a PROJECT (CHAT_PLAN.md:
// the portal token is a project token, so the security boundary sits where the portal's already is).
//
// ── DELIVERY ──────────────────────────────────────────────────────────────
// This view keeps its OWN realtime subscription and writes arrivals straight into state. It does
// not ride the shared `RealtimeSync`, which answers every change with `router.refresh()` — a full
// server re-render measured at ~1.2s. A chat that re-rendered the page on every message would feel
// like a form, not a conversation. One subscription covers every channel: RLS already limits it to
// this owner's projects, and an arrival on a channel you are NOT in raises that channel's count.
//
// ── SWITCHING CHANNELS ────────────────────────────────────────────────────
// Instant, with no entrance: you switch channels dozens of times a day, and Slack does not animate
// it either (Emil's frequency rule). The header changing is the confirmation.
//
// `demo` gates every network path, for the auth-free preview harness (the house pattern).

import * as React from 'react';
import { Hash, MessageCircle } from '@/components/ds/icons';
import { Count, EmptyState, Icon } from '@/components/ds/ui';
import { HubLayout } from '@/components/ui/hub-layout';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { tempId } from '@/lib/temp-id';
import { toMessage, type ChatMessage } from '@/lib/chat';
import {
  deleteMessage, editMessage, loadChannel, loadOlder, markChannelRead, sendMessage, type ChannelView,
} from '@/lib/actions/chat';
import type { Channel } from '@/lib/chat-channels';
import { Conversation, type ConversationApi } from './conversation';

export type MessagesDemo = { views: Record<string, ChannelView>; older?: Record<string, ChatMessage[]> };

export function MessagesView({
  initialChannels,
  initialChannelId,
  tz,
  demo,
}: {
  initialChannels: Channel[];
  initialChannelId: string | null;
  tz?: string;
  demo?: MessagesDemo;
}) {
  const [channels, setChannels] = React.useState(initialChannels);
  const [activeId, setActiveId] = React.useState<string | null>(initialChannelId ?? initialChannels[0]?.projectId ?? null);
  const [view, setView] = React.useState<ChannelView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const active = channels.find((c) => c.projectId === activeId) ?? null;

  // Switching channels clears the pane DURING RENDER, not in an effect: an effect would paint the
  // old conversation under the new channel's header for a frame first (the house rule — reconcile
  // during render; React's own "adjusting state when a value changes").
  const [openedFor, setOpenedFor] = React.useState(activeId);
  if (openedFor !== activeId) {
    setOpenedFor(activeId);
    setView(null);
    setError(null);
  }

  // The live subscription outlives renders, so it reads the open channel through a ref — written
  // after commit, never during render.
  const activeRef = React.useRef(activeId);
  React.useEffect(() => { activeRef.current = activeId; }, [activeId]);

  // ── Open a channel ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!activeId) return;
    let live = true;
    // The record lives in the URL, replaced rather than pushed: switching channels is not
    // somewhere Back should step through (the hub URL rule).
    const url = new URL(window.location.href);
    url.searchParams.set('c', activeId);
    window.history.replaceState(window.history.state, '', url);

    const open = async () => {
      const res = demo ? (demo.views[activeId] ?? { messages: [], lastReadAt: null, names: { team: 'You', client: 'Client' } }) : await loadChannel(activeId);
      if (!live) return;
      if ('error' in res) return setError(res.error);
      setView(res);
      // Opening a channel is reading it.
      setChannels((cs) => cs.map((c) => (c.projectId === activeId ? { ...c, unread: 0 } : c)));
      if (!demo) void markChannelRead(activeId);
    };
    void open();
    return () => { live = false; };
  }, [activeId, demo]);

  // ── The harness's stand-in for the live stream ───────────────────────────
  // With no realtime in the preview, `zb:chat-demo-incoming` delivers a message exactly as the
  // stream would, so arrival behaviour (the "New messages" pill, unread counts) can be driven.
  React.useEffect(() => {
    if (!demo) return;
    const onIncoming = (e: Event) => {
      const m = (e as CustomEvent<ChatMessage>).detail;
      if (m.projectId === activeRef.current) {
        setView((v) => (v && !v.messages.some((x) => x.id === m.id) ? { ...v, messages: [...v.messages, m] } : v));
      } else {
        setChannels((cs) => cs.map((c) => (c.projectId === m.projectId ? { ...c, unread: c.unread + 1 } : c)));
      }
    };
    window.addEventListener('zb:chat-demo-incoming', onIncoming);
    return () => window.removeEventListener('zb:chat-demo-incoming', onIncoming);
  }, [demo]);

  // ── Live arrivals ──────────────────────────────────────────────────────
  React.useEffect(() => {
    if (demo) return;
    const supabase = createClient();
    const channel = supabase
      .channel('zb-chat')
      // An EDIT or a DELETE — from the client, or from this owner on another device — replaces the
      // message in place. Same stream, same RLS: only this owner's projects ever arrive.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_messages' }, (payload) => {
        const row = payload.new as Parameters<typeof toMessage>[0];
        if (row.project_id !== activeRef.current) return;
        setView((v) => (v ? { ...v, messages: v.messages.map((m) => (m.id === row.id ? toMessage(row, v.names) : m)) } : v));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages' }, (payload) => {
        const row = payload.new as Parameters<typeof toMessage>[0];
        const open = row.project_id === activeRef.current;
        if (open) {
          setView((v) => {
            if (!v || v.messages.some((m) => m.id === row.id)) return v;
            const m = toMessage(row, v.names);
            // Our own send, echoing back before its action resolved: the confirmed row takes the
            // place of the optimistic one, so the message never shows twice.
            const withoutEcho = m.author === 'team'
              ? v.messages.filter((x) => !(x.pending && x.author === 'team' && x.body === m.body))
              : v.messages;
            return { ...v, messages: [...withoutEcho, m] };
          });
          if (row.author === 'client' && document.visibilityState === 'visible') void markChannelRead(row.project_id);
        }
        setChannels((cs) => cs.map((c) => (c.projectId !== row.project_id ? c : {
          ...c,
          last: { body: row.body, at: row.created_at, author: row.author === 'team' ? 'team' : 'client' },
          unread: !open && row.author === 'client' ? c.unread + 1 : c.unread,
        })));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [demo]);

  // ── The transport: how THIS side talks to the server. Everything a conversation DOES — send,
  // retry, edit, delete, copy, history — lives once in <Conversation>. ─────────────────────
  const api = React.useMemo<ConversationApi | null>(() => {
    if (!activeId) return null;
    if (demo) return demoApi(activeId, demo);
    return {
      send: (body) => sendMessage(activeId, body),
      edit: editMessage,
      remove: deleteMessage,
      older: (before) => loadOlder(activeId, before),
    };
  }, [activeId, demo]);

  // ── The rail: channels grouped by client, like Slack's sections ───────
  const groups = React.useMemo(() => {
    const byClient = new Map<string, { name: string; channels: Channel[] }>();
    for (const c of channels) {
      const g = byClient.get(c.clientId) ?? { name: c.clientName, channels: [] };
      g.channels.push(c);
      byClient.set(c.clientId, g);
    }
    return [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [channels]);

  const rail = (
    <>
      {groups.map((g) => (
        <div key={g.name} className="mb-2">
          <div className="px-2.5 pb-1 pt-1.5 text-caption font-medium text-ink-500">{g.name}</div>
          {g.channels.map((c) => {
            const on = c.projectId === activeId;
            const unread = c.unread > 0 && !on;
            return (
              <button
                key={c.projectId}
                type="button"
                onClick={() => setActiveId(c.projectId)}
                aria-current={on ? 'true' : undefined}
                aria-label={unread ? `${c.projectName}, ${c.unread} unread` : c.projectName}
                className={cn(
                  'focus-ring flex h-[var(--row-nav)] w-full items-center gap-2 rounded-md px-2.5 text-left transition-colors duration-fast',
                  on ? 'bg-surface-active' : 'hover:bg-surface-hover',
                )}
              >
                <Icon icon={Hash} size={16} className="shrink-0 text-ink-500" />
                {/* Unread is carried by WEIGHT and a count, as in Slack — never by colour alone. */}
                <span className={cn('min-w-0 flex-1 truncate text-ui', on || unread ? 'font-medium text-ink-900' : 'text-ink-700')}>
                  {c.projectName}
                </span>
                {unread && <Count value={c.unread > 99 ? '99+' : c.unread} className="font-medium text-ink-900" />}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <HubLayout
      title={active ? active.projectName : 'Messages'}
      icon={active ? Hash : MessageCircle}
      subtitle={active ? active.clientName : undefined}
      railLabel="Conversations"
      rail={rail}
      bleed
    >
      <div className="flex h-full min-h-0 flex-col">
        {channels.length === 0 ? (
          <div className="grid flex-1 place-items-center p-6">
            <EmptyState
              illustration={<Icon icon={MessageCircle} size={20} />}
              title="No conversations yet"
              description="Each project with a client gets one here."
            />
          </div>
        ) : error ? (
          <div className="grid flex-1 place-items-center p-6 text-ui text-ink-700" role="alert">{error}</div>
        ) : !view || !active ? (
          // Loading is the empty page, not a spinner: channels open fast, and a flash of a spinner
          // reads as slower than a beat of nothing.
          <div className="flex-1" aria-busy="true" />
        ) : (
          <Conversation
            key={active.projectId}
            view={view}
            setView={setView}
            me="team"
            api={api!}
            tz={tz}
            autoFocus
            placeholder={`Message #${active.projectName}`}
            empty={
              <EmptyState
                illustration={<Icon icon={MessageCircle} size={20} />}
                title={`This is the start of #${active.projectName}`}
                description={`Shared with ${active.clientName} in their portal.`}
              />
            }
          />
        )}
      </div>
    </HubLayout>
  );
}

/**
 * The preview harness's transport: the same contract as the real one, answered locally after a
 * beat, so every path — send, edit, delete, history — can be driven without a session.
 */
function demoApi(projectId: string, demo: MessagesDemo): ConversationApi {
  const beat = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
  const names = demo.views[projectId]?.names ?? { team: 'You', client: 'Client' };
  // What this "server" holds: the fixture, plus everything sent in this session — so a message you
  // just sent can be edited, exactly as it can against the real database.
  const known = new Map((demo.views[projectId]?.messages ?? []).map((m) => [m.id, m]));
  let older = demo.older?.[projectId] ?? [];
  return {
    send: (body) => {
      const message: ChatMessage = {
        id: tempId(), projectId, author: 'team', authorName: names.team, body,
        createdAt: new Date().toISOString(), editedAt: null, deleted: false,
      };
      known.set(message.id, message);
      return beat({ message });
    },
    edit: (id, body) => {
      const m = known.get(id);
      if (!m || m.author !== 'team') return beat({ error: 'You can only edit your own messages.' });
      const message = { ...m, body, editedAt: new Date().toISOString() };
      known.set(id, message);
      return beat({ message });
    },
    remove: () => beat({ ok: true as const }),
    older: () => {
      const page = older;
      older = [];
      return beat({ messages: page, hasMore: false });
    },
  };
}
