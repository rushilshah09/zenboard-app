'use client';
// A page as a card — the ONE card a database draws, on a board and in a gallery
// (plan T11, after Notion). Its face: the page glyph when the page has something in
// it, the name, then each visible property with a value on its own line. Its menu,
// beside it on hover: Open, whatever the layout adds (a board's "Move to"), Delete.
import type { ReactNode } from 'react';
import { Check, FileText, Maximize2, MoreHorizontal, Trash2 } from '@/components/ds/icons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Icon, IconButton,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { fmtCellDate, type DbRow, type PropDef } from '@/lib/collections';
import { asIds, displayValue } from '@/lib/db-engine';
import { resolveCollection } from '@/lib/db-store';
import { hasBody, toBlocks } from '@/lib/blocks';
import { isOptioned } from '@/lib/properties';
import { OptionChip } from './option-chip';

/** Does this page have a value for `p` worth a line on its card? */
export function hasValue(row: DbRow, p: PropDef): boolean {
  if (p.type === 'created_time' || p.type === 'last_edited_time') return true;
  const v = row.data[p.id];
  if (isOptioned(p.type)) return asIds(v).some((id) => p.options?.some((o) => o.id === id));
  if (p.type === 'checkbox') return v === true;
  if (p.type === 'relation' || p.type === 'rollup' || p.type === 'formula') return displayValue(row, p, [p], resolveCollection) !== '';
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * The card's content: glyph and name, then its values. `exclude` is a property the
 * layout already says — a board never repeats the property it is grouped by.
 */
export function CardContent({ row, props, hiddenProps, exclude }: { row: DbRow; props: PropDef[]; hiddenProps: string[]; exclude?: string }) {
  const shown = props.filter((p) => p.type !== 'title' && p.id !== exclude && !hiddenProps.includes(p.id) && hasValue(row, p));
  return (
    <>
      <div className="flex items-start gap-1.5">
        {hasBody(row.content) && <Icon icon={FileText} size={16} className="mt-0.5 shrink-0 text-ink-500" />}
        <span className={cn('min-w-0 text-ui font-medium [overflow-wrap:anywhere]', row.title ? 'text-ink-900' : 'text-ink-500')}>
          {row.title || 'Untitled'}
        </span>
      </div>
      {shown.map((p) => (
        <div key={p.id} className="mt-1.5">
          <CardValue row={row} prop={p} props={props} />
        </div>
      ))}
    </>
  );
}

/** One value, as a card or a list row draws it. */
export function CardValue({ row, prop, props }: { row: DbRow; prop: PropDef; props: PropDef[] }) {
  const v = row.data[prop.id];
  if (isOptioned(prop.type)) {
    return (
      <div className="flex flex-wrap gap-1">
        {asIds(v).map((id) => {
          const o = prop.options?.find((x) => x.id === id);
          return o ? <OptionChip key={id} opt={o} status={prop.type === 'status'} /> : null;
        })}
      </div>
    );
  }
  if (prop.type === 'checkbox') {
    return <span className="inline-flex items-center gap-1 text-meta text-ink-700"><Icon icon={Check} size={12} />{prop.name}</span>;
  }
  if (prop.type === 'date') return <span className="text-meta text-ink-600">{fmtCellDate(String(v))}</span>;
  if (prop.type === 'created_time' || prop.type === 'last_edited_time') {
    return <span className="text-meta text-ink-600">{fmtCellDate(prop.type === 'created_time' ? row.created_at : row.updated_at)}</span>;
  }
  const text = prop.type === 'relation' || prop.type === 'rollup' || prop.type === 'formula'
    ? displayValue(row, prop, props, resolveCollection)
    : String(v);
  return <span className={cn('line-clamp-2 text-meta text-ink-700 [overflow-wrap:anywhere]', prop.type === 'number' && 'tabular-nums', prop.type === 'url' && 'underline decoration-line-strong underline-offset-2')}>{text}</span>;
}

/** The card's own menu. `children` are the layout's items, between Open and Delete. */
export function CardMenu({ onOpen, onDelete, children }: { onOpen: () => void; onDelete: () => void; children?: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton size="xs" variant="secondary" label="Page actions" icon={<Icon icon={MoreHorizontal} size={16} />} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem icon={<Icon icon={Maximize2} size={16} />} onSelect={onOpen}>Open</DropdownMenuItem>
        {children}
        <DropdownMenuSeparator />
        <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />} onSelect={onDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A page's body in miniature — a gallery card's preview (Notion's "Page content").
 * The first blocks with words, drawn small in the page's own hierarchy: a heading
 * reads as one, a to-do has its box. Nothing to show leaves the space blank.
 */
export function PagePreview({ content, height, className }: { content: DbRow['content']; height: number; className?: string }) {
  const blocks = hasBody(content) ? toBlocks(content).filter((b) => b.text.trim()).slice(0, 8) : [];
  return (
    // On the card's own ground, as Notion's preview is: five empty grey panes read as
    // images that failed to load, where a quiet blank reads as a page with nothing yet.
    <div aria-hidden className={cn('overflow-hidden border-b border-line-soft px-3 pt-3', className)} style={{ height }}>
      <div className="flex flex-col gap-1 rounded-sm">
        {blocks.map((b) => (
          <p key={b.id} className={cn('flex items-start gap-1 truncate text-caption leading-snug',
            b.type === 'h1' || b.type === 'h2' || b.type === 'h3' ? 'font-semibold text-ink-800' : 'text-ink-600')}>
            {b.type === 'todo' && <span className={cn('mt-0.5 size-2 shrink-0 rounded-[2px] border border-ink-500', b.checked && 'bg-ink-500')} />}
            {(b.type === 'bullet' || b.type === 'numbered') && <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-500" />}
            <span className="truncate">{b.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
