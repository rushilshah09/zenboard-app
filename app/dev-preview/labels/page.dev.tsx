'use client';
// Dev-only harness for Settings → Labels. Rendered bare (no Suspense wrapper) so
// the pane itself is what's under test. Reads go through the browser client and
// return nothing without a session, so this exercises the loading + empty paths;
// the populated path is covered by the same code with real rows. 404s in prod.
import { notFound } from 'next/navigation';
import { LabelsPane } from '@/components/settings/labels-pane';

export default function LabelsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', padding: 32 }}>
      <div style={{ maxWidth: 720 }}>
        <LabelsPane />
      </div>
    </div>
  );
}
