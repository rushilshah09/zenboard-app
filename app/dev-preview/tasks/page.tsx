'use client';
// Dev-only harness for the Tasks pane — staged data so the quick-add trigger,
// composer, priority menu, and label filter can be verified without a session.
// 404s in prod.
import { notFound } from 'next/navigation';
import { TasksView, type TaskItem } from '@/components/tasks/tasks-view';

const TASKS: TaskItem[] = [
  { id: 't1', title: 'Review the launch checklist', done: false, priority: 'high', highlight: false, estimate_minutes: 30, scheduled_date: null, is_inbox: true, project_id: null, recurrence: null, parent_task_id: null },
  { id: 't2', title: 'Draft the weekly update', done: false, priority: 'low', highlight: false, estimate_minutes: null, scheduled_date: null, is_inbox: true, project_id: null, recurrence: null, parent_task_id: null },
  { id: 't3', title: 'Chase the contract signature', done: false, priority: 'low', highlight: false, estimate_minutes: null, scheduled_date: null, is_inbox: true, project_id: null, recurrence: null, parent_task_id: null },
];

const LABELS = [
  { id: 'l1', name: 'Waiting', color: 'ochre' },
  { id: 'l2', name: 'Errand', color: 'teal' },
];
const TASK_LABELS: Record<string, string[]> = { t1: ['l2'], t3: ['l1'] };

export default function TasksPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)' }}>
      <TasksView
        initialTasks={TASKS}
        projects={{
          p1: { id: 'p1', name: 'Balluji', color: '#9A1B6F' },
          p2: { id: 'p2', name: 'New life', color: '#9A1B6F' },
        }}
        subByParent={{}}
        labels={LABELS}
        taskLabels={TASK_LABELS}
        savedViewsSupported
        savedViews={[{ id: 'sv1', name: 'Waiting on clients', filter: { view: 'inbox', filter: 'all', labelId: 'l1', listId: null } }]}
      />
    </div>
  );
}
