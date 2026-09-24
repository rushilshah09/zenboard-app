'use client';
// Dev-only harness for the Settings rebuild (grouped rail + DS settings panes)
// so the pattern can be verified without auth. 404s in prod.
import { notFound } from 'next/navigation';
import { SettingsView } from '@/components/settings/settings-view';

const LAST_SYNCED = new Date(Date.now() - 42 * 60 * 1000).toISOString();

export default function DevSettingsPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* No <Suspense>: SettingsView deliberately reads the deep-link from
          window.location in a post-mount effect rather than useSearchParams, so
          nothing here suspends. The leftover boundary had an empty fallback, so
          when it stayed pending the whole harness rendered blank. */}
      <SettingsView
        email="rushil@zenboard.app"
        initialName="Rushil Shah"
        // A day the user actually set, so the Work hours field is not just showing
        // its own default back at itself.
        workHours={{ start: 8 * 60 + 30, end: 16 * 60 }}
        // Opted in, so the pane shows its populated state — the off state is one
        // switch away and is the boring half.
        digest={{ enabled: true, atMinutes: 7 * 60 + 30, vacationUntil: null, lastSent: null }}
        initialRate={120}
        gcal={{ connected: true, lastSynced: LAST_SYNCED, eventCount: 128 }}
      />
    </div>
  );
}
