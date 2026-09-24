'use client';
// Link metadata, fetched once per URL and shared across every caller in the
// session. A doc with the same link in three places, a bookmark card that
// re-mounts while you type elsewhere, or a Content library showing the link a
// capture came from, must not mean three fetches.
//
// Moved here from components/documents when Content became its second reader
// (2026-09-14): a hook two modules use lives in lib, not inside one of them.
//
// The cache itself lives in `lib/shared-cache.ts` — the same mechanism the record
// preview card uses for INTERNAL links.
import { useEffect, useState } from 'react';
import { createStore, sharedFetch, peek, prime } from '@/lib/shared-cache';
import type { LinkMeta } from '@/lib/unfurl';

const STORE = createStore<LinkMeta>();

export function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  return sharedFetch(STORE, url, () =>
    fetch(`/api/unfurl?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<LinkMeta>) : null)));
}

/**
 * Answer a URL without the network. Dev-preview harnesses have no session, so
 * `/api/unfurl` refuses them — without this, every link card in a harness is the
 * hostname-only fallback and the real card is never seen before it ships.
 */
export function primeLinkMeta(url: string, meta: LinkMeta | null): void {
  prime(STORE, url, meta);
}

/**
 * What is already known about a URL, without asking — for a reader that is not
 * rendering the link, like a search box matching the fetched titles of the cards
 * already on screen. `undefined` until someone has asked.
 */
export function peekLinkMeta(url: string): LinkMeta | null | undefined {
  return peek(STORE, url);
}

/**
 * `undefined` while loading, `null` when the link gave us nothing.
 *
 * Reads the cache during render rather than mirroring it into state — a
 * `setState` in the effect just to say "loading" costs an extra render on every
 * mount and trips the cascading-render rule for no benefit. The effect's only
 * job is to nudge a re-render once the fetch lands.
 */
export function useLinkMeta(url: string | undefined): LinkMeta | null | undefined {
  const [, bump] = useState(0);

  useEffect(() => {
    if (!url || peek(STORE, url) !== undefined) return;
    let alive = true;
    void fetchLinkMeta(url).then(() => { if (alive) bump((n) => n + 1); });
    return () => { alive = false; };
  }, [url]);

  if (!url) return undefined;
  return peek(STORE, url);
}
