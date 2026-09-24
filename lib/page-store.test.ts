import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as actions from '@/lib/actions/library';
import { toast } from '@/components/ds/ui/toast';
import {
  loadPage, newPage, onPageCreated, pageEntry, patchPage, resetPagesForTest, retryPage, seedPages,
} from './page-store';

// Pages nest without end, and each is made the moment it is asked for: the id is
// minted in the browser, the page is on screen, and the server hears of it behind.
// These are the rules that keep that honest — what is shown, what is saved, and
// what a failure looks like.
vi.mock('@/lib/actions/library', () => ({
  addPage: vi.fn(async (input: { id: string }) => ({ id: input.id })),
  getPage: vi.fn(async (id: string) => ({ id, title: 'From the server', content: { blocks: [] }, icon: null, parentId: null })),
  updatePage: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/components/ds/ui/toast', () => ({ toast: vi.fn() }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => { resetPagesForTest(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('newPage — a page inside a page, made at once', () => {
  it('is on screen before the server answers, under its final id, inside its parent', async () => {
    const parent = '11111111-2222-4333-8444-555555555555';
    const { id, creation } = newPage({ parentId: parent });
    expect(id).toMatch(UUID);
    expect(pageEntry(id)).toMatchObject({ state: 'ready', record: { id, title: '', parentId: parent, content: { blocks: [] } } });
    expect(actions.addPage).toHaveBeenCalledWith({ id, parentId: parent, title: '' });
    await expect(creation).resolves.toEqual({ ok: true });
  });

  it('tells a listener at once, so Documents can list the page before it is saved', () => {
    const seen: string[] = [];
    onPageCreated((r) => seen.push(r.id));
    const { id } = newPage({ parentId: null });
    expect(seen).toEqual([id]);
  });

  it('says so where it is linked when the server refuses, and Try again keeps the id', async () => {
    vi.mocked(actions.addPage).mockResolvedValueOnce({ error: 'nope' });
    const { id, creation } = newPage({ parentId: null });
    await creation;
    await Promise.resolve();
    expect(pageEntry(id)).toMatchObject({ state: 'failed', error: 'nope' });
    await retryPage(id);
    expect(actions.addPage).toHaveBeenLastCalledWith({ id, parentId: null, title: '' });
    expect(pageEntry(id)?.state).toBe('ready');
  });
});

describe('patchPage — an edit is shown at once and saved after a pause', () => {
  it('merges a run of edits into one save', async () => {
    vi.useFakeTimers();
    seedPages([{ id: 'p1', title: 'Old', icon: null, parentId: null }]);
    patchPage('p1', { title: 'N' });
    patchPage('p1', { title: 'Name' });
    patchPage('p1', { content: { blocks: [{ id: 'b', type: 'text', text: 'hi' }] } });
    expect(pageEntry('p1')?.record?.title).toBe('Name');
    expect(actions.updatePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(450);
    expect(actions.updatePage).toHaveBeenCalledTimes(1);
    expect(actions.updatePage).toHaveBeenCalledWith('p1', { title: 'Name', content: { blocks: [{ id: 'b', type: 'text', text: 'hi' }] } });
  });

  it('waits for a page being made, and never saves one that was not', async () => {
    vi.useFakeTimers();
    let refuse!: (r: { error: string }) => void;
    vi.mocked(actions.addPage).mockReturnValueOnce(new Promise((res) => { refuse = res; }));
    const { id } = newPage({ parentId: null });
    patchPage(id, { title: 'Draft' });
    await vi.advanceTimersByTimeAsync(450);
    expect(actions.updatePage).not.toHaveBeenCalled();
    refuse({ error: 'nope' });
    await vi.advanceTimersByTimeAsync(10);
    expect(actions.updatePage).not.toHaveBeenCalled();
  });

  it('reports a save that failed', async () => {
    vi.useFakeTimers();
    vi.mocked(actions.updatePage).mockResolvedValueOnce({ error: 'nope' });
    seedPages([{ id: 'p1', title: 'Old', icon: null, parentId: null }]);
    patchPage('p1', { title: 'New' });
    await vi.advanceTimersByTimeAsync(450);
    expect(toast).toHaveBeenCalledWith({ message: 'Could not save the page.', variant: 'error' });
  });
});

describe('seedPages — a host tells the store what it already has', () => {
  it('fills names and icons, and keeps a body it already read', () => {
    seedPages([{ id: 'p1', title: 'A', icon: '🎯', parentId: null, content: { blocks: [] } }]);
    seedPages([{ id: 'p1', title: 'B', icon: '🎯', parentId: null }]);
    expect(pageEntry('p1')?.record).toMatchObject({ title: 'B', content: { blocks: [] } });
  });

  it('never overwrites an edit still waiting to be saved with an older listing', () => {
    vi.useFakeTimers();
    seedPages([{ id: 'p1', title: 'A', icon: null, parentId: null }]);
    patchPage('p1', { title: 'Typed just now' });
    seedPages([{ id: 'p1', title: 'A', icon: null, parentId: null }]);
    expect(pageEntry('p1')?.record?.title).toBe('Typed just now');
  });
});

describe('loadPage — a page this device has not seen', () => {
  it('reads it once, with its body', async () => {
    await loadPage('p9');
    expect(pageEntry('p9')).toMatchObject({ state: 'ready', record: { title: 'From the server', content: { blocks: [] } } });
  });

  it('tells a page that is gone from one that could not be read', async () => {
    vi.mocked(actions.getPage).mockResolvedValueOnce({ error: 'Not found.' });
    await loadPage('gone');
    expect(pageEntry('gone')?.state).toBe('missing');
    vi.mocked(actions.getPage).mockRejectedValueOnce(new Error('offline'));
    await loadPage('flaky');
    expect(pageEntry('flaky')).toMatchObject({ state: 'failed', error: 'offline' });
  });

  it('never asks the server about a page still being made here', async () => {
    const { id } = newPage({ parentId: null });
    await loadPage(id);
    expect(actions.getPage).not.toHaveBeenCalled();
  });
});

describe('pages of another kind', () => {
  // COLLECTION_ITEM_BRIEF: a Collection is its own item — a page of type `collection`. The page it is
  // made as, and the page read back, must both know that, or its link would open it as a document.
  it('makes a Collection as a Collection, named, from its first frame', async () => {
    const seen: (string | undefined)[] = [];
    onPageCreated((r) => seen.push(r.type));
    const { id, creation } = newPage({ parentId: null, type: 'collection', title: 'New collection' });
    expect(pageEntry(id)).toMatchObject({ state: 'ready', record: { id, type: 'collection', title: 'New collection' } });
    expect(actions.addPage).toHaveBeenCalledWith({ id, parentId: null, title: 'New collection', type: 'collection' });
    expect(seen).toEqual(['collection']);
    await expect(creation).resolves.toEqual({ ok: true });
  });

  it('knows the kind of a page it reads', async () => {
    vi.mocked(actions.getPage).mockResolvedValueOnce({ id: 'p1', title: 'Refs', content: { blocks: [] }, icon: null, parentId: null, type: 'collection' });
    await loadPage('p1');
    expect(pageEntry('p1')).toMatchObject({ state: 'ready', record: { type: 'collection' } });
  });
});
