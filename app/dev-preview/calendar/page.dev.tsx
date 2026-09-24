'use client';
// Dev-only design playground for the Calendar — renders CalendarView with rich
// staged data (overlaps, all-day, synced/manual mix) so visual work can be
// verified without a session. 404s outside development.
import { notFound } from 'next/navigation';
import { type RailTask } from '@/components/calendar/task-rail';
import { todayISO } from '@/lib/date';
import { type CalendarMilestone } from '@/lib/milestones';
import { CalendarView } from '@/components/calendar/calendar-view';
import type { CalEvent } from '@/lib/calendar';

function at(dayOffset: number, h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const ev = (id: string, title: string, day: number, sh: number, sm: number, eh: number, em: number, source: string | null = null): CalEvent =>
  ({ id, title, starts_at: at(day, sh, sm), ends_at: at(day, eh, em), all_day: false, source });
const allDay = (id: string, title: string, day: number, source: string | null = null): CalEvent =>
  ({ id, title, starts_at: at(day, 0, 0), ends_at: null, all_day: true, source });

// A timebox twin (0030, lib/timebox.ts): a task given a place in the day. It
// renders with the task's checkbox and strikes through when the task is done —
// the block has no completion of its own. Both states are staged so the twin
// language can be checked without a session.
const twin = (id: string, title: string, taskId: string, done: boolean, day: number, sh: number, sm: number, eh: number, em: number): CalEvent =>
  ({ ...ev(id, title, day, sh, sm, eh, em, 'timebox'), task_id: taskId, task_done: done });

const DEMO: CalEvent[] = [
  // Today — overlap cluster + a long block
  ev('d1', 'Design review', 0, 9, 30, 10, 30),
  twin('x1', 'Write the client brief', 'task-1', false, 0, 14, 0, 14, 30),
  twin('x2', 'Send the invoice', 'task-2', true, 0, 16, 30, 17, 0),
  ev('d2', 'Standup', 0, 10, 0, 10, 15, 'google'),
  ev('d3', 'Deep work — portal polish', 0, 11, 0, 13, 0),
  ev('d4', 'Coffee with Mira', 0, 15, 0, 15, 45, 'google'),
  allDay('d5', 'Kishu birthday', 0, 'google'),
  // Tomorrow
  ev('t1', 'Client call — Life Studio', 1, 10, 0, 10, 45),
  ev('t2', 'Invoice sweep', 1, 9, 0, 9, 30),
  ev('t3', 'Gym', 1, 7, 0, 8, 0, 'google'),
  // Rest of week
  allDay('w0', 'Ship v0.9', 2),
  // A PICKED colour (ochre), so a drag can be checked for keeping it: the ghost once turned every grabbed event the
  // default accent and called it "New event" (user report 2026-09-21).
  { ...ev('w1', 'Portfolio pass', 2, 16, 0, 18, 0), color: 'yellow' },
  ev('w2', 'Weekly review', 3, 17, 0, 17, 30),
  ev('w3', 'Dentist', 4, 8, 30, 9, 15, 'google'),
  ev('w4', 'Hike + brunch', 5, 8, 0, 11, 0),
  // Month spread
  ev('m1', 'Planning — next sprint', 7, 14, 0, 15, 0),
  ev('m2', 'Tax filing', 10, 9, 0, 10, 0),
  allDay('m3', 'Offsite', 12),
  ev('m4', 'Retro', 14, 16, 0, 16, 45, 'google'),
  ev('m5', 'Book club', -3, 19, 0, 20, 0),
  ev('m6', 'Quarterly close', 18, 11, 0, 12, 30),
];


// The §7D task rail's staged data. Covers both buckets (a day's scheduled work
// and the Inbox), a task with NO estimate (so the 30-minute default block is
// visible) and a long one (so the drop ghost is provably the task's own length,
// not a fixed placeholder).
const DEMO_TASKS: RailTask[] = [
  { id: 't1', title: 'Write the kickoff brief', estimate_minutes: 90, scheduled_date: todayISO(), is_inbox: false },
  { id: 't2', title: 'Review Aurora wireframes', estimate_minutes: 45, scheduled_date: todayISO(), is_inbox: false },
  { id: 't3', title: 'Reply to Meridian', estimate_minutes: null, scheduled_date: todayISO(), is_inbox: false },
  { id: 't4', title: 'Book the studio for the shoot', estimate_minutes: 15, scheduled_date: null, is_inbox: true },
  { id: 't5', title: 'Renew the domain', estimate_minutes: null, scheduled_date: null, is_inbox: true },
];


// §7E checkpoints on the calendar. One overdue, one today, one upcoming and one
// already done, so the chip's three treatments and the all-day lane's ordering
// are all on screen at once. Dates are CALENDAR dates built from local parts.
const dayISO = (n: number) => {
  const d = new Date(Date.now() + n * 86400_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const DEMO_MILESTONES: CalendarMilestone[] = [
  { id: 'ms1', title: 'Design sign-off', done: false, due_date: dayISO(-2), sort_order: 0, projectId: 'life', projectName: 'Balluji rebrand', projectColor: '#9A1B6F' },
  { id: 'ms2', title: 'Beta to client', done: false, due_date: dayISO(0), sort_order: 1, projectId: 'aurora', projectName: 'Aurora', projectColor: '#3F82D6' },
  { id: 'ms3', title: 'Public launch', done: false, due_date: dayISO(3), sort_order: 2, projectId: 'life', projectName: 'Balluji rebrand', projectColor: '#9A1B6F' },
  { id: 'ms4', title: 'Kickoff call', done: true, due_date: dayISO(-4), sort_order: 3, projectId: 'aurora', projectName: 'Aurora', projectColor: '#3F82D6' },
];

export default function CalendarPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // Mirror the app shell's content container so proportions match the real app.
  return (
    <div style={{ height: '100dvh', display: 'flex', padding: 8, background: 'var(--canvas)' }}>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
        <CalendarView demoEvents={DEMO} demoTasks={DEMO_TASKS} demoMilestones={DEMO_MILESTONES} />
      </div>
    </div>
  );
}
