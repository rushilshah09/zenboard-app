// A database seen as a timeline — the arithmetic, without a DOM.
//
// Each page is a bar from its start date to its end date (database brief §6, after
// Notion's Timeline view). Everything here works on CALENDAR days, 'YYYY-MM-DD'
// strings counted as whole UTC days, never on Date objects crossing a timezone —
// the bug lib/calendar-grid.ts documents ("today" was wrong until 05:30 IST).
import type { DbRow, ViewDef } from '@/lib/collections';

export const TIMELINE_ZOOMS = ['week', 'month', 'quarter', 'year'] as const;
export type TimelineZoom = (typeof TIMELINE_ZOOMS)[number];
export const isTimelineZoom = (x: unknown): x is TimelineZoom => typeof x === 'string' && (TIMELINE_ZOOMS as readonly string[]).includes(x);
export const ZOOM_LABEL: Record<TimelineZoom, string> = { week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' };

/** How wide a day is at each zoom — a week reads its days, a year its months. */
export const DAY_PX: Record<TimelineZoom, number> = { week: 48, month: 16, quarter: 6, year: 2 };

const DAY_MS = 86400000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Whole days since the epoch for a calendar day, or null for anything that is not one. */
export function dayNumber(day: string | null | undefined): number | null {
  const m = typeof day === 'string' ? DAY_RE.exec(day) : null;
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : Math.round(t / DAY_MS);
}

/** The calendar day `n` whole days since the epoch. */
export function dayFromNumber(n: number): string {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const addDays = (day: string, n: number): string => dayFromNumber((dayNumber(day) ?? 0) + n);

/**
 * A stored date moved by whole days, keeping anything after the day — a time a
 * date property carries survives a drag that only meant to move the day.
 */
export function shiftStored(raw: string, days: number): string {
  const n = dayNumber(raw);
  return n === null ? raw : dayFromNumber(n + days) + raw.slice(10);
}

/** Where a page sits in time: its start and end days, the end never before the start. */
export function rowSpan(row: DbRow, startProp: string, endProp?: string): { start: number; end: number } | null {
  const start = dayNumber(row.data[startProp] as string);
  if (start === null) return null;
  const endRaw = endProp ? dayNumber(row.data[endProp] as string) : null;
  const end = endRaw === null ? start : endRaw;
  return end < start ? { start: end, end: start } : { start, end };
}

/**
 * The days the timeline draws: every dated page and today, with room either side
 * to drag into — at least a few months at the finer zooms, so an empty timeline is
 * still a place to put things. Starts on a Monday, so weeks line up on the axis.
 */
export function timelineRange(spans: { start: number; end: number }[], today: number, zoom: TimelineZoom): { origin: number; days: number } {
  const pad = { week: 21, month: 45, quarter: 120, year: 365 }[zoom];
  const lo = Math.min(today, ...spans.map((s) => s.start)) - pad;
  const hi = Math.max(today, ...spans.map((s) => s.end)) + pad;
  // 1970-01-01 was a Thursday: day n is a Monday when (n + 3) % 7 === 0.
  const origin = lo - (((lo + 3) % 7) + 7) % 7;
  return { origin, days: hi - origin + 1 };
}

/** A bar's box in pixels: from the start of its first day to the end of its last. */
export function barBox(span: { start: number; end: number }, origin: number, zoom: TimelineZoom): { left: number; width: number } {
  const px = DAY_PX[zoom];
  return { left: (span.start - origin) * px, width: (span.end - span.start + 1) * px };
}

export type Tick = { label: string; left: number; width: number; day: number; weekend?: boolean };

/**
 * The two rows of the axis. `months` names each month over its days; `cells` is the
 * finer row — every day at Week zoom, each Monday at Month, each month at Quarter
 * and Year. `monthName(day)` names a month ('Sep'), supplied by the caller so the
 * app's one date formatter does the naming.
 */
export function axisTicks(origin: number, days: number, zoom: TimelineZoom, monthName: (day: string) => string): { months: Tick[]; cells: Tick[] } {
  const px = DAY_PX[zoom];
  const months: Tick[] = [];
  const cells: Tick[] = [];
  let monthStart = origin;
  for (let n = origin; n <= origin + days; n++) {
    const day = dayFromNumber(n);
    const last = n === origin + days;
    if (last || (n > origin && day.endsWith('-01'))) {
      const first = dayFromNumber(monthStart);
      const year = first.slice(0, 4);
      months.push({ label: `${monthName(first)}${zoom === 'quarter' || zoom === 'year' || first.slice(5, 7) === '01' ? ` ${year}` : ''}`, left: (monthStart - origin) * px, width: (n - monthStart) * px, day: monthStart });
      monthStart = n;
    }
    if (last) break;
    const dow = (((n + 3) % 7) + 7) % 7; // 0 = Monday … 6 = Sunday
    if (zoom === 'week') cells.push({ label: String(Number(day.slice(8))), left: (n - origin) * px, width: px, day: n, weekend: dow >= 5 });
    else if (zoom === 'month' && dow === 0) cells.push({ label: String(Number(day.slice(8))), left: (n - origin) * px, width: 7 * px, day: n });
  }
  if (zoom === 'quarter' || zoom === 'year') {
    for (const m of months) cells.push({ label: zoom === 'year' ? m.label.slice(0, 1) : m.label.split(' ')[0], left: m.left, width: m.width, day: m.day });
  }
  return { months, cells };
}

/** The day under a point on the axis. */
export const dayAt = (x: number, origin: number, zoom: TimelineZoom): number => origin + Math.floor(x / DAY_PX[zoom]);

/**
 * A bar dragged by `delta` whole days: moved, or one edge moved. An edge never
 * crosses the other — a bar is at least one day long.
 */
export function dragSpan(span: { start: number; end: number }, delta: number, grip: 'move' | 'start' | 'end'): { start: number; end: number } {
  if (grip === 'move') return { start: span.start + delta, end: span.end + delta };
  if (grip === 'start') return { start: Math.min(span.start + delta, span.end), end: span.end };
  return { start: span.start, end: Math.max(span.end + delta, span.start) };
}

/**
 * The data a page takes when its bar lands on `next`. Only the properties the drag
 * changed are written, each keeping its stored shape (a time after the day stays).
 * With no end property a bar is one day, and moving it moves the one date.
 */
export function spanPatch(row: DbRow, next: { start: number; end: number }, startProp: string, endProp?: string): Record<string, unknown> {
  const data = { ...row.data };
  const was = rowSpan(row, startProp, endProp);
  const write = (prop: string, day: number) => {
    const raw = data[prop];
    data[prop] = typeof raw === 'string' && dayNumber(raw) !== null ? shiftStored(raw, day - (dayNumber(raw) as number)) : dayFromNumber(day);
  };
  if (!was || was.start !== next.start) write(startProp, next.start);
  // An end is written when the bar has one to keep, or is now longer than a day — a
  // one-day page dragged along the axis stays a page with one date.
  const hadEnd = !!endProp && dayNumber(data[endProp] as string) !== null;
  if (endProp && (hadEnd ? was?.end !== next.end : next.end !== next.start)) write(endProp, next.end);
  return data;
}

/** The date properties a timeline reads, from the view — or the first date the database has. */
export function timelineProps(view: Pick<ViewDef, 'dateProp' | 'endDateProp'>, dateProps: { id: string }[]): { start?: string; end?: string } {
  const start = dateProps.find((p) => p.id === view.dateProp)?.id ?? dateProps[0]?.id;
  const end = view.endDateProp && view.endDateProp !== start && dateProps.some((p) => p.id === view.endDateProp) ? view.endDateProp : undefined;
  return { start, end };
}
