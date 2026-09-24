'use client';
// Re-run a component's own loader when a write failed. See `RESYNC_EVENT` in
// lib/action-failure.ts for why this exists and why it is not `zb:realtime`.
import { useEffect } from 'react';
import { RESYNC_EVENT } from '@/lib/action-failure';
import { useLatest } from '@/lib/use-latest';

/**
 * For a component that loaded its rows on the client, so a `router.refresh()`
 * cannot correct them. `enabled` exists because such components are often
 * mounted while closed, and a closed panel re-fetching is pure waste.
 *
 * The loader is held in a latest-ref, so the listener is attached once per
 * `enabled` change rather than re-attached on every render of a caller that
 * passes a fresh arrow.
 */
export function useResync(reload: () => void, enabled = true): void {
  const latest = useLatest(reload);
  useEffect(() => {
    if (!enabled) return;
    const onResync = () => latest.current();
    window.addEventListener(RESYNC_EVENT, onResync);
    return () => window.removeEventListener(RESYNC_EVENT, onResync);
  }, [enabled, latest]);
}
