import { describe, expect, it } from 'vitest';

import { isoDateIn } from '@/lib/date';

import {
  DATED_DAYS, OLDER, PINNED, conversationWhen, filterConversations, groupConversations, titleFor,
  withLive, type AskConversation,
} from '@/lib/ask-history';

// The grouping is arithmetic, so it is tested as arithmetic: rows in, groups out, with the day and
// the person's today passed in rather than read from a clock. That is the whole reason the module
// refuses to know the timezone — a rule that reads `new Date()` can only be tested at the hour it
// happens to be, which is how `resolveMeetingPhrase` hid a wrong-day bug until midnight moved past
// its fixture (lib/ask.ts, 2026-09-30).

const TODAY = '2026-09-30';
/** A day id → the instant it stands for, at noon, so no rounding can push it into a neighbour. */
const at = (day: string) => `${day}T12:00:00.000Z`;
const dayOf = (iso: string) => (iso.length >= 10 ? iso.slice(0, 10) : null);

const row = (id: string, day: string, pinned = false): AskConversation =>
  ({ id, title: id, lastMessageAt: at(day), pinned });

const group = (rows: AskConversation[]) => groupConversations(rows, { today: TODAY, dayOf });

describe('the history rail groups conversations', () => {
  it('puts pinned above everything, and only once', () => {
    const groups = group([row('a', '2026-09-30'), row('b', '2026-09-29', true)]);
    expect(groups[0].label).toBe(PINNED);
    expect(groups[0].items.map((c) => c.id)).toEqual(['b']);
    // A pinned conversation in BOTH places makes the rail's row count disagree with its
    // conversation count, and deleting "the second one" surprises the person who kept the first.
    expect(groups.flatMap((g) => g.items.filter((c) => c.id === 'b'))).toHaveLength(1);
  });

  it('orders by recency, newest group first', () => {
    const groups = group([row('older', '2026-09-28'), row('newest', '2026-09-30'), row('mid', '2026-09-29')]);
    expect(groups.flatMap((g) => g.items.map((c) => c.id))).toEqual(['newest', 'mid', 'older']);
  });

  it('names today with the app’s own day vocabulary, not a raw date', () => {
    const [today] = group([row('a', TODAY)]);
    expect(today.label).toBe('Today');
  });

  it(`collects anything past ${DATED_DAYS} days under one heading`, () => {
    const groups = group([row('recent', '2026-09-29'), row('ancient', '2026-01-01')]);
    expect(groups.at(-1)?.label).toBe(OLDER);
    expect(groups.at(-1)?.items.map((c) => c.id)).toEqual(['ancient']);
  });

  it('keeps a row whose instant will not parse, rather than hiding it', () => {
    // Silently dropping a record because one column is malformed is how a person comes to believe
    // their data is gone — and an unreachable row cannot even be deleted.
    const broken: AskConversation = { id: 'broken', title: 'broken', lastMessageAt: 'not-a-date', pinned: false };
    const groups = groupConversations([broken], { today: TODAY, dayOf: () => null });
    expect(groups.flatMap((g) => g.items.map((c) => c.id))).toEqual(['broken']);
  });

  it('returns nothing for nothing (control)', () => {
    expect(group([])).toEqual([]);
  });
});

describe('the rail’s search', () => {
  const rows = [row('Buildojo logo', '2026-09-30'), row('Invoice chase', '2026-09-29')];

  it('matches a title, ignoring case, and returns everything for an empty query', () => {
    expect(filterConversations(rows, 'BUILD').map((c) => c.id)).toEqual(['Buildojo logo']);
    expect(filterConversations(rows, '   ').map((c) => c.id)).toEqual(['Buildojo logo', 'Invoice chase']);
    expect(filterConversations(rows, 'nothing here')).toEqual([]);
  });
});

describe('a conversation is named by the person, never by a model', () => {
  it('takes their first sentence, collapsed and trimmed', () => {
    expect(titleFor('  Add a task   to finish the logo  ')).toBe('Add a task to finish the logo');
  });

  it('truncates rather than letting a paragraph become a rail row', () => {
    const long = titleFor('x'.repeat(300));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('…')).toBe(true);
  });

  it('falls back to a name rather than an empty row', () => {
    expect(titleFor('   ')).toBe('New chat');
  });
});

// ── THE LIVE ROW ────────────────────────────────────────────────────────────
// `withLive` is what replaced an imperative `bump` nothing ever called, so these cases are the
// behaviour that was missing from the product rather than a restatement of the code: a conversation
// you have just started appears, one you are continuing moves, and neither is ever shown twice.
describe('withLive', () => {
  it('shows the conversation you are in before the server has listed it', () => {
    const rows = [row('older', '2026-09-28')];
    const out = withLive(rows, { id: 'fresh', title: 'move the logo to friday', at: at(TODAY) });

    expect(out.map((c) => c.id)).toEqual(['fresh', 'older']);
    expect(out[0]).toMatchObject({ title: 'move the logo to friday', pinned: false });
  });

  it('bumps a conversation it already has instead of listing it twice', () => {
    const rows = [row('a', '2026-09-30'), row('tuesday', '2026-09-22')];
    const out = withLive(rows, { id: 'tuesday', title: 'ignored', at: at(TODAY) });

    expect(out).toHaveLength(2);
    expect(out.filter((c) => c.id === 'tuesday')).toHaveLength(1);
    // Grouped by its NEW day: a chat you just spoke in belongs under Today.
    const groups = groupConversations(out, { today: TODAY, dayOf });
    expect(groups.find((g) => g.items.some((c) => c.id === 'tuesday'))?.label).toBe('Today');
  });

  // Through the MERGE path, not the early return — the live instant is newer, so the row really is
  // rewritten and the title really is the one being kept.
  it('keeps the title the server holds — a rename is not undone by the store', () => {
    const rows: AskConversation[] = [{ id: 'a', title: 'Renamed by hand', lastMessageAt: at('2026-09-29'), pinned: false }];
    const out = withLive(rows, { id: 'a', title: 'the first thing i said', at: at(TODAY) });
    expect(out[0]).toMatchObject({ title: 'Renamed by hand', lastMessageAt: at(TODAY) });
  });

  it('never drags a row backwards on a stale store value', () => {
    const rows = [row('a', '2026-09-30')];
    const out = withLive(rows, { id: 'a', title: 'a', at: at('2026-09-01') });
    expect(out[0].lastMessageAt).toBe(at('2026-09-30'));
  });

  // Pinned is the SERVER's fact. A live fold must not quietly unpin a conversation you pinned, and
  // the merge writes only `lastMessageAt` for exactly that reason.
  it('leaves a pinned conversation pinned', () => {
    const rows = [row('a', '2026-09-29', true)];
    const out = withLive(rows, { id: 'a', title: 'a', at: at(TODAY) });
    expect(out[0].pinned).toBe(true);
  });

  // IDENTITY, not equality — `toBe`. The caller applies this through a state setter from an effect,
  // and React only bails out of a re-render when the setter hands back the array it was given. A
  // `[...rows]` that merely `toEqual`s would re-render the rail forever and read as correct.
  it('is the array it was given when there is nothing to fold in', () => {
    const rows = [row('a', '2026-09-30')];
    expect(withLive(rows, null)).toBe(rows);
    expect(withLive(rows, { id: 'a', title: 'a', at: at('2026-09-01') })).toBe(rows);
  });

  // ── ORDERING IS BY TIME, NOT BY SPELLING ──────────────────────────────────────────────────
  // The list mixes two producers the moment `withLive` runs: Postgres writes `…+00:00`, the browser
  // writes `…Z`. A lexicographic compare only works while every string shares one format and one
  // offset, and this one cannot promise either.
  //
  // The case below is the one that DISCRIMINATES the two implementations — and it needs a non-UTC
  // offset to do it. At `+00:00`, which is what this deployment returns, a string compare and a
  // parsed compare agree on everything a person could see; they diverge only within a millisecond.
  // So this asserts the contract rather than reproducing a misordering anybody has watched happen:
  // `17:44:05+05:30` is 12:14:05Z, four minutes EARLIER than 12:20Z, and sorts later as a string.
  it('orders instants by time even when one carries an offset and the other a Z', () => {
    const offset: AskConversation = { id: 'earlier', title: 'e', lastMessageAt: '2026-09-30T17:44:05.123456+05:30', pinned: false };
    const zulu: AskConversation = { id: 'later', title: 'l', lastMessageAt: '2026-09-30T12:20:00.000Z', pinned: false };

    const groups = groupConversations([offset, zulu], { today: TODAY, dayOf: (iso) => isoDateIn(iso) ?? null });
    expect(groups[0].items.map((c) => c.id)).toEqual(['later', 'earlier']);
  });
});

// ── THE TRANSCRIPT'S HEADER ─────────────────────────────────────────────────
describe('conversationWhen', () => {
  // The zone is fixed so the assertions are about the RULE and not about where the test is run.
  const tz = 'UTC';

  it('is the clock alone for a conversation you are having now', () => {
    expect(conversationWhen(`${TODAY}T14:30:00.000Z`, { today: TODAY, tz })).toBe('14:30');
  });

  it('names the day for one you are reading back — the case a bare clock got wrong', () => {
    expect(conversationWhen('2026-09-29T14:30:00.000Z', { today: TODAY, tz })).toBe('Yesterday at 14:30');
    expect(conversationWhen('2026-09-22T09:05:00.000Z', { today: TODAY, tz })).toBe('Tue 22 Sep at 09:05');
  });

  it('is nothing at all when the conversation has no beginning yet', () => {
    expect(conversationWhen(null, { today: TODAY, tz })).toBeNull();
    expect(conversationWhen('not an instant', { today: TODAY, tz })).toBeNull();
  });
});
