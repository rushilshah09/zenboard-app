'use client';
// "Take me to that block" — the signal, separated from the thing that obeys it.
//
// WHY THIS IS NOT JUST `location.hash`. A same-page hash change made through
// the App Router goes out as `history.pushState`, and pushState deliberately
// does NOT fire `hashchange`. So the one case block links exist for — following
// a link to a block in the document you are already reading — is exactly the
// case the native event misses. `usePathname`/`useSearchParams` cannot help
// either: neither of them carries the fragment.
//
// So the app announces it, on the same `zb:` custom-event seam it already uses
// for realtime and the focus timer. The URL stays authoritative for a cold load
// or a back/forward; the event covers every navigation the router performs.
//
// State lives outside React because the answer belongs to the WINDOW, not to a
// component, and is read through `useSyncExternalStore` so the server snapshot
// can be `null` — reading `location` during render is a hydration mismatch, and
// setting it from an effect is a frame of the wrong thing plus a lint error.
import { useSyncExternalStore } from 'react';
import { parseBlockFragment } from '@/lib/block-link';

export const BLOCK_ANCHOR_EVENT = 'zb:block-anchor';

export type BlockAnchor = {
  id: string;
  /** Bumped per request, so asking for the same block twice is two events. */
  nonce: number;
  /** When it was asked for — see ANCHOR_TTL. */
  at: number;
};

/**
 * How long a request stays live.
 *
 * A block link can land before the document it names has finished loading, so
 * the consumer retries as content arrives rather than giving up on the first
 * miss. This is what bounds that: after eight seconds the page has plainly
 * finished loading and the block is simply not there, so the retry stops
 * instead of re-scanning on every future keystroke.
 */
export const ANCHOR_TTL = 8000;

let current: BlockAnchor | null = null;
let nonce = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** `bump: false` — a URL re-read for the block we are already on is not a new
 *  request, which is what stops `hashchange` and `popstate` (both of which fire
 *  for one back-button press) restarting the same flash twice. */
function set(id: string | null, bump = true) {
  if (!id) { if (current) { current = null; emit(); } return; }
  if (!bump && current?.id === id) return;
  current = { id, nonce: ++nonce, at: Date.now() };
  emit();
}

function fromUrl() {
  set(parseBlockFragment(window.location.hash), false);
}

function onRequest(e: Event) {
  const id = (e as CustomEvent<string>).detail;
  if (typeof id === 'string' && id) set(id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('hashchange', fromUrl);
    window.addEventListener('popstate', fromUrl);
    window.addEventListener(BLOCK_ANCHOR_EVENT, onRequest);
    // Seed silently: React re-reads the snapshot immediately after subscribing,
    // so notifying from inside `subscribe` would be a redundant render.
    const id = parseBlockFragment(window.location.hash);
    current = id ? { id, nonce: ++nonce, at: Date.now() } : null;
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener('hashchange', fromUrl);
      window.removeEventListener('popstate', fromUrl);
      window.removeEventListener(BLOCK_ANCHOR_EVENT, onRequest);
      // Nothing is watching, so nothing is remembered. This is what makes
      // leaving a document and coming back to the same `#block-…` flash again
      // instead of being deduped against a stale answer.
      current = null;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** The block the URL (or the app) is currently asking to be shown, or null. */
export function useBlockAnchor(): BlockAnchor | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Ask for a block. Safe to call before the target document has rendered — the
 * consumer holds the request open for `ANCHOR_TTL` while content arrives.
 */
export function requestBlockAnchor(blockId: string): void {
  if (typeof window === 'undefined' || !blockId) return;
  window.dispatchEvent(new CustomEvent(BLOCK_ANCHOR_EVENT, { detail: blockId }));
}
