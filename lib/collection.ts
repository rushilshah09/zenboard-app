// A Collection — its own item, beside a Database (COLLECTION_ITEM_BRIEF, COLLECTION_PLAN K2).
//
// A Collection is a page of type `collection`, the way a Database is a page of type `database`,
// so its identity, its name, rename, move, duplicate, trash, search and permissions are the
// page's. What it gathers lives in the page's content, `content.collection`: images, videos,
// links, files, notes — each an item with a stable id, what it is, what it holds, what is known
// about it, and where it sits on the canvas. The canvas place is layout, never content: moving an
// item never touches its name, its link or its metadata, and never dates it as changed.
//
// This file is the model — reading a page's content through a guard (it is JSON written from the
// browser), and every change as a pure function. No React, no network.
import { attachmentKind } from './attachments';
import { blocksToText, emptyBlock, genId, hasBody, toBlocks, type Block } from './blocks';
import { readCanvasBox, type CanvasBox, type CanvasBoxes } from './canvas';
import { collectionType, readPreviewShape } from './collection-item';
import { PALETTE_NAMES, type PaletteName } from './palette';
import { hostOf, publishedDay, type LinkMeta } from './unfurl';

/** The page type that makes a page a Collection. */
export const COLLECTION_PAGE_TYPE = 'collection';
/** What a new Collection is called until someone names it (COLLECTION_ITEM_BRIEF §12). */
export const NEW_COLLECTION_NAME = 'New collection';

export const ITEM_KINDS = ['link', 'image', 'video', 'audio', 'pdf', 'file', 'note'] as const;
export type CollectionItemKind = (typeof ITEM_KINDS)[number];

/** The one name for each kind of item — on a tile, in a filter, in a search. */
export const ITEM_KIND_LABEL: Record<CollectionItemKind, string> = {
  link: 'Website', image: 'Image', video: 'Video', audio: 'Audio', pdf: 'PDF', file: 'File', note: 'Note',
};

/**
 * How a Collection orders its items (COLLECTION_PLAN K8; COLLECTION_VIEW_BRIEF §29). `manual` is the order
 * they are kept in — newest first until someone drags one — and the only order a drag can change.
 */
export const COLLECTION_SORTS = ['manual', 'added', 'updated', 'name', 'source', 'published'] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

/** Where an item sits on the canvas, and its layer. Layout only. */
export type CanvasPlacement = CanvasBox & { z?: number };

/** An uploaded file, held as an attachment of the Collection's page (0033). */
export type CollectionFile = { attachmentId: string; name: string; mime: string | null; size: number | null };

export type CollectionItem = {
  id: string;
  kind: CollectionItemKind;
  /** What it holds: a web address, an uploaded file, or words. */
  url?: string;
  file?: CollectionFile;
  note?: string;
  /** Its name — fetched from the link at first, the person's to change. */
  title?: string;
  /** What is known about it, filled from the link where the item is still empty. */
  description?: string;
  author?: string;
  siteName?: string;
  /** YYYY-MM-DD, as the publisher wrote it. */
  published?: string;
  /** https only: a page must not pull an insecure picture into itself. */
  image?: string;
  favicon?: string;
  /** Height over width of its picture, once known — so a masonry does not settle again. */
  shape?: number;
  canvas?: CanvasPlacement;
  /** The Collection's tags it carries, by id, in the order they were put on. */
  tags?: string[];
  /**
   * What someone wrote about it — the Zenboard editor's blocks (§38: "why I saved this"). A note item's
   * words ARE its body, and its `note` is the plain text of them.
   */
  body?: Block[];
  createdAt: string;
  updatedAt: string;
};

/**
 * One of a Collection's own words for what its items are about (COLLECTION_PLAN K7). A tag belongs to its
 * Collection — its vocabulary — and an item carries the ids of the tags put on it, so renaming or
 * recolouring a tag changes it on every item at once. Coloured like a database's options.
 */
export type CollectionTag = { id: string; name: string; color: PaletteName };

/**
 * How a Collection shows itself (COLLECTION_PLAN K11, COLLECTION_VIEW_BRIEF §28) — a setting of the
 * Collection, not of the person looking, so everyone who opens it sees the same board.
 *
 * `original` is the masonry §13 asks for: every card the shape of its own picture. `cover` and `fit` make
 * every card one shape — the tidy grid — with the picture cropped to it or whole inside it.
 */
export const CARD_SIZES = ['small', 'medium', 'large'] as const;
export type CardSize = (typeof CARD_SIZES)[number];
export const CARD_SIZE_LABEL: Record<CardSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
export const PREVIEW_FITS = ['original', 'cover', 'contain'] as const;
export type PreviewFit = (typeof PREVIEW_FITS)[number];
export const PREVIEW_FIT_LABEL: Record<PreviewFit, string> = { original: 'Original ratio', cover: 'Cover', contain: 'Fit' };

/** Only what is NOT the ordinary is kept, so an untouched Collection carries no settings at all. */
export type CollectionView = { size?: CardSize; fit?: PreviewFit; titles?: boolean };
const VIEW_ORDINARY: Required<CollectionView> = { size: 'medium', fit: 'original', titles: true };

/** A Collection: its items, its tags once it has any, its order, and how it shows itself. */
export type CollectionDoc = {
  items: CollectionItem[];
  tags?: CollectionTag[];
  sort?: Exclude<CollectionSort, 'manual'>;
  view?: CollectionView;
};

/** How this Collection shows itself, with everything it has not been told filled in. */
export const collectionView = (doc: CollectionDoc): Required<CollectionView> => ({ ...VIEW_ORDINARY, ...doc.view });

/** A note's first line — its name wherever one is needed. */
export const noteTitle = (note: string | undefined): string => (note ?? '').split('\n')[0].trim().slice(0, 80) || 'Note';

/** What an item is called: the person's name for it, a note's first line, a file's name, or where it lives. */
export function itemName(item: CollectionItem): string {
  if (item.title) return item.title;
  if (item.kind === 'note') return noteTitle(item.note);
  if (item.file) return item.file.name;
  return item.url ? hostOf(item.url) : 'Untitled';
}

/** The addresses of these items, in the order given — what a selection is taken away as (§16). */
export const itemLinks = (items: readonly CollectionItem[]): string[] =>
  items.map((i) => i.url).filter((url): url is string => !!url);

// ── Reading ──

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** One line of text, trimmed and capped; nothing when there is nothing. */
const line = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};
const webUrl = (v: unknown): string | undefined => {
  const t = line(v, 2048);
  return t && /^https?:\/\/\S+$/i.test(t) ? t : undefined;
};
const httpsUrl = (v: unknown): string | undefined => {
  const t = line(v, 2048);
  return t && /^https:\/\/\S+$/i.test(t) ? t : undefined;
};

/** A canvas place: a box the canvas can draw (read by lib/canvas.ts), and a layer when it has one. */
function readPlacement(raw: unknown): CanvasPlacement | undefined {
  const box = readCanvasBox(raw);
  if (!box || !isRecord(raw)) return box;
  const z = raw.z;
  return finite(z) && Number.isInteger(z) && z >= 0 ? { ...box, z } : box;
}

function readFile(raw: unknown): CollectionFile | undefined {
  if (!isRecord(raw) || typeof raw.attachmentId !== 'string' || !raw.attachmentId) return undefined;
  return {
    attachmentId: raw.attachmentId,
    name: line(raw.name, 200) ?? 'file',
    mime: typeof raw.mime === 'string' ? raw.mime : null,
    size: finite(raw.size) && raw.size >= 0 ? raw.size : null,
  };
}

/** The most characters a tag's name keeps: a word or two, never a sentence. */
export const TAG_NAME_MAX = 60;

/** A Collection's tags as it may use them: each with an id and a name, once each (names match without case). */
function readTags(raw: unknown): CollectionTag[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const tags: CollectionTag[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id) continue;
    const name = line(entry.name, TAG_NAME_MAX);
    if (!name || ids.has(entry.id) || names.has(name.toLowerCase())) continue;
    ids.add(entry.id);
    names.add(name.toLowerCase());
    const color = (PALETTE_NAMES as readonly unknown[]).includes(entry.color) ? (entry.color as PaletteName) : 'gray';
    tags.push({ id: entry.id, name, color });
  }
  return tags;
}

/** The Collection's settings, keeping only what it knows and only where that is not the ordinary. */
function readView(raw: unknown): CollectionView | undefined {
  if (!isRecord(raw)) return undefined;
  const view: CollectionView = {};
  if ((CARD_SIZES as readonly unknown[]).includes(raw.size) && raw.size !== VIEW_ORDINARY.size) view.size = raw.size as CardSize;
  if ((PREVIEW_FITS as readonly unknown[]).includes(raw.fit) && raw.fit !== VIEW_ORDINARY.fit) view.fit = raw.fit as PreviewFit;
  if (raw.titles === false) view.titles = false;
  return Object.keys(view).length ? view : undefined;
}

/** Blocks, only when something was actually written: an empty paragraph is not a body. */
function readBody(raw: unknown): Block[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const blocks = toBlocks(raw);
  return hasBody({ blocks }) ? blocks : undefined;
}

function readItem(raw: unknown, knownTags: ReadonlySet<string>): CollectionItem | undefined {
  if (!isRecord(raw)) return undefined;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : undefined;
  const kind = (ITEM_KINDS as readonly unknown[]).includes(raw.kind) ? (raw.kind as CollectionItemKind) : undefined;
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : undefined;
  if (!id || !kind || !createdAt) return undefined;
  const item: CollectionItem = { id, kind, createdAt, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt };
  if (kind === 'note') {
    const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 5000) : '';
    if (!note) return undefined;
    item.note = note;
  } else {
    const url = webUrl(raw.url);
    const file = readFile(raw.file);
    // An item holds something: a link to follow, or a file to show.
    if (!url && !file) return undefined;
    if (url) item.url = url;
    if (file) item.file = file;
  }
  const title = line(raw.title, 300); if (title) item.title = title;
  const description = line(raw.description, 500); if (description) item.description = description;
  const author = line(raw.author, 120); if (author) item.author = author;
  const siteName = line(raw.siteName, 80); if (siteName) item.siteName = siteName;
  const published = typeof raw.published === 'string' ? publishedDay(raw.published) : undefined; if (published) item.published = published;
  const image = httpsUrl(raw.image); if (image) item.image = image;
  const favicon = httpsUrl(raw.favicon); if (favicon) item.favicon = favicon;
  const shape = readPreviewShape(raw.shape); if (shape !== undefined) item.shape = shape;
  const canvas = readPlacement(raw.canvas); if (canvas) item.canvas = canvas;
  const body = readBody(raw.body); if (body) item.body = body;
  // Only tags the Collection has, once each: a tag deleted elsewhere simply drops off.
  if (Array.isArray(raw.tags)) {
    const tags = [...new Set(raw.tags.filter((t): t is string => typeof t === 'string' && knownTags.has(t)))];
    if (tags.length) item.tags = tags;
  }
  return item;
}

/** A page's content, read as a Collection. Anything unreadable is left out, and an id is kept once. */
export function readCollection(content: unknown): CollectionDoc {
  const raw = isRecord(content) ? content.collection : undefined;
  const list = isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  const tags = readTags(isRecord(raw) ? raw.tags : undefined);
  const known = new Set(tags.map((t) => t.id));
  const seen = new Set<string>();
  const items: CollectionItem[] = [];
  for (const entry of list) {
    const item = readItem(entry, known);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  const doc: CollectionDoc = { items };
  if (tags.length) doc.tags = tags;
  const sort = isRecord(raw) ? raw.sort : undefined;
  if (sort !== 'manual' && (COLLECTION_SORTS as readonly unknown[]).includes(sort)) doc.sort = sort as CollectionDoc['sort'];
  const view = readView(isRecord(raw) ? raw.view : undefined);
  if (view) doc.view = view;
  return doc;
}

// ── Presentation (COLLECTION_PLAN K11) ──

/** A change to how the Collection shows itself. Anything back at the ordinary is dropped, not written. */
export function setView(doc: CollectionDoc, patch: CollectionView): CollectionDoc {
  const next: CollectionView = {};
  for (const key of ['size', 'fit', 'titles'] as const) {
    const value = key in patch ? patch[key] : doc.view?.[key];
    if (value !== undefined && value !== VIEW_ORDINARY[key]) Object.assign(next, { [key]: value });
  }
  const kept = Object.keys(next).length ? next : undefined;
  const same = JSON.stringify(kept ?? null) === JSON.stringify(doc.view ?? null);
  if (same) return doc;
  const out: CollectionDoc = { ...doc };
  if (kept) out.view = kept; else delete out.view;
  return out;
}

// ── Order (COLLECTION_PLAN K8) ──

/** The order a Collection shows its items in. Manual is kept by leaving it out. */
export function setSort(doc: CollectionDoc, sort: CollectionSort): CollectionDoc {
  if ((doc.sort ?? 'manual') === sort) return doc;
  const next: CollectionDoc = { ...doc };
  if (sort === 'manual') delete next.sort; else next.sort = sort;
  return next;
}

/**
 * An item put at `index` among the OTHER items of the Collection's own order — a drag in the grid. Order is
 * arrangement, like a canvas place, so nothing is dated.
 */
export function moveItem(doc: CollectionDoc, id: string, index: number): CollectionDoc {
  const from = doc.items.findIndex((i) => i.id === id);
  if (from < 0) return doc;
  const rest = doc.items.filter((i) => i.id !== id);
  const at = Math.max(0, Math.min(Math.round(index), rest.length));
  if (at === from) return doc;
  return { ...doc, items: [...rest.slice(0, at), doc.items[from], ...rest.slice(at)] };
}

/** The page's content with this Collection in it. Everything else the page holds stays. */
export function withCollection(content: Record<string, unknown> | null | undefined, doc: CollectionDoc): Record<string, unknown> {
  return { ...(content ?? {}), collection: doc };
}

// ── Making items ──

const KIND_OF_TYPE: Record<string, CollectionItemKind> = {
  Image: 'image', Video: 'video', Audio: 'audio', PDF: 'pdf', Document: 'file', File: 'file',
};

/** What a link points at: a video, a picture, a PDF… or a page to read. */
export function itemKindOfUrl(url: string): CollectionItemKind {
  return KIND_OF_TYPE[collectionType(url)] ?? 'link';
}

export const linkItem = (id: string, url: string, now: string): CollectionItem =>
  ({ id, kind: itemKindOfUrl(url), url, createdAt: now, updatedAt: now });

export const noteItem = (id: string, text: string, now: string): CollectionItem =>
  ({ id, kind: 'note', note: text.trim(), createdAt: now, updatedAt: now });

/** An uploaded file, named by its file name without the extension. */
export function fileItem(id: string, file: CollectionFile, now: string): CollectionItem {
  const kind = attachmentKind(file.mime, file.name);
  const title = file.name.replace(/\.[^.]+$/, '').trim();
  return { id, kind, ...(title ? { title } : {}), file, createdAt: now, updatedAt: now };
}

// ── Changing a collection ──

const mapItem = (doc: CollectionDoc, id: string, fn: (item: CollectionItem) => CollectionItem): CollectionDoc => {
  let changed = false;
  const items = doc.items.map((item) => {
    if (item.id !== id) return item;
    const next = fn(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...doc, items } : doc;
};

/** New items go first, in the order given. An id already here is never added again. */
export function addItems(doc: CollectionDoc, items: readonly CollectionItem[]): CollectionDoc {
  const seen = new Set(doc.items.map((i) => i.id));
  const fresh: CollectionItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    fresh.push(item);
  }
  return fresh.length ? { ...doc, items: [...fresh, ...doc.items] } : doc;
}

export function removeItems(doc: CollectionDoc, ids: readonly string[]): CollectionDoc {
  const gone = new Set(ids);
  const items = doc.items.filter((i) => !gone.has(i.id));
  return items.length === doc.items.length ? doc : { ...doc, items };
}

/** The person's name for an item. Empty takes the name away. */
export function renameItem(doc: CollectionDoc, id: string, title: string, now: string): CollectionDoc {
  const next = line(title, 300);
  return mapItem(doc, id, (item) => {
    if (item.title === next) return item;
    const renamed: CollectionItem = { ...item, updatedAt: now };
    if (next) renamed.title = next; else delete renamed.title;
    return renamed;
  });
}

// ── Notes on an item (COLLECTION_PLAN K9, COLLECTION_VIEW_BRIEF §18, §38) ──

/**
 * The blocks an item's page opens with: what was written about it, a note item's own words, or one
 * empty line. Fresh ids, so call it once — when the page opens — and not on every render.
 */
export function itemBody(item: CollectionItem): Block[] {
  if (item.body?.length) return item.body;
  const written = item.kind === 'note' ? (item.note ?? '').split('\n').map((l) => l.trim()).filter(Boolean) : [];
  return written.length ? written.map((text) => ({ id: genId(), type: 'text' as const, text })) : [emptyBlock()];
}

/**
 * What someone wrote about an item. Writing IS a change to the item, so it is dated; a note item's
 * `note` follows its body, because for a note the two are the same words.
 */
export function setItemBody(doc: CollectionDoc, id: string, blocks: Block[], now: string): CollectionDoc {
  return mapItem(doc, id, (item) => {
    const written = hasBody({ blocks });
    const next: CollectionItem = { ...item, updatedAt: now };
    if (written) next.body = blocks; else delete next.body;
    if (item.kind === 'note') next.note = written ? blocksToText(blocks) : '';
    return next;
  });
}

/**
 * What a link said about itself, filled into its item wherever the item is still empty. Never over
 * what is there (the person's name included), never into an item whose link has changed since it
 * was asked about, and never dated as a change — nobody did anything.
 */
export function fillFromMeta(doc: CollectionDoc, id: string, url: string, meta: LinkMeta | null): CollectionDoc {
  if (!meta) return doc;
  return mapItem(doc, id, (item) => {
    if (item.url !== url) return item;
    const found: Partial<CollectionItem> = {
      title: line(meta.title, 300), description: line(meta.description, 500), author: line(meta.author, 120),
      siteName: line(meta.siteName, 80), published: publishedDay(meta.published),
      image: httpsUrl(meta.image), favicon: httpsUrl(meta.favicon),
    };
    let next = item;
    for (const key of Object.keys(found) as (keyof typeof found)[]) {
      const value = found[key];
      if (value === undefined || item[key] !== undefined) continue;
      if (next === item) next = { ...item };
      (next as Record<string, unknown>)[key] = value;
    }
    return next;
  });
}

/** The shape an item's picture turned out to be — a cache for the layout, not an edit. */
export function rememberShape(doc: CollectionDoc, id: string, shape: number): CollectionDoc {
  const read = readPreviewShape(shape);
  if (read === undefined) return doc;
  return mapItem(doc, id, (item) => (item.shape !== undefined && Math.abs(item.shape - read) <= 0.01 ? item : { ...item, shape: read }));
}

// ── Tags (COLLECTION_PLAN K7; COLLECTION_VIEW_BRIEF §14–16, §31, §42) ──

/** Tag ids as tags, from a Collection's vocabulary, in the order given; an id it lacks is skipped. */
export function resolveTags(vocabulary: readonly CollectionTag[] | undefined, ids: readonly string[] | undefined): CollectionTag[] {
  if (!ids?.length || !vocabulary?.length) return [];
  const byId = new Map(vocabulary.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is CollectionTag => !!t);
}

/** The tags an item carries, as tags, in the order they were put on. */
export const itemTags = (doc: CollectionDoc, item: CollectionItem): CollectionTag[] => resolveTags(doc.tags, item.tags);

/**
 * The tag called `name`: the one the Collection already has (a name is matched without case, so
 * "Typography" and "typography" are one tag), or a new one in the next colour, under `newId`.
 */
export function ensureTag(doc: CollectionDoc, name: string, newId: string): { doc: CollectionDoc; tag: CollectionTag | null } {
  const clean = line(name, TAG_NAME_MAX);
  if (!clean) return { doc, tag: null };
  const tags = doc.tags ?? [];
  const found = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (found) return { doc, tag: found };
  const tag: CollectionTag = { id: newId, name: clean, color: PALETTE_NAMES[tags.length % PALETTE_NAMES.length] };
  return { doc: { ...doc, tags: [...tags, tag] }, tag };
}

/** An item carrying exactly `tagIds`: the Collection's own tags, once each, in the order given. Dated — someone tagged it. */
export function setItemTags(doc: CollectionDoc, id: string, tagIds: readonly string[], now: string): CollectionDoc {
  const known = new Set((doc.tags ?? []).map((t) => t.id));
  const next = [...new Set(tagIds)].filter((t) => known.has(t));
  return mapItem(doc, id, (item) => {
    const current = item.tags ?? [];
    if (current.length === next.length && current.every((t, i) => t === next[i])) return item;
    const tagged: CollectionItem = { ...item, updatedAt: now };
    if (next.length) tagged.tags = next; else delete tagged.tags;
    return tagged;
  });
}

/**
 * One tag put on — or taken off — every item in `ids` at once: the selection bar's Tag. Only the items
 * that change are dated.
 */
export function tagItems(doc: CollectionDoc, ids: readonly string[], tagId: string, on: boolean, now: string): CollectionDoc {
  if (!(doc.tags ?? []).some((t) => t.id === tagId)) return doc;
  const chosen = new Set(ids);
  let changed = false;
  const items = doc.items.map((item) => {
    if (!chosen.has(item.id)) return item;
    const current = item.tags ?? [];
    if (current.includes(tagId) === on) return item;
    changed = true;
    const next = on ? [...current, tagId] : current.filter((t) => t !== tagId);
    const tagged: CollectionItem = { ...item, updatedAt: now };
    if (next.length) tagged.tags = next; else delete tagged.tags;
    return tagged;
  });
  return changed ? { ...doc, items } : doc;
}

/** A tag's new name, on every item that carries it. A name another tag already has is refused: a name is one tag. */
export function renameTag(doc: CollectionDoc, tagId: string, name: string): CollectionDoc {
  const clean = line(name, TAG_NAME_MAX);
  const tags = doc.tags ?? [];
  const tag = tags.find((t) => t.id === tagId);
  if (!clean || !tag || tag.name === clean) return doc;
  if (tags.some((t) => t.id !== tagId && t.name.toLowerCase() === clean.toLowerCase())) return doc;
  return { ...doc, tags: tags.map((t) => (t.id === tagId ? { ...t, name: clean } : t)) };
}

export function recolorTag(doc: CollectionDoc, tagId: string, color: PaletteName): CollectionDoc {
  const tags = doc.tags ?? [];
  if (!(PALETTE_NAMES as readonly string[]).includes(color) || !tags.some((t) => t.id === tagId && t.color !== color)) return doc;
  return { ...doc, tags: tags.map((t) => (t.id === tagId ? { ...t, color } : t)) };
}

/**
 * A tag gone from the Collection, and from every item that carried it. The items are not dated: the
 * vocabulary changed, not what anyone did to them.
 */
export function deleteTag(doc: CollectionDoc, tagId: string): CollectionDoc {
  const tags = doc.tags ?? [];
  if (!tags.some((t) => t.id === tagId)) return doc;
  const rest = tags.filter((t) => t.id !== tagId);
  const items = doc.items.map((item) => {
    if (!item.tags?.includes(tagId)) return item;
    const next = item.tags.filter((t) => t !== tagId);
    const untagged: CollectionItem = { ...item };
    if (next.length) untagged.tags = next; else delete untagged.tags;
    return untagged;
  });
  const out: CollectionDoc = { ...doc, items };
  if (rest.length) out.tags = rest; else delete out.tags;
  return out;
}

// ── The canvas arrangement ──

/**
 * Items put where they were put: position and width (and the measured height) from `boxes`, each
 * item's layer kept. Layout only, so nothing is dated as changed.
 */
export function placeItems(doc: CollectionDoc, boxes: CanvasBoxes): CollectionDoc {
  let changed = false;
  const items = doc.items.map((item) => {
    const box = boxes[item.id];
    if (!box) return item;
    const place: CanvasPlacement = { x: box.x, y: box.y, w: box.w };
    if (box.h !== undefined) place.h = box.h;
    if (item.canvas?.z !== undefined) place.z = item.canvas.z;
    const prev = item.canvas;
    if (prev && prev.x === place.x && prev.y === place.y && prev.w === place.w && prev.h === place.h && prev.z === place.z) return item;
    changed = true;
    return { ...item, canvas: place };
  });
  return changed ? { ...doc, items } : doc;
}

/** Items raised above every other, in the order given (the last on top). Only placed items have a layer. */
export function bringToFront(doc: CollectionDoc, ids: readonly string[]): CollectionDoc {
  const raising = ids.filter((id) => doc.items.some((i) => i.id === id && i.canvas));
  if (!raising.length) return doc;
  const set = new Set(raising);
  const others = doc.items.filter((i) => !set.has(i.id)).map((i) => i.canvas?.z ?? 0);
  const floor = others.length ? Math.max(...others) : -1;
  const zOf = (id: string) => doc.items.find((i) => i.id === id)?.canvas?.z;
  // Already on top, in this order: nothing to do.
  const current = raising.map(zOf);
  if (current.every((z, i) => z !== undefined && z > floor && (i === 0 || z > (current[i - 1] ?? -1)))) return doc;
  let top = floor;
  const next = new Map(raising.map((id) => [id, (top += 1)]));
  return { ...doc, items: doc.items.map((i) => (next.has(i.id) && i.canvas ? { ...i, canvas: { ...i.canvas, z: next.get(i.id)! } } : i)) };
}

/** The saved places, as the canvas geometry (lib/canvas.ts) works with them. */
export function boxesOf(doc: CollectionDoc): CanvasBoxes {
  const out: CanvasBoxes = {};
  for (const item of doc.items) {
    if (!item.canvas) continue;
    const { x, y, w, h } = item.canvas;
    out[item.id] = h !== undefined ? { x, y, w, h } : { x, y, w };
  }
  return out;
}
