import { describe, it, expect } from 'vitest';
import {
  COLLECTION_INDEX_SORTS, INDEX_SORT_LABEL, collectionEditedAt, hasPicture, itemCountLabel, previewItems, sortCollections,
  type IndexEntry, type IndexSort,
} from './collection-index';
import { fileItem, linkItem, noteItem, type CollectionDoc } from './collection';

// COLLECTION_PLAN X1–X2 (COLLECTION_INDEX_BRIEF §1, §9–10) — every Collection as a visual card. What its preview
// shows, how much it says it holds, and the order the Index reads in are decided here; the Index only draws them.
const T0 = '2026-09-16T08:00:00.000Z';
const at = (h: number) => new Date(Date.parse(T0) + h * 3600000).toISOString();
const doc = (...items: CollectionDoc['items']): CollectionDoc => ({ items });

describe('a preview is made from the items themselves', () => {
  it('knows which items have a picture: an uploaded image, a picture address, a platform thumbnail, a link’s own image', () => {
    expect(hasPicture(fileItem('f', { attachmentId: 'a1', name: 'shot.png', mime: 'image/png', size: 10 }, T0))).toBe(true);
    expect(hasPicture(linkItem('y', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', T0))).toBe(true);
    expect(hasPicture(linkItem('i', 'https://example.com/poster.jpg', T0))).toBe(true);
    expect(hasPicture({ ...linkItem('l', 'https://linear.app', T0), image: 'https://linear.app/og.png' })).toBe(true);
    expect(hasPicture(linkItem('w', 'https://linear.app', T0))).toBe(false);
    expect(hasPicture(noteItem('n', 'An idea', T0))).toBe(false);
    expect(hasPicture(fileItem('p', { attachmentId: 'a2', name: 'brief.pdf', mime: 'application/pdf', size: 10 }, T0))).toBe(false);
  });

  it('shows pictures first, in the Collection’s order, then what has none — never more than asked', () => {
    const d = doc(
      noteItem('n1', 'First thought', T0),
      linkItem('w', 'https://linear.app', T0),
      linkItem('y', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', T0),
      linkItem('i', 'https://example.com/a.png', T0),
    );
    expect(previewItems(d, 3).map((i) => i.id)).toEqual(['y', 'i', 'n1']);
    expect(previewItems(d, 1).map((i) => i.id)).toEqual(['y']);
    expect(previewItems(doc(), 3)).toEqual([]);
  });
});

describe('how much a Collection holds', () => {
  it('says it in words', () => {
    expect(itemCountLabel(0)).toBe('No items');
    expect(itemCountLabel(1)).toBe('1 item');
    expect(itemCountLabel(42)).toBe('42 items');
  });
});

describe('when a Collection was last edited', () => {
  it('is its newest item’s change when that is later than the page’s own', () => {
    const d = doc(linkItem('a', 'https://a.example', at(1)), linkItem('b', 'https://b.example', at(5)));
    expect(collectionEditedAt(at(3), d)).toBe(at(5));
    expect(collectionEditedAt(at(9), d)).toBe(at(9));
    expect(collectionEditedAt(at(2), doc())).toBe(at(2));
  });
});

describe('the order the Index reads in', () => {
  const e = (id: string, title: string, editedAt: string, count: number, extra: Partial<IndexEntry> = {}): IndexEntry =>
    ({ id, title, editedAt, createdAt: editedAt, count, pinned: false, ...extra });
  const list: IndexEntry[] = [
    e('a', 'moodboard', at(1), 0, { createdAt: at(0) }),
    e('b', 'Brand ideas', at(4), 42, { createdAt: at(-5) }),
    e('c', '', at(3), 7, { createdAt: at(2) }),
    e('d', 'UI references', at(2), 42, { createdAt: at(1) }),
  ];
  const ids = (sort: IndexSort, entries = list) => sortCollections(entries, sort).map((x) => x.id);

  it('offers last edited, name, most items and created, in words', () => {
    expect(COLLECTION_INDEX_SORTS).toEqual(['edited', 'name', 'items', 'created']);
    expect(COLLECTION_INDEX_SORTS.map((s) => INDEX_SORT_LABEL[s])).toEqual(['Last edited', 'Name', 'Most items', 'Created']);
  });

  it('reads the most recently edited first', () => {
    expect(ids('edited')).toEqual(['b', 'c', 'd', 'a']);
  });

  it('reads by name without regard to case, an unnamed Collection as Untitled', () => {
    expect(ids('name')).toEqual(['b', 'a', 'd', 'c']);
  });

  it('reads the fullest first, the more recently edited first between equals', () => {
    expect(ids('items')).toEqual(['b', 'd', 'c', 'a']);
  });

  it('reads the newest made first', () => {
    expect(ids('created')).toEqual(['c', 'd', 'a', 'b']);
  });

  it('keeps a pinned Collection first in every order, and never reorders the list it was given', () => {
    const pinned = [...list.slice(0, 3), e('d', 'UI references', at(2), 42, { createdAt: at(1), pinned: true })];
    expect(ids('name', pinned)).toEqual(['d', 'b', 'a', 'c']);
    expect(ids('edited', pinned)).toEqual(['d', 'b', 'c', 'a']);
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
