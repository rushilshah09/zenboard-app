import { describe, it, expect } from 'vitest';
import {
  readDigestPrefs, writeDigestPrefs, digestDue, vacationThrough,
  digestEmail, digestSubject, digestBlocks, DEFAULT_DIGEST_PREFS, DEFAULT_DIGEST_MINUTES,
  DIGEST_WINDOW_MINUTES, type DigestInput, type DigestPrefs,
} from './digest';
import { capacity } from './capacity';

const H = (h: number, m = 0) => h * 60 + m;
const prefs = (over: Partial<DigestPrefs> = {}): DigestPrefs => ({ ...DEFAULT_DIGEST_PREFS, enabled: true, ...over });
const t = (id: string, title: string) => ({ id, title });
const input = (over: Partial<DigestInput> = {}): DigestInput =>
  ({ today: [], overdue: [], waitingOn: [], overnight: [], capacity: null, content: [], meetings: [], ...over });

describe('readDigestPrefs', () => {
  it('is OFF with nothing stored — opt-in, never opt-out', () => {
    // A product that starts emailing you daily because you signed up is the
    // thing §7O exists to argue against.
    expect(readDigestPrefs(null)).toEqual(DEFAULT_DIGEST_PREFS);
    expect(readDigestPrefs({})).toEqual(DEFAULT_DIGEST_PREFS);
    expect(readDigestPrefs({}).enabled).toBe(false);
  });

  it('reads a stored digest without disturbing the rest of preferences', () => {
    const p = readDigestPrefs({ accent: 'berry', digest: { enabled: true, atMinutes: 420 } });
    expect(p).toMatchObject({ enabled: true, atMinutes: 420 });
  });

  it('refuses a value it cannot trust rather than sending at NaN o\'clock', () => {
    expect(readDigestPrefs({ digest: { enabled: true, atMinutes: 'morning' } }).atMinutes).toBe(DEFAULT_DIGEST_MINUTES);
    expect(readDigestPrefs({ digest: { enabled: true, atMinutes: 5000 } }).atMinutes).toBe(DEFAULT_DIGEST_MINUTES);
    expect(readDigestPrefs({ digest: { enabled: true, atMinutes: -1 } }).atMinutes).toBe(DEFAULT_DIGEST_MINUTES);
  });

  it('treats a truthy-but-not-true enabled as off', () => {
    // `enabled: 'yes'` must not switch on a daily email.
    expect(readDigestPrefs({ digest: { enabled: 'yes' } }).enabled).toBe(false);
    expect(readDigestPrefs({ digest: { enabled: 1 } }).enabled).toBe(false);
  });

  it('ignores malformed dates', () => {
    expect(readDigestPrefs({ digest: { vacationUntil: 'next week', lastSent: '5 Aug' } }))
      .toMatchObject({ vacationUntil: null, lastSent: null });
  });

  it('writes back without inventing a lastSent', () => {
    // The UI must never stamp the claim — only the worker does.
    const out = writeDigestPrefs({ enabled: true, atMinutes: 420, vacationUntil: null });
    expect(out).toEqual({ enabled: true, atMinutes: 420, vacationUntil: null });
    expect('lastSent' in out).toBe(false);
  });
});

describe('digestDue', () => {
  const at = { today: '2026-08-06', nowMinutes: H(8, 5) };

  it('sends at the chosen time', () => {
    expect(digestDue(prefs({ atMinutes: H(8) }), at)).toEqual({ due: true });
  });

  it('sends exactly ON the chosen minute', () => {
    expect(digestDue(prefs({ atMinutes: H(8, 5) }), at)).toEqual({ due: true });
  });

  it('never sends when it is off', () => {
    expect(digestDue(prefs({ enabled: false }), at)).toEqual({ due: false, reason: 'off' });
  });

  it('says OFF rather than early when it is switched off — unsubscribe is instant', () => {
    // §7O: "unsubscribes honored instantly". Turning it off is one boolean and
    // needs no other state cleared, which is the point of checking it first.
    expect(digestDue(prefs({ enabled: false, atMinutes: H(23) }), at).due).toBe(false);
    expect(digestDue(prefs({ enabled: false, atMinutes: H(23) }), at)).toEqual({ due: false, reason: 'off' });
  });

  it('is silent through the last day of vacation, inclusive', () => {
    const p = prefs({ atMinutes: H(8), vacationUntil: '2026-08-06' });
    expect(digestDue(p, at)).toEqual({ due: false, reason: 'vacation' });
    // …and speaks again the next morning, with nothing to switch back.
    expect(digestDue(p, { today: '2026-08-07', nowMinutes: H(8, 5) })).toEqual({ due: true });
  });

  it('does not send twice in a day — the claim', () => {
    expect(digestDue(prefs({ atMinutes: H(8), lastSent: '2026-08-06' }), at))
      .toEqual({ due: false, reason: 'already-sent' });
  });

  it('waits rather than sending early', () => {
    expect(digestDue(prefs({ atMinutes: H(9) }), at)).toEqual({ due: false, reason: 'early' });
  });

  it('DROPS a digest that has missed its morning rather than queueing it', () => {
    // "Due today" read at six in the evening is an accusation, not a digest.
    const late = { today: '2026-08-06', nowMinutes: H(8) + DIGEST_WINDOW_MINUTES + 1 };
    expect(digestDue(prefs({ atMinutes: H(8) }), late)).toEqual({ due: false, reason: 'late' });
  });

  it('treats the last minute of the window as still deliverable', () => {
    const edge = { today: '2026-08-06', nowMinutes: H(8) + DIGEST_WINDOW_MINUTES };
    expect(digestDue(prefs({ atMinutes: H(8) }), edge)).toEqual({ due: true });
  });
});

describe('vacationThrough', () => {
  it('one day off means today', () => {
    expect(vacationThrough('2026-08-06', 1)).toBe('2026-08-06');
  });
  it('a week off means through the seventh day', () => {
    expect(vacationThrough('2026-08-06', 7)).toBe('2026-08-12');
  });
  it('crosses a month end', () => {
    expect(vacationThrough('2026-08-30', 5)).toBe('2026-09-03');
  });
  it('refuses nonsense rather than silencing forever', () => {
    expect(vacationThrough('2026-08-06', 0)).toBeNull();
    expect(vacationThrough('2026-08-06', -3)).toBeNull();
    expect(vacationThrough('2026-08-06', Number.NaN)).toBeNull();
  });
});

describe('digestEmail', () => {
  const origin = 'https://z.app';

  it('sends nothing when nothing is asking for you', () => {
    // The null IS the feature: an email that says "nothing today" every day is
    // an email nobody opens on the day it matters.
    expect(digestEmail(input(), origin)).toBeNull();
  });

  it('does not send for a capacity line alone', () => {
    const c = capacity({ tasks: [], meetings: [], hours: { start: H(9), end: H(17) } });
    expect(digestEmail(input({ capacity: c }), origin)).toBeNull();
  });

  it('does not send for blocked work alone', () => {
    // Three tasks stuck behind someone else is not a morning worth interrupting.
    expect(digestEmail(input({ waitingOn: [t('a', 'A'), t('b', 'B')] }), origin)).toBeNull();
  });

  it('sends for a client request even with no tasks at all', () => {
    const mail = digestEmail(input({ overnight: [{ id: 'r1', title: 'New request from Acme', projectId: 'p1' }] }), origin);
    expect(mail).not.toBeNull();
    expect(mail!.text).toContain('https://z.app/projects/p1');
  });

  it('leads with TODAY, not with what is late', () => {
    // §7O lists overdue second; this deliberately keeps that order in the body
    // too, because leading an email with overdue work is the anxious framing
    // that section's first sentence rejects.
    const mail = digestEmail(input({ today: [t('a', 'Ship the logo')], overdue: [t('b', 'Chase the invoice')] }), origin)!;
    expect(mail.text.indexOf('Today ·')).toBeLessThan(mail.text.indexOf('Overdue ·'));
  });

  it('carries the capacity line beside today, and only there', () => {
    const c = capacity({ tasks: [{ id: 'a', title: 'A', estimate_minutes: 390 }], meetings: [], hours: { start: H(9), end: H(17) } });
    const mail = digestEmail(input({ today: [t('a', 'A')], capacity: c }), origin)!;
    expect(mail.text).toContain('6h 30m planned in an 8h day');
    expect(mail.text.indexOf('planned in')).toBeLessThan(mail.text.indexOf('https://z.app/tasks?task=a'));
  });

  it('omits the capacity sentence when there is no plan to measure', () => {
    const mail = digestEmail(input({ today: [t('a', 'A')] }), origin)!;
    expect(mail.text).not.toContain('planned in');
  });

  it('links every item and ends at Today', () => {
    const mail = digestEmail(input({ today: [t('a', 'A')], overdue: [t('b', 'B')] }), origin)!;
    expect(mail.text).toContain('https://z.app/tasks?task=a');
    expect(mail.text).toContain('https://z.app/tasks?task=b');
    expect(mail.text.trimEnd().endsWith('https://z.app/today')).toBe(true);
  });

  it('caps a long section and counts the rest — a digest is not a backlog report', () => {
    const many = Array.from({ length: 12 }, (_, i) => t(`o${i}`, `Overdue ${i}`));
    const mail = digestEmail(input({ today: [t('a', 'A')], overdue: many }), origin)!;
    expect(mail.text).toContain('… and 5 more');
    expect(mail.text).not.toContain('Overdue 8');
  });

  it('includes waiting-on when there IS something else to send', () => {
    const mail = digestEmail(input({ today: [t('a', 'A')], waitingOn: [t('w', 'Blocked thing')] }), origin)!;
    expect(mail.text).toContain('Waiting on something else · 1');
  });
});

describe('digestSubject', () => {
  it('says the whole message in one clause', () => {
    expect(digestSubject(input({ today: [t('a', 'A'), t('b', 'B')], overdue: [t('c', 'C')] })))
      .toBe('2 today · 1 overdue');
  });

  it('carries the committed time when there is a plan', () => {
    const c = capacity({ tasks: [{ id: 'a', title: 'A', estimate_minutes: 240 }], meetings: [], hours: { start: H(9), end: H(17) } });
    expect(digestSubject(input({ today: [t('a', 'A')], capacity: c }))).toBe('1 today (4h)');
  });

  it('drops the time when nothing is estimated, rather than saying "(0m)"', () => {
    const c = capacity({ tasks: [{ id: 'a', title: 'A', estimate_minutes: null }], meetings: [], hours: { start: H(9), end: H(17) } });
    expect(digestSubject(input({ today: [t('a', 'A')], capacity: c }))).toBe('1 today');
  });

  it('names client work so it is visible without opening', () => {
    expect(digestSubject(input({ overnight: [{ id: 'r', title: 'R', projectId: 'p' }] }))).toBe('1 from clients');
  });
});

describe('content and meetings — the day a creator actually has', () => {
  const origin = 'https://z.app';
  const piece = (id: string, title: string, meta: Record<string, unknown> = {}) =>
    ({ id, title, meta: { stage: 'shoot', bucket: 'piece', ...meta } }) as never;
  const shoot = { piece: piece('c1', 'Studio tour', { callTime: '09:00' }), kind: 'shoot' as const };
  const goingOut = { piece: piece('c2', 'Launch reel'), kind: 'publish' as const };

  it('a shoot day alone is worth the email — it is the least movable thing in the week', () => {
    const mail = digestEmail(input({ content: [shoot] }), origin);
    expect(mail).not.toBeNull();
    expect(mail!.text).toContain('Content today · Filming at 09:00');
    expect(mail!.text).toContain('Studio tour · filming');
    expect(mail!.text).toContain('https://z.app/content?piece=c1');
  });

  it('puts what is being made after the plan and before what is late', () => {
    const mail = digestEmail(input({ today: [t('a', 'A')], content: [shoot], overdue: [t('b', 'B')] }), origin)!;
    const at = (s: string) => mail.text.indexOf(s);
    expect(at('Today ·')).toBeLessThan(at('Content today ·'));
    expect(at('Content today ·')).toBeLessThan(at('Overdue ·'));
  });

  it('names it in the subject with the same words Home uses', () => {
    expect(digestSubject(input({ today: [t('a', 'A')], content: [shoot, goingOut] })))
      .toBe('1 today · Filming at 09:00 · 1 going out');
  });

  it('keeps meetings OUT of the email — it informs the plan, the calendar is the schedule', () => {
    const mail = digestEmail(input({ today: [t('a', 'A')], meetings: [{ title: 'Kickoff', when: '10:00 – 11:00' }] }), origin)!;
    expect(mail.text).not.toContain('Kickoff');
  });

  it('renders meetings when a surface asks for them, right after the plan', () => {
    const blocks = digestBlocks(
      input({ today: [t('a', 'A')], overdue: [t('b', 'B')], meetings: [{ title: 'Kickoff', when: '10:00 – 11:00' }] }),
      origin, { meetings: true },
    );
    expect(blocks[1]).toBe('Meetings · 1\n\n• 10:00 – 11:00  Kickoff');
    expect(blocks[2].startsWith('Overdue')).toBe(true);
  });

  it('meetings alone never make an email', () => {
    expect(digestEmail(input({ meetings: [{ title: 'Kickoff', when: 'All day' }] }), origin)).toBeNull();
  });
});
