'use client';
// Dev-only harness for the Tasks pane — staged data so the quick-add trigger,
// composer, priority menu, label filter, the Projects/Lists rail sections and
// their visibility checkboxes can be verified without a session. 404s in prod.
//
// The task's own panel is mounted too, as the app shell mounts it (`?task=<id>`). It reads through the browser
// Supabase client, so on its own it opens onto nothing; scripts/verify/verify-task-edit.mjs answers its reads over
// the DevTools protocol with the same tasks, projects and lists staged below — which is how its chips were
// proved at all (2026-09-19: until then it could not be staged, and it had no way to file a task).
import { notFound } from 'next/navigation';
import { TasksView, type TaskItem } from '@/components/tasks/tasks-view';
import type { Scope } from '@/lib/task-scopes';
import { Suspense } from 'react';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';
import { TaskDetailDrawer } from '@/components/task-detail/task-detail-drawer';

// created_at is real here, not omitted: Triage sorts on it and prints each
// thought's age, so a seed without it renders "captured 20664d ago".
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const TASKS: TaskItem[] = [
  { id: 't1', title: 'Review the launch checklist', done: false, priority: 'high', highlight: false, estimate_minutes: 30, scheduled_date: null, is_inbox: true, project_id: null, list_id: null, recurrence: null, parent_task_id: null, created_at: hoursAgo(51) },
  { id: 't2', title: 'Draft the weekly update', done: false, priority: 'low', highlight: false, estimate_minutes: null, scheduled_date: null, is_inbox: true, project_id: null, list_id: 'L1', recurrence: null, parent_task_id: null, created_at: hoursAgo(6) },
  { id: 't3', title: 'Chase the contract signature', done: false, priority: 'low', highlight: false, estimate_minutes: null, scheduled_date: null, is_inbox: true, project_id: 'p1', list_id: null, recurrence: null, parent_task_id: null, created_at: hoursAgo(1) },
  // The case rule 3 exists for: in a project AND a list, so switching either
  // off has to silence it even though its board column is the list.
  { id: 't4', title: 'Send the deposit invoice', done: false, priority: 'med', highlight: false, estimate_minutes: 20, scheduled_date: null, is_inbox: true, project_id: 'p1', list_id: 'L2', recurrence: null, parent_task_id: null, created_at: hoursAgo(3) },
  { id: 't5', title: 'Archive last quarter’s files', done: true, priority: 'low', highlight: false, estimate_minutes: null, scheduled_date: null, is_inbox: true, project_id: null, list_id: 'L1', recurrence: null, parent_task_id: null, created_at: hoursAgo(30) },
];

const LISTS: Scope[] = [
  { kind: 'list', id: 'L1', name: 'Priority', color: '#C88A3B' },
  { kind: 'list', id: 'L2', name: 'Extra work', color: '#2B5CB0' },
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
          p2: { id: 'p2', name: 'New life', color: '#7B8B5F' },
        }}
        subByParent={{}}
        labels={LABELS}
        taskLabels={TASK_LABELS}
        lists={LISTS}
        listsSupported
        hiddenScopes={[]}
        savedViewsSupported
        savedViews={[{ id: 'sv1', name: 'Waiting on clients', filter: { view: 'inbox', filter: 'all', labelId: 'l1' } }]}
      />
      {/* Its own <Toaster/>: dev-preview renders OUTSIDE AppShell, which owns the
          app's single one. Without it every toast this harness raises is
          invisible — including the one that says an optimistic edit was refused
          and put back, which is the ONLY report that failure ever gets. */}
      <Toaster />
      {/* And the shell's net: dev-preview has no session, so EVERY action here
          throws — without this the harness silently keeps edits that failed. */}
      <ActionFailureNet />
      {/* The task's own panel, mounted the way AppShell mounts it. */}
      <Suspense fallback={null}><TaskDetailDrawer /></Suspense>
    </div>
  );
}
