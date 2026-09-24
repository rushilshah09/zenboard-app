'use client';
// "Push this route once, not twice."
//
// THE BUG THIS EXISTS FOR, measured in the dev server log: every tab click and
// every layout-switch click rendered the page TWICE on the server, back to
// back, at the same cost. On a page that takes 400ms of queries that is 400ms
// of pure waste per click, and the log was full of it:
//
//     GET /forms/…/share    200 in 573ms
//     GET /forms/…/share    200 in 587ms
//     GET /forms/…/insights 200 in 382ms
//     GET /forms/…/insights 200 in 480ms
//
// WHY. Radix's Tabs and RadioGroup (our `Tabs` and `SegmentedControl`) activate
// AUTOMATICALLY — `onValueChange` fires when a trigger receives focus, and
// again when it is clicked. That is normally harmless, because by the second
// event the controlled value has already changed and Radix suppresses it. But
// these controls are controlled by the URL, and the URL does not change until
// the navigation lands. The click handler therefore still saw the old value,
// still believed it was a change, and pushed the same route again.
//
// It is not a debounce and deliberately not a timer. It remembers exactly one
// destination — the one in flight — so pressing → along a tab strip still
// navigates to each tab in turn; only a repeat of the destination is dropped.
//
// WHY THE BOOKKEEPING IS ALL INSIDE THE HANDLER: the guard has to be
// SYNCHRONOUS. The two events arrive in the same tick, so a `useState` marker
// would still read as empty on the second one — React has not re-rendered yet.
// That means a ref; and a ref may not be touched during render (render must be
// pure, and the compiler enforces it). So the marker is both set and expired
// inside the callback, where `current` is available as a closure value and
// reading `.current` is legal.
import { useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Where we are going, and where we were when we set off. */
export type PendingNav = { to: string; from: string } | null;

/**
 * The whole decision, as a pure function so it can be tested — this repo has no
 * React test renderer, and a guard that silently stops working would put the
 * double render back without anything failing.
 */
export function decideNav(pending: PendingNav, current: string, value: string): { push: boolean; pending: PendingNav } {
  // The marker only means anything while we are still standing where we were
  // when it was set. The moment `current` moves — arrived, or the user went
  // somewhere else entirely — it is stale and must not block the next push.
  const live = pending && pending.from === current && pending.to !== current ? pending : null;

  if (value === current) return { push: false, pending: live };   // already there
  if (live?.to === value) return { push: false, pending: live };   // already on the way
  return { push: true, pending: { to: value, from: current } };
}

export function useNavOnce(current: string) {
  const router = useRouter();
  const pending = useRef<PendingNav>(null);

  return (value: string, href: string) => {
    const next = decideNav(pending.current, current, value);
    pending.current = next.pending;
    if (next.push) router.push(href);
  };
}
