'use client';
// The pages this device knows — held once, so every place that shows a page shows
// the same one: a page block's title and icon, a page opened inside a peek, a page
// made a moment ago with `/page`.
//
// Pages nest without end (the user, 2026-09-15: "all database is just bunch of pages
// like Notion … nested into nested infinite page"). A page block holds only the id
// of the page it opens; its name and icon are the page's own, read from here, so a
// page renamed anywhere is renamed everywhere it is linked from.
//
// Creation follows the database's rule (lib/db-store.ts, T1/T2): the id is minted in
// the browser, the page is on screen at once, and the server is told behind it. Its
// edits wait for that creation (`whenCreated`) and are dropped if it failed, and a
// failed page says so where it is linked, with Try again.
import { useEffect, useSyncExternalStore } from 'react';
import { addPage, getPage, updatePage } from '@/lib/actions/library';
import { mintUuid } from '@/lib/temp-id';
import { toast } from '@/components/ds/ui/toast';

export type PageRecord = {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  /**
   * What kind of page it is — a document ('note'), a database, a Collection
   * (COLLECTION_ITEM_BRIEF). Absent while nobody has said, which reads as a document.
   */
  type?: string;
  /** The body. Absent while only the page's name is known (a Documents listing). */
  content?: Record<string, unknown>;
};

export type PageEntry =
  | { state: 'ready'; record: PageRecord }
  | { state: 'loading'; record?: PageRecord }
  /** The server has no such page — deleted, or someone else's. */
  | { state: 'missing'; record?: PageRecord }
  /** Made on this device and never saved (`create`), or could not be read (`read`). */
  | { state: 'failed'; during: 'create' | 'read'; record?: PageRecord; error: string };

type Patch = Partial<Pick<PageRecord, 'title' | 'icon' | 'content'>>;
type Result = { ok: true } | { error: string };

const SAVE_MS = 400;
const entries = new Map<string, PageEntry>();
const listeners = new Set<() => void>();
const creations = new Map<string, Promise<Result>>();
const saves = new Map<string, { patch: Patch; timer: ReturnType<typeof setTimeout> }>();
const createdListeners = new Set<(record: PageRecord) => void>();

const emit = () => listeners.forEach((fn) => fn());
const set = (id: string, entry: PageEntry) => { entries.set(id, entry); emit(); };

export function subscribePages(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const pageEntry = (id: string | null | undefined): PageEntry | undefined => (id ? entries.get(id) : undefined);

/**
 * Tell the store about pages a host already has — Documents' listing. A page with
 * an edit still waiting to be saved keeps its own name and icon: the listing is
 * older than what is on screen.
 */
export function seedPages(list: (Pick<PageRecord, 'id' | 'title' | 'icon' | 'parentId'> & { type?: string; content?: Record<string, unknown> })[]): void {
  let changed = false;
  for (const p of list) {
    const prev = entries.get(p.id)?.record;
    if (saves.has(p.id) || creations.has(p.id)) continue;
    const next: PageRecord = { ...prev, ...p, title: p.title ?? '', type: p.type ?? prev?.type, content: p.content ?? prev?.content };
    if (prev && prev.title === next.title && prev.icon === next.icon && prev.parentId === next.parentId && prev.type === next.type && prev.content === next.content) continue;
    entries.set(p.id, { state: 'ready', record: next });
    changed = true;
  }
  if (changed) emit();
}

/** Read a page from the server — once at a time, and never one made here and not yet saved. */
export function loadPage(id: string): Promise<void> {
  const prev = entries.get(id);
  if (prev?.state === 'loading' || creations.has(id)) return Promise.resolve();
  set(id, { state: 'loading', record: prev?.record });
  return getPage(id)
    .then((res) => {
      if ('error' in res) {
        set(id, res.error === 'Not found.' ? { state: 'missing', record: prev?.record } : { state: 'failed', during: 'read', record: prev?.record, error: res.error });
        return;
      }
      set(id, { state: 'ready', record: { id: res.id, title: res.title ?? '', icon: res.icon, parentId: res.parentId, type: res.type, content: res.content } });
    })
    .catch((e: unknown) => set(id, { state: 'failed', during: 'read', record: prev?.record, error: e instanceof Error ? e.message : '' }));
}

/**
 * A page, kept current. `body` asks for its content too — a page block needs only
 * the name; a page being read or written needs everything.
 */
export function usePage(id: string | null | undefined, opts: { body?: boolean } = {}): PageEntry | undefined {
  const entry = useSyncExternalStore(subscribePages, () => pageEntry(id), () => undefined);
  const needs = !!id && (!entry || (opts.body && entry.state === 'ready' && entry.record.content === undefined));
  useEffect(() => {
    if (needs && id) void loadPage(id);
  }, [needs, id]);
  return entry;
}

/** Called with every page made on this device — Documents lists it at once. */
export function onPageCreated(fn: (record: PageRecord) => void): () => void {
  createdListeners.add(fn);
  return () => { createdListeners.delete(fn); };
}

function persist(record: PageRecord): Promise<Result> {
  const creation = addPage({ id: record.id, parentId: record.parentId, title: record.title, ...(record.type ? { type: record.type } : {}) })
    .then((res): Result => ('error' in res ? { error: res.error } : { ok: true }))
    .catch((e: unknown): Result => ({ error: e instanceof Error ? e.message : '' }));
  creations.set(record.id, creation);
  void creation.then((res) => {
    const cur = entries.get(record.id)?.record ?? record;
    if ('error' in res) set(record.id, { state: 'failed', during: 'create', record: cur, error: res.error });
    else creations.delete(record.id);
  });
  return creation;
}

/**
 * Make a page inside `parentId`, on screen at once — a document, unless `type` makes it another
 * kind of page (`/collection` makes a Collection, named "New collection"). Returns its id and the
 * promise of its creation.
 */
export function newPage(opts: { parentId: string | null; type?: string; title?: string }): { id: string; creation: Promise<Result> } {
  const record: PageRecord = {
    id: mintUuid(), title: opts.title ?? '', icon: null, parentId: opts.parentId, content: { blocks: [] },
    ...(opts.type ? { type: opts.type } : {}),
  };
  entries.set(record.id, { state: 'ready', record });
  emit();
  createdListeners.forEach((fn) => fn(record));
  return { id: record.id, creation: persist(record) };
}

/**
 * The creation of a page made on this device while it is still in flight (or if it
 * failed); null once the page exists. A host with its own save — Documents' autosave
 * — waits on it, or its first edit would update a row that is not there yet.
 */
export function whenCreated(id: string): Promise<Result> | null {
  return creations.get(id) ?? null;
}

/** Try a failed creation again, under the same id — the block that links it does not change. */
export function retryPage(id: string): Promise<Result> {
  const record = entries.get(id)?.record;
  if (!record) return Promise.resolve({ error: 'Nothing to retry.' });
  set(id, { state: 'ready', record });
  return persist(record);
}

/**
 * Edit a page: on screen now, saved after a pause, merged with any edit still
 * waiting. A page still being created is saved once it exists — and not at all if
 * it never does, because there is nowhere to save it.
 */
export function patchPage(id: string, patch: Patch): void {
  const prev = entries.get(id);
  const base = prev?.record;
  if (!base) return;
  const record = { ...base, ...patch };
  entries.set(id, prev.state === 'failed' ? { ...prev, record } : { state: 'ready', record });
  emit();
  const queued = saves.get(id);
  if (queued) clearTimeout(queued.timer);
  const merged = { ...queued?.patch, ...patch };
  saves.set(id, {
    patch: merged,
    timer: setTimeout(() => {
      saves.delete(id);
      const write = () => updatePage(id, merged).then((res) => {
        if ('error' in res) toast({ message: 'Could not save the page.', variant: 'error' });
      });
      const creation = creations.get(id);
      void (creation ? creation.then((res) => { if ('ok' in res) return write(); }) : write());
    }, SAVE_MS),
  });
}

/** Test seam: forget everything. */
export function resetPagesForTest(): void {
  for (const s of saves.values()) clearTimeout(s.timer);
  entries.clear(); creations.clear(); saves.clear(); createdListeners.clear(); listeners.clear();
}
