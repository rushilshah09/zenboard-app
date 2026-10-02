'use client';
// ── ONE CONVERSATION, TWO SURFACES ──────────────────────────────────────────
//
// Ask can be reached two ways on purpose — the roomy one on Home (a mode beside the dashboard,
// from the user's own wireframe) and the quick one anywhere else (the side panel, ⌘K's
// fall-through row, the A key). What it must NOT be is two conversations.
//
// So the transcript lives HERE, in a module store, exactly like the meeting recorder's
// (`components/meetings/recording.ts`) and for the same reason: the thing that must survive both a
// navigation and an unmount cannot live in a component. Ask something in the panel, switch Home to
// Ask, and it is the same conversation with the same history — which is what a person means by
// "the chat", and the opposite of the "another place to manage" failure PRODUCT_CONTEXT warns about.
//
// `useSyncExternalStore` rather than a context provider: the store outlives every subscriber, and a
// provider would have to be mounted above both the shell and Home, which is a wrapper around the
// whole app for state two components read.

import { useSyncExternalStore } from 'react';

import type { AskAnswer, AskStep } from '@/lib/actions/ask';

/** One exchange. `said` is kept beside the answer because an offer shows it back as its receipt. */
export type Turn = {
  id: string;
  said: string;
  /**
   * `trace` is the reasoning behind this answer (lib/actions/ask.ts), carried alongside the union
   * rather than inside it so every `kind` can have one. Optional because the acts that continue a
   * turn — running an offer, picking from a `choose` — answer WITHOUT re-reading the sentence, and
   * a trace copied onto them would describe a decision they did not make.
   */
  answer: (AskAnswer & { trace?: AskStep[] }) | null;
  /** The answer has been asked for and has not arrived. */
  pending?: boolean;
};

export type AskState = {
  turns: Turn[];
  /** An act is in flight, so nothing in the conversation can be pressed twice. */
  busy: boolean;
  /**
   * The row in `ask_conversations` these turns are being filed under, or null when there is not
   * one yet — the first answer creates it, and an unmigrated database never gets one at all.
   *
   * It lives in the STORE rather than in the rail because the store is what both surfaces share
   * (Home and the side panel), and filing has to work the same from either. A conversation id
   * held by the rail would mean the panel wrote to a different conversation than the one the rail
   * was showing, which is the "two conversations" failure this file's header already forbids.
   */
  conversationId: string | null;
  /**
   * When this conversation began, as an ISO instant — what the transcript's header says.
   *
   * It is the FIRST turn's moment, not the latest: a transcript is a record of a sitting, and a
   * header that re-stamped itself on every answer would make a conversation look like it had only
   * just started every time you spoke. `null` until something is said, because an empty
   * conversation has no beginning yet.
   */
  startedAt: string | null;
  /**
   * When something was last SAID in this conversation, as an ISO instant — or null when nothing has
   * been said in this browser.
   *
   * It is `startedAt`'s opposite number and exists for the rail. The rail groups by day and orders
   * by recency, and the server's `last_message_at` is one round trip behind the sentence you just
   * sent — so continuing Tuesday's chat would leave its row under "Tue 23 Sep" while you were
   * plainly talking in it today. `startedAt` cannot do this job: for a conversation read back from
   * the rail it is Tuesday, which is the right answer to a different question.
   *
   * Null after `load`, deliberately: for a conversation nobody has spoken in since it was opened,
   * the server's own `last_message_at` is the truth and a client guess would only be able to be
   * wrong.
   */
  lastTurnAt: string | null;
};

const EMPTY: AskState = { turns: [], busy: false, conversationId: null, startedAt: null, lastTurnAt: null };

let state: AskState = EMPTY;
const listeners = new Set<() => void>();

const emit = () => { for (const l of listeners) l(); };

/**
 * A PARTIAL update, merged.
 *
 * It used to take a whole `AskState`, and every caller spelled out every field — which was fine
 * with two fields and became a trap with three: `conversationId` would have been dropped by any
 * call that forgot it, and the next turn would have quietly started a SECOND conversation for the
 * same exchange. Merging makes forgetting impossible rather than something to remember.
 */
const set = (next: Partial<AskState>) => {
  state = { ...state, ...next };
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/**
 * The store's reader.
 *
 * The server snapshot is the SAME frozen `EMPTY` on every call, not a fresh object: a new one each
 * time is a new reference each time, which React treats as a change and reports as an infinite
 * loop during hydration.
 */
export const useAskState = (): AskState => useSyncExternalStore(subscribe, () => state, () => EMPTY);

export const askStore = {
  get: () => state,

  /** A new turn, asked. Returns its id so the answer can be attached to it. */
  start(said: string): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    set({
      turns: [...state.turns, { id, said, answer: null, pending: true }],
      busy: true,
      // Stamped on the FIRST turn only — `??=` in effect, because this is when the sitting began.
      startedAt: state.startedAt ?? now,
      // Stamped on EVERY turn, which is the whole difference between the two fields.
      lastTurnAt: now,
    });
    return id;
  },

  /** What came back. Replaces whatever that turn was showing, so a transcript is never a lie. */
  answer(id: string, answer: AskAnswer) {
    set({ turns: state.turns.map((t) => (t.id === id ? { ...t, answer, pending: false } : t)), busy: false });
  },

  /** Which conversation these turns are filed under, for the write path. */
  conversationId: () => state.conversationId,

  /** The first answer created a conversation; every later turn is filed under the same one. */
  setConversation(id: string | null) {
    set({ conversationId: id });
  },

  /**
   * Show a conversation read back from the database.
   *
   * It REPLACES the transcript rather than appending to it — opening a chat in the rail is going
   * somewhere, not continuing here, and a transcript that mixed two conversations would file the
   * next answer under whichever one happened to be last.
   */
  load(id: string, turns: Turn[], startedAt: string | null = null) {
    set({ turns, busy: false, conversationId: id, startedAt, lastTurnAt: null });
  },

  /** An act on a turn has begun (accepting an offer, choosing an option). */
  working(on: boolean) {
    set({ ...state, busy: on });
  },

  /** Replace a turn's answer without touching `busy` — an optimistic tick, or a dismissal. */
  revise(id: string, revise: (answer: AskAnswer | null) => AskAnswer | null) {
    set({ ...state, turns: state.turns.map((t) => (t.id === id ? { ...t, answer: revise(t.answer) } : t)) });
  },

  /** Start again. The records a command made stay; only the transcript goes. */
  /**
   * Start again — a NEW conversation, not an emptied one.
   *
   * `conversationId` has to go with the turns. Keeping it would file the next answer under the
   * conversation the person just walked away from, so "New chat" would append to the old one and
   * the rail would show the same row moving to the top with a stranger's message in it.
   */
  clear() {
    set(EMPTY);
  },
};

/** An answer's tasks, with one flipped — used for the optimistic tick and its exact inverse. */
export const withTaskDone = (answer: AskAnswer | null, id: string, done: boolean): AskAnswer | null =>
  answer?.kind === 'tasks'
    ? { ...answer, tasks: answer.tasks.map((t) => (t.id === id ? { ...t, done } : t)) }
    : answer;
