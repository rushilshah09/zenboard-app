'use client';
// State that lives in the URL but does NOT cost a server round trip to change.
//
// ── THE PROBLEM, STATED PLAINLY ─────────────────────────────────────────────
// Clicking "Today" in the Tasks rail used to re-render the page on the server,
// which re-fetched EVERY TASK YOU OWN — to draw a subset of the tasks the
// browser was already holding. Same for picking a list, opening the Filter
// menu, and switching List/Board. Four controls, all reading data that was
// already in memory, all paying ~400ms and a full remount to do it.
//
// That is the difference between this app and Notion, and it is not a tuning
// problem. Notion loads once and then every click reads from a local store; the
// server is involved only for records it does not have and for writing changes
// back. Navigation is not data fetching. Here, navigation WAS data fetching,
// every single time.
//
// ── THE MECHANISM ───────────────────────────────────────────────────────────
// Next supports `window.history.pushState` as a first-class escape hatch: the
// docs shipped in this repo say it "integrates into the Next.js Router,
// allowing you to sync with usePathname and useSearchParams". So the URL stays
// the single source of truth — linkable, shareable, back/forward for free — but
// changing it does not ask the server anything.
//
// WHAT THIS IS NOT FOR. Anything the client does not already have. Switching to
// the week board loads a different seven-day window, so that stays a real
// navigation; pretending otherwise would show an empty board. The rule is:
// shallow when the answer is already in memory, real when it is not.
import { useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Change the URL without asking the server for anything.
 *
 * `pushState` adds a history entry (Back returns you); `replaceState` does not,
 * which is right for a correction rather than a move — e.g. normalising a
 * filter combo that arrived malformed in a shared link.
 */
export function shallowNavigate(href: string, replace = false): void {
  if (typeof window === 'undefined') return;
  const fn = replace ? window.history.replaceState : window.history.pushState;
  fn.call(window.history, null, '', href);
}

export type UrlState<T> = {
  /** The current value, read from the URL. The URL IS the state. */
  value: T;
  /** Change it without a server round trip. */
  set: (next: T) => void;
  /** Change it WITH one — for a value the server has to reload data for. */
  go: (next: T) => void;
};

/**
 * Read a value out of the query string and write it back shallowly.
 *
 * Deliberately derived rather than mirrored into `useState`: two copies of the
 * same fact drift, and the drift here would be the Back button showing one
 * thing while the page shows another. `useSearchParams` re-renders on
 * `pushState`, so deriving is both simpler and correct.
 */
export function useUrlState<T>(
  parse: (params: URLSearchParams) => T,
  serialise: (value: T) => string,
): UrlState<T> {
  const searchParams = useSearchParams();
  const router = useRouter();

  // `useSearchParams` returns a ReadonlyURLSearchParams; parsers take the
  // ordinary one, and copying is cheap next to what it replaces.
  const value = parse(new URLSearchParams(searchParams.toString()));

  const set = useCallback((next: T) => shallowNavigate(serialise(next)), [serialise]);
  const go = useCallback((next: T) => router.push(serialise(next)), [router, serialise]);

  return { value, set, go };
}
