'use client';
// Tasks: the product's own Tasks view — the inbox still to sort, the lists, the projects rail.
import * as React from 'react';
import { TasksView, type TaskItem } from '@/components/tasks/tasks-view';
import type { Scope } from '@/lib/task-scopes';
import { PROJECTS, dayFromToday } from '../fixtures';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const LISTS: Scope[] = [
  { kind: 'list', id: 'L-admin', name: 'Studio admin', color: 'amber' },
  { kind: 'list', id: 'L-someday', name: 'Someday', color: 'indigo' },
];
const LABELS = [
  { id: 'lb-waiting', name: 'Waiting', color: 'ochre' },
  { id: 'lb-errand', name: 'Errand', color: 'teal' },
];

export default function TasksDemo() {
  const tasks = React.useMemo<TaskItem[]>(() => {
    const today = dayFromToday(0);
    const t = (id: string, title: string, over: Partial<TaskItem>): TaskItem => ({
      id, title, done: false, priority: 'low', highlight: false, estimate_minutes: null, scheduled_date: null, is_inbox: false,
      project_id: null, list_id: null, recurrence: null, parent_task_id: null, created_at: hoursAgo(20), ...over,
    });
    return [
      t('t-idea', 'Idea: a before-and-after page for the site', { is_inbox: true, created_at: hoursAgo(3) }),
      t('t-receipts', 'File September receipts', { is_inbox: true, list_id: 'L-admin', created_at: hoursAgo(26) }),
      t('t-brief', 'Draft the Copper Row brief', { is_inbox: true, project_id: 'p-copper', priority: 'med', created_at: hoursAgo(7) }),
      t('t-invoice', 'Send the Ridgeline invoice', { project_id: 'p-ridgeline', priority: 'high', highlight: true, estimate_minutes: 15, scheduled_date: today }),
      t('t-logo', 'Finish the logo presentation', { project_id: 'p-ridgeline', priority: 'med', estimate_minutes: 120, scheduled_date: today }),
      t('t-scope', 'Reply to Beacon about scope', { project_id: 'p-beacon', estimate_minutes: 20, scheduled_date: today }),
      t('t-sitemap', 'Sitemap v3 for Beacon Health', { project_id: 'p-beacon', priority: 'med', estimate_minutes: 90, scheduled_date: dayFromToday(1) }),
      t('t-menu', 'Shot list for the new menu', { project_id: 'p-copper', estimate_minutes: 30, scheduled_date: today }),
      t('t-domain', 'Renew the studio domain', { list_id: 'L-admin', scheduled_date: dayFromToday(3) }),
      t('t-book', 'Read the new type specimen book', { list_id: 'L-someday' }),
      t('t-review', 'Weekly review', { project_id: 'p-life', done: true, scheduled_date: today, recurrence: null }),
    ];
  }, []);
  return (
    <TasksView
      initialTasks={tasks}
      projects={PROJECTS}
      subByParent={{}}
      labels={LABELS}
      taskLabels={{ 't-scope': ['lb-waiting'], 't-receipts': ['lb-errand'] }}
      lists={LISTS}
      listsSupported
      hiddenScopes={[]}
      savedViewsSupported
      savedViews={[{ id: 'sv-waiting', name: 'Waiting on clients', filter: { view: 'inbox', filter: 'all', labelId: 'lb-waiting' } }]}
    />
  );
}
