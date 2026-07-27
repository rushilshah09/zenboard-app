// The NL grammar behind Quick Capture, ⌘K, and the Tasks composer — one
// parser, tested. Dates resolve against a frozen clock: Mon 2026-07-20.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { parseTask } from './task-parse';

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-20T10:00:00')); });
afterAll(() => { vi.useRealTimers(); });

const P = (s: string) => parseTask(s);
const chipKinds = (s: string) => P(s).chips.map((c) => c.kind);

describe('when & due', () => {
  it('tomorrow / tmr schedule, and the word leaves the title', () => {
    const p = P('call sam tomorrow');
    expect(p.scheduledDate).toBe('2026-07-21');
    expect(p.title).toBe('call sam');
    expect(P('call sam tmr').scheduledDate).toBe('2026-07-21');
  });
  it('a weekday name is strictly future', () => {
    expect(P('gym friday').scheduledDate).toBe('2026-07-24');
    expect(P('gym monday').scheduledDate).toBe('2026-07-27'); // today is Monday
  });
  it('next week → next Monday', () => {
    expect(P('plan next week').scheduledDate).toBe('2026-07-27');
  });
  it('by/due/before + date goes to dueDate, not scheduling', () => {
    const p = P('pay rent by friday');
    expect(p.dueDate).toBe('2026-07-24');
    expect(p.scheduledDate).toBeNull();
    expect(p.title).toBe('pay rent');
  });
});

describe('repeat grammar', () => {
  it('every friday → weekly anchored to Friday, first occurrence scheduled', () => {
    const p = P('gym every friday');
    expect(p.recurrence).toEqual({ freq: 'weekly', byday: 5 });
    expect(p.scheduledDate).toBe('2026-07-24'); // first occurrence, chip shown
    expect(p.chips.map((c) => c.kind)).toContain('when');
    expect(p.title).toBe('gym');
  });
  it('every monday typed on a Monday schedules today', () => {
    expect(P('standup every monday').scheduledDate).toBe('2026-07-20');
  });
  it('every! 3 days → after-completion cadence with interval', () => {
    const p = P('water plants every! 3 days');
    expect(p.recurrence).toEqual({ freq: 'daily', interval: 3, afterCompletion: true });
    expect(p.title).toBe('water plants');
  });
  it('every 2 weeks / every other week carry an interval', () => {
    expect(P('review every 2 weeks').recurrence).toEqual({ freq: 'weekly', interval: 2 });
    expect(P('review every other week').recurrence).toEqual({ freq: 'weekly', interval: 2 });
  });
  it('every weekday → weekdays; interval is ignored for weekdays', () => {
    expect(P('standup every weekday').recurrence).toEqual({ freq: 'weekdays' });
  });
  it('standalone words still parse', () => {
    expect(P('journal daily').recurrence).toEqual({ freq: 'daily' });
    expect(P('journal everyday').recurrence).toEqual({ freq: 'daily' });
    expect(P('report weekly').recurrence).toEqual({ freq: 'weekly' });
    expect(P('invoices monthly').recurrence).toEqual({ freq: 'monthly' });
    expect(P('taxes annually').recurrence).toEqual({ freq: 'yearly' });
    expect(P('inbox sweep weekdays').recurrence).toEqual({ freq: 'weekdays' });
  });
  it('chip labels come from the contract (sentence case)', () => {
    expect(P('gym every friday').chips.find((c) => c.kind === 'repeat')?.label).toBe('Every Friday');
    expect(P('water every! 3 days').chips.find((c) => c.kind === 'repeat')?.label).toBe('Every 3 days after done');
  });
  it('"everything" is not "every thing"', () => {
    const p = P('buy everything tomorrow');
    expect(p.recurrence).toBeNull();
    expect(p.title).toBe('buy everything');
  });
});

describe('priority, estimate, project, inbox', () => {
  it('priority forms', () => {
    expect(P('ship it !high').priority).toBe('high');
    expect(P('ship it !!').priority).toBe('med');
    expect(P('ship it !low').priority).toBe('low');
  });
  it('estimates incl. the ~ prefix', () => {
    expect(P('draft ~30m').estimateMinutes).toBe(30);
    expect(P('draft 1.5h').estimateMinutes).toBe(90);
    expect(P('draft ~30m').title).toBe('draft');
  });
  it('#project resolves against the caller list', () => {
    const p = parseTask('send invoice #acme', [{ id: 'p1', name: 'Acme rebrand' }]);
    expect(p.projectId).toBe('p1');
    expect(p.projectName).toBe('Acme rebrand');
  });
  it('inbox/someday file explicitly to Inbox', () => {
    expect(P('read book someday').isInbox).toBe(true);
  });
});

describe('composition & dismissal', () => {
  it('a full sentence parses every chip and cleans the title', () => {
    const p = parseTask('send invoice #acme tomorrow !high ~30m every month', [{ id: 'p1', name: 'Acme' }]);
    expect(p.title).toBe('send invoice');
    expect(p.scheduledDate).toBe('2026-07-21');
    expect(p.priority).toBe('high');
    expect(p.estimateMinutes).toBe(30);
    expect(p.projectId).toBe('p1');
    expect(p.recurrence).toEqual({ freq: 'monthly' });
    expect(new Set(chipKinds('send invoice tomorrow !high ~30m every month')).size).toBe(4);
  });
  it('dismissing the repeat chip cascades: "friday" re-reads as a when', () => {
    const p = parseTask('gym every friday', [], new Set(['repeat']));
    expect(p.recurrence).toBeNull();
    expect(p.scheduledDate).toBe('2026-07-24'); // now a plain scheduling word
    expect(p.title).toBe('gym every');
  });
  it('dismissing both repeat and when keeps the full literal text', () => {
    const p = parseTask('gym every friday', [], new Set(['repeat', 'when']));
    expect(p.recurrence).toBeNull();
    expect(p.scheduledDate).toBeNull();
    expect(p.title).toBe('gym every friday');
  });
});
