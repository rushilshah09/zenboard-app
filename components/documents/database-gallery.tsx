'use client';
// The gallery — a database's pages as cards in a grid (plan T11, after Notion's
// Gallery view): a preview of each page's body on top, the same card face a board
// draws underneath, the card's menu on hover, and a New page tile at the end.
// The grid's column width is the view's Card size (T8, `galleryCardMin`).
import { Plus } from '@/components/ds/icons';
import { Icon, cardInteractiveClass } from '@/components/ds/ui';
import { galleryCardMin, type DbRow, type PropDef, type ViewDef } from '@/lib/collections';
import { CardContent, CardMenu, PagePreview } from './db-card';

/** How tall a card's preview is at each card size. */
const PREVIEW_PX = { small: 88, medium: 120, large: 168 } as const;

export function DatabaseGallery({ rows, props, view, keyOf, onOpen, onDelete, onNew, tint }: {
  rows: DbRow[]; props: PropDef[]; view: ViewDef;
  /** A row's React key — stable through a new row's id swap. */
  keyOf: (rowId: string) => string;
  onOpen: (rowId: string) => void;
  onDelete: (rowId: string) => void;
  onNew: () => void;
  tint?: (row: DbRow) => string | undefined;
}) {
  const hiddenProps = view.hidden ?? [];
  const preview = PREVIEW_PX[view.cardSize ?? 'medium'];
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${galleryCardMin(view.cardSize)}px, 1fr))` }}>
      {rows.map((r) => {
        const title = r.title || 'Untitled';
        const bg = tint?.(r);
        return (
          <div key={keyOf(r.id)} className="group relative" data-gallery-card>
            <div role="button" tabIndex={0} aria-label={title}
              onClick={() => onOpen(r.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(r.id); } }}
              className={cardInteractiveClass('flex h-full flex-col overflow-hidden text-left')}
              style={bg ? { background: bg } : undefined}>
              <PagePreview content={r.content} height={preview} className="shrink-0" />
              <div className="px-2.5 py-2">
                <CardContent row={r} props={props} hiddenProps={hiddenProps} />
              </div>
            </div>
            <div className="reveal-on-hover absolute right-1.5 top-1.5">
              <CardMenu onOpen={() => onOpen(r.id)} onDelete={() => onDelete(r.id)} />
            </div>
          </div>
        );
      })}
      <button type="button" onClick={onNew}
        className="focus-ring flex items-center justify-center gap-1.5 rounded-lg text-ui text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800"
        style={{ minHeight: preview + 40 }}>
        <Icon icon={Plus} size={16} /> New page
      </button>
    </div>
  );
}
