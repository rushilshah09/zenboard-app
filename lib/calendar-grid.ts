// Laying a month out as a grid, and dropping rows onto it.
//
// Pure so the arithmetic is testable without a DOM: month boundaries, the leading
// and trailing days that pad a 7-column grid, and which rows land on which day.
//
// Dates here are CALENDAR dates ('YYYY-MM-DD'), never Date objects crossing a
// timezone. `new Date('2026-08-01')` parses as UTC midnight, which is the previous
// day in any negative offset — the bug that made "today" wrong until 05:30 IST.
// Everything below works on the string.
import type { DbRow } from '@/lib/collections';
import { formatMonthYear, formatWeekday, WEEK_STARTS_ON } from '@/lib/date';

export type DayCell = {
  /** 'YYYY-MM-DD' */
  date: string;
  /** False for the leading/trailing days that pad the grid. */
  inMonth: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM' for a Date, in LOCAL time (never toISOString). */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 'YYYY-MM-DD' for a Date, in LOCAL time. */
export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Step a 'YYYY-MM' by whole months. */
export function shiftMonth(monthKey: string, by: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, (m - 1) + by, 1);
  return monthKeyOf(d);
}

/**
 * The 7-column grid for a month, padded to whole weeks.
 *
 * `weekStartsOn` 0 = Sunday, 1 = Monday. Always emits complete weeks, so the grid
 * never has a ragged first or last row — a calendar with a short row reads as
 * broken even when the dates are right.
 */
export function monthGrid(monthKey: string, weekStartsOn: 0 | 1 = WEEK_STARTS_ON): DayCell[] {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;

  const start = new Date(y, m - 1, 1 - lead);
  const daysInMonth = new Date(y, m, 0).getDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  const cells: DayCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: dayKeyOf(d), inMonth: d.getMonth() === m - 1 });
  }
  return cells;
}

/** Local day of the week for a 'YYYY-MM-DD' — 0 = Sunday … 6 = Saturday. */
const dayOfWeek = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};
const isWeekend = (dow: number) => dow === 0 || dow === 6;

/**
 * The grid's column heads, in the week's order — "Mon … Sun" or "Sun … Sat" —
 * and without Saturday and Sunday when the view hides weekends. Named by the
 * app's one weekday formatter; ordered by `WEEK_STARTS_ON`, so a header can never
 * disagree with the grid beneath it again (it was a hard-coded Mon…Sun).
 */
export function weekdayLabels(weekStartsOn: 0 | 1 = WEEK_STARTS_ON, showWeekends = true): string[] {
  const days = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  // 4 January 2026 was a Sunday, so the 4th + n is weekday n.
  return days
    .filter((dow) => showWeekends || !isWeekend(dow))
    .map((dow) => formatWeekday(new Date(2026, 0, 4 + dow)) ?? '');
}

/**
 * A month grid with its Saturdays and Sundays taken out: five cells a week, in
 * order, under `weekdayLabels(start, false)`. Whole weeks in, whole weeks out.
 */
export function withoutWeekends(cells: DayCell[]): DayCell[] {
  return cells.filter((c) => !isWeekend(dayOfWeek(c.date)));
}

/**
 * Bucket rows by day for one property.
 *
 * A stored date may be a bare 'YYYY-MM-DD' or a full ISO stamp; both are keyed by
 * their first 10 characters, which is the calendar day the user meant in both
 * cases. Anything unparseable is dropped rather than landing on epoch.
 */
export function rowsByDay(rows: DbRow[], datePropId: string): Map<string, DbRow[]> {
  const out = new Map<string, DbRow[]>();
  for (const r of rows) {
    const raw = r.data[datePropId];
    if (typeof raw !== 'string' || raw.length < 10) continue;
    const day = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const list = out.get(day);
    if (list) list.push(r); else out.set(day, [r]);
  }
  return out;
}

/** "August 2026" — for the calendar's own header. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return formatMonthYear(new Date(y, m - 1, 1), { long: true }) ?? '';
}
