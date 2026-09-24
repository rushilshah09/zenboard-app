import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  scopeKey, keyOf, NO_SCOPE, taskScopes, columnKey, isHidden, visibleTasks, groupIntoColumns,
  readHiddenScopes, HIDDEN_SCOPES_KEY, SCOPE_COLORS, scopeFill, scopeColorName, afterProjectChange, afterDayChange,
  type Scope,
} from './task-scopes';

const proj = (id: string, name = id): Scope => ({ kind: 'project', id, name, color: null });
const list = (id: string, name = id): Scope => ({ kind: 'list', id, name, color: null });
const t = (id: string, project_id: string | null = null, list_id: string | null = null) => ({ id, project_id, list_id });

describe('scopeKey', () => {
  it('separates the two id spaces', () => {
    // The defect this prevents: projects and lists are different tables with
    // independent uuids. A hidden-set of bare ids would let a project switch
    // off a list that happened to share one.
    expect(scopeKey('project', 'x')).not.toBe(scopeKey('list', 'x'));
  });

  it('keyOf agrees with scopeKey', () => {
    expect(keyOf(proj('a'))).toBe(scopeKey('project', 'a'));
    expect(keyOf(list('a'))).toBe(scopeKey('list', 'a'));
  });
});

describe('taskScopes — rule 1, membership', () => {
  it('reports both piles when a task is in both', () => {
    expect(taskScopes(t('1', 'P', 'L'))).toEqual([scopeKey('list', 'L'), scopeKey('project', 'P')]);
  });

  it('reports one pile, or none', () => {
    expect(taskScopes(t('1', 'P'))).toEqual([scopeKey('project', 'P')]);
    expect(taskScopes(t('1', null, 'L'))).toEqual([scopeKey('list', 'L')]);
    expect(taskScopes(t('1'))).toEqual([]);
  });
});

describe('columnKey — rule 2, one card one column', () => {
  it('puts a task in its LIST when it has both', () => {
    // Precedence is a rule, not a preference: the list is the finer choice and
    // the project still shows on the card as a tag.
    expect(columnKey(t('1', 'P', 'L'))).toBe(scopeKey('list', 'L'));
  });

  it('falls back to the project, then to no pile', () => {
    expect(columnKey(t('1', 'P'))).toBe(scopeKey('project', 'P'));
    expect(columnKey(t('1'))).toBe(NO_SCOPE);
  });
});

describe('isHidden — rule 3, any pile off hides the task', () => {
  it('hides a task whose project is off even though its column is its list', () => {
    // THE case that separates rule 3 from rule 2. "Turn Life studio off and its
    // tasks disappear" has to hold for a Life-studio task filed under Priority.
    const task = t('1', 'P', 'L');
    expect(columnKey(task)).toBe(scopeKey('list', 'L'));
    expect(isHidden(task, new Set([scopeKey('project', 'P')]))).toBe(true);
  });

  it('shows a task when every pile it is in is on', () => {
    expect(isHidden(t('1', 'P', 'L'), new Set([scopeKey('project', 'OTHER')]))).toBe(false);
  });

  it('never hides a task that is in no pile', () => {
    // Nothing owns the switch that would bring it back.
    expect(isHidden(t('1'), new Set([scopeKey('project', 'P'), scopeKey('list', 'L')]))).toBe(false);
  });

  it('is a no-op when nothing is switched off', () => {
    const items = [t('1', 'P'), t('2', null, 'L'), t('3')];
    expect(visibleTasks(items, new Set())).toBe(items); // same array, no copy
  });

  it('filters the list down to what is visible', () => {
    const items = [t('1', 'P'), t('2', null, 'L'), t('3')];
    expect(visibleTasks(items, new Set([scopeKey('project', 'P')])).map((x) => x.id)).toEqual(['2', '3']);
  });
});

describe('readHiddenScopes', () => {
  it('reads the keys back', () => {
    const prefs = { [HIDDEN_SCOPES_KEY]: [scopeKey('project', 'P'), scopeKey('list', 'L')] };
    expect([...readHiddenScopes(prefs)].sort()).toEqual([scopeKey('list', 'L'), scopeKey('project', 'P')].sort());
  });

  it('reads mangled or missing preferences as "nothing hidden"', () => {
    // The safe failure is WORK STAYS VISIBLE. Hiding tasks because a jsonb
    // value got half-written is the one outcome worth engineering against.
    for (const bad of [undefined, null, {}, { [HIDDEN_SCOPES_KEY]: 'project:P' }, { [HIDDEN_SCOPES_KEY]: 42 }, { [HIDDEN_SCOPES_KEY]: null }]) {
      expect(readHiddenScopes(bad).size).toBe(0);
    }
  });

  it('drops entries that are not a well-formed scope key', () => {
    const prefs = { [HIDDEN_SCOPES_KEY]: ['project:P', 'nonsense', '', 'client:C', 42, null, 'list:'] };
    expect([...readHiddenScopes(prefs)]).toEqual(['project:P']);
  });

  it('round-trips through the rules it feeds', () => {
    const hidden = readHiddenScopes({ [HIDDEN_SCOPES_KEY]: [scopeKey('list', 'L')] });
    expect(isHidden(t('1', 'P', 'L'), hidden)).toBe(true);
    expect(isHidden(t('2', 'P'), hidden)).toBe(false);
  });
});

describe('SCOPE_COLORS', () => {
  it('is the one palette both projects and lists persist from', () => {
    // These used to be RAW HEXES, and this test required that. A hex written
    // to a row cannot know its theme, which is exactly why a project's dot
    // measured 1.86:1 on a dark rail. They are NAMES now, resolving through
    // per-theme tokens, so the requirement inverts: a hex here is the bug.
    expect(SCOPE_COLORS.length).toBeGreaterThan(0);
    for (const c of SCOPE_COLORS) {
      expect(c, 'a persisted colour must be a name, not a theme-blind hex').not.toMatch(/^#/);
      expect(scopeFill(c), `${c} does not resolve to a token`).toMatch(/^var\(--scope-/);
    }
    // Every hex that was ever persisted still reads back, so no row migrates.
    for (const legacy of ['#9A1B6F', '#7B8B5F', '#C88A3B', '#2B5CB0', '#5C4FB8']) {
      expect(scopeColorName(legacy), `${legacy} no longer resolves`).not.toBeNull();
      expect(scopeColorName(legacy.toLowerCase()), 'case must not matter').not.toBeNull();
    }
  });
});

describe('groupIntoColumns', () => {
  it('keeps an empty scope as an empty column', () => {
    // A column that only appears once something is in it can never receive the
    // first card.
    const cols = groupIntoColumns([], [list('L', 'Priority')]);
    expect(cols).toHaveLength(1);
    expect(cols[0].scope?.name).toBe('Priority');
    expect(cols[0].tasks).toEqual([]);
  });

  it('does NOT show an empty "No list" column', () => {
    expect(groupIntoColumns([t('1', null, 'L')], [list('L')]).map((c) => c.key)).toEqual([scopeKey('list', 'L')]);
  });

  it('adds "No list" only when something is loose', () => {
    const cols = groupIntoColumns([t('1'), t('2', null, 'L')], [list('L')]);
    expect(cols.map((c) => c.key)).toEqual([scopeKey('list', 'L'), NO_SCOPE]);
    expect(cols[1].tasks.map((x) => x.id)).toEqual(['1']);
  });

  it('keeps column order the same as the scope order it was given', () => {
    // The rail decides the order; this function must not re-sort it, or the
    // board and the sidebar would disagree about where a list lives.
    const cols = groupIntoColumns([], [list('b', 'B'), proj('a', 'A'), list('c', 'C')]);
    expect(cols.map((c) => c.scope?.name)).toEqual(['B', 'A', 'C']);
  });

  it('draws a task ONCE even when it is in two piles', () => {
    const cols = groupIntoColumns([t('1', 'P', 'L')], [proj('P'), list('L')]);
    const seen = cols.flatMap((c) => c.tasks.map((x) => x.id));
    expect(seen).toEqual(['1']);
  });

  it('drops a task whose column is not on the board rather than calling it loose', () => {
    // A task filed under a switched-off list must not reappear under "No list"
    // as if it had never been filed.
    const cols = groupIntoColumns([t('1', null, 'HIDDEN')], [list('L')]);
    expect(cols.flatMap((c) => c.tasks)).toEqual([]);
    expect(cols.map((c) => c.key)).toEqual([scopeKey('list', 'L')]);
  });

  it('preserves the caller\'s task order inside a column', () => {
    const cols = groupIntoColumns([t('a', null, 'L'), t('b', null, 'L'), t('c', null, 'L')], [list('L')]);
    expect(cols[0].tasks.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

// ── A stored colour must ALWAYS resolve to something theme-aware ───────────
//
// The whole reason entity colour moved out of raw hexes: a hex cannot know its
// theme, so a project's dot measured 1.86:1 on a dark rail. That guarantee is
// only worth anything if it holds for EVERY stored value, including ones the
// picker never produced — an import, a fixture, a row from before the picker
// was constrained. A `#3B6E8F` in the week fixture is exactly how this was
// found, sitting at 2.96:1 after the first pass "fixed" it.
describe('scopeFill is total', () => {
  it('never returns a raw hex, whatever is stored', () => {
    const stored = [
      null, undefined, '', '  ', 'nonsense', 'rgb(1,2,3)',
      '#9A1B6F', '#9a1b6f', ' #2B5CB0 ',        // the five, any casing/padding
      '#3B6E8F', '#123', '#ffffff', '#000000',  // never offered by any picker
    ];
    for (const v of stored) {
      const fill = scopeFill(v as string | null);
      expect(fill, `scopeFill(${JSON.stringify(v)}) leaked a literal`).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(fill, `scopeFill(${JSON.stringify(v)}) resolved to nothing`).toMatch(/^var\(--/);
    }
  });

  it('keeps the hue a person was reaching for', () => {
    // Nearest-in-OKLab, weighted so LIGHTNESS counts less — lightness is what
    // the theme adjusts, and an unweighted distance collapses every dark hex
    // onto whichever anchor happens to be darkest.
    expect(scopeColorName('#3B6E8F')).toBe('blue');    // a muted teal-blue
    expect(scopeColorName('#1E3A8A')).toBe('blue');    // a much darker blue
    expect(scopeColorName('#7DD3FC')).toBe('blue');    // a much lighter blue
    expect(scopeColorName('#4C1D95')).toBe('indigo');
    expect(scopeColorName('#166534')).toBe('sage');
    expect(scopeColorName('#B91C6B')).toBe('plum');
  });

  it('is deterministic — the same row always looks the same', () => {
    for (const v of ['#3B6E8F', '#812f5a', '#abcdef']) {
      expect(scopeColorName(v)).toBe(scopeColorName(v));
    }
  });
});

// ── A SWATCH PAINTS THE TOKEN, NEVER THE STORED VALUE ──────────────────────
//
// When `SCOPE_COLORS` held raw hexes, `style={{ background: c }}` was correct.
// The moment it held NAMES, three of the five — `plum`, `blue`, `indigo` — were
// still valid CSS colours, so the picker rendered CSS plum (pale pink) and CSS
// blue for those, and NOTHING for `sage` and `amber`.
//
// That is the worst shape a regression can take: it never threw, it looked
// half-working, and two of five swatches were simply invisible. The user found
// it in a screenshot.
describe('the colour picker resolves through the token', () => {
  const PICKERS = [
    'components/projects/projects-workspace.tsx',
    'components/projects/new-project-modal.tsx',
    'components/tasks/tasks-rail.tsx',
  ];

  it('every file that renders the palette also resolves it', () => {
    for (const f of PICKERS) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} renders SCOPE_COLORS`).toMatch(/SCOPE_COLORS/);
      expect(src, `${f} must resolve a scope value before painting it`).toMatch(/scopeFill/);
    }
  });

  it('never paints a bare loop variable as a background', () => {
    // `background: c` is the exact shape that broke. A scope value is a name;
    // only `scopeFill` turns it into something a browser can paint in either
    // theme.
    for (const f of PICKERS) {
      const code = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, `${f} paints a raw value`).not.toMatch(/background:\s*c\s*[},]/);
      expect(code, `${f} paints a raw value`).not.toMatch(/background:\s*color\s*[},]/);
    }
  });

  it('and the names are not accidentally CSS colours anyone could rely on', () => {
    // Documenting the trap rather than preventing it: `plum`, `blue` and
    // `indigo` ARE CSS colours, which is precisely why the bug was silent.
    // Nothing may depend on that coincidence.
    expect(SCOPE_COLORS).toContain('plum');
    for (const name of SCOPE_COLORS) {
      expect(scopeFill(name), `${name} must resolve to a token`).toMatch(/^var\(--scope-/);
    }
  });
});

// A task's project changed — from the task's panel, a row's menu, the `p` key or a board drop (2026-09-19).
describe('afterProjectChange — where a task is filed once its project changes', () => {
  const task = (over: Partial<{ project_id: string | null; list_id: string | null; scheduled_date: string | null; is_inbox: boolean }> = {}) =>
    ({ project_id: null, list_id: null, scheduled_date: null, is_inbox: true, ...over });

  it('is nothing at all when the project is the one it already has — a reorder in its column is not a move', () => {
    expect(afterProjectChange(task({ project_id: 'a', is_inbox: false }), 'a')).toBeNull();
    expect(afterProjectChange(task(), null)).toBeNull();
  });

  it('into a project: out of the Inbox, and out of any workstream — a workstream is one project\'s', () => {
    expect(afterProjectChange(task(), 'a')).toEqual({ project_id: 'a', is_inbox: false, section_id: null });
    expect(afterProjectChange(task({ project_id: 'b', is_inbox: false }), 'a')).toEqual({ project_id: 'a', is_inbox: false, section_id: null });
  });

  it('out of a project with nowhere else to be: back to the Inbox, so the task can still be found', () => {
    expect(afterProjectChange(task({ project_id: 'a', is_inbox: false }), null)).toEqual({ project_id: null, is_inbox: true, section_id: null });
  });

  it('out of a project that still has a day or a list: it stays where those put it', () => {
    expect(afterProjectChange(task({ project_id: 'a', is_inbox: false, scheduled_date: '2026-09-20' }), null))
      .toEqual({ project_id: null, is_inbox: false, section_id: null });
    expect(afterProjectChange(task({ project_id: 'a', is_inbox: false, list_id: 'l' }), null))
      .toEqual({ project_id: null, is_inbox: false, section_id: null });
  });
});

describe('afterDayChange — where a task is filed once its day changes', () => {
  const task = (over: Partial<{ project_id: string | null; list_id: string | null; scheduled_date: string | null; is_inbox: boolean }> = {}) =>
    ({ project_id: null, list_id: null, scheduled_date: null, is_inbox: true, ...over });

  it('a day takes it out of the Inbox; the Inbox takes its day away', () => {
    expect(afterDayChange(task(), '2026-09-20')).toEqual({ scheduled_date: '2026-09-20', is_inbox: false });
    expect(afterDayChange(task({ scheduled_date: '2026-09-20', is_inbox: false }), 'inbox')).toEqual({ scheduled_date: null, is_inbox: true });
  });

  it('no day keeps a task in its project or list — un-scheduling client work must not throw it back into the Inbox', () => {
    expect(afterDayChange(task({ project_id: 'a', scheduled_date: '2026-09-20', is_inbox: false }), null)).toEqual({ scheduled_date: null, is_inbox: false });
    expect(afterDayChange(task({ list_id: 'l', scheduled_date: '2026-09-20', is_inbox: false }), null)).toEqual({ scheduled_date: null, is_inbox: false });
  });

  it('no day and nowhere else to be is the Inbox, so the task can still be found', () => {
    expect(afterDayChange(task({ scheduled_date: '2026-09-20', is_inbox: false }), null)).toEqual({ scheduled_date: null, is_inbox: true });
  });
});
