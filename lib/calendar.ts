import { formatClock, formatHour , startOfWeek } from '@/lib/date';

// Date helpers for the Calendar view. All bucketing is in the user's *local*
// timezone (events are stored as absolute ISO instants and displayed locally).
// task_id / task_done arrive with the timebox twin (0030, lib/timebox.ts).
// task_done is NOT a column — it is the linked TASK's completion, joined in by
// the loader, because a twin block has no completion of its own.
export type CalEvent = {
  id: string; title: string; starts_at: string; ends_at: string | null;
  all_day: boolean; source: string | null; color?: string | null;
  task_id?: string | null; task_done?: boolean | null;
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const p2 = (n: number) => String(n).padStart(2, '0');

// yyyy-mm-dd in local time.
export function localISODate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// Absolute ISO instant from a local yyyy-mm-dd + HH:MM.
export function isoFromLocal(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return x;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

// 42 cells (6 weeks) covering the month that contains `anchor`.
// These two used to walk back to SUNDAY while `getWeekDays` walked back to
// Monday, so Calendar → Week and Tasks → Week disagreed about the same week.
export function monthCells(anchor: Date): Date[] {
  const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// The 7 days of the week containing `anchor`, from the app's week start.
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// The clock time of an instant. Delegates to THE date vocabulary (lib/date.ts)
// — this used to hardcode 'en-US', so a 24-hour-clock user read "3:30 PM" on a
// calendar block and "15:30" everywhere date.ts already reached.
export const fmtTime = (iso: string) => formatClock(iso) ?? '';

// Minutes from local midnight for a given instant (used to place timed events).
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// Round a minute value to the nearest step (for click-to-create on the time grid).
export function roundToStep(min: number, step = 30): number {
  return Math.round(min / step) * step;
}

export function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${p2(h)}:${p2(m)}`;
}

// ISO-8601 week number (Mon-based) for the toolbar caption ("Week 28").
export function weekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; // Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * The time grid's zone label, from minutes AHEAD of UTC: "GMT+5:30", "GMT−4", or plain "GMT" on the meridian.
 * The gutter printed "GMT" whatever the zone (2026-09-21); `localTimezone` below is the composer's longer form.
 */
export function gmtLabel(aheadMin: number): string {
  if (!aheadMin) return 'GMT';
  const a = Math.abs(aheadMin);
  const h = Math.floor(a / 60), m = a % 60;
  return `GMT${aheadMin > 0 ? '+' : '−'}${h}${m ? ':' + p2(m) : ''}`;
}

/**
 * The month grid's column names, read off the same dates its cells show — so a header cannot disagree with the
 * days beneath it. It printed the fixed Sunday-first `WEEKDAYS` over Monday-first cells (2026-09-21).
 */
export function monthHeader(anchor: Date): string[] {
  return monthCells(anchor).slice(0, 7).map((d) => WEEKDAYS[d.getDay()]);
}

// The browser's IANA timezone + a short GMT offset label, e.g. "GMT +5:30 Calcutta".
export function localTimezone(): { gmt: string; city: string } {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '−';
  const h = Math.floor(Math.abs(off) / 60), m = Math.abs(off) % 60;
  const gmt = `GMT ${sign}${h}${m ? ':' + p2(m) : ''}`;
  let city = '';
  try { city = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/').pop()?.replace(/_/g, ' ') ?? ''; } catch { /* ignore */ }
  return { gmt, city };
}

// The clock time of a minutes-from-midnight value, e.g. 210 → "3:30 AM" (or
// "03:30" on a 24-hour locale). Through THE date vocabulary, like `fmtTime`:
// this hand-rolled its own AM/PM, so after `fmtTime` started honouring the
// locale the calendar showed a 24-hour grid with a 12-hour "now" label, and the
// timebox picker offered 12-hour slots next to a 24-hour reminder chip.
export function fmtMinTime(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60) % 24, min % 60, 0, 0);
  return formatClock(d) ?? '';
}

// The hour rail's label ("1 AM", or "01" on a 24-hour locale). The week grid
// hand-rolled this too — a FOURTH copy, and the one a regex looking for
// `\d:\d\d ?(AM|PM)` cannot see, because it has no minutes.
export function fmtHourLabel(hour: number): string {
  const d = new Date();
  d.setHours(hour % 24, 0, 0, 0);
  return formatHour(d) ?? '';
}
