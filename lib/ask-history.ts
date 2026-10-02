// ── HOW A LIST OF CONVERSATIONS BECOMES A RAIL ──────────────────────────────
//
// USER DIRECTION 2026-09-29: "left side of history chat collessable … i want claude like claude
// chat expirence", with Claude's own sidebar — a pinned block, then dated groups, then "Older".
//
// EVERYTHING HERE IS ARITHMETIC, and deliberately so: rows in, groups out. No Supabase, no clock,
// no timezone — the caller resolves all three, which is what makes the grouping testable rather
// than something you have to open the app at midnight to check. Same contract as `lib/waiting.ts`
// and `lib/inbox-file.ts`, for the same reason.
//
// ── THE DAY IS A CALENDAR DAY, NOT A TIMESTAMP ──────────────────────────────
// `last_message_at` is an instant, and the group it belongs to is a DAY IN THE PERSON'S ZONE.
// Those differ for part of every night, which is the bug `lib/date.ts` exists to stop: at 00:30 in
// Delhi a conversation from ten minutes ago is still "yesterday" in UTC, so a naive
// `toISOString().slice(0, 10)` files it under the wrong heading and it vanishes from "Today" while
// the person is still reading it. The caller passes `isoDateIn`, and every comparison below is
// between day IDS.
//
// Where a function here needs the zone itself (`conversationWhen`, which prints a clock time), it
// takes `tz` as an ARGUMENT. That is the same contract, not an exception to it: the caller still
// resolves the zone, and this module still never reads a clock — `todayISO()` and `new Date()` are
// what the header forbids, not `lib/date.ts`'s pure formatters.
import { formatClock, formatRelativeDay, isoDateIn } from '@/lib/date';

/** One conversation, as the rail needs it — never its messages. */
export type AskConversation = {
  id: string;
  title: string;
  /** Full ISO instant of the last message. The rail sorts on this; the group label comes from its DAY. */
  lastMessageAt: string;
  pinned: boolean;
};

export type AskGroup = { label: string; items: AskConversation[] };

/**
 * How far back a conversation keeps its own date before it joins "Older".
 *
 * Thirty days, because the rail's job is to get you back to something you were recently in the
 * middle of. A year of daily use with no cut-off is 365 headings, which is not a list any more —
 * it is a scroll with dates in it, and the pinned block plus search are what serve the long tail.
 */
export const DATED_DAYS = 30;

/** The heading for everything past `DATED_DAYS`. One string, so the rail and its test agree. */
export const OLDER = 'Older';

/** The heading for the pinned block, which sits above every dated group. */
export const PINNED = 'Pinned';

const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/**
 * An instant as a number, for ordering.
 *
 * The sort was `lastMessageAt.localeCompare(...)`, which is only ever valid while every string in
 * the list shares one format AND one UTC offset. This list stopped being able to promise that when
 * `withLive` began folding the conversation you are typing in among the ones the server listed:
 * Postgres spells an instant `2026-09-30T12:14:05.123456+00:00` and the browser spells it
 * `2026-09-30T12:14:05.123Z` — six fractional digits and an offset against three and a `Z`.
 *
 * **Honestly: with the offset at `+00:00`, as this deployment returns it, the two spellings agree on
 * every comparison a person could see** — they first differ at the fractional digits, so only two
 * instants within a millisecond of each other can be misordered. The reason to parse is that the
 * ordering should not DEPEND on that coincidence. Let the database's session zone be anything but
 * UTC and a lexicographic compare is wrong by a whole offset: `17:44:05+05:30` sorts after
 * `12:20:00Z` and is four minutes earlier. Comparing instants by parsing them is simply what
 * comparing instants means, and it costs nothing.
 *
 * A row whose instant will not parse sorts oldest, which lands it in `Older` — findable and
 * deletable. Dropping it would be telling someone their conversation is gone because one column is
 * malformed.
 */
const instant = (iso: string): number => Date.parse(iso) || 0;

/**
 * Group conversations for the rail: pinned first, then by day, newest first, with everything past
 * `DATED_DAYS` collected under one heading.
 *
 * `dayOf` is passed in rather than computed, because turning an instant into a day needs the
 * person's zone and this module refuses to know it (see the header). `today` is their own today,
 * for the same reason.
 *
 * **A pinned conversation appears ONCE, in `Pinned`** — not in both places. Showing it twice makes
 * the rail's row count disagree with its conversation count, and a person who deletes "the second
 * one" is surprised when the first disappears too.
 */
export function groupConversations(
  rows: readonly AskConversation[],
  { today, dayOf }: { today: string; dayOf: (iso: string) => string | null },
): AskGroup[] {
  const byRecency = [...rows].sort((a, b) => instant(b.lastMessageAt) - instant(a.lastMessageAt));

  const pinned = byRecency.filter((c) => c.pinned);
  const rest = byRecency.filter((c) => !c.pinned);

  const groups: AskGroup[] = pinned.length ? [{ label: PINNED, items: pinned }] : [];

  // Insertion order IS display order: `rest` is already newest-first, so the first time a day is
  // seen is the right place for its heading. A Map keeps that without a second sort.
  const dated = new Map<string, AskConversation[]>();
  const older: AskConversation[] = [];

  for (const c of rest) {
    const day = dayOf(c.lastMessageAt);
    // A row whose instant will not parse is not dropped — it goes to `Older`, where it can still
    // be found and deleted. Silently hiding a record because one column is malformed is how a
    // person ends up believing their data is gone.
    if (!day || dayDiff(today, day) > DATED_DAYS || dayDiff(today, day) < 0) {
      older.push(c);
      continue;
    }
    const label = formatRelativeDay(day, { now: today, weekday: true }) ?? day;
    const bucket = dated.get(label);
    if (bucket) bucket.push(c);
    else dated.set(label, [c]);
  }

  for (const [label, items] of dated) groups.push({ label, items });
  if (older.length) groups.push({ label: OLDER, items: older });
  return groups;
}

/**
 * The title a new conversation gets: the person's own first sentence, trimmed to something a
 * 230px rail can show.
 *
 * **A model never writes this.** That is `lib/ask.ts`'s standing rule — a model never names a
 * record — and it applies to the conversation as much as to the task inside it. Their own words
 * are also simply better at being recognised later than a summary would be.
 */
export const MAX_TITLE = 80;

export function titleFor(firstMessage: string): string {
  const one = firstMessage.trim().replace(/\s+/g, ' ');
  if (!one) return 'New chat';
  return one.length > MAX_TITLE ? `${one.slice(0, MAX_TITLE - 1).trimEnd()}…` : one;
}

/**
 * The rail's search: a plain case-insensitive match on the title.
 *
 * Titles ONLY, on purpose. Searching message bodies is a different feature with a different cost
 * (it is a server query over every message in the account, and Search v2 already owns that job for
 * the whole product — see `lib/search.ts`). A rail filter that quietly became a full-text search
 * would be slow in exactly the moment it should feel instant: while you are typing.
 */
export function filterConversations(rows: readonly AskConversation[], query: string): AskConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((c) => c.title.toLowerCase().includes(q));
}

/**
 * The conversation on screen RIGHT NOW, as much of it as the browser knows.
 *
 * `at` is when something was last said in it, and `title` is what `titleFor` made of the first
 * sentence — both already in the store, neither yet on the server's list.
 */
export type LiveConversation = { id: string; title: string; at: string };

/**
 * The rail's list, with what the browser knows folded into what the server listed.
 *
 * ── WHAT THIS REPLACED ──────────────────────────────────────────────────────
 * An imperative `bump(id, title)` that the send path was supposed to call and never did — so asking
 * your first question filed a conversation, selected it, and left the rail reading "Your chats will
 * appear here" while you sat in the chat it was describing. The list only agreed with the store
 * after a reload, which is the one moment a person would never check.
 *
 * The list is READ ONCE, when Ask is first opened, and everything after that happens in this
 * browser: a conversation started here is not on the server's answer at all, and one spoken in here
 * is newer than the `last_message_at` that answer carried. This is the one place those two are
 * reconciled, so there is no second rule to keep in step.
 *
 * ── IT RETURNS `rows` ITSELF WHEN NOTHING CHANGED ───────────────────────────
 * Not a copy — the same reference. That is load-bearing rather than tidy: the caller applies this
 * through `setConversations` from an effect, and React bails out of a re-render when a setter
 * returns the state it was handed. A fresh array every time would re-render the rail on every pass
 * forever, and `[...rows]` would look exactly as correct while doing it.
 *
 * A conversation already in the list is BUMPED, never duplicated: continuing Tuesday's chat moves
 * it to Today, where someone who just spoke expects to find it. `at` only wins when it is actually
 * newer, so a stale value can never drag a row backwards.
 */
export function withLive(rows: AskConversation[], live: LiveConversation | null): AskConversation[] {
  if (!live) return rows;

  const at = rows.findIndex((c) => c.id === live.id);
  if (at === -1) return [{ id: live.id, title: live.title, lastMessageAt: live.at, pinned: false }, ...rows];

  // The server's title wins — it is the one a rename edited. The live title is only ever needed for
  // a row the server has not listed yet, which is the branch above.
  const found = rows[at];
  if (instant(live.at) <= instant(found.lastMessageAt)) return rows;

  const next = [...rows];
  next[at] = { ...found, lastMessageAt: live.at };
  return next;
}

/**
 * WHEN THIS SITTING BEGAN, in words — the transcript's one centred header line.
 *
 * Both references head a conversation this way (Notion: "Notion AI · 12:11 PM"), and the reason it
 * earns its place here is history: reopening a chat from the rail drops you into the middle of
 * something you said on Tuesday, and without a stamp the only clue is the content.
 *
 * **Which is exactly why the clock alone is not enough.** A reopened conversation headed `14:30`
 * says today at half past two, about a chat from last week — the stamp built for the one case it
 * gets wrong. So the day is named whenever it is not today, in the app's own relative-day
 * vocabulary ("Yesterday", "Tue 23 Sep"), and omitted when it is: `Today at 14:30` on a
 * conversation you are having now is a sentence telling you where you are standing.
 *
 * Returns null when there is nothing to stamp — an empty conversation has no beginning yet — so the
 * caller renders no line rather than an empty one.
 */
export function conversationWhen(startedAt: string | null, { today, tz }: { today: string; tz?: string }): string | null {
  if (!startedAt) return null;
  const clock = formatClock(startedAt, tz);
  if (!clock) return null;

  const day = isoDateIn(startedAt, tz);
  if (!day || day === today) return clock;

  return `${formatRelativeDay(day, { now: today, weekday: true }) ?? day} at ${clock}`;
}
