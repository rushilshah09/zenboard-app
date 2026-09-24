import { describe, it, expect } from 'vitest';
import { todaysPlanFilter, isOnTodaysPlan } from './todays-plan';

const TODAY = '2026-09-10';

describe("today's plan — one rule in two shapes", () => {
  it('holds a task scheduled today, and an undated ★', () => {
    expect(isOnTodaysPlan({ scheduled_date: TODAY }, TODAY)).toBe(true);
    // The ★ is "the day's one important thing": undated, it belongs to today.
    expect(isOnTodaysPlan({ scheduled_date: null, highlight: true }, TODAY)).toBe(true);
  });

  it('does not pull a ★ off the day someone gave it', () => {
    expect(isOnTodaysPlan({ scheduled_date: '2026-09-12', highlight: true }, TODAY)).toBe(false);
  });

  it('leaves an undated, unstarred task in the Inbox where it is', () => {
    expect(isOnTodaysPlan({ scheduled_date: null, highlight: false }, TODAY)).toBe(false);
    expect(isOnTodaysPlan({ scheduled_date: null }, TODAY)).toBe(false);
  });

  it('is the same rule as the query clause', () => {
    // The two shapes sit side by side so they cannot drift; this is the check
    // that they have not. Each clause of the `or()` is one branch of the JS.
    const f = todaysPlanFilter(TODAY);
    expect(f).toBe(`scheduled_date.eq.${TODAY},and(highlight.eq.true,scheduled_date.is.null)`);
    expect(f.split(',and(')).toHaveLength(2);
  });
});
