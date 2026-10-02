// HOW A LIST OF DOCUMENTS IS SECTIONED ON SCREEN.
//
// The Documents index sorts pinned first, then by last edit — and then showed that order as
// one undifferentiated wall: fifteen cards each saying "Updated 3h ago", nothing to say where
// today ended and last month began. An index exists to FIND a document, and people remember
// documents by when they last touched them ("the thing I was writing on Monday"), which is why
// every tool built for retrieval — Claude's and ChatGPT's histories, Linear's inbox, the Mac's
// Finder — sections a recency-ordered list into calendar buckets.
//
// The buckets are CALENDAR days in the person's own zone, not elapsed hours. "Today" means since
// their midnight; "the last 24 hours" is a different and less useful claim. That needs a zone on
// the SERVER too: this list is rendered there first, on Cloudflare, in UTC — and a doc edited at
// 01:00 in Kolkata would land in "Today" in the browser and "Yesterday" on the server, which is a
// hydration mismatch. The caller passes the zone from the profile (lib/date.ts readTimeZone).

import { isoDateIn, addDaysISO } from '@/lib/date';

export type DocGroupId = 'pinned' | 'today' | 'yesterday' | 'week' | 'month' | 'older';

/** In display order. Sentence case, per the glossary rule for headings. */
export const DOC_GROUPS: { id: DocGroupId; label: string }[] = [
  { id: 'pinned', label: 'Pinned' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Previous 7 days' },
  { id: 'month', label: 'Previous 30 days' },
  { id: 'older', label: 'Older' },
];

/** Which calendar bucket a timestamp falls in, relative to `today` (a YYYY-MM-DD in `tz`). */
export function recencyOf(updatedAt: string, today: string, tz?: string): Exclude<DocGroupId, 'pinned'> {
  const day = isoDateIn(updatedAt, tz);
  if (!day) return 'older';
  // A timestamp AHEAD of today (another device's clock running fast) is still "today": it is
  // the most recent thing there is, and filing it under Older would bury the newest edit.
  if (day >= today) return 'today';
  if (day === addDaysISO(today, -1)) return 'yesterday';
  if (day >= addDaysISO(today, -7)) return 'week';
  if (day >= addDaysISO(today, -30)) return 'month';
  return 'older';
}

export type DocGroup<T> = { id: DocGroupId; label: string; items: T[] };

/**
 * Section an ALREADY-SORTED list. Order inside a group is the caller's (pinned first, then most
 * recent) and is never re-sorted here, so the grouping can only ever add headings to the order
 * the person was already looking at — never move a row out from under them.
 *
 * Empty groups are dropped: a heading over nothing is chrome asking to be fed.
 */
export function groupDocs<T extends { updated_at: string; is_pinned?: boolean }>(
  items: readonly T[],
  today: string,
  tz?: string,
): DocGroup<T>[] {
  const buckets = new Map<DocGroupId, T[]>();
  for (const it of items) {
    const id: DocGroupId = it.is_pinned ? 'pinned' : recencyOf(it.updated_at, today, tz);
    const list = buckets.get(id);
    if (list) list.push(it);
    else buckets.set(id, [it]);
  }
  return DOC_GROUPS.filter((g) => buckets.has(g.id)).map((g) => ({ ...g, items: buckets.get(g.id)! }));
}
