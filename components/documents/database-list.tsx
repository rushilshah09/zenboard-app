'use client';
// The list — a database's pages one per line (plan T11, after Notion's List view):
// the page glyph and name, then its visible values along the right in the quiet
// size, the whole line a way into the page. New page at the foot.
import { FileText, Plus } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import type { DbRow, PropDef, ViewDef } from '@/lib/collections';
import { CardValue, hasValue } from './db-card';

export function DatabaseList({ rows, props, view, keyOf, onOpen, onNew, tint }: {
  rows: DbRow[]; props: PropDef[]; view: ViewDef;
  keyOf: (rowId: string) => string;
  onOpen: (rowId: string) => void;
  onNew: () => void;
  tint?: (row: DbRow) => string | undefined;
}) {
  const hiddenProps = view.hidden ?? [];
  const columns = props.filter((p) => p.type !== 'title' && !hiddenProps.includes(p.id));
  return (
    <div className="flex flex-col">
      {rows.map((r) => {
        const bg = tint?.(r);
        return (
          <button key={keyOf(r.id)} type="button" onClick={() => onOpen(r.id)} data-list-row
            className="focus-ring flex min-h-[var(--row-nav)] w-full items-center gap-2 rounded-sm px-2 py-1 text-left transition-colors duration-fast hover:bg-surface-hover"
            style={bg ? { background: bg } : undefined}>
            <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />
            <span className={r.title ? 'min-w-0 flex-1 truncate text-ui font-medium text-ink-900' : 'min-w-0 flex-1 truncate text-ui font-medium text-ink-500'}>
              {r.title || 'Untitled'}
            </span>
            <span className="flex min-w-0 shrink items-center justify-end gap-2 overflow-hidden">
              {columns.filter((p) => hasValue(r, p)).map((p) => (
                <span key={p.id} className="flex max-w-48 shrink-0 items-center overflow-hidden [&_.line-clamp-2]:line-clamp-1">
                  <CardValue row={r} prop={p} props={props} />
                </span>
              ))}
            </span>
          </button>
        );
      })}
      <button type="button" onClick={onNew}
        className="focus-ring flex min-h-[var(--row-nav)] w-full items-center gap-2 rounded-sm px-2 text-left text-ui text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800">
        <Icon icon={Plus} size={16} /> New page
      </button>
    </div>
  );
}
