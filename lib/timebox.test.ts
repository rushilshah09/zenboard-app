import { describe, it, expect } from 'vitest';
import {
  timeboxMinutes, timeboxRange, timeboxDay, isTwin, isTwinDone, syncsToGoogle,
  DEFAULT_TIMEBOX_MINUTES, MIN_TIMEBOX_MINUTES, MAX_TIMEBOX_MINUTES, TWIN_SOURCE,
} from './timebox';

describe('timeboxMinutes', () => {
  it('uses the estimate when there is one', () => {
    expect(timeboxMinutes(45)).toBe(45);
    expect(timeboxMinutes(90)).toBe(90);
  });

  it('falls back to 30 minutes, not an hour', () => {
    // An hour-shaped default makes five small tasks look like a full day, and
    // the capacity line (§7C) then lies about whether the plan fits.
    expect(DEFAULT_TIMEBOX_MINUTES).toBe(30);
    for (const v of [null, undefined, 0]) expect(timeboxMinutes(v)).toBe(30);
  });

  it('clamps junk rather than producing a block that breaks the grid', () => {
    expect(timeboxMinutes(-20)).toBe(DEFAULT_TIMEBOX_MINUTES);   // negative → not an estimate
    expect(timeboxMinutes(2)).toBe(MIN_TIMEBOX_MINUTES);         // shorter than its own label
    expect(timeboxMinutes(6000)).toBe(MAX_TIMEBOX_MINUTES);      // a project, not a task
    expect(timeboxMinutes(NaN)).toBe(DEFAULT_TIMEBOX_MINUTES);
    expect(timeboxMinutes(Infinity)).toBe(DEFAULT_TIMEBOX_MINUTES);
  });

  it('rounds a fractional estimate', () => {
    expect(timeboxMinutes(45.4)).toBe(45);
  });
});

describe('timeboxRange', () => {
  it('ends the estimate later', () => {
    const r = timeboxRange('2026-08-03T09:00:00.000Z', 45)!;
    expect(r.startsAt).toBe('2026-08-03T09:00:00.000Z');
    expect(r.endsAt).toBe('2026-08-03T09:45:00.000Z');
  });

  it('uses the default length when the task has no estimate', () => {
    const r = timeboxRange('2026-08-03T09:00:00.000Z', null)!;
    expect(r.endsAt).toBe('2026-08-03T09:30:00.000Z');
  });

  it('crosses midnight without wrapping', () => {
    const r = timeboxRange('2026-08-03T23:45:00.000Z', 60)!;
    expect(r.endsAt).toBe('2026-08-04T00:45:00.000Z');
  });

  it('refuses an unparseable instant instead of emitting an Invalid Date', () => {
    expect(timeboxRange('not-a-time', 30)).toBeNull();
    expect(timeboxRange('', 30)).toBeNull();
  });
});

describe('timeboxDay', () => {
  // THE trap this feature could ship: `scheduled_date` is a CALENDAR date in the
  // user's zone, the event is an absolute instant. A naive
  // `toISOString().slice(0,10)` reports the UTC day, so an evening block in
  // Asia/Kolkata would schedule the task for the day before.
  it('reads the day where the USER is, not in UTC', () => {
    // 20:30 in Kolkata on 3 Aug is 15:00Z on 3 Aug — same day either way.
    expect(timeboxDay('2026-08-03T15:00:00.000Z', 'Asia/Kolkata')).toBe('2026-08-03');
    // 01:00 on 4 Aug in Kolkata is 19:30Z on 3 Aug — UTC would say the 3rd.
    expect(timeboxDay('2026-08-03T19:30:00.000Z', 'Asia/Kolkata')).toBe('2026-08-04');
  });

  it('handles a zone behind UTC too', () => {
    // 21:00 on 3 Aug in New York is 01:00Z on 4 Aug — UTC would say the 4th.
    expect(timeboxDay('2026-08-04T01:00:00.000Z', 'America/New_York')).toBe('2026-08-03');
  });
});

describe('twin predicates', () => {
  it('only a linked block is a twin', () => {
    expect(isTwin({ task_id: 't1' })).toBe(true);
    expect(isTwin({ task_id: null })).toBe(false);
    expect(isTwin({})).toBe(false);
    expect(isTwin(null)).toBe(false);
  });

  it('an ordinary event can never read as done — it has no completion to show', () => {
    expect(isTwinDone({ task_id: 't1', task_done: true })).toBe(true);
    expect(isTwinDone({ task_id: 't1', task_done: false })).toBe(false);
    // A stray task_done on a non-twin must not strike an ordinary event through.
    expect(isTwinDone({ task_id: null, task_done: true })).toBe(false);
  });
});

describe('syncsToGoogle', () => {
  it('excludes twins and nothing else', () => {
    // A timebox is a private planning artefact. Pushing "Write the brief · 30m"
    // to a shared work calendar broadcasts your to-do list to your colleagues.
    expect(syncsToGoogle(TWIN_SOURCE)).toBe(false);
    expect(syncsToGoogle('manual')).toBe(true);
    expect(syncsToGoogle('google')).toBe(true);
    expect(syncsToGoogle(null)).toBe(true);
  });
});
