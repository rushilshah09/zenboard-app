import { describe, it, expect } from 'vitest';
import {
  blockersOf, blockingFrom, isBlocked, blockedSet, wouldCycle, checkLink, MAX_BLOCKERS,
  type TaskLink,
} from './task-links';

const link = (task: string, blockedBy: string): TaskLink => ({ task_id: task, blocked_by_task_id: blockedBy });
/** A done-predicate from a list of finished ids. */
const finished = (...ids: string[]) => (id: string) => ids.includes(id);

describe('blockersOf / blockingFrom', () => {
  const links = [link('a', 'b'), link('a', 'c'), link('d', 'b')];
  it('reads the same edge from both ends', () => {
    expect(blockersOf(links, 'a')).toEqual(['b', 'c']);
    expect(blockingFrom(links, 'b')).toEqual(['a', 'd']);
  });
  it('returns nothing for a task with no edges', () => {
    expect(blockersOf(links, 'z')).toEqual([]);
    expect(blockingFrom(links, 'z')).toEqual([]);
  });
});

describe('isBlocked', () => {
  it('is blocked while ANY blocker is unfinished', () => {
    const links = [link('a', 'b'), link('a', 'c')];
    expect(isBlocked(links, 'a', finished())).toBe(true);
    expect(isBlocked(links, 'a', finished('b'))).toBe(true);       // c still open
    expect(isBlocked(links, 'a', finished('b', 'c'))).toBe(false); // the last one lands
  });

  it('is not blocked with no blockers at all', () => {
    expect(isBlocked([], 'a', finished())).toBe(false);
  });

  it('gets transitivity for free without walking the graph', () => {
    // a waits for b, b waits for c, and only c is done.
    const links = [link('a', 'b'), link('b', 'c')];
    expect(isBlocked(links, 'b', finished('c'))).toBe(false); // b's own blocker landed
    expect(isBlocked(links, 'a', finished('c'))).toBe(true);  // …but b itself is not done
    expect(isBlocked(links, 'a', finished('c', 'b'))).toBe(false);
  });
});

describe('blockedSet', () => {
  it('agrees with isBlocked, in one pass', () => {
    const links = [link('a', 'b'), link('c', 'd'), link('e', 'f')];
    const done = finished('d');
    const set = blockedSet(links, done);
    expect([...set].sort()).toEqual(['a', 'e']);
    for (const id of ['a', 'c', 'e']) expect(set.has(id)).toBe(isBlocked(links, id, done));
  });
  it('is empty when everything is finished', () => {
    expect(blockedSet([link('a', 'b')], finished('b')).size).toBe(0);
  });
});

describe('wouldCycle', () => {
  it('refuses a self-link', () => {
    expect(wouldCycle([], 'a', 'a')).toBe(true);
  });
  it('refuses the two-task loop', () => {
    expect(wouldCycle([link('b', 'a')], 'a', 'b')).toBe(true);
  });
  it('refuses a longer loop', () => {
    // b waits for c, c waits for d. Making a wait for b, then d wait for a, loops.
    const links = [link('b', 'c'), link('c', 'd'), link('a', 'b')];
    expect(wouldCycle(links, 'd', 'a')).toBe(true);
  });
  it('allows a diamond — two paths to the same prerequisite are not a loop', () => {
    const links = [link('a', 'b'), link('a', 'c'), link('b', 'd'), link('c', 'd')];
    expect(wouldCycle(links, 'a', 'd')).toBe(false);
  });
  it('terminates on data that already contains a loop', () => {
    const links = [link('x', 'y'), link('y', 'x')];
    expect(wouldCycle(links, 'a', 'x')).toBe(false);   // must return, not hang
  });
});

describe('checkLink', () => {
  it('accepts an ordinary new dependency', () => {
    expect(checkLink([], 'a', 'b')).toBeNull();
  });
  it('names each refusal', () => {
    expect(checkLink([], 'a', 'a')).toBe('self');
    expect(checkLink([link('a', 'b')], 'a', 'b')).toBe('duplicate');
    expect(checkLink([link('b', 'a')], 'a', 'b')).toBe('cycle');
  });
  it('caps how many things one task may wait for', () => {
    const links = Array.from({ length: MAX_BLOCKERS }, (_, i) => link('a', `b${i}`));
    expect(checkLink(links, 'a', 'new')).toBe('too-many');
    // The cap is per task, not global — another task is unaffected.
    expect(checkLink(links, 'z', 'new')).toBeNull();
  });
  it('reports duplicate before the cap, so re-adding an existing one is never "too many"', () => {
    const links = Array.from({ length: MAX_BLOCKERS }, (_, i) => link('a', `b${i}`));
    expect(checkLink(links, 'a', 'b0')).toBe('duplicate');
  });
});
