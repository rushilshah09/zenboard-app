'use client';
// The React binding for the mutation queue.
//
// `useSyncExternalStore` rather than an effect, because the queue is exactly
// what that hook is for: state owned outside React that components need to
// re-render on. It also gives the server snapshot for free — on the server
// there is no queue, and pretending otherwise would be a hydration mismatch.
import { useSyncExternalStore } from 'react';
import { getPending, subscribe } from '@/lib/mutation-store';
import type { QueuedOp } from '@/lib/mutation-queue';

/** Nothing is pending on the server. A stable reference, so the snapshot does
 *  not look like it changed on every render. */
const NONE: QueuedOp[] = [];

export function usePendingMutations(): QueuedOp[] {
  return useSyncExternalStore(subscribe, getPending, () => NONE);
}
