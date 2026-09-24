// WHEN A LIVE CHANGE SHOULD COST A SERVER RENDER.
//
// `RealtimeSync` subscribes to twenty tables and answers every row change with
// `router.refresh()`, which re-runs every Server Component for the current
// route. On Home that is a ten-query wave — ~1.2s of server work against a
// ~228ms median Supabase round trip. Any edit, from any device, on any of those
// tables, used to pay that in EVERY open tab, including ones backgrounded for
// hours.
//
// A hidden tab renders nothing, so refreshing it cannot change anything the
// user sees. But an update must never be DROPPED, so the rule is defer-and-
// remember, not ignore.
//
// This lives apart from the component because the guarantees are worth testing
// directly: many edits while hidden must collapse into exactly ONE refresh on
// return, and a tab that missed nothing must not refresh at all.

export type Visibility = 'visible' | 'hidden';

/** Nothing missed yet. */
export const initialSync: SyncState = { missed: false };
export type SyncState = { readonly missed: boolean };

export type Decision = 'refresh' | 'defer' | 'none';

/** A row change arrived. */
export function onRowChange(state: SyncState, visibility: Visibility): { state: SyncState; action: Decision } {
  if (visibility === 'hidden') return { state: { missed: true }, action: 'defer' };
  return { state, action: 'refresh' };
}

/** The tab's visibility changed. */
export function onVisibilityChange(state: SyncState, visibility: Visibility): { state: SyncState; action: Decision } {
  // Going hidden is never a reason to refresh, and must not clear what we owe.
  if (visibility !== 'visible') return { state, action: 'none' };
  // Coming back with nothing missed must NOT refresh — otherwise every tab
  // switch costs a wave, which is worse than the behaviour being replaced.
  if (!state.missed) return { state, action: 'none' };
  return { state: initialSync, action: 'refresh' };
}
