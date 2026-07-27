import { describe, it, expect } from 'vitest';
import { rollupTallies, tallyToProgress, computeBehind, type RollupTask } from './goal-rollup';

const task = (o: Partial<RollupTask> & { id: string }): RollupTask => ({
  done: false, goal_id: null, project_id: null, parent_task_id: null, ...o,
});

describe('rollupTallies', () => {
  it('gives every goal an entry, even with no work', () => {
    const t = rollupTallies([{ id: 'g1', project_id: null }], [], []);
    expect(t.get('g1')).toEqual({ done: 0, total: 0 });
  });

  it('counts steps (milestones)', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: null }], [],
      [{ goal_id: 'g1', done: true }, { goal_id: 'g1', done: false }],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 2 });
  });

  it('counts directly linked tasks (tasks.goal_id)', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: null }],
      [task({ id: 't1', goal_id: 'g1', done: true }), task({ id: 't2', goal_id: 'g1' })],
      [],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 2 });
  });

  it('counts the linked project’s tasks (goals.project_id)', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: 'p1' }],
      [task({ id: 't1', project_id: 'p1', done: true }), task({ id: 't2', project_id: 'p1' }), task({ id: 't3', project_id: 'other' })],
      [],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 2 }); // t3 (other project) excluded
  });

  it('dedupes a task that is both directly linked and in the linked project', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: 'p1' }],
      [task({ id: 't1', goal_id: 'g1', project_id: 'p1', done: true })],
      [],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 1 }); // counted once, not twice
  });

  it('excludes subtasks (parent_task_id set)', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: 'p1' }],
      [task({ id: 't1', project_id: 'p1', done: true }), task({ id: 's1', project_id: 'p1', parent_task_id: 't1' })],
      [],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 1 });
  });

  it('lets two goals share one project', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: 'p1' }, { id: 'g2', project_id: 'p1' }],
      [task({ id: 't1', project_id: 'p1', done: true })],
      [],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 1 });
    expect(t.get('g2')).toEqual({ done: 1, total: 1 });
  });

  it('blends tasks and steps into one tally', () => {
    const t = rollupTallies(
      [{ id: 'g1', project_id: 'p1' }],
      [task({ id: 't1', project_id: 'p1', done: true })],
      [{ goal_id: 'g1', done: false }],
    );
    expect(t.get('g1')).toEqual({ done: 1, total: 2 });
  });
});

describe('tallyToProgress', () => {
  it('is 0 for no work', () => {
    expect(tallyToProgress(undefined)).toBe(0);
    expect(tallyToProgress({ done: 0, total: 0 })).toBe(0);
  });
  it('rounds to 0.01', () => {
    expect(tallyToProgress({ done: 1, total: 3 })).toBe(0.33);
    expect(tallyToProgress({ done: 2, total: 2 })).toBe(1);
  });
});

describe('computeBehind', () => {
  const created = new Date(Date.now() - 100 * 86400_000).toISOString(); // 100d ago
  it('is never behind without a target date', () => {
    expect(computeBehind(0, created, null)).toBe(false);
  });
  it('flags a goal past its runway with too little progress', () => {
    const target = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10); // ~91% elapsed
    expect(computeBehind(0.2, created, target)).toBe(true);
  });
  it('stays on track when progress keeps pace', () => {
    const target = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    expect(computeBehind(0.95, created, target)).toBe(false);
  });
  it('gives a grace band early in the runway', () => {
    // ~5% elapsed (100d of a ~2000d runway) — safely inside the 10% grace band, so
    // this stays deterministic rather than teetering on the exact 0.1 boundary.
    const target = new Date(Date.now() + 1900 * 86400_000).toISOString().slice(0, 10);
    expect(computeBehind(0, created, target)).toBe(false);
  });
});
