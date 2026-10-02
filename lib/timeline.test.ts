import { describe, it, expect } from 'vitest';
import type { DbRow } from './collections';
import {
  DAY_PX, addDays, axisTicks, barBox, dayAt, dayFromNumber, dayNumber, dragSpan, rowSpan, shiftStored,
  spanPatch, timelineProps, timelineRange,
} from './timeline';

// A database as a timeline (database brief §6, after Notion): each page a bar from
// its start to its end. Calendar days only — these must give the same answer in
// every timezone the suite runs in.
const row = (data: Record<string, unknown>): DbRow => ({ id: 'r', title: 'r', data, order: 'a', created_at: '', updated_at: '' });
const d = (day: string) => dayNumber(day)!;

describe('calendar days as numbers', () => {
  it('counts whole days, across months, years and a leap day', () => {
    expect(d('2026-03-01') - d('2026-02-28')).toBe(1);
    expect(d('2028-03-01') - d('2028-02-28')).toBe(2);
    expect(d('2027-01-01') - d('2026-12-31')).toBe(1);
    expect(dayFromNumber(d('2026-09-15'))).toBe('2026-09-15');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });

  it('reads the day of a stored timestamp, and nothing from what is not a date', () => {
    expect(dayNumber('2026-09-15T23:30:00+05:30')).toBe(d('2026-09-15'));
    expect(dayNumber('soon')).toBeNull();
    expect(dayNumber(undefined)).toBeNull();
  });

  it('moves a stored date by days and keeps its time', () => {
    expect(shiftStored('2026-09-15T09:00', 2)).toBe('2026-09-17T09:00');
    expect(shiftStored('2026-09-15', -15)).toBe('2026-08-31');
  });
});

describe('rowSpan — where a page sits in time', () => {
  it('runs from start to end, a day long without an end, and never backwards', () => {
    expect(rowSpan(row({ s: '2026-09-01', e: '2026-09-03' }), 's', 'e')).toEqual({ start: d('2026-09-01'), end: d('2026-09-03') });
    expect(rowSpan(row({ s: '2026-09-01' }), 's', 'e')).toEqual({ start: d('2026-09-01'), end: d('2026-09-01') });
    expect(rowSpan(row({ s: '2026-09-05', e: '2026-09-01' }), 's', 'e')).toEqual({ start: d('2026-09-01'), end: d('2026-09-05') });
    expect(rowSpan(row({}), 's', 'e')).toBeNull();
  });
});

describe('the axis', () => {
  it('draws every dated page and today with room either side, starting on a Monday', () => {
    const today = d('2026-09-15');
    const { origin, days } = timelineRange([{ start: d('2026-10-01'), end: d('2026-10-20') }], today, 'week');
    expect(dayFromNumber(origin) <= '2026-08-25').toBe(true);
    expect(new Date(dayFromNumber(origin) + 'T00:00:00Z').getUTCDay()).toBe(1);
    expect(origin + days - 1).toBeGreaterThanOrEqual(d('2026-10-20'));
  });

  it('places a bar from the start of its first day to the end of its last', () => {
    const origin = d('2026-09-14');
    expect(barBox({ start: d('2026-09-15'), end: d('2026-09-17') }, origin, 'week')).toEqual({ left: 48, width: 144 });
    expect(barBox({ start: d('2026-09-14'), end: d('2026-09-14') }, origin, 'month')).toEqual({ left: 0, width: DAY_PX.month });
  });

  it('names the months once, and the days at the zoom that has room for them', () => {
    const origin = d('2026-08-31');
    const name = (day: string) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(day.slice(5, 7)) - 1];
    const week = axisTicks(origin, 14, 'week', name);
    expect(week.months.map((m) => m.label)).toEqual(['Aug', 'Sep']);
    expect(week.cells).toHaveLength(14);
    expect(week.cells[5]).toMatchObject({ label: '5', weekend: true });
    const month = axisTicks(origin, 35, 'month', name);
    expect(month.cells.map((c) => c.label)).toEqual(['31', '7', '14', '21', '28']);
  });

  it('knows the day under a point', () => {
    const origin = d('2026-09-14');
    expect(dayFromNumber(dayAt(0, origin, 'week'))).toBe('2026-09-14');
    expect(dayFromNumber(dayAt(47, origin, 'week'))).toBe('2026-09-14');
    expect(dayFromNumber(dayAt(48, origin, 'week'))).toBe('2026-09-15');
  });
});

describe('dragging a bar', () => {
  const span = { start: 10, end: 14 };

  it('moves the whole bar, or one edge — and an edge never crosses the other', () => {
    expect(dragSpan(span, 3, 'move')).toEqual({ start: 13, end: 17 });
    expect(dragSpan(span, -2, 'start')).toEqual({ start: 8, end: 14 });
    expect(dragSpan(span, 9, 'start')).toEqual({ start: 14, end: 14 });
    expect(dragSpan(span, -9, 'end')).toEqual({ start: 10, end: 10 });
  });

  it('writes only the dates that changed, in their stored shape', () => {
    const r = row({ s: '2026-09-01T09:00', e: '2026-09-03', other: 1 });
    const moved = spanPatch(r, { start: d('2026-09-02'), end: d('2026-09-04') }, 's', 'e');
    expect(moved).toEqual({ s: '2026-09-02T09:00', e: '2026-09-04', other: 1 });
    const stretched = spanPatch(r, { start: d('2026-09-01'), end: d('2026-09-06') }, 's', 'e');
    expect(stretched).toEqual({ s: '2026-09-01T09:00', e: '2026-09-06', other: 1 });
  });

  it('keeps a one-date page a one-date page when it is moved, and gives it an end when stretched', () => {
    const r = row({ s: '2026-09-01' });
    expect(spanPatch(r, { start: d('2026-09-05'), end: d('2026-09-05') }, 's', 'e')).toEqual({ s: '2026-09-05' });
    expect(spanPatch(r, { start: d('2026-09-01'), end: d('2026-09-03') }, 's', 'e')).toEqual({ s: '2026-09-01', e: '2026-09-03' });
  });
});

describe('timelineProps — which dates a timeline reads', () => {
  const dates = [{ id: 'start' }, { id: 'due' }];

  it("takes the view's choice, else the first date", () => {
    expect(timelineProps({ dateProp: 'due' }, dates)).toEqual({ start: 'due', end: undefined });
    expect(timelineProps({}, dates)).toEqual({ start: 'start', end: undefined });
  });

  it('never reads the same property as both ends, nor one that is gone', () => {
    expect(timelineProps({ dateProp: 'start', endDateProp: 'start' }, dates).end).toBeUndefined();
    expect(timelineProps({ dateProp: 'start', endDateProp: 'gone' }, dates).end).toBeUndefined();
    expect(timelineProps({ dateProp: 'start', endDateProp: 'due' }, dates).end).toBe('due');
  });
});
