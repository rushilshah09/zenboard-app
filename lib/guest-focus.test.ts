import { describe, expect, it } from 'vitest';
import { GUEST_LIMITS, addGuestSession, focusNote, readGuestSessions, sanitizeGuestSessions, sessionsOnDay } from './guest-focus';

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
