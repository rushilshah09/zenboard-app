// A database seen as a board — the rules, without a DOM.
//
// A board is the same rows as every other view, cut into columns by one property
// (database brief §6, after Notion). Everything a board decides lives here so it
// can be tested: which columns show and in what order, what a card's value
// becomes when it is carried into another column, where it lands, and the order
// key that keeps it there. `components/documents/database-board.tsx` only draws.
import { compareRows, type DbRow, type PropDef, type ViewDef } from '@/lib/collections';
import { asIds, byGroupOrder, groupRows, type RowGroup } from '@/lib/db-engine';

/** The key of the column holding rows with no value for the board's property. */
export const NO_VALUE = '__none__';

/** The property types a board can be grouped by — the ones with a finite set of values. */
export const isBoardGroupable = (p: PropDef) =>
  p.type === 'status' || p.type === 'select' || p.type === 'multi_select' || p.type === 'checkbox';

/**
 * The property a board is grouped by: the view's own choice, else its first status,
 * else its first select — the order a new board picks one in (Notion does the same).
 */
export function boardGroupProp(view: Pick<ViewDef, 'groupBy'>, props: PropDef[]): PropDef | undefined {
  const chosen = props.find((p) => p.id === view.groupBy && isBoardGroupable(p));
  return chosen ?? props.find((p) => p.type === 'status') ?? props.find((p) => p.type === 'select');
}

export type BoardColumns = {
  /** The columns on the board, left to right. */
  shown: RowGroup[];
  /** Columns the view hides, in board order — listed at the end so they can come back. */
  hidden: RowGroup[];
};

/**
 * The board's columns, in order.
 *
 * - The option order, unless the view has its own (`groupOrder`, set by dragging).
 * - The no-value column comes FIRST, as in Notion — it is where a card with nothing
 *   set is waiting to be sorted — and only while it holds something. An empty
 *   "No Status" column is a drop target for clearing a value the page itself
 *   already offers, and on a status board, where every new page starts in the first
 *   option, it would be an empty column forever. (A deliberate difference.)
 * - "Hide empty groups" drops every empty column; hidden columns move to `hidden`.
 */
export function boardColumns(rows: DbRow[], view: ViewDef, props: PropDef[], prop: PropDef): BoardColumns {
  // Sub-grouping is a table's second level; a board is one level of columns.
  const groups = groupRows(rows, { ...view, subGroupBy: undefined }, props, prop.id);
  const ordered = view.groupOrder?.includes(NO_VALUE)
    ? groups
    : [...groups.filter((g) => g.key === NO_VALUE), ...groups.filter((g) => g.key !== NO_VALUE)];
  const present = ordered.filter((g) => !(g.key === NO_VALUE && g.rows.length === 0) && !(view.hideEmpty && g.rows.length === 0));
  const hiddenKeys = new Set(view.hiddenGroups ?? []);
  return {
    shown: present.filter((g) => !hiddenKeys.has(g.key)),
    hidden: present.filter((g) => hiddenKeys.has(g.key)),
  };
}

/** One of a board's possible columns, whether or not anything is in it. */
export type BoardGroup = Pick<RowGroup, 'key' | 'label' | 'option'>;

/**
 * EVERY column a board can have, in the board's order — what its settings list, so
 * a column can be hidden, shown or moved before a single page is in it. The same
 * order `boardColumns` draws: the no-value column first unless placed, then the
 * view's own order over the options'.
 */
export function boardGroupList(prop: PropDef, view: Pick<ViewDef, 'groupOrder'>): BoardGroup[] {
  const natural = prop.type === 'checkbox' ? ['true', 'false'] : (prop.options ?? []).map((o) => o.id);
  const placed = view.groupOrder?.includes(NO_VALUE);
  const keys = byGroupOrder(placed ? [...natural, NO_VALUE] : natural, view.groupOrder);
  return (placed ? keys : [NO_VALUE, ...keys]).map((key) => {
    const option = prop.options?.find((o) => o.id === key);
    const label = key === NO_VALUE ? `No ${prop.name}` : key === 'true' ? 'Checked' : key === 'false' ? 'Unchecked' : option?.name ?? key;
    return { key, label, option };
  });
}

/**
 * A row's data once its card is carried from one column to another.
 *
 * A multi-select card can sit in several columns at once; carrying it out of one
 * swaps THAT value for the new one and keeps the rest (Notion). Into the no-value
 * column it clears the value; a checkbox takes the column's side.
 */
export function moveToGroup(row: DbRow, prop: PropDef, from: string, to: string): Record<string, unknown> {
  const data = { ...row.data };
  if (prop.type === 'checkbox') {
    data[prop.id] = to === 'true';
    return data;
  }
  if (prop.type === 'multi_select') {
    const kept = asIds(data[prop.id]).filter((id) => id !== from);
    data[prop.id] = to === NO_VALUE ? [] : kept.includes(to) ? kept : [...kept, to];
    return data;
  }
  if (to === NO_VALUE) delete data[prop.id];
  else data[prop.id] = to;
  return data;
}

/** The value a new card takes in a column — what `moveToGroup` would give it. */
export function groupPreset(prop: PropDef, key: string): Record<string, unknown> {
  if (prop.type === 'checkbox') return { [prop.id]: key === 'true' };
  if (key === NO_VALUE) return { [prop.id]: prop.type === 'multi_select' ? [] : undefined };
  return { [prop.id]: prop.type === 'multi_select' ? [key] : key };
}

/**
 * Where a card being carried would drop, from the pointer: the number of the
 * column's OTHER cards whose middle is above it. `middles` are the resting
 * vertical centres of those cards, top to bottom, in the same coordinates as `y`.
 */
export function landingFromPointer(middles: number[], y: number): number {
  let i = 0;
  while (i < middles.length && y > middles[i]) i++;
  return i;
}

/**
 * Where a card lands in a SORTED view. The sort decides, not the pointer — a slot
 * under the cursor would promise a place the card will not take (the content
 * board's rule). Asked of the real comparison, with the move already applied, so
 * the marker and the outcome cannot disagree.
 */
export function sortedLanding(others: DbRow[], moved: DbRow, sorts: ViewDef['sorts'], props: PropDef[]): number {
  return [...others, moved].sort((a, b) => compareRows(a, b, sorts, props)).findIndex((r) => r.id === moved.id);
}

/** The order keys a drop writes — see lib/row-order.ts. Re-exported for the board's callers. */
export { reorderKeys } from '@/lib/row-order';
