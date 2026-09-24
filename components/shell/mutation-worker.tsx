'use client';
// Mounts the mutation queue's worker. EXACTLY ONCE, in the app shell — the same
// rule as the toaster and the reminder scheduler, and here it is not a style
// preference: two workers draining one queue would deliver every edit twice.
//
// It renders nothing. Its whole job is to start delivery on load (picking up
// whatever the last tab left undelivered), to nudge the worker when the network
// comes back, and to turn a final refusal into something the user can see.
import { useEffect } from 'react';
import { loadQueue, kick, MUTATION_REVERTED, type RevertedDetail } from '@/lib/mutation-store';
import { toastReverted } from '@/components/ds/ui';

export function MutationWorker() {
  useEffect(() => {
    // Whatever was in flight when the last tab closed is still on disk. This is
    // the line that turns "you lost that tick" into "it arrives when you come
    // back".
    loadQueue();

    const onOnline = () => kick();
    // A refusal is the one outcome the user has to be told about: the change is
    // being taken off their screen, and silently reverting an edit is worse
    // than never applying it.
    // `toastReverted` and not a bespoke sentence: the direct (unqueued) write
    // path reverts too, and to the person those are one event. The wording is
    // owned by the DS so the two paths cannot drift apart.
    const onReverted = (e: Event) => {
      toastReverted((e as CustomEvent<RevertedDetail>).detail.reason);
    };
    // Best effort on the way out: a `visibilitychange` is the last reliable
    // moment in a mobile browser, and `beforeunload` never fires there.
    const onHide = () => { if (document.visibilityState === 'hidden') kick(); };

    window.addEventListener('online', onOnline);
    window.addEventListener(MUTATION_REVERTED, onReverted);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener(MUTATION_REVERTED, onReverted);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  return null;
}
