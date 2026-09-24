'use client';
// DatabasePage — Notion-style database hosted by a page of type 'database'.
// Table · Board (drag between groups) · Gallery views over one typed collection
// (lib/collections). Optimistic edits persist via lib/actions/collections;
// a page whose content carries `demoDb` runs on local state (dev-preview).
// Its panels are the DS popover (db-pop.tsx) in the one overlay chrome, with the
// menu's 32px rows, labels, separators and fields (components/ds/ui/menu.tsx).
import { forwardRef, Fragment, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Plus, Clock, History, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Maximize2, Search, SlidersHorizontal, X, Filter, Check, ChevronRight, ArrowLeft, ArrowDownUp, Link as LinkIcon, Layers, Paintbrush, CircleAlert, Database, Calendar, Grid2x2, type IconType } from "@/components/ds/icons";
import { Icon, Button, IconButton, SegmentedControl, PageView, PAGE_VIEW_MODE_ICON, PAGE_VIEW_MODE_HINT, DropdownMenuItem, toast, copyText, useConfirm, Switch, Skeleton, EmptyLine, MenuField, MenuSelect, OVERLAY_CLASS, type Crumb } from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import {
  genId, defaultCollection, fmtCellDate, optionTokens, rowText, isFilterGroup, OPTION_COLORS, VIEW_LABEL, openPagesIn,
  layoutOptions, LAYOUT_OPTION_LABEL, CARD_SIZES, CARD_SIZE_LABEL,
  type Collection, type DbRow, type PropDef, type PropType, type ViewDef, type PropOption,
  type FilterRule, type FilterOp, type ColorRule, type FilterGroup,
} from '@/lib/collections';
import { getDatabase, getCollection, listCollections } from '@/lib/actions/collections';
import { applyView, evalFormula, groupRows, newRowValues, rowColor, viewProps, RETYPEABLE, type RowGroup } from '@/lib/db-engine';
import { seedStore, receiveDatabase, usePageStore, useCollectionStore, loadPlan, useDbState, resolveCollection, storeForCollection, subscribeStores, type DbStore } from '@/lib/db-store';
import { loadPage, pageEntry, patchPage, subscribePages, usePage, type PageRecord } from '@/lib/page-store';
import { PeekContext, usePeek, type PeekApi, type PeekEntry } from '@/components/documents/peek-context';
import { back as trailBack, backTo, deeper, forward as trailForward, startTrail, type Trail } from '@/lib/peek-trail';
import { describeDbFailure, type DbFailure } from '@/lib/database-failure';
import { VIEW_CHOICES, VIEW_ICON } from '@/components/documents/view-icons';
import { DatabaseViewsBar, type ViewActions } from '@/components/documents/database-views-bar';
import { duplicateView, orderViews, removeView, viewFromHash, viewLink } from '@/lib/view-list';
import { useLocationHash } from '@/lib/use-location-hash';
import { bleed } from '@/lib/bleed';
import { boardGroupList, boardGroupProp, isBoardGroupable, moveToGroup } from '@/lib/board';
import { orderFor, reorderKeys } from '@/lib/row-order';
import { frozenOrder, moveBefore } from '@/lib/table-drag';
import { ColumnDragCell, RowHandle, TableDrag } from '@/components/documents/table-drag';
import { SortableList } from '@/components/documents/sortable-list';
import { BoardGroupsList } from '@/components/documents/board-groups-list';
import { DatabaseBoard } from '@/components/documents/database-board';
import { DatabaseTimeline } from '@/components/documents/database-timeline';
import { DatabaseGallery } from '@/components/documents/database-gallery';
import { DatabaseList } from '@/components/documents/database-list';
import { timelineProps } from '@/lib/timeline';
import { OptionChip } from '@/components/documents/option-chip';
import { Pop, POP_LABEL, POP_ROW, POP_SEPARATOR } from '@/components/documents/db-pop';
import { Cell } from '@/components/documents/db-cell';
import { toBlocks, serialize, withBlocks, type Block } from '@/lib/blocks';
import { monthGrid, rowsByDay, shiftMonth, monthKeyOf, dayKeyOf, monthLabel, weekdayLabels, withoutWeekends } from '@/lib/calendar-grid';
import { WEEK_STARTS_ON } from '@/lib/date';
import { planConversion } from '@/lib/prop-convert';
import { propTypesFor, isOptioned, propLabel } from '@/lib/properties';
import { propIcon } from '@/components/documents/property-icons';
import { FormulaEditor } from '@/components/documents/formula-editor';
import { MODE_LABEL, type PageViewMode } from '@/lib/page-view-mode';

// Preview target for a formula on a collection with no rows yet: every prop()
// reads as absent, so the editor still checks the SYNTAX, which is the half of
// the feedback that matters before there is any data to compute over.
const EMPTY_ROW: DbRow = { id: '__preview', title: '', data: {}, created_at: '', updated_at: '', order: 'a0' };

// The types this view offers, from the ONE registry (lib/properties.ts). This
// was a second hand-written table that disagreed with the page one about the
// icon for text, multi-select, status and email — the same property type wore a
// different face depending on where you met it.
const PROP_META = propTypesFor('database');
// "Values are option ids" is a fact about the TYPE, so it comes from the
// registry too (this file, doc-properties and prop-convert each had their own).
const isSelectish = isOptioned;

// Only IMPLEMENTED layouts are listed — the picker must never offer a view that
// renders nothing. `ViewKind` carries more kinds than this on purpose; each is
// added here as it ships (timeline and chart are not built yet). The name and the
// glyph come from the one vocabulary every surface shares (view-icons.ts).
const VIEW_META = VIEW_CHOICES;
const viewIcon = (k: ViewDef['kind']): IconType => VIEW_ICON[k];

// ── Filter operators (§9.4) — the set offered per property type, matching the
//    engine's ruleMatches (lib/db-engine). `noValue` ops need no value input. ──
type OpItem = { op: FilterOp; label: string; noValue?: boolean };
const EMPTY_OPS: OpItem[] = [{ op: 'is_empty', label: 'Is empty', noValue: true }, { op: 'is_not_empty', label: 'Is not empty', noValue: true }];
function opsFor(type: PropType): OpItem[] {
  if (type === 'checkbox') return [{ op: 'is', label: 'Is' }];
  if (type === 'number') return [
    { op: 'is', label: '=' }, { op: 'is_not', label: '≠' },
    { op: 'gt', label: '>' }, { op: 'lt', label: '<' }, { op: 'gte', label: '≥' }, { op: 'lte', label: '≤' },
    ...EMPTY_OPS,
  ];
  if (type === 'select' || type === 'status') return [{ op: 'is', label: 'Is' }, { op: 'is_not', label: 'Is not' }, ...EMPTY_OPS];
  if (type === 'multi_select') return [{ op: 'contains', label: 'Contains' }, { op: 'not_contains', label: 'Does not contain' }, ...EMPTY_OPS];
  if (type === 'date' || type === 'created_time' || type === 'last_edited_time') return [
    { op: 'on', label: 'Is' }, { op: 'before', label: 'Before' }, { op: 'after', label: 'After' }, ...EMPTY_OPS,
  ];
  return [ // text · title · url · email · phone
    { op: 'contains', label: 'Contains' }, { op: 'not_contains', label: 'Does not contain' },
    { op: 'is', label: 'Is' }, { op: 'is_not', label: 'Is not' }, ...EMPTY_OPS,
  ];
}
const defaultOp = (type: PropType): FilterOp => opsFor(type)[0].op;
const opLabel = (type: PropType, op: FilterOp): string => opsFor(type).find((o) => o.op === op)?.label ?? op;
const opNeedsValue = (type: PropType, op: FilterOp): boolean => !opsFor(type).find((o) => o.op === op)?.noValue;
// One-line chip summary: "{Property}: {op} {value}".
function chipSummary(rule: FilterRule, p: PropDef): string {
  const lbl = opLabel(p.type, rule.op);
  if (!opNeedsValue(p.type, rule.op)) return `${p.name}: ${lbl}`;
  let v = '';
  if (p.type === 'checkbox') v = rule.value === true || rule.value === 'true' ? 'Checked' : 'Unchecked';
  else if (isSelectish(p.type)) v = (p.options ?? []).find((o) => o.id === rule.value || o.name === rule.value)?.name ?? String(rule.value ?? '');
  else if ((p.type === 'date' || p.type === 'created_time' || p.type === 'last_edited_time') && rule.value) v = fmtCellDate(String(rule.value));
  else v = String(rule.value ?? '');
  return v ? `${p.name}: ${lbl} ${v}` : `${p.name}: ${lbl}…`;
}

// Condition editor for one filter chip (§9.4): the condition as a menu select + a
// value field matched to the property type. Empty-check ops need no value. Inside a
// panel both are the panel's own controls (MenuSelect, MenuField) — they were the
// browser's <select> and a recessed field with its own outline.
const opOptions = (type: PropType) => opsFor(type).map((o) => ({ value: o.op, label: o.label }));

// The value editor for a filter/color rule — shape follows the property type
// (checkbox → checked/unchecked · select-ish → option chips · else → typed input).
function RuleValueInput({ prop, value, onValue, autoFocus }: {
  prop: PropDef; value: unknown; onValue: (v: unknown) => void; autoFocus?: boolean;
}) {
  if (prop.type === 'checkbox') return (
    <MenuSelect aria-label="Value" value={value === false || value === 'false' ? 'false' : 'true'} onValueChange={(v) => onValue(v === 'true')}
      options={[{ value: 'true', label: 'Checked' }, { value: 'false', label: 'Unchecked' }]} />
  );
  if (isSelectish(prop.type)) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 176, overflowY: 'auto' }}>
      {(prop.options ?? []).map((o) => {
        const on = value === o.id || value === o.name;
        return (
          <button key={o.id} onClick={() => onValue(o.id)} aria-pressed={on} className={cn('zb-press', POP_ROW)}>
            <span className="min-w-0 flex-1"><OptionChip opt={o} status={prop.type === 'status'} /></span>
            {on && <Icon icon={Check} size={16} className="text-ink-600" />}
          </button>
        );
      })}
      {!(prop.options ?? []).length && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No options yet</div>}
    </div>
  );
  return (
    <MenuField
      type={prop.type === 'number' ? 'number' : (prop.type === 'date' || prop.type === 'created_time' || prop.type === 'last_edited_time' ? 'date' : 'text')}
      autoFocus={autoFocus} value={String(value ?? '')} onChange={(e) => onValue(e.target.value)}
      placeholder="Value" aria-label="Value"
    />
  );
}

// One sub-group's editor: its own and/or, its conditions, add and remove. Only
// plain rules live inside — the builder stops at one level of nesting even though
// the engine recurses (a filter you can't read back is worse than one you can't
// express). Returning `null` from onChange removes the whole group.
function FilterGroupEditor({ group, props, onChange }: {
  group: FilterGroup; props: PropDef[]; onChange: (next: FilterGroup | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const inner: FilterRule[] = group.rules.filter((r) => !isFilterGroup(r)) as FilterRule[];
  const write = (rules: FilterRule[], logic = group.logic) =>
    rules.length ? onChange({ logic, rules }) : onChange(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 2 }}>
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-caption font-semibold text-ink-500">Match</span>
        <SegmentedControl
          aria-label="Group logic" fit="content"
          options={[{ value: 'and', label: 'all' }, { value: 'or', label: 'any' }]}
          value={group.logic}
          onValueChange={(l) => write(inner, l as FilterGroup['logic'])}
        />
      </div>
      {inner.map((r, i) => {
        const p = props.find((x) => x.id === r.prop);
        if (!p) return null;
        return (
          <div key={i} className="rounded-md border border-line-soft p-1">
            <FilterCondition
              rule={r} prop={p}
              onChange={(patch) => write(inner.map((x, k) => (k === i ? { ...x, ...patch } : x)))}
              onRemove={() => write(inner.filter((_, k) => k !== i))}
            />
          </div>
        );
      })}
      <div className="relative">
        <button onClick={() => setAdding((v) => !v)} className={cn('zb-press', POP_ROW, 'text-ink-600')}>
          <Icon icon={Plus} size={16} /> Add condition
        </button>
        {adding && (
          <Pop onClose={() => setAdding(false)} width={200}>
            {props.map((p) => (
              <button key={p.id} className={cn('zb-press', POP_ROW)}
                onClick={() => { write([...inner, { prop: p.id, op: defaultOp(p.type), ...(p.type === 'checkbox' ? { value: true } : {}) }]); setAdding(false); }}>
                <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </button>
            ))}
          </Pop>
        )}
      </div>
    </div>
  );
}

function FilterCondition({ rule, prop, onChange, onRemove }: {
  rule: FilterRule; prop: PropDef; onChange: (patch: Partial<FilterRule>) => void; onRemove: () => void;
}) {
  const needsValue = opNeedsValue(prop.type, rule.op);
  return (
    <div className="flex flex-col gap-1.5 p-0.5">
      <div className="flex items-center gap-2 px-1 pb-0.5">
        <Icon icon={propIcon(prop.type)} size={16} className="shrink-0 text-ink-500" />
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-800">{prop.name}</span>
      </div>
      <MenuSelect aria-label="Condition" value={rule.op} options={opOptions(prop.type)} onValueChange={(op) => onChange({ op: op as FilterOp })} />
      {needsValue && <RuleValueInput prop={prop} value={rule.value} onValue={(v) => onChange({ value: v })} autoFocus />}
      <button onClick={onRemove} className={cn('zb-press', POP_ROW, 'text-danger-600')}><Icon icon={Trash2} size={16} /> Delete filter</button>
    </div>
  );
}

// Conditional color (§9.3): one "when {prop} {op} {value} → {color}" rule.
function ColorRuleEditor({ rule, props, onChange, onRemove }: {
  rule: ColorRule; props: PropDef[]; onChange: (patch: Partial<ColorRule>) => void; onRemove: () => void;
}) {
  const [swatch, setSwatch] = useState(false);
  const prop = props.find((p) => p.id === rule.prop) ?? props[0];
  const needsValue = opNeedsValue(prop.type, rule.op);
  const tk = optionTokens(rule.color);
  return (
    // One rule, set apart by a hairline — never a second fill inside the panel's.
    <div className="mb-1.5 flex flex-col gap-1.5 rounded-md border border-border p-1.5">
      <div className="flex items-center gap-1.5">
        <MenuSelect aria-label="Color rule property" className="flex-1" value={prop.id}
          options={props.map((p) => ({ value: p.id, label: p.name, icon: <Icon icon={propIcon(p.type)} size={16} /> }))}
          onValueChange={(id) => { const np = props.find((p) => p.id === id)!; onChange({ prop: np.id, op: defaultOp(np.type), value: undefined }); }} />
        <div className="relative shrink-0">
          <button onClick={() => setSwatch((v) => !v)} title="Row color" aria-label="Row color" className="zb-press size-8 cursor-pointer rounded-md border border-border" style={{ background: tk.bg }} />
          {swatch && (
            <Pop onClose={() => setSwatch(false)} right width={140}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, padding: 2 }}>
                {OPTION_COLORS.map((c) => {
                  const ct = optionTokens(c);
                  return <button key={c} onClick={() => { onChange({ color: c }); setSwatch(false); }} title={c} aria-label={c} className="zb-press" style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', border: rule.color === c ? '2px solid var(--ink-2)' : '1px solid var(--line)', background: ct.bg, cursor: 'pointer' }} />;
                })}
              </div>
            </Pop>
          )}
        </div>
      </div>
      <MenuSelect aria-label="Color rule condition" value={rule.op} options={opOptions(prop.type)} onValueChange={(op) => onChange({ op: op as FilterOp })} />
      {needsValue && <RuleValueInput prop={prop} value={rule.value} onValue={(v) => onChange({ value: v })} />}
      <button onClick={onRemove} className={cn('zb-press', POP_ROW, 'text-danger-600')}><Icon icon={Trash2} size={16} /> Delete rule</button>
    </div>
  );
}

// ── View settings panel (§9.3): a sliders-icon menu with sub-pages for layout,
//    property visibility, multi-level sort, and grouping. Engine compareRows
//    already honours the full sorts[] list in order, so multi-sort is live. ──
type SettingsPage = 'root' | 'layout' | 'open' | 'props' | 'sort' | 'group' | 'groupBy' | 'color' | 'cardSize' | 'calendarBy' | 'timelineBy' | 'timelineEnd';
const OPEN_MODES: PageViewMode[] = ['side-peek', 'center-peek', 'full-page'];

function ViewSettings({ view, props, onPatchView, onCopyLink, onClose, startAt = 'root' }: {
  /** The database's properties in this view's order (`viewProps`). */
  view: ViewDef; props: PropDef[];
  onPatchView: (vp: Partial<ViewDef>) => void;
  /** "Copy link to view" — the same act as the tab menu's. */
  onCopyLink: (viewId: string) => void;
  onClose: () => void;
  /**
   * Open on one page as a panel of its own — the toolbar's Sort opens the Sort page,
   * as Notion's does — with no way "back" to a root it was never opened from.
   */
  startAt?: SettingsPage;
}) {
  const [page, setPageState] = useState<SettingsPage>(startAt);
  // A page reached from two places (Group by, from Layout or from Group) goes back
  // to the one it came from.
  const [back, setBack] = useState<SettingsPage>('root');
  const setPage = (next: SettingsPage) => { setBack(page); setPageState(next); };
  const hidden = view.hidden ?? [];
  const sorts = view.sorts ?? [];
  const colorRules = view.colorRules ?? [];
  const groupable = props.filter((p) => p.type === 'select' || p.type === 'status' || p.type === 'checkbox' || p.type === 'multi_select');
  // A board is always grouped by something (`boardGroupProp`); a table only when asked.
  const boardProp = view.kind === 'board' ? boardGroupProp(view, props) : undefined;
  const groupName = boardProp?.name ?? props.find((p) => p.id === view.groupBy)?.name;
  const dateProps = props.filter((p) => p.type === 'date');
  const calendarProp = props.find((p) => p.id === (view.dateProp ?? dateProps[0]?.id));
  const timeline = timelineProps(view, dateProps);

  // Notion's panel header: back · title · close.
  const header = (title: string, to: SettingsPage = back) => (
    <div className="flex items-center gap-1 px-0.5 pb-1.5 pt-0.5">
      {page !== startAt && <IconButton size="xs" label="Back" icon={<Icon icon={ArrowLeft} size={16} />} onClick={() => { setBack('root'); setPageState(to); }} />}
      <span className="flex-1 text-ui font-semibold text-ink-900">{title}</span>
      <IconButton size="xs" label="Close" icon={<Icon icon={X} size={16} />} onClick={onClose} />
    </div>
  );
  const navRow = (icon: IconType | null, label: string, value: React.ReactNode, onClick: () => void) => (
    <button onClick={onClick} className={cn('zb-press', POP_ROW)}>
      {icon && <Icon icon={icon} size={16} className="text-ink-600" />}
      <span style={{ flex: 1 }}>{label}</span>
      <span className="inline-flex items-center gap-1.5 text-ui text-ink-500">{value}<Icon icon={ChevronRight} size={16} /></span>
    </button>
  );
  // A setting that is on or off takes effect at once (§4.18) — a switch, never a check.
  const switchRow = (label: string, checked: boolean, onChange: (on: boolean) => void) => (
    <label className={cn(POP_ROW, 'justify-between')}>
      <span>{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    </label>
  );
  // What this layout, and only this layout, can be set to (T8, `layoutOptions`).
  const layoutRow = (o: ReturnType<typeof layoutOptions>[number]) => {
    const label = LAYOUT_OPTION_LABEL[o];
    switch (o) {
      case 'verticalLines': return switchRow(label, view.verticalLines !== false, (on) => onPatchView({ verticalLines: on }));
      case 'hideEmptyGroups': return view.kind === 'board' || view.groupBy ? switchRow(label, !!view.hideEmpty, (on) => onPatchView({ hideEmpty: on })) : null;
      case 'groupBy': return navRow(Layers, label, groupName ?? '', () => setPage('groupBy'));
      case 'colorColumns': return switchRow(label, view.colorColumns !== false, (on) => onPatchView({ colorColumns: on }));
      case 'cardSize': return navRow(Grid2x2, label, CARD_SIZE_LABEL[view.cardSize ?? 'medium'], () => setPage('cardSize'));
      case 'calendarBy': return navRow(Calendar, label, calendarProp?.name ?? 'None', () => setPage('calendarBy'));
      case 'showWeekends': return switchRow(label, view.showWeekends !== false, (on) => onPatchView({ showWeekends: on }));
      case 'timelineBy': return navRow(Calendar, label, props.find((p) => p.id === timeline.start)?.name ?? 'None', () => setPage('timelineBy'));
      case 'timelineEnd': return timeline.start ? navRow(null, label, props.find((p) => p.id === timeline.end)?.name ?? 'None', () => setPage('timelineEnd')) : null;
    }
  };
  // "Open pages in" belongs to the layout (Notion keeps it on the Layout page): a
  // board's rows are worked through, a gallery's items looked at one at a time, so
  // the right default changes with the layout — and follows it, until the view
  // picks one of its own.
  const openIn = openPagesIn(view);

  if (page === 'layout') return (
    <div>
      {header('Layout', 'root')}
      {VIEW_META.map((m) => (
        <button key={m.kind} onClick={() => onPatchView({ kind: m.kind })} className={cn('zb-press', POP_ROW)}>
          <Icon icon={m.icon} size={16} className="text-ink-600" />
          <span style={{ flex: 1 }}>{m.label}</span>
          {view.kind === m.kind && <Icon icon={Check} size={16} className="text-ink-600" />}
        </button>
      ))}
      <div aria-hidden className={POP_SEPARATOR} />
      {layoutOptions(view.kind).map((o) => <Fragment key={o}>{layoutRow(o)}</Fragment>)}
      {navRow(PAGE_VIEW_MODE_ICON[openIn], 'Open pages in', MODE_LABEL[openIn], () => setPage('open'))}
    </div>
  );

  if (page === 'groupBy') return (
    <div>
      {header('Group by')}
      {props.filter(isBoardGroupable).map((p) => (
        <button key={p.id} onClick={() => onPatchView({ groupBy: p.id, ...(view.subGroupBy === p.id ? { subGroupBy: undefined } : {}) })} className={cn('zb-press', POP_ROW)}>
          <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
          <span style={{ flex: 1 }}>{p.name}</span>
          {groupName === p.name && (boardProp ? boardProp.id === p.id : view.groupBy === p.id) && <Icon icon={Check} size={16} className="text-ink-600" />}
        </button>
      ))}
    </div>
  );

  if (page === 'cardSize') return (
    <div>
      {header('Card size')}
      {CARD_SIZES.map((size) => (
        <button key={size} onClick={() => onPatchView({ cardSize: size })} className={cn('zb-press', POP_ROW)}>
          <span style={{ flex: 1 }}>{CARD_SIZE_LABEL[size]}</span>
          {(view.cardSize ?? 'medium') === size && <Icon icon={Check} size={16} className="text-ink-600" />}
        </button>
      ))}
    </div>
  );

  // A timeline reads a start date, and optionally an end date for bars longer than a day.
  if (page === 'timelineBy' || page === 'timelineEnd') {
    const choices = page === 'timelineBy' ? dateProps : dateProps.filter((p) => p.id !== timeline.start);
    const current = page === 'timelineBy' ? timeline.start : timeline.end;
    return (
      <div>
        {header(page === 'timelineBy' ? 'Show timeline by' : 'End date', 'layout')}
        {page === 'timelineEnd' && (
          <button onClick={() => onPatchView({ endDateProp: undefined })} className={cn('zb-press', POP_ROW)}>
            <span style={{ flex: 1 }}>None — one-day bars</span>
            {!current && <Icon icon={Check} size={16} className="text-ink-600" />}
          </button>
        )}
        {choices.map((p) => (
          <button key={p.id} onClick={() => onPatchView(page === 'timelineBy' ? { dateProp: p.id } : { endDateProp: p.id })} className={cn('zb-press', POP_ROW)}>
            <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
            <span style={{ flex: 1 }}>{p.name}</span>
            {current === p.id && <Icon icon={Check} size={16} className="text-ink-600" />}
          </button>
        ))}
        {choices.length === 0 && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No other date properties</div>}
      </div>
    );
  }

  if (page === 'calendarBy') return (
    <div>
      {header('Show calendar by')}
      {dateProps.map((p) => (
        <button key={p.id} onClick={() => onPatchView({ dateProp: p.id })} className={cn('zb-press', POP_ROW)}>
          <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
          <span style={{ flex: 1 }}>{p.name}</span>
          {calendarProp?.id === p.id && <Icon icon={Check} size={16} className="text-ink-600" />}
        </button>
      ))}
      {dateProps.length === 0 && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No date properties</div>}
    </div>
  );

  // A board's Group page — Notion's: what it is grouped by, the two ways a column can
  // look, then every column, to move, hide or bring back.
  if (page === 'group' && boardProp) return (
    <div>
      {header('Group', 'root')}
      {navRow(null, 'Group by', boardProp.name, () => setPage('groupBy'))}
      {switchRow(LAYOUT_OPTION_LABEL.hideEmptyGroups, !!view.hideEmpty, (on) => onPatchView({ hideEmpty: on }))}
      {switchRow(LAYOUT_OPTION_LABEL.colorColumns, view.colorColumns !== false, (on) => onPatchView({ colorColumns: on }))}
      <div aria-hidden className={POP_SEPARATOR} />
      <BoardGroupsList
        groups={boardGroupList(boardProp, view)}
        hidden={view.hiddenGroups ?? []}
        status={boardProp.type === 'status'}
        onReorder={(keys) => onPatchView({ groupOrder: keys })}
        onHidden={(keys) => onPatchView({ hiddenGroups: keys })}
      />
    </div>
  );

  if (page === 'open') return (
    <div>
      {header('Open pages in', 'layout')}
      {OPEN_MODES.map((m) => (
        <button key={m} onClick={() => onPatchView({ openIn: m })} aria-pressed={openIn === m}
          className={cn('zb-press group/item', POP_ROW, 'h-auto items-start py-1.5')}>
          <Icon icon={PAGE_VIEW_MODE_ICON[m]} size={16} className="mt-0.5 text-ink-600" />
          <span style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', gap: 1 }}>
            <span>{MODE_LABEL[m]}</span>
            {/* A washed row is a new ground: its second line steps forward a rung. */}
            <span className="text-ink-500 group-hover/item:text-ink-700" style={{ fontSize: 'var(--text-caption-size)', lineHeight: 1.35 }}>{PAGE_VIEW_MODE_HINT[m]}</span>
          </span>
          {openIn === m && <Icon icon={Check} size={16} className="mt-0.5 text-ink-600" />}
        </button>
      ))}
    </div>
  );

  // Notion's Properties page: what the view shows, then what it hides, each in the
  // view's order and each re-ordered by its handle (the one re-orderable list). The
  // name is always shown — a page with no name has nothing to click in a table.
  if (page === 'props') {
    const shownProps = props.filter((p) => !hidden.includes(p.id));
    const hiddenProps = props.filter((p) => hidden.includes(p.id));
    const layout = VIEW_LABEL[view.kind].toLowerCase();
    const propRow = (p: PropDef, handle: React.ReactNode) => {
      const off = hidden.includes(p.id);
      return (
        <>
          {handle}
          <Icon icon={propIcon(p.type)} size={16} className="shrink-0 text-ink-600" />
          <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{p.name}</span>
          {p.type === 'title' ? (
            <span aria-hidden className="size-6 shrink-0" />
          ) : (
            <IconButton size="xs" label={off ? `Show ${p.name}` : `Hide ${p.name}`} className={off ? 'text-ink-500' : 'text-ink-800'}
              icon={<Icon icon={off ? EyeOff : Eye} size={16} />}
              onClick={() => onPatchView({ hidden: off ? hidden.filter((h) => h !== p.id) : [...hidden, p.id] })} />
          )}
        </>
      );
    };
    const section = (label: string, action: React.ReactNode) => (
      <div className="flex h-8 items-center justify-between px-2">
        <span className="text-overline text-ink-500">{label}</span>
        {action}
      </div>
    );
    const hideable = shownProps.filter((p) => p.type !== 'title');
    return (
      <div>
        {header('Properties', 'root')}
        {section(`Shown in ${layout}`, hideable.length > 0 && (
          <Button variant="ghost" size="xs" onClick={() => onPatchView({ hidden: [...hidden, ...hideable.map((p) => p.id)] })}>Hide all</Button>
        ))}
        <SortableList items={shownProps} noun="property" rowClassName="flex h-8 items-center gap-1.5 rounded-sm px-1"
          onReorder={(ids) => onPatchView({ propOrder: [...ids, ...hiddenProps.map((p) => p.id)] })}
          renderRow={propRow} />
        {hiddenProps.length > 0 && (
          <>
            {section(`Hidden in ${layout}`, <Button variant="ghost" size="xs" onClick={() => onPatchView({ hidden: [] })}>Show all</Button>)}
            <SortableList items={hiddenProps} noun="property" rowClassName="flex h-8 items-center gap-1.5 rounded-sm px-1"
              onReorder={(ids) => onPatchView({ propOrder: [...shownProps.map((p) => p.id), ...ids] })}
              renderRow={propRow} />
          </>
        )}
      </div>
    );
  }

  if (page === 'sort') {
    const setSort = (i: number, patch: Partial<{ prop: string; dir: 'asc' | 'desc' }>) => onPatchView({ sorts: sorts.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
    const removeSort = (i: number) => onPatchView({ sorts: sorts.filter((_, k) => k !== i) });
    const unsorted = props.filter((p) => !sorts.some((s) => s.prop === p.id));
    return (
      <div>
        {header('Sort', 'root')}
        {/* Notion's sort list: each level by its handle, its property and its direction
            as the panel's own menus. A property sorts once, so each menu offers the
            properties no other level uses. */}
        <SortableList
          items={sorts.map((s) => ({ ...s, id: s.prop, name: props.find((p) => p.id === s.prop)?.name ?? 'Property' }))}
          noun="sort"
          rowClassName="flex items-center gap-1 py-0.5"
          onReorder={(ids) => onPatchView({ sorts: ids.map((id) => sorts.find((s) => s.prop === id)!) })}
          renderRow={(s, handle) => {
            const i = sorts.findIndex((x) => x.prop === s.prop);
            return (
              <>
                {handle}
                <MenuSelect aria-label="Sort property" className="flex-1" value={s.prop}
                  options={props.filter((p) => p.id === s.prop || !sorts.some((x) => x.prop === p.id)).map((p) => ({ value: p.id, label: p.name, icon: <Icon icon={propIcon(p.type)} size={16} /> }))}
                  onValueChange={(prop) => setSort(i, { prop })} />
                <MenuSelect aria-label="Sort direction" className="w-[116px] shrink-0" value={s.dir}
                  options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
                  onValueChange={(dir) => setSort(i, { dir: dir as 'asc' | 'desc' })} />
                <IconButton size="xs" label="Remove sort" icon={<Icon icon={X} size={16} />} onClick={() => removeSort(i)} />
              </>
            );
          }}
        />
        {unsorted.length > 0 && (
          <button onClick={() => onPatchView({ sorts: [...sorts, { prop: unsorted[0].id, dir: 'asc' }] })} className={cn('zb-press', POP_ROW, 'text-ink-600')}>
            <Icon icon={Plus} size={16} /> Add sort
          </button>
        )}
        {sorts.length === 0 && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No sorts yet</div>}
      </div>
    );
  }

  if (page === 'group') return (
    <div>
      {header('Group by', 'root')}
      <button onClick={() => onPatchView({ groupBy: undefined, subGroupBy: undefined })} className={cn('zb-press', POP_ROW)}>
        <span style={{ flex: 1 }}>None</span>
        {!view.groupBy && <Icon icon={Check} size={16} className="text-ink-600" />}
      </button>
      {groupable.map((p) => (
        <button key={p.id} onClick={() => onPatchView({ groupBy: p.id, ...(view.subGroupBy === p.id ? { subGroupBy: undefined } : {}) })} className={cn('zb-press', POP_ROW)}>
          <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
          <span style={{ flex: 1 }}>{p.name}</span>
          {view.groupBy === p.id && <Icon icon={Check} size={16} className="text-ink-600" />}
        </button>
      ))}
      {groupable.length === 0 && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No select/status/checkbox properties</div>}
      {view.groupBy && switchRow(LAYOUT_OPTION_LABEL.hideEmptyGroups, !!view.hideEmpty, (on) => onPatchView({ hideEmpty: on }))}
      {view.groupBy && groupable.some((p) => p.id !== view.groupBy) && (
        <>
          <div aria-hidden className={POP_SEPARATOR} />
          <div className={POP_LABEL}>Then group by</div>
          <button onClick={() => onPatchView({ subGroupBy: undefined })} className={cn('zb-press', POP_ROW)}>
            <span style={{ flex: 1 }}>None</span>
            {!view.subGroupBy && <Icon icon={Check} size={16} className="text-ink-600" />}
          </button>
          {groupable.filter((p) => p.id !== view.groupBy).map((p) => (
            <button key={p.id} onClick={() => onPatchView({ subGroupBy: p.id })} className={cn('zb-press', POP_ROW)}>
              <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
              <span style={{ flex: 1 }}>{p.name}</span>
              {view.subGroupBy === p.id && <Icon icon={Check} size={16} className="text-ink-600" />}
            </button>
          ))}
        </>
      )}
    </div>
  );

  if (page === 'color') {
    const setRules = (next: ColorRule[]) => onPatchView({ colorRules: next.length ? next : undefined });
    return (
      <div>
        {header('Conditional color', 'root')}
        {colorRules.map((r, i) => (
          <ColorRuleEditor key={i} rule={r} props={props}
            onChange={(patch) => setRules(colorRules.map((x, k) => (k === i ? { ...x, ...patch } : x)))}
            onRemove={() => setRules(colorRules.filter((_, k) => k !== i))} />
        ))}
        <button onClick={() => setRules([...colorRules, { prop: props[0].id, op: defaultOp(props[0].type), color: OPTION_COLORS[colorRules.length % OPTION_COLORS.length] }])} className={cn('zb-press', POP_ROW, 'text-ink-600')}>
          <Icon icon={Plus} size={16} /> Add rule
        </button>
        {colorRules.length === 0 && <div className={cn(POP_ROW, 'cursor-default leading-snug text-ink-500')}>Rows paint with the color of the first rule they match.</div>}
      </div>
    );
  }

  // root
  return (
    <div>
      <MenuField aria-label="View name" placeholder="View name" value={view.name} onChange={(e) => onPatchView({ name: e.target.value })} className="mb-1" />
      {navRow(viewIcon(view.kind), 'Layout', VIEW_LABEL[view.kind], () => setPage('layout'))}
      {navRow(SlidersHorizontal, 'Properties', hidden.length ? `${hidden.length} hidden` : 'All shown', () => setPage('props'))}
      {navRow(ArrowDownUp, 'Sort', sorts.length ? String(sorts.length) : '', () => setPage('sort'))}
      {navRow(Layers, 'Group', groupName ?? '', () => setPage('group'))}
      {navRow(Paintbrush, 'Conditional color', colorRules.length ? String(colorRules.length) : '', () => setPage('color'))}
      <div aria-hidden className={POP_SEPARATOR} />
      <button onClick={() => onCopyLink(view.id)} className={cn('zb-press', POP_ROW)}><Icon icon={LinkIcon} size={16} className="text-ink-600" /> Copy link to view</button>
    </div>
  );
}

// ── The database surface ──
// A database that has nothing to show yet, or cannot show anything, says so in
// ONE quiet line in the document's flow — the DS `EmptyLine` geometry — never a
// padded billboard, and never a server's words (lib/database-failure.ts).
function DbLine({ children }: { children: React.ReactNode }) {
  return <p role="status" className="py-2 text-ui text-ink-500">{children}</p>;
}

/**
 * A database on its way — the shape of what is coming (a name, a view bar, rows),
 * not a sentence (plan T11; DS §4.45: a skeleton IS the layout with content removed).
 * The words stay for a screen reader.
 */
function DbSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2 py-2">
      <span className="sr-only">Loading database…</span>
      <Skeleton shape="line" className="h-4 w-40" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-28" /><span className="flex-1" /><Skeleton className="h-7 w-16" />
      </div>
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

function DbFailureLine({ failure, onRetry }: { failure: DbFailure; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-ui text-ink-500">
      <Icon icon={CircleAlert} size={16} className="shrink-0" />
      <span className="text-ink-800">{failure.title}.</span>
      {failure.detail && <span>{failure.detail}</span>}
      {failure.retry && onRetry && <Button variant="ghost" size="xs" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// Full-page database — a page of type 'database' hosts exactly one collection.
// One made on this device renders from its store at once (`newDatabase`); any
// other is fetched by page (auto-created on first open by getDatabase). Rendering
// goes through the shared store (lib/db-store), so this page and any inline or
// linked views of the same collection read and write the same live state.
export function DatabasePage({ pageId, demoDb }: { pageId: string; demoDb?: { collection: Collection; rows: DbRow[] } }) {
  const demoStore = useMemo(() => (demoDb ? seedStore(demoDb.collection, demoDb.rows, { demo: true }) : null), [demoDb]);
  const held = usePageStore(demoStore ? null : pageId);
  const store = demoStore ?? held;
  const plan = loadPlan(pageId, store);
  // A failure is kept WITH the id it was about, so it cannot outlive it: the uuid
  // error a new page printed under `tmp-…` stayed on screen after the real id came.
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (plan !== 'fetch') return;
    let live = true;
    getDatabase(pageId)
      .then((res) => {
        if (!live) return;
        if ('error' in res) setError({ id: pageId, message: res.error });
        else receiveDatabase(res.collection, res.rows, pageId);
      })
      .catch((e: unknown) => { if (live) setError({ id: pageId, message: e instanceof Error ? e.message : '' }); });
    return () => { live = false; };
  }, [pageId, plan, attempt]);

  if (store) return <DatabaseSurface key={store.getState().col.id} store={store} />;
  if (error?.id === pageId) {
    return <DbFailureLine failure={describeDbFailure(error.message, 'load')} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />;
  }
  return <DbSkeleton />;
}

// Demo collection for the inline block in dev-preview (colId 'demo…').
function demoInlineDb(): { collection: Collection; rows: DbRow[] } {
  const def = defaultCollection();
  const status = def.props[1].id;
  const tags = def.props[2].id;
  // Populate Tags so grouping has a second dimension (sub-group by Tags).
  def.props[2].options = [
    { id: 'tag_design', name: 'Design', color: 'purple' },
    { id: 'tag_eng', name: 'Eng', color: 'blue' },
  ];
  const now = new Date().toISOString();
  const row = (title: string, s: string, t: string[], i: number): DbRow => ({ id: 'demo-r' + i, title, data: { [status]: s, [tags]: t }, order: 'a' + i, created_at: now, updated_at: now });
  // A formula property so dev-preview exercises the engine's computed path.
  const props: PropDef[] = [...def.props, {
    id: 'fx', name: 'Label', type: 'formula',
    formula: { expr: 'if(prop("Status") == "in_progress", "Active", if(prop("Status") == "done", "Shipped", "Queued"))' },
  }];
  // A Board beside the Table: the two layouts that run wider than a text column.
  const views: ViewDef[] = [...def.views, { id: 'demo-board', name: 'Board', kind: 'board', groupBy: status }];
  return {
    collection: { id: 'demo', page_id: null, name: 'Projects tracker', props, views },
    rows: [
      row('Design homepage', 'in_progress', ['tag_design'], 1),
      row('Fix billing bug', 'in_progress', ['tag_eng'], 2),
      row('Write launch post', 'not_started', ['tag_design'], 3),
      row('Ship onboarding', 'done', ['tag_eng'], 4),
    ],
  };
}

// Inline database block (Notion "Database — Inline"): a standalone collection
// mounted inside a document. colId is the collection's id from the first frame
// (`newDatabase` mints it), 'picker' while "Linked view" waits for a source,
// 'demo…' in dev-preview, or 'error:<msg>' if creation failed. 'pending' only
// survives in a document saved by the old flow before its database existed.
export function InlineCollection({ colId, onExpand, onPick, onRetry }: {
  colId?: string;
  onExpand?: () => void;          // host: open this database as a full page
  onPick?: (colId: string) => void; // linked view: bind the block to a source
  onRetry?: () => void;           // host: make the database again, after it failed to save
}) {
  const demo = !!colId?.startsWith('demo');
  const demoStore = useMemo(() => {
    if (!demo) return null;
    const d = demoInlineDb();
    return seedStore(d.collection, d.rows, { demo: true });
  }, [demo]);
  const placeholder = !colId || colId === 'pending' || colId === 'picker' || colId.startsWith('error:');
  const held = useCollectionStore(demo || placeholder ? null : colId);
  const store = demoStore ?? held;
  const plan = placeholder ? 'wait' : loadPlan(colId, store);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (plan !== 'fetch' || !colId) return;
    let live = true;
    getCollection(colId)
      .then((res) => {
        if (!live) return;
        if ('error' in res) setError({ id: colId, message: res.error });
        else receiveDatabase(res.collection, res.rows);
      })
      .catch((e: unknown) => { if (live) setError({ id: colId, message: e instanceof Error ? e.message : '' }); });
    return () => { live = false; };
  }, [colId, plan, attempt]);

  if (colId === 'picker') return <LinkedDbPicker onPick={(id) => onPick?.(id)} />;
  if (colId?.startsWith('error:')) return <DbFailureLine failure={describeDbFailure(colId.slice(6), 'create')} onRetry={onRetry} />;
  if (!colId || colId === 'pending') return <DbFailureLine failure={{ title: 'This database was never created', retry: true }} onRetry={onRetry} />;
  if (!store) {
    return error?.id === colId
      ? <DbFailureLine failure={describeDbFailure(error.message, 'load')} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />
      : <DbSkeleton />;
  }
  return (
    <div style={{ margin: '2px 0' }}>
      <DatabaseSurface key={store.getState().col.id} store={store} onExpand={onExpand} inline />
    </div>
  );
}

// "Linked view of database" source picker — replaces the block until a
// database is chosen; then the block binds to it and stays in sync.
function LinkedDbPicker({ onPick }: { onPick: (colId: string) => void }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ collections: { id: string; name: string; page_id: string | null }[] } | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    listCollections()
      .then((res) => setState('error' in res ? { error: res.error } : res))
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : '' }));
  }, [attempt]);
  const rows = state && 'collections' in state
    ? state.collections.filter((c) => !q.trim() || (c.name || 'Untitled').toLowerCase().includes(q.trim().toLowerCase()))
    : [];
  return (
    // Open until a database is chosen, so it wears the menus' chrome (OVERLAY_CLASS).
    <div className={cn(OVERLAY_CLASS, 'my-0.5 max-w-[380px] p-1')}>
      <div className={POP_LABEL}>Link a database</div>
      <MenuField autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search databases…" aria-label="Search databases"
        icon={<Icon icon={Search} size={16} />} className="mb-1" />
      {!state && <DbLine>Loading databases…</DbLine>}
      {state && 'error' in state && <DbFailureLine failure={describeDbFailure(state.error, 'list')} onRetry={() => { setState(null); setAttempt((n) => n + 1); }} />}
      {state && 'collections' in state && rows.length === 0 && <DbLine>{q.trim() ? 'No databases match.' : 'No databases yet — create one with /database.'}</DbLine>}
      {rows.map((c) => (
        <button key={c.id} onClick={() => onPick(c.id)} className={cn('zb-press', POP_ROW)}>
          <Icon icon={Database} size={16} className="shrink-0 text-ink-600" />
          <span className="min-w-0 flex-1 truncate">{c.name || 'Untitled'}</span>
          <span className="text-meta text-ink-500">{c.page_id ? 'Full page' : 'Inline'}</span>
        </button>
      ))}
    </div>
  );
}

// Editable inline-database name — quiet input above the surface, like Notion's
// inline database title. Commits through the store so every view of this
// collection (and its autosave/undo) sees the rename.
function InlineDbName({ store }: { store: DbStore }) {
  const { col } = useDbState(store);
  const [name, setName] = useState(col.name || '');
  return (
    <input value={name} placeholder="Untitled"
      onChange={(e) => setName(e.target.value)}
      onBlur={() => { if (name.trim() && name.trim() !== col.name) store.patchCol({ name: name.trim() }); }}
      autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Database name" data-chromeless
      // An inline database is part of the doc, not a competing page heading —
      // so its name reads at a quieter weight and secondary ink (Notion's
      // treatment), and sits tight above its own toolbar.
      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-display)', fontSize: 'var(--text-body-lg-size)', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text-secondary)', marginBottom: 2 }} />
  );
}

// The shared database surface — view bar (views · search · properties · New),
// Table / Board / Gallery / List views, and the row peek. Used by the
// full-page database, inline blocks, and linked views: all of them subscribe
// to ONE store per collection, so an edit anywhere lands everywhere at once.
function DatabaseSurface({ store, onExpand, inline }: {
  store: DbStore; onExpand?: () => void;
  /** A block inside a document — which owns the page's one primary action. */
  inline?: boolean;
}) {
  const { col, rows } = useDbState(store);
  // Which view shows: the one picked here, else the one a link names (`#view-<id>`,
  // "Copy link to view"), else the first. A pick belongs to the address it was made
  // at, so following a new link to a view of this database shows that view.
  const hash = useLocationHash();
  const linkedViewId = viewFromHash(hash, col.views);
  const [pick, setPick] = useState<{ id: string; hash: string } | null>(null);
  const viewId = (pick && pick.hash === hash ? pick.id : null) ?? linkedViewId ?? col.views[0]?.id ?? null;
  const setViewId = (id: string) => setPick({ id, hash });
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Arriving by a link to one of this database's views brings the database into sight.
  useEffect(() => {
    if (linkedViewId) surfaceRef.current?.scrollIntoView({ block: 'start' });
  }, [linkedViewId]);
  const [headMenu, setHeadMenu] = useState<string | null>(null); // prop id
  const [typeMenu, setTypeMenu] = useState(false); // header menu showing the retype list
  const [rename, setRename] = useState('');
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false); // property picker
  const [chipEdit, setChipEdit] = useState<number | null>(null); // editing rule index
  const [groupEdit, setGroupEdit] = useState<number | null>(null); // editing sub-group index
  const [settingsOpen, setSettingsOpen] = useState(false); // view settings panel
  const [peekId, setPeekId] = useState<string | null>(null);
  // A row New has just made: its page opens with the name ready to type (`freshId`),
  // or — from the table's foot — its Name cell takes the caret (`focusRowKey`).
  const [freshId, setFreshId] = useState<string | null>(null);
  const [focusRowKey, setFocusRowKey] = useState<string | null>(null);
  const [confirm, confirmUI] = useConfirm();

  const view = col.views.find((v) => v.id === viewId) ?? col.views[0];
  const hidden = view?.hidden ?? [];
  // The database's properties in this view's own order (T12): what a table's columns,
  // a card's lines and the Properties page all follow.
  const ordered = viewProps(view, col.props);
  const shown = ordered.filter((p) => !hidden.includes(p.id));
  // The engine pipeline: shared rows in → this view's filter + sorts out.
  const sorted = applyView(rows, view, col.props, resolveCollection);
  // Search: client-side filter across the title, plain values, and option names.
  const needle = q.trim().toLowerCase();
  const visible = needle
    ? sorted.filter((r) => col.props.map((p) => {
        if (isSelectish(p.type)) {
          const v = r.data[p.id];
          const ids = Array.isArray(v) ? v as string[] : v ? [v as string] : [];
          return ids.map((x) => p.options?.find((o) => o.id === x)?.name ?? '').join(' ');
        }
        return rowText(r, p);
      }).join(' ').toLowerCase().includes(needle))
    : sorted;
  // Through `currentId`: a page opened on a new row holds its placeholder, and must
  // still find the row once the server's id has replaced it.
  const peek = peekId ? rows.find((r) => r.id === store.currentId(peekId)) ?? null : null;

  // ── ops — every mutation routes through the engine store (optimistic,
  //    autosaved, undoable, and instantly visible to every other view) ──
  const patchCol = (patch: Partial<Pick<Collection, 'props' | 'views' | 'name'>>) => store.patchCol(patch);
  const patchView = (vp: Partial<ViewDef>) => {
    if (!view) return;
    patchCol({ views: col.views.map((v) => (v.id === view.id ? { ...v, ...vp } : v)) });
  };
  const patchRow = (id: string, patch: { title?: string; data?: Record<string, unknown>; order?: string }) => store.patchRow(id, patch);
  // Every new row starts the same way wherever it is made (`newRowValues`): in its
  // status's first option and inside this view's filter, with a column's or a day's
  // own value on top.
  const addRow = (preset: Record<string, unknown> = {}) => store.addRow({ data: newRowValues(col.props, view, preset) });
  // A row's page opens the way this view opens pages (T6) — or, when this database
  // is itself on a page open in a peek, one level deeper in THAT peek, so pages
  // nest in one panel instead of stacking a panel per level.
  const peekApi = usePeek();
  const openRow = (id: string, fresh = false) => {
    if (peekApi) { peekApi.open({ kind: 'row', colId: col.id, rowId: id, fresh }); return; }
    setPeekId(id);
    setFreshId(fresh ? id : null);
  };
  // New, then open it, its name ready to type.
  const addAndOpen = (preset: Record<string, unknown> = {}) => openRow(addRow(preset), true);
  const removeRow = (id: string) => deleteRowWithUndo(store, id);
  // Deleting a property empties a whole column, in every row at once — the one
  // act in this view big enough to ask about. The confirm counts the rows that
  // actually hold a value, because "3 of 40 rows" and "40 of 40" are very
  // different decisions.
  const removeProp = async (p: PropDef) => {
    const filled = rows.filter((r) => {
      const v = r.data?.[p.id];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }).length;
    const ok = await confirm({
      title: `Delete “${p.name}”?`,
      body: filled === 0
        ? 'No row has a value for it yet.'
        : `${filled} of ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} have a value, and it disappears from all of them.`,
      actionLabel: 'Delete property',
    });
    if (!ok) return;
    patchCol({ props: col.props.filter((x) => x.id !== p.id) });
  };
  const addProp = (type: PropType) => {
    const p: PropDef = { id: genId(), name: propLabel(type), type, ...(isSelectish(type) ? { options: [] } : {}) };
    patchCol({ props: [...col.props, p] });
  };
  const createOption = (propId: string, name: string): PropOption => store.createOption(propId, name);
  const addView = (kind: ViewDef['kind']) => {
    const v: ViewDef = { id: genId(), name: VIEW_META.find((m) => m.kind === kind)?.label ?? 'View', kind };
    patchCol({ views: [...col.views, v] });
    setViewId(v.id);
  };
  const copyViewLink = (id: string) => copyText(viewLink(window.location.href, id));
  // A view's menu (database-views-bar.tsx). Everything it changes is `col.views`, so
  // every edit is one undo step, and a deleted view says how to bring it back.
  const titleShown = view?.showTitle !== false;
  const viewActions: ViewActions = {
    onRename: (id, name) => patchCol({ views: col.views.map((v) => (v.id === id ? { ...v, name } : v)) }),
    onEdit: (id) => { setViewId(id); setSettingsOpen(true); },
    onCopyLink: copyViewLink,
    onDuplicate: (id) => {
      const out = duplicateView(col.views, id);
      if (!out) return;
      patchCol({ views: out.views });
      setViewId(out.copy.id);
    },
    onDelete: (id) => {
      const out = removeView(col.views, id);
      if (!out) return;
      const entry = store.patchCol({ views: out.views });
      if (id === view?.id) setViewId(out.nextId);
      toast({ message: 'View deleted.', action: { label: 'Undo', onAction: () => store.undoEntry(entry) } });
    },
    // Inside a document only: a database page IS the full page, and its title is the page's.
    ...(onExpand ? {
      onOpenFull: (id: string) => {
        // The page it opens reads the view from the address, as a copied link would.
        window.history.replaceState(window.history.state, '', viewLink(window.location.href, id));
        onExpand();
      },
    } : {}),
    ...(inline ? {
      titleShown,
      // Every view of the database at once: a name that came and went as you switched
      // tabs would read as a glitch, not a setting.
      onToggleTitle: () => patchCol({
        views: col.views.map((v) => {
          const next = { ...v };
          if (titleShown) next.showTitle = false; else delete next.showTitle;
          return next;
        }),
      }),
    } : {}),
  };

  // ── Filters (§9.4): one chip per FilterRule, joined by the group's AND/OR ──
  //
  // The ENGINE has always evaluated nested groups and `or` (db-engine
  // `matchesFilter` recurses); only this UI was flat-and-AND-only, and it
  // DESTROYED any nested group on the next edit by rewriting `rules` from the
  // flat list alone. Sub-groups are now carried through untouched, and the
  // group's logic is the user's to set.
  const savedFilter = view?.filter;
  const logic: FilterGroup['logic'] = savedFilter?.logic ?? 'and';
  const subGroups: FilterGroup[] = (savedFilter?.rules ?? []).filter(isFilterGroup);
  const rules: FilterRule[] = ((savedFilter?.rules ?? []).filter((r) => !isFilterGroup(r)) as FilterRule[]);
  const writeFilter = (next: FilterRule[], nextLogic: FilterGroup['logic'] = logic) =>
    patchView({ filter: next.length || subGroups.length ? { logic: nextLogic, rules: [...next, ...subGroups] } : undefined });
  const setRules = (next: FilterRule[]) => writeFilter(next);
  // Notion's model: the join is a property of the GROUP, so flipping one join
  // flips them all — "A and B or C" has no unambiguous reading otherwise.
  const setLogic = (l: FilterGroup['logic']) => writeFilter(rules, l);
  const addRule = (propId: string) => {
    const p = col.props.find((x) => x.id === propId); if (!p) return;
    setRules([...rules, { prop: propId, op: defaultOp(p.type), ...(p.type === 'checkbox' ? { value: true } : {}) }]);
    setFilterOpen(false); setChipEdit(rules.length);
  };
  const editRule = (i: number, patch: Partial<FilterRule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) => { setRules(rules.filter((_, k) => k !== i)); setChipEdit(null); };

  // ── Sub-groups: one level of nesting, which is what "(A or B) and C" needs.
  // The engine recurses arbitrarily deep, but a builder that offers infinite
  // nesting produces filters nobody can read back — Notion stops here too.
  const writeGroups = (next: FilterGroup[]) =>
    patchView({ filter: rules.length || next.length ? { logic, rules: [...rules, ...next] } : undefined });
  const addGroup = (propId: string) => {
    const p = col.props.find((x) => x.id === propId); if (!p) return;
    // A new group opens on `or` — an inner AND would just be more outer rules.
    writeGroups([...subGroups, { logic: 'or', rules: [{ prop: propId, op: defaultOp(p.type), ...(p.type === 'checkbox' ? { value: true } : {}) }] }]);
    setFilterOpen(false); setGroupEdit(subGroups.length);
  };
  const patchGroup = (gi: number, next: FilterGroup | null) => {
    const kept = next ? subGroups.map((g, k) => (k === gi ? next : g)) : subGroups.filter((_, k) => k !== gi);
    writeGroups(kept);
    if (!next) setGroupEdit(null);
  };
  // Column-header sort (§9.2): add to the view's sort list, or update this
  // property's direction if it's already a sort level (keeps multi-sort intact).
  const sortBy = (propId: string, dir: 'asc' | 'desc') => {
    const cur = view?.sorts ?? [];
    patchView({ sorts: cur.some((s) => s.prop === propId) ? cur.map((s) => (s.prop === propId ? { ...s, dir } : s)) : [...cur, { prop: propId, dir }] });
  };

  const widths = view?.widths ?? {};
  // "Show vertical lines" (T8): the hairline between a table's columns, on unless the view says not.
  const verticalLine = view?.verticalLines === false ? 'none' : '1px solid var(--line-2)';
  const colWidth = (p: PropDef) => widths[p.id] ?? (p.type === 'title' ? 260 : 170);
  const groupProp = view?.kind === 'board' ? boardGroupProp(view, col.props) : undefined;

  // ── Table grouping (§9.3): when a group property is set, the flat table
  //    renders as collapsible sections. Collapse state is per-view (view.collapsed);
  //    each section's "+ New" presets the group value so a fresh row lands in place.
  const tableGroupProp = view?.kind === 'table' && view.groupBy ? col.props.find((p) => p.id === view.groupBy) : undefined;
  const tableGroups: RowGroup[] | null = tableGroupProp ? groupRows(visible, view, col.props, view.groupBy) : null;
  // Conditional color (§9.3): the row's background from the first matching rule.
  const colorBg = (r: DbRow): string | undefined => {
    const c = rowColor(r, view?.colorRules, col.props, resolveCollection);
    return c ? optionTokens(c).bg : undefined;
  };
  const tableSubProp = tableGroupProp && view?.subGroupBy && view.subGroupBy !== view.groupBy ? col.props.find((p) => p.id === view.subGroupBy) : undefined;
  const collapsed = view?.collapsed ?? [];
  const isCollapsed = (key: string) => collapsed.includes(key);
  const toggleCollapsed = (key: string) => patchView({ collapsed: isCollapsed(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key] });
  // The data patch that lands a new row inside a group keyed by `key`
  // ('__none__' → no preset for that property).
  const presetForProp = (prop: PropDef | undefined, key: string): Record<string, unknown> => {
    if (!prop) return {};
    // "No Status" is a value too: a row made there must stay there, not take the
    // status default every other new row starts with.
    if (key === '__none__') return { [prop.id]: undefined };
    if (prop.type === 'checkbox') return { [prop.id]: key === 'true' };
    return { [prop.id]: prop.type === 'multi_select' ? [key] : key };
  };
  const groupPreset = (key: string) => presetForProp(tableGroupProp, key);
  const subGroupPreset = (key: string, subKey: string) => ({ ...presetForProp(tableGroupProp, key), ...presetForProp(tableSubProp, subKey) });

  // ── Moving rows and columns by hand (T12) ──
  // A table's rows run in sections: the whole table, or each group — each sub-group,
  // when there are two levels — keyed as the group's collapse key is.
  const ALL = '__all__';
  const sectionRows = (section: string): DbRow[] => {
    if (!tableGroups) return visible;
    const [g, sub] = section.split('::');
    const group = tableGroups.find((x) => x.key === g);
    return (sub === undefined ? group?.rows : group?.subgroups?.find((x) => x.key === sub)?.rows) ?? [];
  };
  // A row's values once it is dropped into another group (and sub-group).
  const valuesIn = (row: DbRow, from: string, to: string): Record<string, unknown> | undefined => {
    if (!tableGroupProp || from === to) return undefined;
    const [fg, fsub] = from.split('::');
    const [tg, tsub] = to.split('::');
    let data = row.data;
    if (fg !== tg) data = moveToGroup({ ...row, data }, tableGroupProp, fg, tg);
    if (tableSubProp && fsub !== undefined && tsub !== undefined && fsub !== tsub) data = moveToGroup({ ...row, data }, tableSubProp, fsub, tsub);
    return data;
  };
  const sortNames = (view?.sorts ?? []).map((s) => col.props.find((p) => p.id === s.prop)?.name).filter(Boolean).join(', then ');
  /** Put a row at `to.index` among the other rows of `to.section` — one undo step. */
  const moveRow = async (rowId: string, from: { section: string; index: number }, to: { section: string; index: number }) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const others = sectionRows(to.section).filter((r) => r.id !== rowId);
    const data = valuesIn(row, from.section, to.section);
    if (!view?.sorts?.length) {
      const keys = reorderKeys(others, rowId, to.index);
      store.transact(() => {
        patchRow(rowId, { ...(data ? { data } : {}), ...(keys.has(rowId) ? { order: keys.get(rowId) } : {}) });
        for (const [id, order] of keys) if (id !== rowId) patchRow(id, { order });
      });
      return;
    }
    // A sorted view decides where its rows go. Placing one by hand means the sort
    // goes — Notion asks first — and the rows stay in the order they were showing,
    // with this one where it was put.
    const ok = await confirm({
      title: 'Remove this view’s sort?',
      body: `This view is sorted by ${sortNames || 'a property'}, so the sort decides where pages go. Removing it keeps them in the order you see, with this one where you put it.`,
      actionLabel: 'Remove sort',
      tone: 'warning',
    });
    if (!ok) return;
    const shownIds = [...new Set(visible.map((r) => r.id))];
    const sequence = frozenOrder(shownIds, rowId, { beforeId: others[to.index]?.id, afterId: others[to.index - 1]?.id });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const keys = orderFor(sequence.map((id) => ({ id, order: byId.get(id)?.order ?? '' })));
    store.transact(() => {
      patchView({ sorts: [] });
      if (data) patchRow(rowId, { data });
      for (const [id, order] of keys) patchRow(id, { order });
    });
  };
  /** ⌥↑ / ⌥↓ and the row menu's Move up / Move down: one place within its section. */
  const nudgeRow = (rowId: string, section: string, index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= sectionRows(section).length) return;
    void moveRow(rowId, { section, index }, { section, index: to });
  };
  const moveColumn = (id: string, beforeId: string | null) => {
    const next = moveBefore(ordered.map((p) => p.id), id, beforeId);
    if (next) patchView({ propOrder: next });
  };

  // One data row (shared by the flat and grouped table bodies): its handle in the
  // margin, then its cells, then the empty cell under the header's +.
  const renderTableRow = (r: DbRow, section: string, index: number, count: number) => (
    <div key={store.stableKey(r.id)} data-row={r.id} data-section={section} className="zb-db-row group relative"
      style={{ display: 'flex', alignItems: 'stretch', minHeight: 40, borderBottom: '1px solid var(--line-2)', background: colorBg(r) }}>
      <RowHandle section={section} rowId={r.id} index={index} count={count} label={r.title}
        onOpen={() => openRow(r.id)} onMove={(by) => nudgeRow(r.id, section, index, by)} onDelete={() => removeRow(r.id)} />
      {shown.map((p) => (
        <div key={p.id} style={{ position: 'relative', width: colWidth(p), flexShrink: 0, borderRight: verticalLine, display: 'flex', alignItems: 'center' }}>
          <Cell prop={p} row={r} onPatch={(patch) => patchRow(r.id, patch)} onCreateOption={createOption} allProps={col.props}
            autoFocus={p.type === 'title' && focusRowKey !== null && store.stableKey(r.id) === focusRowKey}
            onAutoFocused={() => setFocusRowKey(null)} />
          {p.type === 'title' && (
            /* Notion's hover Open pill — every row is a page. Notion sets it in capitals; Zenboard's voice is sentence
               case everywhere (2026-09-08), so the anatomy is Notion's and the word is ours. */
            <button onClick={() => openRow(r.id)} className="reveal-on-hover" aria-label="Open row" title="Open"
              style={{ position: 'absolute', right: 6, display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--paper-2)', boxShadow: 'var(--shadow-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-label-size)', fontWeight: 500, cursor: 'pointer' }}>
              <Icon icon={Maximize2} size={12} /> Open
            </button>
          )}
        </div>
      ))}
      <div aria-hidden style={{ width: 40, flexShrink: 0 }} />
    </div>
  );

  // The "+ New" affordance at the foot of a body (optionally presets a group value).
  const newRowButton = (preset: Record<string, unknown> = {}, key?: string) => (
    <button key={key} onClick={() => setFocusRowKey(addRow(preset))} className="zb-press"
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 36, padding: '0 8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', cursor: 'pointer', textAlign: 'left' }}>
      <Icon icon={Plus} size={14} /> New
    </button>
  );

  // A grouped section header: caret + option chip (or label) + row count. `key`
  // is the collapse key (composite for subgroups); `level` indents nested rows.
  // `heads` — the rows under this header are a section a row can be dropped into
  // (a group with no sub-groups, or a sub-group).
  const renderGroupHeader = (g: RowGroup, key: string = g.key, level = 0, heads = true) => (
    <button onClick={() => toggleCollapsed(key)} aria-expanded={!isCollapsed(key)} className="zb-press"
      {...(heads ? { 'data-section-head': key, 'data-collapsed': isCollapsed(key), 'data-count': g.rows.length } : {})}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: level ? 34 : 40, padding: '0 8px', paddingLeft: 8 + level * 20, border: 'none', borderBottom: '1px solid var(--line-2)', background: level ? 'var(--paper)' : 'var(--paper-2)', cursor: 'pointer', textAlign: 'left', position: 'sticky', left: 0 }}>
      <Icon icon={ChevronRight} size={12} weight="bold" style={{ color: 'var(--text-muted)', transition: 'transform var(--duration-fast) var(--ease-out-quiet)', transform: isCollapsed(key) ? 'none' : 'rotate(90deg)' }} />
      {g.option ? <OptionChip opt={g.option} status={tableGroupProp?.type === 'status' || tableSubProp?.type === 'status'} /> : <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--text-muted)' }}>{g.label}</span>}
      <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontWeight: 500 }}>{g.rows.length}</span>
    </button>
  );

  return (
    // Database-scoped undo/redo: ⌘Z inside the surface undoes database ops
    // through the engine store (and never leaks into the document editor —
    // data-db-surface tells host editors to yield keys typed in here).
    <div ref={surfaceRef} data-db-surface style={{ marginTop: 8 }} onKeyDownCapture={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) store.redo(); else store.undo();
      }
    }}>
      {inline && titleShown && <InlineDbName store={store} />}
      {/* View bar — Notion's: the views as a row of named tabs (the chosen one a quiet
          pill) with + to add one; then this view's tools — filter, sort, search, full
          page, settings — and New. Two lines at most on a phone: tabs, then tools. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* The views — three tabs, "N more…", and each view's menu. `flex-auto`, not
            `flex-1`, inside: a zero basis never makes the tools wrap, so on a phone the
            tabs were squeezed to nothing beside them. */}
        {view && (
          <DatabaseViewsBar
            views={col.views}
            currentId={view.id}
            onSelect={setViewId}
            onAdd={addView}
            onReorder={(ids) => patchCol({ views: orderViews(col.views, ids) })}
            actions={viewActions}
          />
        )}
        {/* The view's tools read as ONE cluster (tight gap), then New sits apart. */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {/* Filter — quick property picker → adds a filter chip (§9.4) */}
          <div className="relative">
            <IconButton size="sm" label="Filter" selected={filterOpen || rules.length > 0} aria-expanded={filterOpen} icon={<Icon icon={Filter} size={16} />} onClick={() => setFilterOpen((v) => !v)} />
            {filterOpen && (
              <Pop onClose={() => setFilterOpen(false)} right width={220}>
                <div className={POP_LABEL}>Filter by</div>
                {col.props.map((p) => (
                  <button key={p.id} onClick={() => addRule(p.id)} className={cn('zb-press', POP_ROW)}>
                    <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  </button>
                ))}
                {/* A GROUP is a bracketed set with its own join — "(A or B) and C",
                    which a flat chip list cannot express at any length. */}
                <div aria-hidden className={POP_SEPARATOR} />
                <div className={POP_LABEL}>Add a group</div>
                {col.props.map((p) => (
                  <button key={`g-${p.id}`} onClick={() => addGroup(p.id)} className={cn('zb-press', POP_ROW)}>
                    <Icon icon={Layers} size={16} className="text-ink-600" />
                    <span className="min-w-0 flex-1 truncate">Group on {p.name}</span>
                  </button>
                ))}
              </Pop>
            )}
          </div>
          {/* Sort — the Sort page, on its own (T7 recorded it missing from the bar) */}
          <div className="relative">
            <IconButton size="sm" label="Sort" selected={sortOpen || (view?.sorts?.length ?? 0) > 0} aria-expanded={sortOpen} icon={<Icon icon={ArrowDownUp} size={16} />} onClick={() => setSortOpen((v) => !v)} />
            {sortOpen && view && (
              <Pop onClose={() => setSortOpen(false)} right width={320}>
                <ViewSettings view={view} props={ordered} onPatchView={patchView} onCopyLink={copyViewLink} onClose={() => setSortOpen(false)} startAt="sort" />
              </Pop>
            )}
          </div>
          {/* Search — quiet icon that expands into an underline input */}
          {searching ? (
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setSearching(false); } }}
              onBlur={() => { if (!q.trim()) setSearching(false); }}
              placeholder="Search…" autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Search rows"
              data-owns-escape
              className="h-[26px] w-40 border-0 border-b border-line-strong bg-transparent px-0.5 text-meta text-ink-900 outline-none" />
          ) : (
            <IconButton size="sm" label="Search" icon={<Icon icon={Search} size={16} />} onClick={() => setSearching(true)} />
          )}
          {onExpand && (
            <IconButton size="sm" label="Open as full page" icon={<Icon icon={Maximize2} size={16} />} onClick={onExpand} />
          )}
          {/* View settings — the consolidated panel (§9.3); properties live here too */}
          <div className="relative">
            <IconButton size="sm" label="View settings" selected={settingsOpen} aria-expanded={settingsOpen} icon={<Icon icon={SlidersHorizontal} size={16} />} onClick={() => setSettingsOpen((v) => !v)} />
            {settingsOpen && view && (
              <Pop onClose={() => setSettingsOpen(false)} right width={320}>
                <ViewSettings view={view} props={ordered} onPatchView={patchView} onCopyLink={copyViewLink} onClose={() => setSettingsOpen(false)} />
              </Pop>
            )}
          </div>
          {/* One filled button per view: on a database page New is it; inside a document
              the document owns that, so an inline database's New is secondary. */}
          <Button className="ml-1.5" variant={inline ? 'secondary' : 'primary'} size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => addAndOpen()}>New</Button>
        </div>
      </div>

      {/* ── Filter chips (§9.4): one chip per rule; click to edit, ⋯ to remove ── */}
      {(rules.length > 0 || subGroups.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {rules.map((rule, i) => {
            const p = col.props.find((x) => x.id === rule.prop);
            if (!p) return null;
            return (
              <Fragment key={i}>
              {/* The join between chips IS the control — click it to flip the
                  whole group between and/or (Notion). The first chip has no
                  join; "Where" would be a word with nothing to toggle. */}
              {i > 0 && (
                <button
                  onClick={() => setLogic(logic === 'and' ? 'or' : 'and')}
                  aria-label={`Match ${logic === 'and' ? 'all' : 'any'} filters — click to switch to ${logic === 'and' ? 'any' : 'all'}`}
                  title={logic === 'and' ? 'All filters must match. Click for any.' : 'Any filter may match. Click for all.'}
                  className="zb-press focus-ring"
                  style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {logic}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', height: 26, borderRadius: 'var(--r-sm)', background: 'var(--paper-3)', border: '1px solid var(--line-2)', overflow: 'hidden' }}>
                  <button onClick={() => setChipEdit(chipEdit === i ? null : i)} className="zb-press"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%', padding: '0 4px 0 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--ink-2)', maxWidth: 220 }}>
                    <Icon icon={propIcon(p.type)} size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chipSummary(rule, p)}</span>
                  </button>
                  <button onClick={() => removeRule(i)} aria-label="Remove filter" className="zb-press"
                    style={{ display: 'grid', placeItems: 'center', width: 20, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <Icon icon={X} size={12} />
                  </button>
                </div>
                {chipEdit === i && (
                  <Pop onClose={() => setChipEdit(null)} width={230}>
                    <FilterCondition rule={rule} prop={p} onChange={(patch) => editRule(i, patch)} onRemove={() => removeRule(i)} />
                  </Pop>
                )}
              </div>
              </Fragment>
            );
          })}
          {/* Sub-group chips — "( 2 conditions )", each with its own and/or */}
          {subGroups.map((g, gi) => (
            <Fragment key={`g${gi}`}>
              {(rules.length > 0 || gi > 0) && (
                <button
                  onClick={() => setLogic(logic === 'and' ? 'or' : 'and')}
                  aria-label={`Match ${logic === 'and' ? 'all' : 'any'} filters — click to switch to ${logic === 'and' ? 'any' : 'all'}`}
                  className="zb-press focus-ring"
                  style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {logic}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', height: 26, borderRadius: 'var(--r-sm)', background: 'var(--paper-3)', border: '1px solid var(--line-2)', overflow: 'hidden' }}>
                  <button onClick={() => setGroupEdit(groupEdit === gi ? null : gi)} className="zb-press"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%', padding: '0 4px 0 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--ink-2)' }}>
                    <Icon icon={Layers} size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span>{g.rules.length} condition{g.rules.length === 1 ? '' : 's'} · {g.logic}</span>
                  </button>
                  <button onClick={() => patchGroup(gi, null)} aria-label="Remove filter group" className="zb-press"
                    style={{ display: 'grid', placeItems: 'center', width: 20, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <Icon icon={X} size={12} />
                  </button>
                </div>
                {groupEdit === gi && (
                  <Pop onClose={() => setGroupEdit(null)} width={260}>
                    <FilterGroupEditor group={g} props={col.props} onChange={(next) => patchGroup(gi, next)} />
                  </Pop>
                )}
              </div>
            </Fragment>
          ))}
          {/* + Add filter chip persists at the end of the row */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setFilterOpen(true)} className="zb-press"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px dashed var(--line-3)', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>
              <Icon icon={Plus} size={12} /> Add filter
            </button>
          </div>
        </div>
      )}

      {/* Pages hidden by this view's filters or search — said once, with the way back.
          A view that simply has no pages yet needs no sentence: its layout offers New. */}
      {rows.length > 0 && visible.length === 0 && (
        <EmptyLine className="flex flex-wrap items-center gap-2">
          No pages match this view.
          <Button variant="ghost" size="xs" onClick={() => { setQ(''); setSearching(false); patchView({ filter: undefined }); }}>Clear filters</Button>
        </EmptyLine>
      )}

      {/* ── Table ── */}
      {/* No outer border-box: an inline database should FLOW with the document
          (Notion), not sit in a rounded card floating on the page. The header
          underline and row dividers give it all the structure it needs; a border
          + radius + fill is the "detached box" the doc page reads as. A single
          top hairline ties it to the toolbar above. */}
      {view?.kind === 'table' && (
        <div ref={bleed} className="bleed-x-handles scrollbar-quiet overflow-x-auto">
          {/* Rows move by their handle, columns by their header (T12). */}
          <TableDrag columns={shown.map((p) => p.id)} onDropRow={(id, from, to) => void moveRow(id, from, to)} onDropColumn={moveColumn}
            style={{ minWidth: 'max-content', borderTop: '1px solid var(--line-2)' }}>
            {/* header — for an ungrouped table, where its one section of rows begins */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line-2)', background: 'var(--paper-2)' }}
              {...(tableGroups ? {} : { 'data-section-head': ALL, 'data-count': visible.length })}>
              {shown.map((p) => (
                <ColumnDragCell key={p.id} id={p.id} name={p.name} icon={propIcon(p.type)}
                  style={{ position: 'relative', width: colWidth(p), flexShrink: 0, borderRight: verticalLine }}
                  title="Click for options · drag to move"
                  onClick={() => { setHeadMenu(headMenu === p.id ? null : p.id); setTypeMenu(false); setRename(p.name); }}
                  buttonStyle={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 36, padding: '0 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: 0 }}
                  label={(<>
                    <Icon icon={propIcon(p.type)} size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {(() => {
                      // Show a sort arrow on ANY sorted column; when several are
                      // sorted, a small precedence number reflects the sort order.
                      const si = (view.sorts ?? []).findIndex((s) => s.prop === p.id);
                      if (si < 0) return null;
                      const s = view.sorts![si];
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: 'var(--ink-2)', flexShrink: 0 }}>
                          <Icon icon={s.dir === 'asc' ? ArrowUp : ArrowDown} size={12} />
                          {(view.sorts!.length > 1) && <span style={{ fontSize: 9, fontWeight: 600 }}>{si + 1}</span>}
                        </span>
                      );
                    })()}
                  </>)}>
                  {headMenu === p.id && (
                    <Pop onClose={() => { setHeadMenu(null); setTypeMenu(false); }}>
                      {typeMenu ? (
                        <>
                          <div className="flex items-center gap-1 px-0.5 pb-1.5 pt-0.5">
                            <IconButton size="xs" label="Back" icon={<Icon icon={ArrowLeft} size={16} />} onClick={() => setTypeMenu(false)} />
                            <span className="flex-1 text-ui font-semibold text-ink-900">Property type</span>
                          </div>
                          {PROP_META.filter((m) => RETYPEABLE.includes(m.type)).map((m) => (
                            <button key={m.type} onClick={async () => {
                              setTypeMenu(false); setHeadMenu(null);
                              // §5.21: coerce, and NEVER destroy silently. The plan
                              // counts what survives and what does not; only a plan
                              // with warnings is worth interrupting for.
                              const plan = planConversion(p, m.type, rows);
                              if (plan.warnings.length > 0) {
                                const ok = await confirm({
                                  title: `Change “${p.name}” to ${m.label}?`,
                                  body: `${plan.warnings.join(' ')}${plan.lost > 0 ? ` ${plan.lost} of ${rows.length} row${rows.length === 1 ? '' : 's'} affected.` : ''}`,
                                  actionLabel: plan.lossless ? 'Change type' : 'Change and lose data',
                                });
                                if (!ok) return;
                              }
                              store.retypeProp(p.id, m.type);
                            }} className={cn('zb-press', POP_ROW)}>
                              <Icon icon={propIcon(m.type)} size={16} className="text-ink-600" />
                              <span style={{ flex: 1 }}>{m.label}</span>
                              {p.type === m.type && <Icon icon={Check} size={16} className="text-ink-600" />}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          <MenuField value={rename} onChange={(e) => setRename(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { patchCol({ props: col.props.map((x) => (x.id === p.id ? { ...x, name: rename.trim() || x.name } : x)) }); setHeadMenu(null); } }}
                            onBlur={() => { if (rename.trim() && rename !== p.name) patchCol({ props: col.props.map((x) => (x.id === p.id ? { ...x, name: rename.trim() } : x)) }); }}
                            aria-label="Property name" placeholder="Property name" className="mb-1" />
                          {/* The formula's expression, with a live result — the same
                              editor the page property popover uses, so the language
                              has ONE authoring surface rather than two that drift.
                              Previewed against the first row, and it says so: a
                              formula applies to every row but can only show one
                              answer, and an unexplained number reads as a bug. */}
                          {p.type === 'formula' && (
                            <FormulaEditor
                              expr={p.formula?.expr ?? ''}
                              onExpr={(expr) => patchCol({ props: col.props.map((x) => (x.id === p.id ? { ...x, formula: { expr } } : x)) })}
                              evaluate={(e) => evalFormula(e, rows[0] ?? EMPTY_ROW, col.props, resolveCollection)}
                              sampleLabel={rows.length ? `on ${rows[0].title || 'Untitled'}` : 'no rows yet'}
                            />
                          )}
                          {RETYPEABLE.includes(p.type) && (
                            <button onClick={() => setTypeMenu(true)} className={cn('zb-press', POP_ROW)}>
                              <Icon icon={propIcon(p.type)} size={16} className="text-ink-600" />
                              <span style={{ flex: 1 }}>Type</span>
                              <span className="inline-flex items-center gap-1.5 text-ui text-ink-500">{propLabel(p.type)}<Icon icon={ChevronRight} size={16} /></span>
                            </button>
                          )}
                          <button onClick={() => { sortBy(p.id, 'asc'); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={ArrowUp} size={16} className="text-ink-600" /> Sort ascending</button>
                          <button onClick={() => { sortBy(p.id, 'desc'); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={ArrowDown} size={16} className="text-ink-600" /> Sort descending</button>
                          {view.sorts?.length ? <button onClick={() => { patchView({ sorts: [] }); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={History} size={16} className="text-ink-600" /> Clear sort</button> : null}
                          <button onClick={() => { addRule(p.id); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={Filter} size={16} className="text-ink-600" /> Filter by this property</button>
                          {p.type !== 'title' && (
                            <>
                              <div aria-hidden className={POP_SEPARATOR} />
                              <button onClick={() => { patchView({ hidden: [...hidden, p.id] }); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={EyeOff} size={16} className="text-ink-600" /> Hide in view</button>
                              <button onClick={() => { setHeadMenu(null); removeProp(p); }} className={cn('zb-press', POP_ROW, 'text-danger-600')}><Icon icon={Trash2} size={16} /> Delete property</button>
                            </>
                          )}
                        </>
                      )}
                    </Pop>
                  )}
                </ColumnDragCell>
              ))}
              {/* add property */}
              <div style={{ position: 'relative', width: 40, flexShrink: 0 }}>
                <button onClick={() => setHeadMenu(headMenu === '+' ? null : '+')} aria-label="Add property" title="Add property" className="zb-press"
                  style={{ display: 'grid', placeItems: 'center', width: '100%', height: 36, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Icon icon={Plus} size={14} />
                </button>
                {headMenu === '+' && (
                  <Pop onClose={() => setHeadMenu(null)} right>
                    {PROP_META.map((m) => (
                      <button key={m.type} onClick={() => { addProp(m.type); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}>
                        <Icon icon={propIcon(m.type)} size={16} className="text-ink-600" /> {m.label}
                      </button>
                    ))}
                  </Pop>
                )}
              </div>
            </div>
            {/* rows — grouped into collapsible sections when a group property is set */}
            {tableGroups
              ? tableGroups.map((g) => (
                  <div key={g.key}>
                    {renderGroupHeader(g, g.key, 0, !g.subgroups)}
                    {!isCollapsed(g.key) && (
                      g.subgroups
                        ? g.subgroups.map((sg) => {
                            const ck = `${g.key}::${sg.key}`;
                            return (
                              <div key={ck}>
                                {renderGroupHeader(sg, ck, 1)}
                                {!isCollapsed(ck) && (
                                  <>
                                    {sg.rows.map((r, i) => renderTableRow(r, ck, i, sg.rows.length))}
                                    {newRowButton(subGroupPreset(g.key, sg.key), `new-${ck}`)}
                                  </>
                                )}
                              </div>
                            );
                          })
                        : (
                          <>
                            {g.rows.map((r, i) => renderTableRow(r, g.key, i, g.rows.length))}
                            {newRowButton(groupPreset(g.key), `new-${g.key}`)}
                          </>
                        )
                    )}
                  </div>
                ))
              : (
                <>
                  {visible.map((r, i) => renderTableRow(r, ALL, i, visible.length))}
                  {/* new row */}
                  {newRowButton()}
                </>
              )}
          </TableDrag>
        </div>
      )}

      {/* ── Board — Notion's, in components/documents/database-board.tsx ── */}
      {view?.kind === 'board' && (groupProp ? (
        <DatabaseBoard
          rows={visible} props={ordered} view={view} prop={groupProp}
          onOpen={openRow}
          onAdd={({ title, data, order }) => store.addRow({ title, data: newRowValues(col.props, view, data), order })}
          onPatchRow={patchRow}
          onDelete={removeRow}
          onPatchView={patchView}
          onPatchOption={(optionId, patch) => patchCol({
            props: col.props.map((p) => (p.id === groupProp.id ? { ...p, options: (p.options ?? []).map((o) => (o.id === optionId ? { ...o, ...patch } : o)) } : p)),
          })}
          tint={colorBg}
        />
      ) : (
        <DbLine>Add a Select or Status property to group this board.</DbLine>
      ))}

      {/* ── Gallery — cards with a preview of each page, in database-gallery.tsx ── */}
      {view?.kind === 'gallery' && (
        <DatabaseGallery rows={visible} props={ordered} view={view} keyOf={(id) => store.stableKey(id)}
          onOpen={openRow} onDelete={removeRow} onNew={() => addAndOpen()} tint={colorBg} />
      )}


      {/* ── Timeline — the same rows as bars across time, in database-timeline.tsx ── */}
      {view?.kind === 'timeline' && (
        <DatabaseTimeline
          rows={visible} props={col.props} view={view}
          onOpen={openRow}
          onPatchRow={patchRow}
          onPatchView={patchView}
          onAdd={(data) => openRow(addRow(data), true)}
          onAddDate={() => {
            const date: PropDef = { id: genId(), name: 'Date', type: 'date' };
            patchCol({ props: [...col.props, date], views: col.views.map((v) => (v.id === view.id ? { ...v, dateProp: date.id } : v)) });
          }}
          tint={colorBg}
        />
      )}

      {/* ── Calendar — the same rows placed on a month by one date property ── */}
      {view?.kind === 'calendar' && (
        <CalendarView
          rows={visible} props={col.props} view={view}
          onPatchView={patchView} onOpen={openRow}
          onAddOn={(day) => { const p = view.dateProp; if (p) addAndOpen({ [p]: day }); }}
        />
      )}

      {/* ── Feed — newest first, body preview. The reading layout. ── */}
      {view?.kind === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[...visible].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).map((r) => (
            <button key={store.stableKey(r.id)} onClick={() => openRow(r.id)} className="zb-press"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 8px', border: 'none', borderBottom: '1px solid var(--line-2)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: r.title ? 'var(--ink)' : 'var(--text-muted)' }}>{r.title || 'Untitled'}</span>
              <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{fmtCellDate(r.updated_at)}</span>
            </button>
          ))}
          {visible.length === 0 && <DbLine>Nothing here yet.</DbLine>}
          <button onClick={() => addAndOpen()} className="zb-press" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 'var(--row-nav)', padding: '0 8px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', cursor: 'pointer', textAlign: 'left' }}>
            <Icon icon={Plus} size={14} /> New
          </button>
        </div>
      )}

      {/* ── List — one page per line, in database-list.tsx ── */}
      {view?.kind === 'list' && (
        <DatabaseList rows={visible} props={ordered} view={view} keyOf={(id) => store.stableKey(id)}
          onOpen={openRow} onNew={() => addAndOpen()} tint={colorBg} />
      )}

      {/* The row as a page — and every page inside it, in the same peek */}
      {peek && peekId && !peekApi && (
        <PagePeek root={{ kind: 'row', colId: col.id, rowId: peekId, fresh: peekId === freshId }}
          onClose={() => { setPeekId(null); setFreshId(null); }}
          openIn={view ? openPagesIn(view) : 'side-peek'}
          onSetOpenIn={(m) => patchView({ openIn: m })} />
      )}

      <style>{`
        /* Row-action reveal is the DS reveal-on-hover utility now — the rules
           that used to live here had no coarse-pointer branch, so delete/open/
           link were unreachable on a phone. Only the row tint stays local. */
        .zb-db-row:hover { background: color-mix(in srgb, var(--ink) 2%, transparent); }
        /* The row being carried stays in its place, washed as chosen, while the line shows where it goes. */
        .zb-db-row:has(> [data-carried]) { background: var(--color-surface-active); }
        .zb-db-title::placeholder { color: var(--text-muted); }
      `}</style>
      {confirmUI}
    </div>
  );
}

// ── A page in a peek — a database row, and every page inside it ─────────────
// Every database row IS a page (Notion, and since 0028 literally so), and a page
// holds pages: a Page block, or a database whose rows are pages again, as deep as
// anyone goes (the user, 2026-09-15). The first page opens the way its view says
// (T6); every page opened from inside it steps DEEPER in the same peek — a trail
// in the header, back and forward through it — rather than stacking a new panel per
// level. The editor is loaded dynamically to keep block-editor ⇄ database-view
// imports acyclic.
const BlockEditorLazy = dynamic(() => import('./block-editor').then((m) => ({ default: m.BlockEditor })), { ssr: false });

/** Delete a row at once, and say how to take it back (the store keeps the inverse). */
function deleteRowWithUndo(store: DbStore, id: string) {
  const entry = store.removeRow(id);
  if (!entry) return;
  toast({ message: 'Row deleted.', action: { label: 'Undo', onAction: () => store.undoEntry(entry) } });
}

const entryKey = (e: PeekEntry) => (e.kind === 'row' ? `row:${e.colId}:${e.rowId}` : `page:${e.pageId}`);

/**
 * The names along a peek's trail, kept current as they are edited — in this peek,
 * in the view behind it, or anywhere else a row or page is renamed.
 */
function usePeekTitles(stack: PeekEntry[]): { database: string; pages: string[] } {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const key = stack.map(entryKey).join('|');
  useEffect(() => {
    const offs = [subscribeStores(bump), subscribePages(bump)];
    for (const e of stack) {
      const s = e.kind === 'row' ? storeForCollection(e.colId) : null;
      if (s) offs.push(s.subscribe(bump));
    }
    return () => offs.forEach((off) => off());
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` is the stack's identity
  const first = stack[0];
  return {
    database: first.kind === 'row' ? storeForCollection(first.colId)?.getState().col.name ?? '' : '',
    pages: stack.map((e) => {
      if (e.kind === 'page') return pageEntry(e.pageId)?.record?.title ?? '';
      const s = storeForCollection(e.colId);
      return s?.getState().rows.find((r) => r.id === s.currentId(e.rowId))?.title ?? '';
    }),
  };
}

function PagePeek({ root, openIn, onSetOpenIn, onClose }: {
  /** The page the peek was opened on. A different one (another card) starts a new trail. */
  root: PeekEntry;
  /** The view's "Open pages in" — how this peek opens, and where "Set as default" saves. */
  openIn: PageViewMode; onSetOpenIn: (m: PageViewMode) => void;
  onClose: () => void;
}) {
  const [trail, setTrail] = useState<Trail<PeekEntry>>(() => startTrail(entryKey(root), root));
  // Another card clicked while the peek is open: show that page, from the top of a
  // new trail. Adjusted during render (React's pattern), so no frame shows the old one.
  let current = trail;
  if (trail.root !== entryKey(root)) {
    current = startTrail(entryKey(root), root);
    setTrail(current);
  }
  const { stack, ahead } = current;
  const top = stack[stack.length - 1];
  const api = useMemo<PeekApi>(() => ({ open: (entry) => setTrail((t) => deeper(t, entry)) }), []);
  const back = () => setTrail(trailBack);
  const forward = () => setTrail(trailForward);
  const titles = usePeekTitles(stack);
  const deep = stack.length > 1;
  const crumbs: Crumb[] = [
    ...(titles.database ? [{ label: titles.database }] : []),
    ...stack.map((e, i) => ({
      label: titles.pages[i] || 'Untitled',
      ...(i < stack.length - 1 ? { onNavigate: () => setTrail((t) => backTo(t, i)) } : {}),
    })),
  ];
  const topStore = top.kind === 'row' ? storeForCollection(top.colId) : null;

  // A row opens through <PageView> — the ONE opening system (INTERACTION_STANDARDS
  // §2.11): Escape, scrim, focus and the universal toolbar come from the primitive.
  // No `href`: a row has no standalone route, so "Open in new tab" hides itself.
  return (
    <PeekContext.Provider value={api}>
      <PageView
        open
        onOpenChange={(o) => { if (!o) onClose(); }}
        contentType="database-row"
        preferredMode={openIn}
        onSetDefault={onSetOpenIn}
        defaultScope="this view"
        title={titles.pages[stack.length - 1] || 'Untitled'}
        breadcrumbs={deep ? crumbs : undefined}
        history={deep || ahead.length ? { canBack: deep, onBack: back, canForward: ahead.length > 0, onForward: forward } : undefined}
        more={top.kind === 'row' && topStore ? (
          <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />}
            onSelect={() => { deleteRowWithUndo(topStore, top.rowId); if (deep) back(); else onClose(); }}>
            Delete row
          </DropdownMenuItem>
        ) : undefined}
      >
        {top.kind === 'row'
          ? <RowPage key={entryKey(top)} colId={top.colId} rowId={top.rowId} fresh={!!top.fresh} onOpenPage={(pageId) => api.open({ kind: 'page', pageId })} />
          : <SubPage key={entryKey(top)} pageId={top.pageId} onOpenPage={(pageId) => api.open({ kind: 'page', pageId })} />}
      </PageView>
    </PeekContext.Provider>
  );
}

/**
 * A page's name, as a page wears it — large, at the top, written in place (Notion).
 * A textarea so a long name wraps instead of scrolling out of sight; Enter goes into
 * the body rather than opening a second line, because a name is one string.
 */
const PageTitle = forwardRef<HTMLTextAreaElement, { value: string; onChange: (value: string) => void; autoFocus?: boolean }>(
  function PageTitle({ value, onChange, autoFocus }, ref) {
    const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
    return (
      <textarea
        ref={(el) => { grow(el); if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
        value={value}
        rows={1}
        autoFocus={autoFocus}
        placeholder="Untitled"
        aria-label="Page name"
        autoComplete="off" data-1p-ignore data-lpignore="true" data-chromeless
        onChange={(e) => { onChange(e.target.value); grow(e.currentTarget); }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          e.preventDefault();
          (e.currentTarget.closest('[data-page-document]')?.querySelector('[data-block-id] [contenteditable], [data-block-id] textarea') as HTMLElement | null)?.focus();
        }}
        className="doc-title-input block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-ink-900 outline-none placeholder:text-ink-500"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1-size)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '36px' }}
      />
    );
  },
);

function RowPage({ colId, rowId, fresh, onOpenPage }: { colId: string; rowId: string; fresh: boolean; onOpenPage: (pageId: string) => void }) {
  const store = useCollectionStore(colId);
  if (!store) return <DbLine>This database is no longer open.</DbLine>;
  return <RowPageBody store={store} rowId={rowId} fresh={fresh} onOpenPage={onOpenPage} />;
}

function RowPageBody({ store, rowId, fresh, onOpenPage }: { store: DbStore; rowId: string; fresh: boolean; onOpenPage: (pageId: string) => void }) {
  const { col, rows } = useDbState(store);
  const row = rows.find((r) => r.id === store.currentId(rowId));
  if (!row) return <DbLine>This page was deleted.</DbLine>;
  return <RowDocument store={store} col={col} row={row} fresh={fresh} onOpenPage={onOpenPage} />;
}

/**
 * A row as a page: its name, its properties, then its body — where it can hold
 * pages and databases of its own.
 */
function RowDocument({ store, col, row, fresh, onOpenPage }: {
  store: DbStore; col: Collection; row: DbRow; fresh: boolean; onOpenPage: (pageId: string) => void;
}) {
  // `row.data.__content` is the pre-0028 home. Reading it as a fallback costs
  // one `??` and means a database whose rows were written by the old code still
  // opens with its prose intact; the first edit rewrites it to `content`.
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(row.content ?? row.data.__content));
  const skip = useRef(true);
  // A row New has just made opens with its name ready to type — a frame after the
  // panel has focused itself (PageView focuses the page, never its first control).
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!fresh) return;
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [fresh]);
  // Debounced body save — its own column, so it can never clobber a cell edit. A
  // save still waiting when the page goes away (closed, or left for a page inside
  // it — which `/page` does at once) is written then, not dropped.
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    // `currentId`: a row made a moment ago may have taken its server id since.
    // `withBlocks` over the store's LATEST content: the body replaces only the blocks, so
    // a preview a Collection card remembered while this page was open is kept (C2).
    const save = () => {
      pending.current = null;
      const id = store.currentId(row.id);
      store.patchRow(id, { content: withBlocks(store.getState().rows.find((r) => r.id === id)?.content, blocks) });
    };
    pending.current = save;
    const t = setTimeout(save, 500);
    return () => clearTimeout(t);
  }, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { pending.current?.(); }, []);
  const onPatch = (patch: { title?: string; data?: Record<string, unknown> }) => store.patchRow(row.id, patch);
  return (
    <div data-page-document className="px-4 pb-10 pt-3">
      <PageTitle ref={titleRef} value={row.title} onChange={(title) => onPatch({ title })} />
      {/* Properties — a name and the same cells the table uses, one per line */}
      <div className="mb-1.5 mt-3 flex flex-col">
        {col.props.filter((p) => p.type !== 'title').map((p) => (
          <div key={p.id} className="flex min-h-[var(--row-nav)] items-center">
            <span className="inline-flex w-[140px] shrink-0 items-center gap-1.5 text-ui text-ink-600">
              <Icon icon={propIcon(p.type)} size={16} className="shrink-0 text-ink-500" />
              <span className="truncate">{p.name}</span>
            </span>
            <div className="-ml-2 min-w-0 flex-1">
              <Cell prop={p} row={row} onPatch={onPatch} onCreateOption={(propId, name) => store.createOption(propId, name)} allProps={col.props} sheet />
            </div>
          </div>
        ))}
        <div className="flex min-h-[30px] items-center text-meta text-ink-500">
          <span className="inline-flex w-[140px] shrink-0 items-center gap-1.5"><Icon icon={History} size={16} />Created</span>{fmtCellDate(row.created_at)}
        </div>
        <div className="flex min-h-[30px] items-center text-meta text-ink-500">
          <span className="inline-flex w-[140px] shrink-0 items-center gap-1.5"><Icon icon={Clock} size={16} />Updated</span>{fmtCellDate(row.updated_at)}
        </div>
      </div>
      <div className="mb-4 mt-3 h-px bg-line-soft" />
      <BlockEditorLazy blocks={blocks} onChange={setBlocks} pageId={row.id} onOpenPage={onOpenPage} />
    </div>
  );
}

/** A page inside a page, opened in the peek: its name, then its body. */
function SubPage({ pageId, onOpenPage }: { pageId: string; onOpenPage: (pageId: string) => void }) {
  const entry = usePage(pageId, { body: true });
  const record = entry?.record;
  if (entry?.state === 'missing') return <DbLine>This page was deleted, or it is not yours.</DbLine>;
  if (entry?.state === 'failed' && entry.during === 'read' && record?.content === undefined) {
    return <DbFailureLine failure={{ title: 'This page could not be opened', retry: true }} onRetry={() => void loadPage(pageId)} />;
  }
  if (!record || record.content === undefined) return <DbLine>Opening page…</DbLine>;
  return <SubPageDocument record={record} onOpenPage={onOpenPage} />;
}

function SubPageDocument({ record, onOpenPage }: { record: PageRecord; onOpenPage: (pageId: string) => void }) {
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(record.content));
  // A page with no name and nothing in it was made a moment ago: its name takes the caret.
  const [fresh] = useState(() => !record.title && !toBlocks(record.content).some((b) => b.text.trim() || b.type !== 'text'));
  const skip = useRef(true);
  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    patchPage(record.id, { content: serialize(blocks) });
  }, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-page-document className="px-4 pb-10 pt-3">
      <PageTitle value={record.title} autoFocus={fresh} onChange={(title) => patchPage(record.id, { title })} />
      <div className="mt-3">
        <BlockEditorLazy blocks={blocks} onChange={setBlocks} pageId={record.id} onOpenPage={onOpenPage} />
      </div>
    </div>
  );
}

// ── Calendar view ───────────────────────────────────────────────────────────
// The same rows, placed on a month by ONE date property. The grid arithmetic and
// the day bucketing live in lib/calendar-grid (pure, tested); this is only the
// rendering and the month/property choices, which are view config like any other.
function CalendarView({ rows, props, view, onPatchView, onOpen, onAddOn }: {
  rows: DbRow[]; props: PropDef[]; view: ViewDef;
  onPatchView: (v: Partial<ViewDef>) => void;
  onOpen: (id: string) => void;
  onAddOn: (day: string) => void;
}) {
  // Which date places a row is a layout setting now ("Show calendar by", the view's
  // Layout page) rather than a native select in the month bar.
  // Fall back to the first date property rather than rendering an empty month —
  // a calendar that shows nothing because nothing was configured reads as broken.
  const datePropId = view.dateProp ?? props.find((p) => p.type === 'date')?.id;
  const monthKey = view.month ?? monthKeyOf(new Date());
  // No explicit week start: `monthGrid` defaults to the app's one (lib/date.ts).
  // This passed a literal `1`, which happened to agree — a seventh copy of a
  // decision that is now made in exactly one place.
  // "Show weekends" off (T8) takes Saturday and Sunday out of the grid AND its
  // header, which both follow the same week start (`weekdayLabels`).
  const weekends = view.showWeekends !== false;
  const cells = useMemo(() => (weekends ? monthGrid(monthKey) : withoutWeekends(monthGrid(monthKey))), [monthKey, weekends]);
  const byDay = useMemo(() => (datePropId ? rowsByDay(rows, datePropId) : new Map<string, DbRow[]>()), [rows, datePropId]);
  const today = dayKeyOf(new Date());

  if (!datePropId) {
    return <DbLine>Add a date property to see these rows on a calendar.</DbLine>;
  }

  return (
    <div>
      {/* Month bar — ‹ › · label · Today · which date property drives it */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <IconButton size="sm" label="Previous month" icon={<Icon icon={ArrowLeft} size={14} />}
          onClick={() => onPatchView({ month: shiftMonth(monthKey, -1) })} />
        <IconButton size="sm" label="Next month" icon={<Icon icon={ChevronRight} size={14} />}
          onClick={() => onPatchView({ month: shiftMonth(monthKey, 1) })} />
        <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: 'var(--ink)' }}>{monthLabel(monthKey)}</span>
        <Button size="sm" variant="secondary" onClick={() => onPatchView({ month: monthKeyOf(new Date()) })}>Today</Button>
      </div>

      {/* Weekday header — the week's order, from the app's one week start */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekends ? 7 : 5}, minmax(0,1fr))`, borderTop: '1px solid var(--line-2)' }}>
        {weekdayLabels(WEEK_STARTS_ON, weekends).map((d) => (
          <div key={d} style={{ padding: '6px 8px', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', borderBottom: '1px solid var(--line-2)' }}>{d}</div>
        ))}
        {cells.map((c) => {
          const items = byDay.get(c.date) ?? [];
          const isToday = c.date === today;
          return (
            <div key={c.date}
              style={{ minHeight: 96, padding: 4, borderBottom: '1px solid var(--line-2)', borderRight: '1px solid var(--line-2)', background: c.inMonth ? 'transparent' : 'color-mix(in srgb, var(--ink) 2%, transparent)' }}>
              <button onClick={() => onAddOn(c.date)} className="zb-press"
                aria-label={`Add on ${c.date}`}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px 4px', color: isToday ? 'var(--ink)' : c.inMonth ? 'var(--ink-2)' : 'var(--text-muted)', fontSize: 'var(--text-caption-size)', fontWeight: isToday ? 700 : 400 }}>
                {Number(c.date.slice(8, 10))}
              </button>
              {items.slice(0, 3).map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)} className="zb-press"
                  style={{ display: 'block', width: '100%', marginBottom: 2, padding: '2px 4px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--paper-3)', color: 'var(--ink-2)', fontSize: 'var(--text-caption-size)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  {r.title || 'Untitled'}
                </button>
              ))}
              {items.length > 3 && (
                <span style={{ display: 'block', padding: '0 4px', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>+{items.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
