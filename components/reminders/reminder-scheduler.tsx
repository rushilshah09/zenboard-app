'use client';
// Reminder delivery — master plan §7O channel 3. Mounted ONCE in the app shell,
// renders nothing, and is the only thing in the product that decides a reminder
// has arrived.
//
// WHAT THIS IS AND IS NOT. It is the in-app channel: while Zenboard is open on
// any device, a reminder speaks at its moment and lands in the bell. It is NOT
// a push or email worker — that needs a cron runner and VAPID/Resend
// credentials, and is its own sprint. The seam is already cut for it: delivery
// is a claim (lib/actions/reminders.ts), so a worker can deliver through
// another channel later without a schema change and without either half being
// able to double-send.
//
// THE TIMING MODEL. One timer, not a poll. It sleeps until the next reminder is
// due, capped at HEARTBEAT_MS so another device's edit is noticed even if
// realtime never arrives, and re-plans on four signals: the tab becoming
// visible (a closed laptop's timers do not fire), a `tasks` row changing
// anywhere, this tab setting a reminder, and the network coming back. A
// once-a-second poll would be simpler and would also be a query per second per
// tab, forever, for an event that happens a few times a day.
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ds/ui';
import { REALTIME_EVENT } from '@/components/shell/realtime-sync';
import { claimReminder } from '@/lib/actions/reminders';
import { partitionDue, nextWakeMs, isFresh, HEARTBEAT_MS, REMINDERS_CHANGED } from '@/lib/reminders';
import { playFocusChime, taskSoundEnabled } from '@/lib/sound';

/** Most pending reminders to consider in one pass. */
const MAX_ROWS = 50;
/**
 * Most reminders to DELIVER in one pass. A month away from a laptop should not
 * turn one page load into fifty sequential writes; the rest are picked up on
 * the next heartbeat, which is seconds later and still in the bell.
 */
const DELIVER_MAX = 20;
/** Collapse a burst of signals (realtime often fires several per edit). */
const REPLAN_DEBOUNCE_MS = 300;

type PendingRow = { id: string; title: string; remind_at: string | null };

export function ReminderScheduler() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    // Migration 0031 not applied → the query can never succeed. Latched off for
    // the session rather than retried every five minutes forever.
    let supported = true;

    function arm(ms: number) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void run(); }, ms);
    }

    async function run() {
      if (!alive || !supported || running) return;
      running = true;
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, remind_at')
          .not('remind_at', 'is', null)
          .is('reminded_at', null)
          .eq('done', false)
          .order('remind_at', { ascending: true })
          .limit(MAX_ROWS);
        if (!alive) return;

        if (error) {
          if (error.code === '42703') { supported = false; return; }
          arm(HEARTBEAT_MS);   // transient (offline, a 5xx) — try again later
          return;
        }

        const now = new Date();
        const { due, upcoming } = partitionDue((data ?? []) as PendingRow[], now);

        let spoke = 0;
        for (const row of due.slice(0, DELIVER_MAX)) {
          // The claim is the dedupe: three tabs race here and exactly one wins,
          // so exactly one toast and one bell entry exist per reminder.
          const claim = await claimReminder(row.id);
          if (!alive) return;
          if (!claim.claimed) continue;

          // Stale reminders are still claimed and still written to the bell —
          // nothing is dropped — but they do not interrupt. See FRESH_WINDOW_MS.
          if (!isFresh(row.remind_at!, now)) continue;

          // One cue for the batch. Three reminders arriving together should not
          // play three chimes over each other, and the app's single sound
          // switch governs it — a reminder is not a reason to invent a second
          // preference.
          if (spoke === 0 && taskSoundEnabled()) playFocusChime();
          spoke++;
          toast({
            variant: 'info',
            message: `Reminder · ${claim.title}`,
            action: { label: 'Open', onAction: () => router.push(`/tasks?task=${claim.id}`) },
          });
        }

        // A delivered reminder changes what every open surface should draw (the
        // chip stops reading as pending, the bell gains a row). One refresh for
        // the batch, and only when something actually happened.
        if (due.length) router.refresh();

        arm(nextWakeMs(upcoming[0]?.remind_at, new Date()));
      } finally {
        running = false;
      }
    }

    function replan() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { void run(); }, REPLAN_DEBOUNCE_MS);
    }

    const onVisible = () => { if (document.visibilityState === 'visible') replan(); };
    const onRealtime = (e: Event) => {
      if ((e as CustomEvent<{ table?: string }>).detail?.table === 'tasks') replan();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', replan);
    window.addEventListener(REALTIME_EVENT, onRealtime);
    window.addEventListener(REMINDERS_CHANGED, replan);
    void run();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (debounce) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', replan);
      window.removeEventListener(REALTIME_EVENT, onRealtime);
      window.removeEventListener(REMINDERS_CHANGED, replan);
    };
  }, [supabase, router]);

  return null;
}
