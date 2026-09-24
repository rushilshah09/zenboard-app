import { describe, it, expect } from 'vitest';
import { lineTotal, itemsTotal, parseAmount, meaningfulItems, emptyLineItem, type LineItem } from './line-items';
import { blocksToMarkdown } from './blocks';

const li = (over: Partial<LineItem> = {}): LineItem =>
  ({ id: 'a', description: 'Design', quantity: 1, unitAmount: 100, ...over });

describe('lineTotal', () => {
  it('multiplies quantity by rate', () => {
    expect(lineTotal({ quantity: 3, unitAmount: 250 })).toBe(750);
  });

  it('rounds to cents so a column adds up to its own total', () => {
    // 0.1 * 3 is 0.30000000000000004 — printed per-row that is "$0.30", and a
    // total summed from the raw floats would not match the rows above it.
    expect(lineTotal({ quantity: 3, unitAmount: 0.1 })).toBe(0.3);
  });

  it('handles a zero or fractional quantity', () => {
    expect(lineTotal({ quantity: 0, unitAmount: 500 })).toBe(0);
    expect(lineTotal({ quantity: 1.5, unitAmount: 80 })).toBe(120);
  });
});

describe('itemsTotal', () => {
  it('sums the rounded rows, not the raw floats', () => {
    const items = [li({ quantity: 3, unitAmount: 0.1 }), li({ id: 'b', quantity: 3, unitAmount: 0.1 })];
    expect(itemsTotal(items)).toBe(0.6);
  });

  it('reconciles with the printed rows', () => {
    const items = [
      li({ quantity: 2, unitAmount: 1250.5 }),
      li({ id: 'b', quantity: 1, unitAmount: 99.99 }),
      li({ id: 'c', quantity: 4, unitAmount: 33.33 }),
    ];
    const printed = items.reduce((s, i) => s + lineTotal(i), 0);
    expect(itemsTotal(items)).toBe(Math.round(printed * 100) / 100);
    expect(itemsTotal(items)).toBe(2734.31);
  });

  it('is zero for no rows', () => {
    expect(itemsTotal([])).toBe(0);
  });
});

describe('parseAmount', () => {
  it('accepts what people actually type into a price field', () => {
    expect(parseAmount('1,200', 0)).toBe(1200);
    expect(parseAmount('$1,200.50', 0)).toBe(1200.5);
    expect(parseAmount(' 2 ', 0)).toBe(2);
  });

  it('treats an emptied field as zero, not as a typo', () => {
    expect(parseAmount('', 500)).toBe(0);
  });

  it('keeps the previous value rather than turning a typo into a silent zero', () => {
    expect(parseAmount('abc', 500)).toBe(500);
    expect(parseAmount('12..5', 500)).toBe(500);
  });

  it('refuses a negative — a line item is not a discount row', () => {
    expect(parseAmount('-40', 500)).toBe(500);
  });
});

describe('meaningfulItems', () => {
  it('keeps a row that has a name or a price', () => {
    const rows = [li({ description: 'Design', unitAmount: 0, quantity: 0 }), li({ id: 'b', description: '', unitAmount: 500 })];
    expect(meaningfulItems(rows)).toHaveLength(2);
  });

  it('drops the blank row the editor always leaves at the end', () => {
    expect(meaningfulItems([li(), emptyLineItem('z')])).toHaveLength(1);
  });
});

// ── Markdown fidelity ───────────────────────────────────────────────────────
// A proposal's prices have to survive being copied into an email or exported.
describe('blocksToMarkdown for a line-items block', () => {
  it('emits a real table with a total, not a placeholder', () => {
    const md = blocksToMarkdown([{
      id: 'b1', type: 'lineitems', text: '',
      items: [
        { id: '1', description: 'Brand identity', quantity: 1, unitAmount: 4000 },
        { id: '2', description: 'Guidelines', quantity: 2, unitAmount: 750.5 },
      ],
    }]);
    expect(md).toContain('| Description | Qty | Rate | Amount |');
    expect(md).toContain('| Brand identity | 1 | 4000.00 | 4000.00 |');
    expect(md).toContain('| Guidelines | 2 | 750.50 | 1501.00 |');
    expect(md).toContain('**5501.00**');
  });

  it('emits nothing for an empty block rather than a stray header', () => {
    expect(blocksToMarkdown([{ id: 'b1', type: 'lineitems', text: '', items: [] }])).toBe('');
  });

  it('totals the same way the block does', () => {
    const items: LineItem[] = [
      { id: '1', description: 'a', quantity: 3, unitAmount: 0.1 },
      { id: '2', description: 'b', quantity: 3, unitAmount: 0.1 },
    ];
    const md = blocksToMarkdown([{ id: 'b1', type: 'lineitems', text: '', items }]);
    expect(md).toContain(`**${itemsTotal(items).toFixed(2)}**`);
  });
});
