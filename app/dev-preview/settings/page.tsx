'use client';
// Dev-only harness for the Settings rebuild (grouped rail + DS settings panes)
// so the pattern can be verified without auth. 404s in prod.
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SettingsView } from '@/components/settings/settings-view';

const LAST_SYNCED = new Date(Date.now() - 42 * 60 * 1000).toISOString();

export default function DevSettingsPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <Suspense>
        <SettingsView
          email="rushil@zenboard.app"
          initialName="Rushil Shah"
          initialRate={120}
          gcal={{ connected: true, lastSynced: LAST_SYNCED, eventCount: 128 }}
        />
      </Suspense>
    </div>
  );
}
