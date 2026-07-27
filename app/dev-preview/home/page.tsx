'use client';
// Dev-only harness for the Home redesign (greeting · shutdown banner · highlight
// panel · schedule), staged to mirror the reference frame. 404s in prod.
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { TodayView, type TodayTask, type TodayEvent, type TodayHabit } from '@/components/today/today-view';

const now = new Date();
const at = (h: number, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d.toISOString(); };
const todayISO = now.toISOString().slice(0, 10);

// A deliberately full day so the §7V capacity line + overloaded Watch line show:
// planned ≈6h (300+60) + meetings ≈2h45m > a typical 8h day.
const TASKS: TodayTask[] = [
  { id: 't1', title: 'Send invoice for July to TechSpark', done: false, priority: 'high', highlight: true, estimate_minutes: 300, elapsed_minutes: 0, scheduled_date: todayISO, project_id: 'pr1', parent_task_id: null, completed_at: null, created_at: at(8), sort_order: 0 },
  { id: 't2', title: 'Prepare weekly report', done: false, priority: 'med', highlight: false, estimate_minutes: 60, elapsed_minutes: 0, scheduled_date: todayISO, project_id: null, parent_task_id: null, completed_at: null, created_at: at(9), sort_order: 1 },
  { id: 't3', title: 'Review design feedback', done: true, priority: 'low', highlight: false, estimate_minutes: 30, elapsed_minutes: 30, scheduled_date: todayISO, project_id: null, parent_task_id: null, completed_at: at(10), created_at: at(7), sort_order: 2 },
];

const EVENTS: TodayEvent[] = [
  { id: 'e1', title: 'Standup', starts_at: at(9), ends_at: at(9, 30), all_day: false, source: 'google' },
  { id: 'e2', title: 'Send invoice for July Techspark', starts_at: at(13, 30), ends_at: at(13, 45), all_day: false, source: 'manual' },
  { id: 'e3', title: 'Design review', starts_at: at(16), ends_at: at(18), all_day: false, source: 'manual' },
];

const HABITS: TodayHabit[] = [
  { id: 'h1', title: 'Morning walk', doneToday: true, streak: 12 },
  { id: 'h2', title: 'Inbox to zero', doneToday: false, streak: 4 },
  { id: 'h3', title: 'Read 20 minutes', doneToday: false, streak: 0 },
];

export default function HomePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?h=<0-23> forces the staged phase; ?empty=1 clears today's tasks (plan phase).
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => { setQ(new URLSearchParams(window.location.search)); }, []);
  const hParam = q?.get('h');
  const nowHour = hParam != null && hParam !== '' ? Number(hParam) : undefined;
  const empty = q?.get('empty') === '1';
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)' }}>
      <TodayView
        name="Darshil"
        nowHour={nowHour}
        initialTasks={empty ? [] : TASKS}
        projects={{ pr1: { id: 'pr1', name: 'TechSpark', color: 'var(--pal-brown-dot)' } }}
        subByParent={{}}
        initialHabits={HABITS}
        events={EVENTS}
        errors={{ tasks: false, habits: false, events: false }}
      />
    </div>
  );
}
