import { describe, it, expect } from 'vitest';
import {
  enqueue, nextOp, applyPending, readQueue, backoffMs, outcomeFor, MAX_TRIES,
  type QueuedOp,
} from './mutation-queue';

const op = (over: Partial<QueuedOp> & { id: string }): QueuedOp => ({
  kind: 'task.toggle', recordId: 'T1', args: ['T1', true], patch: { done: true },
  at: 1000, tries: 0, ...over,
});

const KINDS = new Set(['task.toggle', 'task.setList']);

describe('enqueue', () => {
  it('appends an op for a new record', () => {
    const q = enqueue([], op({ id: 'a' }));
    expect(q.map((x) => x.id)).toEqual(['a']);
  });

  it('COLLAPSES a repeat of the same kind on the same record', () => {
    // Ticking a task and un-ticking it inside the 3s settle beat is normal.
    // Without collapsing that is two writes racing to land in the right order.
    const q = enqueue(
      enqueue([], op({ id: 'a', patch: { done: true }, args: ['T1', true] })),
      op({ id: 'b', patch: { done: false }, args: ['T1', false] }),
    );
    expect(q).toHaveLength(1);
    expect(q[0].patch).toEqual({ done: false });
    expect(q[0].args).toEqual(['T1', false]);
  });

  it('keeps the collapsed op in its original place in line', () => {
    const q = [op({ id: 'a', recordId: 'T1' }), op({ id: 'b', recordId: 'T2' })];
    const next = enqueue(q, op({ id: 'c', recordId: 'T1', patch: { done: false } }));
    expect(next.map((x) => x.recordId)).toEqual(['T1', 'T2']);
    expect(next[0].id).toBe('a');            // identity and position survive
    expect(next[0].patch).toEqual({ done: false });  // intent is the new one
  });

  it('does NOT collapse different kinds on the same record', () => {
    // "Set done" and "move to list" are independent facts about one task.
    const q = enqueue([op({ id: 'a' })], op({ id: 'b', kind: 'task.setList', patch: { list_id: 'L1' } }));
    expect(q).toHaveLength(2);
  });

  it('never collapses into an op that is already in flight', () => {
    // Mutating an op a worker is halfway through sending would deliver one
    // intent and record another.
    const q = enqueue([op({ id: 'a', sending: true })], op({ id: 'b', patch: { done: false } }));
    expect(q.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('nextOp', () => {
  it('takes the head', () => {
    expect(nextOp([op({ id: 'a' }), op({ id: 'b' })])?.id).toBe('a');
  });

  it('skips what is already in flight', () => {
    expect(nextOp([op({ id: 'a', sending: true }), op({ id: 'b', recordId: 'T2' })])?.id).toBe('b');
  });

  it('is null when everything is in flight, or empty', () => {
    expect(nextOp([op({ id: 'a', sending: true })])).toBeNull();
    expect(nextOp([])).toBeNull();
  });
});

describe('applyPending', () => {
  const rows = [{ id: 'T1', done: false, title: 'a' }, { id: 'T2', done: false, title: 'b' }];

  it('re-lays an undelivered patch over server data', () => {
    // THE BUG THIS PREVENTS: `useServerState` snaps to whatever the server last
    // said. A tick still sitting in the queue would vanish off the screen the
    // moment anything refreshed.
    const out = applyPending(rows, [op({ id: 'a', recordId: 'T1' })]);
    expect(out[0].done).toBe(true);
    expect(out[1].done).toBe(false);
  });

  it('lets a later op win over an earlier one', () => {
    const out = applyPending(rows, [
      op({ id: 'a', recordId: 'T1', patch: { done: true } }),
      op({ id: 'b', recordId: 'T1', kind: 'task.setList', patch: { done: false, title: 'z' } }),
    ]);
    expect(out[0]).toMatchObject({ done: false, title: 'z' });
  });

  it('ignores an op for a row that is not there', () => {
    // Deleted on another device. A pending edit must not resurrect it.
    const out = applyPending(rows, [op({ id: 'a', recordId: 'GONE' })]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.id)).toEqual(['T1', 'T2']);
  });

  it('returns the SAME array when it changes nothing', () => {
    // Identity matters: this feeds `useServerState`, which compares by
    // reference. A fresh array every render is the loop this codebase already
    // paid for once.
    expect(applyPending(rows, [])).toBe(rows);
    expect(applyPending(rows, [op({ id: 'a', recordId: 'GONE' })])).toBe(rows);
  });
});

describe('readQueue', () => {
  it('reads ops back', () => {
    const raw = JSON.stringify([op({ id: 'a' })]);
    expect(readQueue(raw, KINDS)).toHaveLength(1);
  });

  it('clears `sending` on reload', () => {
    // Whatever was in flight when the tab closed did NOT finish. Left marked
    // busy it would sit in the queue forever, blocking everything behind it.
    const raw = JSON.stringify([op({ id: 'a', sending: true })]);
    expect(readQueue(raw, KINDS)[0].sending).toBe(false);
  });

  it('DROPS an op whose kind no longer exists', () => {
    // Renamed or removed in a deploy. It can never be delivered, and a queue
    // that cannot drain blocks every op behind it.
    const raw = JSON.stringify([op({ id: 'a', kind: 'task.gone' }), op({ id: 'b' })]);
    expect(readQueue(raw, KINDS).map((x) => x.id)).toEqual(['b']);
  });

  it('survives anything that is not a queue', () => {
    for (const bad of [null, '', 'not json', '{}', '42', '[1,2,3]', '[{"id":1}]']) {
      expect(readQueue(bad, KINDS)).toEqual([]);
    }
  });

  it('rejects an op with a non-object patch or non-array args', () => {
    const bad = JSON.stringify([
      { id: 'a', kind: 'task.toggle', recordId: 'T1', args: 'nope', patch: {} },
      { id: 'b', kind: 'task.toggle', recordId: 'T1', args: [], patch: [] },
      { id: 'c', kind: 'task.toggle', recordId: 'T1', args: [], patch: null },
    ]);
    expect(readQueue(bad, KINDS)).toEqual([]);
  });
});

describe('backoffMs', () => {
  it('climbs and then caps', () => {
    expect(backoffMs(1)).toBe(400);
    expect(backoffMs(2)).toBe(800);
    expect(backoffMs(3)).toBe(1600);
    expect(backoffMs(10)).toBe(5000);
  });

  it('caps low, because a person is waiting on these', () => {
    // A minute-long backoff would leave a task you ticked undelivered long
    // after the network came back.
    expect(backoffMs(99)).toBeLessThanOrEqual(5000);
  });
});

describe('outcomeFor', () => {
  it('is done when the action succeeded', () => {
    expect(outcomeFor({ ok: true }, 1)).toEqual({ kind: 'done' });
  });

  it('GIVES UP when the action returned an error', () => {
    // It decided: the row is gone, RLS refused, the value was invalid.
    // Retrying gets the same answer forever.
    expect(outcomeFor({ error: 'Row not found' }, 1)).toEqual({ kind: 'give-up', reason: 'Row not found' });
  });

  it('RETRIES when the action threw', () => {
    // It never got to decide — network, or the runtime went away. This is
    // exactly what a queue is for.
    expect(outcomeFor({ thrown: true }, 1)).toEqual({ kind: 'retry', inMs: 400 });
  });

  it('stops retrying eventually', () => {
    expect(outcomeFor({ thrown: true }, MAX_TRIES)).toMatchObject({ kind: 'give-up' });
  });
});
