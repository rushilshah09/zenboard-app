'use client';
// Dev-only harness for the ritual flows — seeds today's tasks + habits so the
// daily_plan flow (incl. the habits step and §7C's capacity step) can be
// verified without a session. Server actions error without auth (expected); the
// UI + optimistic state are what's under test. 404s in prod.
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { RitualFlow, type RTask, type RHabit, type RGoal, type RitualType } from '@/components/rituals/ritual-flow';
import { todayISO, addDaysISO } from '@/lib/date';
import type { Span, WorkHours } from '@/lib/capacity';

const TYPES: RitualType[] = ['daily_plan', 'daily_shutdown', 'weekly_review'];

const TASKS: RTask[] = [
  { id: 't1', title: 'Finalize the logo direction', done: false, highlight: false, estimate_minutes: 90, priority: 'high' },
  { id: 't2', title: 'Reply to Priya about scope', done: false, highlight: false, estimate_minutes: 15, priority: 'med' },
  { id: 't3', title: 'Invoice Meridian Studio', done: true, highlight: false, estimate_minutes: 20, priority: 'low' },
];

/**
 * The capacity step's four states, because each renders differently and only
 * one of them is the happy path.
 *
 * `over` is deliberately built so the LOW-priority tasks cannot cover the
 * overage between them — that is the tier-boundary case from `deferSuggestion`,
 * where a naive greedy reaches into the high-priority work and offers to move
 * the most important thing on the list.
 */
const LOADS: Record<string, { tasks: RTask[]; meetings: Span[] }> = {
  fits: { tasks: TASKS, meetings: [{ start: 10 * 60, end: 11 * 60 }] },
  over: {
    tasks: [
      { id: 'o1', title: 'Rebuild the pricing page', done: false, highlight: false, estimate_minutes: 240, priority: 'high' },
      { id: 'o2', title: 'Client workshop prep', done: false, highlight: false, estimate_minutes: 180, priority: 'high' },
      { id: 'o3', title: 'Tidy the asset library', done: false, highlight: false, estimate_minutes: 120, priority: 'low' },
      { id: 'o4', title: 'Update the changelog', done: false, highlight: false, estimate_minutes: 60, priority: 'low' },
    ],
    meetings: [{ start: 9 * 60, end: 10 * 60 }, { start: 14 * 60, end: 15 * 60 }],
  },
  // Nothing estimated: the bar is empty, and the step has to say why rather
  // than implying the day is wide open.
  noestimates: {
    tasks: [
      { id: 'n1', title: 'Look at the brief', done: false, highlight: false, estimate_minutes: null, priority: 'med' },
      { id: 'n2', title: 'Call the printer', done: false, highlight: false, estimate_minutes: null, priority: 'low' },
    ],
    meetings: [],
  },
  // Meetings only — no tasks to weigh against them, which is its own state.
  meetingsonly: { tasks: [], meetings: [{ start: 11 * 60, end: 13 * 60 }] },
};

// Three shapes the §7G glance has to handle: healthy linked work, a behind goal,
// and one with nothing linked at all (the "link some work, or drop it" branch).
const GOALS: RGoal[] = [
  { id: 'g1', title: 'Land three retainer clients', behind: false, progress: 0.6, linkedDone: 6, linkedTotal: 10 },
  { id: 'g2', title: 'Ship the new portfolio', behind: true, progress: 0.2, linkedDone: 1, linkedTotal: 5 },
  { id: 'g3', title: 'Learn motion design', behind: false, progress: 0, linkedDone: 0, linkedTotal: 0 },
];

// Only habits DUE today reach the ritual, so this list is already filtered — the
// route does that with lib/habit-schedule.ts. `h4` is the counted case: a partial
// tally has to survive into the ritual rather than collapsing to an empty box.
const HABITS: RHabit[] = [
  { id: 'h1', title: 'Morning walk', done: false, goalTarget: 1, count: 0 },
  { id: 'h2', title: 'Read 20 minutes', done: true, goalTarget: 1, count: 1 },
  { id: 'h3', title: 'No phone before noon', done: false, goalTarget: 1, count: 0 },
  { id: 'h4', title: 'Drink water', done: false, goalTarget: 8, count: 3 },
];

export default function RitualsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?type=daily_plan | daily_shutdown | weekly_review — the flow under test.
  const [type, setType] = useState<RitualType>('daily_plan');
  // ?v2=1 simulates migration 0026 being applied (unlocks 'Park it').
  const [goalsV2, setGoalsV2] = useState(false);
  // ?load=fits|over|noestimates|meetingsonly — the capacity step's states.
  const [load, setLoad] = useState('fits');
  // ?hours=9-17 — the day the plan is measured against.
  const [hours, setHours] = useState<WorkHours>({ start: 9 * 60, end: 17 * 60 });
  // ?habits=0 drops the rhythm step, so the numbering can be checked with and
  // without it — the flow is a computed list now, not arithmetic in two places.
  const [withHabits, setWithHabits] = useState(true);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('type') as RitualType | null;
    if (t && TYPES.includes(t)) setType(t);
    setGoalsV2(q.get('v2') === '1');
    const l = q.get('load');
    if (l && LOADS[l]) setLoad(l);
    setWithHabits(q.get('habits') !== '0');
    const h = q.get('hours')?.match(/^(\d{1,2})-(\d{1,2})$/);
    if (h) setHours({ start: Number(h[1]) * 60, end: Number(h[2]) * 60 });
  }, []);

  // Calendar dates from the LOCAL day, never `toISOString().slice(0, 10)` —
  // that is the UTC date, so after local midnight in a positive-offset zone the
  // fixtures stage yesterday and the flow renders against the wrong day. Third
  // time this trap has turned up in a harness.
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const { tasks, meetings } = LOADS[load];

  return (
    <RitualFlow
      // The flow seeds its task state from `todayTasks` on first render, and
      // these params only resolve in an effect after mount — so without a key
      // the harness would always render the default load. In the real route the
      // server passes the right data on the first render and there is no key.
      key={`${type}:${load}:${withHabits}:${hours.start}-${hours.end}`}
      type={type}
      todayTasks={type === 'daily_plan' ? tasks : TASKS}
      goals={GOALS}
      habits={withHabits ? HABITS : []}
      todayISO={today}
      tomorrowISO={tomorrow}
      goalsV2={goalsV2}
      workHours={hours}
      meetings={meetings}
    />
  );
}
