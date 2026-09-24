import { describe, it, expect, vi, beforeEach } from 'vitest';

// The link metadata is the one network answer these tests script; a demo store saves nothing.
vi.mock('@/lib/use-link-meta', () => ({ fetchLinkMeta: vi.fn(async () => null) }));
vi.mock('@/lib/actions/library', () => ({ updatePage: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/lib/page-store', () => ({ whenCreated: vi.fn(() => null) }));
vi.mock('@/components/ds/ui/toast', () => ({ toast: vi.fn() }));

import { fetchLinkMeta } from '@/lib/use-link-meta';
import type { LinkMeta } from './unfurl';
import { CollectionStore } from './collection-store';
import { renameItem } from './collection';
import { parseCollectable, collectText } from './collect';

// COLLECTION_PLAN K4 — collecting. "Copy something → Open Zenboard → Paste → Collection item
// appears" (COLLECTION_VIEW_BRIEF §10): the item exists the moment it is pasted, what the link says
// fills in behind it, and a link that says nothing still leaves a usable item (§34–36).
const PAGE = '11111111-1111-4111-8111-111111111111';
const flush = () => new Promise((r) => setTimeout(r, 0));
const fresh = () => new CollectionStore(PAGE, undefined, { demo: true });

describe('parseCollectable — what a paste holds', () => {
  it('reads a link', () => {
    expect(parseCollectable('  https://youtu.be/jNQXAC9IVRw \n')).toEqual({ urls: ['https://youtu.be/jNQXAC9IVRw'], note: null });
  });

  it('reads several links as one item each, without repeats', () => {
    expect(parseCollectable('https://a.example/1\nhttps://b.example/2 https://a.example/1'))
      .toEqual({ urls: ['https://a.example/1', 'https://b.example/2'], note: null });
  });

  it('keeps anything else as a note, words and all', () => {
    expect(parseCollectable('Love the typography on https://a.example')).toEqual({ urls: [], note: 'Love the typography on https://a.example' });
  });

  it('holds nothing for an empty paste, and stops at fifty links', () => {
    expect(parseCollectable('   ')).toEqual({ urls: [], note: null });
    const many = Array.from({ length: 60 }, (_, i) => `https://x.example/${i}`).join('\n');
    expect(parseCollectable(many).urls).toHaveLength(50);
  });
});

describe('collectText — paste, and the items are there', () => {
  beforeEach(() => {
    vi.mocked(fetchLinkMeta).mockReset();
    vi.mocked(fetchLinkMeta).mockResolvedValue(null);
  });

  it('adds an item per link, on top, in the order pasted, as one step', () => {
    const s = fresh();
    expect(collectText(s, 'https://linear.app')).toHaveLength(1);
    expect(collectText(s, 'https://youtu.be/a\nhttps://example.com/brief.pdf')).toHaveLength(2);
    expect(s.getState().items.map((i) => i.url)).toEqual(['https://youtu.be/a', 'https://example.com/brief.pdf', 'https://linear.app']);
    expect(s.getState().items.map((i) => i.kind)).toEqual(['video', 'pdf', 'link']);
    s.undo();
    expect(s.getState().items.map((i) => i.url)).toEqual(['https://linear.app']);
    expect(fetchLinkMeta).toHaveBeenCalledTimes(3);
  });

  it('adds a note as an item of its own, and asks nobody about it', () => {
    const s = fresh();
    const [id] = collectText(s, 'Why I saved this');
    expect(s.getState().items).toEqual([expect.objectContaining({ id, kind: 'note', note: 'Why I saved this' })]);
    expect(fetchLinkMeta).not.toHaveBeenCalled();
  });

  it('does nothing for an empty paste', () => {
    const s = fresh();
    expect(collectText(s, '   ')).toEqual([]);
    expect(s.canUndo).toBe(false);
  });

  it('fills in what the link says behind the item — never over the name the person gave it, never as a step', async () => {
    const url = 'https://example.com/post';
    let answer: (meta: LinkMeta | null) => void = () => {};
    vi.mocked(fetchLinkMeta).mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const s = fresh();
    const [id] = collectText(s, url);
    s.change((doc) => renameItem(doc, id, 'Mine', new Date().toISOString()));
    answer({ url, title: 'A post', author: 'Ann', image: 'https://example.com/og.png' });
    await flush();
    expect(s.getState().items[0]).toMatchObject({ title: 'Mine', author: 'Ann', image: 'https://example.com/og.png' });
    s.undo(); // the rename
    expect(s.getState().items[0]).toMatchObject({ title: 'A post', author: 'Ann' });
    s.undo(); // the paste
    expect(s.getState().items).toEqual([]);
  });

  it('leaves a usable item when the link says nothing', async () => {
    const s = fresh();
    const [id] = collectText(s, 'https://randomwebsite.com/something');
    await flush();
    expect(s.getState().items).toEqual([expect.objectContaining({ id, kind: 'link', url: 'https://randomwebsite.com/something' })]);
  });
});
