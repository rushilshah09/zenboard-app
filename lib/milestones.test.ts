import { describe, it, expect } from 'vitest';
import { milestoneState, sortMilestones, nextMilestone, milestoneProgress, milestonesForCalendar, type Milestone } from './milestones';

const m = (id: string, due: string | null, done = false, sort = 0): Milestone =>
  ({ id, title: id, done, due_date: due, sort_order: sort });

const TODAY = '2026-08-10';

describe('milestoneState', () => {
  it('reads done / overdue / today / upcoming / undated', () => {
    expect(milestoneState(m('a', '2026-08-01', true), TODAY)).toBe('done');
    expect(milestoneState(m('b', '2026-08-01'), TODAY)).toBe('overdue');
    expect(milestoneState(m('c', TODAY), TODAY)).toBe('today');
    expect(milestoneState(m('d', '2026-08-20'), TODAY)).toBe('upcoming');
    expect(milestoneState(m('e', null), TODAY)).toBe('undated');
  });

  it('lets done win over a missed date — a shipped checkpoint is not late', () => {
    expect(milestoneState(m('f', '2020-01-01', true), TODAY)).toBe('done');
  });
});

describe('sortMilestones', () => {
  it('puts soonest first, undated after dated, done at the bottom', () => {
    const list = [
      m('done-early', '2026-08-02', true),
      m('undated', null),
      m('late', '2026-08-01'),
      m('soon', '2026-08-12'),
    ];
    expect(sortMilestones(list).map((x) => x.id)).toEqual(['late', 'soon', 'undated', 'done-early']);
  });

  it('falls back to sort_order for two undated, and for the same date', () => {
    expect(sortMilestones([m('b', null, false, 2), m('a', null, false, 1)]).map((x) => x.id)).toEqual(['a', 'b']);
    expect(sortMilestones([m('b', '2026-08-12', false, 2), m('a', '2026-08-12', false, 1)]).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('does not mutate its input', () => {
    const list = [m('b', '2026-08-12'), m('a', '2026-08-01')];
    sortMilestones(list);
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('sorts dates as strings, which is correct for YYYY-MM-DD across a year boundary', () => {
    const list = [m('next-year', '2027-01-02'), m('this-year', '2026-12-31')];
    expect(sortMilestones(list).map((x) => x.id)).toEqual(['this-year', 'next-year']);
  });
});

describe('nextMilestone', () => {
  it('leads with the thing already missed, not the next comfortable one', () => {
    const list = [m('soon', '2026-08-12'), m('late', '2026-08-01')];
    expect(nextMilestone(list)!.id).toBe('late');
  });

  it('never picks an undated checkpoint — “next” is a claim about time', () => {
    expect(nextMilestone([m('undated', null)])).toBeNull();
    expect(nextMilestone([m('undated', null), m('dated', '2026-08-20')])!.id).toBe('dated');
  });

  it('ignores done ones and returns null when everything has landed', () => {
    expect(nextMilestone([m('a', '2026-08-01', true), m('b', '2026-08-02', true)])).toBeNull();
  });

  it('returns null for an empty project', () => {
    expect(nextMilestone([])).toBeNull();
  });
});

describe('milestoneProgress', () => {
  it('counts done against total', () => {
    expect(milestoneProgress([m('a', null, true), m('b', null), m('c', null, true)])).toEqual({ done: 2, total: 3 });
    expect(milestoneProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('milestonesForCalendar', () => {
  const cm = (id: string, due: string | null, done = false, title = id) => ({
    id, title, done, due_date: due as string, sort_order: 0,
    projectId: 'p1', projectName: 'Balluji rebrand', projectColor: null,
  });

  it('buckets by day inside the window', () => {
    const map = milestonesForCalendar(
      [cm('a', '2026-08-10'), cm('b', '2026-08-10'), cm('c', '2026-08-12')],
      '2026-08-01', '2026-09-01',
    );
    expect([...map.keys()].sort()).toEqual(['2026-08-10', '2026-08-12']);
    expect(map.get('2026-08-10')!.length).toBe(2);
  });

  it('drops undated checkpoints rather than inventing a date for them', () => {
    expect(milestonesForCalendar([cm('a', null)], '2026-08-01', '2026-09-01').size).toBe(0);
  });

  it('honours the window edges — `from` inclusive, `to` exclusive', () => {
    const list = [cm('start', '2026-08-01'), cm('end', '2026-09-01'), cm('before', '2026-07-31')];
    const map = milestonesForCalendar(list, '2026-08-01', '2026-09-01');
    expect([...map.keys()]).toEqual(['2026-08-01']);
  });

  it('orders a busy day: open before done, then by title', () => {
    const list = [cm('z', '2026-08-10', false, 'Zebra'), cm('d', '2026-08-10', true, 'Alpha'), cm('a', '2026-08-10', false, 'Apple')];
    expect(milestonesForCalendar(list, '2026-08-01', '2026-09-01').get('2026-08-10')!.map((m) => m.title))
      .toEqual(['Apple', 'Zebra', 'Alpha']);
  });
});
