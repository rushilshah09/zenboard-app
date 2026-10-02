import { describe, it, expect } from 'vitest';
import { orderBefore, orderBetween, FIRST_ORDER } from './row-order';

// Rows dropped at the top of a table one after another (`reorderKeys` at index 0 asks for
// `orderBetween(null, first)`). Prepending halved the last digit — 'i' → '9' → '4' → '2' → '1'
// → '0' — and the only key below '0' is '0' itself, so the sixth row put on top TIED with the
// fifth. Found 2026-09-15.
describe('orderBefore — always leaves room below', () => {
  it('never ends a key on the floor digit', () => {
    expect(orderBefore('1')).not.toBe('0');
    expect(orderBefore('1') < '1').toBe(true);
    expect(orderBefore(orderBefore('1')) < orderBefore('1')).toBe(true);
    expect(orderBefore('a1') < 'a1').toBe(true);
    expect(orderBefore('a1').endsWith('0')).toBe(false);
  });

  it('never ties, however many rows go on top', () => {
    let first = FIRST_ORDER;
    for (let i = 0; i < 60; i++) {
      const key = orderBetween(null, first);
      expect(key < first).toBe(true);
      first = key;
    }
    // A character every few rows, not one per row.
    expect(first.length).toBeLessThan(16);
  });
});
