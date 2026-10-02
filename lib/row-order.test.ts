import { describe, it, expect } from 'vitest';
import { orderBetween, orderAfter, orderBefore, orderAppend, orderFor, FIRST_ORDER } from './row-order';

describe('orderAfter / orderBefore', () => {
  it('produces a greater / lesser key', () => {
    expect(orderAfter('a0') > 'a0').toBe(true);
    expect(orderBefore('a5') < 'a5').toBe(true);
  });

  it('appending does not grow the key every time', () => {
    let k = 'a0';
    for (let i = 0; i < 20; i++) k = orderAfter(k);
    expect(k.length).toBe(2);
  });

  it('carries past a trailing z by extending', () => {
    expect(orderAfter('zz') > 'zz').toBe(true);
    expect(orderAfter('az') > 'az').toBe(true);
  });

  it('reaches below a key whose digits are all zeros by truncating', () => {
    expect(orderBefore('000') < '000').toBe(true);
    expect(orderBefore('000')).toBe('00');
  });
});

describe('orderBetween', () => {
  it('lands strictly between two adjacent keys', () => {
    const m = orderBetween('a0', 'a1');
    expect(m > 'a0').toBe(true);
    expect(m < 'a1').toBe(true);
  });

  it('survives 200 successive bisections of the same gap', () => {
    // The whole reason this is text and not a double: a float gives up after
    // ~50 midpoints, silently producing equal keys.
    let lo = 'a0';
    const hi = 'a1';
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const m = orderBetween(lo, hi);
      expect(m > lo).toBe(true);
      expect(m < hi).toBe(true);
      expect(seen.has(m)).toBe(false);
      seen.add(m);
      lo = m;
    }
  });

  it('bisects from the other side too', () => {
    let hi = 'a1';
    const lo = 'a0';
    for (let i = 0; i < 100; i++) {
      const m = orderBetween(lo, hi);
      expect(m > lo && m < hi).toBe(true);
      hi = m;
    }
  });

  it('handles a key that is a prefix of the other', () => {
    const m = orderBetween('a', 'ab');
    expect(m > 'a' && m < 'ab').toBe(true);
    const n = orderBetween('a', 'a1');
    expect(n > 'a' && n < 'a1').toBe(true);
  });

  it('open ends: null means append or prepend', () => {
    expect(orderBetween('a0', null) > 'a0').toBe(true);
    expect(orderBetween(null, 'a0') < 'a0').toBe(true);
    expect(orderBetween(null, null)).toBe(FIRST_ORDER);
  });

  it('does not care which way round the pair arrives', () => {
    expect(orderBetween('a1', 'a0')).toBe(orderBetween('a0', 'a1'));
  });

  it('two equal keys still yield something sortable rather than throwing', () => {
    expect(orderBetween('a0', 'a0') > 'a0').toBe(true);
  });

  it('interleaves with the zero-padded hex 0028 seeded', () => {
    // `lpad(to_hex(n * 1000), 12, '0')` for n = 1, 2.
    const first = '0000000003e8';
    const second = '0000000007d0';
    expect(first < second).toBe(true);
    const m = orderBetween(first, second);
    expect(m > first && m < second).toBe(true);
  });
});

describe('orderAppend', () => {
  it('lands after the highest key, whatever order the list is in', () => {
    const rows = [{ order: 'a5' }, { order: 'a1' }, { order: 'a9' }];
    expect(orderAppend(rows) > 'a9').toBe(true);
  });

  it('an empty database starts at the middle of the alphabet', () => {
    expect(orderAppend([])).toBe(FIRST_ORDER);
  });

  it('ignores rows that have no key yet', () => {
    expect(orderAppend([{ order: '' }, { order: 'a1' }]) > 'a1').toBe(true);
  });

  it('keeps a long append run correctly ordered', () => {
    const rows: { order: string }[] = [];
    for (let i = 0; i < 50; i++) rows.push({ order: orderAppend(rows) });
    const keys = rows.map((r) => r.order);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe('orderFor — the fewest keys that put a list in order', () => {
  const seq = (...pairs: [string, string][]) => pairs.map(([id, order]) => ({ id, order }));
  /** The ids, read back in key order after `keys` are written. */
  const readBack = (rows: { id: string; order: string }[], keys: Map<string, string>) =>
    rows.map((r) => ({ id: r.id, order: keys.get(r.id) ?? r.order }))
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
      .map((r) => r.id);

  it('writes nothing for a list already in order', () => {
    expect(orderFor(seq(['a', 'c'], ['b', 'g'], ['d', 'p'])).size).toBe(0);
  });

  it('moves one row with one key when the rest still agree', () => {
    // d is shown first but keyed last: only d needs a new key.
    const rows = seq(['d', 'p'], ['a', 'c'], ['b', 'g']);
    const keys = orderFor(rows);
    expect([...keys.keys()]).toEqual(['d']);
    expect(readBack(rows, keys)).toEqual(['d', 'a', 'b']);
  });

  it('gives rows that share a key keys of their own, in the order shown', () => {
    const rows = seq(['a', 'k'], ['b', 'k'], ['c', 'k'], ['d', 'k']);
    const keys = orderFor(rows);
    expect(keys.size).toBe(3);
    expect(readBack(rows, keys)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keys rows written before ordering existed', () => {
    const rows = seq(['a', ''], ['b', 'm'], ['c', '']);
    const keys = orderFor(rows);
    expect([...keys.keys()].sort()).toEqual(['a', 'c']);
    expect(readBack(rows, keys)).toEqual(['a', 'b', 'c']);
  });

  it('freezes a sorted view: a reversed list keeps one key and rewrites the rest', () => {
    const rows = seq(['e', 'e'], ['d', 'd'], ['c', 'c'], ['b', 'b'], ['a', 'a']);
    const keys = orderFor(rows);
    expect(keys.size).toBe(4);
    expect(readBack(rows, keys)).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('squeezes many rows into one narrow gap without long keys', () => {
    const rows = [{ id: 'lo', order: 'i' }, ...Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, order: '' })), { id: 'hi', order: 'j' }];
    const keys = orderFor(rows);
    expect(readBack(rows, keys)).toEqual(rows.map((r) => r.id));
    expect(Math.max(...[...keys.values()].map((k) => k.length))).toBeLessThanOrEqual(4);
  });

  it('a large shuffled list reads back exactly as shown', () => {
    // A deterministic shuffle of 200 keyed rows.
    const base = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, order: orderAppendKey(i) }));
    const shown = [...base].sort((a, b) => ((Number(a.id.slice(1)) * 7919) % 200) - ((Number(b.id.slice(1)) * 7919) % 200));
    const keys = orderFor(shown);
    expect(readBack(shown, keys)).toEqual(shown.map((r) => r.id));
  });
});

/** The i-th key of an append run — rows as a database that only ever appended has them. */
function orderAppendKey(i: number): string {
  const rows: { order: string }[] = [];
  for (let k = 0; k <= i; k++) rows.push({ order: orderAppend(rows) });
  return rows[i].order;
}
