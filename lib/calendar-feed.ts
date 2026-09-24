// The calendar FEED — principle 11, and the plan's "ICS feed out (read-only):
// your plan in any calendar app".
//
// A download already existed (`/api/export/calendar`). A download is not a feed,
// and the difference is the whole feature: an exported .ics is a snapshot that
// is wrong the moment anything moves, while a feed is a URL Apple Calendar,
// Google Calendar or Outlook keeps polling, so the plan you made in Zenboard
// stays correct in the calendar you already look at all day.
//
// Three consequences follow from "a calendar app fetches this", and they are why
// this file exists rather than a second copy of the export route:
//
//   1. NO COOKIES. A subscribing client sends no session, so the URL itself is
//      the credential — a bearer capability, like the portal token.
//   2. IT IS FETCHED FOREVER. So the window has to be bounded; an unbounded feed
//      grows until the client gives up on it.
//   3. IT MERGES TWO SOURCES. "Your plan" is not the calendar tab: a task you
//      scheduled for Thursday belongs in it even though it was never an event.
import { randomBytes } from 'crypto';
import type { IcsEvent } from '@/lib/ics';

/** Where the token lives in `profiles.preferences` — no migration needed. */
export const FEED_TOKEN_KEY = 'calendarToken';

/**
 * A feed token.
 *
 * 24 bytes, url-safe. The same shape and reasoning as the portal token: this URL
 * is the only thing standing between the internet and someone's schedule, and it
 * will be pasted into calendar clients that log URLs, so it must be long enough
 * that guessing is hopeless and cheap enough to rotate on a whim.
 */
export const newFeedToken = (): string => randomBytes(24).toString('base64url');

/** A token that could plausibly be one of ours — cheap rejection before any query. */
export const looksLikeFeedToken = (t: string | null | undefined): boolean =>
  !!t && /^[A-Za-z0-9_-]{20,64}$/.test(t);

/**
 * How much of the plan to publish.
 *
 * Bounded on purpose. A calendar app re-fetches this file every hour or two for
 * years; without a window it would grow without limit and every client would end
 * up re-parsing a decade of history on a phone. A year back is enough to answer
 * "when did I do that", a year forward is further than anyone has planned.
 */
export const FEED_PAST_DAYS = 365;
export const FEED_FUTURE_DAYS = 365;

export function feedWindow(now = new Date()): { from: string; to: string } {
  const from = new Date(now); from.setUTCDate(from.getUTCDate() - FEED_PAST_DAYS);
  const to = new Date(now); to.setUTCDate(to.getUTCDate() + FEED_FUTURE_DAYS);
  return { from: from.toISOString(), to: to.toISOString() };
}

export type FeedTask = {
  id: string;
  title: string;
  scheduled_date: string | null;
  /** 0030's timebox twin. Non-null ⇒ this task is ALREADY in calendar_events. */
  event_id: string | null;
  done?: boolean;
};

/**
 * The tasks that belong in the feed, as all-day entries.
 *
 * A task with an `event_id` is deliberately skipped: 0030's timebox twin means
 * it already exists as a calendar event, and emitting both would show the same
 * work twice — once at its real time and once smeared across the whole day,
 * which is the single most annoying thing a subscribed calendar can do.
 *
 * The `zb-task-` UID prefix keeps the two namespaces apart. Without it a task
 * and an event that happened to share an id would collide, and a calendar client
 * resolves a UID collision by silently overwriting one with the other.
 */
export function tasksAsIcsEvents(tasks: FeedTask[], window: { from: string; to: string }): IcsEvent[] {
  const fromDay = window.from.slice(0, 10);
  const toDay = window.to.slice(0, 10);
  return tasks
    .filter((t) => t.scheduled_date && !t.event_id && t.scheduled_date >= fromDay && t.scheduled_date <= toDay)
    .map((t) => ({
      id: `zb-task-${t.id}`,
      // A finished task stays in the feed — a calendar is a record of what
      // happened, not only of what is left — but it says so, the way a crossed
      // off line in a paper diary does.
      title: t.done ? `✓ ${t.title}` : t.title,
      starts_at: `${t.scheduled_date}T00:00:00.000Z`,
      ends_at: null,
      all_day: true,
    }));
}

/**
 * Merge events and scheduled tasks into one chronological feed.
 *
 * Sorted because a calendar file is also read by humans debugging one, and
 * because some older clients keep the file's order for same-instant entries.
 */
export function mergeFeed(events: IcsEvent[], tasks: IcsEvent[]): IcsEvent[] {
  return [...events, ...tasks].sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));
}
