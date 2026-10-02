'use client';
// Tells the server which timezone the user is in — once, and only when it moves.
//
// The browser is the only party that knows. Without it every server loader
// resolves "today" in UTC, which for an IST user is yesterday's date until
// 05:30 local: Home listed the wrong day's tasks for five and a half hours
// every night. The zone lands in `profiles.preferences.timezone`, which
// `userTimezone()` reads on the server.
//
// It writes only on a genuine change (first run, or the user actually
// travelled), so this is not a request per page load.
import { useEffect, useRef } from 'react';
import { updatePreferences } from '@/lib/actions/profile';

export function TimezoneSync({ stored }: { stored: string | null }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    let tz: string | undefined;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
    if (!tz || tz === stored) return;
    sent.current = true;
    // Fire and forget: a failure just means the server keeps its old answer,
    // which is the pre-existing behaviour, never a broken page.
    void updatePreferences({ timezone: tz });
  }, [stored]);
  return null;
}
