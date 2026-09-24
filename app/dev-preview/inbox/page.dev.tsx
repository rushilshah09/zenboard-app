'use client';
// Dev-only harness for the Inbox — staged rows so capture, the row actions, and
// Triage mode can be verified without a session. Server actions will error on
// persist here; the optimistic UI is what's under test. 404s in prod.
//
// It drives TasksView now, because the Inbox is a view inside Tasks rather than a
// page of its own. That is the point of keeping this route: Triage came across
// with the merge, and this is where it gets exercised.
import { notFound } from 'next/navigation';
import { TasksView, type TaskItem } from '@/components/tasks/tasks-view';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

// The Tasks row shape. Everything is is_inbox so the default view is full.
const inbox = (id: string, title: string, priority: TaskItem['priority'], h: number): TaskItem => ({
  id, title, done: false, priority, highlight: false, estimate_minutes: null,
  scheduled_date: null, is_inbox: true, project_id: null, recurrence: null,
  parent_task_id: null, created_at: hoursAgo(h),
});

const TASKS: TaskItem[] = [
  inbox('i1', 'Ask Priya about the retainer scope', 'high', 70),
  inbox('i2', 'Look into that font licensing question', 'low', 30),
  inbox('i3', 'Draft the case-study outline', 'med', 5),
  inbox('i4', 'Renew the domain before it lapses', 'low', 1),
  inbox('i5', 'Reply to the podcast invite', 'low', 96),
  inbox('i6', 'Sketch the pricing page hero', 'med', 52),
  inbox('i7', 'Book the Q3 tax call', 'high', 20),
  inbox('i8', 'Move the old files off the desktop', 'low', 8),
  inbox('i9', 'Note the idea from the walk', 'low', 0.2),
];

export default function InboxPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)' }}>
      <TasksView
        initialTasks={TASKS}
        projects={{
          p1: { id: 'p1', name: 'Balluji', color: '#9A1B6F' },
          p2: { id: 'p2', name: 'New life', color: '#3B6E8F' },
        }}
        subByParent={{}}
        labels={[
          { id: 'l1', name: 'Waiting', color: 'ochre' },
          { id: 'l2', name: 'Errand', color: 'teal' },
          { id: 'l3', name: 'Deep work', color: 'stone' },
        ]}
        taskLabels={{}}
      />
    </div>
  );
}
