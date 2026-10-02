'use client';
// ── THE WEBSITE'S FOCUS SESSIONS, ARRIVING ──────────────────────────────────
//
// Mounted once in the app shell. If this device kept focus sessions from the website before its
// owner signed in (lib/guest-focus.ts), they move into the account (lib/actions/guest-focus.ts),
// leave the device, and one toast says so. Nothing kept: nothing happens, and nothing is asked of
// the server.
//
// One import per page load, whatever re-runs the effect (React runs it twice while developing): two
// offers of the same list would race each other past the server's "already there" check.

import * as React from 'react';
import { toast } from '@/components/ds/ui';
import { importGuestFocus } from '@/lib/actions/guest-focus';
import { GUEST_FOCUS_KEY, readGuestSessions } from '@/lib/guest-focus';

let offered: ReturnType<typeof importGuestFocus> | null = null;

export function GuestFocusImport() {
  React.useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(GUEST_FOCUS_KEY);
    } catch {
      return;
    }
    const sessions = readGuestSessions(raw, new Date());
    if (!sessions.length) return;
    let live = true;
    offered ??= importGuestFocus(sessions);
    offered.then((res) => {
      if (!live) return;
      // silent: the sessions stay on this device and are offered again the next time Zenboard opens.
      if ('error' in res) return;
      try {
        localStorage.removeItem(GUEST_FOCUS_KEY);
      } catch {
        // Could not forget them: the server's "already there" check keeps the next offer harmless.
      }
      if (res.imported > 0) toast({ message: `Added ${res.imported} focus ${res.imported === 1 ? 'session' : 'sessions'} from before you signed in` });
    }, () => {});
    return () => { live = false; };
  }, []);
  return null;
}
