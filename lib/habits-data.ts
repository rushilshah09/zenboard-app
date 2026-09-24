// Loader for the Habits page (/habits) — the daily journal and the review surface.
//
// Returns each active habit with its repeat schedule, its per-day goal, the
// viewed DATE's status (done · partial · skipped · none) and the numbers the
// review shows. Every number comes from `lib/habit-schedule.ts`, which is the one
// place that knows whether a habit was actually DUE on a given day — see the
// comment at the top of that file for why that matters more than it sounds.
//
// Degrades gracefully: if migration 0025 isn't applied it falls back to the
// simple shape (everything daily, "any time", no skip, no counting).
import { userTimezone } from '@/lib/user-tz';
import { todayISO, addDaysISO, WEEK_STARTS_ON } from '@/lib/date';
import {
  toSchedule, isDue, currentStreak, bestStreak, consistency,
  type HabitSchedule, type StreakUnit,
} from '@/lib/habit-schedule';
import { currentProfile } from '@/lib/profile';
import { readVacationUntil, vacationDaysIn } from '@/lib/vacation';
import { pageScope } from '@/lib/page-scope';

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';
/** `partial` is goal progress short of the target — visible, but not a claim of
 *  completion. It only exists for habits whose goal is more than once a day. */
export type HabitStatus = 'done' | 'partial' | 'skipped' | 'none';

export type BoardHabit = {
  id: string;
  title: string;
  timeOfDay: TimeOfDay;
  /** Which days this habit is meant to happen. */
  schedule: HabitSchedule;
  /** How many times in a due day counts as done. 1 for most habits. */
  goalTarget: number;
  color: string | null;
  /** For the viewed date. */
  status: HabitStatus;
  /** Times done on the viewed date — 0…goalTarget. */
  count: number;
  /** Is the habit even due on the viewed date? A day it isn't due is never a miss. */
  due: boolean;
  streak: number;
  /** `week` for an "N times a week" habit, whose unit of judgement is the week. */
  streakUnit: StreakUnit;
  /**
   * The seven days ending on the viewed date, oldest first (§7G: a gentle trail,
   * where a missed day is just a gray dot — not a broken chain). Derived from
   * logs already fetched; costs no extra query.
   */
  last7: TrailDay[];
  /**
   * Every done/skipped day inside the 120-day window the loader ALREADY fetches
   * — it used to compute `last7` and a streak from these and throw the rest
   * away, so the whole heat map costs no extra query.
   */
  doneDates: string[];
  skippedDates: string[];
  /** Best run ever inside the window — the quiet counterpart to `streak`. */
  bestStreak: number;
  /** Share of DUE days kept, over the last 30. */
  consistency30: number;
  /** No retroactive misses: nothing before this day is a gap (§7G). */
  createdAt: string | null;
  /** This week's tally, for an "N times a week" habit. */
  weekDone: number;
  weekTarget: number;
};

/** `off` is a day the habit wasn't due — drawn as nothing, counted as nothing. */
export type TrailDay = 'done' | 'skipped' | 'missed' | 'off';

export type HabitsBoard = {
  habits: BoardHabit[];
  date: string;
  /** Today in the USER's zone, so the client never has to guess it. */
  today: string;
  supported: boolean;
  error: boolean;
};

type FullRow = {
  id: string; title: string; time_of_day: string | null;
  goal_target: number | null; goal_period: string | null; color: string | null;
  created_at?: string | null;
  schedule_kind?: string | null; schedule_days?: number[] | null; schedule_count?: number | null;
};
type LogRow = { habit_id: string; log_date: string; done: boolean; status?: string; count?: number };

export async function loadHabitsBoard(dateISO?: string): Promise<HabitsBoard> {
  const { supabase, sid } = await pageScope();
  // The viewed day is a CALENDAR date in the user's zone. This file used to
  // compute it with `new Date().toISOString().slice(0, 10)` — the UTC date —
  // which in IST meant that from midnight to 05:30 the journal opened on
  // yesterday and a habit checked off at 01:00 was logged against the wrong day.
  const tz = await userTimezone();
  const today = todayISO(tz);
  const date = dateISO ?? today;

  // v2 columns first; fall back to the simple list if 0025 isn't applied.
  //
  // The logs go out WITH the list. They used to wait for it, to be asked for by
  // the listed habits' ids, but RLS already scopes them to this person and a log
  // is only ever looked up by a listed habit below: the wait bought a round trip
  // and nothing else. The v2 log columns ride the same retry-not-probe gate.
  const since = addDaysISO(date, -120);
  let supported = true;
  let rows: FullRow[] = [];
  const [full, firstLogs] = await Promise.all([
    supabase.from('habits')
      .select('id, title, time_of_day, goal_target, goal_period, color, created_at, schedule_kind, schedule_days, schedule_count')
      .eq('space_id', sid).eq('active', true).eq('archived', false)
      .order('sort_order').order('created_at'),
    supabase.from('habit_logs').select('habit_id, log_date, done, status, count').gte('log_date', since),
  ]);
  if (full.error) {
    supported = false;
    const base = await supabase.from('habits').select('id, title').eq('space_id', sid).eq('active', true).order('created_at');
    if (base.error) return { habits: [], date, today, supported: false, error: true };
    rows = ((base.data as { id: string; title: string }[]) ?? []).map((r) => ({ ...r, time_of_day: 'any', goal_target: 1, goal_period: 'day', color: null }));
  } else {
    rows = (full.data as FullRow[]) ?? [];
  }
  if (!rows.length) return { habits: [], date, today, supported, error: false };

  // §7C's "pause habit streaks WITHOUT LOSS". A vacation day is neither kept nor
  // broken — it is not JUDGED, which is exactly what `skipped` already means to
  // `lib/habit-schedule.ts`. That parameter has existed since habits v2 with
  // nothing ever passed into it; this is its first caller.
  //
  // Bounded by the window the loader already reads, so a vacation date set years
  // out cannot widen the walk: the guard is the window, not a trusted value.
  const vacationDays = vacationDaysIn(since, date, readVacationUntil((await currentProfile())?.preferences));
  const logsRes = supported && !firstLogs.error
    ? firstLogs
    : await supabase.from('habit_logs').select('habit_id, log_date, done').gte('log_date', since);

  const doneByHabit = new Map<string, Set<string>>();
  const skippedByHabit = new Map<string, Set<string>>();
  const onDate = new Map<string, { done: boolean; skipped: boolean; count: number }>();
  for (const l of ((logsRes.data as unknown as LogRow[]) ?? [])) {
    if (l.done) {
      const s = doneByHabit.get(l.habit_id) ?? new Set<string>();
      s.add(l.log_date);
      doneByHabit.set(l.habit_id, s);
    } else if (l.status === 'skipped') {
      const s = skippedByHabit.get(l.habit_id) ?? new Set<string>();
      s.add(l.log_date);
      skippedByHabit.set(l.habit_id, s);
    }
    if (l.log_date === date) {
      onDate.set(l.habit_id, {
        done: !!l.done,
        skipped: !l.done && l.status === 'skipped',
        // A partial day is `count > 0, done = false`. Older rows have no count,
        // so a done row without one counts as a single completion.
        count: l.count ?? (l.done ? 1 : 0),
      });
    }
  }

  const habits: BoardHabit[] = rows.map((r) => {
    const done = doneByHabit.get(r.id) ?? new Set<string>();
    // A day you deliberately skipped and a day you were away are the same fact
    // to a streak: not judged. They are different facts to the JOURNAL, which is
    // why only the streak inputs are unioned and `status` below is untouched.
    const skipped = new Set([...(skippedByHabit.get(r.id) ?? []), ...vacationDays]);
    const born = r.created_at ?? null;
    // A row written before 0025 carries goal_period='week'; until the migration
    // backfills it, read that as the weekly schedule it was trying to express.
    const schedule = supported
      ? toSchedule(r)
      : ({ kind: 'daily' } as HabitSchedule);
    const goalTarget = Math.max(1, r.goal_target ?? 1);
    const cur = onDate.get(r.id);
    const count = cur?.count ?? 0;
    const status: HabitStatus = cur?.done ? 'done'
      : cur?.skipped ? 'skipped'
      : count > 0 ? 'partial'
      : 'none';

    const streak = currentStreak(schedule, date, done, skipped, born);
    const best = bestStreak(schedule, date, done, skipped, born);

    return {
      id: r.id,
      title: r.title,
      timeOfDay: (['any', 'morning', 'afternoon', 'evening'].includes(r.time_of_day ?? 'any') ? r.time_of_day : 'any') as TimeOfDay,
      schedule,
      goalTarget,
      color: r.color,
      status,
      count,
      due: isDue(schedule, date),
      streak: streak.value,
      streakUnit: streak.unit,
      last7: trail(schedule, date, done, skipped, born),
      doneDates: [...done],
      skippedDates: [...skipped],
      bestStreak: best.value,
      consistency30: consistency(schedule, date, done, skipped, born).pct,
      createdAt: born,
      weekDone: weekTally(date, done),
      weekTarget: schedule.kind === 'weekly' ? schedule.count : 0,
    };
  });

  return { habits, date, today, supported, error: false };
}

/** Seven days ending on the viewed date, oldest first. A day the habit wasn't
 *  due reads `off`, never `missed` — that distinction is the whole point. */
function trail(
  schedule: HabitSchedule,
  date: string,
  done: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
  born: string | null,
): TrailDay[] {
  const bornDay = born ? born.slice(0, 10) : null;
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDaysISO(date, i - 6);
    if (done.has(d)) return 'done';
    if (skipped.has(d)) return 'skipped';
    // Before it existed, or not due: not a miss.
    if (bornDay && d < bornDay) return 'off';
    if (!isDue(schedule, d)) return 'off';
    // A weekly habit is judged by its week, so no single day is a miss.
    if (schedule.kind === 'weekly') return 'off';
    return 'missed';
  });
}

/** How many days of `date`'s week are done — the tally an "N times a week"
 *  habit is actually measured by. */
function weekTally(date: string, done: ReadonlySet<string>): number {
  // The week must be the one the user SEES. This walked back to Sunday while
  // every calendar in the app starts Monday, so on a Sunday the heat map drew
  // the day in the old week while this counted it in a new one.
  const start = addDaysISO(date, -((new Date(`${date}T00:00:00`).getDay() - WEEK_STARTS_ON + 7) % 7));
  let n = 0;
  for (let i = 0; i < 7; i++) if (done.has(addDaysISO(start, i))) n++;
  return n;
}
