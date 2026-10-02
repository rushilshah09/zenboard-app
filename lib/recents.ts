'use client';
// What you opened last — the store behind every "Recent" section in the app.
//
// Keyed by ContentType rather than owned by Documents, because the recents list
// is wanted in at least three places and there must only ever be one of it:
// the breadcrumb menus (DOCUMENT_NAVIGATION_UX §2.2), the command palette —
// whose `recentIds` prop has been passed an empty array since it shipped — and,
// later, the quick switcher (§5 items 3 and 13).
//
// Conventions copied deliberately from lib/page-view-mode.ts: parse once into a
// module cache, subscribe through `useSyncExternalStore`, and never take the UI
// down over a preference. Read its comments before changing the shape of this.
import { useCallback, useSyncExternalStore } from 'react';
import type { ContentType } from './page-view-mode';
import { isTempId } from '@/lib/temp-id';

const KEY = 'zb:recents:v1';
/** Long enough that a menu can show 3 and a palette 8; short enough to stay a
 *  memory of *this session's* work rather than a history file. */
const CAP = 20;

type Stored = Partial<Record<ContentType, string[]>>;

// A stable empty array. `useSyncExternalStore` compares snapshots with
// `Object.is`, so a getter that returned a fresh `[]` each call would re-render
// for ever — the same trap page-view-mode.ts documents for objects.
const NONE: string[] = [];

let cache: Stored | null = null;

function read(): Stored {
  if (typeof window === 'undefined') return {};
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    // A half-written or hand-edited value must not reach a `.map()` downstream.
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Stored) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Stored) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* private mode, quota — a recents list is never worth an error */ }
  // `storage` fires in OTHER tabs only, so tell this one directly.
  window.dispatchEvent(new CustomEvent('zb:recents'));
}

function subscribe(onChange: () => void): () => void {
  const local = () => onChange();
  const cross = () => { cache = null; onChange(); };
  window.addEventListener('zb:recents', local);
  window.addEventListener('storage', cross);
  return () => {
    window.removeEventListener('zb:recents', local);
    window.removeEventListener('storage', cross);
  };
}

/** Most-recent-first ids for a type. Same array reference until something writes. */
export function recentIds(type: ContentType): string[] {
  return read()[type] ?? NONE;
}

/**
 * Record that `id` was just opened.
 *
 * Moves an id already in the list to the front rather than appending a second
 * copy — a recents list with duplicates is a log, not a shortcut. A no-op when
 * the id is already first, so re-rendering a page you are already on cannot
 * churn localStorage.
 */
export function pushRecent(type: ContentType, id: string) {
  if (typeof window === 'undefined' || !id) return;
  // Optimistic rows carry a temp id that stops existing the moment the insert
  // lands. Remembering one guarantees a dead entry.
  if (isTempId(id)) return;
  const cur = recentIds(type);
  if (cur[0] === id) return;
  write({ ...read(), [type]: [id, ...cur.filter((x) => x !== id)].slice(0, CAP) });
}

/** Forget one id — call when the thing behind it is deleted for good. */
export function forgetRecent(type: ContentType, id: string) {
  if (typeof window === 'undefined') return;
  const cur = recentIds(type);
  if (!cur.includes(id)) return;
  write({ ...read(), [type]: cur.filter((x) => x !== id) });
}

/** `[ids, push]` — the subscribing read. */
export function useRecents(type: ContentType): [string[], (id: string) => void] {
  const ids = useSyncExternalStore(
    subscribe,
    () => recentIds(type),
    () => NONE, // the server has no localStorage; an empty list is the honest answer
  );
  const push = useCallback((id: string) => pushRecent(type, id), [type]);
  return [ids, push];
}
