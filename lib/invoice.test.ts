import { describe, it, expect } from 'vitest';
import { dueLine, dueState, invoiceTotals, lineAmount } from './invoice';

const TODAY = '2026-06-10';

describe('what an invoice adds up to', () => {
  it('adds in cents, so the subtotal is exactly the lines printed above it', () => {
    const lines = [{ quantity: 3, unit_amount: 0.1 }, { quantity: 1, unit_amount: 0.2 }];
    expect(invoiceTotals(lines).subtotal).toBe(0.5);
    // A fractional hour at an odd rate rounds per line, as the line shows it.
    expect(lineAmount({ quantity: 1.5, unit_amount: 33.33 })).toBe(50);
    expect(invoiceTotals([{ quantity: 1.5, unit_amount: 33.33 }, { quantity: 1.5, unit_amount: 33.33 }]).subtotal).toBe(100);
  });

  it('takes payments off what is due, and never owes a client money back', () => {
    const lines = [{ quantity: 1, unit_amount: 3000 }];
    expect(invoiceTotals(lines, [{ amount: 1000 }])).toEqual({ subtotal: 3000, total: 3000, paid: 1000, due: 2000 });
    expect(invoiceTotals(lines, [{ amount: 3500 }]).due).toBe(0);
  });

  it('reads numbers that arrive as strings from the database', () => {
    expect(invoiceTotals([{ quantity: '2' as unknown as number, unit_amount: '150.5' as unknown as number }]).total).toBe(301);
  });
});

describe('where an invoice stands', () => {
  const t = (due: number, total = 100) => ({ subtotal: total, total, paid: total - due, due });

  it('is overdue after its due date, by whole days', () => {
    expect(dueState({ status: 'sent', due_date: '2026-06-05' }, t(100), TODAY)).toEqual({ kind: 'overdue', date: '2026-06-05', days: 5 });
    expect(dueLine({ kind: 'overdue', date: '2026-06-09', days: 1 }, '2026-06-09')).toBe('Overdue by 1 day');
  });

  it('says today and tomorrow in words', () => {
    expect(dueLine(dueState({ status: 'sent', due_date: TODAY }, t(100), TODAY), TODAY)).toBe('Due today');
    expect(dueLine(dueState({ status: 'sent', due_date: '2026-06-11' }, t(100), TODAY), '2026-06-11')).toBe('Due tomorrow');
    expect(dueLine(dueState({ status: 'sent', due_date: '2026-06-20' }, t(100), TODAY), '2026-06-20')).toBe('Due 20 June 2026');
  });

  it('reads paid once the money is in, even before the status catches up', () => {
    expect(dueState({ status: 'sent', due_date: '2026-06-05' }, t(0), TODAY)).toEqual({ kind: 'paid' });
    expect(dueState({ status: 'paid', due_date: null }, t(100), TODAY)).toEqual({ kind: 'paid' });
  });

  it('never calls a draft or a void invoice due', () => {
    expect(dueState({ status: 'draft', due_date: '2026-06-01' }, t(100), TODAY)).toEqual({ kind: 'draft' });
    expect(dueState({ status: 'void', due_date: '2026-06-01' }, t(100), TODAY)).toEqual({ kind: 'void' });
    // An empty invoice is not "paid" just because nothing is owed.
    expect(dueState({ status: 'sent', due_date: null }, t(0, 0), TODAY)).toEqual({ kind: 'undated' });
  });
});
