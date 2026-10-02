'use client';
// Dev-only harness for the Home redesign (greeting · shutdown banner · highlight
// panel · schedule), staged to mirror the reference frame. 404s in prod.
import * as React from 'react';
import { useEffect } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import { TodayView, type TodayTask, type TodayEvent, type TodayHabit } from '@/components/today/today-view';
import { waitingOn } from '@/lib/waiting';
import { contentToday, type Piece } from '@/lib/content';
import { todayISO as dayId, minutesOfDayIn } from '@/lib/date';
import { isTwin } from '@/lib/timebox';
import type { Span } from '@/lib/capacity';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';
import { stubServerActions } from '@/app/dev-preview/action-stub';
import type { AskAnswer } from '@/lib/actions/ask';

const now = new Date();
const at = (h: number, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d.toISOString(); };
// THE day-id rule (lib/date.ts): a `scheduled_date` is a CALENDAR date, so this
// must never be `toISOString().slice(0, 10)` — that is the UTC date. It was, and
// in a positive-offset zone between midnight and the offset it staged every
// fixture for YESTERDAY, so "Today's plan" rendered empty and the harness looked
// like the feature was broken. Exactly the bug this vocabulary exists to stop.
const todayISO = dayId();

// A deliberately full day so the §7V capacity line + overloaded Watch line show:
// planned ≈6h (300+60) + meetings ≈2h45m > a typical 8h day.
const TASKS: TodayTask[] = [
  { id: 't1', title: 'Send invoice for July to Northwind', done: false, priority: 'high', highlight: true, estimate_minutes: 300, elapsed_minutes: 0, scheduled_date: todayISO, project_id: 'pr1', parent_task_id: null, completed_at: null, created_at: at(8), sort_order: 0 },
  { id: 't2', title: 'Prepare weekly report', done: false, priority: 'med', highlight: false, estimate_minutes: 60, elapsed_minutes: 0, scheduled_date: todayISO, project_id: null, parent_task_id: null, completed_at: null, created_at: at(9), sort_order: 1 },
  { id: 't3', title: 'Review design feedback', done: true, priority: 'low', highlight: false, estimate_minutes: 30, elapsed_minutes: 30, scheduled_date: todayISO, project_id: null, parent_task_id: null, completed_at: at(10), created_at: at(7), sort_order: 2 },
];

const EVENTS: TodayEvent[] = [
  { id: 'e1', title: 'Standup', starts_at: at(9), ends_at: at(9, 30), all_day: false, source: 'google' },
  // A TIMEBOX TWIN (0030) — `task_id` points at t1, whose 5h estimate is already
  // counted. It must NOT be charged to the day a second time, which is exactly
  // what Home did before the capacity rule was shared.
  { id: 'e2', title: 'Send invoice for July to Northwind', starts_at: at(13, 30), ends_at: at(13, 45), all_day: false, source: 'timebox', task_id: 't1' },
  { id: 'e3', title: 'Design review', starts_at: at(16), ends_at: at(18), all_day: false, source: 'manual' },
];

// The same projection the loader runs (lib/today-data.ts), so the harness and
// production agree about what counts as a meeting.
const MEETINGS: Span[] = EVENTS
  .filter((e) => !e.all_day && !!e.ends_at && !isTwin(e))
  .map((e) => ({ start: minutesOfDayIn(e.starts_at), end: minutesOfDayIn(e.ends_at) }))
  .filter((s): s is Span => s.start !== undefined && s.end !== undefined);

const HABITS: TodayHabit[] = [
  { id: 'h1', title: 'Morning walk', doneToday: true, streak: 12 },
  { id: 'h2', title: 'Inbox to zero', doneToday: false, streak: 4 },
  { id: 'h3', title: 'Read 20 minutes', doneToday: false, streak: 0 },
];

// One of each kind, plus an overdue invoice — the three sources the section
// aggregates, and the sort rule (overdue first, then oldest) is visible in the
// rendered order.
// Today's content — a shoot with a call time and a location, and something
// going out. `contentToday` is the SAME projection the calendar uses, so Home
// and /content can never disagree about what a date holds.
// A calendar date is built from LOCAL parts. `toISOString().slice(0,10)` is the
// UTC date, which is yesterday for half the world after 5pm — the exact bug
// lib/date.ts exists to stop, and a harness that models it wrong teaches it.
const TODAY_ISO = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const CONTENT_PIECES: Piece[] = [
  { id: 'c3', title: 'Studio tour, part one', meta: { stage: 'shoot', bucket: 'piece', shootAt: TODAY_ISO, callTime: '09:00', location: 'Studio' } },
  { id: 'c7', title: 'Five fonts we keep coming back to', meta: { stage: 'scheduled', bucket: 'piece', publishAt: TODAY_ISO } },
];
const CONTENT = contentToday(CONTENT_PIECES, TODAY_ISO);

const WAITING = waitingOn({
  approvals: [{ id: 'ap1', title: 'Logo — final direction', status: 'awaiting', created_at: new Date(Date.now() - 6 * 86400_000).toISOString(), project_id: 'pr1' }],
  requests: [{ id: 'rq1', title: 'Send the updated brand colours as a swatch file', body: '', status: 'needs_info', created_at: new Date(Date.now() - 2 * 86400_000).toISOString(), project_id: 'pr1' }],
  invoices: [{ id: 'in1', number: 'INV-018', status: 'sent', due_date: '2026-08-01', issue_date: '2026-07-18', client_name: 'Northwind' }],
  clientOf: { pr1: 'Northwind' },
}, new Date().toISOString().slice(0, 10));

// ── ASK'S HISTORY, STAGED ───────────────────────────────────────────────────
// The rail lives on Home and nowhere else, so this harness is the only place it can be looked at
// without a session and without migration 0049 — which is exactly what a harness is for. Everything
// here is the REAL rail, the real HubLayout collapse and the real store; only the four server
// actions behind it are answered from this script.
//
// ── HOW EACH ACTION IS TOLD APART ───────────────────────────────────────────
// `stubServerActions` sees the ARGUMENTS and nothing else — never which function was called — so
// the discrimination below is by arity and argument type, and it is written out because it is the
// part a reader cannot infer:
//
//   []                                → listAskConversations()
//   [string]                          → loadAskConversation(id)   ·and· deleteAskConversation(id)
//   [string, string]                  → renameAskConversation(id, title)
//   [string, boolean]                 → pinAskConversation(id, on)  ·and· toggleTask(id, done)
//   [string, object|null]             → ask(message, ref)
//   [string|null, string, string, ?]  → recordAskTurn(conv, said, answered, payload)
//
// The two COLLISIONS are both harmless, and that is a property of those actions rather than luck:
// delete and pin are optimistic, so the hook only reads their result to detect `error` — an answer
// shaped like the other action's is read as success, which is what the row has already shown.
const STAGED_CHATS = [
  { id: 'c-today', title: 'move the buildojo logo to friday', lastMessageAt: new Date(Date.now() - 20 * 60_000).toISOString(), pinned: false },
  { id: 'c-pinned', title: 'what am i doing today', lastMessageAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), pinned: true },
  { id: 'c-yesterday', title: 'remind me about the northwind invoice on monday', lastMessageAt: new Date(Date.now() - 26 * 3_600_000).toISOString(), pinned: false },
  { id: 'c-week', title: 'find everything for meridian coffee', lastMessageAt: new Date(Date.now() - 6 * 86_400_000).toISOString(), pinned: false },
  { id: 'c-old', title: 'add a task to send the darker palette', lastMessageAt: new Date(Date.now() - 80 * 86_400_000).toISOString(), pinned: false },
];

/** One conversation's messages, with real `createdAt`s so the transcript's day-aware stamp shows. */
const STAGED_MESSAGES: Record<string, { role: 'said' | 'answered'; body: string; payload: unknown; createdAt: string }[]> = {
  'c-yesterday': [
    { role: 'said', body: 'remind me about the northwind invoice on monday', payload: null, createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString() },
    {
      role: 'answered', body: 'I will remind you about Northwind invoice on Mon 5 Oct at 09:00',
      createdAt: new Date(Date.now() - 26 * 3_600_000 + 4_000).toISOString(),
      payload: { kind: 'did', text: 'I will remind you about Northwind invoice on Mon 5 Oct at 09:00', record: { type: 'task', id: 't3', label: 'Northwind invoice', href: '/tasks?task=t3' } } satisfies AskAnswer,
    },
  ],
};

export default function HomePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?h=<0-23> forces the staged phase; ?empty=1 clears today's tasks (plan phase).
  // ?planned=1 / ?shutdown=1 mark today's rituals done; ?leftovers=<n> seeds the
  // morning carry-over count — together these drive the three §7V stages.
  // Read from the router, as the content harness does — a mount effect that copied `location.search` into state
  // rendered once without the query and then again with it (react-hooks/set-state-in-effect).
  const q = useSearchParams();
  const hParam = q?.get('h');
  const nowHour = hParam != null && hParam !== '' ? Number(hParam) : undefined;
  const empty = q?.get('empty') === '1';
  const leftovers = Number(q?.get('leftovers') ?? 3);

  // `?chats=0` stages an account that has never asked anything, for the rail's empty line.
  // Memoised on the flag rather than computed inline: a fresh `[]` every render is a new dependency
  // every render, which would tear down and reinstall the fetch stub on each one.
  const noChats = q?.get('chats') === '0';
  const chats = React.useMemo(() => (noChats ? [] : STAGED_CHATS), [noChats]);

  useEffect(() => stubServerActions(async (args) => {
    if (args.length === 0) return chats;                                    // listAskConversations
    const [a, b, c] = args;
    if (args.length === 1 && typeof a === 'string') return STAGED_MESSAGES[a] ?? [];  // load · delete
    if (args.length === 2 && typeof a === 'string' && typeof b === 'string') return { ok: true }; // rename
    if (args.length === 2 && typeof a === 'string' && typeof b === 'boolean') return { ok: true }; // pin · toggle
    if (args.length === 2 && typeof a === 'string') {                       // ask(message, ref)
      await new Promise((r) => setTimeout(r, 500));
      return { kind: 'said', text: `Staged answer to “${a}”.` } satisfies AskAnswer;
    }
    if (args.length >= 3 && typeof b === 'string' && typeof c === 'string') {          // recordAskTurn
      // A NEW id on the first turn, the same one after — which is what makes the rail's live row
      // appear once and then stay put instead of multiplying with every question.
      return { conversationId: typeof a === 'string' ? a : 'c-new' };
    }
    return undefined;                                                        // through, and fail
  }), [chats]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)' }}>
      <TodayView
        name="Darshil"
        nowHour={nowHour}
        initialTasks={empty ? [] : TASKS}
        waiting={empty ? [] : WAITING}
        content={empty ? [] : CONTENT}
        projects={{ pr1: { id: 'pr1', name: 'Northwind', color: '#B06F2B' } }}
        subByParent={{}}
        // §7B dependencies: t2 waits on something unfinished, so it greys and
        // says why while t1 beside it stays full strength — the contrast is the
        // point, and it only reads as deliberate when both are on screen.
        blocked={['t2']}
        initialHabits={HABITS}
        events={EVENTS}
        meetings={MEETINGS}
        workHours={{ start: 9 * 60, end: 17 * 60 }}
        errors={{ tasks: false, habits: false, events: false }}
        leftovers={Number.isFinite(leftovers) ? leftovers : 0}
        // ?vacation=1 — the prompts must go quiet (§7C).
        onVacation={q?.get('vacation') === '1'}
        planned={q?.get('planned') === '1'}
        shutdown={q?.get('shutdown') === '1'}
      />
      {/* Its own <Toaster/>: dev-preview renders OUTSIDE AppShell, which owns the
          app's single one. Without it every toast this harness raises is
          invisible — including the one that says an optimistic edit was refused
          and put back, which is the ONLY report that failure ever gets. */}
      <Toaster />
      {/* And the shell's net: dev-preview has no session, so EVERY action here
          throws — without this the harness silently keeps edits that failed. */}
      <ActionFailureNet />
    </div>
  );
}
