'use client';
// Dev-only harness for the new-task Composer (Task Creation Panel), so its states
// + priority dropdown can be verified without a session. 404s in prod.
import { notFound } from 'next/navigation';
import { Composer } from '@/components/tasks/tasks-view';

const PROJECTS = [
  { id: 'p1', name: 'New life', color: '#D1453E' },
  { id: 'p2', name: 'Client site', color: '#3474C8' },
];

export default function ComposerPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)', display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <Composer projects={PROJECTS} defaultDest="inbox" defaultProject={null} onCancel={() => {}} onSubmit={() => {}} />
      </div>
    </div>
  );
}
