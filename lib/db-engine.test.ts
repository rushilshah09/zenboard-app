import { describe, it, expect } from 'vitest';
import { matchesFilter, newRowValues, viewProps } from './db-engine';
import type { DbRow, PropDef, FilterGroup, ViewDef } from './collections';

const props: PropDef[] = [
  { id: 'title', name: 'Name', type: 'title' },
  { id: 'status', name: 'Status', type: 'status', options: [
    { id: 'todo', name: 'To do', color: 'gray' },
    { id: 'done', name: 'Done', color: 'green' },
  ] },
  { id: 'hours', name: 'Hours', type: 'number' },
];

const row = (title: string, data: Record<string, unknown>): DbRow => ({
  id: title, title, data, order: 'a0',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
});

const done5 = row('done5', { status: 'done', hours: '5' });
const todo5 = row('todo5', { status: 'todo', hours: '5' });
const done1 = row('done1', { status: 'done', hours: '1' });

const match = (r: DbRow, f: FilterGroup) => matchesFilter(r, f, props);

describe('matchesFilter — the AND/OR the chip UI now exposes', () => {
  it('and requires every rule', () => {
    const f: FilterGroup = { logic: 'and', rules: [
      { prop: 'status', op: 'is', value: 'done' },
      { prop: 'hours', op: 'gte', value: 5 },
    ] };
    expect(match(done5, f)).toBe(true);
    expect(match(todo5, f)).toBe(false); // wrong status
    expect(match(done1, f)).toBe(false); // too few hours
  });

  it('or accepts any rule — the case the UI could not previously express', () => {
    const f: FilterGroup = { logic: 'or', rules: [
      { prop: 'status', op: 'is', value: 'done' },
      { prop: 'hours', op: 'gte', value: 5 },
    ] };
    expect(match(done5, f)).toBe(true);
    expect(match(todo5, f)).toBe(true);  // matches on hours alone
    expect(match(done1, f)).toBe(true);  // matches on status alone
    expect(match(row('x', { status: 'todo', hours: '1' }), f)).toBe(false);
  });

  it('evaluates a nested group — "done AND (5h OR 1h)"', () => {
    const f: FilterGroup = { logic: 'and', rules: [
      { prop: 'status', op: 'is', value: 'done' },
      { logic: 'or', rules: [
        { prop: 'hours', op: 'is', value: '5' },
        { prop: 'hours', op: 'is', value: '1' },
      ] },
    ] };
    expect(match(done5, f)).toBe(true);
    expect(match(done1, f)).toBe(true);
    expect(match(todo5, f)).toBe(false);           // fails the outer AND
    expect(match(row('d9', { status: 'done', hours: '9' }), f)).toBe(false); // fails the inner OR
  });

  it('an empty or absent filter matches everything', () => {
    expect(match(todo5, { logic: 'and', rules: [] })).toBe(true);
    expect(matchesFilter(todo5, undefined, props)).toBe(true);
  });
});

// The exact shape the filter-chip UI writes when you add a sub-group:
// top-level rules first, then sub-groups appended (see `writeFilter`/`writeGroups`
// in database-view). This guards the round-trip, not just the algebra.
describe('the structure the chip UI persists', () => {
  it('evaluates "(Design or Dev) and Done" — a rule plus an appended sub-group', () => {
    const p: PropDef[] = [
      ...props,
      { id: 'tags', name: 'Tags', type: 'multi_select', options: [
        { id: 'design', name: 'Design', color: 'purple' },
        { id: 'dev', name: 'Dev', color: 'orange' },
      ] },
    ];
    const f: FilterGroup = { logic: 'and', rules: [
      { prop: 'status', op: 'is', value: 'done' },
      { logic: 'or', rules: [
        { prop: 'tags', op: 'contains', value: 'design' },
        { prop: 'tags', op: 'contains', value: 'dev' },
      ] },
    ] };
    const doneDev = row('doneDev', { status: 'done', tags: ['dev'] });
    const todoDesign = row('todoDesign', { status: 'todo', tags: ['design'] });
    const doneNone = row('doneNone', { status: 'done', tags: [] });
    expect(matchesFilter(doneDev, f, p)).toBe(true);      // done + in the group
    expect(matchesFilter(todoDesign, f, p)).toBe(false);  // in the group, wrong status
    expect(matchesFilter(doneNone, f, p)).toBe(false);    // done, but not in the group
  });

  it('an inner group with and requires BOTH tags', () => {
    const p: PropDef[] = [...props, { id: 'tags', name: 'Tags', type: 'multi_select', options: [
      { id: 'design', name: 'Design', color: 'purple' }, { id: 'dev', name: 'Dev', color: 'orange' },
    ] }];
    const f: FilterGroup = { logic: 'and', rules: [{ logic: 'and', rules: [
      { prop: 'tags', op: 'contains', value: 'design' },
      { prop: 'tags', op: 'contains', value: 'dev' },
    ] }] };
    expect(matchesFilter(row('both', { tags: ['design', 'dev'] }), f, p)).toBe(true);
    expect(matchesFilter(row('one', { tags: ['design'] }), f, p)).toBe(false);
  });
});

// ── Why the option haystack is joined with NUL ──────────────────────────────
// `is` on a select/status compares against BOTH the option id and its name, so
// a filter reads naturally whichever the user thinks in. Both are joined into
// one string, which `contains` searches as a substring and `is` splits back for
// an exact match.
//
// The separator has to be a character no option name can contain. It is `\0`
// (`SEP` in db-engine) and these tests are why: "To do" has a space in it, so a
// space separator would split it into "to" and "do" and make `is: "do"` match a
// row whose status is "To do". Every assertion below passes with NUL and the
// third fails with a space.
describe('exact-match filtering survives an option name with a space', () => {
  const is = (value: string): FilterGroup => ({ logic: 'and', rules: [{ prop: 'status', op: 'is', value }] });

  it('matches by the option NAME, not just its id', () => {
    expect(match(todo5, is('To do'))).toBe(true);
    expect(match(done5, is('To do'))).toBe(false);
  });

  it('still matches by the option id', () => {
    expect(match(todo5, is('todo'))).toBe(true);
  });

  it('does NOT match a single word of a multi-word option name', () => {
    // The one that a space separator gets wrong.
    expect(match(todo5, is('do'))).toBe(false);
    expect(match(todo5, is('To'))).toBe(false);
  });

  it('is_not is the exact inverse, so it cannot half-match either', () => {
    expect(match(todo5, { logic: 'and', rules: [{ prop: 'status', op: 'is_not', value: 'do' }] })).toBe(true);
    expect(match(todo5, { logic: 'and', rules: [{ prop: 'status', op: 'is_not', value: 'To do' }] })).toBe(false);
  });

  it('contains still does substring matching on the same haystack', () => {
    // `contains` is the op that SHOULD find a fragment — that division of
    // labour is the reason one joined string serves both.
    expect(match(todo5, { logic: 'and', rules: [{ prop: 'status', op: 'contains', value: 'do' }] })).toBe(true);
  });

  it('never leaks the separator into a match', () => {
    // A needle containing the separator must not match by accident.
    expect(match(todo5, is('todo\0to do'))).toBe(false);
  });
});

describe('newRowValues — what a new row starts with', () => {
  // The brief's §16 and Notion: a new row is useful at once. It starts in its status's
  // first option — a new board card used to land in "No Status" — and it takes the
  // values the view filters on, so it does not vanish from the view that made it. A
  // value the caller brings (a board column, a calendar day) wins.
  const all: PropDef[] = [
    ...props,
    { id: 'kind', name: 'Kind', type: 'select', options: [
      { id: 'bug', name: 'Bug', color: 'red' }, { id: 'feat', name: 'Feature', color: 'blue' },
    ] },
    { id: 'tags', name: 'Tags', type: 'multi_select', options: [
      { id: 'ui', name: 'UI', color: 'purple' }, { id: 'api', name: 'API', color: 'gray' },
    ] },
    { id: 'urgent', name: 'Urgent', type: 'checkbox' },
  ];
  const view = (filter?: FilterGroup): ViewDef => ({ id: 'v', name: 'Table', kind: 'table', filter });

  it("starts in the status's first option", () => {
    expect(newRowValues(all, view())).toEqual({ status: 'todo' });
  });

  it('takes what the view filters on, so the row stays in the view that made it', () => {
    const f: FilterGroup = { logic: 'and', rules: [
      { prop: 'status', op: 'is', value: 'done' },
      { prop: 'kind', op: 'is', value: 'Feature' }, // by NAME, as a chip can store it
      { prop: 'tags', op: 'contains', value: 'ui' },
      { prop: 'urgent', op: 'is', value: true },
    ] };
    const values = newRowValues(all, view(f));
    expect(values).toEqual({ status: 'done', kind: 'feat', tags: ['ui'], urgent: true });
    expect(matchesFilter(row('new', values), f, all)).toBe(true);
  });

  it('leaves alone what a filter cannot decide — an OR, a negation, a range', () => {
    const either: FilterGroup = { logic: 'or', rules: [{ prop: 'kind', op: 'is', value: 'bug' }, { prop: 'kind', op: 'is', value: 'feat' }] };
    expect(newRowValues(all, view(either))).toEqual({ status: 'todo' });
    const not: FilterGroup = { logic: 'and', rules: [{ prop: 'kind', op: 'is_not', value: 'bug' }, { prop: 'hours', op: 'gt', value: 3 }] };
    expect(newRowValues(all, view(not))).toEqual({ status: 'todo' });
  });

  it("lets the caller's value win — a board column, a calendar day", () => {
    const f: FilterGroup = { logic: 'and', rules: [{ prop: 'status', op: 'is', value: 'todo' }] };
    expect(newRowValues(all, view(f), { status: 'done' })).toEqual({ status: 'done' });
  });

  it('ignores a rule about a property or an option that no longer exists', () => {
    const f: FilterGroup = { logic: 'and', rules: [{ prop: 'gone', op: 'is', value: 'x' }, { prop: 'kind', op: 'is', value: 'Retired' }] };
    expect(newRowValues(all, view(f))).toEqual({ status: 'todo' });
  });
});

describe('viewProps — a view arranges its own columns', () => {
  const all: PropDef[] = [
    { id: 'title', name: 'Name', type: 'title' },
    { id: 'status', name: 'Status', type: 'status' },
    { id: 'hours', name: 'Hours', type: 'number' },
    { id: 'due', name: 'Due', type: 'date' },
  ];
  const ids = (ps: PropDef[]) => ps.map((p) => p.id);

  it("follows the database's order until the view has one", () => {
    expect(viewProps(undefined, all)).toBe(all);
    expect(viewProps({ propOrder: [] }, all)).toBe(all);
  });

  it('puts the properties the view placed first, then the rest in database order', () => {
    expect(ids(viewProps({ propOrder: ['hours', 'title'] }, all))).toEqual(['hours', 'title', 'status', 'due']);
  });

  it('skips a property that has since been deleted', () => {
    expect(ids(viewProps({ propOrder: ['gone', 'due', 'status', 'title', 'hours'] }, all))).toEqual(['due', 'status', 'title', 'hours']);
  });
});
