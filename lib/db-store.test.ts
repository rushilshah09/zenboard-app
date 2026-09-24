import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DbStore, beginDatabase, linkPageStore, hostOnPage, newDatabase, subscribeStores,
  storeForPage, storeForCollection, loadPlan, pageForCollection,
} from './db-store';
import { defaultCollection, type Collection, type DbRow } from './collections';
import * as actions from '@/lib/actions/collections';
import { FAILURE_COPY } from '@/lib/action-failure';

// The store reaches the server only through these four actions; the tests read
// what it ASKED for. Demo stores never call them.
vi.mock('@/lib/actions/collections', () => ({
  updateCollection: vi.fn(async () => ({ ok: true })),
  addDbRow: vi.fn(async () => ({ id: 'server-row' })),
  updateDbRow: vi.fn(async () => ({ ok: true })),
  deleteDbRow: vi.fn(async () => ({ ok: true })),
  createDatabase: vi.fn(async (): Promise<{ ok: true } | { error: string }> => ({ ok: true })),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/components/ds/ui/toast', () => ({ toast: vi.fn() }));

// Demo mode: every op is local, nothing is persisted, no Supabase client is
// ever constructed. That is exactly the surface worth testing — the ordering
// and undo semantics that the "a row is a page" repoint moved onto new columns.
const collection = (): Collection => ({ id: 'c1', page_id: null, name: 'Test', ...defaultCollection() });
const row = (id: string, order: string, over: Partial<DbRow> = {}): DbRow => ({
  id, title: id, data: {}, order,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
});
const store = (rows: DbRow[] = []) => new DbStore(collection(), rows, true);
const orders = (s: DbStore) => s.getState().rows.map((r) => r.order);

describe('addRow ordering', () => {
  it('appends after the highest key, not after the last array element', () => {
    // The array is deliberately out of order: `orderAppend` must read the keys,
    // not trust the position.
    const s = store([row('a', 'a5'), row('b', 'a9'), row('c', 'a1')]);
    s.addRow();
    const added = s.getState().rows[3];
    expect(added.order > 'a9').toBe(true);
  });

  it('starts an empty database somewhere with room on both sides', () => {
    const s = store();
    s.addRow();
    const k = s.getState().rows[0].order;
    expect(k > '0').toBe(true);
    expect(k < 'z').toBe(true);
  });

  it('keeps 30 successive appends strictly increasing', () => {
    const s = store();
    for (let i = 0; i < 30; i++) s.addRow();
    const keys = orders(s);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(30);
  });

  it('gives a new row an empty body rather than leaving it undefined', () => {
    const s = store();
    s.addRow();
    expect(s.getState().rows[0].content).toEqual({ blocks: [] });
  });

  it('undoing and redoing a run of adds leaves the keys distinct and ordered', () => {
    // The key is computed inside `insert()`, not captured once when the op was
    // built — so a redo reads the list as it stands rather than reusing a key
    // that may no longer be free.
    const s = store();
    s.addRow(); s.addRow(); s.addRow();
    s.undo(); s.undo(); s.undo();
    expect(s.getState().rows).toHaveLength(0);
    s.redo(); s.redo(); s.redo();
    const keys = orders(s);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe('patchRow', () => {
  it('applies a body edit and undo restores the previous body', () => {
    const before = { blocks: [{ id: 'b1', type: 'p', text: 'before' }] };
    const s = store([row('a', 'a1', { content: before })]);
    s.patchRow('a', { content: { blocks: [{ id: 'b1', type: 'p', text: 'after' }] } });
    expect(s.getState().rows[0].content).toEqual({ blocks: [{ id: 'b1', type: 'p', text: 'after' }] });
    s.undo();
    expect(s.getState().rows[0].content).toEqual(before);
  });

  it('a body edit leaves the property bag alone', () => {
    // The point of moving the body off `data.__content`: writing prose can no
    // longer clobber a cell edit that was in flight.
    const s = store([row('a', 'a1', { data: { status: 'done' } })]);
    s.patchRow('a', { content: { blocks: [] } });
    expect(s.getState().rows[0].data).toEqual({ status: 'done' });
  });

  it('a cell edit leaves the body alone', () => {
    const body = { blocks: [{ id: 'b1', type: 'p', text: 'kept' }] };
    const s = store([row('a', 'a1', { content: body })]);
    s.patchRow('a', { data: { status: 'done' } });
    expect(s.getState().rows[0].content).toEqual(body);
  });

  it('a board drop moves a row to a new column AND place as one undoable step', () => {
    // Two steps would take two ⌘Z to put a card back, and the first would leave
    // it in its old column at its new height — a place it never was.
    const s = store([row('a', 'a1', { data: { status: 'todo' } }), row('b', 'a5')]);
    s.patchRow('a', { data: { status: 'done' }, order: 'a7' });
    expect(s.getState().rows[0]).toMatchObject({ data: { status: 'done' }, order: 'a7' });
    s.undo();
    expect(s.getState().rows[0]).toMatchObject({ data: { status: 'todo' }, order: 'a1' });
  });
});

describe('transact — several ops, one step', () => {
  it('a drop that re-keys neighbours and clears a sort undoes and redoes as one', () => {
    const s = store([row('a', 'k'), row('b', 'k'), row('c', 'k')]);
    const views = s.getState().col.views;
    const sorted = views.map((v, i) => (i === 0 ? { ...v, sorts: [{ prop: views[0].id, dir: 'asc' as const }] } : v));
    s.patchCol({ views: sorted });
    s.transact(() => {
      s.patchCol({ views });
      s.patchRow('b', { order: 'm' });
      s.patchRow('c', { order: 'p' });
    });
    expect(orders(s)).toEqual(['k', 'm', 'p']);
    s.undo();
    expect(orders(s)).toEqual(['k', 'k', 'k']);
    expect(s.getState().col.views).toEqual(sorted);
    s.redo();
    expect(orders(s)).toEqual(['k', 'm', 'p']);
    expect(s.getState().col.views).toEqual(views);
    // …and the sort that went before it is still its own, earlier step.
    s.undo(); s.undo();
    expect(s.getState().col.views).toEqual(views);
    expect(s.canUndo).toBe(false);
  });

  it('records nothing for a transaction that changed nothing', () => {
    const s = store([row('a', 'k')]);
    expect(s.transact(() => {})).toBeNull();
    expect(s.canUndo).toBe(false);
  });

  it('a transaction inside another joins the outer step', () => {
    const s = store([row('a', 'a'), row('b', 'b')]);
    s.transact(() => {
      s.patchRow('a', { title: 'A' });
      s.transact(() => s.patchRow('b', { title: 'B' }));
    });
    s.undo();
    expect(s.getState().rows.map((r) => r.title)).toEqual(['a', 'b']);
    expect(s.canUndo).toBe(false);
  });
});

describe('removeRow', () => {
  it('undo puts the row back at its original key, not at the end', () => {
    const s = store([row('a', 'a1'), row('b', 'a5'), row('c', 'a9')]);
    s.removeRow('b');
    expect(orders(s)).toEqual(['a1', 'a9']);
    s.undo();
    expect(orders(s)).toEqual(['a1', 'a5', 'a9']);
  });

  it('undoEntry only fires while it is still the newest edit', () => {
    const s = store([row('a', 'a1')]);
    const entry = s.removeRow('a')!;
    s.addRow(); // something else happened since
    expect(s.undoEntry(entry)).toBe(false);
    expect(s.getState().rows.some((r) => r.id === 'a')).toBe(false);
  });
});

describe('a database that is still being created', () => {
  // The user opened a new database and started typing before the server had
  // confirmed it existed. The screen must not wait for the server — and the data
  // must not race it: every write is held until the database exists, then sent
  // against the same ids the screen already shows. Nothing reaches the server
  // for a database the server has never seen.
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  const deferred = () => {
    let resolve!: (v: { ok: true } | { error: string }) => void;
    const promise = new Promise<{ ok: true } | { error: string }>((r) => { resolve = r; });
    return { promise, resolve };
  };
  const pending = (id: string): Collection => ({ ...collection(), id });

  it('holds every write until the database exists, then sends them against the final ids', async () => {
    const creation = deferred();
    const s = beginDatabase(pending('col-hold'), [row('row-1', 'a1')], creation.promise);
    s.patchCol({ name: 'Launch plan' });
    s.patchRow('row-1', { title: 'First task' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(actions.updateCollection).not.toHaveBeenCalled();
    expect(actions.updateDbRow).not.toHaveBeenCalled();

    creation.resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(actions.updateCollection).toHaveBeenCalledWith('col-hold', expect.objectContaining({ name: 'Launch plan' }));
    expect(actions.updateDbRow).toHaveBeenCalledWith('row-1', expect.objectContaining({ title: 'First task' }));
  });

  it('writes nothing at all if the database could not be created', async () => {
    const creation = deferred();
    const s = beginDatabase(pending('col-fail'), [row('row-2', 'a1')], creation.promise);
    s.patchRow('row-2', { title: 'Typed too early' });
    s.addRow();
    creation.resolve({ error: 'offline' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(actions.updateDbRow).not.toHaveBeenCalled();
    expect(actions.addDbRow).not.toHaveBeenCalled();
  });

  it('is found by its page, and follows the page when the page id becomes real', () => {
    const real = '5b0e9c9a-2f53-4f8a-9d3b-1c2e3f4a5b6c';
    const s = beginDatabase(pending('col-page'), [], deferred().promise, 'tmp-page-1');
    expect(storeForPage('tmp-page-1')).toBe(s);
    linkPageStore('tmp-page-1', real);
    expect(storeForPage(real)).toBe(s);
    expect(storeForCollection('col-page')).toBe(s);
  });
});

describe('loadPlan — nothing is ever fetched with a placeholder id', () => {
  // The bug the user screenshotted: a new database page mounted under `tmp-…`,
  // fetched with it, and printed Postgres's uuid error as the page — which then
  // stayed on screen even after the real id arrived.
  const real = '5b0e9c9a-2f53-4f8a-9d3b-1c2e3f4a5b6c';

  it('waits on a temporary id when this device has nothing to show yet', () => {
    expect(loadPlan('tmp-mu1ekfp3-1', null)).toBe('wait');
  });
  it('shows what this device already holds without asking the server', () => {
    expect(loadPlan('tmp-mu1ekfp3-1', store())).toBe('local');
    expect(loadPlan(real, store())).toBe('local');
  });
  it('fetches a real id it has never seen', () => {
    expect(loadPlan(real, null)).toBe('fetch');
  });
  it('waits when there is no id at all', () => {
    expect(loadPlan(undefined, null)).toBe('wait');
  });
});

describe('newDatabase — on screen before the server has it', () => {
  // What the slash menu and "New database" call. The table renders from what this
  // returns with nothing awaited — and what it later persists must be exactly what
  // was rendered, or an edit made in between points at a property or a row the
  // server never received.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  beforeEach(() => { vi.clearAllMocks(); });

  it('is registered at once, with one empty row, under ids the server will keep', () => {
    const { store } = newDatabase({ kind: 'board' });
    const { col, rows } = store.getState();
    expect(col.id).toMatch(UUID);
    expect(rows.map((r) => r.id)).toEqual([expect.stringMatching(UUID)]);
    expect(col.views[0]).toMatchObject({ kind: 'board', name: 'Board' });
    expect(storeForCollection(col.id)).toBe(store);
    expect(actions.createDatabase).not.toHaveBeenCalled();
  });

  it('persists exactly the ids and schema it rendered, under the page’s real id', async () => {
    const page = '5b0e9c9a-2f53-4f8a-9d3b-1c2e3f4a5b6c';
    const { store, persist } = newDatabase({ pageId: 'tmp-page-9' });
    expect(storeForPage('tmp-page-9')).toBe(store);
    await expect(persist(page)).resolves.toEqual({ ok: true });
    const { col, rows } = store.getState();
    expect(actions.createDatabase).toHaveBeenCalledWith({
      collectionId: col.id, firstRowId: rows[0].id, firstRowData: rows[0].data, pageId: page, props: col.props, views: col.views,
    });
  });

  it("starts its first row in the status's first option, on screen and on the server", async () => {
    // A new board used to open with its one card in "No Status" (T7 / brief §16).
    const { store, persist } = newDatabase({ kind: 'board' });
    const { col, rows } = store.getState();
    const status = col.props.find((p) => p.type === 'status')!;
    expect(rows[0].data).toEqual({ [status.id]: status.options![0].id });
    await persist();
    expect(actions.createDatabase).toHaveBeenCalledWith(expect.objectContaining({ firstRowData: rows[0].data }));
  });

  it('leaves the registry when creation fails, and tells the views showing it', async () => {
    // A view still holding a database the server refused would keep taking edits
    // that can never be saved. Leaving the registry sends it back to the server.
    vi.mocked(actions.createDatabase).mockResolvedValueOnce({ error: 'offline' });
    const told = vi.fn();
    const stop = subscribeStores(told);
    const { store, persist } = newDatabase({ pageId: 'tmp-page-10' });
    told.mockClear();
    await expect(persist()).resolves.toEqual({ error: 'offline' });
    await flush();
    expect(storeForCollection(store.getState().col.id)).toBeNull();
    expect(storeForPage('tmp-page-10')).toBeNull();
    expect(told).toHaveBeenCalled();
    stop();
  });

  it('sends nothing at all when abandoned before it could be saved', async () => {
    vi.useFakeTimers();
    try {
      const { store, abandon } = newDatabase();
      store.patchCol({ name: 'Never saved' });
      abandon('The page was not created.');
      await vi.advanceTimersByTimeAsync(1000);
      expect(actions.createDatabase).not.toHaveBeenCalled();
      expect(actions.updateCollection).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a thrown failure as a failure, in words that are true for it', async () => {
    // Offline: the network's own wording is per-browser, so the net's line is used.
    vi.mocked(actions.createDatabase).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(newDatabase().persist()).resolves.toEqual({ error: FAILURE_COPY.unreachable });
    // A server throw reaches the browser as a digest over a redacted message, which
    // is never shown. (The net's `server` line promises a refresh nothing runs here.)
    const redacted = Object.assign(new Error('An error occurred in the Server Components render.'), { digest: '123' });
    vi.mocked(actions.createDatabase).mockRejectedValueOnce(redacted);
    await expect(newDatabase().persist()).resolves.toEqual({ error: 'Could not create database.' });
  });
});

describe('hostOnPage — "Turn into page" shows the live database at once', () => {
  it('points a page at a collection this device holds, and ignores one it does not', () => {
    const s = beginDatabase({ ...collection(), id: 'col-host' }, [], Promise.resolve({ ok: true }));
    hostOnPage('tmp-page-host', 'col-host');
    expect(storeForPage('tmp-page-host')).toBe(s);
    hostOnPage('tmp-page-none', 'col-missing');
    expect(storeForPage('tmp-page-none')).toBeNull();
  });
});

describe("currentId — a page opened on a new row survives the server's id", () => {
  // New opens the new row's page at once, under the placeholder the store minted, and
  // the server's id replaces it a moment later. A view holding the placeholder must
  // still find the row, or the page it has just opened closes itself.
  beforeEach(() => { vi.clearAllMocks(); });

  it('follows a placeholder to the id the server gave it', async () => {
    vi.mocked(actions.addDbRow).mockResolvedValueOnce({ id: 'server-row-7' });
    const s = new DbStore(collection(), [], false);
    const tmp = s.addRow();
    expect(s.currentId(tmp)).toBe(tmp);
    await new Promise((r) => setTimeout(r, 0));
    expect(s.getState().rows.map((r) => r.id)).toEqual(['server-row-7']);
    expect(s.currentId(tmp)).toBe('server-row-7');
  });

  it('returns any other id as it is', () => {
    expect(store().currentId('row-x')).toBe('row-x');
  });

  it('keeps a React key for the row that does not change when its id does', async () => {
    // Rows were keyed by id, so the swap remounted a just-added row — and threw away
    // the focus of someone already typing its name.
    vi.mocked(actions.addDbRow).mockResolvedValueOnce({ id: 'server-row-8' });
    const s = new DbStore(collection(), [], false);
    const tmp = s.addRow();
    expect(s.stableKey(tmp)).toBe(tmp);
    await new Promise((r) => setTimeout(r, 0));
    expect(s.stableKey('server-row-8')).toBe(tmp);
    expect(s.stableKey('row-x')).toBe('row-x');
  });
});

describe('pageForCollection — "Open as full page" opens the page a database already has', () => {
  it('is null for a database that is only a block in a document', () => {
    const { store: s } = newDatabase();
    expect(pageForCollection(s.getState().col.id)).toBeNull();
  });

  it('follows a database turned into a page, never a placeholder', () => {
    const { store: s } = newDatabase();
    const colId = s.getState().col.id;
    hostOnPage('tmp-page1', colId);
    expect(pageForCollection(colId)).toBeNull();
    linkPageStore('tmp-page1', 'real-page-1');
    expect(pageForCollection(colId)).toBe('real-page-1');
  });
});
