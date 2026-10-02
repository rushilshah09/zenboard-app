// Finding and ordering a Collection's items (COLLECTION_PLAN K8; COLLECTION_VIEW_BRIEF §29, §31–32).
//
// A Collection becomes a research library when it can be narrowed: "typography" finds the reference titled
// so, the Instagram post tagged so and the PDF whose description says so (§32); Image narrows to pictures,
// "Branding + Web" to what carries both (§31, §42); and the whole of it can be read newest first, by name, by
// where it came from, or in the order someone arranged it by hand (§29).
//
// Pure: no React, no network. What a search is and which items show are decided here; the bar that asks is
// components/documents/collection-page.tsx.
import {
  ITEM_KINDS, ITEM_KIND_LABEL, itemName, resolveTags,
  type CollectionDoc, type CollectionItem, type CollectionItemKind, type CollectionSort, type CollectionTag,
} from './collection';
import { blocksToText } from './blocks';
import { collectionSource } from './collection-item';
import { hostOf } from './unfurl';

export const SORT_LABEL: Record<CollectionSort, string> = {
  manual: 'Manual order', added: 'Recently added', updated: 'Recently updated', name: 'Name', source: 'Source', published: 'Published',
};

/**
 * What the Collection is narrowed to, besides a search (§31): kinds (any of them), sources (any of them),
 * tags (all of them), and how recently an item arrived.
 */
export type CollectionFilter = {
  kinds: readonly CollectionItemKind[];
  sources: readonly string[];
  tags: readonly string[];
  /** Collected within the last so many days ("Created within last 7 days", §31). */
  added?: AddedWindow;
};
export const NO_FILTER: CollectionFilter = { kinds: [], sources: [], tags: [] };

/** How recently an item was collected, as a filter can ask it. Days, so the window slides with the day. */
export const ADDED_WINDOWS = [7, 30] as const;
export type AddedWindow = (typeof ADDED_WINDOWS)[number];
export const ADDED_LABEL: Record<AddedWindow, string> = { 7: 'Last 7 days', 30: 'Last 30 days' };
const DAY = 86_400_000;

/** Words compared without case or accents: "cafe" finds "Café". */
const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A search's words, folded. */
export const searchWords = (query: string): string[] => fold(query).split(/\s+/).filter(Boolean);

/** Where an item is from, as a word to read: a platform's name, a site's own name or its domain, else its kind. */
export function itemSource(item: CollectionItem): string {
  if (!item.url) return ITEM_KIND_LABEL[item.kind];
  const platform = collectionSource(item.url);
  return platform && platform !== 'Website' ? platform : item.siteName || hostOf(item.url);
}

/**
 * Where an item CAME from, as a key: its platform, else its domain — never the name the page gave itself,
 * which one item from a site may carry and the next may not. Nothing for an upload or a note: those came
 * from you, and their kind is what the Type filter is for.
 */
export function itemOrigin(item: CollectionItem): string | undefined {
  if (!item.url) return undefined;
  const platform = collectionSource(item.url);
  return platform && platform !== 'Website' ? platform : hostOf(item.url);
}

/**
 * Everything a search reads for one item (§32): its name, address, domain, source, author, description,
 * words, file, kind, tags — and what someone WROTE about it (§38), which is the whole point of writing it.
 */
export function itemSearchText(item: CollectionItem, vocabulary: readonly CollectionTag[] | undefined): string {
  const parts = [
    itemName(item), item.title, item.note, item.url, item.url ? hostOf(item.url) : undefined, itemSource(item), item.siteName,
    item.author, item.description, item.file?.name, ITEM_KIND_LABEL[item.kind],
    item.body ? blocksToText(item.body) : undefined,
    ...resolveTags(vocabulary, item.tags).map((t) => t.name),
  ];
  return fold(parts.filter(Boolean).join(' \n '));
}

/** Every word of the search is somewhere in the item. */
export function matchesSearch(item: CollectionItem, vocabulary: readonly CollectionTag[] | undefined, query: string): boolean {
  const words = searchWords(query);
  if (!words.length) return true;
  const text = itemSearchText(item, vocabulary);
  return words.every((w) => text.includes(w));
}

/** Of one of the kinds asked for, from one of the sources, collected recently enough, and carrying every tag. */
export function matchesFilter(item: CollectionItem, filter: CollectionFilter, now: number = Date.now()): boolean {
  if (filter.kinds.length && !filter.kinds.includes(item.kind)) return false;
  const origin = filter.sources.length ? itemOrigin(item) : undefined;
  if (filter.sources.length && !(origin && filter.sources.includes(origin))) return false;
  if (filter.added && Date.parse(item.createdAt) < now - filter.added * DAY) return false;
  return filter.tags.every((t) => item.tags?.includes(t));
}

export const isFiltering = (query: string, filter: CollectionFilter): boolean =>
  searchWords(query).length > 0 || filter.kinds.length > 0 || filter.sources.length > 0 || filter.tags.length > 0 || !!filter.added;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const groupOf = (item: CollectionItem) => itemOrigin(item) ?? ITEM_KIND_LABEL[item.kind];
type Ranked = { item: CollectionItem; index: number };
const byName = (a: Ranked, b: Ranked) => collator.compare(itemName(a.item), itemName(b.item));
const byAdded = (a: Ranked, b: Ranked) => (a.item.createdAt < b.item.createdAt ? 1 : a.item.createdAt > b.item.createdAt ? -1 : 0);
const ORDER: Record<CollectionSort, (a: Ranked, b: Ranked) => number> = {
  manual: () => 0,
  added: byAdded,
  updated: (a, b) => (a.item.updatedAt < b.item.updatedAt ? 1 : a.item.updatedAt > b.item.updatedAt ? -1 : 0),
  name: byName,
  // Grouped by where things came from, so a site's two pages sit together however each named itself.
  source: (a, b) => collator.compare(groupOf(a.item), groupOf(b.item)) || byName(a, b),
  // Newest publication first; an item with no published day after every dated one, newest added first.
  published: (a, b) => {
    const [pa, pb] = [a.item.published, b.item.published];
    if (pa && pb) return pa < pb ? 1 : pa > pb ? -1 : 0;
    if (pa || pb) return pa ? -1 : 1;
    return byAdded(a, b);
  },
};

/** The items in a Collection's order. Ties keep the manual order, so the same items always read the same way. */
export function sortItems(items: readonly CollectionItem[], sort: CollectionSort = 'manual'): CollectionItem[] {
  if (sort === 'manual') return [...items];
  return items.map((item, index) => ({ item, index })).sort((a, b) => ORDER[sort](a, b) || a.index - b.index).map((r) => r.item);
}

/** What the Collection shows: the items matching the search and the filter, in its order. */
export function findItems(doc: CollectionDoc, query: string, filter: CollectionFilter, now?: number): CollectionItem[] {
  const shown = isFiltering(query, filter)
    ? doc.items.filter((i) => matchesFilter(i, filter, now) && matchesSearch(i, doc.tags, query))
    : doc.items;
  return sortItems(shown, doc.sort ?? 'manual');
}

/** The kinds a Collection has items of, in the kinds' own order — the ones a filter can offer. */
export function kindsPresent(doc: CollectionDoc): CollectionItemKind[] {
  const present = new Set(doc.items.map((i) => i.kind));
  return ITEM_KINDS.filter((k) => present.has(k));
}

/**
 * The sources a Collection has things from, once each, alphabetically — what a filter can offer. `key` is
 * the origin an item is matched by; `label` is the best name anything from there gave for it.
 */
export function sourcesPresent(doc: CollectionDoc): { key: string; label: string }[] {
  const found = new Map<string, string>();
  for (const item of doc.items) {
    const key = itemOrigin(item);
    if (!key) continue;
    if (!found.has(key)) found.set(key, key);
    // A site that gave its own name says it best — "Linear", not "linear.app".
    if (item.siteName && found.get(key) === key) found.set(key, item.siteName);
  }
  return [...found].map(([key, label]) => ({ key, label })).sort((a, b) => collator.compare(a.label, b.label));
}

/** A drag can only change the order it is looking at: the manual one, with nothing hidden. */
export const canReorder = (doc: CollectionDoc, query: string, filter: CollectionFilter): boolean =>
  (doc.sort ?? 'manual') === 'manual' && !isFiltering(query, filter);
