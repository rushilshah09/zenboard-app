'use client';
// The net under the un-queued write path.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Every server action in this app declares `Promise<{ error: string } | { ok }>`,
// and every call site reads it as `if ('error' in res)`. That handles failures
// the action DECIDES on. When the promise REJECTS instead, the `if` never runs,
// the optimistic patch stays on screen, and — measured 2026-09-12 — a ticked task
// sat there looking saved when it was not. `lib/action-failure.ts` names the
// three ways that happens and why each needs a different remedy.
//
// ── WHAT CHANGED, 2026-09-14 ────────────────────────────────────────────────
// The first version caught only rejections carrying a server `digest`, and could
// only say "what's on screen may be out of date". Two things were wrong with it:
//
//  1. It was DEAF to the commonest failure. A tab left open across a deploy calls
//     an action ID the new server no longer has; Next throws
//     `UnrecognizedActionError`, which has no digest. We deploy several times a
//     day. Read from Next's own source (server-action-reducer.js), not guessed.
//
//  2. It could not put anything back, so it apologised instead. But this app
//     already has a revert: `useServerState` snaps every view to its server
//     props whenever a refresh delivers new ones — `RealtimeSync` relies on
//     exactly that for every row change another device makes. So for a server
//     failure the net now REFRESHES, and the unsaved edit visibly goes away on
//     all 17 server-owned surfaces at once, with no call site touched. That is
//     what the recorded 289-call-site sprint was for.
//
// What a refresh cannot reach — state a component loaded for itself on the
// client, like the task drawer's tree or the focus timer's list — is reached by
// `RESYNC_EVENT` instead, dispatched at the same moment.
import { useEffect, useRef } from 'react';
import { useRouter, unstable_isUnrecognizedActionError } from 'next/navigation';
import { toast } from '@/components/ds/ui';
import { classifyRejection, FAILURE_COPY, RESYNC_EVENT } from '@/lib/action-failure';

/** One refresh for a burst: five edits failing together is one server truth. */
const REFRESH_COOLDOWN_MS = 1500;

export function ActionFailureNet() {
  const router = useRouter();
  const lastRefresh = useRef(0);
  /** A failure happened while unreachable; correct the screen when we are back. */
  const owesRefresh = useRef(false);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_COOLDOWN_MS) return;
      lastRefresh.current = now;
      // Server-owned views: new props, and `useServerState` snaps them back.
      router.refresh();
      // Views that loaded their own rows: told to load them again.
      window.dispatchEvent(new Event(RESYNC_EVENT));
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const kind = classifyRejection(e.reason, { isStaleDeployment: unstable_isUnrecognizedActionError });
      if (!kind) return;

      if (kind === 'stale') {
        // Reload, never refresh — see lib/action-failure.ts. Offered rather than
        // forced: the page may be holding typing that is not in this failure.
        // A standing condition, so a run of edits collects as ×N on one toast.
        toast({
          message: FAILURE_COPY.stale,
          variant: 'error',
          action: { label: 'Reload', onAction: () => window.location.reload() },
          dedupeMs: 5 * 60_000,
        });
        return;
      }

      if (kind === 'unreachable') {
        // Refreshing now would fail the same way. The browser's `online` event
        // is the moment it can succeed.
        owesRefresh.current = true;
        toast({ message: FAILURE_COPY.unreachable, variant: 'error', dedupeMs: 5 * 60_000 });
        return;
      }

      toast({ message: FAILURE_COPY.server, variant: 'error', dedupeMs: 60_000 });
      refresh();
    };

    const onOnline = () => {
      if (!owesRefresh.current) return;
      owesRefresh.current = false;
      refresh();
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('online', onOnline);
    };
  }, [router]);

  return null;
}
