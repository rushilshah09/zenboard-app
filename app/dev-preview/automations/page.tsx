'use client';
// Dev-only harness for the Automations doctrine page — static content, no
// session needed. 404s in prod.
import { notFound } from 'next/navigation';
import { AutomationsView } from '@/components/settings/automations-view';

export default function AutomationsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)' }}>
      <AutomationsView />
    </div>
  );
}
