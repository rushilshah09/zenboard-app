import { describe, it, expect } from 'vitest';
import { columnGaps, frozenOrder, moveBefore, nearestGap, rowGaps, rowLanding, type SectionBox } from './table-drag';

// A table of three 40px rows under a 36px header, then a grouped one.
const flat: SectionBox[] = [{ key: 'all', top: 36, count: 3, rows: [
  { id: 'a', top: 36, bottom: 76 }, { id: 'b', top: 76, bottom: 116 }, { id: 'c', top: 116, bottom: 156 },
] }];
const grouped: SectionBox[] = [
  { key: 'todo', top: 40, count: 2, rows: [{ id: 'a', top: 40, bottom: 80 }, { id: 'b', top: 80, bottom: 120 }] },
  { key: 'doing', top: 160, count: 0, rows: [] },
  { key: 'done', top: 240, count: 5, rows: [], collapsed: true },
];
const byY = (g: { y: number }) => g.y;

describe('rowGaps — every place a row can drop', () => {
  it('a gap before each row and one after the last', () => {
    expect(rowGaps(flat).map((g) => [g.index, g.y])).toEqual([[0, 36], [1, 76], [2, 116], [3, 156]]);
  });

  it('an empty group and a folded one each offer one gap: the end of the group', () => {
    const gaps = rowGaps(grouped);
    expect(gaps.filter((g) => g.section === 'doing')).toEqual([{ section: 'doing', index: 0, y: 160 }]);
    expect(gaps.filter((g) => g.section === 'done')).toEqual([{ section: 'done', index: 5, y: 240 }]);
  });
});

describe('rowLanding — where a carried row drops', () => {
  const landAt = (y: number, from: { section: string; index: number }, sections = flat) =>
    rowLanding(nearestGap(rowGaps(sections), y, byY)!, from);

  it('the gaps either side of the row itself are no move at all', () => {
    expect(landAt(80, { section: 'all', index: 1 })).toBeNull(); // above b
    expect(landAt(114, { section: 'all', index: 1 })).toBeNull(); // below b
  });

  it('moving down counts the other rows, not the row being carried', () => {
    // a dropped under c: after b and c, i.e. index 2 among [b, c].
    expect(landAt(150, { section: 'all', index: 0 })).toEqual({ section: 'all', index: 2 });
  });

  it('moving up lands before the row under the line', () => {
    expect(landAt(40, { section: 'all', index: 2 })).toEqual({ section: 'all', index: 0 });
  });

  it('into another group — an empty one, or the end of a folded one', () => {
    expect(landAt(170, { section: 'todo', index: 0 }, grouped)).toEqual({ section: 'doing', index: 0 });
    expect(landAt(236, { section: 'todo', index: 1 }, grouped)).toEqual({ section: 'done', index: 5 });
  });
});

describe('columns', () => {
  const cols = [{ id: 'name', left: 0, right: 260 }, { id: 'status', left: 260, right: 430 }, { id: 'due', left: 430, right: 600 }];

  it('a gap before each column and one after the last', () => {
    expect(columnGaps(cols)).toEqual([{ beforeId: 'name', x: 0 }, { beforeId: 'status', x: 260 }, { beforeId: 'due', x: 430 }, { beforeId: null, x: 600 }]);
  });

  it('moveBefore: to a new place, to the end, and no move at all', () => {
    const order = ['name', 'status', 'due'];
    expect(moveBefore(order, 'due', 'name')).toEqual(['due', 'name', 'status']);
    expect(moveBefore(order, 'name', null)).toEqual(['status', 'due', 'name']);
    expect(moveBefore(order, 'status', 'due')).toBeNull(); // already right before due
    expect(moveBefore(order, 'status', 'status')).toBeNull();
    expect(moveBefore(order, 'due', null)).toBeNull();
    expect(moveBefore(order, 'gone', 'name')).toBeNull();
  });

  it('moving a column past hidden ones keeps the hidden ones where they were', () => {
    // `hidden` sits between status and due in the view's full order.
    expect(moveBefore(['name', 'status', 'hidden', 'due'], 'name', 'due')).toEqual(['status', 'hidden', 'name', 'due']);
  });
});

describe('frozenOrder — a sorted table held still, one row moved', () => {
  const shown = ['c', 'a', 'd', 'b'];
  it('before the row it was dropped above', () => expect(frozenOrder(shown, 'b', { beforeId: 'a' })).toEqual(['c', 'b', 'a', 'd']));
  it('after the last row of its group when dropped at the end', () => expect(frozenOrder(shown, 'c', { afterId: 'd' })).toEqual(['a', 'd', 'c', 'b']));
  it('last when there is nothing to place it by', () => expect(frozenOrder(shown, 'a', {})).toEqual(['c', 'd', 'b', 'a']));
});
