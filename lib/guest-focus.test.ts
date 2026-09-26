import { describe, expect, it } from 'vitest';
import {
  GUEST_LIMITS, addGuestSession, clockText, focusNote, focusedMs, pauseClock, readGuestSessions, remainingMs, resumeClock,
  sanitizeGuestSessions, sessionOf, sessionsOnDay, startClock,
} from './guest-focus';

// What a visitor focuses on before signing in becomes their account's focus time. Anything read from
// a browser can be edited, so the rules are tested as the server applies them: only real, recent,
// sensible sessions get through, and never the same one twice.

const NOW = new Date('2026-09-26T15:00:00Z');
const at = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();

describe('what a session must be', () => {
  it('keeps real sessions, oldest first', () => {
    const got = sanitizeGuestSessions([{ startedAt: at(1), minutes: 25, what: 'Logo' }, { startedAt: at(3), minutes: 50, what: '' }], NOW);
    expect(got.map((s) => s.minutes)).toEqual([50, 25]);
  });

  it('drops what cannot be true: too short, too long, too old, in the future, not a date', () => {
    const got = sanitizeGuestSessions([
      { startedAt: at(1), minutes: 0 },
      { startedAt: at(1), minutes: GUEST_LIMITS.maxMinutes + 1 },
      { startedAt: at(24 * (GUEST_LIMITS.days + 1)), minutes: 25 },
      { startedAt: new Date(NOW.getTime() + 60_000).toISOString(), minutes: 25 },
      { startedAt: 'yesterday', minutes: 25 },
      { startedAt: at(2), minutes: '25' },
      null, 'x', 42,
    ], NOW);
    expect(got).toEqual([]);
  });

  it('never counts one session twice', () => {
    const s = { startedAt: at(1), minutes: 25, what: 'Logo' };
    expect(sanitizeGuestSessions([s, s, { ...s, what: 'other' }], NOW)).toHaveLength(1);
  });

  it('keeps notes short and plain, and keeps at most the newest fifty', () => {
    const [one] = sanitizeGuestSessions([{ startedAt: at(1), minutes: 25, what: `  a\n\nb ${'x'.repeat(500)}` }], NOW);
    expect(one.what.startsWith('a b ')).toBe(true);
    expect(one.what.length).toBe(GUEST_LIMITS.what);
    const many = Array.from({ length: 80 }, (_, i) => ({ startedAt: at(i + 1), minutes: 25, what: '' }));
    const kept = sanitizeGuestSessions(many, NOW);
    expect(kept).toHaveLength(GUEST_LIMITS.sessions);
    expect(kept.at(-1)?.startedAt).toBe(at(1));
  });
});

describe('on the device', () => {
  it('reads nothing, not an error, from missing or edited storage', () => {
    expect(readGuestSessions(null, NOW)).toEqual([]);
    expect(readGuestSessions('{nope', NOW)).toEqual([]);
    expect(readGuestSessions(JSON.stringify({ not: 'a list' }), NOW)).toEqual([]);
  });

  it('adds a finished session and counts today\'s', () => {
    const list = addGuestSession([], { startedAt: at(1), minutes: 25, what: 'Logo' }, NOW);
    expect(addGuestSession(list, { startedAt: at(0.5), minutes: 15, what: '' }, NOW)).toHaveLength(2);
    expect(sessionsOnDay(list, NOW)).toBe(1);
  });

  it('files each under a note a person can read in their focus time', () => {
    expect(focusNote('Logo presentation')).toBe('Focus session · Logo presentation');
    expect(focusNote('')).toBe('Focus session');
  });
});

describe('the clock', () => {
  const T = Date.UTC(2026, 8, 26, 15, 0, 0);
  const MIN = 60_000;

  it('counts down from the wall clock, not from ticks', () => {
    const c = startClock(T, 25);
    expect(clockText(remainingMs(c, T))).toBe('25:00');
    expect(clockText(remainingMs(c, T + 1))).toBe('25:00');
    expect(clockText(remainingMs(c, T + 1000))).toBe('24:59');
    expect(clockText(remainingMs(c, T + 24 * MIN + 59_001))).toBe('0:01');
    expect(clockText(remainingMs(c, T + 25 * MIN))).toBe('0:00');
    // A tab left in the background for an hour comes back done, never negative.
    expect(remainingMs(c, T + 60 * MIN)).toBe(0);
  });

  it('stops while paused, and does not count the pause', () => {
    let c = startClock(T, 25);
    c = pauseClock(c, T + 5 * MIN);
    expect(focusedMs(c, T + 30 * MIN)).toBe(5 * MIN);
    c = resumeClock(c, T + 30 * MIN);
    expect(focusedMs(c, T + 31 * MIN)).toBe(6 * MIN);
    // Pausing twice, or resuming a running clock, changes nothing.
    expect(pauseClock(pauseClock(c, T + 32 * MIN), T + 40 * MIN).pausedAt).toBe(T + 32 * MIN);
    expect(resumeClock(c, T + 50 * MIN)).toBe(c);
  });

  it('becomes a session of the whole minutes focused, and nothing under a minute', () => {
    const c = startClock(T, 25);
    expect(sessionOf(c, T + 25 * MIN, 'Logo')).toEqual({ startedAt: new Date(T).toISOString(), minutes: 25, what: 'Logo' });
    expect(sessionOf(c, T + 12 * MIN + 40_000, '')?.minutes).toBe(13);
    expect(sessionOf(c, T + 20_000, '')).toBeNull();
    // What it becomes is what the rules keep.
    expect(sanitizeGuestSessions([sessionOf(c, T + 25 * MIN, 'Logo')], new Date(T + 26 * MIN))).toHaveLength(1);
  });
});
