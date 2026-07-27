'use client';
// Dev-only harness for the ritual flows — seeds today's tasks + habits so the
// daily_plan flow (incl. the new habits step) can be verified without a session.
// Server actions error without auth (expected); the UI + optimistic state are
// what's under test. 404s in prod.
import { notFound } from 'next/navigation';
import { RitualFlow, type RTask, type RHabit } from '@/components/rituals/ritual-flow';

const TASKS: RTask[] = [
  { id: 't1', title: 'Finalize the logo direction', done: false, highlight: false, estimate_minutes: 90 },
  { id: 't2', title: 'Reply to Priya about scope', done: false, highlight: false, estimate_minutes: 15 },
  { id: 't3', title: 'Invoice Meridian Studio', done: true, highlight: false, estimate_minutes: 20 },
];

const HABITS: RHabit[] = [
  { id: 'h1', title: 'Morning walk', done: false },
  { id: 'h2', title: 'Read 20 minutes', done: true },
  { id: 'h3', title: 'No phone before noon', done: false },
];

export default function RitualsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <RitualFlow type="daily_plan" todayTasks={TASKS} goals={[]} habits={HABITS} todayISO={today} tomorrowISO={tomorrow} />
  );
}
