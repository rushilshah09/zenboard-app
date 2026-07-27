'use client';
// Pulls fresh Google events once on mount (when connected), then refreshes the
// server-rendered data so views like Today's Schedule reflect Google-side changes.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { syncGoogleCalendar } from '@/lib/actions/google-calendar';

export function GoogleAutoSync({ connected }: { connected: boolean }) {
  const router = useRouter();
  const did = useRef(false);
  useEffect(() => {
    if (!connected || did.current) return;
    did.current = true;
    syncGoogleCalendar().then((r) => { if (r && 'ok' in r) router.refresh(); });
  }, [connected, router]);
  return null;
}
