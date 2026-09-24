'use client';
// One Collection, live on this device (COLLECTION_PLAN K2).
//
// A Collection's items are on screen the moment they change, and saved behind into its page's
// content — merged over everything else the page holds, so a Collection never erases the page it
// lives on. The store is the ONLY writer of that content: Documents saves a Collection page's name,
// tags and icon, never its body, or a rename would write back an older copy of its items.
//
//   · a change the person made → one undo step, saved after a pause
//   · what the app learned (a link's metadata, a picture's shape) → saved, never a step, and taught
//     to the history as well, so undoing an earlier change never forgets it
//   · a page with only a placeholder id holds its saves until it has its real id (`linkCollectionStore`);
//     a page still being created is written once it exists, and never if it failed
//   · demo (dev-preview): everything local, nothing saved
import { useSyncExternalStore } from 'react';
import { updatePage } from '@/lib/actions/library';
import { toast } from '@/components/ds/ui/toast';
import { readCollection, withCollection, type CollectionDoc } from '@/lib/collection';
import { whenCreated } from '@/lib/page-store';
import { isTempId } from '@/lib/temp-id';

const SAVE_MS = 500;
const HISTORY = 100;

/** One change the person made — what the Collection was before it, and after. */
export type CollectionStep = { before: CollectionDoc; after: CollectionDoc };
type Step = CollectionStep;

export class CollectionStore {
  private doc: CollectionDoc;
  /** Everything else the page holds, kept as it was read and written back around the items. */
  private readonly base: Record<string, unknown>;
  private readonly listeners = new Set<() => void>();
  private undoStack: Step[] = [];
  private redoStack: Step[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  readonly demo: boolean;
  pageId: string;

  constructor(pageId: string, content: Record<string, unknown> | undefined, opts: { demo?: boolean } = {}) {
    this.pageId = pageId;
    const base = { ...(content ?? {}) };
    delete base.collection;
    this.base = base;
    this.doc = readCollection(content);
    this.demo = !!opts.demo;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getState = (): CollectionDoc => this.doc;
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  private set(doc: CollectionDoc) {
    this.doc = doc;
    this.listeners.forEach((fn) => fn());
    this.queueSave();
  }

  /** A change the person made: on screen now, one undo step, saved behind. Says whether anything changed. */
  change(fn: (doc: CollectionDoc) => CollectionDoc): boolean {
    const before = this.doc;
    const after = fn(before);
    if (after === before) return false;
    this.undoStack.push({ before, after });
    if (this.undoStack.length > HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.set(after);
    return true;
  }

  /**
   * What the app learned — a link's metadata, the shape of a picture. Saved like a change, but never
   * a step of its own; and taught to every step in the history, so taking back an earlier change
   * does not take this with it.
   */
  learn(fn: (doc: CollectionDoc) => CollectionDoc): void {
    // Taught in place: a step keeps its identity, so a toast holding it can still take it back.
    for (const step of [...this.undoStack, ...this.redoStack]) {
      step.before = fn(step.before);
      step.after = fn(step.after);
    }
    const next = fn(this.doc);
    if (next !== this.doc) this.set(next);
  }

  undo() {
    const step = this.undoStack.pop();
    if (!step) return;
    this.redoStack.push(step);
    this.set(step.before);
  }

  redo() {
    const step = this.redoStack.pop();
    if (!step) return;
    this.undoStack.push(step);
    this.set(step.after);
  }

  /** The latest step — for a toast's Undo, which must take back that change and no other. */
  lastStep(): CollectionStep | null {
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  /** Undo `step` while it is still the latest. Says whether it did. */
  undoStep(step: CollectionStep | null): boolean {
    if (!step || this.undoStack[this.undoStack.length - 1] !== step) return false;
    this.undo();
    return true;
  }

  /** The page has its real id now: saves go there, beginning with any that were held. */
  rekey(pageId: string) {
    this.pageId = pageId;
    if (this.dirty) this.queueSave();
  }

  /** Save now rather than after the pause — the Collection is being left, or copied. */
  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    return this.save();
  }

  private queueSave() {
    if (this.demo) return;
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.save(); }, SAVE_MS);
  }

  private async save() {
    if (this.demo || !this.dirty) return;
    const id = this.pageId;
    // A placeholder names a page the server has never seen; `rekey` saves what was held.
    if (isTempId(id)) return;
    const creation = whenCreated(id);
    if (creation) {
      const made = await creation;
      if ('error' in made) return;
    }
    if (this.pageId !== id) return;
    this.dirty = false;
    const res = await updatePage(id, { content: withCollection(this.base, this.doc) });
    if ('error' in res) {
      this.dirty = true;
      toast({ message: 'Could not save the collection.', variant: 'error' });
    }
  }
}

const stores = new Map<string, CollectionStore>();

/** The one store for a Collection page, made from its content the first time it is asked for. */
export function collectionStoreFor(pageId: string, content: Record<string, unknown> | undefined, opts: { demo?: boolean } = {}): CollectionStore {
  let store = stores.get(pageId);
  if (!store) {
    store = new CollectionStore(pageId, content, opts);
    stores.set(pageId, store);
  }
  return store;
}

/** A Collection page made on this device has its real id: the same store answers to it, and saves there. */
export function linkCollectionStore(tempId: string, realId: string): CollectionStore | undefined {
  const store = stores.get(tempId);
  if (!store) return undefined;
  stores.delete(tempId);
  stores.set(realId, store);
  store.rekey(realId);
  return store;
}

/**
 * A Collection's items as they stand on this device — for anything that shows them without opening the page (the
 * Index's cards). A store answers for a Collection opened here, since the page list keeps what was loaded; any
 * other Collection is read from its content.
 */
export function collectionDocFor(pageId: string, content: unknown): CollectionDoc {
  return stores.get(pageId)?.getState() ?? readCollection(content);
}

/**
 * A Collection page's content as it stands on this device — for anything that copies the page. The page
 * list keeps the content a page was loaded with (this store, never Documents, writes a Collection's
 * items), so a copy made from it would miss everything collected since. What is waiting to be saved is
 * saved first, so the server copies the same thing.
 */
export async function settledCollectionContent(pageId: string, content: Record<string, unknown>): Promise<Record<string, unknown>> {
  const store = stores.get(pageId);
  if (!store) return content;
  await store.flush();
  return withCollection(content, store.getState());
}

/** Test seam: forget every store. */
export function resetCollectionStoresForTest(): void {
  stores.clear();
}

/** A Collection's items, kept current. */
export function useCollection(store: CollectionStore): CollectionDoc {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
