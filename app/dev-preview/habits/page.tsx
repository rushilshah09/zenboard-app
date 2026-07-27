'use client';
// Dev-only harness for the redesigned Habits journal — staged habits across
// times of day + goals + a skipped one, so the grouping, complete/skip, goal
// labels, streaks and add form can be verified without a session. Server actions
// error on persist here; optimistic UI is what's under test. 404s in prod.
import { notFound } from 'next/navigation';
import { HabitsJournal } from '@/components/habits/habits-board';
import type { HabitsBoard } from '@/lib/habits-data';

const BOARD: HabitsBoard = {
  date: new Date().toISOString().slice(0, 10),
  supported: true,
  error: false,
  habits: [
    { id: 'h1', title: 'Morning walk', timeOfDay: 'morning', goalTarget: 1, goalPeriod: 'day', color: null, status: 'done', streak: 5 },
    { id: 'h2', title: 'Meditate', timeOfDay: 'morning', goalTarget: 1, goalPeriod: 'day', color: null, status: 'none', streak: 12 },
    { id: 'h3', title: 'Drink water', timeOfDay: 'afternoon', goalTarget: 8, goalPeriod: 'day', color: null, status: 'none', streak: 3 },
    { id: 'h4', title: 'No screens after 10pm', timeOfDay: 'evening', goalTarget: 1, goalPeriod: 'day', color: null, status: 'skipped', streak: 0 },
    { id: 'h5', title: 'Read 20 minutes', timeOfDay: 'evening', goalTarget: 1, goalPeriod: 'day', color: null, status: 'done', streak: 28 },
    { id: 'h6', title: 'Review the week', timeOfDay: 'any', goalTarget: 1, goalPeriod: 'week', color: null, status: 'none', streak: 2 },
  ],
};

export default function HabitsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)', overflowY: 'auto' }}>
      <HabitsJournal board={BOARD} />
    </div>
  );
}
