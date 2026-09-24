'use client';
// Pulls fresh Google events on mount (when connected), then refreshes the
// server-rendered data so views like Today's Schedule reflect Google-side changes.
// Skipped when the last sync is recent: lib/gcal-auto-sync.ts has why.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { syncGoogleCalendar } from '@/lib/actions/google-calendar';
import { shouldAutoSync } from '@/lib/gcal-auto-sync';

export function GoogleAutoSync({ connected, lastSynced }: { connected: boolean; lastSynced: string | null }) {
  const router = useRouter();
  const did = useRef(false);
  useEffect(() => {
    if (!connected || did.current) return;
    did.current = true;
    if (!shouldAutoSync(lastSynced, Date.now())) return;
    syncGoogleCalendar().then((r) => { if (r && 'ok' in r) router.refresh(); });
  }, [connected, lastSynced, router]);
  return null;
}
