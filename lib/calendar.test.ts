import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gmtLabel, monthHeader, monthCells, WEEKDAYS } from './calendar';
import { WEEK_STARTS_ON } from './date';

describe('gmtLabel — the time grid names its zone', () => {
  // The gutter said "GMT" whatever the zone: a grid drawn in India Standard Time claimed to be Greenwich, while the
  // event composer beside it said "GMT +5:30 Calcutta" (2026-09-21).
  it('names the offset from minutes ahead of UTC', () => {
    expect(gmtLabel(330)).toBe('GMT+5:30');
    expect(gmtLabel(345)).toBe('GMT+5:45');
    expect(gmtLabel(-240)).toBe('GMT−4');
    expect(gmtLabel(-570)).toBe('GMT−9:30');
  });

  it('is plain GMT on the meridian', () => {
    expect(gmtLabel(0)).toBe('GMT');
  });
});

describe('monthHeader — the month grid names the days its cells show', () => {
  // The cells start on the app's week start (Monday) but the header printed a fixed Sunday-first list, so every
  // column was named for the day before it: Monday the 21st sat under "Sun" (2026-09-21).
  it('reads each column name off the cell beneath it', () => {
    for (const anchor of [new Date(2026, 8, 15), new Date(2026, 1, 1), new Date(2027, 11, 31)]) {
      const cells = monthCells(anchor);
      expect(monthHeader(anchor)).toEqual(cells.slice(0, 7).map((d) => WEEKDAYS[d.getDay()]));
    }
  });

  it('starts where the app starts its week', () => {
    expect(monthHeader(new Date(2026, 8, 15))[0]).toBe(WEEKDAYS[WEEK_STARTS_ON]);
  });

  it('the month view draws its header from monthHeader, never the fixed list', () => {
    const src = readFileSync('components/calendar/month-grid.tsx', 'utf8');
    expect(src).not.toMatch(/WEEKDAYS\.map\(/);
    expect(src).toMatch(/monthHeader\(/);
  });

  it('a clock time is shown as the house formats it, never trimmed by hand', () => {
    // `fmtTime(…).replace(':00', '')` was a 12-hour trick ("7:00 AM" → "7am"); on the house 24-hour clock it turned
    // "07:00" into a bare "07" beside "08:30".
    const src = readFileSync('components/calendar/month-grid.tsx', 'utf8');
    expect(src).not.toMatch(/replace\(\s*['"]:00['"]/);
  });
});
