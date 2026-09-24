import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rowSurface } from './row-surface';

// ── THE HOVER BAND SITS SQUARE IN ITS ROW ──────────────────────────────────
//
// Found by the user in a screenshot. The wash declared `my-0.5` — 2px above and
// below — and MEASURED 0 above, 3 below. A top margin on the first child of a
// box with no padding or top border COLLAPSES THROUGH its parent, so the fill
// sat flush against the hairline above it and short of the one below. An
// off-centre band on every row of every list.
//
// The wash was also `rounded-md` at FULL WIDTH. It has to be full width — its
// padding is what aligns a row's text with the panel header above it — so the
// radius had nothing to be inset from and produced four corner notches showing
// the card behind them. Rounding had been added to stop the fill colliding with
// the hairline; the vertical inset is what actually does that.
describe('the row wash', () => {
  const s = rowSurface({ padding: 'px-4 py-2' });

  it('takes its inset from the OUTER, where a margin cannot collapse', () => {
    expect(s.outer, 'padding on the parent is symmetric by construction').toContain('py-0.5');
    expect(s.wash, 'a margin here collapses through the parent').not.toContain('my-0.5');
  });

  it('is not rounded, because it is full width', () => {
    expect(s.wash).not.toContain('rounded');
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
