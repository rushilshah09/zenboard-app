// Date helpers for the Calendar view. All bucketing is in the user's *local*
// timezone (events are stored as absolute ISO instants and displayed locally).
export type CalEvent = { id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean; source: string | null; color?: string | null };

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

// 42 cells (6 weeks) covering the month that contains `anchor`, starting Sunday.
export function monthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay()); // back to Sunday
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// The 7 days (Sun..Sat) of the week containing `anchor`.
export function weekDays(anchor: Date): Date[] {
  const start = addDays(anchor, -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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

// Short 12-hour time from local minutes-of-day, e.g. 210 → "3:30 AM".
export function fmtMinTime(min: number): string {
  const h24 = Math.floor(min / 60) % 24, m = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${p2(m)} ${h24 < 12 ? 'AM' : 'PM'}`;
}
