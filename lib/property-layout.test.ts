import { describe, it, expect } from 'vitest';
import {
  PROP_SETS, EMPTY_LAYOUT, PREF_KEY, MAX_KEYS,
  readPropLayout, readPropLayouts, writePropLayouts,
  fullOrder, arrangeProps, moveProp, reorderProps, hideProp, showProp,
  isArranged, resetPropLayout, type PropLayout,
} from './property-layout';

/** The project header's real keys, in their declared order. */
const DECLARED = ['status', 'health', 'progress', 'deadline', 'client', 'started', 'sharing']
  .map((key) => ({ key }));
const keys = (ps: readonly { key: string }[]) => ps.map((p) => p.key);
const layout = (over: Partial<PropLayout> = {}): PropLayout => ({ ...EMPTY_LAYOUT, ...over });

describe('reading a layout out of preferences', () => {
  it('reads nothing as no opinion', () => {
    expect(readPropLayout(null, 'project')).toEqual(EMPTY_LAYOUT);
    expect(readPropLayout({}, 'project')).toEqual(EMPTY_LAYOUT);
    expect(readPropLayout({ [PREF_KEY]: {} }, 'project')).toEqual(EMPTY_LAYOUT);
  });

  it('reads junk as no opinion rather than throwing', () => {
    // The column is free-form, so the reader decides what is valid. Corrupt
    // preferences must render the declared defaults, not an error.
    expect(readPropLayout({ [PREF_KEY]: 'nope' }, 'project')).toEqual(EMPTY_LAYOUT);
    expect(readPropLayout({ [PREF_KEY]: { project: 7 } }, 'project')).toEqual(EMPTY_LAYOUT);
    expect(readPropLayout({ [PREF_KEY]: { project: { order: 'abc' } } }, 'project')).toEqual(EMPTY_LAYOUT);
  });

  it('drops non-strings, blanks and duplicates', () => {
    const prefs = { [PREF_KEY]: { project: { order: ['a', 'a', '', 3, null, 'b'], hidden: ['b', 'b'] } } };
    expect(readPropLayout(prefs, 'project')).toEqual({ order: ['a', 'b'], hidden: ['b'] });
  });

  it('caps the stored key count', () => {
    const many = Array.from({ length: MAX_KEYS + 40 }, (_, i) => `k${i}`);
    expect(readPropLayout({ [PREF_KEY]: { project: { order: many } } }, 'project').order)
      .toHaveLength(MAX_KEYS);
  });

  it('keeps each set separate', () => {
    const prefs = { [PREF_KEY]: { project: { order: ['status'] }, client: { order: ['email'] } } };
    expect(readPropLayout(prefs, 'project').order).toEqual(['status']);
    expect(readPropLayout(prefs, 'client').order).toEqual(['email']);
    expect(Object.keys(readPropLayouts(prefs)).sort()).toEqual([...PROP_SETS].sort());
  });
});

describe('the write shape', () => {
  it('omits a set nobody has arranged, so the column stays honest', () => {
    expect(writePropLayouts({ project: EMPTY_LAYOUT })).toEqual({ [PREF_KEY]: {} });
  });

  it('normalises on the way out as well as in', () => {
    const written = writePropLayouts({ project: { order: ['a', 'a', 'b'], hidden: ['', 'b'] } });
    expect(written).toEqual({ [PREF_KEY]: { project: { order: ['a', 'b'], hidden: ['b'] } } });
  });

  it('round-trips through a read', () => {
    const before: PropLayout = { order: ['client', 'status', 'progress'], hidden: ['status'] };
    expect(readPropLayout(writePropLayouts({ project: before }), 'project')).toEqual(before);
  });

  it('carries the sets it was given and no others', () => {
    const written = writePropLayouts({ client: { order: ['email'], hidden: [] } }) as Record<string, Record<string, unknown>>;
    expect(Object.keys(written[PREF_KEY])).toEqual(['client']);
  });
});

describe('arranging', () => {
  it('renders the declared order when there is no opinion', () => {
    expect(keys(arrangeProps(DECLARED, EMPTY_LAYOUT).visible)).toEqual(keys(DECLARED));
    expect(arrangeProps(DECLARED, EMPTY_LAYOUT).hidden).toEqual([]);
  });

  it('renders the stored order', () => {
    const l = layout({ order: ['client', 'deadline', 'status'] });
    // The three it knows about first, then everything it has never seen.
    expect(keys(arrangeProps(DECLARED, l).visible))
      .toEqual(['client', 'deadline', 'status', 'health', 'progress', 'started', 'sharing']);
  });

  it('appends a property the stored order has never seen, rather than dropping it', () => {
    // A built-in added in a release must SHOW UP for someone who has arranged
    // their header — otherwise the feature ships invisible to the exact people
    // who use this block.
    const l = layout({ order: ['status', 'progress'] });
    const withNew = [...DECLARED, { key: 'budget' }];
    expect(keys(arrangeProps(withNew, l).visible)).toContain('budget');
    expect(keys(arrangeProps(withNew, l).visible).at(-1)).toBe('budget');
  });

  it('puts hidden properties aside', () => {
    const l = layout({ hidden: ['sharing', 'started'] });
    const { visible, hidden } = arrangeProps(DECLARED, l);
    expect(keys(visible)).toEqual(['status', 'health', 'progress', 'deadline', 'client']);
    expect(keys(hidden)).toEqual(['started', 'sharing']);
  });

  it('does not count a hidden property that is not on screen', () => {
    // The real sequence, not a shorthand for it: hide Sharing WHILE it is on
    // screen — which writes it into `order` — and only then turn the portal off.
    // Starting from `{ hidden: ['sharing'] }` with nothing in `order` would pass
    // this test through the never-seen-that-key path and prove nothing about the
    // guard, because "1 hidden" with no way to restore it is precisely the bug.
    const noPortal = DECLARED.filter((d) => d.key !== 'sharing');
    const l = hideProp(layout(), DECLARED, 'sharing');
    expect(l.order).toContain('sharing');
    expect(arrangeProps(DECLARED, l).hidden.map((p) => p.key)).toEqual(['sharing']);
    expect(arrangeProps(noPortal, l).hidden).toEqual([]);
  });

  it('ignores a stored key for a property that does not exist', () => {
    const l = layout({ order: ['retired', 'status'] });
    expect(keys(arrangeProps(DECLARED, l).visible)[0]).toBe('status');
  });
});

describe('a conditional row keeps its place', () => {
  it('does not drift to the end while it is off screen', () => {
    // Deadline is second. The project loses its deadline, the person reorders
    // something else, and the deadline comes back — it must return to second.
    let l = moveProp(layout(), DECLARED, 'deadline', -1);
    l = moveProp(l, DECLARED, 'deadline', -1);
    l = moveProp(l, DECLARED, 'deadline', -1);
    expect(keys(arrangeProps(DECLARED, l).visible)[0]).toBe('deadline');

    const noDeadline = DECLARED.filter((d) => d.key !== 'deadline');
    const after = hideProp(l, noDeadline, 'sharing');
    expect(after.order).toContain('deadline');
    expect(keys(arrangeProps(DECLARED, after).visible)[0]).toBe('deadline');
  });
});

describe('move', () => {
  it('swaps with the neighbour above', () => {
    const l = moveProp(layout(), DECLARED, 'progress', -1);
    expect(keys(arrangeProps(DECLARED, l).visible).slice(0, 3)).toEqual(['status', 'progress', 'health']);
  });

  it('swaps with the neighbour below', () => {
    const l = moveProp(layout(), DECLARED, 'status', 1);
    expect(keys(arrangeProps(DECLARED, l).visible).slice(0, 2)).toEqual(['health', 'status']);
  });

  it('skips a hidden neighbour — a control that appears to do nothing is the worst kind', () => {
    const l = moveProp(layout({ hidden: ['health'] }), DECLARED, 'progress', -1);
    const { visible } = arrangeProps(DECLARED, l);
    expect(keys(visible).slice(0, 2)).toEqual(['progress', 'status']);
    // ...and the hidden one is still hidden, still between them in the order.
    expect(l.hidden).toEqual(['health']);
    expect(l.order.indexOf('health')).toBe(1);
  });

  it('is a no-op at either end', () => {
    const top = layout();
    expect(moveProp(top, DECLARED, 'status', -1)).toBe(top);
    expect(moveProp(top, DECLARED, 'sharing', 1)).toBe(top);
  });

  it('is a no-op for a property that is hidden or unknown', () => {
    const l = layout({ hidden: ['status'] });
    expect(moveProp(l, DECLARED, 'status', 1)).toBe(l);
    expect(moveProp(l, DECLARED, 'nonsense', 1)).toBe(l);
  });
});

describe('drag', () => {
  it('moves a property to an index among the visible ones', () => {
    const l = reorderProps(layout(), DECLARED, 0, 2);
    expect(keys(arrangeProps(DECLARED, l).visible).slice(0, 3)).toEqual(['health', 'progress', 'status']);
  });

  it('leaves hidden keys at their own indices', () => {
    const before = layout({ hidden: ['health'] });
    const l = reorderProps(before, DECLARED, 0, 2);
    // Visible was [status, progress, deadline, …]; status goes third.
    expect(keys(arrangeProps(DECLARED, l).visible).slice(0, 3)).toEqual(['progress', 'deadline', 'status']);
    expect(l.order.indexOf('health')).toBe(1);
    expect(arrangeProps(DECLARED, l).hidden.map((p) => p.key)).toEqual(['health']);
  });

  it('treats an out-of-range or cancelled drag as no change, not an error', () => {
    const before = layout();
    expect(reorderProps(before, DECLARED, 2, 2)).toBe(before);
    expect(reorderProps(before, DECLARED, -1, 2)).toBe(before);
    expect(reorderProps(before, DECLARED, 0, 99)).toBe(before);
  });
});

describe('hide and show', () => {
  it('restores a property to where it was, not to the end', () => {
    const moved = moveProp(layout(), DECLARED, 'client', -1);
    const at = keys(arrangeProps(DECLARED, moved).visible).indexOf('client');
    const back = showProp(hideProp(moved, DECLARED, 'client'), 'client');
    expect(keys(arrangeProps(DECLARED, back).visible).indexOf('client')).toBe(at);
  });

  it('hiding twice is the same as hiding once', () => {
    const once = hideProp(layout(), DECLARED, 'status');
    expect(hideProp(once, DECLARED, 'status')).toBe(once);
  });

  it('showing something that is not hidden is a no-op', () => {
    const l = layout();
    expect(showProp(l, 'status')).toBe(l);
  });

  it('can hide every property', () => {
    // Notion and Linear both allow it, and "N hidden" is always the way back.
    let l = layout();
    for (const d of DECLARED) l = hideProp(l, DECLARED, d.key);
    const { visible, hidden } = arrangeProps(DECLARED, l);
    expect(visible).toEqual([]);
    expect(hidden).toHaveLength(DECLARED.length);
  });
});

describe('reset', () => {
  it('only offers itself once something has been arranged', () => {
    expect(isArranged(EMPTY_LAYOUT)).toBe(false);
    expect(isArranged(layout({ hidden: ['status'] }))).toBe(true);
    expect(isArranged(moveProp(layout(), DECLARED, 'status', 1))).toBe(true);
  });

  it('brings everything back in the declared order', () => {
    const arranged = hideProp(moveProp(layout(), DECLARED, 'client', -1), DECLARED, 'status');
    expect(keys(arrangeProps(DECLARED, resetPropLayout()).visible)).toEqual(keys(DECLARED));
    expect(isArranged(arranged)).toBe(true);
  });
});
