import { describe, it, expect } from 'vitest';
import { mapGoogleEvents, gBody, isFatalGrantStatus, type GEvent } from './google-calendar';
import { eventsToIcs, type IcsEvent } from './ics';

// The Google integration had no tests at all, and the half that CAN be tested is
// the half where the bugs were: the mapping between Google's two event shapes and
// ours. The live OAuth handshake needs a real Google account's consent and is the
// one part a test cannot reach — so everything that does not need it is here.

const U = 'user-1';
const S = 'space-1';
const map = (items: GEvent[]) => mapGoogleEvents(items, U, S);

describe('mapGoogleEvents — timed events', () => {
  const timed: GEvent = {
    id: 'g1', summary: 'Client call',
    start: { dateTime: '2026-08-05T09:00:00Z' },
    end: { dateTime: '2026-08-05T10:00:00Z' },
  };

  it('carries the times through and marks it not-all-day', () => {
    expect(map([timed])[0]).toMatchObject({
      title: 'Client call', starts_at: '2026-08-05T09:00:00Z',
      ends_at: '2026-08-05T10:00:00Z', all_day: false,
      source: 'google', external_id: 'g1', user_id: U, space_id: S,
    });
  });

  it('keeps a timed event with no end rather than inventing one', () => {
    expect(map([{ ...timed, end: undefined }])[0].ends_at).toBeNull();
  });
});

describe('mapGoogleEvents — all-day events', () => {
  // Google tells the two shapes apart by WHICH FIELD IS PRESENT: `date` for
  // all-day, `dateTime` for timed. There is no flag.
  const oneDay: GEvent = { id: 'g2', summary: 'Holiday', start: { date: '2026-08-10' }, end: { date: '2026-08-11' } };
  const threeDay: GEvent = { id: 'g3', summary: 'Conference', start: { date: '2026-08-10' }, end: { date: '2026-08-13' } };

  it('recognises an all-day event', () => {
    expect(map([oneDay])[0]).toMatchObject({ all_day: true, starts_at: '2026-08-10T00:00:00.000Z' });
  });

  // THE BUG THIS FILE WAS WRITTEN FOR. An all-day event used to get `ends_at:
  // null` unconditionally, so a three-day conference arrived as one day.
  it('keeps the END of a multi-day all-day event', () => {
    expect(map([threeDay])[0].ends_at).toBe('2026-08-13T00:00:00.000Z');
  });

  it('treats the end as EXCLUSIVE, the way Google and ICS both do', () => {
    // 10th → 13th exclusive is the 10th, 11th and 12th: three days.
    const row = map([threeDay])[0];
    const days = (Date.parse(row.ends_at!) - Date.parse(row.starts_at)) / 86400000;
    expect(days).toBe(3);
  });

  it('survives an all-day event with no end', () => {
    expect(map([{ ...oneDay, end: undefined }])[0].ends_at).toBeNull();
  });

  it('is all-day even when Google sends both, because `date` decides', () => {
    const both: GEvent = { id: 'g4', start: { date: '2026-08-10', dateTime: '2026-08-10T00:00:00Z' }, end: { date: '2026-08-11' } };
    // `dateTime` present means Google considers it timed — the mapping follows
    // Google rather than guessing, so this is deliberately NOT all-day.
    expect(map([both])[0].all_day).toBe(false);
  });
});

describe('mapGoogleEvents — the rows it refuses', () => {
  it('drops cancelled events', () => {
    expect(map([{ id: 'g5', status: 'cancelled', summary: 'Gone', start: { dateTime: '2026-08-05T09:00:00Z' } }])).toEqual([]);
  });

  it('drops an event with no start at all', () => {
    expect(map([{ id: 'g6', summary: 'Malformed' }])).toEqual([]);
  });

  it('handles an empty response', () => {
    expect(map([])).toEqual([]);
  });
});

describe('mapGoogleEvents — titles', () => {
  const at = (summary?: string) => map([{ id: 'g7', summary, start: { dateTime: '2026-08-05T09:00:00Z' } }])[0].title;

  it('falls back for a missing or blank title', () => {
    expect(at(undefined)).toBe('(no title)');
    expect(at('   ')).toBe('(no title)');
  });

  it('trims, and caps a runaway title', () => {
    expect(at('  Spaced  ')).toBe('Spaced');
    expect(at('x'.repeat(900))).toHaveLength(500);
  });
});

describe('gBody — writing back to Google', () => {
  it('sends a timed event as dateTime, defaulting an hour when there is no end', () => {
    expect(gBody({ title: 'Call', startsAt: '2026-08-05T09:00:00.000Z', endsAt: null, allDay: false }))
      .toEqual({ summary: 'Call', start: { dateTime: '2026-08-05T09:00:00.000Z' }, end: { dateTime: '2026-08-05T10:00:00.000Z' } });
  });

  it('sends an all-day event as exclusive dates', () => {
    expect(gBody({ title: 'Holiday', startsAt: '2026-08-10T00:00:00.000Z', endsAt: null, allDay: true }))
      .toEqual({ summary: 'Holiday', start: { date: '2026-08-10' }, end: { date: '2026-08-11' } });
  });

  // The mirror of the read-path bug: this hard-coded one day, so pushing a
  // multi-day event to Google silently shortened it. Both directions were wrong
  // together, which is exactly why the round trip looked consistent.
  it('KEEPS the span of a multi-day all-day event', () => {
    expect(gBody({ title: 'Conference', startsAt: '2026-08-10T00:00:00.000Z', endsAt: '2026-08-13T00:00:00.000Z', allDay: true }))
      .toMatchObject({ start: { date: '2026-08-10' }, end: { date: '2026-08-13' } });
  });

  it('repairs an end that is missing or before the start', () => {
    const backwards = gBody({ title: 'X', startsAt: '2026-08-10T00:00:00.000Z', endsAt: '2026-08-01T00:00:00.000Z', allDay: true });
    expect(backwards).toMatchObject({ end: { date: '2026-08-11' } });
  });
});

// The read path and the feed have to agree, or a Google event lands in the
// subscribed calendar with a different span than it had in Google.
describe('a Google all-day event survives the round trip into the feed', () => {
  it('keeps all three days', () => {
    const row = map([{ id: 'g8', summary: 'Conference', start: { date: '2026-08-10' }, end: { date: '2026-08-13' } }])[0];
    const ics = eventsToIcs([{
      id: row.external_id!, title: row.title, starts_at: row.starts_at, ends_at: row.ends_at, all_day: row.all_day,
    } as IcsEvent], 'Zenboard', new Date('2026-08-04T12:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20260810');
    expect(ics).toContain('DTEND;VALUE=DATE:20260813');
  });
});

// Found live: a connection made in July still existed, but Google answered
// `invalid_grant` to every refresh. Nothing cleared it, so each sync spent a
// round trip to be told the same thing and the user was never told to reconnect.
describe('isFatalGrantStatus — which refresh failures are permanent', () => {
  it('treats a revoked or expired grant as fatal', () => {
    // The exact response the live probe got back.
    expect(isFatalGrantStatus(400, '{"error":"invalid_grant","error_description":"Bad Request"}')).toBe(true);
    expect(isFatalGrantStatus(401, '{"error":"invalid_client"}')).toBe(true);
    expect(isFatalGrantStatus(400, '{"error":"unauthorized_client"}')).toBe(true);
  });

  // The costly direction: a flaky minute must never sign someone out of their
  // calendar and make them re-consent.
  it('treats Google having a bad minute as transient', () => {
    expect(isFatalGrantStatus(500, 'internal error')).toBe(false);
    expect(isFatalGrantStatus(503, '')).toBe(false);
    expect(isFatalGrantStatus(429, 'rate limited')).toBe(false);
  });

  it('does not guess from a status alone', () => {
    // A 400 without a recognised reason is not evidence the grant is dead.
    expect(isFatalGrantStatus(400, '{"error":"invalid_request"}')).toBe(false);
    expect(isFatalGrantStatus(400, '')).toBe(false);
    expect(isFatalGrantStatus(403, '{"error":"invalid_grant"}')).toBe(false);
  });
});
