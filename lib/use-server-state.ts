'use client';
// Local state that follows a server prop — the shape every optimistic view in
// this app needs, written twenty-one times as an effect before it lived here.
import { useState } from 'react';

/**
 * State seeded from `incoming`, which snaps back to `incoming` whenever the
 * server sends a new one.
 *
 * This is the app's whole optimistic-update contract in one line. A view holds
 * its rows in local state so an edit can paint immediately, then calls
 * `router.refresh()`; when the refreshed props arrive they are authoritative
 * and must replace whatever local guess is on screen.
 *
 * Every view had spelled that out the same way:
 *
 *     const [rows, setRows] = useState(initialRows);
 *     useEffect(() => { setRows(initialRows); }, [initialRows]);
 *
 * WHY THAT IS WRONG, beyond the duplication. An effect runs *after* paint, so
 * React renders the stale rows, commits them to the DOM, then runs the effect,
 * sets state and renders again — two passes and a frame of stale data on every
 * refresh. React's own guidance ("You Might Not Need an Effect" → adjusting
 * state when a prop changes) is to compare during render instead: the component
 * re-runs immediately, before anything is committed, so the stale pass is never
 * shown. That is what this does, and it is why `react-hooks/set-state-in-effect`
 * flags the effect form as a real defect rather than a style preference.
 *
 * Setting state during render is legal *because* it is state of this same
 * component — React restarts the render rather than scheduling another one. The
 * comparison is `Object.is`, so it depends on the server prop being a new
 * reference only when it actually changed, which is exactly how a Server
 * Component's serialized props behave.
 *
 * Use it only for state the server owns. State the user owns — a filter, an
 * open panel, a draft — must NOT snap back mid-edit; leave that as `useState`.
 */
export function useServerState<T>(incoming: T) {
  const [value, setValue] = useState<T>(incoming);
  const [seen, setSeen] = useState<T>(incoming);

  if (!Object.is(seen, incoming)) {
    setSeen(incoming);
    setValue(incoming);
  }

  return [value, setValue] as const;
}
