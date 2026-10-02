import { describe, it, expect } from 'vitest';
import { splitSettled, SETTLE_MS } from './use-settling';

const t = (id: string, done: boolean) => ({ id, done });

describe('splitSettled', () => {
  it('keeps an unfinished task active', () => {
    const { active, completed } = splitSettled([t('a', false)], new Set());
    expect(active.map((x) => x.id)).toEqual(['a']);
    expect(completed).toEqual([]);
  });

  it('moves a finished task to Completed once its beat is over', () => {
    const { active, completed } = splitSettled([t('a', true)], new Set());
    expect(active).toEqual([]);
    expect(completed.map((x) => x.id)).toEqual(['a']);
  });

  it('KEEPS a just-finished task in place while it is settling', () => {
    // The whole point: the row does not move under your finger.
    const { active, completed } = splitSettled([t('a', true)], new Set(['a']));
    expect(active.map((x) => x.id)).toEqual(['a']);
    expect(completed).toEqual([]);
  });

  it('never puts a task in both sections, or in neither', () => {
    // The bug this shape exists to prevent: two independent `.filter()` calls
    // that drift until a row is briefly duplicated or briefly lost.
    const items = [t('a', false), t('b', true), t('c', true), t('d', false)];
    const { active, completed } = splitSettled(items, new Set(['c']));
    const seen = [...active, ...completed].map((x) => x.id).sort();
    expect(seen).toEqual(['a', 'b', 'c', 'd']);
    expect(new Set(seen).size).toBe(items.length);
  });

  it('preserves the caller\'s order within each section', () => {
    // Sorting is the list's business, not this function's — a settled task must
    // land where the list would have put it, not at the end.
    const items = [t('a', true), t('b', false), t('c', true)];
    const { active, completed } = splitSettled(items, new Set());
    expect(active.map((x) => x.id)).toEqual(['b']);
    expect(completed.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('ignores a settling id that is not in the list', () => {
    // A task deleted mid-beat, or a stale id from another list.
    const { active, completed } = splitSettled([t('a', true)], new Set(['gone']));
    expect(active).toEqual([]);
    expect(completed.map((x) => x.id)).toEqual(['a']);
  });

  it('handles an empty list', () => {
    expect(splitSettled([], new Set())).toEqual({ active: [], completed: [] });
  });
});

describe('SETTLE_MS', () => {
  it('is the 3 seconds the behaviour was specified at', () => {
    expect(SETTLE_MS).toBe(3000);
  });
});
