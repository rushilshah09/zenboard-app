import { describe, it, expect } from 'vitest';
import {
  capacity, busyMinutes, workMinutes, workSpans, readWorkHours, writeWorkHours,
  deferSuggestion, capacityHeadline, capacityTone, unestimatedNote,
  DEFAULT_WORK_HOURS, type CapacityTask, type Span,
} from './capacity';

const H = (h: number, m = 0) => h * 60 + m;
const span = (from: number, to: number): Span => ({ start: from, end: to });
const task = (id: string, est: number | null, extra: Partial<CapacityTask> = {}): CapacityTask =>
  ({ id, title: id, estimate_minutes: est, ...extra });

const NINE_TO_FIVE = { start: H(9), end: H(17) };

describe('readWorkHours', () => {
  it('falls back to 9–17 with nothing stored', () => {
    expect(readWorkHours(null)).toEqual(DEFAULT_WORK_HOURS);
    expect(readWorkHours({})).toEqual(DEFAULT_WORK_HOURS);
  });

  it('keeps a stored end even when no start was ever written', () => {
    // The real shape of every account that went through onboarding: it asked
    // "when does your day end?" and wrote dayEnd alone. An all-or-nothing
    // fallback would discard the one answer the user actually gave.
    expect(readWorkHours({ dayEnd: '18:30' })).toEqual({ start: H(9), end: H(18, 30) });
  });

  it('ignores unusable values rather than producing NaN hours', () => {
    expect(readWorkHours({ dayStart: 'morning', dayEnd: '25:00' })).toEqual(DEFAULT_WORK_HOURS);
    expect(readWorkHours({ dayStart: '9:00', dayEnd: '17:60' })).toEqual({ start: H(9), end: H(17) });
  });

  it('round-trips through the HH:MM the settings input wants', () => {
    expect(writeWorkHours({ start: H(8, 30), end: H(16) })).toEqual({ dayStart: '08:30', dayEnd: '16:00' });
  });
});

describe('workMinutes', () => {
  it('measures an ordinary day', () => {
    expect(workMinutes(NINE_TO_FIVE)).toBe(480);
  });

  it('reads an end before the start as crossing midnight, not as an error', () => {
    // 22:00–06:00 is a real shift. The alternatives are a negative day or
    // silently swapping the user's two answers.
    expect(workMinutes({ start: H(22), end: H(6) })).toBe(480);
    expect(workSpans({ start: H(22), end: H(6) })).toEqual([[H(22), 1440], [0, H(6)]]);
  });
});

describe('busyMinutes', () => {
  it('totals meetings inside the day', () => {
    expect(busyMinutes([span(H(10), H(11)), span(H(14), H(14, 30))], NINE_TO_FIVE)).toBe(90);
  });

  it('MERGES overlapping meetings instead of summing them', () => {
    // You can only be in one of them. Summing would report two hours of load
    // for one hour of double-booking — wrong exactly when it matters.
    expect(busyMinutes([span(H(10), H(11)), span(H(10), H(11))], NINE_TO_FIVE)).toBe(60);
    expect(busyMinutes([span(H(10), H(11, 30)), span(H(11), H(12))], NINE_TO_FIVE)).toBe(120);
  });

  it('joins meetings that merely touch', () => {
    expect(busyMinutes([span(H(10), H(11)), span(H(11), H(12))], NINE_TO_FIVE)).toBe(120);
  });

  it('CLIPS a meeting to the working day', () => {
    // 07:00–10:00 costs one hour of a 9–5 day, not three.
    expect(busyMinutes([span(H(7), H(10))], NINE_TO_FIVE)).toBe(60);
    expect(busyMinutes([span(H(16), H(19))], NINE_TO_FIVE)).toBe(60);
  });

  it('charges nothing for a meeting entirely outside the working day', () => {
    expect(busyMinutes([span(H(19), H(21))], NINE_TO_FIVE)).toBe(0);
  });

  it('clips against both halves of an overnight day', () => {
    const night = { start: H(22), end: H(6) };
    expect(busyMinutes([span(H(23), H(23, 30))], night)).toBe(30);
    expect(busyMinutes([span(H(5), H(7))], night)).toBe(60);
    expect(busyMinutes([span(H(12), H(13))], night)).toBe(0);
  });

  it('skips zero-length and malformed spans rather than throwing', () => {
    expect(busyMinutes([span(H(10), H(10)), span(H(11), H(10)), { start: NaN, end: 5 }], NINE_TO_FIVE)).toBe(0);
  });
});

describe('capacity', () => {
  it('is empty with nothing planned', () => {
    const c = capacity({ tasks: [], meetings: [], hours: NINE_TO_FIVE });
    expect(c).toMatchObject({ plannedMinutes: 0, freeMinutes: 480, overMinutes: 0, fits: true });
    expect(capacityTone(c)).toBe('empty');
  });

  it('adds meetings to task estimates', () => {
    const c = capacity({
      tasks: [task('a', 90), task('b', 60)],
      meetings: [span(H(10), H(11))],
      hours: NINE_TO_FIVE,
    });
    expect(c.taskMinutes).toBe(150);
    expect(c.meetingMinutes).toBe(60);
    expect(c.plannedMinutes).toBe(210);
    expect(c.freeMinutes).toBe(270);
    expect(c.fits).toBe(true);
  });

  it('COUNTS unestimated tasks instead of inventing a duration for them', () => {
    // Motion's mistake is guessing, then judging the day against its own guess.
    const c = capacity({ tasks: [task('a', 60), task('b', null), task('c', 0)], meetings: [], hours: NINE_TO_FIVE });
    expect(c.taskMinutes).toBe(60);
    expect(c.estimated).toBe(1);
    expect(c.unestimated).toBe(2);
    expect(unestimatedNote(c)).toBe('2 tasks have no estimate');
  });

  it('says nothing about estimates when everything has one', () => {
    const c = capacity({ tasks: [task('a', 60)], meetings: [], hours: NINE_TO_FIVE });
    expect(unestimatedNote(c)).toBeNull();
  });

  it('reports the overage and never a negative free', () => {
    const c = capacity({ tasks: [task('a', 570)], meetings: [], hours: NINE_TO_FIVE });
    expect(c.overMinutes).toBe(90);
    expect(c.freeMinutes).toBe(0);
    expect(c.fits).toBe(false);
    expect(capacityTone(c)).toBe('over');
  });

  it('treats a plan exactly filling the day as fitting', () => {
    const c = capacity({ tasks: [task('a', 480)], meetings: [], hours: NINE_TO_FIVE });
    expect(c.fits).toBe(true);
    expect(c.overMinutes).toBe(0);
    // Full, not "manageable" — a day at 100% is honest about being at 100%.
    expect(capacityTone(c)).toBe('full');
  });

  it('separates a comfortable day from a nearly-full one', () => {
    expect(capacityTone(capacity({ tasks: [task('a', 240)], meetings: [], hours: NINE_TO_FIVE }))).toBe('ok');
    expect(capacityTone(capacity({ tasks: [task('a', 440)], meetings: [], hours: NINE_TO_FIVE }))).toBe('full');
  });

  it('measures against the WHOLE day, so the same plan reads the same all day', () => {
    // The line deliberately does not shrink as the afternoon passes. Nothing in
    // the input can express "now" — that is the guarantee, expressed as a type.
    const input = { tasks: [task('a', 240)], meetings: [], hours: NINE_TO_FIVE };
    expect(capacity(input)).toEqual(capacity(input));
  });

  it('reads a shorter stated day as a smaller day', () => {
    // The whole point of reading preferences.dayEnd: the same four hours of work
    // fits a 9–17 day and does not fit a 9–12 one.
    const tasks = [task('a', 240)];
    expect(capacity({ tasks, meetings: [], hours: NINE_TO_FIVE }).fits).toBe(true);
    expect(capacity({ tasks, meetings: [], hours: { start: H(9), end: H(12) } }).fits).toBe(false);
  });
});

describe('capacityHeadline', () => {
  it('states both numbers, plan first', () => {
    const c = capacity({ tasks: [task('a', 390)], meetings: [], hours: NINE_TO_FIVE });
    expect(capacityHeadline(c)).toBe('6h 30m planned in an 8h day');
  });

  it('picks the article by sound, since every duration starts with a digit', () => {
    // "a 8h day" is what the naive version wrote. 8, 11 and 18 open with a
    // vowel sound; the letter-based test that works for words fails on all of
    // them, and passes wrongly on 1 and 7.
    const day = (mins: number) => capacityHeadline(capacity({ tasks: [], meetings: [], hours: { start: 0, end: mins } }));
    expect(day(H(8))).toContain('in an 8h day');
    expect(day(H(11))).toContain('in an 11h day');
    expect(day(H(18))).toContain('in an 18h day');
    expect(day(H(7))).toContain('in a 7h day');
    expect(day(H(1))).toContain('in a 1h day');
  });
});

describe('deferSuggestion', () => {
  const over = (tasks: CapacityTask[]) => {
    const c = capacity({ tasks, meetings: [], hours: NINE_TO_FIVE });
    return deferSuggestion(tasks, c);
  };

  it('suggests nothing when the day fits', () => {
    expect(over([task('a', 60)])).toEqual([]);
  });

  it('offers the lowest priority first', () => {
    const tasks = [
      task('high', 240, { priority: 'high' }),
      task('low', 240, { priority: 'low' }),
      task('med', 120, { priority: 'med' }),
    ];
    expect(over(tasks).map((t) => t.id)).toEqual(['low']);
  });

  it('within a priority, offers the longest first — fewest moves back inside the day', () => {
    const tasks = [
      task('short', 60, { priority: 'low' }),
      task('long', 300, { priority: 'low' }),
      task('keep', 240, { priority: 'high' }),
    ];
    expect(over(tasks).map((t) => t.id)).toEqual(['long']);
  });

  it('takes as many as it needs and then stops', () => {
    const tasks = [
      task('a', 300, { priority: 'high' }),
      task('b', 200, { priority: 'high' }),
      task('c', 120, { priority: 'low' }),
      task('d', 60, { priority: 'low' }),
    ];
    // 680 planned in a 480 day → 200 over; c (120) then d (60) is 180, still
    // short, so both are offered and nothing beyond them.
    expect(over(tasks).map((t) => t.id)).toEqual(['c', 'd']);
  });

  it('NEVER offers the highlight', () => {
    // It is by definition the one thing that makes today a win. Suggesting it
    // would be the tool arguing with the answer it asked for two steps earlier.
    const tasks = [
      task('highlight', 400, { priority: 'low', highlight: true }),
      task('other', 200, { priority: 'high' }),
    ];
    expect(over(tasks).map((t) => t.id)).toEqual(['other']);
  });

  it('offers nothing rather than something unmovable', () => {
    // Every task is the highlight or unestimated: honest empty, so the caller
    // can say so instead of showing an empty list with no explanation.
    const tasks = [task('h', 600, { highlight: true }), task('u', null)];
    expect(over(tasks)).toEqual([]);
  });
});

describe('deferSuggestion — the tier boundary', () => {
  it('never reaches into a higher priority to shed a small remainder', () => {
    // 680 planned in a 480 day → 200 over. The low tier holds 180 of it, which
    // is not enough; a plain greedy would then offer a 5-hour HIGH task to
    // cover the last 20 minutes. Saying "start with these two" and leaving the
    // day 20 over is better advice than that.
    const tasks: CapacityTask[] = [
      task('a', 300, { priority: 'high' }),
      task('b', 200, { priority: 'high' }),
      task('c', 120, { priority: 'low' }),
      task('d', 60, { priority: 'low' }),
    ];
    const c = capacity({ tasks, meetings: [], hours: NINE_TO_FIVE });
    const picked = deferSuggestion(tasks, c);
    expect(picked.map((t) => t.id)).toEqual(['c', 'd']);
    // And it is honest about not having solved it.
    expect(picked.reduce((n, t) => n + (t.estimate_minutes ?? 0), 0)).toBeLessThan(c.overMinutes);
  });

  it('uses the lowest tier that HAS something, not the lowest tier that exists', () => {
    // Everything low-priority is the highlight, so the shortlist starts at med.
    const tasks: CapacityTask[] = [
      task('hl', 300, { priority: 'low', highlight: true }),
      task('m', 200, { priority: 'med' }),
      task('h', 100, { priority: 'high' }),
    ];
    const c = capacity({ tasks, meetings: [], hours: NINE_TO_FIVE });
    expect(deferSuggestion(tasks, c).map((t) => t.id)).toEqual(['m']);
  });

  it('treats a task with no stated priority as med', () => {
    const tasks: CapacityTask[] = [task('none', 400), task('low', 200, { priority: 'low' })];
    const c = capacity({ tasks, meetings: [], hours: NINE_TO_FIVE });
    expect(deferSuggestion(tasks, c).map((t) => t.id)).toEqual(['low']);
  });
});
