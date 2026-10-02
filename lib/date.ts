// THE date vocabulary. Every date a person reads comes from here.
//
// Before this, `toLocaleDateString` was called at 31 sites — 8 with the user's
// locale and 5 hardcoding `'en-US'` — so a non-US user saw "Jun 2" on Tasks and
// "2 Jun" on Finance in the same session. Same app, two calendars.
//
// ── THE HOUSE FORMAT, and why it is pinned ─────────────────────────────────
// These formatters used to fall through to the *ambient* locale, on the rule
// that "client components pass no locale, so the browser formats in the user's
// own". That rule was written on a false premise: a `'use client'` component is
// still SERVER-RENDERED first. So the server formatted with Node's locale
// (`en-US` → "Sep 4") and the browser re-rendered with the user's (`en-GB` →
// "4 Sept") — a hydration mismatch on every page carrying a date, for every
// user whose locale is not the server's. It was live on Horizon's goal cards.
//
// There is no way to be both ambient-locale AND server-rendered. So the format
// is pinned, and the app has ONE calendar:
//
//     dates   day before month, 3-letter month   "4 Sep" · "4 Sep 2025"
//     clock   24-hour                            "18:05"
//
// That is not a new decision — it is what every docstring in this file already
// documented and every test already asserted; the ambient locale was quietly
// defeating it. Pinning also makes the output *testable*, which is why the
// tests no longer have to pass a locale of their own to be stable.
//
// The month names come from ICU rather than a hardcoded list, but the ORDER is
// ours: no English locale gives both day-first order and uniform three-letter
// months (en-GB and friends render September as "Sept" alone among its
// siblings), so delegating the whole format to any single locale could not
// produce the format this file documents.
//
// A per-user date/clock preference is the right way to offer variation later —
// explicit and stored, like the timezone already is. Auto-detecting it from the
// browser is the one option that cannot work, for the reason above.
//
// Week helpers below are computed in UTC so day ids line up exactly with how
// tasks store `scheduled_date` (also UTC date strings).

/** Uniform 3-letter month and weekday abbreviations. Naming only — never order. */
const NAMES = 'en-US';
/** 24-hour, zero-padded. */
const CLOCK = 'en-GB';

const monthShort = (d: Date, tz?: string, long?: boolean) =>
  d.toLocaleDateString(NAMES, { month: long ? 'long' : 'short', ...(tz ? { timeZone: tz } : {}) });
const weekdayName = (d: Date, long?: boolean, tz?: string) =>
  d.toLocaleDateString(NAMES, { weekday: long ? 'long' : 'short', ...(tz ? { timeZone: tz } : {}) });

/** Accepts an ISO date/datetime string or a Date; invalid input yields undefined. */
type Dateish = string | Date | null | undefined;

/**
 * There is deliberately no `locale` option. The format is the house format (see
 * above) — an option to override it per call site is exactly how the app ended
 * up with two calendars in the first place.
 */
export type DateOpts = {
  /**
   * Lead with the weekday — `true`/`'short'` gives "Tue 2 Jun", `'long'` gives
   * "Tuesday 2 Jun". Long is for a single focused day (Calendar's day view);
   * short is for repeating rows, where the full word is noise.
   */
  weekday?: boolean | 'short' | 'long';
  /**
   * Force the year on even inside the current year. The default drops it
   * because a row full of "2 Jun 2026" reads as noise — but a standalone
   * record date (an invoice, a signed document) should always be unambiguous.
   */
  year?: boolean;
  /**
   * Spell the month out — "4 September" instead of "4 Sep", "September 2026"
   * instead of "Sep 2026". For a standalone header or a single focused date
   * (a month title, a meeting's date line), where the abbreviation reads
   * clipped. Never for a row: a column of long months is noise.
   */
  long?: boolean;
  /**
   * What "now" is, for the formatters that are relative to it — `formatDay`'s
   * this-year check and `formatRelativeDay`'s Today/Yesterday/Tomorrow.
   *
   * Defaults to the real clock, which is what every call site wants. It exists
   * so those formatters can be *tested*: a function whose output depends on an
   * unstated global cannot be asserted about, and "Tomorrow" is exactly the
   * kind of answer that needs asserting.
   */
  now?: Dateish;
};

function toDate(v: Dateish): Date | null {
  if (!v) return null;
  // A bare "2026-06-02" parses as UTC midnight, which in a negative-offset zone
  // renders as the day BEFORE. Pin it to local midnight instead.
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(`${v}T00:00:00`)
    : new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "2 Jun" — and "2 Jun 2025" when it isn't this year. The default for any date
 * shown in a row, a chip or a meta column.
 */
export function formatDay(v: Dateish, opts: DateOpts = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  const showYear = opts.year || d.getFullYear() !== (toDate(opts.now) ?? new Date()).getFullYear();
  const weekday = opts.weekday === true ? 'short' : opts.weekday || undefined;
  const lead = weekday ? `${weekdayName(d, weekday === 'long')} ` : '';
  return `${lead}${d.getDate()} ${monthShort(d, undefined, opts.long)}${showYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "Tue 2 Jun". Convenience for `formatDay(v, { weekday: true })`. */
export function formatDayWithWeekday(v: Dateish, opts: DateOpts = {}): string | undefined {
  return formatDay(v, { ...opts, weekday: true });
}

/**
 * "2 Jun, 14:30" — a date AND a clock time, for timestamps where the hour
 * matters: a response landing, a page's last edit, an activity entry.
 * Honours the same `year` / `weekday` rules as `formatDay`.
 */
export function formatDayTime(v: Dateish, opts: DateOpts = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  return `${formatDay(d, opts)}, ${formatClock(d)}`;
}

/**
 * "6:00 PM" — the clock time alone, for when the DAY is already established by
 * its surroundings (a reminder chip inside today's list, a block on a calendar
 * column that is already headed "Tue 4").
 *
 * This is the vocabulary's missing entry rather than a new idea: `lib/calendar`
 * had its own `fmtTime`, hardcoded to `'en-US'` — one of the five sites the
 * header above was written about. It delegates here now, so a 24-hour-clock
 * user sees "18:00" on the calendar and on a reminder, not "6:00 PM" on one and
 * "18:00" on the other.
 */
export function formatClock(v: Dateish, tz?: string): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  return d.toLocaleTimeString(CLOCK, { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) });
}

/**
 * "09:30 – 10:15" — a span of clock times, for an event block or a schedule row.
 *
 * The vocabulary's other missing entry. TWO surfaces render a clock range — the
 * week grid and Home's schedule — and they disagreed: the grid delegated here,
 * while `schedule-section` carried a private 12-hour formatter
 * (`9:00 – 9:30pm`, meridiem on the end only) written to match a Figma comp that
 * predates the pinned house clock. So the same event read "13:30" in the picker
 * and on the calendar, and "1:30pm" in the list three feet below — and the local
 * one called `getHours()` during render in a `'use client'` component, which is
 * the hydration mismatch this file warns about a few lines up.
 *
 * Built on `formatClock` for the same reason `minutesOfDay` is: one mechanism,
 * so a range cannot drift from the times it is made of.
 */
export function formatClockRange(start: Dateish, end?: Dateish | null, tz?: string): string | undefined {
  const from = formatClock(start, tz);
  if (!from) return undefined;
  const to = end ? formatClock(end, tz) : undefined;
  return to ? `${from} – ${to}` : from;
}

/**
 * Minutes from midnight — 14:30 is 870 — resolved in an IANA zone.
 *
 * The same rule as `isoDateIn` one axis down: a browser knows what time it is
 * where it is, but a SERVER is UTC, so it has to be told the zone. Anything
 * that compares an instant against a wall-clock setting (work hours, a slot
 * grid) needs this rather than `getHours()`, which silently answers in the
 * runtime's zone — and a `'use client'` component runs in BOTH, so `getHours()`
 * during render is a hydration mismatch waiting for a user outside UTC.
 *
 * Built on `formatClock` on purpose: one mechanism, already pinned to a
 * 24-hour zero-padded format, so this cannot drift from what the clock shows.
 */
export function minutesOfDayIn(v: Dateish, tz?: string): number | undefined {
  const clock = formatClock(v, tz);
  if (!clock) return undefined;
  const [h, m] = clock.split(':');
  const mins = Number(h) * 60 + Number(m);
  return Number.isFinite(mins) ? mins : undefined;
}

/** Parse an `HH:MM` setting into minutes from midnight. Undefined if unusable. */
export function parseClock(hhmm: unknown): number | undefined {
  if (typeof hhmm !== 'string') return undefined;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return h * 60 + min;
}

/** Minutes from midnight back to the `HH:MM` shape a `<input type="time">` wants. */
export function toClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * "1 AM" / "01" — the HOUR alone, for a calendar's hour rail where a repeating
 * ":00" on every row is noise. Same locale rule as `formatClock`; a 24-hour
 * locale gets bare hours, which is what those users expect to see down a gutter.
 */
export function formatHour(v: Dateish): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  return d.toLocaleTimeString(CLOCK, { hour: '2-digit' });
}

/**
 * "45m" · "2h" · "1h 30m" — a DURATION in minutes, not a point in time.
 *
 * The vocabulary's other missing entry. An estimate, a timebox, a day's
 * capacity and a tracked elapsed time are all "a number of minutes a person
 * reads", and until now that had no home here — so three components each wrote
 * their own (`tasks/task-row`, `calendar/task-rail`, `rituals/ritual-flow`),
 * and they disagreed at the edges: two of them rendered a negative estimate as
 * "-30m" and only one guarded zero. Exactly the drift the header describes,
 * one type of number later.
 *
 * `long` spells it out — "1 hour 30 min" — for a sentence rather than a chip.
 * A row gets the short form; a headline that says how your day looks can afford
 * the words.
 */
export function formatMinutes(mins: number | null | undefined, opts: { long?: boolean } = {}): string {
  // Not `?? 0`: a missing estimate and a zero-minute one are different facts,
  // but both render as "0m" here — the CALLER decides whether to show a dash
  // instead, because only the caller knows which it has.
  const m = Math.round(Number(mins) || 0);
  if (m <= 0) return opts.long ? '0 min' : '0m';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (opts.long) {
    const parts: string[] = [];
    if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
    if (r) parts.push(`${r} min`);
    return parts.join(' ');
  }
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/**
 * "Tue" — the weekday alone, for day strips and column heads where the number
 * is rendered separately. `weekday: 'long'` gives "Tuesday".
 */
export function formatWeekday(v: Dateish, opts: DateOpts = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  return weekdayName(d, opts.weekday === 'long');
}

/** "Jun 2026" — for "client since", month headers. */
export function formatMonthYear(v: Dateish, opts: DateOpts = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  return `${monthShort(d, undefined, opts.long)} ${d.getFullYear()}`;
}

/** "Sep" (or "September" with `long`) — a month alone, for a time axis whose year is shown once. */
export function formatMonth(v: Dateish, opts: DateOpts = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  return monthShort(d, undefined, opts.long);
}

/**
 * "Today" / "Yesterday" / "Tomorrow", else `formatDay`. Use wherever a date is
 * about *when something happens* rather than a record of when it did.
 */
export function formatRelativeDay(v: Dateish, opts: DateOpts = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(toDate(opts.now) ?? new Date())) / 86400000);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  if (days === 1) return 'Tomorrow';
  return formatDay(d, opts);
}

/**
 * "today" / "4d ago" / "3w ago" / "2 Jun" — elapsed time, for activity feeds and
 * "last touched" lines. Past only; future dates fall through to `formatDay`.
 *
 * `precise` adds sub-day resolution ("just now", "5m ago", "3h ago") for threads
 * and feeds where the last hour is meaningfully different from this morning. A
 * form list does not need it; a client conversation does.
 */
export function formatAgo(v: Dateish, opts: DateOpts & { precise?: boolean } = {}): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 0) return formatDay(d, opts);
  if (opts.precise && days < 1) {
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDay(d, opts);
}

export type WeekDay = {
  id: string;      // ISO date, e.g. "2026-06-17"
  label: string;   // "Mon"
  date: string;    // "17 Jun" — the house format, like everywhere else
  today: boolean;
  past: boolean;
  weekend: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Monday. ONE week start for the whole app.
 *
 * There were FOUR independent answers to "which day does a week begin on":
 * `getWeekDays` here said Monday, `monthGrid` defaulted to Monday, the two week
 * functions in `lib/calendar.ts` hardcoded Sunday, and the DS date-picker asked
 * `navigator.language` (undefined on the server, so it rendered Monday there
 * and Sunday in a US browser — a hydration mismatch on top of the split).
 *
 * The visible symptom: Tasks → Week began on Monday while Calendar → Week began
 * on Sunday, in the same app, for the same week.
 */
export const WEEK_STARTS_ON = 1;

/** The first day of the week containing `d`, at local midnight. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() - WEEK_STARTS_ON + 7) % 7));
  return x;
}

export function getWeekDays(ref = new Date()): WeekDay[] {
  const todayStr = iso(ref);
  const utcDay = ref.getUTCDay(); // 0 = Sun … 6 = Sat
  const diffToMon = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + diffToMon));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
    const id = iso(d);
    const dow = d.getUTCDay();
    return {
      id,
      // These are UTC-pinned because the ids are (see the Day ids note below);
      // the ORDER is the house format's, not the naming locale's — this used to
      // render "Jun 17" while a task row beside it said "17 Jun".
      label: weekdayName(d, false, 'UTC'),
      date: `${d.getUTCDate()} ${monthShort(d, 'UTC')}`,
      today: id === todayStr,
      past: id < todayStr,
      weekend: dow === 0 || dow === 6,
    };
  });
}

export function weekRangeLabel(days: WeekDay[]): string {
  return `${days[0].date} – ${days[6].date}`;
}

// ── Day ids ────────────────────────────────────────────────────────────────
// `scheduled_date`, `log_date`, `ritual_date` and friends are CALENDAR dates,
// not instants: "2026-07-29" means that square on the wall calendar wherever
// the user is standing. The app had been computing them with
// `new Date().toISOString().slice(0, 10)` in ~20 places — which is the **UTC**
// date. In IST (UTC+5:30) that makes "today" *yesterday* between midnight and
// 05:30, so Home showed the wrong day's tasks for five and a half hours every
// night. Worse, `today-data.ts` mixed the two inside one function: the task date
// came from UTC while the calendar-event window came from local midnight.
//
// A browser knows where it is, so a client can just ask for its own date. A
// SERVER cannot — on Cloudflare it is UTC — so it must be told which zone to
// resolve, which is what `tz` is for.

/** The calendar date in an IANA zone (or the runtime's own when omitted). */
export function isoDateIn(v: Dateish, tz?: string): string | undefined {
  const d = toDate(v);
  if (!d) return undefined;
  // 'en-CA' formats as YYYY-MM-DD, which is exactly the storage shape — this
  // avoids hand-rolling the offset arithmetic (and its DST bugs).
  return d.toLocaleDateString('en-CA', tz ? { timeZone: tz } : undefined);
}

/** Today's calendar date. Pass the user's zone on the server; omit on a client. */
export function todayISO(tz?: string): string {
  return isoDateIn(new Date(), tz)!;
}

/** `n` days from a day id, staying a calendar date (no TZ maths). */
export function addDaysISO(dayISO: string, n: number): string {
  const d = new Date(`${dayISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The user's zone, read out of `profiles.preferences`.
 *
 * THE one reader. There were three — `userTimezone()`, the digest worker and
 * the MCP route — and they disagreed about the fallback: `'UTC'` in one,
 * `undefined` in another, which means "the runtime's own zone" — UTC on
 * Cloudflare but IST on a laptop, so the same row named a different day in dev
 * than in production. The third never read the zone at all.
 *
 * It also VALIDATES. The zone is written by the browser, but it is still a
 * string in a JSON bag, and `toLocaleDateString` throws a RangeError on a zone
 * it does not know — so one damaged value failed every server render that
 * asked what day it was. UTC is the fallback because it is the old behaviour:
 * an unsynced or damaged profile is never worse off than before.
 */
export function readTimeZone(preferences: unknown): string {
  const tz = preferences && typeof preferences === 'object'
    ? (preferences as Record<string, unknown>).timezone
    : undefined;
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** How far `tz`'s wall clock is ahead of UTC at an instant, in ms. */
function zoneOffsetMs(instant: number, tz: string): number {
  const whole = Math.floor(instant / 1000) * 1000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(whole));
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - whole;
}

/**
 * The first instant of a calendar day in `tz`.
 *
 * The offset has to be measured AT the answer, which is the thing being
 * solved for — so it is measured at a guess and again at the result, and
 * whichever candidate actually falls on `dayISO` wins. Neither pass alone is
 * right everywhere: a zone that springs forward AT midnight (Santiago) has no
 * 00:00, so its day begins at 01:00 and only the first pass lands there; a
 * zone that falls back across midnight needs the second. On an ordinary day
 * the two agree.
 */
function zoneDayStart(dayISO: string, tz: string): number {
  const [y, m, d] = dayISO.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);             // local midnight, read as if it were UTC
  const first = wall - zoneOffsetMs(wall, tz);
  const second = wall - zoneOffsetMs(first, tz);
  const onDay = [first, second].filter((t) => isoDateIn(new Date(t), tz) === dayISO);
  return onDay.length ? Math.min(...onDay) : second;
}

/**
 * The instants a calendar day spans in `tz`, as a half-open `[start, end)`.
 *
 * `end` is the NEXT day's start, not `start + 24h`. Those differ twice a year —
 * the spring-forward day is 23 hours long and the fall-back day 25 — and the
 * fixed-length version counted an hour of tomorrow's meetings as today's, or
 * dropped the last hour of today's, on exactly those days.
 */
export function dayWindow(dayISO: string, tz: string): { startISO: string; endISO: string } {
  return {
    startISO: new Date(zoneDayStart(dayISO, tz)).toISOString(),
    endISO: new Date(zoneDayStart(addDaysISO(dayISO, 1), tz)).toISOString(),
  };
}
