import { describe, it, expect } from 'vitest';
import {
  PROP_TYPES, propDef, propLabel, isOptioned, isComputed, propTypesFor,
  normalizePropType, normalizeOption, type PropType,
} from './properties';
import { PALETTE_NAMES } from './palette';
import { OPTION_COLORS, optionTokens, nextColor, normalizeProps } from './collections';

describe('the registry', () => {
  it('has exactly one entry per type', () => {
    const seen = new Set(PROP_TYPES.map((d) => d.type));
    expect(seen.size).toBe(PROP_TYPES.length);
  });

  it('gives every type a label', () => {
    for (const d of PROP_TYPES) expect(d.label, d.type).toBeTruthy();
  });

  it('offers the page 20 types and the database 13 — the difference is a decision, not drift', () => {
    // If either number moves, it should be because a renderer was added or a
    // type was withheld, and this line is where that gets acknowledged.
    expect(propTypesFor('page')).toHaveLength(20);
    expect(propTypesFor('database')).toHaveLength(13);
  });

  // A type offered on NO surface is the honest state for one the app knows but
  // cannot yet honour. Locked to an exact list so a type can never drop out of a
  // picker by accident — the failure this mechanism exists to make visible.
  it('withholds exactly the two types nothing can honour', () => {
    // `button` is withdrawn on doctrine (§7P: no user-defined triggers) and
    // `rollup` aggregates across a relation it has no engine for on a page.
    expect(PROP_TYPES.filter((d) => d.surfaces.length === 0).map((d) => d.type).sort())
      .toEqual(['button', 'rollup']);
  });

  it('still RESOLVES a withheld type, so a property already saved with one renders', () => {
    // Withdrawing a type must never turn existing data into junk: `propDef` still
    // knows it, which is what stops the page falling back to 'text' and quietly
    // reinterpreting the value.
    expect(propDef('button').label).toBe('Button');
    expect(propDef('rollup').label).toBe('Rollup');
    expect(isComputed('rollup')).toBe(true);
    expect(normalizePropType('rollup')).toBe('rollup');
  });

  it('offers files, place, relation and formula on the page, because all four render', () => {
    const page = propTypesFor('page').map((d) => d.type);
    for (const t of ['files', 'place', 'relation', 'formula']) expect(page).toContain(t);
  });

  it('offers formula on BOTH surfaces — one language, one editor', () => {
    // The database rendered formula cells long before anything could create one;
    // what closed the gap was the editor, not the engine.
    expect(propTypesFor('database').map((d) => d.type)).toContain('formula');
  });

  it('never offers a structural type in a picker', () => {
    for (const s of ['page', 'database'] as const) {
      expect(propTypesFor(s).some((d) => d.type === 'title')).toBe(false);
    }
  });

  it('agrees with itself about optioned and computed', () => {
    expect(PROP_TYPES.filter((d) => d.optioned).map((d) => d.type))
      .toEqual(['select', 'multi_select', 'status']);
    // Every computed type owns its own value, so none of them can also be optioned.
    for (const d of PROP_TYPES) expect(!!(d.computed && d.optioned), d.type).toBe(false);
  });
});

describe('normalizePropType', () => {
  it('passes canonical names through', () => {
    for (const d of PROP_TYPES) expect(normalizePropType(d.type)).toBe(d.type);
  });

  it('maps the database vocabulary onto the page one', () => {
    // The whole point of the merge: `updated_time` and `last_edited_time` were
    // the same concept spelled two ways, and both are already in stored JSON.
    expect(normalizePropType('updated_time')).toBe('last_edited_time');
    expect(normalizePropType('updated_by')).toBe('last_edited_by');
  });

  it('falls back to text for junk rather than throwing', () => {
    expect(normalizePropType('nonsense')).toBe('text');
    expect(normalizePropType(undefined)).toBe('text');
    expect(normalizePropType(null)).toBe('text');
    expect(normalizePropType('')).toBe('text');
  });

  it('makes every reader tolerant of a legacy spelling', () => {
    expect(propLabel('updated_time')).toBe('Last edited time');
    expect(isComputed('updated_time')).toBe(true);
    expect(propDef('updated_time').type).toBe('last_edited_time');
  });
});

describe('capability predicates', () => {
  it('classifies the option types', () => {
    expect(isOptioned('select')).toBe(true);
    expect(isOptioned('multi_select')).toBe(true);
    expect(isOptioned('status')).toBe(true);
    expect(isOptioned('text')).toBe(false);
  });

  it('classifies the computed types — including the page-only ones the database list missed', () => {
    for (const t of ['formula', 'rollup', 'created_time', 'last_edited_time'] as PropType[]) {
      expect(isComputed(t), t).toBe(true);
    }
    // prop-convert's own COMPUTED list had none of these, so converting a
    // column TO one of them was not treated as discarding data.
    for (const t of ['created_by', 'last_edited_by', 'id'] as PropType[]) {
      expect(isComputed(t), t).toBe(true);
    }
    expect(isComputed('text')).toBe(false);
  });
});

describe('normalizeOption', () => {
  it('accepts the page shape and returns the canonical one', () => {
    expect(normalizeOption({ id: 'o1', label: 'Done', color: 'green' }))
      .toEqual({ id: 'o1', name: 'Done', color: 'green' });
  });

  it('leaves an already-canonical option alone', () => {
    expect(normalizeOption({ id: 'o1', name: 'Done', color: 'green' }))
      .toEqual({ id: 'o1', name: 'Done', color: 'green' });
  });

  it('survives an option with neither', () => {
    expect(normalizeOption({ id: 'o1', color: 'gray' })).toEqual({ id: 'o1', name: '', color: 'gray' });
  });
});

describe('one palette', () => {
  // There were four copies of this list: lib/palette (the real one), an
  // identical `OptionColor` in collections, and an eight-long, differently
  // ordered one in prop-convert — so options a text→select conversion invented
  // were coloured from a different sequence than options added by hand.
  it('collections re-exports the app palette rather than declaring its own', () => {
    expect(OPTION_COLORS).toBe(PALETTE_NAMES);
    expect(OPTION_COLORS).toHaveLength(9);
  });

  it('option tokens resolve to the --pal-* variables', () => {
    expect(optionTokens('green')).toMatchObject({
      dot: 'var(--pal-green-dot)', bg: 'var(--pal-green-bg)', text: 'var(--pal-green-text)',
    });
  });

  it('cycles colours without running off the end', () => {
    expect(nextColor(0)).toBe(PALETTE_NAMES[0]);
    expect(nextColor(9)).toBe(PALETTE_NAMES[0]);
    expect(nextColor(23)).toBe(PALETTE_NAMES[23 % 9]);
  });
});

describe('normalizeProps', () => {
  it('migrates a stored collection forward in one pass', () => {
    expect(normalizeProps([
      { id: 'title', name: 'Name', type: 'title' },
      { id: 'a', name: 'Edited', type: 'updated_time' as PropType },
      { id: 'b', name: 'Stage', type: 'status', options: [{ id: 'o1', label: 'Open', color: 'blue' } as never] },
    ])).toEqual([
      { id: 'title', name: 'Name', type: 'title' },
      { id: 'a', name: 'Edited', type: 'last_edited_time' },
      { id: 'b', name: 'Stage', type: 'status', options: [{ id: 'o1', name: 'Open', color: 'blue' }] },
    ]);
  });

  it('handles a collection with no props', () => {
    expect(normalizeProps(undefined)).toEqual([]);
    expect(normalizeProps(null)).toEqual([]);
  });
});
