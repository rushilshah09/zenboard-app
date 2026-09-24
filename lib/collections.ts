import { PALETTE_NAMES, palette, type PaletteName } from '@/lib/palette';

// Collections (Notion-style databases) — shared types + pure helpers for the
// database views. Property definitions and view configs are plain JSON (stored
// in collections.props / collections.views), so new property types and view
// kinds are additive. Row values live in row.data keyed by property id.
// The property vocabulary is shared with page properties — see lib/properties.ts
// for why, and for the legacy `updated_time` → `last_edited_time` normalization.
// Re-exported so the many `from '@/lib/collections'` importers keep working and
// there is still only one definition.
export type { PropType, PropOption } from '@/lib/properties';
import { normalizePropType, normalizeOption, type PropType, type PropOption } from '@/lib/properties';
import { formatDay } from '@/lib/date';
import type { PageViewMode } from '@/lib/page-view-mode';
import { isTimelineZoom, type TimelineZoom } from '@/lib/timeline';
export type RollupAgg = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'show';
export type PropDef = {
  id: string; name: string; type: PropType; options?: PropOption[];
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

// The layouts a collection can be seen through. Table/board/gallery/list are the
// four structural lenses; the rest read the SAME rows through a specific property
// (calendar/timeline need a date, chart needs something to count).
export const VIEW_KINDS = ['table', 'board', 'gallery', 'list', 'calendar', 'timeline', 'feed', 'chart'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];
/** The guard for a layout read from stored JSON, which can say anything. */
export const isViewKind = (x: unknown): x is ViewKind => typeof x === 'string' && (VIEW_KINDS as readonly string[]).includes(x);
/** The ONE name per layout — a view tab, the view picker and a new view all say it. */
export const VIEW_LABEL: Record<ViewKind, string> = {
  table: 'Table', board: 'Board', gallery: 'Gallery', list: 'List',
  calendar: 'Calendar', timeline: 'Timeline', feed: 'Feed', chart: 'Chart',
};
// Views are presentation config ONLY — they never carry data. One collection
// can host unlimited views; every view reads the same rows.
export type ViewDef = {
  id: string; name: string; kind: ViewKind;
  sorts?: SortDef[]; hidden?: string[]; widths?: Record<string, number>;
  filter?: FilterGroup;
  groupBy?: string; subGroupBy?: string;
  /** Calendar/timeline: which date property places a row in time. */
  dateProp?: string;
  /** Timeline only: the bar's end. Absent ⇒ a one-day bar at `dateProp`. */
  endDateProp?: string;
  /** Calendar: which month is showing, as `YYYY-MM`. Absent ⇒ the current month. */
  month?: string;
  groupOrder?: string[]; collapsed?: string[]; hideEmpty?: boolean;
  /** Board: columns taken off the board, by group key. They wait under "Hidden groups". */
  hiddenGroups?: string[];
  colorRules?: ColorRule[];
  /** How this view opens a row's page — its "Open pages in". Absent ⇒ the layout's
   *  default (`openPagesIn`). */
  openIn?: PageViewMode;
  /** Table: hairlines between columns. Absent ⇒ shown. */
  verticalLines?: boolean;
  /** Board: each column washed in its group's colour. Absent ⇒ coloured (Notion's
   *  default for a board grouped by an option). */
  colorColumns?: boolean;
  /** Gallery: how wide a card may get before the row wraps. Absent ⇒ medium. */
  cardSize?: CardSize;
  /** Calendar: Saturday and Sunday columns. Absent ⇒ shown. */
  showWeekends?: boolean;
  /** Timeline: how much time a screen holds. Absent ⇒ month. */
  zoom?: TimelineZoom;
  /**
   * The view's own order of properties — Notion's: each view arranges its columns,
   * and dragging a table's header or a row of the Properties list writes this. The
   * ids it names come first, in its order; every other property follows in the
   * database's order (`viewProps`, lib/db-engine.ts). Absent ⇒ the database's order.
   */
  propOrder?: string[];
  /** An inline database: its name above the view bar ("Show data source title"). Absent ⇒ shown. */
  showTitle?: boolean;
};

/**
 * A row of a database — which, since migration 0028, IS a page
 * (`pages where database_id = <collection>`). The field names stay row-shaped
 * because that is what the views think in; `lib/actions/collections.ts` is the
 * one place that maps them onto the page columns:
 *
 *   title → pages.title · data → pages.properties · content → pages.content
 *   order → pages.row_order
 */
export type DbRow = {
  id: string; title: string; data: Record<string, unknown>;
  /**
   * The row's BODY — the prose under the properties, as a block document.
   *
   * It used to be smuggled into `data.__content`, where it was invisible to
   * everything that walks pages: search, version history, the outline, the
   * Connected panel. It is the page's own content now, which is the whole
   * point of "every row is a page".
   */
  content?: Record<string, unknown>;
  /**
   * Position among siblings — a text fractional index (see lib/row-order).
   * Replaces the `sort_index` double that held `Date.now()`; that number does
   * not fit in `pages.sort_index`, which is an int.
   */
  order: string;
  created_at: string; updated_at: string;
};
export type Collection = {
  id: string; page_id: string | null; name: string;
  props: PropDef[]; views: ViewDef[];
};

export const genId = () => Math.random().toString(36).slice(2, 10);

/**
 * Bring a stored collection's property definitions up to the current
 * vocabulary. Props are JSONB, so a retired spelling survives in the data long
 * after it leaves the union — databases wrote `updated_time` before the merge
 * with page properties. Applied at every read boundary; the next save writes
 * the canonical form back, so each collection migrates itself once.
 */
export function normalizeProps(props: PropDef[] | null | undefined): PropDef[] {
  return (props ?? []).map((p) => ({
    ...p,
    type: normalizePropType(p.type),
    ...(p.options ? { options: p.options.map(normalizeOption) } : {}),
  }));
}

export const normalizeCollection = <T extends { props?: PropDef[]; views?: ViewDef[] }>(c: T): T =>
  ({ ...c, props: normalizeProps(c.props), ...(c.views ? { views: normalizeViews(c.views) } : {}) });

/**
 * Views are JSON as well. A mode this build does not know — a retired spelling, a
 * typo — is dropped rather than carried, so the view opens its pages in its layout's
 * default and the next save writes the clean form back.
 */
export function normalizeViews(views: ViewDef[]): ViewDef[] {
  return views.map((v) => {
    const badOpenIn = v.openIn !== undefined && !isOpenIn(v.openIn);
    const badCardSize = v.cardSize !== undefined && !isCardSize(v.cardSize);
    const badZoom = v.zoom !== undefined && !isTimelineZoom(v.zoom);
    const badOrder = v.propOrder !== undefined && !(Array.isArray(v.propOrder) && v.propOrder.every((id) => typeof id === 'string'));
    const badTitle = v.showTitle !== undefined && typeof v.showTitle !== 'boolean';
    if (!badOpenIn && !badCardSize && !badZoom && !badOrder && !badTitle) return v;
    const clean = { ...v };
    if (badOpenIn) delete clean.openIn;
    if (badCardSize) delete clean.cardSize;
    if (badZoom) delete clean.zoom;
    if (badOrder) delete clean.propOrder;
    if (badTitle) delete clean.showTitle;
    return clean;
  });
}

// ── How a view opens its pages (database brief §8, after Notion) ──
// You work THROUGH a table, board, list or timeline, so its pages open on the side
// and the view stays live beside them; a gallery, calendar, feed or chart is looked
// at one item at a time, so its pages open centred. A view's own "Open pages in"
// beats its layout's default, and the viewport still vetoes a peek with no room
// (`resolveMode` in lib/page-view-mode.ts).
const OPEN_IN_MODES: readonly PageViewMode[] = ['side-peek', 'center-peek', 'full-page'];
const isOpenIn = (x: unknown): x is PageViewMode =>
  typeof x === 'string' && (OPEN_IN_MODES as readonly string[]).includes(x);

export const OPEN_IN_DEFAULT: Record<ViewKind, PageViewMode> = {
  table: 'side-peek', board: 'side-peek', list: 'side-peek', timeline: 'side-peek',
  gallery: 'center-peek', calendar: 'center-peek', feed: 'center-peek', chart: 'center-peek',
};

export const openPagesIn = (view: Pick<ViewDef, 'kind' | 'openIn'>): PageViewMode =>
  isOpenIn(view.openIn) ? view.openIn : (OPEN_IN_DEFAULT[view.kind] ?? 'side-peek');

// ── What a layout's settings offer (database brief §7, after Notion's Layout page) ──
// Each layout has settings of its own, and the page never shows one that does
// nothing in the layout on screen: vertical lines mean nothing to a board, card
// size nothing to a table. Group by, sort and filter live on their own pages.
export const LAYOUT_OPTIONS = ['verticalLines', 'groupBy', 'colorColumns', 'hideEmptyGroups', 'cardSize', 'calendarBy', 'showWeekends', 'timelineBy', 'timelineEnd'] as const;
export type LayoutOption = (typeof LAYOUT_OPTIONS)[number];

const OPTIONS_BY_LAYOUT: Record<ViewKind, readonly LayoutOption[]> = {
  table: ['verticalLines', 'hideEmptyGroups'],
  board: ['groupBy', 'colorColumns', 'hideEmptyGroups'],
  gallery: ['cardSize'],
  calendar: ['calendarBy', 'showWeekends'],
  timeline: ['timelineBy', 'timelineEnd'],
  list: [], feed: [], chart: [],
};
export const layoutOptions = (kind: ViewKind): LayoutOption[] => [...(OPTIONS_BY_LAYOUT[kind] ?? [])];

/** The ONE name per setting — the settings row and its tooltip both say it. */
export const LAYOUT_OPTION_LABEL: Record<LayoutOption, string> = {
  verticalLines: 'Show vertical lines',
  groupBy: 'Group by',
  colorColumns: 'Color columns',
  hideEmptyGroups: 'Hide empty groups',
  cardSize: 'Card size',
  calendarBy: 'Show calendar by',
  showWeekends: 'Show weekends',
  timelineBy: 'Show timeline by',
  timelineEnd: 'End date',
};

export const CARD_SIZES = ['small', 'medium', 'large'] as const;
export type CardSize = (typeof CARD_SIZES)[number];
export const CARD_SIZE_LABEL: Record<CardSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
const isCardSize = (x: unknown): x is CardSize => typeof x === 'string' && (CARD_SIZES as readonly string[]).includes(x);
const CARD_MIN: Record<CardSize, number> = { small: 180, medium: 220, large: 300 };
/** A gallery card's narrowest width, which decides how many share a row. */
export const galleryCardMin = (size: CardSize | undefined): number => (isCardSize(size) ? CARD_MIN[size] : CARD_MIN.medium);

// Option chips draw from the app's one nine-hue palette (lib/palette.ts →
// globals.css --pal-*). This file used to declare an identical list under the
// name `OptionColor`, plus its own copy of the token lookup; `prop-convert` had
// a third, eight-long and in a different order, so a text→select conversion
// coloured its invented options differently from ones you picked by hand.
export type OptionColor = PaletteName;
export const OPTION_COLORS = PALETTE_NAMES;
export const optionTokens = (c: PaletteName) => palette(c);
export const nextColor = (used: number): PaletteName => PALETTE_NAMES[used % PALETTE_NAMES.length];

// The default new database: Name · Status · Tags, and one view in the layout it
// was asked for (Notion's shape). A layout that places rows in TIME also gets the
// date it places them by — a new calendar database used to open on "Add a date
// property to see these rows on a calendar", a layout able to show nothing.
export function defaultCollection(kind: ViewKind = 'table'): { props: PropDef[]; views: ViewDef[] } {
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
  const date: PropDef | null = kind === 'calendar' || kind === 'timeline' ? { id: genId(), name: 'Date', type: 'date' } : null;
  if (date) props.push(date);
  const views: ViewDef[] = [{ id: genId(), name: VIEW_LABEL[kind], kind, ...(date ? { dateProp: date.id } : {}) }];
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
  // The tiebreak is the manual order — a text fractional index, so this is a
  // plain string comparison rather than a subtraction.
  return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
}

// A database cell always shows the year: a row can be any age, and there is no
// surrounding context to infer it from.
export const fmtCellDate = (iso: string) => formatDay(iso, { year: true }) ?? '';
