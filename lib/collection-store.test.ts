import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The store reaches the server through one action, and waits on a page still being made.
vi.mock('@/lib/actions/library', () => ({ updatePage: vi.fn(async (): Promise<{ ok: true } | { error: string }> => ({ ok: true })) }));
vi.mock('@/lib/page-store', () => ({ whenCreated: vi.fn((): Promise<{ ok: true } | { error: string }> | null => null) }));
vi.mock('@/components/ds/ui/toast', () => ({ toast: vi.fn() }));

import { updatePage } from '@/lib/actions/library';
import { whenCreated } from '@/lib/page-store';
import { toast } from '@/components/ds/ui/toast';
import { CollectionStore, collectionDocFor, collectionStoreFor, linkCollectionStore, resetCollectionStoresForTest, settledCollectionContent } from './collection-store';
import { addItems, fillFromMeta, linkItem, renameItem, type CollectionDoc } from './collection';

// COLLECTION_PLAN K2 — one Collection, live on this device. Every change is on screen at once,
// undoable, and saved behind into the page's content, over everything else the page holds.
const T0 = '2026-09-15T10:00:00.000Z';
const PAGE = '11111111-1111-4111-8111-111111111111';
const add = (id: string, url = `https://example.com/${id}`) => (doc: CollectionDoc) => addItems(doc, [linkItem(id, url, T0)]);
const ids = (s: CollectionStore) => s.getState().items.map((i) => i.id);

// Duplicate copies a Collection. The page list keeps the content a page was loaded with — the store,
// never Documents, writes a Collection's items — so a copy must be made from what is on screen, and the
// server must have it too before it copies.
// The Index draws every Collection from the page list — whose content is older than the store for one opened here.
describe('collectionDocFor — a Collection as it stands, for a card that shows it', () => {
  beforeEach(() => { resetCollectionStoresForTest(); });

  it('reads the live store for a Collection opened on this device', () => {
    const loaded = { collection: { items: [] } };
    const s = collectionStoreFor(PAGE, loaded, { demo: true });
    s.change(add('a'));
    expect(collectionDocFor(PAGE, loaded)).toBe(s.getState());
  });

  it('reads the content for a Collection never opened here', () => {
    expect(collectionDocFor(PAGE, { collection: { items: [linkItem('a', 'https://a.example', T0)] } }).items.map((i) => i.id)).toEqual(['a']);
    expect(collectionDocFor(PAGE, undefined).items).toEqual([]);
  });
});

describe('settledCollectionContent — what a copy of a Collection copies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(whenCreated).mockReturnValue(null);
    vi.useFakeTimers();
    resetCollectionStoresForTest();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('saves what is waiting first, then answers with the items on screen over everything else the page holds', async () => {
    const loaded = { blocks: [], cover: 'dusk', collection: { items: [] } };
    const s = collectionStoreFor(PAGE, loaded);
    s.change(add('a'));
    const content = await settledCollectionContent(PAGE, loaded);
    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(content).toEqual({ blocks: [], cover: 'dusk', collection: s.getState() });
    await vi.advanceTimersByTimeAsync(1000);
    expect(updatePage).toHaveBeenCalledTimes(1);
  });

  it('answers with the content as given for a Collection never opened on this device', async () => {
    const loaded = { blocks: [], collection: { items: [linkItem('a', 'https://a.example', T0)] } };
    expect(await settledCollectionContent(PAGE, loaded)).toEqual(loaded);
    expect(updatePage).not.toHaveBeenCalled();
  });

  it('copies a demo Collection as it stands, and saves nothing', async () => {
    const s = collectionStoreFor(PAGE, { demoCollection: true }, { demo: true });
    s.change(add('a'));
    expect(await settledCollectionContent(PAGE, { demoCollection: true })).toEqual({ demoCollection: true, collection: s.getState() });
    expect(updatePage).not.toHaveBeenCalled();
  });
});

describe('CollectionStore — one Collection, live on this device', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(whenCreated).mockReturnValue(null);
    vi.useFakeTimers();
    resetCollectionStoresForTest();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('reads the page it was given', () => {
    const s = new CollectionStore(PAGE, { blocks: [], collection: { items: [linkItem('a', 'https://a.example', T0)] } }, { demo: true });
    expect(ids(s)).toEqual(['a']);
  });

  it('applies a change at once, and saves it once, merged over everything else the page holds', async () => {
    const s = new CollectionStore(PAGE, { blocks: [], cover: 'dusk' });
    s.change(add('a'));
    s.change(add('b'));
    expect(ids(s)).toEqual(['b', 'a']);
    expect(updatePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(updatePage).toHaveBeenCalledWith(PAGE, { content: { blocks: [], cover: 'dusk', collection: s.getState() } });
  });

  it('takes a change back with undo, puts it back with redo, and saves each', async () => {
    const s = new CollectionStore(PAGE, undefined);
    s.change(add('a'));
    s.change((doc) => renameItem(doc, 'a', 'Named', T0));
    s.undo();
    expect(s.getState().items[0].title).toBeUndefined();
    s.undo();
    expect(ids(s)).toEqual([]);
    expect(s.canUndo).toBe(false);
    s.redo();
    expect(ids(s)).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(updatePage).toHaveBeenLastCalledWith(PAGE, { content: { collection: { items: [expect.objectContaining({ id: 'a' })] } } });
  });

  it('records nothing for a change that changes nothing', () => {
    const s = new CollectionStore(PAGE, undefined, { demo: true });
    expect(s.change((doc) => doc)).toBe(false);
    expect(s.canUndo).toBe(false);
  });

  it('learns without an undo step — and what it learned survives undoing what came before', () => {
    const s = new CollectionStore(PAGE, undefined, { demo: true });
    s.change(add('a', 'https://example.com/post'));
    s.change((doc) => renameItem(doc, 'a', 'Mine', T0));
    s.learn((doc) => fillFromMeta(doc, 'a', 'https://example.com/post', { url: 'https://example.com/post', title: 'A post', author: 'Ann' }));
    expect(s.getState().items[0]).toMatchObject({ title: 'Mine', author: 'Ann' });
    s.undo(); // the rename
    expect(s.getState().items[0]).toMatchObject({ title: 'A post', author: 'Ann' });
    s.redo();
    expect(s.getState().items[0]).toMatchObject({ title: 'Mine', author: 'Ann' });
  });

  it('never saves a demo Collection', async () => {
    const s = new CollectionStore(PAGE, undefined, { demo: true });
    s.change(add('a'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(updatePage).not.toHaveBeenCalled();
  });

  it('holds its saves while its page has only a placeholder id, then saves under the real one', async () => {
    const s = collectionStoreFor('tmp-abc1234', undefined);
    s.change(add('a'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(updatePage).not.toHaveBeenCalled();
    expect(linkCollectionStore('tmp-abc1234', PAGE)).toBe(s);
    expect(collectionStoreFor(PAGE, undefined)).toBe(s);
    await vi.advanceTimersByTimeAsync(1000);
    expect(updatePage).toHaveBeenCalledWith(PAGE, { content: { collection: { items: [expect.objectContaining({ id: 'a' })] } } });
  });

  it('waits for a page still being created, and writes nothing if it never was', async () => {
    let finish: (r: { ok: true } | { error: string }) => void = () => {};
    vi.mocked(whenCreated).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const s = new CollectionStore(PAGE, undefined);
    s.change(add('a'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(updatePage).not.toHaveBeenCalled();
    finish({ error: 'offline' });
    await vi.advanceTimersByTimeAsync(10);
    expect(updatePage).not.toHaveBeenCalled();
  });

  it('says so when a save fails', async () => {
    vi.mocked(updatePage).mockResolvedValueOnce({ error: 'nope' });
    const s = new CollectionStore(PAGE, undefined);
    s.change(add('a'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
  });

  it('keeps one store per page', () => {
    expect(collectionStoreFor(PAGE, undefined)).toBe(collectionStoreFor(PAGE, { collection: { items: [] } }));
  });
});

describe('undoStep — a toast takes back exactly its own change', () => {
  beforeEach(() => { resetCollectionStoresForTest(); });

  it('undoes the step it names while it is still the latest, even after the app learned something', () => {
    const s = new CollectionStore(PAGE, undefined, { demo: true });
    s.change(add('a', 'https://example.com/post'));
    const step = s.lastStep();
    s.learn((doc) => fillFromMeta(doc, 'a', 'https://example.com/post', { url: 'https://example.com/post', title: 'A post' }));
    expect(s.undoStep(step)).toBe(true);
    expect(ids(s)).toEqual([]);
  });

  it('does nothing once another change came after it', () => {
    const s = new CollectionStore(PAGE, undefined, { demo: true });
    s.change(add('a'));
    const step = s.lastStep();
    s.change(add('b'));
    expect(s.undoStep(step)).toBe(false);
    expect(ids(s)).toEqual(['b', 'a']);
  });
});
