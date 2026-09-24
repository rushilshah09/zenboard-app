import { describe, it, expect } from 'vitest';
import { readRailState, railStateHref, type RailState } from './types';

const parse = (qs: string) => readRailState(new URLSearchParams(qs));

describe('readRailState / railStateHref', () => {
  it('reads the default', () => {
    expect(parse('')).toEqual({ view: 'inbox', scope: null, filter: 'all', labelId: null, layout: 'list' });
  });

  it('round-trips every combo', () => {
    // The URL is the single source of truth now that rail clicks are pushState
    // rather than navigations — a combo that does not survive the round trip is
    // a click that lands somewhere else than it says.
    const combos: RailState[] = [
      { view: 'inbox', scope: null, filter: 'all', labelId: null, layout: 'list' },
      { view: 'today', scope: null, filter: 'all', labelId: null, layout: 'list' },
      { view: 'completed', scope: null, filter: 'high', labelId: 'L1', layout: 'list' },
      { view: 'inbox', scope: 'project:p1', filter: 'all', labelId: null, layout: 'list' },
      { view: 'inbox', scope: 'list:l1', filter: 'recurring', labelId: null, layout: 'list' },
      { view: 'inbox', scope: null, filter: 'all', labelId: null, layout: 'board' },
      { view: 'inbox', scope: null, filter: 'all', labelId: null, layout: 'week' },
    ];
    for (const c of combos) {
      const href = railStateHref(c);
      expect(parse(href.split('?')[1] ?? ''), href).toEqual(c);
    }
  });

  it('keeps the clean URL clean', () => {
    expect(railStateHref({ view: 'inbox', scope: null, filter: 'all', labelId: null, layout: 'list' })).toBe('/tasks');
  });

  it('still understands the pre-0038 ?list= link', () => {
    // Bookmarks and saved views wrote a bare project id under `list`.
    expect(parse('list=p1').scope).toBe('project:p1');
  });

  it('a layout wins the view slot without losing the view', () => {
    // `?view=` carries both ideas. Board mode must not silently reset which
    // rail row you were on when you switch back.
    const board: RailState = { view: 'today', scope: null, filter: 'all', labelId: null, layout: 'board' };
    expect(railStateHref(board)).toBe('/tasks?view=board');
    // …and coming back off the board lands on inbox, which is the honest
    // reading of that URL rather than a hidden memory.
    expect(parse('view=board').view).toBe('inbox');
  });

  it('ignores an unknown view rather than failing a shared link', () => {
    expect(parse('view=nonsense').view).toBe('inbox');
    expect(parse('view=nonsense').layout).toBe('list');
  });
});
