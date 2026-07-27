// Collections (Notion-style databases) — shared types + pure helpers for the
// database views. Property definitions and view configs are plain JSON (stored
// in collections.props / collections.views), so new property types and view
// kinds are additive. Row values live in row.data keyed by property id.
export type PropType =
  | 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'status'
  | 'checkbox' | 'date' | 'url' | 'email' | 'phone'
  | 'created_time' | 'updated_time'
  | 'relation' | 'rollup' | 'formula';

export type SelectOption = { id: string; name: string; color: OptionColor };
export type RollupAgg = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'show';
export type PropDef = {
  id: string; name: string; type: PropType; options?: SelectOption[];
  // relation: which database this property links to (row value = row-id array)
  relation?: { collectionId: string };
  // rollup: aggregate a property of the rows behind a relation property
  rollup?: { relationPropId: string; targetPropId: string; agg: RollupAgg };
  // formula: an expression over this row's properties — see lib/db-engine
  formula?: { expr: string };
};

export type SortDef = { prop: string; dir: 'asc' | 'desc' };

// ── Filters (Notion model): rules combined with and/or, groups nestable ──
export type FilterOp =
  | 'is' | 'is_not' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'before' | 'after' | 'on';
export type FilterRule = { prop: string; op: FilterOp; value?: unknown };
export type FilterGroup = { logic: 'and' | 'or'; rules: (FilterRule | FilterGroup)[] };
export const isFilterGroup = (f: FilterRule | FilterGroup): f is FilterGroup => 'logic' in f;

// Conditional color (§9.3): a filter rule that paints a row's background when it
// matches. Rules are evaluated in order — first match wins.
export type ColorRule = FilterRule & { color: OptionColor };

export type ViewKind = 'table' | 'board' | 'gallery' | 'list';
// Views are presentation config ONLY — they never carry data. One collection
// can host unlimited views; every view reads the same rows.
export type ViewDef = {
  id: string; name: string; kind: ViewKind;
  sorts?: SortDef[]; hidden?: string[]; widths?: Record<string, number>;
  filter?: FilterGroup;
  groupBy?: string; subGroupBy?: string;
  groupOrder?: string[]; collapsed?: string[]; hideEmpty?: boolean;
  colorRules?: ColorRule[];
};

export type DbRow = {
  id: string; title: string; data: Record<string, unknown>;
  sort_index: number; created_at: string; updated_at: string;
};
export type Collection = {
  id: string; page_id: string | null; name: string;
  props: PropDef[]; views: ViewDef[];
};

export const genId = () => Math.random().toString(36).slice(2, 10);

// Option chips draw from the semantic event/tag palette (globals.css --pal-*).
export type OptionColor = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
export const OPTION_COLORS: OptionColor[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const optionTokens = (c: OptionColor) => ({
  dot: `var(--pal-${c}-dot)`, bg: `var(--pal-${c}-bg)`, text: `var(--pal-${c}-text)`,
});
export const nextColor = (used: number): OptionColor => OPTION_COLORS[used % OPTION_COLORS.length];

// The default new database: Name · Status · Tags, one Table view (Notion's shape).
export function defaultCollection(): { props: PropDef[]; views: ViewDef[] } {
  const props: PropDef[] = [
    { id: 'title', name: 'Name', type: 'title' },
    {
      id: genId(), name: 'Status', type: 'status',
      options: [
        { id: 'not_started', name: 'Not started', color: 'gray' },
        { id: 'in_progress', name: 'In progress', color: 'blue' },
        { id: 'done', name: 'Done', color: 'green' },
      ],
    },
    { id: genId(), name: 'Tags', type: 'multi_select', options: [] },
  ];
  const views: ViewDef[] = [{ id: genId(), name: 'Table', kind: 'table' }];
  return { props, views };
}

// ── Row value helpers ──
export const rowText = (r: DbRow, p: PropDef): string => {
  if (p.type === 'title') return r.title;
  const v = r.data[p.id];
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(',');
  return String(v);
};

export function compareRows(a: DbRow, b: DbRow, sorts: SortDef[] | undefined, props: PropDef[]): number {
  for (const s of sorts ?? []) {
    const p = props.find((x) => x.id === s.prop);
    if (!p) continue;
    let av: string | number = rowText(a, p), bv: string | number = rowText(b, p);
    if (p.type === 'number') { av = parseFloat(av as string) || 0; bv = parseFloat(bv as string) || 0; }
    if (p.type === 'checkbox') { av = a.data[p.id] ? 1 : 0; bv = b.data[p.id] ? 1 : 0; }
    if (av < bv) return s.dir === 'asc' ? -1 : 1;
    if (av > bv) return s.dir === 'asc' ? 1 : -1;
  }
  return a.sort_index - b.sort_index;
}

export const fmtCellDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
