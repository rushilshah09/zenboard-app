import { describe, it, expect } from 'vitest';
import {
  toSchedule, scheduleColumns, scheduleLabel, weekdayOf, isDue, isJudged,
  currentStreak, bestStreak, consistency, weekStart, type HabitSchedule,
} from './habit-schedule';

// 2026-07-27 is a Monday, so the week Sun 26 Jul → Sat 1 Aug is the reference.
const MON = '2026-07-27';
const TUE = '2026-07-28';
const WED = '2026-07-29';
const THU = '2026-07-30';
const FRI = '2026-07-31';
const SAT = '2026-08-01';
const SUN = '2026-07-26';

const MWF: HabitSchedule = { kind: 'days', days: [1, 3, 5] };
const DAILY: HabitSchedule = { kind: 'daily' };

describe('weekdayOf', () => {
  it('reads a bare day id as LOCAL midnight, not UTC', () => {
    // `new Date('2026-07-27')` is UTC midnight, which is Sunday evening in the
    // Americas — the whole schedule would shift by a day there.
    expect(weekdayOf(MON)).toBe(1);
    expect(weekdayOf(SUN)).toBe(0);
    expect(weekdayOf(SAT)).toBe(6);
  });
});

describe('toSchedule', () => {
  it('defaults to daily for old rows with no schedule columns', () => {
    expect(toSchedule({})).toEqual({ kind: 'daily' });
  });
  it('falls back to daily rather than producing a habit due on no day', () => {
    expect(toSchedule({ schedule_kind: 'days', schedule_days: [] })).toEqual({ kind: 'daily' });
  });
  it('dedupes, sorts and drops out-of-range weekdays', () => {
    expect(toSchedule({ schedule_kind: 'days', schedule_days: [5, 1, 1, 9, -2, 3] }))
      .toEqual({ kind: 'days', days: [1, 3, 5] });
  });
  it('clamps a weekly count into 1..7', () => {
    expect(toSchedule({ schedule_kind: 'weekly', schedule_count: 99 })).toEqual({ kind: 'weekly', count: 7 });
    expect(toSchedule({ schedule_kind: 'weekly', schedule_count: 0 })).toEqual({ kind: 'weekly', count: 1 });
  });
});

describe('scheduleColumns', () => {
  it('always writes all three, so a kind switch leaves nothing stale behind', () => {
    // Going days → weekly must not leave [1,3,5] in schedule_days, or a later
    // read of a half-updated row would resurrect the old schedule.
    expect(scheduleColumns({ kind: 'weekly', count: 3 }))
      .toEqual({ schedule_kind: 'weekly', schedule_days: [], schedule_count: 3 });
    expect(scheduleColumns(MWF))
      .toEqual({ schedule_kind: 'days', schedule_days: [1, 3, 5], schedule_count: 1 });
  });
});

describe('scheduleLabel', () => {
  it('names the runs people actually pick', () => {
    expect(scheduleLabel(DAILY)).toBe('Every day');
    expect(scheduleLabel({ kind: 'days', days: [1, 2, 3, 4, 5] })).toBe('Weekdays');
    expect(scheduleLabel({ kind: 'days', days: [0, 6] })).toBe('Weekends');
    expect(scheduleLabel({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
    expect(scheduleLabel(MWF)).toBe('Mon, Wed, Fri');
    expect(scheduleLabel({ kind: 'weekly', count: 3 })).toBe('3× a week');
  });
});

describe('isDue / isJudged', () => {
  it('only marks the chosen weekdays due', () => {
    expect(isDue(MWF, MON)).toBe(true);
    expect(isDue(MWF, TUE)).toBe(false);
    expect(isDue(MWF, WED)).toBe(true);
  });
  it('makes every day available for a weekly habit but judges none of them', () => {
    const w: HabitSchedule = { kind: 'weekly', count: 3 };
    expect(isDue(w, TUE)).toBe(true);
    expect(isJudged(w, TUE)).toBe(false);
  });
  it('never judges a day the habit was not due on', () => {
    expect(isJudged(MWF, TUE)).toBe(false);
    expect(isJudged(MWF, WED)).toBe(true);
  });
});

describe('currentStreak', () => {
  it('does not break across days the habit was never due', () => {
    // THE bug this module exists for: Mon/Wed/Fri done perfectly used to read
    // as a 1-day streak, because Tuesday and Thursday counted as misses.
    const done = new Set([MON, WED, FRI]);
    expect(currentStreak(MWF, FRI, done)).toEqual({ value: 3, unit: 'day' });
  });
  it('counts the same three days as a 1-day streak on a daily schedule', () => {
    const done = new Set([MON, WED, FRI]);
    expect(currentStreak(DAILY, FRI, done)).toEqual({ value: 1, unit: 'day' });
  });
  it('does not treat an unfinished today as a break', () => {
    const done = new Set([MON, TUE, WED]);
    expect(currentStreak(DAILY, THU, done)).toEqual({ value: 3, unit: 'day' });
  });
  it('steps over a skipped day without extending the run', () => {
    // Skipping is a decision, not a failure — it neither breaks nor rewards.
    const done = new Set([MON, TUE, THU]);
    const skipped = new Set([WED]);
    expect(currentStreak(DAILY, THU, done, skipped)).toEqual({ value: 3, unit: 'day' });
  });
  it('stops at the day the habit was created, with no retroactive misses', () => {
    const done = new Set([WED, THU]);
    expect(currentStreak(DAILY, THU, done, new Set(), WED)).toEqual({ value: 2, unit: 'day' });
  });
  it('counts weeks, not days, for a weekly habit', () => {
    const done = new Set([MON, WED, FRI, '2026-07-20', '2026-07-22', '2026-07-24']);
    expect(currentStreak({ kind: 'weekly', count: 3 }, FRI, done)).toEqual({ value: 2, unit: 'week' });
  });
  it('does not punish a weekly habit for a week still in progress', () => {
    // Monday of a new week: last week hit its target, this one has 0 so far.
    const done = new Set(['2026-07-20', '2026-07-22', '2026-07-24']);
    expect(currentStreak({ kind: 'weekly', count: 3 }, MON, done)).toEqual({ value: 1, unit: 'week' });
  });
});

describe('bestStreak', () => {
  it('finds the longest run, not the current one', () => {
    const done = new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', FRI]);
    expect(bestStreak(DAILY, FRI, done).value).toBe(4);
  });
  it('is zero with nothing logged', () => {
    expect(bestStreak(DAILY, FRI, new Set())).toEqual({ value: 0, unit: 'day' });
  });
});

describe('consistency', () => {
  it('scores a perfectly-kept weekday habit at 100%, not 71%', () => {
    // The headline case. Over Mon–Fri of one week, a weekdays habit done every
    // weekday used to divide by 7 and report 71%.
    const done = new Set([MON, TUE, WED, THU, FRI]);
    const weekdays: HabitSchedule = { kind: 'days', days: [1, 2, 3, 4, 5] };
    const r = consistency(weekdays, FRI, done, new Set(), MON, 7);
    expect(r).toEqual({ pct: 100, done: 5, eligible: 5 });
  });
  it('counts every day for a daily habit', () => {
    const done = new Set([MON, TUE, WED, THU, FRI]);
    const r = consistency(DAILY, FRI, done, new Set(), MON, 7);
    expect(r).toEqual({ pct: 100, done: 5, eligible: 5 });
  });
  it('takes a skipped day out of the denominator instead of failing it', () => {
    const done = new Set([MON, TUE, THU, FRI]);
    const skipped = new Set([WED]);
    const r = consistency(DAILY, FRI, done, skipped, MON, 7);
    expect(r).toEqual({ pct: 100, done: 4, eligible: 4 });
  });
  it('counts a plain missed day', () => {
    const done = new Set([MON, TUE, THU, FRI]);
    const r = consistency(DAILY, FRI, done, new Set(), MON, 7);
    expect(r).toEqual({ pct: 80, done: 4, eligible: 5 });
  });
  it('never scores days before the habit existed', () => {
    // Created Thursday, done Thursday and Friday: 100%, not 29%.
    const done = new Set([THU, FRI]);
    const r = consistency(DAILY, FRI, done, new Set(), THU, 30);
    expect(r).toEqual({ pct: 100, done: 2, eligible: 2 });
  });
  it('returns 0/0 rather than dividing by zero when nothing is eligible', () => {
    const r = consistency(MWF, TUE, new Set(), new Set(), TUE, 1);
    expect(r).toEqual({ pct: 0, done: 0, eligible: 0 });
  });
  it('scores a weekly habit by whole finished weeks', () => {
    const done = new Set(['2026-07-20', '2026-07-22', '2026-07-24']);
    const r = consistency({ kind: 'weekly', count: 3 }, FRI, done, new Set(), '2026-07-20', 14);
    expect(r).toEqual({ pct: 100, done: 1, eligible: 1 });
  });
});

describe('weekStart', () => {
  it('walks back to Sunday', () => {
    expect(weekStart(WED)).toBe(SUN);
    expect(weekStart(SUN)).toBe(SUN);
  });
});
