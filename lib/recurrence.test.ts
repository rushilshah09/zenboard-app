// The recurrence contract, executable (MASTER_PRODUCT_PLAN §7B: "recurrence
// contract hardened and documented … `every` vs `every!` semantics tested").
// Pure — no date mocking needed; base and completion dates are inputs.
import { describe, it, expect } from 'vitest';
import { parseRecurrence, nextOccurrence, describeRecurrence, type Recurrence } from './recurrence';

const next = (rec: Recurrence, base: string | null, completed: string) =>
  nextOccurrence(rec, base, completed)?.dateISO ?? null;

describe('parseRecurrence (jsonb validation)', () => {
  it('accepts legacy { freq } rows', () => {
    expect(parseRecurrence({ freq: 'weekly' })).toEqual({ freq: 'weekly' });
    expect(parseRecurrence({ freq: 'daily', spawned: true })).toEqual({ freq: 'daily', spawned: true });
  });
  it('rejects junk', () => {
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence('weekly')).toBeNull();
    expect(parseRecurrence({ freq: 'fortnightly' })).toBeNull();
    expect(parseRecurrence({})).toBeNull();
  });
  it('drops out-of-range fields but keeps the freq', () => {
    expect(parseRecurrence({ freq: 'weekly', byday: 9, interval: 1 })).toEqual({ freq: 'weekly' });
  });
});

describe('every (fixed cadence) — grid anchored at the scheduled date', () => {
  it('daily: completed on time → next day', () => {
    expect(next({ freq: 'daily' }, '2026-07-20', '2026-07-20')).toBe('2026-07-21');
  });
  it('daily: completed LATE → skips the missed days, never stacks', () => {
    // Scheduled Jul 15, completed Jul 20 → next is Jul 21, not Jul 16.
    expect(next({ freq: 'daily' }, '2026-07-15', '2026-07-20')).toBe('2026-07-21');
  });
  it('daily: completed EARLY (future-scheduled) → stays on grid after the base', () => {
    expect(next({ freq: 'daily' }, '2026-07-25', '2026-07-20')).toBe('2026-07-26');
  });
  it('every 3 days keeps its phase when completed late', () => {
    // Grid: Jul 10, 13, 16, 19, 22… completed Jul 20 → Jul 22 (still on grid).
    expect(next({ freq: 'daily', interval: 3 }, '2026-07-10', '2026-07-20')).toBe('2026-07-22');
  });
  it('weekly with byday: stays on Friday even when completed on a Monday', () => {
    // 2026-07-17 is a Friday; completed late on Mon Jul 20 → Fri Jul 24.
    expect(next({ freq: 'weekly', byday: 5 }, '2026-07-17', '2026-07-20')).toBe('2026-07-24');
  });
  it('weekly without byday: anchors to the base weekday and persists it', () => {
    const r = nextOccurrence({ freq: 'weekly' }, '2026-07-17', '2026-07-17'); // a Friday
    expect(r?.dateISO).toBe('2026-07-24');
    expect(r?.recurrence.byday).toBe(5); // anchor now sticks
  });
  it('weekly rescheduled off its weekday snaps back to the anchor day', () => {
    // Anchor byday Friday, but the instance drifted to Tue Jul 21.
    expect(next({ freq: 'weekly', byday: 5 }, '2026-07-21', '2026-07-21')).toBe('2026-07-24');
  });
  it('every 2 weeks walks a 14-day grid', () => {
    expect(next({ freq: 'weekly', byday: 5, interval: 2 }, '2026-07-17', '2026-07-17')).toBe('2026-07-31');
    // Completed very late (5 weeks): first grid point after completion.
    expect(next({ freq: 'weekly', byday: 5, interval: 2 }, '2026-07-17', '2026-08-21')).toBe('2026-08-28');
  });
  it('monthly: clamps short months but keeps the anchor day', () => {
    const jan = nextOccurrence({ freq: 'monthly' }, '2026-01-31', '2026-01-31');
    expect(jan?.dateISO).toBe('2026-02-28'); // 2026 is not a leap year
    expect(jan?.recurrence.bymonthday).toBe(31); // anchor preserved…
    const feb = nextOccurrence(jan!.recurrence, '2026-02-28', '2026-02-28');
    expect(feb?.dateISO).toBe('2026-03-31'); // …so March snaps back to the 31st
  });
  it('monthly completed months late → first month strictly after completion', () => {
    expect(next({ freq: 'monthly' }, '2026-01-15', '2026-04-20')).toBe('2026-05-15');
  });
  it('yearly: Feb 29 anchors clamp on non-leap years', () => {
    expect(next({ freq: 'yearly' }, '2024-02-29', '2024-02-29')).toBe('2025-02-28');
  });
  it('weekdays: Fri → Mon, mid-week → next day', () => {
    expect(next({ freq: 'weekdays' }, '2026-07-17', '2026-07-17')).toBe('2026-07-20'); // Fri → Mon
    expect(next({ freq: 'weekdays' }, '2026-07-21', '2026-07-21')).toBe('2026-07-22'); // Tue → Wed
  });
  it('weekdays completed on Saturday → Monday', () => {
    expect(next({ freq: 'weekdays' }, '2026-07-17', '2026-07-18')).toBe('2026-07-20');
  });
});

describe('every! (after completion) — cadence restarts from the day it was done', () => {
  it('every! 3 days from the completion day, not the scheduled day', () => {
    // Scheduled Jul 15, actually done Jul 20 → Jul 23 (not Jul 18).
    expect(next({ freq: 'daily', interval: 3, afterCompletion: true }, '2026-07-15', '2026-07-20')).toBe('2026-07-23');
  });
  it('every! week lands 7 days after completion', () => {
    expect(next({ freq: 'weekly', afterCompletion: true }, '2026-07-01', '2026-07-20')).toBe('2026-07-27');
  });
  it('every! month lands one month after completion', () => {
    expect(next({ freq: 'monthly', afterCompletion: true }, '2026-01-10', '2026-07-20')).toBe('2026-08-20');
  });
});

describe('contract guards', () => {
  it('spawned tasks never spawn again', () => {
    expect(nextOccurrence({ freq: 'daily', spawned: true }, '2026-07-20', '2026-07-20')).toBeNull();
  });
  it('the spawned flag is not carried onto the next occurrence', () => {
    const r = nextOccurrence({ freq: 'daily' }, '2026-07-20', '2026-07-20');
    expect(r?.recurrence.spawned).toBeUndefined();
  });
  it('inbox (unscheduled) recurring tasks anchor on the completion day', () => {
    expect(next({ freq: 'daily' }, null, '2026-07-20')).toBe('2026-07-21');
    expect(next({ freq: 'weekly' }, null, '2026-07-20')).toBe('2026-07-27');
  });
  it('the result is always strictly after the completion day', () => {
    const recs: Recurrence[] = [
      { freq: 'daily' }, { freq: 'weekdays' }, { freq: 'weekly', byday: 3 },
      { freq: 'monthly' }, { freq: 'yearly' }, { freq: 'daily', interval: 5, afterCompletion: true },
    ];
    for (const rec of recs) {
      for (const base of ['2026-07-01', '2026-07-20', '2026-08-04', null]) {
        const d = next(rec, base, '2026-07-20');
        expect(d! > '2026-07-20').toBe(true);
      }
    }
  });
});

describe('describeRecurrence (chip labels, sentence case)', () => {
  it.each([
    [{ freq: 'daily' }, 'Every day'],
    [{ freq: 'daily', interval: 3 }, 'Every 3 days'],
    [{ freq: 'weekdays' }, 'Weekdays'],
    [{ freq: 'weekly' }, 'Every week'],
    [{ freq: 'weekly', byday: 5 }, 'Every Friday'],
    [{ freq: 'weekly', byday: 1, interval: 2 }, 'Every 2 weeks on Monday'],
    [{ freq: 'monthly' }, 'Every month'],
    [{ freq: 'yearly' }, 'Every year'],
    [{ freq: 'daily', interval: 3, afterCompletion: true }, 'Every 3 days after done'],
  ] as [Recurrence, string][])('%j → %s', (rec, label) => {
    expect(describeRecurrence(rec)).toBe(label);
  });
});
