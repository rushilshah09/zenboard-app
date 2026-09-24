'use client';
// List ⇄ Board switch for the Tasks section. Both show the same tasks in a
// different format — List (one filterable to-do list) and Board (a column per
// pile, plus the week grouping).
//
// It is the LAYOUT switch, so it renders exactly like the one on Documents:
// a DS SegmentedControl (§4.19) of bare 16px glyphs, no text. That is what makes
// "change how this list is drawn" look the same wherever you meet it, and it is
// why this control is icon-only while the module switchers (Clients · Pipeline ·
// Feedback) keep their words — those change WHAT you are looking at, this only
// changes how. Each option carries an `aria-label`, since a glyph has no name.
//
// TWO OPTIONS, NOT THREE. The week board is a BOARD — it is the same cards in
// columns, grouped by day instead of by pile — so it belongs behind the board
// glyph with a grouping control beside it, not as a third peer that makes the
// user choose between "board" and "board". `BoardGroupBy` below is that control.
//
// Both drive a router push, so each layout still server-loads exactly the data
// it needs rather than shipping both and hiding one.
import { Rows3, Kanban } from '@/components/ds/icons';
import { Icon, SegmentedControl } from '@/components/ds/ui';
import { useNavOnce } from '@/lib/use-nav-once';

/** Which way the centre is drawn. `week` is a board, so it lights the board. */
export type TaskLayout = 'list' | 'board' | 'week';

export function TaskViewToggle({ view }: { view: TaskLayout }) {
  // A SegmentedControl is a Radix RadioGroup, which activates on focus as well
  // as on click — so this pushed every layout switch twice. See lib/use-nav-once.ts.
  const current = view === 'list' ? 'list' : 'board';
  const go = useNavOnce(current);
  return (
    <SegmentedControl
      aria-label="Task layout"
      value={current}
      onValueChange={(v) => go(v, v === 'board' ? '/tasks?view=board' : '/tasks')}
      options={[
        { value: 'list', 'aria-label': 'List', label: <Icon icon={Rows3} size={16} /> },
        { value: 'board', 'aria-label': 'Board', label: <Icon icon={Kanban} size={16} /> },
      ]}
    />
  );
}

/**
 * How the board's columns are cut: by pile, or by day.
 *
 * Words, not glyphs, because unlike the layout switch this changes WHAT a
 * column means — and "lists" and "week" have no icons anyone would read
 * correctly. Only rendered while the board is showing; on the list layout there
 * is nothing to group.
 */
export function BoardGroupBy({ group }: { group: 'scope' | 'week' }) {
  const go = useNavOnce(group);
  return (
    <SegmentedControl
      aria-label="Group board by"
      value={group}
      onValueChange={(v) => go(v, v === 'week' ? '/tasks?view=week' : '/tasks?view=board')}
      options={[
        { value: 'scope', label: 'Lists' },
        { value: 'week', label: 'Week' },
      ]}
    />
  );
}
