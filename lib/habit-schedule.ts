// THE answer to "was this habit due on this day?" — and every number that
// depends on it (streak, consistency, the heat grid's per-day verdict).
//
// Why this file exists. Until now every habit was implicitly due EVERY day.
// Nothing stored which days it was supposed to happen, so the review surface
// computed streaks and a 30-day consistency percentage as if a weekday-only
// habit had failed every Saturday and Sunday of its life. A "3× per week" habit
// could show 43% and a broken streak while being followed perfectly.
//
// That is not a cosmetic bug. MASTER_PRODUCT_PLAN §7G is explicit that habits
// are reviewed "gentle streaks — no fire emoji, no loss-shaming; a missed day is
// a gray dot, not a broken chain". A number that quietly tells you you're
// failing when you aren't is the loudest kind of shaming there is, and it was
// coming from the one surface meant to be kind.
//
// So: a day is JUDGED only when the habit was actually due on it. Everything
// else is `off` — drawn as nothing, counted as nothing.

/**
 * How often a habit is meant to happen.
 * - `daily`  — every day.
 * - `days`   — only these weekdays (0 = Sunday … 6 = Saturday).
 * - `weekly` — N times a week, on any days you like. The WEEK is the unit of
 *   judgement here, so no individual day can be "missed".
 */
export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'days'; days: number[] }
  | { kind: 'weekly'; count: number };

export type ScheduleKind = HabitSchedule['kind'];

export const DAILY: HabitSchedule = { kind: 'daily' };

/** Parse a stored row into a schedule, tolerating anything (old rows, bad data). */
export function toSchedule(row: {
  schedule_kind?: string | null;
  schedule_days?: number[] | null;
  schedule_count?: number | null;
}): HabitSchedule {
  if (row.schedule_kind === 'days') {
    // A `days` schedule with no days would be due never, which is a habit you
    // can't ever do — treat it as daily rather than render something unusable.
    const days = (row.schedule_days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    return days.length ? { kind: 'days', days: [...new Set(days)].sort() } : DAILY;
  }
  if (row.schedule_kind === 'weekly') {
    return { kind: 'weekly', count: Math.min(7, Math.max(1, row.schedule_count ?? 1)) };
  }
  return DAILY;
}

/** The columns to write for a schedule. Every kind writes all three, so switching
 *  kinds never leaves the previous kind's values behind to be misread later. */
export function scheduleColumns(s: HabitSchedule) {
  return {
    schedule_kind: s.kind,
    schedule_days: s.kind === 'days' ? s.days : [],
    schedule_count: s.kind === 'weekly' ? s.count : 1,
  };
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Sunday-indexed weekday of a `YYYY-MM-DD` day id. Parsed as LOCAL midnight —
 *  a bare date string goes through `Date.parse` as UTC, which lands on the wrong
 *  weekday for anyone west of Greenwich. */
export function weekdayOf(dayISO: string): number {
  return new Date(`${dayISO}T00:00:00`).getDay();
}

/** Is the habit meant to happen on this day? `weekly` says yes to every day —
 *  you choose which ones — so use `isJudged` when you need "can this day be a
 *  miss?" rather than "is this day available?". */
export function isDue(s: HabitSchedule, dayISO: string): boolean {
  if (s.kind === 'days') return s.days.includes(weekdayOf(dayISO));
  return true;
}

/** Can this day count AGAINST you? Only for schedules whose unit is the day.
 *  A `weekly` habit is judged by its week, never by a particular Tuesday. */
export function isJudged(s: HabitSchedule, dayISO: string): boolean {
  return s.kind !== 'weekly' && isDue(s, dayISO);
}

/** Human wording. "Every day" · "Mon, Wed, Fri" · "3× a week". */
export function scheduleLabel(s: HabitSchedule): string {
  if (s.kind === 'daily') return 'Every day';
  if (s.kind === 'weekly') return `${s.count}× a week`;
  if (s.days.length === 7) return 'Every day';
  // Two common runs get a name; anything else lists the days.
  const set = new Set(s.days);
  const weekdays = [1, 2, 3, 4, 5].every((d) => set.has(d)) && set.size === 5;
  if (weekdays) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return s.days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/** For screen readers and tooltips, where abbreviations read badly. */
export function scheduleLongLabel(s: HabitSchedule): string {
  if (s.kind === 'daily') return 'Every day';
  if (s.kind === 'weekly') return `${s.count} times a week`;
  return s.days.map((d) => WEEKDAY_NAMES[d]).join(', ');
}

// ── The numbers ──────────────────────────────────────────────────────────────

const shift = (dayISO: string, n: number): string => {
  const d = new Date(`${dayISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** The Sunday that starts `dayISO`'s week. */
export function weekStart(dayISO: string): string {
  return shift(dayISO, -weekdayOf(dayISO));
}

export type StreakUnit = 'day' | 'week';

/**
 * The run ending on (or the period before) `dayISO`.
 *
 * For day-unit schedules this walks backwards over DUE days only, so a
 * Mon/Wed/Fri habit done every Mon, Wed and Fri has an unbroken streak — the
 * intervening Tuesdays are not misses to step over, they were never due. A
 * skipped day is deliberate and likewise doesn't break the run; it just doesn't
 * extend it either.
 *
 * For `weekly` the unit is the week: consecutive weeks that hit the target.
 * Today's week counts if it has already hit the target, and never counts
 * against you while it's still in progress.
 */
export function currentStreak(
  s: HabitSchedule,
  dayISO: string,
  done: ReadonlySet<string>,
  skipped: ReadonlySet<string> = new Set(),
  bornISO?: string | null,
): { value: number; unit: StreakUnit } {
  if (s.kind === 'weekly') {
    let weeks = 0;
    let cursor = weekStart(dayISO);
    // The current week is only counted once it's already met the target, so a
    // Monday morning never reads as "streak broken".
    if (countInWeek(cursor, done) < s.count) cursor = shift(cursor, -7);
    while (countInWeek(cursor, done) >= s.count) {
      if (bornISO && cursor < weekStart(bornISO)) break;
      weeks++;
      cursor = shift(cursor, -7);
    }
    return { value: weeks, unit: 'week' };
  }

  let run = 0;
  let cursor = dayISO;
  // Today not being done yet isn't a break — start from yesterday in that case.
  if (isDue(s, cursor) && !done.has(cursor) && !skipped.has(cursor)) cursor = shift(cursor, -1);
  // A 366-step bound: any real run is shorter, and it stops a bad schedule
  // from spinning forever.
  for (let guard = 0; guard < 366; guard++) {
    if (bornISO && cursor < bornISO.slice(0, 10)) break;
    if (!isDue(s, cursor)) { cursor = shift(cursor, -1); continue; }
    if (done.has(cursor)) { run++; cursor = shift(cursor, -1); continue; }
    if (skipped.has(cursor)) { cursor = shift(cursor, -1); continue; }
    break;
  }
  return { value: run, unit: 'day' };
}

function countInWeek(weekStartISO: string, done: ReadonlySet<string>): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (done.has(shift(weekStartISO, i))) n++;
  return n;
}

/** The longest run anywhere in the window, in the same unit as `currentStreak`. */
export function bestStreak(
  s: HabitSchedule,
  endISO: string,
  done: ReadonlySet<string>,
  skipped: ReadonlySet<string> = new Set(),
  bornISO?: string | null,
): { value: number; unit: StreakUnit } {
  if (!done.size) return { value: 0, unit: s.kind === 'weekly' ? 'week' : 'day' };
  const earliest = [...done].sort()[0];
  let best = 0;
  // Evaluate the run ending on each done day; the maximum is the best run.
  // Bounded by the window the loader fetched, so this is cheap.
  for (let cursor = earliest; cursor <= endISO; cursor = shift(cursor, s.kind === 'weekly' ? 7 : 1)) {
    const { value } = currentStreak(s, cursor, done, skipped, bornISO);
    if (value > best) best = value;
  }
  return { value: best, unit: s.kind === 'weekly' ? 'week' : 'day' };
}

/**
 * Share of the last `window` days that went the way they were meant to —
 * counted over DUE days only, and only from the day the habit existed.
 *
 * A weekday habit that is followed perfectly reads 100%, not 71%. A skipped day
 * is removed from the denominator rather than counted as a failure: deciding
 * not to do something is not the same as forgetting.
 */
export function consistency(
  s: HabitSchedule,
  endISO: string,
  done: ReadonlySet<string>,
  skipped: ReadonlySet<string> = new Set(),
  bornISO?: string | null,
  window = 30,
): { pct: number; done: number; eligible: number } {
  const born = bornISO ? bornISO.slice(0, 10) : null;

  if (s.kind === 'weekly') {
    // Whole weeks only: a week still in progress can't be scored yet.
    let hit = 0, weeks = 0;
    let cursor = shift(weekStart(endISO), -7);
    for (let i = 0; i < Math.floor(window / 7); i++) {
      if (born && cursor < weekStart(born)) break;
      weeks++;
      if (countInWeek(cursor, done) >= s.count) hit++;
      cursor = shift(cursor, -7);
    }
    return { pct: weeks === 0 ? 0 : Math.round((hit / weeks) * 100), done: hit, eligible: weeks };
  }

  let eligible = 0, hits = 0;
  for (let i = 0; i < window; i++) {
    const day = shift(endISO, -i);
    if (born && day < born) break;
    if (!isDue(s, day)) continue;
    if (skipped.has(day)) continue;
    eligible++;
    if (done.has(day)) hits++;
  }
  return { pct: eligible === 0 ? 0 : Math.round((hits / eligible) * 100), done: hits, eligible };
}
