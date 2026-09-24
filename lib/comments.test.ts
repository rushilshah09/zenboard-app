import { describe, it, expect } from 'vitest';
import {
  normalizeBody, toThreads, openThreadsByAnchor, archivedThreads, fromLegacy,
  initialOf, COMMENT_MAX, PAGE_ANCHOR, type Comment,
} from '@/lib/comments';

const c = (over: Partial<Comment> & { id: string }): Comment => ({
  threadId: over.id, blockId: null, body: 'x', authorName: 'Ada',
  createdAt: '2026-08-06T10:00:00Z', resolvedAt: null, ...over,
});

describe('normalizeBody', () => {
  it('refuses whitespace, so the composer and the action cannot disagree', () => {
    expect(normalizeBody('')).toBeNull();
    expect(normalizeBody('   \n\t ')).toBeNull();
  });

  it('trims', () => {
    expect(normalizeBody('  looks good  ')).toBe('looks good');
  });

  it('bounds rather than rejects a very long comment', () => {
    // Truncating keeps what someone wrote; rejecting loses all of it.
    const out = normalizeBody('a'.repeat(COMMENT_MAX + 500));
    expect(out).toHaveLength(COMMENT_MAX);
  });
});

describe('toThreads', () => {
  it('groups by thread id, not by anchor', () => {
    // Two questions about the same paragraph are two conversations.
    const threads = toThreads([
      c({ id: '1', threadId: 't1', blockId: 'b1' }),
      c({ id: '2', threadId: 't2', blockId: 'b1' }),
    ], new Set(['b1']));
    expect(threads).toHaveLength(2);
    expect(threads.map((t) => t.blockId)).toEqual(['b1', 'b1']);
  });

  it('orders comments inside a thread oldest first', () => {
    const [t] = toThreads([
      c({ id: '2', threadId: 't', createdAt: '2026-08-06T12:00:00Z', body: 'second' }),
      c({ id: '1', threadId: 't', createdAt: '2026-08-06T10:00:00Z', body: 'first' }),
    ]);
    expect(t.comments.map((x) => x.body)).toEqual(['first', 'second']);
    expect(t.lastAt).toBe('2026-08-06T12:00:00Z');
  });

  it('reads resolved off the OPENING comment', () => {
    // `setThreadResolved` stamps every row it finds. A reply that landed between
    // the read and the write is unstamped, and must not reopen the thread just
    // by existing.
    const [t] = toThreads([
      c({ id: '1', threadId: 't', createdAt: '2026-08-06T10:00:00Z', resolvedAt: '2026-08-06T11:00:00Z' }),
      c({ id: '2', threadId: 't', createdAt: '2026-08-06T12:00:00Z', resolvedAt: null }),
    ]);
    expect(t.resolved).toBe(true);
  });

  it('marks a thread whose block is gone as an orphan, and keeps it', () => {
    const [t] = toThreads([c({ id: '1', blockId: 'deleted' })], new Set(['b1']));
    expect(t.orphan).toBe(true);
    expect(t.comments).toHaveLength(1);
  });

  it('calls nothing an orphan when the document is not loaded', () => {
    // Passing no id set means "we do not know yet", which must not be read as
    // "no block exists" — that would orphan every thread on first paint.
    const [t] = toThreads([c({ id: '1', blockId: 'b1' })]);
    expect(t.orphan).toBe(false);
  });

  it('never calls a page-level thread an orphan', () => {
    const [t] = toThreads([c({ id: '1', blockId: null })], new Set<string>());
    expect(t.orphan).toBe(false);
  });
});

describe('openThreadsByAnchor', () => {
  const threads = toThreads([
    c({ id: '1', threadId: 'page', blockId: null }),
    c({ id: '2', threadId: 'open', blockId: 'b1' }),
    c({ id: '3', threadId: 'done', blockId: 'b1', resolvedAt: '2026-08-06T11:00:00Z' }),
    c({ id: '4', threadId: 'gone', blockId: 'deleted' }),
  ], new Set(['b1']));

  it('keys the document itself under null', () => {
    expect(openThreadsByAnchor(threads).get(null)?.map((t) => t.id)).toContain('page');
  });

  it('leaves resolved threads out of the document body', () => {
    const map = openThreadsByAnchor(threads);
    expect(map.get('b1')?.map((t) => t.id)).toEqual(['open']);
    expect(map.has('deleted')).toBe(false);
  });

  it('falls an orphan back to the page rather than filing it as resolved', () => {
    // Its block is gone, but nobody answered it. Putting it under "N resolved"
    // buries an open question AND makes that count untrue — which is exactly
    // what the browser showed ("Show 3 resolved", one of them an orphan).
    expect(openThreadsByAnchor(threads).get(null)?.map((t) => t.id)).toEqual(['page', 'gone']);
  });

  it('gives a block with nothing to say no entry at all', () => {
    expect(openThreadsByAnchor(threads).get('b-quiet')).toBeUndefined();
  });

  it('archives resolved threads and nothing else, so the count names itself', () => {
    expect(archivedThreads(threads).map((t) => t.id)).toEqual(['done']);
  });
});

describe('legacy comments (pre-0037, inside pages.content)', () => {
  it('lifts each into its own thread', () => {
    // They were a flat list with no replies; inventing a conversation out of
    // adjacency would put words in someone's mouth.
    const out = fromLegacy(
      [{ id: 'c1', text: 'one', at: '2026-08-01T09:00:00Z' }, { id: 'c2', text: 'two', at: '2026-08-02T09:00:00Z' }],
      'Ada',
    );
    expect(out.map((x) => x.threadId)).toEqual(['c1', 'c2']);
    expect(out.every((x) => x.legacy && x.blockId === null && !x.resolvedAt)).toBe(true);
  });

  it('drops blanks and survives an absent array', () => {
    expect(fromLegacy(undefined, null)).toEqual([]);
    expect(fromLegacy([{ id: 'c1', text: '   ', at: '2026-08-01T09:00:00Z' }], null)).toEqual([]);
  });

  it('reads back through toThreads as unresolvable page threads', () => {
    const threads = toThreads(fromLegacy([{ id: 'c1', text: 'old', at: '2026-08-01T09:00:00Z' }], 'Ada'), new Set());
    expect(threads).toHaveLength(1);
    expect(threads[0].blockId).toBeNull();
    expect(threads[0].orphan).toBe(false);
  });
});

describe('initialOf', () => {
  it('is one rule, so every comment surface draws the same avatar', () => {
    expect(initialOf('Ada Lovelace')).toBe('A');
    expect(initialOf('  ada ')).toBe('A');
    expect(initialOf('')).toBe('?');
    expect(initialOf(null)).toBe('?');
  });
});

describe('PAGE_ANCHOR', () => {
  it('cannot collide with a block id', () => {
    // Block ids come from `genId()`: 'b' + base36. The sentinel is deliberately
    // not in that shape, which is what lets `composingFor` be one string field.
    expect(PAGE_ANCHOR).not.toMatch(/^b[a-z0-9]+$/);
  });
});
