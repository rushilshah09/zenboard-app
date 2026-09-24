// Collecting: paste a link, and the item is there (COLLECTION_PLAN K4).
//
// The quickest path (COLLECTION_VIEW_BRIEF §10–11): copy something, paste it, and a Collection item
// exists at once — what it is (a video, a PDF, a page to read) read from the address on the spot.
// Its name, author, description, published day and picture follow a moment later from the link
// itself (§6, §36), and a link that says nothing still leaves a usable item (§34–35).
//
// One paste is one step: ⌘Z takes back every item it made. What a link says arrives through
// `store.learn` — never a step of its own, and never written over anything the person has given it.
import { addItems, fillFromMeta, linkItem, noteItem, type CollectionItem } from '@/lib/collection';
import type { CollectionStore } from '@/lib/collection-store';
import { mintUuid } from '@/lib/temp-id';
import { isBareUrl } from '@/lib/unfurl';
import { fetchLinkMeta } from '@/lib/use-link-meta';

/** The most items one paste makes: a pasted list of links, not a pasted export. */
export const COLLECT_LIMIT = 50;

/**
 * What a paste holds. Links, when every word of it is one — an item each, repeats dropped; otherwise
 * a note, the text as written. A sentence with a link inside it is a note: splitting someone's words
 * into items would lose them.
 */
export function parseCollectable(text: string): { urls: string[]; note: string | null } {
  const t = text.trim();
  if (!t) return { urls: [], note: null };
  const words = t.split(/\s+/);
  if (words.every(isBareUrl)) return { urls: [...new Set(words)].slice(0, COLLECT_LIMIT), note: null };
  return { urls: [], note: t };
}

/**
 * Paste or type into a Collection: an item per link — or one note — on top, in the order given, as
 * ONE step. Each link is asked what it is, and its item filled in when it answers. Returns the new
 * items' ids.
 */
export function collectText(store: CollectionStore, text: string, now = new Date().toISOString()): string[] {
  const { urls, note } = parseCollectable(text);
  const items: CollectionItem[] = note ? [noteItem(mintUuid(), note, now)] : urls.map((url) => linkItem(mintUuid(), url, now));
  if (!items.length || !store.change((doc) => addItems(doc, items))) return [];
  for (const item of items) if (item.url) askLink(store, item.id, item.url);
  return items.map((i) => i.id);
}

/** Ask a link what it is, and fill its item in when it answers — behind the person, never a step. */
export function askLink(store: CollectionStore, id: string, url: string): void {
  void fetchLinkMeta(url).then((meta) => store.learn((doc) => fillFromMeta(doc, id, url, meta)), () => {});
}
