'use client';
// Document properties — the Notion-style property system in the Zenboard design
// language (measured from the "Add a property" HiFi, minus the AI features):
//   · a typed property row: type glyph · name · value editor
//   · "Add a property" → PropertyEditor popover: name field + searchable type
//     list (Basic / Advanced groups)
//   · click a property name → rename · change type · delete
//   · per-type value editors: text/number/url/email/phone/place · checkbox ·
//     date · select / status / multi-select (with create) · read-only computed
//     (created/edited time & by, id) · person
// Persisted inside the page content JSON (see documents-view · DocMeta).
// Styling is DS-token driven (Tailwind utilities); the only inline styles left
// are user/option colours (palette) — the sanctioned escape hatch.
import { useEffect, useRef, useState } from 'react';
import {
  AlignLeft, Hash, CircleChevronDown, List, CircleDashed, Calendar, Users, Paperclip, SquareCheck, Link2, AtSign, Phone, SquareFunction as FormulaIcon, ArrowUpRight, Search, Clock, CircleUser, MousePointerClick, MapPin, Fingerprint, Plus, Check, Trash2, X, type IconType } from "@/components/ds/icons";
import { Icon, Checkbox, TextInput } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { PALETTE_NAMES, palette, type PaletteName } from '@/lib/palette';

export type PropType =
  | 'text' | 'number' | 'select' | 'multi_select' | 'status' | 'date' | 'person'
  | 'files' | 'checkbox' | 'url' | 'email' | 'phone' | 'formula' | 'relation'
  | 'rollup' | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by'
  | 'button' | 'place' | 'id';

export type PropOption = { id: string; label: string; color: PaletteName };
export type DocProp = {
  id: string; name: string; type: PropType;
  value?: string;          // text-likes + date (ISO)
  checked?: boolean;       // checkbox
  options?: PropOption[];  // select / multi_select / status definitions
  selected?: string[];     // chosen option ids
};

type TypeDef = { type: PropType; label: string; icon: IconType; group: 'Basic' | 'Advanced' };
export const PROP_TYPES: TypeDef[] = [
  { type: 'text', label: 'Text', icon: AlignLeft, group: 'Basic' },
  { type: 'number', label: 'Number', icon: Hash, group: 'Basic' },
  { type: 'select', label: 'Select', icon: CircleChevronDown, group: 'Basic' },
  { type: 'multi_select', label: 'Multi-select', icon: List, group: 'Basic' },
  { type: 'status', label: 'Status', icon: CircleDashed, group: 'Basic' },
  { type: 'date', label: 'Date', icon: Calendar, group: 'Basic' },
  { type: 'person', label: 'Person', icon: Users, group: 'Basic' },
  { type: 'files', label: 'Files & media', icon: Paperclip, group: 'Basic' },
  { type: 'checkbox', label: 'Checkbox', icon: SquareCheck, group: 'Basic' },
  { type: 'url', label: 'URL', icon: Link2, group: 'Basic' },
  { type: 'email', label: 'Email', icon: AtSign, group: 'Basic' },
  { type: 'phone', label: 'Phone', icon: Phone, group: 'Basic' },
  { type: 'formula', label: 'Formula', icon: FormulaIcon, group: 'Advanced' },
  { type: 'relation', label: 'Relation', icon: ArrowUpRight, group: 'Advanced' },
  { type: 'rollup', label: 'Rollup', icon: Search, group: 'Advanced' },
  { type: 'created_time', label: 'Created time', icon: Clock, group: 'Advanced' },
  { type: 'created_by', label: 'Created by', icon: CircleUser, group: 'Advanced' },
  { type: 'last_edited_time', label: 'Last edited time', icon: Clock, group: 'Advanced' },
  { type: 'last_edited_by', label: 'Last edited by', icon: CircleUser, group: 'Advanced' },
  { type: 'button', label: 'Button', icon: MousePointerClick, group: 'Advanced' },
  { type: 'place', label: 'Place', icon: MapPin, group: 'Advanced' },
  { type: 'id', label: 'ID', icon: Fingerprint, group: 'Advanced' },
];
const TYPE = Object.fromEntries(PROP_TYPES.map((t) => [t.type, t])) as Record<PropType, TypeDef>;
export const propIcon = (t: PropType) => (TYPE[t] ?? TYPE.text).icon;
export const propLabel = (t: PropType) => (TYPE[t] ?? TYPE.text).label;

const COMPUTED = new Set<PropType>(['created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'id']);
const OPTIONED = new Set<PropType>(['select', 'multi_select', 'status']);

// One elevation for every property popover (menus/dropdowns lift · §4). Width is
// per-popover geometry, so it stays inline.
const PANEL = 'absolute left-0 top-[calc(100%+4px)] z-[60] rounded-lg border border-line-strong bg-surface-raised p-2 shadow-lift-2 [animation:zb-pop-in_var(--dur-base)_var(--ease-out)]';

export type PropContext = { userName: string; createdAt?: string; updatedAt?: string; pageId: string };

// ── Public: the property list (rows + Add a property) ────────────────────────
export function PropertyList({ props, onChange, ctx }: {
  props: DocProp[]; onChange: (next: DocProp[]) => void; ctx: PropContext;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const patch = (id: string, p: Partial<DocProp>) => onChange(props.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id: string) => onChange(props.filter((x) => x.id !== id));
  const add = (name: string, type: PropType) => {
    const prop: DocProp = { id: 'p' + Date.now().toString(36), name: name.trim() || propLabel(type), type };
    if (type === 'checkbox') prop.checked = false;
    if (OPTIONED.has(type)) { prop.options = []; prop.selected = []; }
    onChange([...props, prop]);
    setAddOpen(false);
  };
  return (
    <div className="flex flex-col gap-0.5">
      {props.map((p) => <PropertyRow key={p.id} prop={p} ctx={ctx} onPatch={(x) => patch(p.id, x)} onRemove={() => remove(p.id)} />)}
      <span className="relative inline-flex">
        <button onClick={() => setAddOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={addOpen}
          className="doc-chipbtn -mx-1.5 inline-flex h-7 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-1.5 text-left text-ui text-ink-500">
          <Icon icon={Plus} size={14} /> Add a property
        </button>
        {addOpen && <PropertyEditor onClose={() => setAddOpen(false)} onPickType={(t, name) => add(name, t)} />}
      </span>
    </div>
  );
}

// ── One property row ─────────────────────────────────────────────────────────
function PropertyRow({ prop, ctx, onPatch, onRemove }: {
  prop: DocProp; ctx: PropContext; onPatch: (p: Partial<DocProp>) => void; onRemove: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const Glyph = propIcon(prop.type);
  return (
    <div className="doc-proprow flex min-h-7 items-start gap-2">
      <span className="relative inline-flex shrink-0">
        <button onClick={() => setEditOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={editOpen} title={propLabel(prop.type)}
          className="doc-chipbtn -mx-1.5 inline-flex h-7 min-w-[160px] max-w-[200px] cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-1.5 text-left text-ink-500">
          <Icon icon={Glyph} size={16} weight={COMPUTED.has(prop.type) ? 'fill' : 'regular'} className="shrink-0" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-ui text-ink-500">{prop.name || propLabel(prop.type)}</span>
        </button>
        {editOpen && (
          <PropertyEditor
            prop={prop} onClose={() => setEditOpen(false)}
            onRename={(name) => onPatch({ name })}
            onPickType={(t) => onPatch({ type: t, ...(t === 'checkbox' ? { checked: false } : {}), ...(OPTIONED.has(t) ? { options: prop.options ?? [], selected: [] } : {}) })}
            onDelete={() => { setEditOpen(false); onRemove(); }}
          />
        )}
      </span>
      <div className="prop-cell -mx-1.5 min-w-0 flex-1 px-1.5">
        <PropValue prop={prop} ctx={ctx} onPatch={onPatch} />
      </div>
    </div>
  );
}

// ── Value editors, dispatched by type ────────────────────────────────────────
const EMPTY = 'text-ui text-ink-500';
const QUIET_INPUT = 'prop-input w-full min-w-0 border-0 bg-transparent px-0 py-1 text-ui text-ink-800 outline-none';

function PropValue({ prop, ctx, onPatch }: { prop: DocProp; ctx: PropContext; onPatch: (p: Partial<DocProp>) => void }) {
  const t = prop.type;
  if (t === 'checkbox') {
    return (
      <Checkbox checked={!!prop.checked} onCheckedChange={() => onPatch({ checked: !prop.checked })} aria-label="Toggle" className="mt-1" />
    );
  }
  if (COMPUTED.has(t)) {
    const text =
      t === 'created_time' ? fmtDateTime(ctx.createdAt) :
      t === 'last_edited_time' ? fmtDateTime(ctx.updatedAt) :
      t === 'id' ? ctx.pageId.replace(/^tmp-/, '').slice(0, 8) :
      ctx.userName; // created_by / last_edited_by
    if (t === 'created_by' || t === 'last_edited_by') return <PersonValue name={ctx.userName} />;
    return <span className={cn(EMPTY, 'inline-block pt-1')}>{text}</span>;
  }
  if (t === 'person') return <PersonValue name={ctx.userName} />;
  if (t === 'date') return <DateValue value={prop.value} onChange={(v) => onPatch({ value: v })} />;
  if (OPTIONED.has(t)) return <OptionValue prop={prop} onPatch={onPatch} />;
  // text-likes
  const inputMode = t === 'number' ? 'numeric' : t === 'url' ? 'url' : t === 'email' ? 'email' : t === 'phone' ? 'tel' : 'text';
  const isLink = (t === 'url' || t === 'email') && !!prop.value?.trim();
  if (isLink) {
    const href = t === 'email' ? `mailto:${prop.value}` : (/^https?:\/\//i.test(prop.value!) ? prop.value! : `https://${prop.value}`);
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap pt-1 text-ui text-[var(--accent-text)] no-underline"
        onDoubleClick={(e) => { e.preventDefault(); }}>{prop.value}</a>
    );
  }
  return (
    <input value={prop.value ?? ''} onChange={(e) => onPatch({ value: e.target.value })} placeholder="Empty"
      inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']} autoComplete="off" data-1p-ignore data-lpignore="true"
      className={QUIET_INPUT} />
  );
}

function PersonValue({ name }: { name: string }) {
  const initial = (name || 'U').charAt(0).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 pt-[3px]">
      <span aria-hidden className="grid size-[18px] place-items-center rounded-full bg-surface-fill text-caption font-medium text-ink-600">{initial}</span>
      <span className="text-ui text-ink-800">{name}</span>
    </span>
  );
}

// ── Date value ───────────────────────────────────────────────────────────────
function DateValue({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, open, () => setOpen(false));
  return (
    <span ref={ref} className="relative inline-flex">
      <button onClick={() => setOpen((v) => !v)}
        className={cn('inline-flex cursor-pointer items-center border-0 bg-transparent pt-1 text-ui', value ? 'text-ink-800' : 'text-ink-500')}>
        {value ? fmtDate(value) : 'Empty'}
      </button>
      {open && (
        <span className={PANEL} style={{ width: 200 }}>
          <input type="date" autoFocus value={value ?? ''} onChange={(e) => { onChange(e.target.value); }}
            className="h-8 w-full rounded-sm border border-line-strong bg-surface-raised px-2 text-meta text-ink-900 outline-none [color-scheme:light_dark]" />
          {value && <button onClick={() => { onChange(''); setOpen(false); }} className="mt-1.5 h-7 w-full cursor-pointer rounded-sm border-0 bg-transparent px-1 text-left text-meta text-ink-600">Clear</button>}
        </span>
      )}
    </span>
  );
}

// ── Select / Status / Multi-select value + editor ────────────────────────────
function OptionValue({ prop, onPatch }: { prop: DocProp; onPatch: (p: Partial<DocProp>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, open, () => setOpen(false));
  const options = prop.options ?? [];
  const selected = prop.selected ?? [];
  const multi = prop.type === 'multi_select';
  const chosen = options.filter((o) => selected.includes(o.id));
  const toggle = (id: string) => {
    const next = multi ? (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]) : [id];
    onPatch({ selected: next });
    if (!multi) setOpen(false);
  };
  const create = (label: string) => {
    const color = PALETTE_NAMES[(options.length + 1) % PALETTE_NAMES.length];
    const opt: PropOption = { id: 'o' + Date.now().toString(36), label, color };
    const nextOpts = [...options, opt];
    onPatch({ options: nextOpts, selected: multi ? [...selected, opt.id] : [opt.id] });
    if (!multi) setOpen(false);
  };
  return (
    <span ref={ref} className="relative flex min-w-0">
      <button onClick={() => setOpen((v) => !v)} className="flex min-h-7 w-full cursor-pointer flex-wrap items-center gap-1 border-0 bg-transparent py-[3px] text-left">
        {chosen.length ? chosen.map((o) => <OptChip key={o.id} o={o} status={prop.type === 'status'} />) : <span className={EMPTY}>Empty</span>}
      </button>
      {open && <OptionEditor options={options} selected={selected} status={prop.type === 'status'} onToggle={toggle} onCreate={create}
        onRecolor={(id, color) => onPatch({ options: options.map((o) => (o.id === id ? { ...o, color } : o)) })}
        onDeleteOption={(id) => onPatch({ options: options.filter((o) => o.id !== id), selected: selected.filter((s) => s !== id) })} />}
    </span>
  );
}

function OptChip({ o, status }: { o: PropOption; status?: boolean }) {
  const c = palette(o.color);
  if (status) return (
    <span className="inline-flex items-center gap-1.5 text-caption leading-none text-ink-800">
      {/* Option colour is user content — the sanctioned inline escape. */}
      <span className="size-2 rounded-full" style={{ background: c.dot }} />{o.label}
    </span>
  );
  return <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full px-1.5 text-caption leading-none" style={{ background: c.bg, color: c.text }}>{o.label}</span>;
}

function OptionEditor({ options, selected, status, onToggle, onCreate, onRecolor, onDeleteOption }: {
  options: PropOption[]; selected: string[]; status?: boolean;
  onToggle: (id: string) => void; onCreate: (label: string) => void;
  onRecolor: (id: string, color: PaletteName) => void; onDeleteOption: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  const query = q.trim();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const exact = options.some((o) => o.label.toLowerCase() === query.toLowerCase());
  return (
    <span className={PANEL} style={{ width: 260 }}>
      <TextInput size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && query && !exact) onCreate(query); }}
        placeholder="Search for an option…" autoComplete="off" data-1p-ignore data-lpignore="true" />
      <div className="px-0.5 pt-2 pb-1 text-caption text-ink-500">Select an option{query && !exact ? ' or create one' : ''}</div>
      <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
        {filtered.map((o) => (
          <div key={o.id} className="doc-proprow flex items-center gap-1.5 rounded-sm">
            <button onClick={() => onToggle(o.id)} className="doc-row flex h-[30px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left">
              <OptChip o={o} status={status} />
              <span className="flex-1" />
              {selected.includes(o.id) && <span className="text-ink-600"><Icon icon={Check} size={14} /></span>}
            </button>
            <span className="relative inline-flex">
              <button onClick={() => setColorFor(colorFor === o.id ? null : o.id)} aria-label="Option color" className="doc-prop-x doc-chipbtn grid size-[22px] cursor-pointer place-items-center rounded-xs border-0 bg-transparent opacity-0">
                {/* User option colour. */}
                <span className="size-3 rounded-full" style={{ background: palette(o.color).dot }} />
              </button>
              {colorFor === o.id && (
                <span className={cn(PANEL, 'grid grid-cols-3 gap-1')} style={{ width: 120 }}>
                  {PALETTE_NAMES.map((n) => (
                    <button key={n} onClick={() => { onRecolor(o.id, n); setColorFor(null); }} title={n} className="grid size-[26px] cursor-pointer place-items-center rounded-xs border-0 bg-transparent">
                      <span className="size-4 rounded-full" style={{ background: palette(n).dot, boxShadow: o.color === n ? '0 0 0 2px var(--color-surface-raised), 0 0 0 3px var(--accent)' : 'none' }} />
                    </button>
                  ))}
                </span>
              )}
            </span>
            <button onClick={() => onDeleteOption(o.id)} aria-label="Delete option" className="doc-prop-x doc-chipbtn grid size-[22px] cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-500 opacity-0">
              <Icon icon={X} size={12} />
            </button>
          </div>
        ))}
        {query && !exact && (
          <button onClick={() => onCreate(query)} className="doc-row flex h-8 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-meta text-ink-600">
            <Icon icon={Plus} size={14} /> Create <span className="inline-flex h-5 items-center rounded-full px-1.5" style={{ background: palette(PALETTE_NAMES[(options.length + 1) % PALETTE_NAMES.length]).bg, color: palette(PALETTE_NAMES[(options.length + 1) % PALETTE_NAMES.length]).text }}>{query}</span>
          </button>
        )}
        {!filtered.length && !query && <div className="px-2 py-1 text-caption text-ink-500">Type to create an option</div>}
      </div>
    </span>
  );
}

// ── Add / edit property popover ──────────────────────────────────────────────
function PropertyEditor({ prop, onClose, onPickType, onRename, onDelete }: {
  prop?: DocProp; onClose: () => void;
  onPickType: (t: PropType, name: string) => void; onRename?: (name: string) => void; onDelete?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [name, setName] = useState(prop?.name ?? '');
  const [q, setQ] = useState('');
  useOutside(ref, true, onClose);
  const editing = !!prop;
  const query = q.trim().toLowerCase();
  const results = PROP_TYPES.filter((t) => t.label.toLowerCase().includes(query));
  const groups: ('Basic' | 'Advanced')[] = ['Basic', 'Advanced'];
  return (
    <span ref={ref} role="dialog" aria-label={editing ? 'Edit property' : 'New property'} className={PANEL} style={{ width: 280 }}>
      <TextInput size="sm" autoFocus={!editing} value={name} onChange={(e) => { setName(e.target.value); onRename?.(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !editing) { onPickType('text', name); } if (e.key === 'Escape') onClose(); }}
        placeholder="Property name" autoComplete="off" data-1p-ignore data-lpignore="true" />
      <div className="flex items-center gap-1.5 px-0.5 pt-2.5 pb-1">
        <span className="text-caption font-medium tracking-[0.02em] text-ink-500">Type</span>
        <span className="text-ink-500"><Icon icon={Search} size={12} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="" autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-caption text-ink-600 outline-none" />
      </div>
      <div className="flex max-h-[288px] flex-col overflow-y-auto">
        {groups.map((g) => {
          const items = results.filter((t) => t.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              {!query && <div className="px-2 pt-2 pb-1 text-overline text-ink-500">{g}</div>}
              {items.map((t) => {
                const on = prop?.type === t.type;
                return (
                  <button key={t.type} onClick={() => onPickType(t.type, name)}
                    className={cn('doc-row flex h-8 cursor-pointer items-center gap-2.5 rounded-sm border-0 px-2 text-left text-ink-600', on ? 'bg-surface-hover' : 'bg-transparent')}>
                    <Icon icon={t.icon} size={16} className="shrink-0" />
                    <span className="flex-1 text-ui text-ink-800">{t.label}</span>
                    {on && <span className="text-ink-600"><Icon icon={Check} size={14} /></span>}
                  </button>
                );
              })}
            </div>
          );
        })}
        {!results.length && <div className="px-2 py-3 text-center text-meta text-ink-500">No property types</div>}
      </div>
      {editing && onDelete && (
        <>
          <div className="my-1.5 border-t border-line-soft" />
          <button onClick={onDelete} className="doc-row flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-sm border-0 bg-transparent px-2 text-left text-ui text-danger-600">
            <Icon icon={Trash2} size={16} /> Delete property
          </button>
        </>
      )}
    </span>
  );
}

// ── shared helpers ───────────────────────────────────────────────────────────
function useOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOut: () => void) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [ref, active, onOut]);
}
function fmtDate(iso?: string) {
  if (!iso) return '';
  try { return new Date(iso + (iso.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}
function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return iso; }
}
