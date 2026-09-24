import { describe, it, expect } from 'vitest';
import type { ViewDef } from './collections';
import { duplicateView, matchViews, orderViews, removeView, viewFromHash, viewLink, visibleTabs } from './view-list';

const v = (id: string, name = id, extra: Partial<ViewDef> = {}): ViewDef => ({ id, name, kind: 'table', ...extra });
const ids = (views: ViewDef[]) => views.map((x) => x.id);

describe('visibleTabs — three tabs, then "N more…"', () => {
  const four = [v('a'), v('b'), v('c'), v('d')];

  it('shows every view while there are three or fewer', () => {
    expect(visibleTabs(four.slice(0, 3), 'a')).toEqual({ tabs: four.slice(0, 3), more: 0 });
  });

  it('folds the fourth view away, and counts it', () => {
    const { tabs, more } = visibleTabs(four, 'b');
    expect(ids(tabs)).toEqual(['a', 'b', 'c']);
    expect(more).toBe(1);
  });

  it('never folds away the view you are on: it takes the last tab', () => {
    expect(ids(visibleTabs(four, 'd').tabs)).toEqual(['a', 'b', 'd']);
    expect(ids(visibleTabs([...four, v('e')], 'e').tabs)).toEqual(['a', 'b', 'e']);
  });
});

describe('matchViews — "Search for a view…"', () => {
  const views = [v('a', 'Board'), v('b', 'Launch table'), v('c', 'board by owner')];
  it('matches names regardless of case', () => expect(ids(matchViews(views, 'BOARD'))).toEqual(['a', 'c']));
  it('an empty search lists every view', () => expect(matchViews(views, '  ')).toBe(views));
});

describe('duplicateView', () => {
  it('puts a copy right after its source, with everything but the id and name', () => {
    const source = v('b', 'Board', { kind: 'board', groupBy: 'status', sorts: [{ prop: 'title', dir: 'asc' }], hidden: ['x'] });
    const out = duplicateView([v('a'), source, v('c')], 'b', 'new')!;
    expect(ids(out.views)).toEqual(['a', 'b', 'new', 'c']);
    expect(out.copy).toEqual({ ...source, id: 'new', name: 'Board copy' });
  });

  it('shares nothing with its source: editing the copy leaves the source alone', () => {
    const source = v('b', 'Board', { sorts: [{ prop: 'title', dir: 'asc' }] });
    const { copy } = duplicateView([source], 'b', 'new')!;
    copy.sorts!.push({ prop: 'x', dir: 'desc' });
    expect(source.sorts).toHaveLength(1);
  });

  it('names a nameless view', () => expect(duplicateView([v('a', ' ')], 'a', 'n')!.copy.name).toBe('Untitled copy'));
  it('does nothing for a view that is not there', () => expect(duplicateView([v('a')], 'zz')).toBeNull());
});

describe('removeView', () => {
  it('shows the view before the one removed', () => {
    expect(removeView([v('a'), v('b'), v('c')], 'c')).toEqual({ views: [v('a'), v('b')], nextId: 'b' });
  });
  it('shows the next view when the first goes', () => {
    expect(removeView([v('a'), v('b')], 'a')!.nextId).toBe('b');
  });
  it('keeps the last view', () => expect(removeView([v('a')], 'a')).toBeNull());
});

describe('orderViews', () => {
  it('follows the order dragged, keeping views the list did not name', () => {
    expect(ids(orderViews([v('a'), v('b'), v('c'), v('d')], ['c', 'a', 'b']))).toEqual(['c', 'a', 'b', 'd']);
  });
  it('ignores ids that are no longer views', () => {
    expect(ids(orderViews([v('a'), v('b')], ['gone', 'b', 'a']))).toEqual(['b', 'a']);
  });
});

describe('links to a view', () => {
  const views = [v('k3x9'), v('m2')];
  it('reads the view a link names', () => expect(viewFromHash('#view-m2', views)).toBe('m2'));
  it('ignores a link to a view this database does not have, and other anchors', () => {
    expect(viewFromHash('#view-nope', views)).toBeUndefined();
    expect(viewFromHash('#heading-3', views)).toBeUndefined();
    expect(viewFromHash('', views)).toBeUndefined();
  });
  it('writes a link that reads back, replacing any anchor already there', () => {
    const link = viewLink('https://app.zenboard.io/documents?page=1#view-old', 'k3x9');
    expect(link).toBe('https://app.zenboard.io/documents?page=1#view-k3x9');
    expect(viewFromHash(new URL(link).hash, views)).toBe('k3x9');
  });
});
