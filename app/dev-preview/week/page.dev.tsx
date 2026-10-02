'use client';
// Dev-only harness for the week board. Its reason to exist is the shared rail:
// this page and /dev-preview/tasks must show the SAME rail in the same place, so
// switching layout only changes the centre. 404s in prod.
import { notFound } from 'next/navigation';
import { WeekView, type WeekTask } from '@/components/week/week-view';
import { TaskViewToggle } from '@/components/tasks/task-view-toggle';
import { getWeekDays, weekRangeLabel } from '@/lib/date';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';

const days = getWeekDays(new Date());

const task = (id: string, title: string, day: string | null, done = false): WeekTask => ({
  id, title, done, priority: 'low', highlight: false, estimate_minutes: 30,
  scheduled_date: day, is_inbox: day === null, project_id: null, parent_task_id: null,
  sort_order: 0, recurrence: null,
});

const TASKS: WeekTask[] = [
  task('w1', 'Review the launch checklist', days[0].id),
  task('w2', 'Draft the weekly update', days[2].id),
  task('w3', 'Chase the contract signature', days[3].id),
  task('u1', 'Look into the font licensing question', null),
  task('u2', 'Book the Q3 tax call', null),
];

export default function WeekPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)' }}>
      <WeekView
        days={days}
        initialTasks={TASKS}
        projects={{
          p1: { id: 'p1', name: 'Ridgeline', color: '#9A1B6F' },
          p2: { id: 'p2', name: 'New life', color: '#3B6E8F' },
        }}
        subByParent={{}}
        rangeLabel={weekRangeLabel(days)}
        offset={0}
        viewSwitch={<TaskViewToggle view="week" />}
        // The same three numbers the list harness shows, so the two pages can be
        // compared directly.
        railCounts={{ inbox: 3, today: 0, completed: 0 }}
        savedViewsSupported
        savedViews={[{ id: 'sv1', name: 'Waiting on clients', filter: { view: 'inbox', filter: 'all', labelId: 'l1', listId: null } }]}
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
