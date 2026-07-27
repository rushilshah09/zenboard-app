'use client';
// DatabasePage — Notion-style database hosted by a page of type 'database'.
// Table · Board (drag between groups) · Gallery views over one typed collection
// (lib/collections). Optimistic edits persist via lib/actions/collections;
// a page whose content carries `demoDb` runs on local state (dev-preview).
// Popovers follow the DS v3 anatomy: paper-2 · r-lg · --line-pop ring ·
// shadow-lg · 28px rows.
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import {
  Plus, Table as TableIcon, Kanban, Grid2x2, CaseSensitive, Type, Hash as HashIcon, CircleChevronDown, Tag, Contrast, SquareCheck, Calendar, Link2, Mail, Phone as PhoneIcon, History, Clock, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink, Maximize2, Search, SlidersHorizontal, Rows3 as RowsIcon, FileText, X, Filter, Check, ChevronRight, ArrowLeft, ArrowDownUp, Link as LinkIcon, Layers, Paintbrush, type IconType } from "@/components/ds/icons";
import { Icon, IconButton, Tabs } from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import { Button } from '@/components/ui/primitives';
import { Popover } from '@/components/ui/popover';
import { OptionList } from '@/components/ui/select';
import {
  genId, defaultCollection, fmtCellDate, optionTokens, nextColor, rowText, isFilterGroup, OPTION_COLORS,
  type Collection, type DbRow, type PropDef, type PropType, type ViewDef, type SelectOption,
  type FilterRule, type FilterOp, type ColorRule,
} from '@/lib/collections';
import { getDatabase, getCollection, listCollections } from '@/lib/actions/collections';
import { applyView, displayValue, groupRows, rowColor, RETYPEABLE, type RowGroup } from '@/lib/db-engine';
import { seedStore, useDbState, resolveCollection, type DbStore } from '@/lib/db-store';
import { toBlocks, serialize, type Block } from '@/lib/blocks';

const PROP_META: { type: PropType; label: string; icon: IconType }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: HashIcon },
  { type: 'select', label: 'Select', icon: CircleChevronDown },
  { type: 'multi_select', label: 'Multi-select', icon: Tag },
  { type: 'status', label: 'Status', icon: Contrast },
  { type: 'checkbox', label: 'Checkbox', icon: SquareCheck },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'url', label: 'URL', icon: Link2 },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: PhoneIcon },
  { type: 'created_time', label: 'Created time', icon: History },
  { type: 'updated_time', label: 'Updated time', icon: Clock },
];
const propIcon = (t: PropType): IconType => t === 'title' ? CaseSensitive : (PROP_META.find((m) => m.type === t)?.icon ?? Type);
const isSelectish = (t: PropType) => t === 'select' || t === 'multi_select' || t === 'status';

const VIEW_META: { kind: ViewDef['kind']; label: string; icon: IconType }[] = [
  { kind: 'table', label: 'Table', icon: TableIcon },
  { kind: 'board', label: 'Board', icon: Kanban },
  { kind: 'gallery', label: 'Gallery', icon: Grid2x2 },
  { kind: 'list', label: 'List', icon: RowsIcon },
];
const viewIcon = (k: ViewDef['kind']): IconType => VIEW_META.find((m) => m.kind === k)?.icon ?? TableIcon;

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
  if (type === 'date' || type === 'created_time' || type === 'updated_time') return [
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
  else if ((p.type === 'date' || p.type === 'created_time' || p.type === 'updated_time') && rule.value) v = fmtCellDate(String(rule.value));
  else v = String(rule.value ?? '');
  return v ? `${p.name}: ${lbl} ${v}` : `${p.name}: ${lbl}…`;
}

// ── Positioned wrapper over the canonical Popover (ui/popover) + outside-close ──
function Pop({ children, onClose, width = 230, right }: { children: React.ReactNode; onClose: () => void; width?: number; right?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', fn);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', fn); window.removeEventListener('keydown', key); };
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: 'absolute', top: 'calc(100% + 4px)', [right ? 'right' : 'left']: 0, zIndex: 60 }}>
      <Popover variant="rich" width={width} className="p-1.5">{children}</Popover>
    </div>
  );
}
// Shared menu-row + rule-input chrome, tokenized (DS classes, not inline vars).
const POP_ROW = 'flex h-7 w-full cursor-pointer items-center gap-2 rounded-xs border-0 bg-transparent px-2 text-left text-body text-ink-800';

// Condition editor for one filter chip (§9.4): operator dropdown + a value
// input matched to the property type. Empty-check ops need no value.
const RULE_INP = 'h-[30px] w-full rounded-sm border-0 bg-paper px-2 text-meta text-ink-900 shadow-[0_0_0_1px_var(--color-line)] outline-none';

// The value editor for a filter/color rule — shape follows the property type
// (checkbox → checked/unchecked · select-ish → option chips · else → typed input).
function RuleValueInput({ prop, value, onValue, autoFocus }: {
  prop: PropDef; value: unknown; onValue: (v: unknown) => void; autoFocus?: boolean;
}) {
  if (prop.type === 'checkbox') return (
    <select aria-label="Value" value={value === false || value === 'false' ? 'false' : 'true'} onChange={(e) => onValue(e.target.value === 'true')} className={cn(RULE_INP, 'cursor-pointer')}>
      <option value="true">Checked</option>
      <option value="false">Unchecked</option>
    </select>
  );
  if (isSelectish(prop.type)) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 176, overflowY: 'auto' }}>
      {(prop.options ?? []).map((o) => {
        const on = value === o.id || value === o.name;
        const tk = optionTokens(o.color);
        return (
          <button key={o.id} onClick={() => onValue(o.id)} className={cn('zb-press', POP_ROW, on && 'bg-surface-hover')}>
            <span style={{ padding: '1px 8px', borderRadius: 'var(--r-full)', background: tk.bg, color: tk.text, fontSize: 'var(--text-caption-size)' }}>{o.name}</span>
          </button>
        );
      })}
      {!(prop.options ?? []).length && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No options yet</div>}
    </div>
  );
  return (
    <input
      type={prop.type === 'number' ? 'number' : (prop.type === 'date' || prop.type === 'created_time' || prop.type === 'updated_time' ? 'date' : 'text')}
      autoFocus={autoFocus} value={String(value ?? '')} onChange={(e) => onValue(e.target.value)}
      placeholder="Value…" autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Value" className={RULE_INP}
    />
  );
}

function FilterCondition({ rule, prop, onChange, onRemove }: {
  rule: FilterRule; prop: PropDef; onChange: (patch: Partial<FilterRule>) => void; onRemove: () => void;
}) {
  const ops = opsFor(prop.type);
  const needsValue = opNeedsValue(prop.type, rule.op);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 2px' }}>
        <Icon icon={propIcon(prop.type)} size={13} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prop.name}</span>
      </div>
      <select aria-label="Condition" value={rule.op} onChange={(e) => onChange({ op: e.target.value as FilterOp })} className={cn(RULE_INP, 'cursor-pointer')}>
        {ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      {needsValue && <RuleValueInput prop={prop} value={rule.value} onValue={(v) => onChange({ value: v })} autoFocus />}
      <button onClick={onRemove} className={cn('zb-press', POP_ROW, 'text-danger-600')}><Icon icon={Trash2} size={13} /> Delete filter</button>
    </div>
  );
}

// Conditional color (§9.3): one "when {prop} {op} {value} → {color}" rule.
function ColorRuleEditor({ rule, props, onChange, onRemove }: {
  rule: ColorRule; props: PropDef[]; onChange: (patch: Partial<ColorRule>) => void; onRemove: () => void;
}) {
  const [swatch, setSwatch] = useState(false);
  const prop = props.find((p) => p.id === rule.prop) ?? props[0];
  const ops = opsFor(prop.type);
  const needsValue = opNeedsValue(prop.type, rule.op);
  const tk = optionTokens(rule.color);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 6, background: 'var(--paper-3)', borderRadius: 'var(--r-sm)', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select aria-label="Color rule property" value={prop.id} onChange={(e) => { const np = props.find((p) => p.id === e.target.value)!; onChange({ prop: np.id, op: defaultOp(np.type), value: undefined }); }} className={cn(RULE_INP, 'flex-1 cursor-pointer')}>
          {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setSwatch((v) => !v)} title="Row color" aria-label="Row color" className="zb-press" style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: tk.bg, cursor: 'pointer' }} />
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
      <select aria-label="Color rule condition" value={rule.op} onChange={(e) => onChange({ op: e.target.value as FilterOp })} className={cn(RULE_INP, 'cursor-pointer')}>
        {ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      {needsValue && <RuleValueInput prop={prop} value={rule.value} onValue={(v) => onChange({ value: v })} />}
      <button onClick={onRemove} className={cn('zb-press', POP_ROW, 'text-danger-600')}><Icon icon={Trash2} size={13} /> Delete rule</button>
    </div>
  );
}

// ── View settings panel (§9.3): a sliders-icon menu with sub-pages for layout,
//    property visibility, multi-level sort, and grouping. Engine compareRows
//    already honours the full sorts[] list in order, so multi-sort is live. ──
function ViewSettings({ view, props, onPatchView, onPatchCol }: {
  view: ViewDef; props: PropDef[];
  onPatchView: (vp: Partial<ViewDef>) => void;
  onPatchCol: (patch: { props?: PropDef[] }) => void;
}) {
  const [page, setPage] = useState<'root' | 'layout' | 'props' | 'sort' | 'group' | 'color'>('root');
  const hidden = view.hidden ?? [];
  const sorts = view.sorts ?? [];
  const colorRules = view.colorRules ?? [];
  const nonTitle = props.filter((p) => p.type !== 'title');
  const groupable = props.filter((p) => p.type === 'select' || p.type === 'status' || p.type === 'checkbox' || p.type === 'multi_select');
  const groupName = props.find((p) => p.id === view.groupBy)?.name;

  const header = (title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 2px 6px' }}>
      <button onClick={() => setPage('root')} aria-label="Back" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 'var(--r-xs)' }}><Icon icon={ArrowLeft} size={14} /></button>
      <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--ink-2)' }}>{title}</span>
    </div>
  );
  const navRow = (icon: IconType, label: string, value: React.ReactNode, onClick: () => void) => (
    <button onClick={onClick} className={cn('zb-press', POP_ROW)}>
      <Icon icon={icon} size={14} className="text-ink-600" />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 'var(--text-caption-size)' }}>{value}<Icon icon={ChevronRight} size={12} /></span>
    </button>
  );
  const moveProp = (id: string, dir: -1 | 1) => {
    // Reorder within the non-title props; title always stays pinned first.
    const order = nonTitle.map((p) => p.id);
    const i = order.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const title = props.filter((p) => p.type === 'title');
    onPatchCol({ props: [...title, ...order.map((oid) => nonTitle.find((p) => p.id === oid)!)] });
  };

  if (page === 'layout') return (
    <div>
      {header('Layout')}
      {VIEW_META.map((m) => (
        <button key={m.kind} onClick={() => onPatchView({ kind: m.kind })} className={cn('zb-press', POP_ROW)}>
          <Icon icon={m.icon} size={14} className="text-ink-600" />
          <span style={{ flex: 1 }}>{m.label}</span>
          {view.kind === m.kind && <Icon icon={Check} size={13} style={{ color: 'var(--ink-2)' }} />}
        </button>
      ))}
    </div>
  );

  if (page === 'props') return (
    <div>
      {header('Properties')}
      {nonTitle.map((p, i) => {
        const off = hidden.includes(p.id);
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => moveProp(p.id, -1)} aria-label="Move up" disabled={i === 0} className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 16, height: 14, border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: i === 0 ? 0.3 : 1 }}><Icon icon={ArrowUp} size={10} /></button>
              <button onClick={() => moveProp(p.id, 1)} aria-label="Move down" disabled={i === nonTitle.length - 1} className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 16, height: 14, border: 'none', background: 'transparent', cursor: i === nonTitle.length - 1 ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: i === nonTitle.length - 1 ? 0.3 : 1 }}><Icon icon={ArrowDown} size={10} /></button>
            </div>
            <button onClick={() => onPatchView({ hidden: off ? hidden.filter((h) => h !== p.id) : [...hidden, p.id] })} className={cn('zb-press', POP_ROW, 'flex-1')}>
              <Icon icon={propIcon(p.type)} size={14} className="text-ink-600" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <Icon icon={off ? EyeOff : Eye} size={14} style={{ color: off ? 'var(--text-muted)' : 'var(--ink-2)' }} />
            </button>
          </div>
        );
      })}
    </div>
  );

  if (page === 'sort') {
    const unsorted = props.filter((p) => !sorts.some((s) => s.prop === p.id));
    const setSort = (i: number, patch: Partial<{ prop: string; dir: 'asc' | 'desc' }>) => onPatchView({ sorts: sorts.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
    const removeSort = (i: number) => onPatchView({ sorts: sorts.filter((_, k) => k !== i) });
    const moveSort = (i: number, dir: -1 | 1) => {
      const j = i + dir; if (j < 0 || j >= sorts.length) return;
      const next = [...sorts]; [next[i], next[j]] = [next[j], next[i]]; onPatchView({ sorts: next });
    };
    return (
      <div>
        {header('Sort')}
        {sorts.map((s, i) => {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={() => moveSort(i, -1)} aria-label="Move up" disabled={i === 0} className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 16, height: 12, border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: i === 0 ? 0.3 : 1 }}><Icon icon={ArrowUp} size={10} /></button>
                <button onClick={() => moveSort(i, 1)} aria-label="Move down" disabled={i === sorts.length - 1} className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 16, height: 12, border: 'none', background: 'transparent', cursor: i === sorts.length - 1 ? 'default' : 'pointer', color: 'var(--text-muted)', opacity: i === sorts.length - 1 ? 0.3 : 1 }}><Icon icon={ArrowDown} size={10} /></button>
              </div>
              <select aria-label="Sort property" value={s.prop} onChange={(e) => setSort(i, { prop: e.target.value })} style={{ flex: 1, height: 28, border: 'none', outline: 'none', background: 'var(--paper)', borderRadius: 'var(--r-sm)', boxShadow: '0 0 0 1px var(--line)', fontSize: 'var(--text-caption-size)', padding: '0 6px', color: 'var(--ink)', cursor: 'pointer' }}>
                {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={() => setSort(i, { dir: s.dir === 'asc' ? 'desc' : 'asc' })} className="zb-press" title={s.dir === 'asc' ? 'Ascending' : 'Descending'} style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, border: 'none', background: 'var(--paper-3)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--ink-2)' }}><Icon icon={s.dir === 'asc' ? ArrowUp : ArrowDown} size={13} /></button>
              <button onClick={() => removeSort(i)} aria-label="Remove sort" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 22, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><Icon icon={X} size={12} /></button>
            </div>
          );
        })}
        {unsorted.length > 0 && (
          <button onClick={() => onPatchView({ sorts: [...sorts, { prop: unsorted[0].id, dir: 'asc' }] })} className={cn('zb-press', POP_ROW, 'text-ink-600')}>
            <Icon icon={Plus} size={14} /> Add sort
          </button>
        )}
        {sorts.length === 0 && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No sorts yet</div>}
      </div>
    );
  }

  if (page === 'group') return (
    <div>
      {header('Group by')}
      <button onClick={() => onPatchView({ groupBy: undefined, subGroupBy: undefined })} className={cn('zb-press', POP_ROW)}>
        <span style={{ flex: 1 }}>None</span>
        {!view.groupBy && <Icon icon={Check} size={13} style={{ color: 'var(--ink-2)' }} />}
      </button>
      {groupable.map((p) => (
        <button key={p.id} onClick={() => onPatchView({ groupBy: p.id, ...(view.subGroupBy === p.id ? { subGroupBy: undefined } : {}) })} className={cn('zb-press', POP_ROW)}>
          <Icon icon={propIcon(p.type)} size={14} className="text-ink-600" />
          <span style={{ flex: 1 }}>{p.name}</span>
          {view.groupBy === p.id && <Icon icon={Check} size={13} style={{ color: 'var(--ink-2)' }} />}
        </button>
      ))}
      {groupable.length === 0 && <div className={cn(POP_ROW, 'cursor-default text-ink-500')}>No select/status/checkbox properties</div>}
      {view.groupBy && groupable.some((p) => p.id !== view.groupBy) && (
        <>
          <div style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--text-muted)', padding: '10px 8px 4px' }}>Then group by</div>
          <button onClick={() => onPatchView({ subGroupBy: undefined })} className={cn('zb-press', POP_ROW)}>
            <span style={{ flex: 1 }}>None</span>
            {!view.subGroupBy && <Icon icon={Check} size={13} style={{ color: 'var(--ink-2)' }} />}
          </button>
          {groupable.filter((p) => p.id !== view.groupBy).map((p) => (
            <button key={p.id} onClick={() => onPatchView({ subGroupBy: p.id })} className={cn('zb-press', POP_ROW)}>
              <Icon icon={propIcon(p.type)} size={14} className="text-ink-600" />
              <span style={{ flex: 1 }}>{p.name}</span>
              {view.subGroupBy === p.id && <Icon icon={Check} size={13} style={{ color: 'var(--ink-2)' }} />}
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
        {header('Conditional color')}
        {colorRules.map((r, i) => (
          <ColorRuleEditor key={i} rule={r} props={props}
            onChange={(patch) => setRules(colorRules.map((x, k) => (k === i ? { ...x, ...patch } : x)))}
            onRemove={() => setRules(colorRules.filter((_, k) => k !== i))} />
        ))}
        <button onClick={() => setRules([...colorRules, { prop: props[0].id, op: defaultOp(props[0].type), color: OPTION_COLORS[colorRules.length % OPTION_COLORS.length] }])} className={cn('zb-press', POP_ROW, 'text-ink-600')}>
          <Icon icon={Plus} size={14} /> Add rule
        </button>
        {colorRules.length === 0 && <div className={cn(POP_ROW, 'cursor-default leading-snug text-ink-500')}>Rows paint with the color of the first rule they match.</div>}
      </div>
    );
  }

  // root
  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#view-${view.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };
  return (
    <div>
      <input aria-label="View name" value={view.name} onChange={(e) => onPatchView({ name: e.target.value })}
        autoComplete="off" data-1p-ignore data-lpignore="true"
        style={{ width: '100%', height: 30, border: 'none', outline: 'none', background: 'var(--paper)', borderRadius: 'var(--r-sm)', boxShadow: '0 0 0 1px var(--line)', fontSize: 'var(--text-small-size)', padding: '0 8px', color: 'var(--ink)', marginBottom: 6 }} />
      {navRow(TableIcon, 'Layout', VIEW_META.find((m) => m.kind === view.kind)?.label ?? 'Table', () => setPage('layout'))}
      {navRow(SlidersHorizontal, 'Properties', hidden.length ? `${hidden.length} hidden` : 'All shown', () => setPage('props'))}
      {navRow(ArrowDownUp, 'Sort', sorts.length ? String(sorts.length) : '', () => setPage('sort'))}
      {navRow(Layers, 'Group', groupName ?? '', () => setPage('group'))}
      {navRow(Paintbrush, 'Conditional color', colorRules.length ? String(colorRules.length) : '', () => setPage('color'))}
      <div aria-hidden style={{ height: 1, background: 'var(--line-2)', margin: '4px 2px' }} />
      <button onClick={copyLink} className={cn('zb-press', POP_ROW)}><Icon icon={LinkIcon} size={14} className="text-ink-600" /> Copy link to view</button>
    </div>
  );
}

function OptionChip({ opt }: { opt: SelectOption }) {
  const t = optionTokens(opt.color);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 8px', borderRadius: 'var(--r-xs)', background: t.bg, color: t.text, fontSize: 'var(--text-caption-size)', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {opt.name}
    </span>
  );
}

// ── Select / multi-select / status cell ──
function SelectCell({ prop, value, onValue, onCreateOption }: {
  prop: PropDef; value: unknown;
  onValue: (v: unknown) => void;
  onCreateOption: (name: string) => SelectOption;
}) {
  const [open, setOpen] = useState(false);
  const multi = prop.type === 'multi_select';
  const selected: string[] = multi ? (Array.isArray(value) ? value as string[] : []) : (value ? [value as string] : []);
  const uiOptions = (prop.options ?? []).map((o) => ({ value: o.id, label: o.name, dot: optionTokens(o.color).dot }));
  const pick = (id: string) => {
    if (multi) onValue(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else { onValue(selected[0] === id ? undefined : id); setOpen(false); }
  };
  const create = (name: string) => { const o = onCreateOption(name); pick(o.id); };
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button onClick={() => setOpen((v) => !v)} className="zb-db-cellbtn"
        style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minHeight: 32, padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap', borderRadius: 'var(--r-xs)' }}>
        {selected.length === 0
          ? <span style={{ fontSize: 'var(--text-body-size)', color: 'transparent' }}>·</span>
          : selected.map((id) => { const o = prop.options?.find((x) => x.id === id); return o ? <OptionChip key={id} opt={o} /> : null; })}
      </button>
      {open && (
        <Pop onClose={() => setOpen(false)}>
          <OptionList options={uiOptions} selected={selected} multi={multi} onPick={pick} onCreate={create} placeholder="Search or create…" />
        </Pop>
      )}
    </div>
  );
}

// ── Generic cell ──
const cellInput: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-size)', color: 'var(--ink)', padding: '0 8px', height: '100%' };

function Cell({ prop, row, onPatch, onCreateOption, allProps, isTitle }: {
  prop: PropDef; row: DbRow;
  onPatch: (patch: { title?: string; data?: Record<string, unknown> }) => void;
  onCreateOption: (propId: string, name: string) => SelectOption;
  allProps?: PropDef[]; // needed to evaluate computed properties
  isTitle?: boolean;
}) {
  const set = (v: unknown) => onPatch({ data: { ...row.data, [prop.id]: v } });
  // Computed properties (relation · rollup · formula) render read-only through
  // the engine; their editors arrive with the property-system phase.
  if (prop.type === 'relation' || prop.type === 'rollup' || prop.type === 'formula') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px', fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayValue(row, prop, allProps ?? [prop], resolveCollection)}
      </span>
    );
  }
  if (prop.type === 'title') {
    return <input value={row.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Untitled" autoComplete="off" data-1p-ignore data-lpignore="true"
      style={{ ...cellInput, fontWeight: 500 }} className="zb-db-title" />;
  }
  if (isSelectish(prop.type)) {
    return <SelectCell prop={prop} value={row.data[prop.id]} onValue={set} onCreateOption={(name) => onCreateOption(prop.id, name)} />;
  }
  if (prop.type === 'checkbox') {
    const on = !!row.data[prop.id];
    return (
      <button onClick={() => set(!on)} aria-label={prop.name} aria-pressed={on}
        style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16, borderRadius: 'var(--r-xs)', border: on ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: on ? 'var(--accent)' : 'transparent', transition: 'background var(--dur-fast) var(--ease)' }}>
          {on && <span style={{ color: 'var(--on-accent)', fontSize: 'var(--text-label-size)', lineHeight: 1 }}>✓</span>}
        </span>
      </button>
    );
  }
  if (prop.type === 'date') {
    const v = (row.data[prop.id] as string) ?? '';
    return (
      <label style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', height: '100%', cursor: 'pointer' }}>
        <span style={{ fontSize: 'var(--text-body-size)', color: v ? 'var(--ink)' : 'transparent', padding: '0 8px' }}>{v ? fmtCellDate(v) : '·'}</span>
        <input type="date" value={v} onChange={(e) => set(e.target.value || undefined)} aria-label={prop.name}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
    );
  }
  if (prop.type === 'created_time' || prop.type === 'updated_time') {
    return <span style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{fmtCellDate(prop.type === 'created_time' ? row.created_at : row.updated_at)}</span>;
  }
  const v = (row.data[prop.id] as string) ?? '';
  return (
    <span style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
      <input value={v} onChange={(e) => set(e.target.value || undefined)} autoComplete="off" data-1p-ignore data-lpignore="true" aria-label={prop.name}
        inputMode={prop.type === 'number' ? 'decimal' : prop.type === 'phone' ? 'tel' : undefined}
        style={{ ...cellInput, textAlign: prop.type === 'number' ? 'right' : 'left', fontVariantNumeric: 'tabular-nums' }} />
      {prop.type === 'url' && v && (
        <a href={/^https?:\/\//.test(v) ? v : 'https://' + v} target="_blank" rel="noreferrer" aria-label="Open link" className="zb-db-link"
          style={{ position: 'absolute', right: 4, display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 'var(--r-xs)', color: 'var(--text-secondary)', background: 'var(--paper-2)', opacity: 0, transition: 'opacity var(--dur-fast) var(--ease)' }}>
          <Icon icon={ExternalLink} size={12} />
        </a>
      )}
    </span>
  );
}

// ── Board card + column (dnd-kit) ──
function BoardCard({ row, props, hidden, bg }: { row: DbRow; props: PropDef[]; hidden: string[]; bg?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  const visible = props.filter((p) => p.type !== 'title' && !hidden.includes(p.id) && isSelectish(p.type) && row.data[p.id]);
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ background: bg ?? 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-crisp)', padding: '8px 10px', cursor: 'grab', opacity: isDragging ? 0.4 : 1, transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 5 : undefined, position: 'relative' }}>
      <div style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: row.title ? 'var(--ink)' : 'var(--text-muted)' }}>{row.title || 'Untitled'}</div>
      {visible.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {visible.map((p) => {
            const ids = Array.isArray(row.data[p.id]) ? row.data[p.id] as string[] : [row.data[p.id] as string];
            return ids.map((id) => { const o = p.options?.find((x) => x.id === id); return o ? <OptionChip key={p.id + id} opt={o} /> : null; });
          })}
        </div>
      )}
    </div>
  );
}
function BoardColumn({ id, label, chip, count, children, onAdd }: { id: string; label: string; chip?: SelectOption; count: number; children: React.ReactNode; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ width: 264, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 8, borderRadius: 'var(--r-lg)', background: isOver ? 'var(--hover)' : 'var(--paper-3)', transition: 'background var(--dur-fast) var(--ease)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px' }}>
        {chip ? <OptionChip opt={chip} /> : <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>}
        <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{count}</span>
      </div>
      {children}
      <button onClick={onAdd} className="zb-press" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', cursor: 'pointer', textAlign: 'left' }}>
        <Icon icon={Plus} size={14} /> New
      </button>
    </div>
  );
}

// ── The database surface ──
// Friendly error for the un-migrated case. Supabase phrases it two ways —
// "Could not find the table 'public.collections' in the schema cache" (REST)
// and "relation … does not exist" (SQL) — both mean 0013 isn't applied yet.
const dbErrMsg = (e: string) =>
  /relation .* does not exist|schema cache|could not find the table/i.test(e)
    ? 'Databases need migration 0013_databases.sql — paste it into the Supabase SQL editor to enable this.'
    : e;

function DbNote({ text, quiet }: { text: string; quiet?: boolean }) {
  return <div style={{ padding: '24px 8px', fontSize: 'var(--text-body-size)', color: quiet ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{text}</div>;
}

// Full-page database — a page of type 'database' hosts exactly one collection
// (auto-created on first open by getDatabase). Rendering goes through the
// shared store (lib/db-store), so this page and any inline/linked views of the
// same collection read and write the same live state.
export function DatabasePage({ pageId, demoDb }: { pageId: string; demoDb?: { collection: Collection; rows: DbRow[] } }) {
  const demoStore = useMemo(() => (demoDb ? seedStore(demoDb.collection, demoDb.rows, { demo: true }) : null), [demoDb]);
  const [store, setStore] = useState<DbStore | null>(demoStore);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (demoStore) return;
    (async () => {
      const res = await getDatabase(pageId);
      if ('error' in res) { setErr(dbErrMsg(res.error)); return; }
      setStore(seedStore(res.collection, res.rows));
    })();
  }, [pageId, demoStore]);

  if (err) return <DbNote text={err} />;
  if (!store) return <DbNote text="Loading database…" quiet />;
  return <DatabaseSurface key={store.getState().col.id} store={store} />;
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
  const row = (title: string, s: string, t: string[], i: number): DbRow => ({ id: 'demo-r' + i, title, data: { [status]: s, [tags]: t }, sort_index: i, created_at: now, updated_at: now });
  // A formula property so dev-preview exercises the engine's computed path.
  const props: PropDef[] = [...def.props, {
    id: 'fx', name: 'Label', type: 'formula',
    formula: { expr: 'if(prop("Status") == "in_progress", "Active", if(prop("Status") == "done", "Shipped", "Queued"))' },
  }];
  return {
    collection: { id: 'demo', page_id: null, name: 'Projects tracker', props, views: def.views },
    rows: [
      row('Design homepage', 'in_progress', ['tag_design'], 1),
      row('Fix billing bug', 'in_progress', ['tag_eng'], 2),
      row('Write launch post', 'not_started', ['tag_design'], 3),
      row('Ship onboarding', 'done', ['tag_eng'], 4),
    ],
  };
}

// Inline database block (Notion "Database — Inline"): a standalone collection
// mounted inside a document. colId is 'pending' while the slash action creates
// the collection, 'picker' while "Linked view" waits for a source, 'demo…' in
// dev-preview, or 'error:<msg>' if creation failed.
export function InlineCollection({ colId, onExpand, onPick }: {
  colId?: string;
  onExpand?: () => void;          // host: open this database as a full page
  onPick?: (colId: string) => void; // linked view: bind the block to a source
}) {
  const demo = !!colId?.startsWith('demo');
  const demoStore = useMemo(() => {
    if (!demo) return null;
    const d = demoInlineDb();
    return seedStore(d.collection, d.rows, { demo: true });
  }, [demo]);
  const [store, setStore] = useState<DbStore | null>(demoStore);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (demo || !colId || colId === 'pending' || colId === 'picker' || colId.startsWith('error:')) return;
    (async () => {
      const res = await getCollection(colId);
      if ('error' in res) { setErr(dbErrMsg(res.error)); return; }
      setStore(seedStore(res.collection, res.rows));
    })();
  }, [colId, demo]);

  if (colId === 'picker') return <LinkedDbPicker onPick={(id) => onPick?.(id)} />;
  const failure = colId?.startsWith('error:') ? dbErrMsg(colId.slice(6)) : err;
  if (failure) return <DbNote text={failure} />;
  if (!colId || colId === 'pending' || !store) return <DbNote text="Creating database…" quiet />;
  return (
    <div style={{ margin: '2px 0' }}>
      <InlineDbName store={store} />
      <DatabaseSurface key={store.getState().col.id} store={store} onExpand={onExpand} />
    </div>
  );
}

// "Linked view of database" source picker — replaces the block until a
// database is chosen; then the block binds to it and stays in sync.
function LinkedDbPicker({ onPick }: { onPick: (colId: string) => void }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ collections: { id: string; name: string; page_id: string | null }[] } | { error: string } | null>(null);
  useEffect(() => {
    listCollections()
      .then((res) => setState('error' in res ? { error: dbErrMsg(res.error) } : res))
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : 'Could not load databases.' }));
  }, []);
  const rows = state && 'collections' in state
    ? state.collections.filter((c) => !q.trim() || (c.name || 'Untitled').toLowerCase().includes(q.trim().toLowerCase()))
    : [];
  return (
    <div style={{ margin: '2px 0', background: 'var(--paper-2)', border: '1px solid var(--line-pop)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, maxWidth: 380 }}>
      <div style={{ fontSize: 'var(--text-micro-size)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', padding: '2px 4px 6px' }}>Link a database</div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search databases…"
        autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Search databases"
        style={{ width: '100%', height: 28, border: 'none', outline: 'none', background: 'var(--paper)', borderRadius: 'var(--r-sm)', boxShadow: '0 0 0 1px var(--line)', fontSize: 'var(--text-small-size)', padding: '0 8px', color: 'var(--ink)', marginBottom: 4 }} />
      {!state && <DbNote text="Loading databases…" quiet />}
      {state && 'error' in state && <DbNote text={state.error} />}
      {state && 'collections' in state && rows.length === 0 && <DbNote text={q.trim() ? 'No databases match.' : 'No databases yet — create one with /database.'} quiet />}
      {rows.map((c) => (
        <button key={c.id} onClick={() => onPick(c.id)} className={cn('zb-press', POP_ROW)}>
          <Icon icon={TableIcon} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Untitled'}</span>
          <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>{c.page_id ? 'Full page' : 'Inline'}</span>
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
      autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Database name"
      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-display)', fontSize: 'var(--text-h3-size)', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }} />
  );
}

// The shared database surface — view bar (views · search · properties · New),
// Table / Board / Gallery / List views, and the row peek. Used by the
// full-page database, inline blocks, and linked views: all of them subscribe
// to ONE store per collection, so an edit anywhere lands everywhere at once.
function DatabaseSurface({ store, onExpand }: { store: DbStore; onExpand?: () => void }) {
  const { col, rows } = useDbState(store);
  const [viewId, setViewId] = useState<string | null>(col.views[0]?.id ?? null);
  const [headMenu, setHeadMenu] = useState<string | null>(null); // prop id
  const [typeMenu, setTypeMenu] = useState(false); // header menu showing the retype list
  const [addOpen, setAddOpen] = useState(false);
  const [rename, setRename] = useState('');
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [propsOpen, setPropsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false); // property picker
  const [chipEdit, setChipEdit] = useState<number | null>(null); // editing rule index
  const [settingsOpen, setSettingsOpen] = useState(false); // view settings panel
  const [peekId, setPeekId] = useState<string | null>(null);

  const view = col.views.find((v) => v.id === viewId) ?? col.views[0];
  const hidden = view?.hidden ?? [];
  const shown = col.props.filter((p) => !hidden.includes(p.id));
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
  const peek = peekId ? rows.find((r) => r.id === peekId) ?? null : null;

  // ── ops — every mutation routes through the engine store (optimistic,
  //    autosaved, undoable, and instantly visible to every other view) ──
  const patchCol = (patch: Partial<Pick<Collection, 'props' | 'views' | 'name'>>) => store.patchCol(patch);
  const patchView = (vp: Partial<ViewDef>) => {
    if (!view) return;
    patchCol({ views: col.views.map((v) => (v.id === view.id ? { ...v, ...vp } : v)) });
  };
  const patchRow = (id: string, patch: { title?: string; data?: Record<string, unknown> }) => store.patchRow(id, patch);
  const addRow = (data: Record<string, unknown> = {}) => store.addRow({ data });
  const removeRow = (id: string) => store.removeRow(id);
  const addProp = (type: PropType) => {
    const meta = PROP_META.find((m) => m.type === type)!;
    const p: PropDef = { id: genId(), name: meta.label, type, ...(isSelectish(type) ? { options: [] } : {}) };
    patchCol({ props: [...col.props, p] });
    setAddOpen(false);
  };
  const createOption = (propId: string, name: string): SelectOption => {
    const p = col.props.find((x) => x.id === propId)!;
    const o: SelectOption = { id: genId(), name, color: nextColor(p.options?.length ?? 0) };
    patchCol({ props: col.props.map((x) => (x.id === propId ? { ...x, options: [...(x.options ?? []), o] } : x)) });
    return o;
  };
  const addView = (kind: ViewDef['kind']) => {
    const v: ViewDef = { id: genId(), name: VIEW_META.find((m) => m.kind === kind)?.label ?? 'View', kind };
    patchCol({ views: [...col.views, v] });
    setViewId(v.id);
  };

  // ── Filters (§9.4): flat AND across chips; each chip is one FilterRule ──
  const rules: FilterRule[] = (view?.filter?.rules.filter((r) => !isFilterGroup(r)) as FilterRule[]) ?? [];
  const setRules = (next: FilterRule[]) => patchView({ filter: next.length ? { logic: 'and', rules: next } : undefined });
  const addRule = (propId: string) => {
    const p = col.props.find((x) => x.id === propId); if (!p) return;
    setRules([...rules, { prop: propId, op: defaultOp(p.type), ...(p.type === 'checkbox' ? { value: true } : {}) }]);
    setFilterOpen(false); setChipEdit(rules.length);
  };
  const editRule = (i: number, patch: Partial<FilterRule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) => { setRules(rules.filter((_, k) => k !== i)); setChipEdit(null); };
  // Column-header sort (§9.2): add to the view's sort list, or update this
  // property's direction if it's already a sort level (keeps multi-sort intact).
  const sortBy = (propId: string, dir: 'asc' | 'desc') => {
    const cur = view?.sorts ?? [];
    patchView({ sorts: cur.some((s) => s.prop === propId) ? cur.map((s) => (s.prop === propId ? { ...s, dir } : s)) : [...cur, { prop: propId, dir }] });
  };

  const widths = view?.widths ?? {};
  const colWidth = (p: PropDef) => widths[p.id] ?? (p.type === 'title' ? 260 : 170);
  const groupProp = view?.kind === 'board'
    ? col.props.find((p) => p.id === view.groupBy) ?? col.props.find((p) => p.type === 'status' || p.type === 'select')
    : undefined;

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
    if (!prop || key === '__none__') return {};
    if (prop.type === 'checkbox') return { [prop.id]: key === 'true' };
    return { [prop.id]: prop.type === 'multi_select' ? [key] : key };
  };
  const groupPreset = (key: string) => presetForProp(tableGroupProp, key);
  const subGroupPreset = (key: string, subKey: string) => ({ ...presetForProp(tableGroupProp, key), ...presetForProp(tableSubProp, subKey) });

  // One data row (shared by the flat and grouped table bodies).
  const renderTableRow = (r: DbRow) => (
    <div key={r.id} className="zb-db-row" style={{ display: 'flex', alignItems: 'stretch', minHeight: 40, borderBottom: '1px solid var(--line-2)', background: colorBg(r) }}>
      {shown.map((p) => (
        <div key={p.id} style={{ position: 'relative', width: colWidth(p), flexShrink: 0, borderRight: '1px solid var(--line-2)', display: 'flex', alignItems: 'center' }}>
          <Cell prop={p} row={r} onPatch={(patch) => patchRow(r.id, patch)} onCreateOption={createOption} allProps={col.props} />
          {p.type === 'title' && (
            /* Notion's hover OPEN pill — every row is a page */
            <button onClick={() => setPeekId(r.id)} className="zb-db-open" aria-label="Open row" title="Open"
              style={{ position: 'absolute', right: 6, display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--paper-2)', boxShadow: 'var(--shadow-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-label-size)', fontWeight: 500, letterSpacing: '0.02em', cursor: 'pointer', opacity: 0, transition: 'opacity var(--dur-fast) var(--ease)' }}>
              <Icon icon={Maximize2} size={12} /> OPEN
            </button>
          )}
        </div>
      ))}
      <div style={{ width: 40, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <button onClick={() => removeRow(r.id)} aria-label="Delete row" title="Delete row" className="zb-db-del"
          style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: 'var(--r-xs)', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0, transition: 'opacity var(--dur-fast) var(--ease)' }}>
          <Icon icon={Trash2} size={14} />
        </button>
      </div>
    </div>
  );

  // The "+ New" affordance at the foot of a body (optionally presets a group value).
  const newRowButton = (preset: Record<string, unknown> = {}, key?: string) => (
    <button key={key} onClick={() => addRow(preset)} className="zb-press"
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 36, padding: '0 8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', cursor: 'pointer', textAlign: 'left' }}>
      <Icon icon={Plus} size={14} /> New
    </button>
  );

  // A grouped section header: caret + option chip (or label) + row count. `key`
  // is the collapse key (composite for subgroups); `level` indents nested rows.
  const renderGroupHeader = (g: RowGroup, key: string = g.key, level = 0) => (
    <button onClick={() => toggleCollapsed(key)} aria-expanded={!isCollapsed(key)} className="zb-press"
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: level ? 34 : 40, padding: '0 8px', paddingLeft: 8 + level * 20, border: 'none', borderBottom: '1px solid var(--line-2)', background: level ? 'var(--paper)' : 'var(--paper-2)', cursor: 'pointer', textAlign: 'left', position: 'sticky', left: 0 }}>
      <Icon icon={ChevronRight} size={13} weight="bold" style={{ color: 'var(--text-muted)', transition: 'transform var(--dur-fast) var(--ease)', transform: isCollapsed(key) ? 'none' : 'rotate(90deg)' }} />
      {g.option ? <OptionChip opt={g.option} /> : <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--text-muted)' }}>{g.label}</span>}
      <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontWeight: 500 }}>{g.rows.length}</span>
    </button>
  );

  return (
    // Database-scoped undo/redo: ⌘Z inside the surface undoes database ops
    // through the engine store (and never leaks into the document editor —
    // data-db-surface tells host editors to yield keys typed in here).
    <div data-db-surface style={{ marginTop: 8 }} onKeyDownCapture={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) store.redo(); else store.undo();
      }
    }}>
      {/* View bar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Tabs
          aria-label="Database views"
          items={col.views.map((v) => ({ value: v.id, label: v.name, icon: viewIcon(v.kind) }))}
          value={view?.id ?? ''} onValueChange={(id) => setViewId(id)} className="min-w-0" />
        <div className="relative">
          <IconButton size="sm" label="Add view" icon={<Icon icon={Plus} size={14} />} onClick={() => setAddOpen(addOpen ? false : true)} />
          {addOpen && (
            <Pop onClose={() => setAddOpen(false)} width={190}>
              {VIEW_META.map((m) => (
                <button key={m.kind} onClick={() => { addView(m.kind); setAddOpen(false); }} className={cn('zb-press', POP_ROW)}>
                  <Icon icon={m.icon} size={14} className="text-ink-600" />
                  {m.label}
                </button>
              ))}
            </Pop>
          )}
        </div>
        <span className="flex-1" />
        {/* Search — quiet icon that expands into an underline input */}
        {searching ? (
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setSearching(false); } }}
            onBlur={() => { if (!q.trim()) setSearching(false); }}
            placeholder="Search…" autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Search rows"
            className="h-[26px] w-40 border-0 border-b border-line-strong bg-transparent px-0.5 text-meta text-ink-900 outline-none" />
        ) : (
          <IconButton size="sm" label="Search" icon={<Icon icon={Search} size={14} />} onClick={() => setSearching(true)} />
        )}
        {/* Filter — quick property picker → adds a filter chip (§9.4) */}
        <div className="relative">
          <IconButton size="sm" label="Filter" selected={filterOpen || rules.length > 0} aria-expanded={filterOpen} icon={<Icon icon={Filter} size={14} />} onClick={() => setFilterOpen((v) => !v)} />
          {filterOpen && (
            <Pop onClose={() => setFilterOpen(false)} right width={220}>
              <div className="px-2 pb-1.5 pt-0.5 text-caption font-semibold text-ink-500">Filter by…</div>
              {col.props.map((p) => (
                <button key={p.id} onClick={() => addRule(p.id)} className={cn('zb-press', POP_ROW)}>
                  <Icon icon={propIcon(p.type)} size={14} className="text-ink-600" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </button>
              ))}
            </Pop>
          )}
        </div>
        {/* Properties — show/hide per view */}
        <div className="relative">
          <IconButton size="sm" label="Properties" selected={propsOpen} aria-expanded={propsOpen} icon={<Icon icon={Eye} size={14} />} onClick={() => setPropsOpen((v) => !v)} />
          {propsOpen && (
            <Pop onClose={() => setPropsOpen(false)} right>
              {col.props.filter((p) => p.type !== 'title').map((p) => {
                const off = hidden.includes(p.id);
                return (
                  <button key={p.id} onClick={() => patchView({ hidden: off ? hidden.filter((h) => h !== p.id) : [...hidden, p.id] })} className={cn('zb-press', POP_ROW)}>
                    <Icon icon={propIcon(p.type)} size={14} className="text-ink-600" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <Icon icon={off ? EyeOff : Eye} size={14} className={off ? 'text-ink-500' : 'text-ink-800'} />
                  </button>
                );
              })}
            </Pop>
          )}
        </div>
        {/* View settings — the consolidated panel (§9.3) */}
        <div className="relative">
          <IconButton size="sm" label="View settings" selected={settingsOpen} aria-expanded={settingsOpen} icon={<Icon icon={SlidersHorizontal} size={14} />} onClick={() => setSettingsOpen((v) => !v)} />
          {settingsOpen && view && (
            <Pop onClose={() => setSettingsOpen(false)} right width={248}>
              <ViewSettings view={view} props={col.props} onPatchView={patchView} onPatchCol={patchCol} />
            </Pop>
          )}
        </div>
        {onExpand && (
          <IconButton size="sm" label="Open as full page" icon={<Icon icon={Maximize2} size={14} />} onClick={onExpand} />
        )}
        <Button variant="primary" size="sm" icon={Plus} onClick={() => addRow(groupProp ? {} : {})}>New</Button>
      </div>

      {/* ── Filter chips (§9.4): one chip per rule; click to edit, ⋯ to remove ── */}
      {rules.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {rules.map((rule, i) => {
            const p = col.props.find((x) => x.id === rule.prop);
            if (!p) return null;
            return (
              <div key={i} style={{ position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', height: 26, borderRadius: 'var(--r-sm)', background: 'var(--paper-3)', border: '1px solid var(--line-2)', overflow: 'hidden' }}>
                  <button onClick={() => setChipEdit(chipEdit === i ? null : i)} className="zb-press"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%', padding: '0 4px 0 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--ink-2)', maxWidth: 220 }}>
                    <Icon icon={propIcon(p.type)} size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chipSummary(rule, p)}</span>
                  </button>
                  <button onClick={() => removeRule(i)} aria-label="Remove filter" className="zb-press"
                    style={{ display: 'grid', placeItems: 'center', width: 20, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <Icon icon={X} size={11} />
                  </button>
                </div>
                {chipEdit === i && (
                  <Pop onClose={() => setChipEdit(null)} width={230}>
                    <FilterCondition rule={rule} prop={p} onChange={(patch) => editRule(i, patch)} onRemove={() => removeRule(i)} />
                  </Pop>
                )}
              </div>
            );
          })}
          {/* + Add filter chip persists at the end of the row */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setFilterOpen(true)} className="zb-press"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px dashed var(--line-3)', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>
              <Icon icon={Plus} size={12} /> Add filter
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {view?.kind === 'table' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)' }}>
          <div style={{ minWidth: 'max-content' }}>
            {/* header */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line-2)', background: 'var(--paper-2)' }}>
              {shown.map((p) => (
                <div key={p.id} style={{ position: 'relative', width: colWidth(p), flexShrink: 0, borderRight: '1px solid var(--line-2)' }}>
                  <button onClick={() => { setHeadMenu(headMenu === p.id ? null : p.id); setTypeMenu(false); setRename(p.name); }} className="zb-press"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 36, padding: '0 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: 0 }}>
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
                  </button>
                  {headMenu === p.id && (
                    <Pop onClose={() => { setHeadMenu(null); setTypeMenu(false); }}>
                      {typeMenu ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 2px 6px' }}>
                            <button onClick={() => setTypeMenu(false)} aria-label="Back" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 'var(--r-xs)' }}><Icon icon={ArrowLeft} size={14} /></button>
                            <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--ink-2)' }}>Property type</span>
                          </div>
                          {PROP_META.filter((m) => RETYPEABLE.includes(m.type)).map((m) => (
                            <button key={m.type} onClick={() => { store.retypeProp(p.id, m.type); setTypeMenu(false); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}>
                              <Icon icon={m.icon} size={14} className="text-ink-600" />
                              <span style={{ flex: 1 }}>{m.label}</span>
                              {p.type === m.type && <Icon icon={Check} size={13} style={{ color: 'var(--ink-2)' }} />}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          <input value={rename} onChange={(e) => setRename(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { patchCol({ props: col.props.map((x) => (x.id === p.id ? { ...x, name: rename.trim() || x.name } : x)) }); setHeadMenu(null); } }}
                            onBlur={() => { if (rename.trim() && rename !== p.name) patchCol({ props: col.props.map((x) => (x.id === p.id ? { ...x, name: rename.trim() } : x)) }); }}
                            autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Property name"
                            style={{ width: '100%', height: 28, border: 'none', outline: 'none', background: 'var(--paper)', borderRadius: 'var(--r-sm)', boxShadow: '0 0 0 1px var(--line)', fontSize: 'var(--text-small-size)', padding: '0 8px', color: 'var(--ink)', marginBottom: 4 }} />
                          {RETYPEABLE.includes(p.type) && (
                            <button onClick={() => setTypeMenu(true)} className={cn('zb-press', POP_ROW)}>
                              <Icon icon={propIcon(p.type)} size={14} className="text-ink-600" />
                              <span style={{ flex: 1 }}>Type</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 'var(--text-caption-size)' }}>{PROP_META.find((m) => m.type === p.type)?.label ?? p.type}<Icon icon={ChevronRight} size={12} /></span>
                            </button>
                          )}
                          <button onClick={() => { sortBy(p.id, 'asc'); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={ArrowUp} size={14} className="text-ink-600" /> Sort ascending</button>
                          <button onClick={() => { sortBy(p.id, 'desc'); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={ArrowDown} size={14} className="text-ink-600" /> Sort descending</button>
                          {view.sorts?.length ? <button onClick={() => { patchView({ sorts: [] }); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={History} size={14} className="text-ink-600" /> Clear sort</button> : null}
                          <button onClick={() => { addRule(p.id); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={Filter} size={14} className="text-ink-600" /> Filter by this property</button>
                          {p.type !== 'title' && (
                            <>
                              <div aria-hidden style={{ height: 1, background: 'var(--line-2)', margin: '4px 0' }} />
                              <button onClick={() => { patchView({ hidden: [...hidden, p.id] }); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}><Icon icon={EyeOff} size={14} className="text-ink-600" /> Hide in view</button>
                              <button onClick={() => { patchCol({ props: col.props.filter((x) => x.id !== p.id) }); setHeadMenu(null); }} className={cn('zb-press', POP_ROW, 'text-danger-600')}><Icon icon={Trash2} size={14} /> Delete property</button>
                            </>
                          )}
                        </>
                      )}
                    </Pop>
                  )}
                </div>
              ))}
              {/* add property */}
              <div style={{ position: 'relative', width: 40, flexShrink: 0 }}>
                <button onClick={() => { setAddOpen(false); setHeadMenu(headMenu === '+' ? null : '+'); }} aria-label="Add property" title="Add property" className="zb-press"
                  style={{ display: 'grid', placeItems: 'center', width: '100%', height: 36, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Icon icon={Plus} size={14} />
                </button>
                {headMenu === '+' && (
                  <Pop onClose={() => setHeadMenu(null)} right>
                    {PROP_META.map((m) => (
                      <button key={m.type} onClick={() => { addProp(m.type); setHeadMenu(null); }} className={cn('zb-press', POP_ROW)}>
                        <Icon icon={m.icon} size={14} className="text-ink-600" /> {m.label}
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
                    {renderGroupHeader(g)}
                    {!isCollapsed(g.key) && (
                      g.subgroups
                        ? g.subgroups.map((sg) => {
                            const ck = `${g.key}::${sg.key}`;
                            return (
                              <div key={ck}>
                                {renderGroupHeader(sg, ck, 1)}
                                {!isCollapsed(ck) && (
                                  <>
                                    {sg.rows.map((r) => renderTableRow(r))}
                                    {newRowButton(subGroupPreset(g.key, sg.key), `new-${ck}`)}
                                  </>
                                )}
                              </div>
                            );
                          })
                        : (
                          <>
                            {g.rows.map((r) => renderTableRow(r))}
                            {newRowButton(groupPreset(g.key), `new-${g.key}`)}
                          </>
                        )
                    )}
                  </div>
                ))
              : (
                <>
                  {visible.map((r) => renderTableRow(r))}
                  {/* new row */}
                  {newRowButton()}
                </>
              )}
          </div>
        </div>
      )}

      {/* ── Board ── */}
      {view?.kind === 'board' && (groupProp ? (
        <DndContext onDragEnd={(e: DragEndEvent) => {
          const rowId = String(e.active.id); const colId = e.over ? String(e.over.id) : null;
          if (!colId) return;
          const r = rows.find((x) => x.id === rowId); if (!r) return;
          const val = colId === '__none__' ? undefined : colId;
          patchRow(rowId, { data: { ...r.data, [groupProp.id]: groupProp.type === 'multi_select' ? (val ? [val] : []) : val } });
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
            {[...(groupProp.options ?? []), null].map((opt) => {
              const key = opt ? opt.id : '__none__';
              const inCol = visible.filter((r) => {
                const v = r.data[groupProp.id];
                const ids = Array.isArray(v) ? v : v ? [v] : [];
                return opt ? ids.includes(opt.id) : ids.length === 0;
              });
              return (
                <BoardColumn key={key} id={key} label={opt ? opt.name : `No ${groupProp.name}`} chip={opt ?? undefined} count={inCol.length}
                  onAdd={() => addRow(opt ? { [groupProp.id]: groupProp.type === 'multi_select' ? [opt.id] : opt.id } : {})}>
                  {inCol.map((r) => <BoardCard key={r.id} row={r} props={col.props} hidden={hidden} bg={colorBg(r)} />)}
                </BoardColumn>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <div style={{ padding: '24px 8px', fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)' }}>Add a Select or Status property to group this board.</div>
      ))}

      {/* ── Gallery ── */}
      {view?.kind === 'gallery' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {visible.map((r) => (
            <div key={r.id} onClick={() => setPeekId(r.id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setPeekId(r.id); }}
              style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-crisp)', padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ fontSize: 'var(--text-body-size)', fontWeight: 500, color: r.title ? 'var(--ink)' : 'var(--text-muted)', marginBottom: 8 }}>{r.title || 'Untitled'}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {col.props.filter((p) => isSelectish(p.type) && !hidden.includes(p.id)).map((p) => {
                  const v = r.data[p.id];
                  const ids = Array.isArray(v) ? v as string[] : v ? [v as string] : [];
                  return ids.map((id) => { const o = p.options?.find((x) => x.id === id); return o ? <OptionChip key={p.id + id} opt={o} /> : null; });
                })}
              </div>
            </div>
          ))}
          <button onClick={() => addRow()} className="zb-press" style={{ display: 'grid', placeItems: 'center', minHeight: 72, border: '1px dashed var(--line-3)', background: 'transparent', borderRadius: 'var(--r-lg)', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', cursor: 'pointer' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon icon={Plus} size={14} /> New</span>
          </button>
        </div>
      )}

      {/* ── List ── */}
      {view?.kind === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map((r) => (
            <button key={r.id} onClick={() => setPeekId(r.id)} className="zb-press" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 34, padding: '5px 8px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left' }}>
              <Icon icon={FileText} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-body-size)', fontWeight: 500, color: r.title ? 'var(--ink)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || 'Untitled'}</span>
              {col.props.filter((p) => isSelectish(p.type) && !hidden.includes(p.id)).map((p) => {
                const v = r.data[p.id];
                const ids = Array.isArray(v) ? v as string[] : v ? [v as string] : [];
                return ids.map((x) => { const o = p.options?.find((oo) => oo.id === x); return o ? <OptionChip key={p.id + x} opt={o} /> : null; });
              })}
            </button>
          ))}
          <button onClick={() => addRow()} className="zb-press" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 8px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', cursor: 'pointer', textAlign: 'left' }}>
            <Icon icon={Plus} size={14} /> New
          </button>
        </div>
      )}

      {/* Row peek — the row as a page */}
      {peek && (
        <RowPeek row={peek} col={col} onClose={() => setPeekId(null)}
          onPatch={(patch) => patchRow(peek.id, patch)}
          onDelete={() => { removeRow(peek.id); setPeekId(null); }}
          onCreateOption={createOption} />
      )}

      <style>{`
        .zb-db-row:hover { background: color-mix(in srgb, var(--ink) 2%, transparent); }
        .zb-db-row:hover .zb-db-del { opacity: 1; }
        .zb-db-row:hover .zb-db-link { opacity: 1; }
        .zb-db-row:hover .zb-db-open { opacity: 1; }
        .zb-db-title::placeholder { color: var(--text-muted); }
      `}</style>
    </div>
  );
}

// ── Row peek — every database row is a page (Notion): title, properties,
// created/updated metadata, and its own block canvas persisted in
// row.data.__content (plain JSONB — no schema change). The editor is loaded
// dynamically to keep block-editor ⇄ database-view imports acyclic.
const BlockEditorLazy = dynamic(() => import('./block-editor').then((m) => ({ default: m.BlockEditor })), { ssr: false });

function RowPeek({ row, col, onPatch, onDelete, onClose, onCreateOption }: {
  row: DbRow; col: Collection;
  onPatch: (patch: { title?: string; data?: Record<string, unknown> }) => void;
  onDelete: () => void; onClose: () => void;
  onCreateOption: (propId: string, name: string) => SelectOption;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(row.data.__content));
  const skip = useRef(true);
  const rowRef = useRef(row);
  useEffect(() => { rowRef.current = row; }, [row]);

  // Debounced content save — merged into row.data so cells stay untouched.
  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    const t = setTimeout(() => onPatch({ data: { ...rowRef.current.data, __content: serialize(blocks) } }), 500);
    return () => clearTimeout(t);
  }, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)', display: 'flex', justifyContent: 'flex-end', animation: 'fadein 140ms' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(600px, 100%)', height: '100%', background: 'var(--paper-2)', borderLeft: '1px solid var(--line)', boxShadow: 'var(--shadow-xl)', overflowY: 'auto', animation: 'slideIn 200ms' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 12px', background: 'var(--paper-2)', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ flex: 1 }} />
          <button onClick={onDelete} aria-label="Delete row" title="Delete" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Icon icon={Trash2} size={16} /></button>
          <button onClick={onClose} aria-label="Close" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Icon icon={X} size={16} /></button>
        </div>
        <div style={{ padding: '28px 56px 80px' }}>
          <input value={row.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Untitled" autoComplete="off" data-1p-ignore data-lpignore="true" aria-label="Row title"
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1-size)', fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--ink)', marginBottom: 14 }} />
          {/* Properties — label + the same cells the table uses */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 6 }}>
            {col.props.filter((p) => p.type !== 'title').map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', minHeight: 34 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 140, flexShrink: 0, fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>
                  <Icon icon={propIcon(p.type)} size={14} style={{ color: 'var(--text-muted)' }} />{p.name}
                </span>
                <div style={{ flex: 1, minWidth: 0, marginLeft: -8 }}><Cell prop={p} row={row} onPatch={onPatch} onCreateOption={onCreateOption} allProps={col.props} /></div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 30, fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>
              <span style={{ width: 140, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon icon={History} size={14} />Created</span>{fmtCellDate(row.created_at)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 30, fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>
              <span style={{ width: 140, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon icon={Clock} size={14} />Updated</span>{fmtCellDate(row.updated_at)}
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--line-2)', margin: '14px 0 18px' }} />
          <BlockEditorLazy blocks={blocks} onChange={setBlocks} />
        </div>
      </div>
    </div>
  );
}
