'use client';
// ── THE RAIL'S STATE ────────────────────────────────────────────────────────
//
// What the history rail needs to draw itself, and what its rows do when pressed. Split from the
// rail so the rail stays a component that renders rows — the same division `hub-layout.tsx` makes
// between geometry and composition.
//
// ── IT LOADS WHEN ASK IS OPENED, NOT WHEN HOME IS ───────────────────────────
// Home's loader is deliberately ONE wave of queries (see its header), and Ask is a mode you switch
// into. Reading a conversation list on every Home render would put a query nobody asked for in
// front of the page everybody opens — the exact cost [[zenboard-perf-round-trips]] is about. So
// the fetch happens on first entry to Ask, once, and the result is held for the life of the page.
//
// ── THE LIST RECONCILES ITSELF, IT IS NOT PUSHED TO ─────────────────────────
// There used to be a `bump(id, title)` for the send path to call when a conversation was created.
// Nothing ever called it, so asking your first question filed a conversation, selected it, and left
// the rail saying "Your chats will appear here" while you sat in the chat it was describing — the
// list and the store only agreed after a reload, which is the one moment nobody checks.
//
// Now the store's own conversation is folded into the list by `withLive` (lib/ask-history.ts) from
// an effect that watches it. There is no call to forget, and a conversation started from the SIDE
// PANEL turns up in Home's rail for free, because both surfaces share the one store.
//
// ── WHICH CONVERSATION IS OPEN LIVES IN THE URL ─────────────────────────────
// `?chat=<id>`, by `useRecordParam` — `replaceState`, because choosing a conversation is choosing a
// RECORD and flicking through six of them must not bury the page you arrived from under six Back
// presses ([[zenboard-hub-url-rule]], lib/hub-url.ts). The rail's own header has promised this
// since it was written; until now nothing implemented it, so a chat was not linkable and a reload
// lost your place.
//
// The URL follows the STORE rather than the rail's own clicks, which is what makes it true from
// either surface: ask something in the side panel while Home is behind it and the address bar names
// the conversation you are actually in.
//
// ── EVERY WRITE IS OPTIMISTIC, AND EVERY FAILURE PUTS IT BACK ───────────────
// Rename, pin and delete all change the list first and reconcile after, because the rail is a
// thing you flick through. When a write is refused the row goes back and the person is told —
// silently keeping an edit the server rejected is the data-loss shape [[zenboard-mutation-queue]]
// exists to prevent.
import * as React from 'react';

import { toastReverted } from '@/components/ds/ui';
import {
  deleteAskConversation, listAskConversations, loadAskConversation,
  pinAskConversation, renameAskConversation,
} from '@/lib/actions/ask-history';
import { useRecordParam } from '@/lib/hub-url';
import { askStore, useAskState, type Turn } from '@/lib/ask-store';
import { titleFor, withLive, type AskConversation, type LiveConversation } from '@/lib/ask-history';
import type { AskAnswer, AskStep } from '@/lib/actions/ask';

type StoredMessage = { role: 'said' | 'answered'; body: string; payload: unknown; createdAt: string };

/**
 * Stored message pairs, back into the turns the transcript renders — and the instant the sitting
 * began, which is the first message's and heads the transcript.
 */
function toTurns(rows: readonly StoredMessage[]): { turns: Turn[]; startedAt: string | null } {
  const turns: Turn[] = [];
  for (const row of rows) {
    if (row.role === 'said') {
      turns.push({ id: `${turns.length}-said`, said: row.body, answer: null });
      continue;
    }
    // An answer belongs to the question above it. A stored answer with no question before it is
    // not dropped — it becomes its own turn with an empty prompt, because showing an orphan is
    // honest and hiding it looks like the conversation lost a reply.
    const open = turns[turns.length - 1];
    const answer = (row.payload ?? { kind: 'said', text: row.body }) as AskAnswer & { trace?: AskStep[] };
    if (open && open.answer === null) open.answer = answer;
    else turns.push({ id: `${turns.length}-answered`, said: '', answer });
  }
  return { turns, startedAt: rows[0]?.createdAt ?? null };
}

export function useAskHistory({ active }: { active: boolean }) {
  const { conversationId, turns, startedAt, lastTurnAt, busy } = useAskState();
  const [conversations, setConversations] = React.useState<AskConversation[]>([]);
  const [urlChat, setUrlChat] = useRecordParam('chat');
  const loaded = React.useRef(false);

  React.useEffect(() => {
    if (!active || loaded.current) return;
    loaded.current = true;
    void listAskConversations().then(setConversations);
  }, [active]);

  const select = React.useCallback(async (id: string) => {
    if (id === askStore.conversationId()) return;
    // The transcript is replaced only once the rows are here: clearing first would blank the
    // screen for the length of a round trip and then fill it, which reads as a bug on a fast
    // connection and as a broken link on a slow one.
    const rows = await loadAskConversation(id);
    // NO ROWS MEANS NO CONVERSATION. Every conversation is created in the same breath as its first
    // two messages (`recordAskTurn`), so an empty read is one that has been deleted, or belongs to
    // somebody else, or is being asked for before the migration exists. Loading it would put the
    // person in an empty transcript wearing that id — and file their next answer into it. The link
    // is dropped instead, which leaves them on a new chat.
    if (rows.length === 0) {
      setUrlChat(null);
      return;
    }
    const { turns: read, startedAt: began } = toTurns(rows);
    askStore.load(id, read, began);
  }, [setUrlChat]);

  // ── THE LINK, HONOURED ONCE ────────────────────────────────────────────────────────────────
  // `?chat=<id>` in the address bar is a conversation somebody opened on purpose, so entering Ask
  // opens it. Once: after this the store is the truth and the effect below keeps the URL in step,
  // and re-running the restore would fight the person every time they pressed "New chat".
  //
  // `settled` is STATE and not the ref beside it, and the difference is a bug the browser caught.
  // The ref flips synchronously, before the round trip it starts — so the effect below ran in the
  // same commit, saw an empty store against a `?chat=` that had not loaded yet, and STRIPPED the
  // link it was in the middle of opening. The conversation still arrived; the address bar was left
  // saying nothing, so the page you could send somebody was no longer the page you were on.
  // A restore is not over when it begins.
  //
  // The initialiser is LAZY, so "is there a link to honour at all" is answered once, on the first
  // render, from the URL as it arrived. That is also what keeps the nothing-to-restore case out of
  // an effect: settling synchronously inside one is the cascading render `useServerState`'s header
  // is about, and `react-hooks/set-state-in-effect` is right to call it a defect.
  const started = React.useRef(false);
  const [settled, setSettled] = React.useState(() => !urlChat || urlChat === askStore.conversationId());
  React.useEffect(() => {
    if (!active || settled || started.current || !urlChat) return;
    started.current = true;
    void select(urlChat).finally(() => setSettled(true));
  }, [active, settled, urlChat, select]);

  // ── AND THEN THE URL FOLLOWS THE STORE ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!active || !settled) return;
    if (conversationId !== urlChat) setUrlChat(conversationId);
  }, [active, settled, conversationId, urlChat, setUrlChat]);

  /**
   * The conversation being had RIGHT NOW, for `withLive` — before the server's list has heard of it.
   *
   * `lastTurnAt` first: it is when something was last SAID, so continuing Tuesday's chat moves its
   * row to Today rather than leaving it under Tuesday while you type in it. `startedAt` is the
   * fallback for a conversation read back from the rail and not yet spoken in.
   */
  const live = React.useMemo<LiveConversation | null>(() => {
    const at = lastTurnAt ?? startedAt;
    if (!conversationId || !at) return null;
    return { id: conversationId, title: titleFor(turns[0]?.said ?? ''), at };
  }, [conversationId, lastTurnAt, startedAt, turns]);

  // ── AND IT IS COMMITTED TO THE LIST, NOT LAID OVER IT ──────────────────────────────────────
  // This was a derived overlay — `withLive(conversations, live)` computed at render — and the
  // browser caught what that misses: start a chat, then open Tuesday's from the rail, and the one
  // you had just started VANISHED, because the overlay only ever described the CURRENT
  // conversation and the server's list had never heard of it. It came back on reload, which is the
  // worst version of the bug the overlay was written to fix.
  //
  // Folding it into the list instead makes the rail cumulative, which is what it is: every
  // conversation this browser has started or spoken in stays in it.
  //
  // DURING RENDER, not in an effect — this is `lib/use-server-state.ts`'s rule applied to a second
  // kind of incoming fact, and its header is the argument: an effect runs after paint, so React
  // would commit the rail WITHOUT the new row, then set state and render it a frame later. Setting
  // state during render is legal because it is this component's own state; React restarts the
  // render rather than scheduling another, and nothing stale is ever shown.
  //
  // `folded` is the `seen` of that pattern — the last `live` we acted on. `withLive` returns the
  // array it was given when there is nothing to change, so the row itself is untouched when only
  // the clock moved.
  const [folded, setFolded] = React.useState<LiveConversation | null>(null);
  if (live && !Object.is(folded, live)) {
    setFolded(live);
    setConversations((prev) => withLive(prev, live));
  }

  const start = React.useCallback(() => { askStore.clear(); }, []);

  const rename = React.useCallback(async (id: string, title: string) => {
    const before = conversations;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    const res = await renameAskConversation(id, title);
    if ('error' in res) { setConversations(before); toastReverted(res.error); }
  }, [conversations]);

  const pin = React.useCallback(async (id: string, pinned: boolean) => {
    const before = conversations;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)));
    const res = await pinAskConversation(id, pinned);
    if ('error' in res) { setConversations(before); toastReverted(res.error); }
  }, [conversations]);

  const remove = React.useCallback(async (id: string) => {
    const before = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    // Deleting the conversation you are READING empties the transcript too, or the page would go
    // on showing a chat that no longer exists and file the next answer into nothing. The URL
    // follows by the effect above, so the address bar cannot go on naming a deleted row.
    if (id === conversationId) askStore.clear();
    const res = await deleteAskConversation(id);
    if ('error' in res) { setConversations(before); toastReverted(res.error); }
  }, [conversations, conversationId]);

  // `busy` is passed straight through because the rail DECLARES a guard on it ("an answer is in
  // flight, so nothing that would abandon it can be pressed") and was never given the value — so
  // New chat could be pressed mid-answer and the reply arrived into a conversation that had been
  // cleared. A prop nobody passes is a guard that does not exist.
  return { conversations, selectedId: conversationId, busy, select, start, rename, pin, remove };
}
