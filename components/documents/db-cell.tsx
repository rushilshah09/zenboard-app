'use client';
// A database cell — one property's value for one page, drawn in a table column or
// in a page's property list (plan T10, after Notion: each type with its own face,
// and every one with its hover, focus, empty and editing states).
//
//   · A TABLE cell is chromeless: the grid draws its edges, a row washes on hover,
//     and the cell being edited says so with a focus ring inside its own edges.
//   · A SHEET cell (a page's properties) washes on hover itself, and an empty value
//     reads "Empty" — the page's property list in Documents says the same, so a
//     row's page and a doc's page cannot be told apart by their properties.
//
// A link, an email address and a phone number are TEXT you can edit, with their
// action — open, write, call — beside them on hover, as in Notion.
import { useState, type CSSProperties, type Ref } from 'react';
import { ExternalLink, Mail, Phone } from '@/components/ds/icons';
import { Checkbox, DatePicker, Icon } from '@/components/ds/ui';
import { OptionList } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { fmtCellDate, optionTokens, type DbRow, type PropDef, type PropOption } from '@/lib/collections';
import { displayValue } from '@/lib/db-engine';
import { resolveCollection } from '@/lib/db-store';
import { isOptioned } from '@/lib/properties';
import { safeHref } from '@/lib/safe-url';
import { OptionChip } from './option-chip';
import { Pop } from './db-pop';

type Patch = { title?: string; data?: Record<string, unknown> };

/** Where a value is drawn — see the header. */
export type CellPlace = 'table' | 'sheet';

const EMPTY = 'text-ui text-ink-500';
/** The focus a cell being edited shows, inside its own edges so the grid never shifts. */
const FOCUS = 'focus-within:shadow-[inset_0_0_0_2px_var(--color-border-focus)]';
// An input that IS the cell: no chrome of its own. Declared so the DS field guard
// knows it is chromeless on purpose.
const input: CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-size)', color: 'var(--ink)', padding: '0 8px', height: '100%' };

/**
 * The action a text-like value offers beside it, or null when it has none: a link
 * opens (only one the app will vouch for), an address writes, a number calls.
 */
export function valueAction(type: PropDef['type'], raw: string): { href: string; label: string; icon: typeof ExternalLink; external: boolean } | null {
  const v = raw.trim();
  if (!v) return null;
  if (type === 'url') {
    const href = safeHref(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return href ? { href, label: 'Open link', icon: ExternalLink, external: true } : null;
  }
  if (type === 'email') return /^[^\s@]+@[^\s@]+$/.test(v) ? { href: `mailto:${v}`, label: 'Write an email', icon: Mail, external: false } : null;
  if (type === 'phone') {
    const digits = v.replace(/[^\d+]/g, '');
    return digits.replace(/\D/g, '').length >= 3 ? { href: `tel:${digits}`, label: 'Call', icon: Phone, external: false } : null;
  }
  return null;
}

export function Cell({ prop, row, onPatch, onCreateOption, allProps, autoFocus, onAutoFocused, inputRef, sheet }: {
  prop: PropDef; row: DbRow;
  onPatch: (patch: Patch) => void;
  onCreateOption: (propId: string, name: string) => PropOption;
  /** Needed to evaluate computed properties. */
  allProps?: PropDef[];
  /** The title cell of a row New has just made takes the caret, once. */
  autoFocus?: boolean; onAutoFocused?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  /** In a page's property list rather than a table column (see the header). */
  sheet?: boolean;
}) {
  const set = (v: unknown) => onPatch({ data: { ...row.data, [prop.id]: v } });
  const shell = cn('group relative flex h-full min-h-[var(--row-nav)] w-full min-w-0 items-center', FOCUS, sheet && 'rounded-sm transition-colors duration-fast hover:bg-surface-hover');

  // Computed properties render read-only through the engine.
  if (prop.type === 'relation' || prop.type === 'rollup' || prop.type === 'formula') {
    const text = displayValue(row, prop, allProps ?? [prop], resolveCollection);
    return (
      <span className={cn(shell, 'px-2')}>
        {text ? <span className="truncate text-ui text-ink-700">{text}</span> : sheet && <span className={EMPTY}>Empty</span>}
      </span>
    );
  }
  if (prop.type === 'title') {
    return (
      <span className={shell}>
        <input ref={inputRef} autoFocus={autoFocus} onFocus={autoFocus ? onAutoFocused : undefined}
          value={row.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Untitled"
          aria-label={prop.name} autoComplete="off" data-1p-ignore data-lpignore="true" data-chromeless
          style={{ ...input, fontWeight: 500 }} className="zb-db-title" />
      </span>
    );
  }
  if (isOptioned(prop.type)) {
    return <SelectCell prop={prop} value={row.data[prop.id]} onValue={set} onCreateOption={(name) => onCreateOption(prop.id, name)} shell={shell} sheet={sheet} />;
  }
  if (prop.type === 'checkbox') {
    const on = !!row.data[prop.id];
    return (
      <span className={cn(shell, 'px-2')}>
        {/* The DS box — square, Radix, the one checkbox (CLAUDE.md). It was a span
            drawn by hand, with a text tick and no focus state. */}
        <Checkbox size="sm" checked={on} onCheckedChange={(v) => set(v === true)} aria-label={prop.name} />
      </span>
    );
  }
  if (prop.type === 'date') {
    const v = (row.data[prop.id] as string) ?? '';
    return (
      <span className={shell}>
        <DatePicker
          aria-label={prop.name}
          value={v || null}
          onValueChange={(iso) => set(iso || undefined)}
          trigger={(
            <button type="button" className="flex h-full min-h-[var(--row-nav)] w-full cursor-pointer items-center border-0 bg-transparent px-2 text-left outline-none">
              {v ? <span className="text-body text-ink-900">{fmtCellDate(v)}</span> : sheet ? <span className={EMPTY}>Empty</span> : <span className="sr-only">Set {prop.name}</span>}
            </button>
          )}
        />
      </span>
    );
  }
  if (prop.type === 'created_time' || prop.type === 'last_edited_time') {
    return <span className={cn(shell, 'px-2 text-meta text-ink-500')}>{fmtCellDate(prop.type === 'created_time' ? row.created_at : row.updated_at)}</span>;
  }
  const v = (row.data[prop.id] as string) ?? '';
  const action = valueAction(prop.type, v);
  return (
    <span className={shell}>
      <input value={v} onChange={(e) => set(e.target.value || undefined)}
        placeholder={sheet ? 'Empty' : undefined}
        aria-label={prop.name} autoComplete="off" data-1p-ignore data-lpignore="true" data-chromeless
        inputMode={prop.type === 'number' ? 'decimal' : prop.type === 'phone' ? 'tel' : prop.type === 'email' ? 'email' : prop.type === 'url' ? 'url' : undefined}
        className={cn('placeholder:text-ink-500', action && 'pr-8', (prop.type === 'url' || prop.type === 'email') && v && 'underline decoration-line-strong underline-offset-2')}
        style={{ ...input, textAlign: prop.type === 'number' && !sheet ? 'right' : 'left', fontVariantNumeric: 'tabular-nums' }} />
      {action && (
        <a href={action.href} {...(action.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})} aria-label={action.label} title={action.label}
          className="reveal-on-hover focus-ring absolute right-1 grid size-6 place-items-center rounded-xs border border-line-soft bg-surface-raised text-ink-600 hover:text-ink-900">
          <Icon icon={action.icon} size={12} />
        </a>
      )}
    </span>
  );
}

// ── Select / multi-select / status ──
function SelectCell({ prop, value, onValue, onCreateOption, shell, sheet }: {
  prop: PropDef; value: unknown;
  onValue: (v: unknown) => void;
  onCreateOption: (name: string) => PropOption;
  shell: string; sheet?: boolean;
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
  const chosen = selected.map((id) => prop.options?.find((x) => x.id === id)).filter((o): o is PropOption => !!o);
  return (
    <span className={shell}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`${prop.name}: ${chosen.map((o) => o.name).join(', ') || 'empty'}`}
        aria-haspopup="listbox" aria-expanded={open}
        className="zb-db-cellbtn flex h-full min-h-[var(--row-nav)] w-full cursor-pointer flex-wrap items-center gap-1 border-0 bg-transparent px-2 py-1.5 text-left outline-none">
        {chosen.length
          ? chosen.map((o) => <OptionChip key={o.id} opt={o} status={prop.type === 'status'} />)
          : sheet && <span className={EMPTY}>Empty</span>}
      </button>
      {open && (
        <Pop onClose={() => setOpen(false)}>
          <OptionList options={uiOptions} selected={selected} multi={multi} onPick={pick} onCreate={create} placeholder="Search or create…" />
        </Pop>
      )}
    </span>
  );
}
