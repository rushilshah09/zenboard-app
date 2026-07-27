'use client';
// Canonical Select / option-picker (DS §5.29 · §5.16). ONE implementation of the
// searchable option list — dots, single/multi, create-option, trailing check —
// that was previously re-hand-rolled in database cells, doc properties, task
// composers, and view menus. Two exports:
//   • OptionList — the popover body (search + rows + create). Reuse it under a
//     bespoke trigger (e.g. a borderless database cell that renders chips).
//   • Select     — the full control: an Input-anatomy trigger + chevron that
//     opens OptionList in a canonical Popover, with outside-click / Esc close.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Plus, Search } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { cx } from './primitives';
import { Popover } from './popover';

export type SelectOption = { value: string; label: string; dot?: string };

// ── OptionList (popover body) ────────────────────────────────
export function OptionList({
  options, selected, multi, searchable = true, onPick, onCreate, placeholder = 'Search…', autoFocus = true,
}: {
  options: SelectOption[];
  selected: string[];
  multi?: boolean;
  searchable?: boolean;
  onPick: (value: string) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;
  const exact = options.some((o) => o.label.toLowerCase() === query);
  const canCreate = !!onCreate && query.length > 0 && !exact;
  return (
    <div>
      {searchable && (
        <div className="flex items-center gap-2 h-7 px-2 mb-1 rounded-sm bg-paper shadow-[inset_0_0_0_1px_var(--line)]">
          <Icon icon={Search} size={14} className="text-ink-5 shrink-0" />
          <input
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (shown.length === 1) onPick(shown[0].value);
                else if (canCreate) { onCreate!(q.trim()); setQ(''); }
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="flex-1 min-w-0 bg-transparent outline-none border-0 text-[13px] text-ink-2 placeholder:text-(--ink-placeholder)"
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto -mx-0.5 px-0.5">
        {shown.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              className="flex items-center gap-2 w-full h-8 px-2 rounded-sm text-left text-[13px] text-ink-2 bg-transparent border-0 cursor-pointer transition-colors [transition-duration:var(--dur-instant)] hover:bg-hover"
            >
              {o.dot && <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: o.dot }} />}
              <span className="flex-1 min-w-0 truncate">{o.label}</span>
              {on && <Icon icon={Check} size={16} className="text-ink-4 shrink-0" />}
            </button>
          );
        })}
        {canCreate && (
          <button
            type="button"
            onClick={() => { onCreate!(q.trim()); setQ(''); }}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-sm text-left text-[13px] text-ink-3 bg-transparent border-0 cursor-pointer transition-colors [transition-duration:var(--dur-instant)] hover:bg-hover"
          >
            <Icon icon={Plus} size={14} className="text-ink-5" />
            <span className="truncate">Create &ldquo;{q.trim()}&rdquo;</span>
          </button>
        )}
        {shown.length === 0 && !canCreate && (
          <div className="px-2 py-3 text-[13px] text-ink-5 text-center">No options</div>
        )}
      </div>
    </div>
  );
}

// ── Select (trigger + popover) ───────────────────────────────
export function Select({
  options, value, onChange, multi, searchable, onCreate, placeholder = 'Select…', disabled, className, width,
  align = 'left', menuWidth, renderTrigger,
}: {
  options: SelectOption[];
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  searchable?: boolean;
  onCreate?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  width?: number | string;
  /** Popover edge to anchor to when using a bespoke (auto-width) trigger. */
  align?: 'left' | 'right';
  /** Popover width; defaults to the trigger width for the standard control. */
  menuWidth?: number | string;
  /** Replace the default bordered trigger with a bespoke one (chip, cell, …) —
      Select still owns the popover, outside-click/Esc, and pick logic. */
  renderTrigger?: (args: { open: boolean; toggle: () => void; selected: SelectOption[] }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = multi ? (Array.isArray(value) ? value : []) : (value ? [value as string] : []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = (v: string) => {
    if (multi) onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    else { onChange(v); setOpen(false); }
  };

  const chosen = options.filter((o) => selected.includes(o.value));
  const toggle = () => { if (!disabled) setOpen((v) => !v); };

  return (
    <div ref={ref} className={cx(renderTrigger ? 'relative inline-flex' : 'relative', className)} style={{ width }}>
      {renderTrigger ? renderTrigger({ open, toggle, selected: chosen }) : (
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          className={cx(
            'flex items-center gap-2 w-full h-[var(--ctl-md)] px-3 bg-paper-2 border border-line rounded-md shadow-(--shadow-xs)',
            'text-[13px] text-left cursor-pointer transition-[border-color] [transition-duration:var(--dur-fast)]',
            'hover:border-line-3 disabled:bg-disabled-bg disabled:text-disabled-text disabled:pointer-events-none',
            open && 'border-accent-border ring-2 ring-accent-soft',
          )}
        >
          <span className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
            {chosen.length === 0
              ? <span className="text-(--ink-placeholder)">{placeholder}</span>
              : chosen.map((o) => (
                  <span key={o.value} className="inline-flex items-center gap-1.5 text-ink-2">
                    {o.dot && <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: o.dot }} />}
                    {o.label}{multi && chosen.length > 1 && o !== chosen[chosen.length - 1] ? ',' : ''}
                  </span>
                ))}
          </span>
          <Icon icon={ChevronDown} size={16} className="text-ink-5 shrink-0" />
        </button>
      )}
      {open && (
        <div
          className={cx('absolute top-[calc(100%_+_4px)] z-50', align === 'right' ? 'right-0' : 'left-0')}
          style={{ width: menuWidth ?? (renderTrigger ? 220 : (typeof width === 'number' ? width : '100%')) }}
        >
          <Popover variant="rich" className="p-1.5">
            <OptionList
              options={options}
              selected={selected}
              multi={multi}
              searchable={searchable}
              onPick={pick}
              onCreate={onCreate ? (name) => { onCreate(name); } : undefined}
            />
          </Popover>
        </div>
      )}
    </div>
  );
}
