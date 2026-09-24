'use client';
// Dev-only harness for Focus mode's CENTRE — staged data so the focused task,
// the visible "Up next" list, and the two different empty sentences can be
// verified without a session. 404s in prod.
//
// It cannot exercise the stripped SHELL, because that is derived from the real
// pathname (lib/focus-mode.ts) and this page is not /focus. The predicate has
// its own unit tests instead; what needs eyes here is what Focus shows.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { FocusView, type FocusTask } from '@/components/focus/focus-view';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';

const TASKS: FocusTask[] = [
  { id: 'f1', title: 'Finish the pricing page copy', done: false, priority: 'high', highlight: false, estimate_minutes: 45, elapsed_minutes: 0, project_id: 'p1', notes: null },
  { id: 'f2', title: 'Send Balluji the revised timeline', done: false, priority: 'med', highlight: false, estimate_minutes: 15, elapsed_minutes: 0, project_id: 'p1', notes: null },
  { id: 'f3', title: 'Book the studio for Thursday', done: false, priority: 'low', highlight: false, estimate_minutes: null, elapsed_minutes: 0, project_id: null, notes: null },
  { id: 'f4', title: 'Reply to the tax email', done: true, priority: 'low', highlight: false, estimate_minutes: 10, elapsed_minutes: 10, project_id: null, notes: null },
];

const PROJECTS = { p1: { id: 'p1', name: 'Balluji', color: '#9A1B6F' } };
const SUBS = { f1: [{ id: 's1', title: 'Rewrite the hero line', done: false }, { id: 's2', title: 'Cut the third tier', done: true }] };

// The three states worth looking at: work to do, everything finished, and a day
// with nothing on it. The last two must NOT say the same sentence.
const STATES = ['working', 'all done', 'empty'] as const;

// ONE reference per state, at module scope. `FocusView` follows its props with
// `useServerState`, which compares by reference — so a `TASKS.map(...)`, `[]` or
// `{}` written inline is a new value on every render of this page and would snap
// the view back, silently undoing any tick made in the harness.
const TASKS_BY_STATE: Record<(typeof STATES)[number], FocusTask[]> = {
  working: TASKS,
  'all done': TASKS.map((t) => ({ ...t, done: true })),
  empty: [],
};
const NO_SUBS: typeof SUBS = {} as typeof SUBS;

export default function FocusPreviewPage() {
  const [state, setState] = useState<(typeof STATES)[number]>('working');
  if (process.env.NODE_ENV === 'production') notFound();


  return (
    <div style={{ height: '100dvh', background: 'var(--paper)' }}>
      <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 99, display: 'flex', gap: 4 }}>
        {STATES.map((s) => (
          <button key={s} data-testid={`state-${s}`} onClick={() => setState(s)}
            style={{ fontSize: 11, opacity: state === s ? 1 : 0.45 }}>{s}</button>
        ))}
      </div>
      <FocusView key={state} initialTasks={TASKS_BY_STATE[state]} subsByTask={state === 'working' ? SUBS : NO_SUBS} projects={PROJECTS} />
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
