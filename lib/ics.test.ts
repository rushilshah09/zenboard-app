import { describe, it, expect } from 'vitest';
import { eventsToIcs, icsText, foldLine, type IcsEvent } from './ics';

const NOW = new Date('2026-07-24T09:00:00Z');
const ics = (events: IcsEvent[]) => eventsToIcs(events, 'Zenboard', NOW);
// Parse folded output back into logical lines (unfold per RFC 5545).
const lines = (s: string) => s.replace(/\r\n[ \t]/g, '').split('\r\n');

const timed: IcsEvent = { id: 'e1', title: 'Deep work', starts_at: '2026-07-24T11:00:00Z', ends_at: '2026-07-24T13:00:00Z', all_day: false };
const allday: IcsEvent = { id: 'e2', title: 'Ship v0.9', starts_at: '2026-07-25T00:00:00Z', ends_at: null, all_day: true };

describe('icsText escaping (RFC 5545 §3.3.11)', () => {
  it('escapes backslash, semicolon, comma, and newlines', () => {
    expect(icsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
  it('leaves plain text untouched', () => {
    expect(icsText('Deep work')).toBe('Deep work');
  });
});

describe('foldLine (RFC 5545 §3.1)', () => {
  it('leaves lines ≤75 chars unchanged', () => {
    const s = 'SUMMARY:short';
    expect(foldLine(s)).toBe(s);
  });
  it('folds long lines with CRLF + a leading space, unfolding to the original', () => {
    const long = 'SUMMARY:' + 'x'.repeat(120);
    const folded = foldLine(long);
    expect(folded).toContain('\r\n ');
    expect(folded.split('\r\n')[0].length).toBe(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long); // unfolds cleanly
  });
});

describe('eventsToIcs — structure', () => {
  it('wraps events in a VCALENDAR with required headers and CRLF endings', () => {
    const out = ics([timed]);
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const L = lines(out);
    expect(L).toContain('VERSION:2.0');
    expect(L).toContain('PRODID:-//Zenboard//Calendar Export//EN');
    expect(L).toContain('CALSCALE:GREGORIAN');
    expect(L).toContain('X-WR-CALNAME:Zenboard');
  });
  it('emits a valid empty calendar when there are no events', () => {
    const L = lines(ics([]));
    expect(L.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(0);
    expect(L[0]).toBe('BEGIN:VCALENDAR');
    expect(L.at(-2)).toBe('END:VCALENDAR');
  });
});

describe('eventsToIcs — timed events', () => {
  it('writes UTC DTSTART/DTEND and a stamped UID', () => {
    const L = lines(ics([timed]));
    expect(L).toContain('BEGIN:VEVENT');
    expect(L).toContain('UID:e1@zenboard.app');
    expect(L).toContain('DTSTAMP:20260724T090000Z');
    expect(L).toContain('DTSTART:20260724T110000Z');
    expect(L).toContain('DTEND:20260724T130000Z');
    expect(L).toContain('SUMMARY:Deep work');
  });
  it('defaults a 1-hour span when ends_at is missing', () => {
    const L = lines(ics([{ ...timed, ends_at: null }]));
    expect(L).toContain('DTSTART:20260724T110000Z');
    expect(L).toContain('DTEND:20260724T120000Z');
  });
});

describe('eventsToIcs — all-day events', () => {
  it('uses VALUE=DATE and an exclusive next-day DTEND', () => {
    const L = lines(ics([allday]));
    expect(L).toContain('DTSTART;VALUE=DATE:20260725');
    expect(L).toContain('DTEND;VALUE=DATE:20260726');
  });
  it('never emits a zero-length span when ends_at is the same day', () => {
    const L = lines(ics([{ ...allday, ends_at: '2026-07-25T00:00:00Z' }]));
    expect(L).toContain('DTSTART;VALUE=DATE:20260725');
    expect(L).toContain('DTEND;VALUE=DATE:20260726');
  });
});

describe('eventsToIcs — edges', () => {
  it('escapes the summary and falls back to "Untitled" for null titles', () => {
    const L = lines(ics([{ id: 'e3', title: 'Call Sam; re: pricing, v2', starts_at: '2026-07-24T15:00:00Z', ends_at: null, all_day: false }, { id: 'e4', title: null, starts_at: '2026-07-24T16:00:00Z', ends_at: null, all_day: false }]));
    expect(L).toContain('SUMMARY:Call Sam\\; re: pricing\\, v2');
    expect(L).toContain('SUMMARY:Untitled');
  });
  it('skips rows with no start and keeps one VEVENT per real event (unique UIDs)', () => {
    const out = ics([timed, allday, { ...timed, id: 'e9', starts_at: '' }]);
    const L = lines(out);
    expect(L.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(L).toContain('UID:e1@zenboard.app');
    expect(L).toContain('UID:e2@zenboard.app');
    expect(L).not.toContain('UID:e9@zenboard.app');
  });
});
