import { describe, it, expect } from 'vitest';
import {
  readVacationUntil, onVacation, vacationThrough, vacationDaysIn, ritualPromptsAllowed,
} from './vacation';
import { currentStreak, type HabitSchedule } from './habit-schedule';
import { addDaysISO } from './date';

const DAILY: HabitSchedule = { kind: 'daily' };

describe('readVacationUntil', () => {
  it('is null when nothing is stored', () => {
    expect(readVacationUntil(null)).toBeNull();
    expect(readVacationUntil({})).toBeNull();
    expect(readVacationUntil({ digest: {} })).toBeNull();
  });

  it('reads the date the digest pane wrote', () => {
    expect(readVacationUntil({ digest: { vacationUntil: '2026-08-12' } })).toBe('2026-08-12');
  });

  it('ignores anything that is not a calendar date', () => {
    // A malformed value must not silence the product indefinitely.
    for (const bad of ['next week', '2026-8-1', 12, true, null]) {
      expect(readVacationUntil({ digest: { vacationUntil: bad } }), String(bad)).toBeNull();
    }
  });
});

describe('onVacation', () => {
  it('includes the last day', () => {
    // "Back on the 12th" means the 11th is still theirs; an off-by-one here is
    // a nagging notification on a holiday.
    expect(onVacation('2026-08-11', '2026-08-11')).toBe(true);
    expect(onVacation('2026-08-12', '2026-08-11')).toBe(false);
  });

  it('is false with no vacation set', () => {
    expect(onVacation('2026-08-11', null)).toBe(false);
  });
});

describe('vacationThrough', () => {
  it('counts today as day one', () => {
    expect(vacationThrough('2026-08-06', 1)).toBe('2026-08-06');
    expect(vacationThrough('2026-08-06', 7)).toBe('2026-08-12');
  });
  it('crosses a month end', () => {
    expect(vacationThrough('2026-08-30', 5)).toBe('2026-09-03');
  });
  it('refuses nonsense rather than silencing forever', () => {
    expect(vacationThrough('2026-08-06', 0)).toBeNull();
    expect(vacationThrough('2026-08-06', Number.NaN)).toBeNull();
  });
});

describe('vacationDaysIn', () => {
  it('lists only the days inside BOTH the window and the vacation', () => {
    expect(vacationDaysIn('2026-08-04', '2026-08-08', '2026-08-06'))
      .toEqual(['2026-08-04', '2026-08-05', '2026-08-06']);
  });

  it('is bounded by the window, so a far-future date cannot widen the walk', () => {
    // The guard is the caller's window, never the stored value — a vacation set
    // to 2099 must not make the streak walk loop for 26,000 days.
    expect(vacationDaysIn('2026-08-05', '2026-08-07', '2099-01-01'))
      .toEqual(['2026-08-05', '2026-08-06', '2026-08-07']);
  });

  it('is empty with no vacation, or an inverted window', () => {
    expect(vacationDaysIn('2026-08-04', '2026-08-08', null)).toEqual([]);
    expect(vacationDaysIn('2026-08-08', '2026-08-04', '2026-08-06')).toEqual([]);
  });
});

describe('ritualPromptsAllowed', () => {
  it('goes quiet while away and speaks again after', () => {
    expect(ritualPromptsAllowed('2026-08-06', '2026-08-08')).toBe(false);
    expect(ritualPromptsAllowed('2026-08-09', '2026-08-08')).toBe(true);
    expect(ritualPromptsAllowed('2026-08-06', null)).toBe(true);
  });
});

describe('"without loss" — the promise that actually matters (§7C)', () => {
  // The point of vacation mode is not the silence, it is that a week away does
  // not cost a long streak. `skipped` already meant "not judged" in
  // lib/habit-schedule.ts and nothing had ever passed anything into it.
  // Local parts, never `toISOString().slice(0, 10)` — that is the UTC date, so
  // in a positive-offset zone this helper would build the day BEFORE each one
  // it means and the fixture would silently describe a different week. (It did,
  // on the first run of this very test.)
  const days = (from: string, n: number) =>
    Array.from({ length: n }, (_, i) => addDaysISO(from, i));

  it('a week away does NOT break a run', () => {
    // Done every day up to the 1st, away the 2nd–8th, done again on the 9th.
    const done = new Set([...days('2026-07-26', 7), '2026-08-09']);
    const away = vacationDaysIn('2026-08-02', '2026-08-08', '2026-08-08');
    const broken = currentStreak(DAILY, '2026-08-09', done);
    const kept = currentStreak(DAILY, '2026-08-09', done, new Set(away));
    expect(broken.value).toBe(1);          // without vacation: the run is gone
    expect(kept.value).toBe(8);            // with it: the run survives the week
  });

  it('does NOT credit the days away as completions', () => {
    // The other half of "without loss": a holiday must not inflate a streak
    // either. Seven days away with nothing done before them is still zero.
    const away = vacationDaysIn('2026-08-02', '2026-08-08', '2026-08-08');
    expect(currentStreak(DAILY, '2026-08-08', new Set(), new Set(away)).value).toBe(0);
  });
});
