import { describe, it, expect } from 'vitest';
import {
  CHAT_BODY_MAX, RUN_WINDOW_MS, dayLabel, layoutMessages, normalizeBody, toMessage, unreadCount,
  type ChatMessage,
} from './chat';

// The Slack benchmark in CHAT_PLAN.md, as assertions. Times are UTC and the zone is pinned, so a
// day boundary is where the test says it is on any machine.
const TZ = 'UTC';
const TODAY = '2026-09-24';

let n = 0;
const msg = (over: Partial<ChatMessage> & { at: string }): ChatMessage => ({
  id: `m${++n}`, projectId: 'p1', author: 'client', authorName: 'Priya', body: 'hi',
  createdAt: over.at, editedAt: null, deleted: false, ...over,
});
const kinds = (items: ReturnType<typeof layoutMessages>) =>
  items.map((i) => (i.kind === 'message' ? (i.startsRun ? 'RUN' : 'cont') : i.kind));

describe('what the composer may send', () => {
  it('trims the ends and keeps the author’s own line breaks', () => {
    expect(normalizeBody('  hello\n\nthere  ')).toEqual({ ok: true, body: 'hello\n\nthere' });
  });
  it('refuses nothing, and says so before a round trip', () => {
    expect(normalizeBody('   \n ').ok).toBe(false);
  });
  it('holds the same bound the database does', () => {
    expect(normalizeBody('x'.repeat(CHAT_BODY_MAX)).ok).toBe(true);
    const over = normalizeBody('x'.repeat(CHAT_BODY_MAX + 1));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/limit is 8,000/);
  });
});

describe('reading a row', () => {
  const names = { team: 'Rushil', client: 'Meridian Studio' };
  const row = { id: 'a', project_id: 'p1', author: 'team', author_name: null, body: 'Draft attached',
    created_at: '2026-09-24T10:00:00Z', edited_at: null, deleted_at: null };

  it('falls back to the side’s name when the row carries none', () => {
    expect(toMessage(row, names).authorName).toBe('Rushil');
    expect(toMessage({ ...row, author: 'client' }, names).authorName).toBe('Meridian Studio');
  });
  it('treats an unknown author as the client — the side with the least authority', () => {
    expect(toMessage({ ...row, author: 'admin' }, names).author).toBe('client');
  });
  it('keeps a deleted message’s place but never its words', () => {
    const m = toMessage({ ...row, deleted_at: '2026-09-24T11:00:00Z' }, names);
    expect(m.deleted).toBe(true);
    expect(m.body).toBe('');
  });
});

describe('day dividers', () => {
  it('names today and yesterday, and spells out anything older', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('Today');
    expect(dayLabel('2026-09-23', TODAY)).toBe('Yesterday');
    expect(dayLabel('2026-09-21', TODAY)).toMatch(/Monday/);
    expect(dayLabel('2026-09-21', TODAY)).toMatch(/September/);
  });
  it('opens every day with one divider', () => {
    const items = layoutMessages([
      msg({ at: '2026-09-23T09:00:00Z' }),
      msg({ at: '2026-09-24T09:00:00Z' }),
      msg({ at: '2026-09-24T09:01:00Z' }),
    ], { me: 'client', lastReadAt: null, tz: TZ, today: TODAY });
    expect(kinds(items)).toEqual(['day', 'RUN', 'day', 'RUN', 'cont']);
    expect(items.filter((i) => i.kind === 'day').map((i) => (i as { label: string }).label)).toEqual(['Yesterday', 'Today']);
  });
});

describe('author runs', () => {
  // Everything already read, so these tests isolate RUNS. With nothing read, the team's message is
  // genuinely unread to the client and correctly earns a "New" line — which this block once
  // mistook for a bug in the runs.
  const opts = { me: 'client' as const, lastReadAt: '2099-01-01T00:00:00Z', tz: TZ, today: TODAY };

  it('collapses one person’s consecutive messages into a single run', () => {
    const items = layoutMessages([
      msg({ at: '2026-09-24T09:00:00Z' }),
      msg({ at: '2026-09-24T09:01:00Z' }),
      msg({ at: '2026-09-24T09:02:00Z' }),
    ], opts);
    expect(kinds(items)).toEqual(['day', 'RUN', 'cont', 'cont']);
  });

  it('starts a new run when someone else speaks', () => {
    const items = layoutMessages([
      msg({ at: '2026-09-24T09:00:00Z' }),
      msg({ at: '2026-09-24T09:01:00Z', author: 'team', authorName: 'Rushil' }),
      msg({ at: '2026-09-24T09:02:00Z' }),
    ], opts);
    expect(kinds(items)).toEqual(['day', 'RUN', 'RUN', 'RUN']);
  });

  it('starts a new run after a pause longer than the window, and not before', () => {
    const at = (ms: number) => new Date(Date.parse('2026-09-24T09:00:00Z') + ms).toISOString();
    const within = layoutMessages([msg({ at: at(0) }), msg({ at: at(RUN_WINDOW_MS) })], opts);
    const after = layoutMessages([msg({ at: at(0) }), msg({ at: at(RUN_WINDOW_MS + 1) })], opts);
    expect(kinds(within)).toEqual(['day', 'RUN', 'cont']);
    expect(kinds(after)).toEqual(['day', 'RUN', 'RUN']);
  });

  it('never continues a run across midnight', () => {
    const items = layoutMessages([
      msg({ at: '2026-09-23T23:59:00Z' }),
      msg({ at: '2026-09-24T00:00:30Z' }),
    ], opts);
    expect(kinds(items)).toEqual(['day', 'RUN', 'day', 'RUN']);
  });
});

describe('the unread line', () => {
  it('sits above the first message from the OTHER side after where I read to', () => {
    const items = layoutMessages([
      msg({ at: '2026-09-24T09:00:00Z' }),
      msg({ at: '2026-09-24T09:01:00Z' }),
      msg({ at: '2026-09-24T09:02:00Z' }),
    ], { me: 'team', lastReadAt: '2026-09-24T09:00:30Z', tz: TZ, today: TODAY });
    // The line breaks the run, so the reader sees WHO the new messages are from.
    expect(kinds(items)).toEqual(['day', 'RUN', 'new', 'RUN', 'cont']);
  });

  it('never marks my own messages as unread to me', () => {
    const items = layoutMessages([
      msg({ at: '2026-09-24T09:00:00Z', author: 'team', authorName: 'Rushil' }),
    ], { me: 'team', lastReadAt: null, tz: TZ, today: TODAY });
    expect(kinds(items)).not.toContain('new');
  });

  it('counts only the other side’s unread messages, skipping deleted and unsent ones', () => {
    const list = [
      msg({ at: '2026-09-24T09:00:00Z' }),
      msg({ at: '2026-09-24T09:01:00Z', deleted: true }),
      msg({ at: '2026-09-24T09:02:00Z', author: 'team', authorName: 'Rushil' }),
      msg({ at: '2026-09-24T09:03:00Z', pending: true }),
      msg({ at: '2026-09-24T09:04:00Z' }),
    ];
    expect(unreadCount(list, 'team', null)).toBe(2);
    expect(unreadCount(list, 'team', '2026-09-24T09:03:30Z')).toBe(1);
    expect(unreadCount(list, 'client', null)).toBe(1);
  });
});

describe('optimistic sends', () => {
  it('always draw after every confirmed message, however the clocks disagree', () => {
    // A pending message is stamped by THIS device's clock; the server's may be behind it or ahead.
    const items = layoutMessages([
      msg({ at: '2026-09-24T09:05:00Z', author: 'team', authorName: 'Rushil', pending: true, id: 'mine' }),
      msg({ at: '2026-09-24T09:06:00Z', id: 'theirs' }),
    ], { me: 'team', lastReadAt: '2026-09-24T09:10:00Z', tz: TZ, today: TODAY });
    const order = items.filter((i) => i.kind === 'message').map((i) => i.key);
    expect(order).toEqual(['theirs', 'mine']);
  });
});
