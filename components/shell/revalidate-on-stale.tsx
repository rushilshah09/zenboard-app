'use client';
// Stale-while-revalidate for a whole route: paint the cached page instantly,
// then correct it behind the user.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// `staleTimes.dynamic` lets Next reuse a page it already has in the browser's
// Client Cache, which is what makes going Tasks → Projects → Tasks paint
// immediately instead of waiting ~400ms for the server. On its own, though, it
// buys speed with honesty: the second visit could show a task you finished two
// minutes ago as unfinished, and nothing would ever correct it inside the
// stale window.
//
// So the cache is only half the pattern. The other half is noticing that what
// you are looking at came out of a cache, and quietly going to get the truth.
// That is exactly what Notion does — read the local store, sync behind you —
// and it is the difference between "fast" and "fast and correct".
//
// ── HOW IT KNOWS ────────────────────────────────────────────────────────────
// The server stamps each render with `Date.now()`. A payload served fresh from
// the server arrives milliseconds old; a payload served from the Client Cache
// carries the timestamp of whenever it was ORIGINALLY rendered, because the
// stamp is baked into the cached RSC payload. So the age of the stamp is a
// direct read of "did this come from a cache?" — no Next internals, no
// guessing, nothing that breaks when the router changes.
//
// Each (app) page mounts it through <PageStamp/>, so the stamp belongs to that
// page's own payload. It used to live in `app/(app)/template.tsx`; that stamp
// was never re-rendered by client navigations and turned every sidebar click
// into two server renders — components/shell/page-stamp.tsx has the account.
//
// ── WHAT "STALE" MEANS ──────────────────────────────────────────────────────
// Judged against when the navigation showing the page BEGAN, not against now:
// a page rendered after that moment is this navigation's own answer however
// long the server or the network took, and one rendered well before it came
// out of the cache. The first mount in a document belongs to the page load
// (`performance.timeOrigin`); each later one mounts as its navigation lands.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * How long before a navigation began a render may be and still count as ITS
 * render — the tolerance for a server clock and a browser clock that disagree.
 */
export const FRESH_MS = 2000;

/** Pure so it can be tested: was this payload served from a cache? */
export function isStalePaint(renderedAt: number, navStart: number, freshMs = FRESH_MS): boolean {
  if (!Number.isFinite(renderedAt) || !Number.isFinite(navStart)) return false;
  return renderedAt < navStart - freshMs;
}

// Has any page mounted in this document yet? See "WHAT STALE MEANS" above.
let documentHasMounted = false;

export function RevalidateOnStale({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const navStart = useRef<number | null>(null);

  useEffect(() => {
    if (navStart.current === null) {
      navStart.current = documentHasMounted ? Date.now() : performance.timeOrigin;
      documentHasMounted = true;
    }
    if (!isStalePaint(renderedAt, navStart.current)) return;
    // A frame later, so the cached content is on screen before the request
    // starts competing for the main thread. The user sees the page; the
    // correction arrives while they are still reading it.
    const id = setTimeout(() => router.refresh(), 0);
    return () => clearTimeout(id);
  }, [renderedAt, router]);

  return null;
}
