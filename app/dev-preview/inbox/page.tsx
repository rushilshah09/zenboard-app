'use client';
// Dev-only harness for the Inbox — staged rows so capture, the row actions,
// and Triage mode can be verified without a session. Server actions will
// error on persist here; the optimistic UI is what's under test. 404s in prod.
import { notFound } from 'next/navigation';
import { InboxView, type InboxTask } from '@/components/inbox/inbox-view';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const TASKS: InboxTask[] = [
  { id: 'i1', title: 'Ask Priya about the retainer scope', priority: 'high', done: false, is_inbox: true, created_at: hoursAgo(70), project_id: null },
  { id: 'i2', title: 'Look into that font licensing question', priority: 'low', done: false, is_inbox: true, created_at: hoursAgo(30), project_id: null },
  { id: 'i3', title: 'Draft the case-study outline', priority: 'med', done: false, is_inbox: true, created_at: hoursAgo(5), project_id: null },
  { id: 'i4', title: 'Renew the domain before it lapses', priority: 'low', done: false, is_inbox: true, created_at: hoursAgo(1), project_id: null },
  { id: 'i5', title: 'Reply to the podcast invite', priority: 'low', done: false, is_inbox: true, created_at: hoursAgo(96), project_id: null },
  { id: 'i6', title: 'Sketch the pricing page hero', priority: 'med', done: false, is_inbox: true, created_at: hoursAgo(52), project_id: null },
  { id: 'i7', title: 'Book the Q3 tax call', priority: 'high', done: false, is_inbox: true, created_at: hoursAgo(20), project_id: null },
  { id: 'i8', title: 'Move the old files off the desktop', priority: 'low', done: false, is_inbox: true, created_at: hoursAgo(8), project_id: null },
  { id: 'i9', title: 'Note the idea from the walk', priority: 'low', done: false, is_inbox: true, created_at: hoursAgo(0.2), project_id: null },
];

export default function InboxPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)', overflowY: 'auto' }}>
      <InboxView
        initialTasks={TASKS}
        projects={[
          { id: 'p1', name: 'Balluji', color: '#9A1B6F' },
          { id: 'p2', name: 'New life', color: '#3B6E8F' },
        ]}
        initialLabels={[
          { id: 'l1', name: 'Waiting' },
          { id: 'l2', name: 'Errand' },
          { id: 'l3', name: 'Deep work' },
        ]}
      />
    </div>
  );
}
