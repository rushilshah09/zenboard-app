// The Collection Index — every Collection as a visual card (COLLECTION_PLAN X1–X2; COLLECTION_INDEX_BRIEF §1, §9–10).
//
// A card's preview is made from the Collection's own items, never an uploaded cover: pictures first, in the order
// the Collection keeps them, then tiles for what has no picture of its own. The Index reads in the order chosen here
// — last edited, name, most items or created — with a pinned Collection first, as Documents' grid keeps its pins.
//
// Pure: no React, no network. The cards that draw this are components/documents/collection-index.tsx.
import { collectionPicture } from './collection-item';
import type { CollectionDoc, CollectionItem } from './collection';

/**
 * Whether an item brings a picture to a preview without anything being asked: an uploaded image, or a link whose
 * picture is already known — a platform's thumbnail, an address that is an image, the link's remembered image.
 */
export function hasPicture(item: CollectionItem): boolean {
  if (item.kind === 'image' && item.file) return true;
  return !!item.url && !!collectionPicture(item.url, { image: item.image });
}

/** What a card's preview shows: pictures first, in the Collection's order, then the rest — at most `max`. */
export function previewItems(doc: CollectionDoc, max = 3): CollectionItem[] {
  const pictured: CollectionItem[] = [];
  const plain: CollectionItem[] = [];
  for (const item of doc.items) (hasPicture(item) ? pictured : plain).push(item);
  return [...pictured, ...plain].slice(0, Math.max(0, max));
}

/** How much a Collection holds, in words. */
export const itemCountLabel = (n: number): string => (n === 0 ? 'No items' : n === 1 ? '1 item' : `${n} items`);

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/**
 * When a Collection last changed: its page's own time, or its newest item's when that is later. The page's time
 * does not move while its items change on this device — the Collection's store writes them, not the page list.
 */
export function collectionEditedAt(pageUpdatedAt: string, doc: CollectionDoc): string {
  let latest = pageUpdatedAt;
  for (const item of doc.items) if (time(item.updatedAt) > time(latest)) latest = item.updatedAt;
  return latest;
}

export const COLLECTION_INDEX_SORTS = ['edited', 'name', 'items', 'created'] as const;
export type IndexSort = (typeof COLLECTION_INDEX_SORTS)[number];
export const INDEX_SORT_LABEL: Record<IndexSort, string> = {
  edited: 'Last edited', name: 'Name', items: 'Most items', created: 'Created',
};

/** One Collection, as the Index orders it. */
export type IndexEntry = { id: string; title: string; editedAt: string; createdAt: string; count: number; pinned: boolean };

const nameOf = (e: IndexEntry) => e.title.trim() || 'Untitled';
const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const ORDER: Record<IndexSort, (a: IndexEntry, b: IndexEntry) => number> = {
  edited: (a, b) => time(b.editedAt) - time(a.editedAt),
  name: (a, b) => byName.compare(nameOf(a), nameOf(b)),
  items: (a, b) => b.count - a.count || time(b.editedAt) - time(a.editedAt),
  created: (a, b) => time(b.createdAt) - time(a.createdAt),
};

/** The Index in `sort` order, pinned Collections first. A new list; the one given keeps its order. */
export function sortCollections<T extends IndexEntry>(entries: readonly T[], sort: IndexSort): T[] {
  return [...entries].sort((a, b) => Number(b.pinned) - Number(a.pinned) || ORDER[sort](a, b) || a.id.localeCompare(b.id));
}
