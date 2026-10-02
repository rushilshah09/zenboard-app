import { describe, it, expect } from 'vitest';
import { monthGrid, weekdayLabels, withoutWeekends } from './calendar-grid';

// Calendar → "Show weekends" (DATABASE_EXPERIENCE_PLAN T8, Notion's layout setting).
// The header and the grid must drop the SAME days, and both follow the app's week
// start: the header was a hard-coded Mon…Sun, a second copy of the decision
// `WEEK_STARTS_ON` makes once.
const weekday = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

describe('weekdayLabels', () => {
  it('follows the week start', () => {
    expect(weekdayLabels(1)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(weekdayLabels(0)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('leaves out Saturday and Sunday when weekends are hidden, whatever the week start', () => {
    expect(weekdayLabels(1, false)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(weekdayLabels(0, false)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });
});

describe('withoutWeekends', () => {
  it('keeps five days a week, in order, under the matching header', () => {
    for (const start of [0, 1] as const) {
      const cells = withoutWeekends(monthGrid('2026-09', start));
      expect(cells.length % 5, `week start ${start}`).toBe(0);
      expect(cells.every((c) => ![0, 6].includes(weekday(c.date)))).toBe(true);
      expect(weekday(cells[0].date)).toBe(1); // every week row begins on a Monday
      expect(weekday(cells[4].date)).toBe(5);
    }
  });
});
