import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROW_INSET_PX, rowSurface } from './row-surface';

// ── THE HOVER BAND SITS SQUARE IN ITS ROW ──────────────────────────────────
//
// Found by the user in a screenshot. The wash declared `my-0.5` — 2px above and
// below — and MEASURED 0 above, 3 below. A top margin on the first child of a
// box with no padding or top border COLLAPSES THROUGH its parent, so the fill
// sat flush against the hairline above it and short of the one below. An
// off-centre band on every row of every list.
//
// The wash was also `rounded-md` at FULL WIDTH, which showed four corner notches — so the radius
// came off and the wash ran wall to wall. USER DIRECTION 2026-09-29, with a screenshot of a hover
// meeting the card's left edge: *"on hover i want space from 4 sides, right and left it touches."*
// A band welded to both walls is not a row lighting up.
//
// The old objection — that insetting pushes every row's text out of line with the panel header —
// is ANSWERED, not overruled: the wash gives the padding back, `--panel-px` minus the inset, so the
// first glyph still lands exactly `--panel-px` from the card edge. That is the invariant tested
// below, because it is the one that breaks silently if somebody changes one number and not the
// other. And with 6px on each side the radius has something to be inset from, so it returns.
describe('the row wash', () => {
  const s = rowSurface({ padding: 'px-4 py-2' });

  it('takes its inset from the OUTER, where a margin cannot collapse', () => {
    expect(s.outer, 'padding on the parent is symmetric by construction').toContain('py-0.5');
    expect(s.outer, 'the horizontal inset lives with the vertical one').toContain('px-1.5');
    expect(s.wash, 'a margin here collapses through the parent').not.toContain('my-0.5');
  });

  it('is a pill inside the card, inset on all four sides', () => {
    expect(rowSurface({ padding: 'py-2' }).wash).toContain('rounded-md');
  });

  it('gives the inset back as padding, so a row still lines up with the panel header', () => {
    // THE invariant. The outer insets by ROW_INSET_PX and the wash pads by `--panel-px` less the
    // same number, so the first glyph lands at `--panel-px` from the card edge exactly as it did
    // when the wash was full width. Change one of these two numbers without the other and every
    // list in the app goes subtly out of line with its own header, which nothing else would catch.
    expect(ROW_INSET_PX).toBe(6);
    expect(s.outer).toContain('px-1.5'); // 6px
    expect(rowSurface({ padding: 'py-2' }).wash).toContain('px-[calc(var(--panel-px)-6px)]');
  });

  it('still carries the row padding and the state, and the divider stays outside', () => {
    // The two-element split is the point: a rounded wash and a full-width
    // divider cannot share a box, and the divider must span the list.
    expect(s.wash).toContain('px-4 py-2');
    expect(s.wash).toContain('hover:bg-surface-hover');
    expect(rowSurface({ padding: 'p-0', selected: true }).wash).toContain('bg-surface-selected');
    expect(s.outer).toContain('border-b');
    expect(rowSurface({ padding: 'p-0', last: true }).outer, 'the last row owns no divider').not.toContain('border-b');
    expect(s.outer, 'the group is UNNAMED so reveal-on-hover matches it').toContain('group ');
  });

  it('keeps the recipe in one place', () => {
    // Two task rows had drifted into two spellings of the same broken thing. Since 2026-09-22 there is one row
    // (task-meta.test.ts): the Tasks page draws the shared TaskRow and paints no wash of its own.
    const src = readFileSync('components/tasks/row-surface.ts', 'utf8');
    expect(src).toMatch(/export function rowSurface/);
    expect(readFileSync('components/tasks/task-row.tsx', 'utf8'), 'the row must use the shared recipe').toMatch(/rowSurface\(/);
    const view = readFileSync('components/tasks/tasks-view.tsx', 'utf8');
    expect(view).toMatch(/<TaskRow\b/);
    expect(view, 'a second wash is a second row').not.toMatch(/rowSurface\(/);
  });
});
