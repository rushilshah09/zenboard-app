// When should Home pull Google Calendar events on its own?
//
// Home used to sync on EVERY visit. Each sync is a server action that calls
// Google, writes the events and then refreshes Home, a full second render of
// the most-visited page, and its writes echo back through Realtime as another
// refresh. Moving between Home and Tasks five times in a minute paid all of
// that five times for events that had not changed.
//
// The sync already records when it last ran (`gcal_last_synced`, set by
// importGoogleEvents), so a recent one is simply trusted. Only the AUTOMATIC
// sync is throttled: the Calendar's "sync now" button always runs.

/** How long an automatic sync stays fresh. */
export const AUTO_SYNC_FRESH_MS = 10 * 60 * 1000;

/** Should Home sync now? `lastSyncedISO` is `gcal_last_synced`, or null. */
export function shouldAutoSync(lastSyncedISO: string | null, now: number, freshMs = AUTO_SYNC_FRESH_MS): boolean {
  if (!lastSyncedISO) return true;
  const at = Date.parse(lastSyncedISO);
  if (!Number.isFinite(at)) return true;
  // A stamp slightly ahead of this clock is server/browser skew: treat it as
  // fresh. One far in the future is corrupt, and must not block syncing forever.
  if (at > now) return at - now > freshMs;
  return now - at >= freshMs;
}
