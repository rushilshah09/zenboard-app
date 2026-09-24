import { describe, it, expect } from 'vitest';
import { evalFormula, rawValue } from './db-engine';
import type { DbRow, PropDef } from './collections';
import { evalPageFormula, formulaDisplay, type PageProp } from './page-formula';

// The expression evaluator has run user input since it was written and had no
// tests at all. Everything here is about the two properties that matter for a
// language embedded in a document: it must compute what it claims, and a broken
// expression must degrade to null rather than take a view down with it.

const PROPS: PropDef[] = [
  { id: 'title', name: 'Name', type: 'title' },
  { id: 'p1', name: 'Price', type: 'number' },
  { id: 'p2', name: 'Qty', type: 'number' },
  { id: 'p3', name: 'Status', type: 'status' },
  { id: 'p4', name: 'Tags', type: 'multi_select' },
  { id: 'p5', name: 'Done', type: 'checkbox' },
  { id: 'p6', name: 'Note', type: 'text' },
  { id: 'fx', name: 'Total', type: 'formula', formula: { expr: 'prop("Price") * prop("Qty")' } },
];

const ROW: DbRow = {
  id: 'r1', title: 'Widget',
  data: { p1: 250, p2: 3, p3: 'Shipped', p4: ['a', 'b'], p5: true, p6: 'hello' },
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', order: 'a0',
};

const run = (expr: string, row: DbRow = ROW) => evalFormula(expr, row, PROPS, () => null);

describe('literals and arithmetic', () => {
  it('evaluates numbers, strings and booleans', () => {
    expect(run('42')).toBe(42);
    expect(run('2.5')).toBe(2.5);
    expect(run('"text"')).toBe('text');
    expect(run("'text'")).toBe('text');
    expect(run('true')).toBe(true);
    expect(run('false')).toBe(false);
  });

  it('respects precedence and parentheses', () => {
    expect(run('2 + 3 * 4')).toBe(14);
    expect(run('(2 + 3) * 4')).toBe(20);
    expect(run('-3 + 1')).toBe(-2);
  });

  it('returns null on division by zero rather than Infinity', () => {
    // Infinity would render as "Infinity" in a cell, which is not an answer.
    expect(run('1 / 0')).toBeNull();
    expect(run('1 % 0')).toBeNull();
  });

  it('adds numbers but concatenates when either side is a string', () => {
    expect(run('1 + 2')).toBe(3);
    expect(run('"a" + 1')).toBe('a1');
  });
});

describe('comparison and logic', () => {
  it('compares', () => {
    expect(run('3 > 2')).toBe(true);
    expect(run('3 <= 2')).toBe(false);
    expect(run('"a" == "a"')).toBe(true);
    expect(run('"a" != "b"')).toBe(true);
  });

  it('accepts both spellings of and/or/not', () => {
    expect(run('true and false')).toBe(false);
    expect(run('true && false')).toBe(false);
    expect(run('true or false')).toBe(true);
    expect(run('true || false')).toBe(true);
    expect(run('not false')).toBe(true);
    expect(run('!false')).toBe(true);
  });

  it('treats null, 0 and "" as falsey — the rule `if` and `empty` share', () => {
    expect(run('if(0, "yes", "no")')).toBe('no');
    expect(run('if("", "yes", "no")')).toBe('no');
    expect(run('if(prop("Missing"), "yes", "no")')).toBe('no');
  });
});

describe('prop()', () => {
  it('reads by name and by id', () => {
    expect(run('prop("Price")')).toBe(250);
    expect(run('prop("p1")')).toBe(250);
  });

  it('reads the row title and the system timestamps', () => {
    expect(run('prop("Name")')).toBe('Widget');
  });

  it('joins a multi-value property with commas', () => {
    expect(run('prop("Tags")')).toBe('a, b');
  });

  it('is null for a property that does not exist', () => {
    expect(run('prop("Nope")')).toBeNull();
  });

  // Otherwise a formula referring to itself, or to another formula, recurses
  // until the stack gives out — with a whole view rendering behind it.
  it('refuses to read a formula property, including itself', () => {
    expect(run('prop("Total")')).toBeNull();
  });

  it('computes across properties, which is the whole point', () => {
    expect(run('prop("Price") * prop("Qty")')).toBe(750);
    expect(run('if(prop("Status") == "Shipped", "done", "open")')).toBe('done');
    expect(run('if(prop("Done"), "yes", "no")')).toBe('yes');
  });
});

describe('functions', () => {
  it('computes the arithmetic and string helpers', () => {
    expect(run('round(2.6)')).toBe(3);
    expect(run('abs(-4)')).toBe(4);
    expect(run('min(3, 1, 2)')).toBe(1);
    expect(run('max(3, 1, 2)')).toBe(3);
    expect(run('length("hello")')).toBe(5);
    expect(run('lower("ABC")')).toBe('abc');
    expect(run('upper("abc")')).toBe('ABC');
    expect(run('concat("a", "b", 1)')).toBe('ab1');
  });

  it('empty() distinguishes missing from present-but-falsey', () => {
    expect(run('empty(prop("Nope"))')).toBe(true);
    expect(run('empty("")')).toBe(true);
    expect(run('empty(0)')).toBe(false);   // zero is a value
    expect(run('empty(prop("Price"))')).toBe(false);
  });

  it('now() returns an ISO instant', () => {
    expect(String(run('now()'))).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is null for a function it does not know', () => {
    expect(run('nosuchfn(1)')).toBeNull();
  });
});

// A formula is user input that runs on every render of every row. The contract
// is that ANY bad expression is null — never a throw, never a partial answer.
describe('a broken formula is null, never an exception', () => {
  for (const expr of [
    '',
    '   ',
    '1 +',
    '(1 + 2',
    '"unterminated',
    'prop(',
    '1 2',              // trailing garbage
    '@#$',              // unknown characters
    'bareIdentifier',
    'prop()',
  ]) {
    it(`refuses ${JSON.stringify(expr)}`, () => {
      expect(() => run(expr)).not.toThrow();
      expect(run(expr)).toBeNull();
    });
  }

  it('survives a row whose data is missing entirely', () => {
    const bare: DbRow = { id: 'r2', title: '', data: {}, created_at: '', updated_at: '', order: 'a0' };
    expect(run('prop("Price") + 1', bare)).toBe(1);
    expect(run('prop("Price")', bare)).toBeNull();
  });
});

describe('rawValue routes the computed types', () => {
  it('resolves a formula property through the evaluator', () => {
    const fx = PROPS.find((p) => p.id === 'fx')!;
    expect(rawValue(ROW, fx, PROPS, () => null)).toBe(750);
  });

  it('maps title and the timestamps to the row rather than to data', () => {
    expect(rawValue(ROW, PROPS[0], PROPS, () => null)).toBe('Widget');
  });
});

// ── A page evaluated by the same engine ──────────────────────────────────────
describe('evalPageFormula', () => {
  const CTX = { pageId: 'pg1', title: 'Kickoff', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' };
  const props: PageProp[] = [
    { id: 'a', name: 'Rate', type: 'number', value: '250' },
    { id: 'b', name: 'Hours', type: 'number', value: '3' },
    { id: 'c', name: 'Stage', type: 'status', options: [{ id: 'o1', name: 'Shipped', color: 'green' }], selected: ['o1'] },
    { id: 'd', name: 'Tags', type: 'multi_select', options: [{ id: 't1', name: 'Design', color: 'blue' }, { id: 't2', name: 'Dev', color: 'purple' }], selected: ['t1', 't2'] },
    { id: 'e', name: 'Done', type: 'checkbox', checked: true },
    { id: 'f', name: 'Note', type: 'text', value: 'hello' },
    { id: 'g', name: 'Related', type: 'relation', records: [{ type: 'client', id: 'cli-1' }] },
    { id: 'fx', name: 'Fee', type: 'formula', formula: { expr: 'prop("Rate") * prop("Hours")' } },
  ];
  const fx = (expr: string) => evalPageFormula({ id: 'x', name: 'X', type: 'formula', formula: { expr } }, props, CTX);

  it('computes across the page the way it computes across a row', () => {
    expect(fx('prop("Rate") * prop("Hours")')).toBe(750);
  });

  // The mapping decision: a page keeps option ids and names apart, and
  // `prop("Stage") == "o1"` is not something a person can write.
  it('resolves a select to its option NAME, not the option id', () => {
    expect(fx('prop("Stage")')).toBe('Shipped');
    expect(fx('if(prop("Stage") == "Shipped", "done", "open")')).toBe('done');
  });

  it('joins a multi-select by name', () => {
    expect(fx('prop("Tags")')).toBe('Design, Dev');
  });

  it('reads a checkbox as a boolean, and a number as a number', () => {
    expect(fx('if(prop("Done"), 1, 0)')).toBe(1);
    expect(fx('prop("Rate") + 1')).toBe(251);   // 251, not "2501"
  });

  it('treats an unfilled number as absent rather than as zero', () => {
    // `Number('')` is 0, so a blank field would otherwise read as a real zero
    // and quietly make an average or a total wrong.
    const blank: PageProp[] = [{ id: 'a', name: 'Rate', type: 'number', value: '' }];
    expect(evalPageFormula({ id: 'x', name: 'X', type: 'formula', formula: { expr: 'empty(prop("Rate"))' } }, blank, CTX)).toBe(true);
  });

  it('exposes the page title through prop(), like a row title', () => {
    expect(fx('prop("Name")')).toBeNull();     // pages have no `title` PROPERTY
  });

  it('lets a relation be tested for emptiness, which is what a sync evaluator can honestly offer', () => {
    expect(fx('empty(prop("Related"))')).toBe(false);
    expect(fx('prop("Related")')).toBe('cli-1');
  });

  it('still refuses to read another formula', () => {
    expect(fx('prop("Fee")')).toBeNull();
  });

  it('is null for an empty or invalid expression', () => {
    expect(fx('')).toBeNull();
    expect(fx('prop("Rate") *')).toBeNull();
  });
});

describe('formulaDisplay', () => {
  it('renders each kind of result the way a cell should read it', () => {
    expect(formulaDisplay(null)).toBe('');
    expect(formulaDisplay(true)).toBe('Yes');
    expect(formulaDisplay(false)).toBe('No');
    expect(formulaDisplay(7)).toBe('7');
    expect(formulaDisplay(7.123456)).toBe('7.1235');
    expect(formulaDisplay('text')).toBe('text');
  });
});
