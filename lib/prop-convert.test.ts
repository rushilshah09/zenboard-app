import { describe, it, expect } from 'vitest';
import { planConversion, valueToText, MAX_INVENTED_OPTIONS } from './prop-convert';
import { PALETTE_NAMES } from './palette';
import type { PropDef } from './collections';

const rows = (vals: unknown[], propId = 'p') =>
  vals.map((v, i) => ({ id: 'r' + i, data: { [propId]: v } }));

const text: PropDef = { id: 'p', name: 'Text', type: 'text' };
const num: PropDef = { id: 'p', name: 'Num', type: 'number' };
const date: PropDef = { id: 'p', name: 'Due', type: 'date' };
const sel: PropDef = { id: 'p', name: 'Stage', type: 'select', options: [
  { id: 'a', name: 'Alpha', color: 'blue' },
  { id: 'b', name: 'Beta', color: 'green' },
] };
const multi: PropDef = { ...sel, type: 'multi_select' };

describe('valueToText', () => {
  it('reads an option id back as its NAME, not the id', () => {
    expect(valueToText('a', sel)).toBe('Alpha');
    expect(valueToText(['a', 'b'], multi)).toBe('Alpha, Beta');
  });
  it('renders checkboxes and empties', () => {
    expect(valueToText(true, { id: 'p', name: 'C', type: 'checkbox' })).toBe('Yes');
    expect(valueToText(null, text)).toBe('');
    expect(valueToText([], multi)).toBe('');
  });
});

describe('anything → computed destroys values (§5.21)', () => {
  it('clears every value and says how many', () => {
    const plan = planConversion(text, 'formula', rows(['a', 'b', null]));
    expect(plan.lost).toBe(2);
    expect(plan.kept).toBe(0);
    expect(plan.lossless).toBe(false);
    expect(plan.warnings[0]).toMatch(/2 existing values will be deleted/);
    expect([...plan.values.values()].every((v) => v === undefined)).toBe(true);
  });
  it('warns about nothing when the column was empty', () => {
    const plan = planConversion(text, 'rollup', rows([null, '']));
    expect(plan.warnings).toEqual([]);
    expect(plan.lossless).toBe(true);
  });
});

describe('select ↔ multi-select', () => {
  it('select → multi-select is lossless', () => {
    const plan = planConversion(sel, 'multi_select', rows(['a', 'b']));
    expect(plan.lossless).toBe(true);
    expect(plan.values.get('r0')).toEqual(['a']);
    expect(plan.warnings).toEqual([]);
  });
  it('multi → select keeps the FIRST value and warns only for rows that lose one', () => {
    const plan = planConversion(multi, 'select', rows([['a', 'b'], ['b'], null]));
    expect(plan.values.get('r0')).toBe('a');   // extras dropped
    expect(plan.values.get('r1')).toBe('b');   // single value, no loss
    expect(plan.lost).toBe(1);
    expect(plan.kept).toBe(1);
    expect(plan.warnings[0]).toMatch(/1 row have|1 row /);
  });
});

describe('text → select invents options', () => {
  it('creates one option per DISTINCT value, case-insensitively', () => {
    const plan = planConversion(text, 'select', rows(['Design', 'design', 'Dev', '']));
    expect(plan.options?.length).toBe(2);
    expect(plan.values.get('r0')).toBe(plan.values.get('r1')); // same option reused
    expect(plan.values.get('r3')).toBeUndefined();
    expect(plan.lossless).toBe(true);
  });
  it('colours them from the app palette — the same sequence a hand-added option gets', () => {
    // This file used to keep its own eight-colour list in a different order, so
    // options a conversion invented were coloured from a different sequence
    // than options you added by hand, in the very same column.
    const plan = planConversion(text, 'select', rows(['a', 'b', 'c']));
    expect(plan.options?.map((o) => o.color)).toEqual(PALETTE_NAMES.slice(0, 3));
  });
  it('keeps cycling colours past the end of the palette', () => {
    const many = Array.from({ length: PALETTE_NAMES.length + 2 }, (_, i) => `v${i}`);
    const plan = planConversion(text, 'select', rows(many));
    expect(plan.options?.at(PALETTE_NAMES.length)?.color).toBe(PALETTE_NAMES[0]);
  });
  it('stops at the option cap and clears the overflow rather than mis-assigning', () => {
    const many = Array.from({ length: MAX_INVENTED_OPTIONS + 5 }, (_, i) => `v${i}`);
    const plan = planConversion(text, 'select', rows(many));
    expect(plan.options?.length).toBe(MAX_INVENTED_OPTIONS);
    expect(plan.lost).toBe(5);
    expect(plan.lossless).toBe(false);
    expect(plan.warnings.some((w) => w.includes(String(MAX_INVENTED_OPTIONS)))).toBe(true);
  });
});

describe('→ number parses and clears what will not', () => {
  it('keeps numerics, strips separators, clears the rest', () => {
    const plan = planConversion(text, 'number', rows(['12', '1,200', 'twelve', '']));
    expect(plan.values.get('r0')).toBe(12);
    expect(plan.values.get('r1')).toBe(1200);
    expect(plan.values.get('r2')).toBeUndefined();
    expect(plan.lost).toBe(1);
    expect(plan.warnings[0]).toMatch(/not numbers/);
  });
  it('converts a select through its option NAME', () => {
    const numbered: PropDef = { id: 'p', name: 'S', type: 'select', options: [{ id: 'x', name: '42', color: 'blue' }] };
    expect(planConversion(numbered, 'number', rows(['x'])).values.get('r0')).toBe(42);
  });
});

describe('→ checkbox', () => {
  it('only explicit truthy words check the box', () => {
    const plan = planConversion(text, 'checkbox', rows(['yes', 'TRUE', 'nope', null]));
    expect(plan.values.get('r0')).toBe(true);
    expect(plan.values.get('r1')).toBe(true);
    expect(plan.values.get('r2')).toBe(false);
    expect(plan.lost).toBe(1);           // 'nope' had a value and lost it
    expect(plan.values.get('r3')).toBe(false);
  });
});

describe('→ text is the universal sink', () => {
  it('never loses a value', () => {
    const plan = planConversion(sel, 'text', rows(['a', 'b', null]));
    expect(plan.values.get('r0')).toBe('Alpha');
    expect(plan.lost).toBe(0);
    expect(plan.lossless).toBe(true);
  });
  it('warns that a date becomes one-way text', () => {
    const plan = planConversion(date, 'text', rows(['2026-08-01']));
    expect(plan.lossless).toBe(true);
    expect(plan.warnings[0]).toMatch(/no longer be sorted as dates/);
  });
  it('number → text formats without loss', () => {
    expect(planConversion(num, 'text', rows([42])).values.get('r0')).toBe('42');
  });
});
