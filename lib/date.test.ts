import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDay, formatDayWithWeekday, formatDayTime, formatClock, formatMinutes, minutesOfDayIn, parseClock, toClock, formatMonthYear, formatRelativeDay, formatAgo, formatWeekday, getWeekDays, weekRangeLabel, WEEK_STARTS_ON, startOfWeek, isoDateIn, todayISO, addDaysISO, readTimeZone, dayWindow } from './date';
import { weekDays, monthCells } from './calendar';

// These assertions used to have to pass `{ locale: 'en-GB' }` "so assertions are
// about OUR logic, not the runner's environment" — which was the bug in one
// line: the tests pinned a locale to be stable and the APP did not, so the app
// was exactly as environment-dependent as the tests would have been. The format
// is pinned in date.ts now (see the house-format note there), so there is
// nothing left to pin here and these assert the real production output.
// LOCAL calendar date, deliberately not `toISOString().slice(0,10)`.
// That returns the UTC date, so in a positive-offset zone shortly after local
// midnight the "today" fixture was yesterday's string and these tests failed
// for a whole timezone — while the code under test was right. A bare date is
// read as LOCAL midnight (see toDate), so the fixtures must be local too.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

afterEach(() => vi.useRealTimers());

describe('formatDay', () => {
  it('omits the year inside the current year', () => {
    const thisYear = `${new Date().getFullYear()}-06-02`;
    expect(formatDay(thisYear)).toBe('2 Jun');
  });

  it('includes the year outside it', () => {
    expect(formatDay('2019-06-02')).toBe('2 Jun 2019');
  });

  it('reads a bare date as LOCAL midnight, not UTC', () => {
    // The bug this guards: `new Date('2026-06-02')` is UTC midnight, which in
    // any negative-offset zone renders as 1 Jun — a date silently off by one.
    expect(formatDay('2026-06-02')).toMatch(/^2 Jun/);
  });

  it('returns undefined for absent or malformed input', () => {
    for (const v of [null, undefined, '', 'not-a-date']) expect(formatDay(v)).toBeUndefined();
  });
});

describe('formatRelativeDay', () => {
  it('names today, yesterday and tomorrow', () => {
    expect(formatRelativeDay(shift(0))).toBe('Today');
    expect(formatRelativeDay(shift(-1))).toBe('Yesterday');
    expect(formatRelativeDay(shift(1))).toBe('Tomorrow');
  });

  it('falls back to a plain date further out', () => {
    expect(formatRelativeDay(shift(9))).not.toMatch(/Today|Yesterday|Tomorrow/);
  });

  it('compares calendar days, not 24-hour spans', () => {
    // 23:30 today and 00:30 tomorrow are an hour apart but different days.
    vi.setSystemTime(new Date('2026-06-02T23:30:00'));
    expect(formatRelativeDay('2026-06-03T00:30:00')).toBe('Tomorrow');
  });
});

describe('formatAgo', () => {
  it('scales from days to weeks to a date', () => {
    expect(formatAgo(shift(0))).toBe('today');
    expect(formatAgo(shift(-1))).toBe('yesterday');
    expect(formatAgo(shift(-4))).toBe('4d ago');
    expect(formatAgo(shift(-14))).toBe('2w ago');
    expect(formatAgo(shift(-200))).toMatch(/\d/);
  });

  it('never says a future date was "ago"', () => {
    expect(formatAgo(shift(5))).not.toMatch(/ago/);
  });
});

describe('the other shapes', () => {
  it('formatDayWithWeekday leads with the weekday', () => {
    expect(formatDayWithWeekday('2026-06-02')).toBe('Tue 2 Jun');
  });

  it('formatMonthYear drops the day', () => {
    expect(formatMonthYear('2026-06-02')).toBe('Jun 2026');
  });

  it('formatWeekday returns the weekday alone, short or long', () => {
    expect(formatWeekday('2026-06-02')).toBe('Tue');
    expect(formatWeekday('2026-06-02', { weekday: 'long' })).toBe('Tuesday');
  });
});

describe('formatDay options', () => {
  it('spells the weekday out only when asked', () => {
    expect(formatDay('2026-06-02', { weekday: 'long' })).toBe('Tuesday 2 Jun');
    expect(formatDay('2026-06-02', { weekday: true })).toBe('Tue 2 Jun');
  });

  it('forces the year on for standalone record dates', () => {
    // Guards the portal: a client reading an invoice has no session context to
    // infer the year from, so `year: true` must survive the same-year shortcut.
    const thisYear = `${new Date().getFullYear()}-06-02`;
    expect(formatDay(thisYear)).toBe('2 Jun');
    expect(formatDay(thisYear, { year: true })).toBe(`2 Jun ${new Date().getFullYear()}`);
  });
});

describe('formatAgo precise', () => {
  it('resolves inside the day only when asked', () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00'));
    const twoHoursAgo = '2026-06-02T10:00:00';
    // A form list wants "today"; a client thread wants "2h ago".
    expect(formatAgo(twoHoursAgo)).toBe('today');
    expect(formatAgo(twoHoursAgo, { precise: true })).toBe('2h ago');
    expect(formatAgo('2026-06-02T11:59:40', { precise: true })).toBe('just now');
    expect(formatAgo('2026-06-02T11:45:00', { precise: true })).toBe('15m ago');
  });
});

describe('day ids', () => {
  it('is the LOCAL calendar date, not the UTC one', () => {
    // 01:00 on the 29th in IST is still the 28th in UTC — the exact window in
    // which Home used to show yesterday's tasks.
    vi.setSystemTime(new Date('2026-07-28T19:30:00Z')); // 01:00 IST on the 29th
    expect(isoDateIn(new Date(), 'Asia/Kolkata')).toBe('2026-07-29');
    expect(isoDateIn(new Date(), 'UTC')).toBe('2026-07-28');
    // And the other way: 18:00 on the 28th in Los Angeles is the 29th in UTC.
    vi.setSystemTime(new Date('2026-07-29T01:00:00Z'));
    expect(isoDateIn(new Date(), 'America/Los_Angeles')).toBe('2026-07-28');
    expect(isoDateIn(new Date(), 'UTC')).toBe('2026-07-29');
  });

  it('todayISO resolves the given zone', () => {
    vi.setSystemTime(new Date('2026-07-28T19:30:00Z'));
    expect(todayISO('Asia/Kolkata')).toBe('2026-07-29');
    expect(todayISO('UTC')).toBe('2026-07-28');
  });

  it('addDaysISO stays a calendar date across a DST boundary', () => {
    // 2026-03-08 is the US spring-forward; a naive +86400000ms lands on the 8th
    // again in a local-time reading. Calendar arithmetic must not care.
    expect(addDaysISO('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysISO('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('readTimeZone — the one reader of the stored zone', () => {
  it('returns a zone the runtime can use', () => {
    expect(readTimeZone({ timezone: 'Asia/Kolkata' })).toBe('Asia/Kolkata');
  });

  it('falls back to UTC — the old behaviour — for anything it cannot use', () => {
    // A damaged value used to throw a RangeError inside every server render
    // that asked what day it was, not just fall back.
    expect(readTimeZone({ timezone: 'Mars/Olympus_Mons' })).toBe('UTC');
    expect(readTimeZone({ timezone: '' })).toBe('UTC');
    expect(readTimeZone({ timezone: 42 })).toBe('UTC');
    expect(readTimeZone({})).toBe('UTC');
    expect(readTimeZone(null)).toBe('UTC');
    expect(readTimeZone('Asia/Kolkata')).toBe('UTC');   // the bag, not the value
  });

  it('never answers undefined, so no caller can fall through to the runtime zone', () => {
    // `undefined` meant "the runtime's zone": UTC on Cloudflare, IST on a
    // laptop — the same row naming a different day in dev and production.
    for (const v of [null, undefined, {}, { timezone: null }]) expect(readTimeZone(v)).toBeTypeOf('string');
  });
});

describe('dayWindow — the instants a calendar day spans', () => {
  const hours = (w: { startISO: string; endISO: string }) =>
    (Date.parse(w.endISO) - Date.parse(w.startISO)) / 3_600_000;

  it('starts at local midnight', () => {
    expect(dayWindow('2026-09-10', 'Asia/Kolkata'))
      .toEqual({ startISO: '2026-09-09T18:30:00.000Z', endISO: '2026-09-10T18:30:00.000Z' });
    expect(dayWindow('2026-09-10', 'UTC'))
      .toEqual({ startISO: '2026-09-10T00:00:00.000Z', endISO: '2026-09-11T00:00:00.000Z' });
  });

  it('is 23 hours on the spring-forward day and ends at the NEXT midnight', () => {
    // The old `start + 24h` ended at 01:00 on the 9th, so the first hour of
    // Monday's meetings were counted as Sunday's.
    const w = dayWindow('2026-03-08', 'America/Los_Angeles');
    expect(w).toEqual({ startISO: '2026-03-08T08:00:00.000Z', endISO: '2026-03-09T07:00:00.000Z' });
    expect(hours(w)).toBe(23);
    expect(hours(dayWindow('2026-03-29', 'Europe/London'))).toBe(23);
  });

  it('is 25 hours on the fall-back day', () => {
    const w = dayWindow('2026-11-01', 'America/Los_Angeles');
    expect(w).toEqual({ startISO: '2026-11-01T07:00:00.000Z', endISO: '2026-11-02T08:00:00.000Z' });
    expect(hours(w)).toBe(25);
  });

  it('begins at 01:00 in a zone whose clocks skip midnight itself', () => {
    // Santiago springs forward AT 00:00, so 6 September has no midnight; the
    // day's first instant is 01:00 -03. A single measurement of the offset
    // lands an hour early, inside the 5th.
    const w = dayWindow('2026-09-06', 'America/Santiago');
    expect(w.startISO).toBe('2026-09-06T04:00:00.000Z');
    expect(isoDateIn(new Date(w.startISO), 'America/Santiago')).toBe('2026-09-06');
    expect(isoDateIn(new Date(Date.parse(w.startISO) - 1), 'America/Santiago')).toBe('2026-09-05');
  });

  it('finds the start of a day that follows a fall-back across midnight', () => {
    // Santiago falls back at 24:00 on 4 April: 23:00–24:00 happens twice, and
    // the 5th begins at 00:00 -04. Measuring the offset once, at UTC midnight,
    // lands in the 4th's repeated hour — which is why there is a second pass.
    expect(dayWindow('2026-04-05', 'America/Santiago').startISO).toBe('2026-04-05T04:00:00.000Z');
    expect(hours(dayWindow('2026-04-04', 'America/Santiago'))).toBe(25);
  });

  it('tiles: each day ends exactly where the next begins', () => {
    for (const tz of ['Asia/Kolkata', 'America/Los_Angeles', 'Europe/London', 'America/Santiago']) {
      for (const day of ['2026-03-07', '2026-03-08', '2026-03-28', '2026-03-29', '2026-04-04', '2026-09-05', '2026-09-06', '2026-10-31', '2026-11-01']) {
        expect(dayWindow(day, tz).endISO).toBe(dayWindow(addDaysISO(day, 1), tz).startISO);
      }
    }
  });
});

// ── The house format ────────────────────────────────────────────────────────
// The bug these exist for: these formatters fell through to the AMBIENT locale,
// and a `'use client'` component is server-rendered before it is hydrated. So
// Node formatted with `en-US` ("Sep 4") and the browser re-rendered with the
// user's `en-GB` ("4 Sept") — a hydration mismatch on every page carrying a
// date. It was live on Horizon's goal cards.
//
// September is the load-bearing fixture: it is the one month whose three
// candidate renderings are all different, so a single assertion separates the
// house format from both locales that were fighting over it.
describe('the house format is pinned, not ambient', () => {
  it('renders September the house way, and neither locale’s way', () => {
    expect(formatDay('2026-09-04')).toBe('4 Sep');
    expect(formatDay('2026-09-04')).not.toBe('Sep 4');   // what the SERVER rendered
    expect(formatDay('2026-09-04')).not.toBe('4 Sept');  // what the BROWSER rendered
  });

  it('abbreviates every month to exactly three letters', () => {
    // en-GB and friends render September as "Sept" alone among its siblings,
    // which is why the order is ours and only the naming is ICU's.
    for (let m = 0; m < 12; m++) {
      const out = formatDay(`2026-${String(m + 1).padStart(2, '0')}-04`)!;
      expect(out.replace('4 ', ''), out).toHaveLength(3);
    }
  });

  it('always puts the day before the month', () => {
    expect(formatDay('2026-09-04')).toMatch(/^4 /);
    expect(formatDayWithWeekday('2026-09-04')).toBe('Fri 4 Sep');
    expect(formatDay('2026-09-04', { year: true })).toBe('4 Sep 2026');
  });

  it('does not consult the ambient locale', () => {
    // Node resolves ICU once at startup, so a test cannot change the ambient
    // locale mid-run — the honest proof is the comparison itself: format the
    // same instant the ambient way and show it disagrees with ours. On this
    // runner the ambient answer is "Sep 4"; on a `en-GB` machine it is
    // "4 Sept". Either way it is not "4 Sep", so no formatter can be reaching
    // for it and still pass.
    const ambient = new Date('2026-09-04T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    expect(formatDay('2026-09-04')).toBe('4 Sep');
    expect(ambient, 'ambient locale happens to match the house format — this test proves nothing on this runner').not.toBe('4 Sep');
  });

  it('keeps the clock 24-hour and zero-padded', () => {
    expect(formatClock('2026-09-04T18:05:00')).toBe('18:05');
    expect(formatClock('2026-09-04T06:05:00')).toBe('06:05');
    expect(formatDayTime('2026-09-04T18:05:00')).toBe('4 Sep, 18:05');
  });

  it('gives the week strip the same calendar as every task row', () => {
    // `getWeekDays` hardcoded `en-US`, so the week strip read "Jun 17" while a
    // task row beside it read "17 Jun". Deterministic, and still two calendars.
    const days = getWeekDays(new Date('2026-06-17T12:00:00Z'));
    expect(days).toHaveLength(7);
    expect(days[0].date).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
    expect(weekRangeLabel(days)).toBe('15 Jun – 21 Jun');
  });
});

describe('formatMinutes', () => {
  it('renders the short form a chip needs', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(600)).toBe('10h');
    expect(formatMinutes(605)).toBe('10h 5m');
  });

  it('renders the long form a sentence needs', () => {
    expect(formatMinutes(45, { long: true })).toBe('45 min');
    expect(formatMinutes(60, { long: true })).toBe('1 hour');
    expect(formatMinutes(120, { long: true })).toBe('2 hours');
    expect(formatMinutes(90, { long: true })).toBe('1 hour 30 min');
  });

  it('never renders a negative duration', () => {
    // Three of the six copies this replaced answered "-30m" here. A negative
    // duration is always a bug upstream, and "-30m" printed it into the UI.
    expect(formatMinutes(-30)).toBe('0m');
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(-30, { long: true })).toBe('0 min');
  });

  it('treats missing and unusable input as zero, not NaN', () => {
    // `Number(null)` is 0 but `Number(undefined)` is NaN, and a NaN reached the
    // money surface once already as "$0" — see lib/money.ts. Both answer "0m"
    // here; a caller that needs to distinguish "no estimate" shows a dash.
    expect(formatMinutes(null)).toBe('0m');
    expect(formatMinutes(undefined)).toBe('0m');
    expect(formatMinutes(Number.NaN)).toBe('0m');
  });

  it('rounds rather than truncating a fractional minute', () => {
    // Durations arrive as (endsAt − startsAt)/60000 in the capacity rule, which
    // is fractional whenever an event is not on a whole minute.
    expect(formatMinutes(89.6)).toBe('1h 30m');
    expect(formatMinutes(0.4)).toBe('0m');
  });
});

describe('minutesOfDayIn', () => {
  it('answers in the zone it is given, not the runtime\'s', () => {
    // 12:00 UTC is 17:30 in Kolkata and 08:00 in New York. This is the whole
    // reason the function takes a zone: a `'use client'` component is
    // server-rendered first, where `getHours()` answers UTC, and the browser
    // then re-renders with the user's real zone — a hydration mismatch for
    // everyone outside UTC. Passing the zone makes both sides agree.
    const noonUTC = '2026-08-05T12:00:00Z';
    expect(minutesOfDayIn(noonUTC, 'UTC')).toBe(12 * 60);
    expect(minutesOfDayIn(noonUTC, 'Asia/Kolkata')).toBe(17 * 60 + 30);
    expect(minutesOfDayIn(noonUTC, 'America/New_York')).toBe(8 * 60);
  });

  it('handles the midnight ends of the range', () => {
    expect(minutesOfDayIn('2026-08-05T00:00:00Z', 'UTC')).toBe(0);
    expect(minutesOfDayIn('2026-08-05T23:59:00Z', 'UTC')).toBe(1439);
  });

  it('returns undefined for unusable input rather than NaN minutes', () => {
    expect(minutesOfDayIn(null)).toBeUndefined();
    expect(minutesOfDayIn('nonsense')).toBeUndefined();
  });
});

describe('parseClock / toClock', () => {
  it('reads the HH:MM a time input produces', () => {
    expect(parseClock('09:00')).toBe(540);
    expect(parseClock('9:00')).toBe(540);
    expect(parseClock('18:30')).toBe(1110);
    expect(parseClock('00:00')).toBe(0);
  });

  it('rejects anything it cannot trust, so a bad setting falls back', () => {
    for (const bad of ['', '25:00', '12:60', 'noon', '1200', null, undefined, 540]) {
      expect(parseClock(bad as unknown), String(bad)).toBeUndefined();
    }
  });

  it('round-trips', () => {
    expect(toClock(540)).toBe('09:00');
    expect(toClock(1110)).toBe('18:30');
    expect(parseClock(toClock(831))).toBe(831);
  });

  it('wraps rather than emitting an out-of-range clock', () => {
    expect(toClock(1440)).toBe('00:00');
    expect(toClock(-60)).toBe('23:00');
  });
});

// ── One week start ──────────────────────────────────────────────────────────
// There were FOUR independent answers to "which day does a week begin on":
// `getWeekDays` (Monday), `monthGrid`'s default (Monday), the two week
// functions in lib/calendar.ts (Sunday, hardcoded), and the DS date-picker
// (whatever `navigator.language` said — undefined on the server, so Monday
// there and Sunday in a US browser). The visible symptom was Tasks → Week
// starting on Monday while Calendar → Week started on Sunday.
describe('the week starts on one day, everywhere', () => {
  it('is Monday', () => {
    expect(WEEK_STARTS_ON).toBe(1);
  });

  it('startOfWeek walks back to Monday from any day of the week', () => {
    // 2026-06-17 is a Wednesday; its Monday is the 15th.
    for (const [day, monday] of [
      ['2026-06-15', '2026-06-15'], // Monday itself stays put
      ['2026-06-17', '2026-06-15'],
      ['2026-06-21', '2026-06-15'], // Sunday belongs to the week that began Mon 15
    ] as const) {
      const s = startOfWeek(new Date(`${day}T12:00:00`));
      expect(`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`, day).toBe(monday);
    }
  });

  it('agrees with getWeekDays, which is what the Tasks week view draws', () => {
    const days = getWeekDays(new Date('2026-06-17T12:00:00Z'));
    expect(days[0].label).toBe('Mon');
    expect(days[6].label).toBe('Sun');
    // …and with the Calendar's own week, which used to start on Sunday.
    const cal = weekDays(new Date('2026-06-17T12:00:00'));
    expect(cal[0].getDay()).toBe(WEEK_STARTS_ON);
    expect(cal).toHaveLength(7);
  });

  it('monthCells still covers the whole month in 42 cells', () => {
    // The grid must not lose a day by moving its start — check a month whose
    // 1st falls on a Sunday, the worst case for a Monday-first grid.
    const cells = monthCells(new Date('2026-11-15T12:00:00')); // Nov 2026 starts Sun
    expect(cells).toHaveLength(42);
    const has = (d: string) => cells.some((c) =>
      `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}` === d);
    expect(has('2026-11-01'), 'first of the month').toBe(true);
    expect(has('2026-11-30'), 'last of the month').toBe(true);
    expect(cells[0].getDay()).toBe(WEEK_STARTS_ON);
  });
});
