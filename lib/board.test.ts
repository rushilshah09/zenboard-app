import { describe, it, expect } from 'vitest';
import type { DbRow, PropDef, ViewDef } from './collections';
import {
  NO_VALUE, boardColumns, boardGroupList, boardGroupProp, groupPreset, landingFromPointer, moveToGroup, reorderKeys, sortedLanding,
} from './board';

// A database as a board (database brief §6, after Notion): the same rows cut into
// columns by one property. These are the rules the board draws — kept pure so a
// drag's outcome is tested without a pointer.
const status: PropDef = {
  id: 'status', name: 'Status', type: 'status',
  options: [
    { id: 'todo', name: 'Not started', color: 'gray' },
    { id: 'doing', name: 'In progress', color: 'blue' },
    { id: 'done', name: 'Done', color: 'green' },
  ],
};
const tags: PropDef = {
  id: 'tags', name: 'Tags', type: 'multi_select',
  options: [{ id: 'design', name: 'Design', color: 'purple' }, { id: 'dev', name: 'Dev', color: 'orange' }],
};
const done: PropDef = { id: 'ok', name: 'Shipped', type: 'checkbox' };
const hours: PropDef = { id: 'hours', name: 'Hours', type: 'number' };
const props = [{ id: 'title', name: 'Name', type: 'title' } as PropDef, status, tags, done, hours];

const row = (id: string, data: Record<string, unknown>, order = id): DbRow =>
  ({ id, title: id, data, order, created_at: '', updated_at: '' });
const board = (extra: Partial<ViewDef> = {}): ViewDef => ({ id: 'v', name: 'Board', kind: 'board', groupBy: 'status', ...extra });
const keys = (groups: { key: string }[]) => groups.map((g) => g.key);

describe('boardGroupProp — what a board is grouped by', () => {
  it("takes the view's own choice when it can group by it", () => {
    expect(boardGroupProp({ groupBy: 'tags' }, props)?.id).toBe('tags');
  });

  it('falls back to the first status, then the first select — never a property with no columns', () => {
    expect(boardGroupProp({ groupBy: 'hours' }, props)?.id).toBe('status');
    expect(boardGroupProp({}, [hours])).toBeUndefined();
  });
});

describe('boardColumns — which columns show, in what order', () => {
  const rows = [row('a', { status: 'doing' }), row('b', { status: 'done' }), row('c', {})];

  it('keeps the option order and puts the no-value column first while it holds a card', () => {
    const { shown } = boardColumns(rows, board(), props, status);
    expect(keys(shown)).toEqual([NO_VALUE, 'todo', 'doing', 'done']);
    expect(shown[0].rows.map((r) => r.id)).toEqual(['c']);
  });

  it('drops an empty no-value column — on a status board it would be empty forever', () => {
    const { shown } = boardColumns(rows.slice(0, 2), board(), props, status);
    expect(keys(shown)).toEqual(['todo', 'doing', 'done']);
  });

  it('hides every empty column when the view says so', () => {
    const { shown } = boardColumns(rows.slice(0, 2), board({ hideEmpty: true }), props, status);
    expect(keys(shown)).toEqual(['doing', 'done']);
  });

  it("follows the view's own column order, which can place the no-value column too", () => {
    expect(keys(boardColumns(rows, board({ groupOrder: ['done', 'todo'] }), props, status).shown))
      .toEqual([NO_VALUE, 'done', 'todo', 'doing']);
    expect(keys(boardColumns(rows, board({ groupOrder: ['done', NO_VALUE] }), props, status).shown))
      .toEqual(['done', NO_VALUE, 'todo', 'doing']);
  });

  it('moves hidden columns aside, in board order, with their cards', () => {
    const { shown, hidden } = boardColumns(rows, board({ hiddenGroups: ['done', 'todo'] }), props, status);
    expect(keys(shown)).toEqual([NO_VALUE, 'doing']);
    expect(keys(hidden)).toEqual(['todo', 'done']);
    expect(hidden[1].rows.map((r) => r.id)).toEqual(['b']);
  });

  it('shows a multi-select card in every column it belongs to', () => {
    const { shown } = boardColumns([row('a', { tags: ['design', 'dev'] })], board({ groupBy: 'tags' }), props, tags);
    expect(shown.map((g) => [g.key, g.rows.length])).toEqual([['design', 1], ['dev', 1]]);
  });

  it('gives a checkbox board its two sides', () => {
    const { shown } = boardColumns([row('a', { ok: true })], board({ groupBy: 'ok' }), props, done);
    expect(keys(shown)).toEqual(['true', 'false']);
  });
});

describe('moveToGroup — a card carried into another column', () => {
  it('sets the new option, and clears it in the no-value column', () => {
    expect(moveToGroup(row('a', { status: 'todo', hours: 2 }), status, 'todo', 'done')).toEqual({ status: 'done', hours: 2 });
    expect(moveToGroup(row('a', { status: 'todo' }), status, 'todo', NO_VALUE)).toEqual({});
  });

  it('swaps only the value it was carried out of on a multi-select', () => {
    const r = row('a', { tags: ['design', 'dev'] });
    expect(moveToGroup(r, tags, 'design', 'dev')).toEqual({ tags: ['dev'] });
    expect(moveToGroup(row('b', { tags: ['design'] }), tags, 'design', 'dev')).toEqual({ tags: ['dev'] });
    expect(moveToGroup(r, tags, 'dev', NO_VALUE)).toEqual({ tags: [] });
    expect(moveToGroup(row('c', {}), tags, NO_VALUE, 'dev')).toEqual({ tags: ['dev'] });
  });

  it('takes the side of a checkbox column', () => {
    expect(moveToGroup(row('a', { ok: false }), done, 'false', 'true')).toEqual({ ok: true });
  });

  it('never changes the row it was given', () => {
    const r = row('a', { status: 'todo' });
    moveToGroup(r, status, 'todo', 'done');
    expect(r.data).toEqual({ status: 'todo' });
  });
});

describe('groupPreset — a card made inside a column starts in it', () => {
  it('matches what carrying a card there would do', () => {
    expect(groupPreset(status, 'doing')).toEqual({ status: 'doing' });
    expect(groupPreset(tags, 'dev')).toEqual({ tags: ['dev'] });
    expect(groupPreset(done, 'true')).toEqual({ ok: true });
    // The no-value column overrides the status every other new page starts with.
    expect(groupPreset(status, NO_VALUE)).toEqual({ status: undefined });
  });
});

describe('landingFromPointer — where a carried card drops', () => {
  it('counts the cards whose middle is above the pointer', () => {
    const middles = [20, 70, 120];
    expect(landingFromPointer(middles, 5)).toBe(0);
    expect(landingFromPointer(middles, 21)).toBe(1);
    expect(landingFromPointer(middles, 119)).toBe(2);
    expect(landingFromPointer(middles, 400)).toBe(3);
    expect(landingFromPointer([], 50)).toBe(0);
  });
});

describe('sortedLanding — in a sorted view the sort decides', () => {
  it('lands the card where the sort puts its new value, wherever the pointer is', () => {
    const others = [row('a', { hours: 1 }), row('b', { hours: 5 })];
    const moved = row('m', { hours: 3 });
    expect(sortedLanding(others, moved, [{ prop: 'hours', dir: 'asc' }], props)).toBe(1);
    expect(sortedLanding(others, moved, [{ prop: 'hours', dir: 'desc' }], props)).toBe(1);
    expect(sortedLanding(others, row('m', { hours: 9 }), [{ prop: 'hours', dir: 'asc' }], props)).toBe(2);
  });
});

describe('reorderKeys — the order a drop writes', () => {
  const others = [row('a', {}, 'c'), row('b', {}, 'g'), row('d', {}, 'p')];
  const sortedIds = (rows: DbRow[], keys: Map<string, string>) =>
    [...rows].map((r) => ({ ...r, order: keys.get(r.id) ?? r.order })).sort((x, y) => (x.order < y.order ? -1 : 1)).map((r) => r.id);

  it('writes ONE key, between the new neighbours', () => {
    const keys = reorderKeys(others, 'm', 1);
    expect([...keys.keys()]).toEqual(['m']);
    const k = keys.get('m')!;
    expect(k > 'c' && k < 'g').toBe(true);
  });

  it('can put a card first or last', () => {
    expect(reorderKeys(others, 'm', 0).get('m')! < 'c').toBe(true);
    expect(reorderKeys(others, 'm', 3).get('m')! > 'p').toBe(true);
    expect(reorderKeys(others, 'm', 99).get('m')! > 'p').toBe(true);
  });

  it('keys the column afresh when neighbours share a key, and the drop still lands where aimed', () => {
    const tied = [row('a', {}, 'k'), row('b', {}, 'k'), row('d', {}, 'k')];
    const keys = reorderKeys(tied, 'm', 2);
    expect(sortedIds([...tied, row('m', {}, 'z')], keys)).toEqual(['a', 'b', 'm', 'd']);
  });

  it('keys the column afresh when a neighbour was written before ordering existed', () => {
    const legacy = [row('a', {}, ''), row('b', {}, '')];
    const keys = reorderKeys(legacy, 'm', 1);
    expect(sortedIds([...legacy, row('m', {}, '')], keys)).toEqual(['a', 'm', 'b']);
  });
});

describe('boardGroupList — every column a board can have', () => {
  it('lists the no-value column first, then the options, whether or not they hold a page', () => {
    expect(boardGroupList(status, board()).map((g) => g.label)).toEqual(['No Status', 'Not started', 'In progress', 'Done']);
  });

  it("follows the view's order, the same order the board draws", () => {
    const view = board({ groupOrder: ['done', NO_VALUE, 'todo'] });
    expect(boardGroupList(status, view).map((g) => g.key)).toEqual(['done', NO_VALUE, 'todo', 'doing']);
    const rows = [row('a', { status: 'doing' }), row('b', { status: 'done' }), row('c', {}), row('d', { status: 'todo' })];
    expect(keys(boardColumns(rows, view, props, status).shown)).toEqual(boardGroupList(status, view).map((g) => g.key));
  });

  it('names a checkbox board\'s two sides', () => {
    expect(boardGroupList(done, board()).map((g) => g.label)).toEqual(['No Shipped', 'Checked', 'Unchecked']);
  });
});
