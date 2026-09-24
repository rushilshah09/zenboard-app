'use client';
// THE rule for what a hub puts in the URL, and how.
//
// ── WHY THIS FILE IS THE RULE AND NOT JUST A HOOK ───────────────────────────
// Every hub in Zenboard is a single route holding "which record is open" and
// "which mode am I in". Left to itself each one answered that differently, and
// the differences were invisible until you pressed Back:
//
//   Clients    record in the URL · tab in useState        → cannot link a tab,
//                                                            Back leaves Clients
//   Projects   tab READ from the URL, never WRITTEN back  → a notification can
//                                                            deep-link to it,
//                                                            you cannot
//   Forms      every tab a real route                     → fully addressable
//   Tasks      view + scope via useUrlState               → fully addressable
//
// Three answers to one question, and the Projects one is the worst kind:
// asymmetric, so the feature half-works in a way nobody notices until they try
// to send someone a link.
//
// ── THE RULE: TWO GESTURES, TWO BEHAVIOURS ──────────────────────────────────
//
//   SELECTING A RECORD  → `replaceState`. Browsing. Clicking through six
//                         clients must not bury the page you arrived from under
//                         six Back presses. Still shareable.
//
//   CHANGING A MODE     → `pushState`. A tab, a view, a filter is a place you
//                         went on purpose, so Back should return you to the
//                         previous one — and you should be able to send it to
//                         somebody.
//
// That difference is a DECISION, not an accident, which is what the consistency
// principle asks for (CONSISTENCY_PRINCIPLE.md): a divergence is allowed when
// it is named, caused by the use case, and written down where the code is.
//
// Neither costs a server round trip. Next documents the native History API as
// integrating with the router and syncing `useSearchParams`
// (01-getting-started/04-linking-and-navigating §"Native History API"), so the
// URL stays the single source of truth while `router.push` — which would refetch
// a `force-dynamic` route on every tab click — stays out of it.
//
// For state that is neither (a value the SERVER must reload data for), use
// `lib/use-url-state.ts`'s `go`. The two files are siblings: this one is the
// hub's own state, that one is the general mechanism.
import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

function write(key: string, value: string | null, replace: boolean): void {
  writeAll({ [key]: value }, replace);
}

function writeAll(entries: Record<string, string | null>, replace: boolean): void {
  if (typeof window === 'undefined') return;
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(entries)) {
    if (value) next.set(key, value); else next.delete(key);
  }
  const qs = next.toString();
  const href = qs ? `?${qs}` : window.location.pathname;
  const fn = replace ? window.history.replaceState : window.history.pushState;
  fn.call(window.history, null, '', href);
}

/**
 * Change several MODES as one step — `pushState` once, so Back undoes the whole
 * move. "12 more in Library" opens the Library ALREADY filtered to published;
 * two separate setters would leave an unfiltered Library as a stop in between
 * that nobody visited. `null` removes a key (pass it for a mode's default, so a
 * URL does not carry its own fallback).
 */
export function writeModes(entries: Record<string, string | null>): void {
  writeAll(entries, false);
}

/**
 * Which RECORD is open. `replaceState` — see the rule above.
 *
 * @param key   the param name — `c` clients · `page` documents · `invoice` finance.
 * @returns     `[selected, select]`. `select(null)` removes the param entirely
 *              rather than leaving `?c=` behind.
 */
export function useRecordParam(key: string): [string | null, (id: string | null) => void] {
  const params = useSearchParams();
  const selected = params.get(key);
  const select = useCallback((id: string | null) => write(key, id, true), [key]);
  return [selected, select];
}

/**
 * Which MODE the hub is in — a tab, a view, a layout. `pushState`.
 *
 * Validated against the modes that actually exist, so a hand-edited or stale
 * link lands on the fallback instead of rendering a tab bar with nothing
 * selected and an empty pane.
 *
 * Writing the same value twice is ignored. That is not a micro-optimisation:
 * Radix's Tabs fire on FOCUS **and** on click, so a URL-controlled tab bar
 * pushes two history entries per click without this, and Back then appears to
 * do nothing the first time you press it.
 */
export function useModeParam<T extends string>(
  key: string,
  fallback: T,
  valid: readonly T[],
  /**
   * Retired mode names that should still land somewhere sensible — e.g. a tab
   * that was folded into another one. Links live in emails and notifications
   * long after a screen is reorganised, and silently dumping such a link on the
   * default is a worse answer than the one the rename already knows.
   */
  aliases?: Readonly<Record<string, T>>,
): [T, (next: T) => void] {
  const params = useSearchParams();
  const raw = params.get(key);
  const resolved = (raw && aliases?.[raw]) ?? (raw as T | null);
  const value = resolved && valid.includes(resolved) ? resolved : fallback;

  const set = useCallback((next: T) => {
    if (next === value) return;
    // The fallback needs no param — a URL should not carry its own default.
    write(key, next === fallback ? null : next, false);
  }, [key, value, fallback]);

  return [value, set];
}
