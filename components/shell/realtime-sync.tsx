'use client';
// Real-time sync — subscribes to the signed-in user's row changes (RLS scopes
// what Realtime delivers) and refreshes server data so every device/session
// reflects edits live, no manual refresh. Views reconcile incoming props.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { initialSync, onRowChange, onVisibilityChange, type SyncState } from '@/lib/realtime-refresh';

const TABLES = ['tasks', 'goals', 'milestones', 'projects', 'task_comments', 'rituals', 'clients', 'client_notes', 'leads', 'invoices', 'invoice_items', 'payments', 'time_entries', 'project_activity', 'habits', 'habit_logs', 'calendar_events', 'client_requests', 'request_messages', 'approvals'];

/**
 * Fired on `window` for every row change this component hears, as
 * `{ detail: { table } }`.
 *
 * THE SEAM. This component's own reaction is `router.refresh()`, which re-runs
 * server components — no use at all to a client-side loop like the reminder
 * scheduler, which holds its own state and needs to know *that something
 * changed*. The alternative was a second subscription to the same table from
 * that component. One socket, one subscription, many listeners: anything that
 * needs to react to another device's edit listens here instead of opening its
 * own channel.
 */
export const REALTIME_EVENT = 'zb:realtime';

export function RealtimeSync() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Defer-and-remember state; the rule itself lives in lib/realtime-refresh.ts. */
  const sync = useRef<SyncState>(initialSync);

  useEffect(() => {
    const supabase = createClient();

    // A HIDDEN TAB RENDERS NOTHING, SO REFRESHING IT IS PURE WASTE.
    //
    // `router.refresh()` re-runs every Server Component for the current route.
    // On Home that is a ten-query wave — measured at ~1.2s of server work
    // against a ~228ms median round trip. This component subscribes to TWENTY
    // tables, so any edit by any device, on any of them, paid that cost in
    // EVERY open tab — including ones sitting in the background for hours.
    //
    // Deferring while hidden cannot change what the user sees, because nothing
    // is being shown. The one thing that must not happen is DROPPING the
    // update, so a change that arrives while hidden sets a flag and the tab
    // refreshes once when it comes back — one wave instead of however many
    // edits landed in the meantime, which is also strictly better than the old
    // behaviour for a tab left open all day.
    const doRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    const vis = () => (document.visibilityState === 'visible' ? 'visible' : 'hidden');
    const refresh = () => {
      const r = onRowChange(sync.current, vis());
      sync.current = r.state;
      if (r.action === 'refresh') doRefresh();
    };
    const onVisible = () => {
      const r = onVisibilityChange(sync.current, vis());
      sync.current = r.state;
      if (r.action === 'refresh') doRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    const channel = supabase.channel('zb-realtime');
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        // Announce first, refresh after: a listener that wants to act on the
        // change should not have to wait out the 250ms refresh debounce.
        // This still fires while hidden — a background tab is exactly when the
        // reminder scheduler needs to hear about another device's edit.
        window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: { table } }));
        refresh();
      });
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
