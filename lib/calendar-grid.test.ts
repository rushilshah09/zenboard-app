import { describe, it, expect } from 'vitest';
import { monthGrid, rowsByDay, shiftMonth, monthKeyOf, dayKeyOf } from './calendar-grid';
import type { DbRow } from './collections';

const row = (id: string, due: unknown): DbRow => ({
  id, title: id, data: { due }, order: 'a0',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
});

describe('monthGrid', () => {
  it('always emits whole weeks', () => {
    for (const m of ['2026-01', '2026-02', '2026-08', '2027-05']) {
      expect(monthGrid(m).length % 7).toBe(0);
    }
  });

  it('covers every day of the month exactly once', () => {
    const inMonth = monthGrid('2026-08').filter((c) => c.inMonth);
    expect(inMonth.length).toBe(31);
    expect(inMonth[0].date).toBe('2026-08-01');
    expect(inMonth[30].date).toBe('2026-08-31');
    expect(new Set(inMonth.map((c) => c.date)).size).toBe(31);
  });

  it('pads with the neighbouring months, flagged out-of-month', () => {
    // 1 Aug 2026 is a Saturday, so a Monday-start grid leads with 5 July days.
    const cells = monthGrid('2026-08', 1);
    expect(cells[0].date).toBe('2026-07-27');
    expect(cells[0].inMonth).toBe(false);
    expect(cells.at(-1)!.inMonth).toBe(false);
  });

  it('honours the week start', () => {
    expect(monthGrid('2026-08', 0)[0].date).toBe('2026-07-26'); // Sunday
    expect(monthGrid('2026-08', 1)[0].date).toBe('2026-07-27'); // Monday
  });

  it('handles a leap February', () => {
    const feb = monthGrid('2028-02').filter((c) => c.inMonth);
    expect(feb.length).toBe(29);
  });
});

describe('shiftMonth', () => {
  it('steps months and rolls the year', () => {
    expect(shiftMonth('2026-08', 1)).toBe('2026-09');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-08', 0)).toBe('2026-08');
  });
});

describe('rowsByDay', () => {
  it('buckets bare dates and full ISO stamps on the same day', () => {
    const map = rowsByDay([row('a', '2026-08-01'), row('b', '2026-08-01T14:30:00Z')], 'due');
    expect(map.get('2026-08-01')!.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('drops unparseable and missing values instead of landing them on epoch', () => {
    const map = rowsByDay([row('a', null), row('b', 'someday'), row('c', 42), row('d', '')], 'due');
    expect(map.size).toBe(0);
  });

  it('keys by the CALENDAR day, never shifting across a timezone', () => {
    // A UTC-midnight stamp must stay on its own date, not slip to the day before.
    const map = rowsByDay([row('a', '2026-08-01T00:00:00Z')], 'due');
    expect([...map.keys()]).toEqual(['2026-08-01']);
  });
});

describe('local date keys', () => {
  it('formats from LOCAL parts, so no offset can shift the day', () => {
    const d = new Date(2026, 7, 1, 0, 30); // 1 Aug, local
    expect(dayKeyOf(d)).toBe('2026-08-01');
    expect(monthKeyOf(d)).toBe('2026-08');
  });
});
