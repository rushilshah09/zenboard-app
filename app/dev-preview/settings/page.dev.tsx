'use client';
// Dev-only harness for the Settings rebuild (grouped rail + DS settings panes)
// so the pattern can be verified without auth. 404s in prod.
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { stubServerActions } from '../action-stub';
import { SettingsView } from '@/components/settings/settings-view';
import { Toaster } from '@/components/ds/ui';
import { SidebarPrefsProvider } from '@/components/shell/sidebar-prefs';
import { defaultModulesForRole } from '@/lib/nav-modules';
import type { SidebarMode } from '@/lib/sidebar-mode';

const LAST_SYNCED = new Date(Date.now() - 42 * 60 * 1000).toISOString();

export default function DevSettingsPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Preview />;
}

// Settings renders inside AppShell in the app, and AppShell provides the sidebar
// prefs. Out here there is no shell, so the harness provides them — staged as a
// freelancer's set, the most common shape, so the Sidebar pane opens populated.
function Preview() {
  const [mode, setMode] = useState<SidebarMode>('expanded');
  // Answer the sidebar's writes so the SUCCESS path can be seen: applying a set,
  // its Undo toast, a switch that stays where you put it. Everything else still
  // goes through and fails as it would without a session.
  useEffect(() => stubServerActions((args) => {
    const a = args[0] as Record<string, unknown> | null | undefined;
    return a && typeof a === 'object' && 'navModules' in a ? { ok: true } : undefined;
  }), []);
  return (
    <SidebarPrefsProvider initialModules={defaultModulesForRole('freelancer')} mode={mode} onModeChange={setMode}>
    {/* Outside AppShell there is no Toaster, and applying a set answers with a
        toast carrying Undo — without one here that half could not be seen. */}
    <Toaster />
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* No <Suspense>: SettingsView deliberately reads the deep-link from
          window.location in a post-mount effect rather than useSearchParams, so
          nothing here suspends. The leftover boundary had an empty fallback, so
          when it stayed pending the whole harness rendered blank. */}
      <SettingsView
        email="rushil@zenboard.life"
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
    </SidebarPrefsProvider>
  );
}
