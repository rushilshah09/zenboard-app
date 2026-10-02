import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { groupByStream, progressOf, NO_STREAM, type Workstream } from '@/lib/workstreams';

// ── PHASE 2 · "WORKSTREAMS EARN THEIR PLACE" ───────────────────────────────
// A grouping level is used or it is not, and the thing that decides which is
// not how good the heading looks. Measured 2026-09-10 on a real workspace:
//
//   tasks.section_id set  →  0 of 88
//   sections rows         →  1
//
// The feature had shipped in migration 0014 and been promoted in 0040, and not
// one task had ever been filed. The cause was an asymmetry: two clicks to
// CREATE a stream, a drawer round trip to FILL one — no drag, no row menu, no
// bulk move. Todoist and Things both make the group a drop target; that single
// affordance is what decides adoption.
//
// These guards pin the three halves of the fix: the row can file itself, the
// owner's screen reads the SAME projection the portal does, and a subtask no
// longer falls out of its own project.

const strip = (src: string) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const code = (f: string) => strip(readFileSync(f, 'utf8'));

const WORKSPACE = 'components/projects/projects-workspace.tsx';
const CONTROLS = 'components/projects/workstream-controls.tsx';
const BOARD = 'components/projects/project-board.tsx';
const TASK_ROW = 'components/tasks/task-row.tsx';
const TASK_ACTIONS = 'lib/actions/tasks.ts';

describe('filing a task is as cheap as creating the container', () => {
  const row = code(TASK_ROW);
  const ws = code(WORKSPACE);

  it('puts the destinations on the row itself', () => {
    expect(row, 'TaskRow takes a move affordance').toMatch(/move\?: \{/);
    expect(row, 'and renders the destinations').toMatch(/move\.targets\.map/);
    expect(row, 'each one filing the task').toMatch(/move\.onMove\(t\.id\)/);
  });

  it('does not offer the menu when there is nowhere to move to', () => {
    // With no workstreams the only destination is "No workstream", which is
    // where the task already is. A menu whose every item is a no-op is worse
    // than no menu — it reads as broken rather than as empty.
    expect(ws).toMatch(/move=\{moveTargets\.length > 1 \?/);
  });

  it('always includes "out of a workstream" as a destination', () => {
    // Filing has to be reversible from the same control that did it.
    expect(ws).toMatch(/\{ id: NO_STREAM, name: 'No workstream' \}/);
    expect(ws, 'and the sentinel maps back to a null column').toMatch(/=== NO_STREAM \? null :/);
  });

  it('lets a workstream be reordered — sort_order existed and nothing could set it', () => {
    // The menu moved into workstream-controls.tsx so the Board's columns carry
    // it too. The rule is the same: both directions, and it persists.
    const controls = code(CONTROLS);
    expect(controls).toMatch(/onSelect=\{\(\) => onMove\(stream\.id, -1\)\}/);
    expect(controls).toMatch(/onSelect=\{\(\) => onMove\(stream\.id, 1\)\}/);
    expect(ws, 'the List wires it').toMatch(/onMove=\{\(id, d\) => onMoveSection\?\.\(id, d\)\}/);
    expect(code(BOARD), 'and so does the Board').toMatch(/onMove=\{onMoveSection\}/);
    expect(code('lib/actions/labels.ts'), 'and it persists').toMatch(/export async function setSectionOrder/);
  });
});

describe('one projection, for the owner and the client alike', () => {
  const ws = code(WORKSPACE);

  it('groups through lib/workstreams.ts instead of deriving its own', () => {
    // `lib/workstreams.ts` calls itself "THE one projection" and had a single
    // caller — lib/portal.ts. The owner's screen re-derived grouping inline,
    // which is why the client could see each stream's progress and the person
    // doing the work could not.
    expect(ws).toMatch(/groupByStream\(active, sections as Workstream\[\]\)/);
    expect(ws, 'no second derivation left behind').not.toMatch(/const loose = active\.filter/);
  });

  it('shows a stream how far along it is, over its whole life', () => {
    // Computed from `tasks`, never from `active` — the finished work has
    // already been split out of `active`, so a count taken there reports every
    // stream as 0 done.
    expect(ws).toMatch(/progressByKey = useMemo\(/);
    expect(ws).toMatch(/groupByStream\(tasks, sections as Workstream\[\]\)\.map\(\(g\) => \[g\.key, g\.progress\]\)/);
    expect(ws, 'and the heading renders it').toMatch(/<WorkstreamFacts stream=\{stream\} progress=\{prog\} \/>/);
    expect(code(CONTROLS), 'as done over total').toMatch(/\{progress\.done\}\/\{progress\.total\}/);
  });

  it('computes the project bar with the same rule', () => {
    expect(ws).toMatch(/progressOf\(projTasks\)/);
  });
});

describe('a subtask belongs to its parent’s project', () => {
  const actions = code(TASK_ACTIONS);
  const ws = code(WORKSPACE);

  it('inherits project, workstream and client visibility', () => {
    expect(actions).toMatch(/project_id: parent\.project_id \?\? null/);
    expect(actions).toMatch(/section_id: p\.section_id \?\? null/);
    expect(actions).toMatch(/client_visible: p\.client_visible \?\? false/);
  });

  it('still works on an account that has not run the migrations', () => {
    // `section_id` (0014) and `client_visible` (portal) are columns a
    // migration adds. Selecting them unconditionally would fail and the
    // subtask would report "Parent not found" — a worse bug than the one
    // being fixed. Retry-instead-of-probe, the house gate.
    expect(actions).toMatch(/const parent = full\.error/);
    expect(actions, 'the fallback asks only for what has always existed')
      .toMatch(/select\('space_id, project_id'\)/);
  });

  it('does not let subtasks inflate anything project-scoped', () => {
    // The other half of the inheritance. Without this a task split into ten
    // pieces appears ten more times in the list, ten more cards on the board,
    // and drags the progress bar on its own.
    expect(ws).toMatch(/t\.project_id === active\.id && !t\.parent_task_id/);
    expect(ws, 'the rail badge agrees with the list it opens')
      .toMatch(/t\.project_id === pid && !t\.parent_task_id && !t\.done/);
  });
});

describe('the projection itself still keeps its promises', () => {
  // Not source-scanning: the rules these guard are arithmetic, and they are
  // the reason the owner screen was allowed to adopt this file wholesale.
  const stream = (id: string, order: number): Workstream => ({ id, project_id: 'p', name: id, sort_order: order });
  const task = (id: string, over: Partial<{ done: boolean; section_id: string | null; parent_task_id: string | null }> = {}) =>
    ({ id, done: false, section_id: null, parent_task_id: null, ...over });

  it('counts top-level tasks only', () => {
    const ts = [task('a', { done: true }), task('b'), task('s1', { parent_task_id: 'a' }), task('s2', { parent_task_id: 'a' })];
    expect(progressOf(ts)).toEqual({ done: 1, total: 2, pct: 50 });
  });

  it('reports an empty stream as 0%, never 100%', () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('puts named streams first and unfiled last', () => {
    const groups = groupByStream(
      [task('x', { section_id: 'B' }), task('y'), task('z', { section_id: 'A' })],
      [stream('A', 0), stream('B', 1)],
    );
    expect(groups.map((g) => g.key)).toEqual(['A', 'B', NO_STREAM]);
  });

  it('keeps an empty stream visible, so the first task has somewhere to go', () => {
    const groups = groupByStream([task('y')], [stream('A', 0)]);
    expect(groups.map((g) => g.key)).toEqual(['A', NO_STREAM]);
    expect(groups[0].tasks).toEqual([]);
  });

  it('does not invent an unfiled group when nothing is unfiled', () => {
    const groups = groupByStream([task('z', { section_id: 'A' })], [stream('A', 0)]);
    expect(groups.map((g) => g.key)).toEqual(['A']);
  });
});
