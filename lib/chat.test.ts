import { describe, it, expect } from 'vitest';
import {
  CHAT_BODY_MAX, DELETED_BODY, REACTIONS, REACTION_NAMES, RUN_WINDOW_MS, canEdit, dayLabel, groupReactions, isReaction,
  lastEditable, layoutMessages, normalizeBody, reacted, reactionLabel, toMessage, toggleReaction, unreadCount, withReaction,
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

describe('editing your own messages', () => {
  const mine = msg({ at: '2026-09-24T09:00:00Z', author: 'team', authorName: 'Rushil' });
  it('lets you edit what you wrote, and nothing else', () => {
    expect(canEdit(mine, 'team')).toBe(true);
    expect(canEdit(mine, 'client'), 'the other side’s message').toBe(false);
  });
  it('refuses a message that is deleted, unsent or failed', () => {
    expect(canEdit({ ...mine, deleted: true }, 'team')).toBe(false);
    expect(canEdit({ ...mine, pending: true }, 'team')).toBe(false);
    expect(canEdit({ ...mine, failed: true }, 'team')).toBe(false);
  });
  it('finds the newest editable message for ↑, skipping what cannot be edited', () => {
    const list = [
      mine,
      msg({ at: '2026-09-24T09:01:00Z' }),                                         // theirs
      msg({ at: '2026-09-24T09:02:00Z', author: 'team', authorName: 'Rushil', deleted: true }),
      msg({ at: '2026-09-24T09:03:00Z', author: 'team', authorName: 'Rushil', pending: true }),
    ];
    expect(lastEditable(list, 'team')?.id).toBe(mine.id);
    expect(lastEditable([msg({ at: '2026-09-24T09:01:00Z' })], 'team')).toBeNull();
  });
  it('overwrites a deleted body with a placeholder the column accepts', () => {
    expect(DELETED_BODY.length).toBeGreaterThanOrEqual(1);
    expect(normalizeBody(DELETED_BODY).ok).toBe(true);
  });
});

describe('reactions', () => {
  it('accepts only the reactions on offer — a link cannot post text as a reaction', () => {
    expect(isReaction('👍')).toBe(true);
    expect(isReaction('lol')).toBe(false);
    expect(isReaction('👍👍')).toBe(false);
    expect(isReaction('<img>')).toBe(false);
    expect(isReaction(42)).toBe(false);
    expect(REACTIONS.length).toBe(8);
  });

  it('names every reaction on offer', () => {
    for (const e of REACTIONS) expect(REACTION_NAMES[e]).toBeTruthy();
  });

  it('groups rows into pills, in the order each emoji was first used', () => {
    const rows = [
      { emoji: '🎉', reactor: 'client', created_at: '2026-09-25T10:02:00Z' },
      { emoji: '👍', reactor: 'team', created_at: '2026-09-25T10:00:00Z' },
      { emoji: '👍', reactor: 'client', created_at: '2026-09-25T10:01:00Z' },
    ];
    expect(groupReactions(rows)).toEqual([
      { emoji: '👍', team: true, client: true },
      { emoji: '🎉', team: false, client: true },
    ]);
  });

  it('skips a reaction that was taken back — the row stays, the pill does not', () => {
    const rows = [
      { emoji: '👍', reactor: 'team', created_at: '2026-09-25T10:00:00Z', removed_at: '2026-09-25T10:05:00Z' },
      { emoji: '👀', reactor: 'client', created_at: '2026-09-25T10:01:00Z', removed_at: null },
    ];
    expect(groupReactions(rows)).toEqual([{ emoji: '👀', team: false, client: true }]);
  });

  it('sets a side on and off idempotently, and drops a pill nobody is on', () => {
    const one = withReaction([], '👀', 'team', true);
    expect(one).toEqual([{ emoji: '👀', team: true, client: false }]);
    // An echo of the same change is a no-op — the realtime stream sends our own writes back.
    expect(withReaction(one, '👀', 'team', true)).toEqual(one);
    expect(withReaction(one, '👀', 'team', false)).toEqual([]);
    expect(withReaction([], '👀', 'team', false)).toEqual([]);
    const both = withReaction(one, '👀', 'client', true);
    expect(both).toEqual([{ emoji: '👀', team: true, client: true }]);
    expect(withReaction(both, '👀', 'team', false)).toEqual([{ emoji: '👀', team: false, client: true }]);
  });

  it('toggles like Slack: the same emoji again takes it back', () => {
    const on = toggleReaction([], '🔥', 'client');
    expect(on).toEqual([{ emoji: '🔥', team: false, client: true }]);
    expect(toggleReaction(on, '🔥', 'client')).toEqual([]);
    // …but pressing a pill the OTHER side is on adds me beside them.
    expect(toggleReaction(on, '🔥', 'team')).toEqual([{ emoji: '🔥', team: true, client: true }]);
  });

  it('knows which pills are mine', () => {
    expect(reacted({ emoji: '🔥', team: true, client: false }, 'team')).toBe(true);
    expect(reacted({ emoji: '🔥', team: true, client: false }, 'client')).toBe(false);
  });

  it('says who reacted, from where I am sitting', () => {
    const names = { team: 'Rushil', client: 'Acme' };
    expect(reactionLabel({ emoji: '👍', team: true, client: true }, 'team', names)).toBe('You and Acme reacted with thumbs up');
    expect(reactionLabel({ emoji: '👍', team: true, client: false }, 'client', names)).toBe('Rushil reacted with thumbs up');
    expect(reactionLabel({ emoji: '🦄', team: false, client: true }, 'client', names)).toBe('You reacted with 🦄');
  });
});

describe('a message carries its reactions', () => {
  const base = {
    id: 'm1', project_id: 'p1', author: 'client', author_name: 'Acme', body: 'Hi',
    created_at: '2026-09-25T10:00:00Z', edited_at: null, deleted_at: null,
  };
  it('reads embedded reactions into pills', () => {
    const m = toMessage({ ...base, project_message_reactions: [{ emoji: '✅', reactor: 'team', created_at: base.created_at, removed_at: null }] }, { team: 'You', client: 'Client' });
    expect(m.reactions).toEqual([{ emoji: '✅', team: true, client: false }]);
  });
  it('leaves reactions absent when the read did not include them (before 0044, or a realtime row)', () => {
    expect(toMessage(base, { team: 'You', client: 'Client' })).not.toHaveProperty('reactions');
  });
});
