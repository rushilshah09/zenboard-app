'use client';
// The Collection Index (COLLECTION_PLAN X1–X2; COLLECTION_INDEX_BRIEF §1, §9–10).
//
// Every Collection as a large visual card: a preview made from its own items (lib/collection-index.ts), its icon and
// name, how much it holds, and "Shared" when a client can see it. The first card makes a new Collection. Documents
// owns the verbs — open, rename, duplicate, move, delete — and hands each card the same hover controls a doc card
// has, so the two kinds of card are used the same way.
import { useRef, useState, type ReactNode } from 'react';
import { Plus, ShareNetwork } from '@/components/ds/icons';
import { Icon, IconButton, cardInteractiveClass } from '@/components/ds/ui';
import { PageIcon } from '@/components/ui/page-icon';
import { cn } from '@/lib/cn';
import { ITEM_KIND_LABEL, type CollectionDoc, type CollectionItem } from '@/lib/collection';
import { itemCountLabel, previewItems } from '@/lib/collection-index';
import { collectionPicture } from '@/lib/collection-item';
import { isMissingThumbnail } from '@/lib/platforms';
import { hostOf } from '@/lib/unfurl';
import { KIND_GLYPH, useItemFileUrl } from './collection-card';

/** Every preview is one shape, so a row of cards lines up whatever the Collections hold. */
const PREVIEW_ASPECT = '4 / 3';
/** A preview shows up to three items: one large, and two beside it. */
const PREVIEW_ITEMS = 3;

/** What the Index needs to know about a Collection's page. */
export type IndexPage = { id: string; title: string | null; icon?: string | null; client_visible?: boolean };

/** The Index's first card: a new Collection, named "New collection" and opened with that name selected. */
export function NewCollectionCard({ onCreate }: { onCreate: () => void }) {
  return (
    // In a row of cards it takes a card's shape, so the row lines up. In one column (a phone) nothing lines up with
    // it, and a card's height pushed every Collection below the first screen — so there it is a row.
    <button type="button" onClick={onCreate} data-new-collection
      className="zb-press focus-ring flex w-full flex-col overflow-hidden rounded-lg border border-dashed border-line-3 text-left max-sm:flex-row max-sm:items-center">
      <span className="grid w-full place-items-center text-ink-600 max-sm:hidden" style={{ aspectRatio: PREVIEW_ASPECT }}>
        <Icon icon={Plus} size={20} />
      </span>
      <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5 max-sm:flex-row max-sm:items-center max-sm:gap-2 max-sm:py-3">
        <Icon icon={Plus} size={16} className="hidden text-ink-600 max-sm:block" />
        <span className="text-ui font-medium text-ink-800">New collection</span>
        <span className="text-meta text-ink-600 max-sm:hidden">Collect anything</span>
      </span>
    </button>
  );
}

/** One Collection on the Index. The whole card opens it; `actions` are Documents' hover controls for a page. */
export function CollectionIndexCard({ page, doc, renaming, actions, onOpen, onAdd, onRenameTo, onCancelRename }: {
  page: IndexPage;
  /** Its items as they stand on this device (`collectionDocFor`). */
  doc: CollectionDoc;
  renaming: boolean;
  actions: ReactNode;
  onOpen: () => void;
  /** An empty Collection's +: open it, ready to collect. */
  onAdd: () => void;
  onRenameTo: (title: string) => void;
  onCancelRename: () => void;
}) {
  const name = page.title?.trim() || 'Untitled';
  const cancelled = useRef(false);
  return (
    <div data-collection-card={page.id} onClick={onOpen}
      className={cardInteractiveClass('doc-card relative flex w-full flex-col overflow-hidden')}>
      <CollectionPreview items={previewItems(doc, PREVIEW_ITEMS)} onAdd={onAdd} />
      <div className="flex min-w-0 items-start gap-2 px-3 pb-3 pt-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {renaming ? (
            <input autoFocus defaultValue={page.title ?? ''} aria-label="Collection name" autoComplete="off" data-1p-ignore data-lpignore="true"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => { cancelled.current = false; e.currentTarget.select(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { cancelled.current = true; onCancelRename(); }
              }}
              onBlur={(e) => { if (!cancelled.current) onRenameTo(e.currentTarget.value); }}
              className="min-w-0 rounded-xs border border-accent bg-paper px-1.5 py-0.5 text-ui text-ink-900 outline-none" />
          ) : (
            <button type="button" title={name} onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="focus-ring flex min-w-0 max-w-full items-center gap-1.5 rounded-xs text-left">
              {page.icon && <PageIcon icon={page.icon} size={15} />}
              <span className="truncate text-ui font-medium text-ink-900">{name}</span>
            </button>
          )}
          <span className="flex min-w-0 items-center gap-1.5 text-meta text-ink-600">
            <span className="tabular-nums">{itemCountLabel(doc.items.length)}</span>
            {page.client_visible && (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1"><Icon icon={ShareNetwork} size={12} />Shared</span>
              </>
            )}
          </span>
        </div>
        {actions}
      </div>
    </div>
  );
}

/** The preview: the Collection's own items, one large and two beside it. An empty Collection offers its +. */
function CollectionPreview({ items, onAdd }: { items: CollectionItem[]; onAdd: () => void }) {
  if (!items.length) {
    return (
      <div className="grid w-full place-items-center border-b border-line-soft bg-surface-fill" style={{ aspectRatio: PREVIEW_ASPECT }}>
        <IconButton size="sm" variant="secondary" label="Add to this collection" icon={<Icon icon={Plus} size={16} />}
          onClick={(e) => { e.stopPropagation(); onAdd(); }} />
      </div>
    );
  }
  const [lead, ...rest] = items;
  return (
    <div aria-hidden style={{ aspectRatio: PREVIEW_ASPECT }}
      className={cn('grid w-full gap-px border-b border-line-soft bg-line-soft', rest.length ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1')}>
      <PreviewTile item={lead} />
      {rest.length > 0 && (
        <div className={cn('grid min-h-0 gap-px', rest.length > 1 ? 'grid-rows-2' : 'grid-rows-1')}>
          {rest.map((item) => <PreviewTile key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

/** One item in a preview: its picture filling the cell, or — with none — what it is and where it lives. */
function PreviewTile({ item }: { item: CollectionItem }) {
  const fileUrl = useItemFileUrl(item.file);
  const picture = item.kind === 'image' && fileUrl ? fileUrl : item.url ? collectionPicture(item.url, { image: item.image }) : null;
  const [failed, setFailed] = useState<string | null>(null);
  if (picture && failed !== picture) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- any site's image, a platform thumbnail or a signed upload; next/image needs a known host */
      <img src={picture} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false}
        onLoad={(e) => { if (isMissingThumbnail(e.currentTarget)) setFailed(picture); }}
        onError={() => setFailed(picture)}
        className="block size-full min-h-0 bg-surface-fill object-cover" />
    );
  }
  const detail = item.url ? hostOf(item.url) : item.file?.name ?? null;
  return (
    <div className="flex size-full min-h-0 flex-col items-center justify-center gap-1 overflow-hidden bg-surface-fill px-2 text-center">
      {item.kind === 'note' ? (
        <p className="line-clamp-4 text-caption text-ink-700 [overflow-wrap:anywhere]">{item.note}</p>
      ) : (
        <>
          <Icon icon={KIND_GLYPH[item.kind]} size={16} className="text-ink-600" />
          <span className="text-caption font-medium text-ink-800">{ITEM_KIND_LABEL[item.kind]}</span>
          {detail && <span className="max-w-full truncate text-caption text-ink-600">{detail}</span>}
        </>
      )}
    </div>
  );
}
