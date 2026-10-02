import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pointerWithin } from '@dnd-kit/core';
import { boardCollision } from '@/components/tasks/tasks-board';

// The project Board, rebuilt as the Tasks board grouped by workstream, and the
// `tasks.status` vocabulary it used to draw retired. See PROGRESS.md
// "The Board groups by workstream" (2026-09-11).

/** Source without comments — the rules below are about code, and several of
 *  them name the very thing they forbid in an explanatory comment. */
const code = (f: string) =>
  readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** One function's body, found by its declaration and cut at the next one. */
const body = (src: string, name: string) => {
  const at = src.indexOf(`async function ${name}(`);
  if (at < 0) throw new Error(`${name} not found — the guard is broken, not the code`);
  const next = src.indexOf('\n  async function ', at + 10);
  const nextPlain = src.indexOf('\n  function ', at + 10);
  const ends = [next, nextPlain].filter((i) => i > 0);
  return src.slice(at, ends.length ? Math.min(...ends) : undefined);
};

const WORKSPACE = 'components/projects/projects-workspace.tsx';
const BOARD = 'components/projects/project-board.tsx';
const TASKS_BOARD = 'components/tasks/tasks-board.tsx';

describe('the project Board groups by workstream', () => {
  it('draws its columns from the same projection as the List and the portal', () => {
    const b = code(BOARD);
    expect(b).toMatch(/boardGroups\(tasks, sections as Workstream\[\]\)/);
    expect(b, 'and moves a card with the one landing rule').toMatch(/landAt\(target\.tasks\.map/);
  });

  it('is the Tasks board, not a third kanban', () => {
    expect(code(BOARD)).toMatch(/<TasksBoard\b/);
    const ws = code(WORKSPACE);
    for (const gone of ['DndContext', 'useSortable', 'BOARD_COLS', 'colOfTask']) {
      expect(ws, `${gone} left behind in the workspace`).not.toContain(gone);
    }
  });

  it('files a card by drag: the stream is written, then the landing column renumbered', () => {
    const drop = body(code(WORKSPACE), 'boardDrop');
    expect(drop).toMatch(/setTaskSection\(taskId, sectionId\)/);
    expect(drop).toMatch(/setTaskOrder\(orderedIds\.map/);
    // Re-sorted by the loader's own key, so the List agrees with the Board the
    // moment the card lands rather than on the next full load.
    expect(drop).toMatch(/\.sort\(byLoaderOrder\)/);
  });
});

describe('tasks.status is retired', () => {
  it('has no writer and no reader left', () => {
    expect(code('lib/actions/tasks.ts')).not.toMatch(/setTaskStatus|TaskStatus/);
    expect(code('lib/projects-data.ts')).not.toMatch(/TASK_OPTIONAL = '[^']*status/);
    expect(code('lib/projects-data.ts'), 'nor the fallback read').not.toMatch(/select\('id, status'\)/);
    expect(code(WORKSPACE), 'nor the gate it fed').not.toMatch(/statusSupported/);
    expect(code(WORKSPACE), 'and a project task no longer carries it').not.toMatch(/status\?: string \| null; sort_order/);
  });

  it('is still in the export — it is the user’s data even though nothing reads it', () => {
    // The column stays in the table (no DDL), and an export that silently
    // dropped a stored field would be a lossy export.
    expect(code('app/api/export/tasks/route.ts')).toMatch(/status: t\.status/);
  });
});

describe('a keyboard drop lands where it was aimed (boardCollision)', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height });
  const droppableRects = new Map([['A', rect(0, 0, 100, 300)], ['B', rect(120, 0, 100, 300)]]);
  const droppableContainers = [{ id: 'A' }, { id: 'B' }];
  const args = (collisionRect: ReturnType<typeof rect>, pointerCoordinates: { x: number; y: number } | null) =>
    ({ active: { id: 'card' }, collisionRect, droppableRects, droppableContainers, pointerCoordinates }) as never;

  it('answers from the pointer when there is one', () => {
    // The card's own rect still sits over A; the pointer is in B — the pointer wins.
    const hit = boardCollision(args(rect(10, 10, 80, 40), { x: 150, y: 50 }));
    expect(hit[0]?.id).toBe('B');
  });

  it('answers from the card when a keyboard is moving it', () => {
    const keyboard = args(rect(125, 10, 80, 40), null);
    expect(boardCollision(keyboard)[0]?.id).toBe('B');
    // THE BUG, pinned: `pointerWithin` alone finds nothing without a pointer, so
    // every keyboard drop was over nothing and snapped the card home.
    expect(pointerWithin(keyboard)).toEqual([]);
  });
});

describe('screen readers hear the task and the column, not ids', () => {
  it('announces by name and by position', () => {
    const tb = code(TASKS_BOARD);
    expect(tb).toMatch(/accessibility=\{\{ announcements \}\}/);
    expect(tb).toMatch(/position \$\{/);
    expect(tb, 'cards are items in a list, not buttons holding buttons').toMatch(/role: 'listitem', roleDescription: 'movable task'/);
  });
});

describe('every workstream write reverts on a THROWN failure too', () => {
  // `requireSession` throws on an expired session, and a bare `await` left the
  // screen showing a move, a name or a date the database never stored.
  // Measured in the dev harness: a dragged card stayed in its new column while
  // the console logged "Uncaught (in promise) Not authenticated".
  const ws = code(WORKSPACE);
  for (const fn of ['boardDrop', 'moveTaskToStream', 'renameSectionLocal', 'deleteSectionLocal', 'moveSectionBy', 'setStreamDate', 'setStreamPaused']) {
    it(fn, () => {
      expect(body(ws, fn)).toMatch(/applyShare\(/);
    });
  }

  it('says so when making a workstream fails, from either view', () => {
    const make = body(ws, 'createStream');
    expect(make).toMatch(/catch \{/);
    expect(ws.match(/onNewSection=\{createStream\}/g), 'the List and the Board share the one handler').toHaveLength(2);
  });
});

describe('the Tasks board makes its next list in place', () => {
  it('does not go looking for another button to click', () => {
    // It used to `querySelector('[aria-label="New list"]')` — which, when the
    // rail was off screen, could only find the board's OWN button.
    expect(code(TASKS_BOARD)).not.toMatch(/document\.querySelector/);
    expect(code('components/tasks/tasks-view.tsx')).not.toMatch(/querySelector<HTMLElement>\('\[aria-label="New list"\]'\)/);
    expect(code('components/tasks/tasks-view.tsx')).toMatch(/onCreate: scopes\.createList/);
  });
});

describe('a column’s order is saved in parallel', () => {
  it('sends the renumbering at once rather than one round trip per card', () => {
    const actions = code('lib/actions/tasks.ts');
    const at = actions.indexOf('export async function setTaskOrder');
    const fn = actions.slice(at, actions.indexOf('\nexport', at + 10));
    expect(fn).toMatch(/Promise\.all\(/);
    expect(fn, 'no awaited loop left').not.toMatch(/for \(const u of updates\)/);
  });
});
