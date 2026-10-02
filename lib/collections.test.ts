import { describe, it, expect } from 'vitest';
import {
  defaultCollection, normalizeCollection, openPagesIn, layoutOptions, galleryCardMin, LAYOUT_OPTION_LABEL,
  VIEW_KINDS, type ViewDef,
} from './collections';

describe('defaultCollection — what a new database starts with', () => {
  it('a table: Name, Status and Tags, seen as a table', () => {
    const { props, views } = defaultCollection();
    expect(props.map((p) => p.name)).toEqual(['Name', 'Status', 'Tags']);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ kind: 'table', name: 'Table' });
  });

  it('a calendar starts with a date to place its rows by', () => {
    // Without one, a new calendar database opened on "Add a date property to
    // see these rows on a calendar" — a layout that could show nothing.
    const { props, views } = defaultCollection('calendar');
    const date = props.find((p) => p.type === 'date');
    expect(date?.name).toBe('Date');
    expect(views[0]).toMatchObject({ kind: 'calendar', name: 'Calendar', dateProp: date!.id });
  });

  it('names its first view after its layout', () => {
    expect(defaultCollection('board').views[0]).toMatchObject({ kind: 'board', name: 'Board' });
    expect(defaultCollection('gallery').props.some((p) => p.type === 'date')).toBe(false);
  });
});

describe('openPagesIn — how a view opens the pages in it', () => {
  // The brief's §8, after Notion: you work THROUGH a table, board, list or timeline,
  // so its page opens on the side and the view stays live beside it; a gallery,
  // calendar or feed is looked at one item at a time, so its page opens centred.
  it('opens on the side where you work through rows', () => {
    for (const kind of ['table', 'board', 'list', 'timeline'] as const) {
      expect(openPagesIn({ kind }), kind).toBe('side-peek');
    }
  });

  it('opens in the centre where you look at one item at a time', () => {
    for (const kind of ['gallery', 'calendar', 'feed'] as const) {
      expect(openPagesIn({ kind }), kind).toBe('center-peek');
    }
  });

  it("honours the view's own choice over its layout's default", () => {
    expect(openPagesIn({ kind: 'table', openIn: 'full-page' })).toBe('full-page');
    expect(openPagesIn({ kind: 'gallery', openIn: 'side-peek' })).toBe('side-peek');
  });

  it('gives every layout a default, so no view can open a page nowhere', () => {
    for (const kind of VIEW_KINDS) {
      expect(['side-peek', 'center-peek', 'full-page'], kind).toContain(openPagesIn({ kind }));
    }
  });

  it('reads a stored value it does not know as the default, and the normalizer drops it', () => {
    // Views are JSON: a retired or mistyped mode survives in the data. It must
    // neither open a page in a mode that does not exist nor be written back.
    const odd = { id: 'v1', name: 'Board', kind: 'board', openIn: 'popup' } as unknown as ViewDef;
    expect(openPagesIn(odd)).toBe('side-peek');
    const col = normalizeCollection({
      props: [],
      views: [odd, { id: 'v2', name: 'Gallery', kind: 'gallery', openIn: 'full-page' } as ViewDef],
    });
    expect(col.views[0]).not.toHaveProperty('openIn');
    expect(col.views[1].openIn).toBe('full-page');
  });
});

describe('layoutOptions — a layout offers only what applies to it', () => {
  // The brief's §7, after Notion's Layout panel: each layout has settings of its own,
  // and the panel never shows one that does nothing in the layout on screen.
  it('gives each layout its own settings, and nothing that belongs to another', () => {
    expect(layoutOptions('table')).toEqual(['verticalLines', 'hideEmptyGroups']);
    expect(layoutOptions('board')).toEqual(['groupBy', 'colorColumns', 'hideEmptyGroups']);
    expect(layoutOptions('gallery')).toEqual(['cardSize']);
    expect(layoutOptions('calendar')).toEqual(['calendarBy', 'showWeekends']);
    expect(layoutOptions('timeline')).toEqual(['timelineBy', 'timelineEnd']);
    expect(layoutOptions('list')).toEqual([]);
  });

  it('drops a timeline zoom it does not know', () => {
    const col = normalizeCollection({ props: [], views: [{ id: 'v', name: 'Timeline', kind: 'timeline', zoom: 'decade' } as unknown as ViewDef] });
    expect(col.views[0]).not.toHaveProperty('zoom');
  });

  it('names every option it offers', () => {
    for (const kind of VIEW_KINDS) {
      for (const option of layoutOptions(kind)) expect(LAYOUT_OPTION_LABEL[option], `${kind} · ${option}`).toBeTruthy();
    }
  });

  it('sizes gallery cards by the view, medium when unset', () => {
    expect(galleryCardMin(undefined)).toBe(220);
    expect([galleryCardMin('small'), galleryCardMin('medium'), galleryCardMin('large')]).toEqual([180, 220, 300]);
  });

  it('drops a card size it does not know, so a gallery never sizes by a typo', () => {
    const col = normalizeCollection({ props: [], views: [{ id: 'v', name: 'Gallery', kind: 'gallery', cardSize: 'huge' } as unknown as ViewDef] });
    expect(col.views[0]).not.toHaveProperty('cardSize');
  });
});

describe('normalizeCollection — a view’s column order and title switch are JSON too', () => {
  it('keeps a well-formed column order and title switch', () => {
    const col = normalizeCollection({ props: [], views: [{ id: 'v', name: 'Table', kind: 'table', propOrder: ['a', 'b'], showTitle: false } as ViewDef] });
    expect(col.views[0]).toMatchObject({ propOrder: ['a', 'b'], showTitle: false });
  });

  it('drops a column order that is not a list of ids, and a title switch that is not a switch', () => {
    const odd = { id: 'v', name: 'Table', kind: 'table', propOrder: 'a,b', showTitle: 'no' } as unknown as ViewDef;
    const mixed = { id: 'w', name: 'Board', kind: 'board', propOrder: ['a', 3] } as unknown as ViewDef;
    const col = normalizeCollection({ props: [], views: [odd, mixed] });
    expect(col.views[0]).not.toHaveProperty('propOrder');
    expect(col.views[0]).not.toHaveProperty('showTitle');
    expect(col.views[1]).not.toHaveProperty('propOrder');
  });
});
