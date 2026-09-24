// Where a row or a column carried across a table lands (database plan T12, after
// Notion). Nothing in the table moves while one is carried: a line shows the gap it
// will drop into — the gap nearest the pointer — and the drop writes the new place.
// Pure, so every drop is tested without a pointer; the drag itself is
// components/documents/table-drag.tsx.

/** One run of a table's rows as drawn: the whole table, or one group of a grouped table. */
export type SectionBox = {
  key: string;
  /** Where its rows start — under its header — which is its one gap when it shows none. */
  top: number;
  /** Its drawn rows' edges, top to bottom. */
  rows: { id: string; top: number; bottom: number }[];
  /** A folded group draws no rows: a row dropped on it goes to its end. */
  collapsed?: boolean;
  /** How many rows it holds, drawn or not. */
  count: number;
};

/** A place a row can drop: before the `index`-th row of `section` (index = count: at its end). */
export type RowGap = { section: string; index: number; y: number };

/** Every gap a row can drop into: before each row, after the last, one for an empty or folded group. */
export function rowGaps(sections: SectionBox[]): RowGap[] {
  const gaps: RowGap[] = [];
  for (const s of sections) {
    if (s.collapsed || s.rows.length === 0) { gaps.push({ section: s.key, index: s.count, y: s.top }); continue; }
    s.rows.forEach((r, i) => gaps.push({ section: s.key, index: i, y: r.top }));
    gaps.push({ section: s.key, index: s.rows.length, y: s.rows[s.rows.length - 1].bottom });
  }
  return gaps;
}

/** The gap nearest the pointer — `y` for rows, `x` for columns. */
export function nearestGap<T>(gaps: T[], at: number, pos: (gap: T) => number): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const g of gaps) {
    const d = Math.abs(pos(g) - at);
    if (d < bestDistance) { best = g; bestDistance = d; }
  }
  return best;
}

/**
 * Where a row carried out of `from` lands at `gap`: its section, and its index among
 * the OTHER rows there — what `reorderKeys` takes. Null when the drop would leave it
 * where it is (the gaps just above and just below itself).
 */
export function rowLanding(gap: RowGap, from: { section: string; index: number }): { section: string; index: number } | null {
  if (gap.section !== from.section) return { section: gap.section, index: gap.index };
  if (gap.index === from.index || gap.index === from.index + 1) return null;
  return { section: gap.section, index: gap.index > from.index ? gap.index - 1 : gap.index };
}

/** A place a column can drop: before the column `beforeId`, or after the last (null). */
export type ColumnGap = { beforeId: string | null; x: number };

export function columnGaps(columns: { id: string; left: number; right: number }[]): ColumnGap[] {
  const gaps: ColumnGap[] = columns.map((c) => ({ beforeId: c.id, x: c.left }));
  if (columns.length) gaps.push({ beforeId: null, x: columns[columns.length - 1].right });
  return gaps;
}

/** `order` with `id` moved before `beforeId` (null: to the end); null when nothing would change. */
export function moveBefore(order: string[], id: string, beforeId: string | null): string[] | null {
  if (id === beforeId || !order.includes(id)) return null;
  const rest = order.filter((x) => x !== id);
  const at = beforeId === null ? rest.length : rest.indexOf(beforeId);
  if (at < 0) return null;
  const next = [...rest.slice(0, at), id, ...rest.slice(at)];
  return next.every((x, i) => x === order[i]) ? null : next;
}

/**
 * The order a sorted table shows, frozen, with one row moved into it — what a drop
 * writes when it clears the sort that was deciding where rows go. `shown` is every
 * row as displayed (each once); the moved row goes before `beforeId`, else right after
 * `afterId`, else last.
 */
export function frozenOrder(shown: string[], movedId: string, place: { beforeId?: string; afterId?: string }): string[] {
  const rest = shown.filter((id) => id !== movedId);
  let at = rest.length;
  if (place.beforeId && rest.includes(place.beforeId)) at = rest.indexOf(place.beforeId);
  else if (place.afterId && rest.includes(place.afterId)) at = rest.indexOf(place.afterId) + 1;
  return [...rest.slice(0, at), movedId, ...rest.slice(at)];
}
