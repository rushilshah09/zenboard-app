import { describe, it, expect } from 'vitest';
import { CARD_W_MAX } from './canvas';
import {
  readCollection, withCollection, itemKindOfUrl, linkItem, noteItem, fileItem, addItems, removeItems, renameItem,
  fillFromMeta, rememberShape, placeItems, bringToFront, boxesOf,
  itemTags, ensureTag, setItemTags, tagItems, renameTag, recolorTag, deleteTag, setSort, moveItem, setItemBody, itemBody, itemName, itemLinks, setView, collectionView,
  type CollectionDoc, type CollectionItem, type CollectionTag,
} from './collection';

// COLLECTION_PLAN K2 — a Collection is its own item: a page of type `collection` whose items live
// in its content (COLLECTION_ITEM_BRIEF §9). This is the model, with no React and no network.
const T0 = '2026-09-15T10:00:00.000Z';
const T1 = '2026-09-15T11:00:00.000Z';
const item = (over: Partial<CollectionItem> & { id: string }): CollectionItem =>
  ({ kind: 'link', url: 'https://example.com', createdAt: T0, updatedAt: T0, ...over });
const doc = (...items: CollectionItem[]): CollectionDoc => ({ items });

describe('readCollection — what a page holds, as a Collection may draw it', () => {
  it('reads nothing from nothing', () => {
    expect(readCollection(undefined)).toEqual({ items: [] });
    expect(readCollection({ blocks: [] })).toEqual({ items: [] });
    expect(readCollection({ collection: 'x' })).toEqual({ items: [] });
    expect(readCollection({ collection: { items: 'x' } })).toEqual({ items: [] });
  });

  it('keeps items that make sense, once each, and drops the rest', () => {
    const read = readCollection({ collection: { items: [
      item({ id: 'a' }),
      { kind: 'link', url: 'https://x.example', createdAt: T0, updatedAt: T0 },
      { id: 'b', kind: 'poster', createdAt: T0, updatedAt: T0 },
      item({ id: 'a', title: 'a repeat' }),
      { id: 'c', kind: 'note', note: 'Why I saved this', createdAt: T0, updatedAt: T0 },
      { id: 'd', kind: 'note', note: '   ', createdAt: T0, updatedAt: T0 },
      { id: 'e', kind: 'image', file: { attachmentId: 'att1', name: 'a.png', mime: 'image/png', size: 10 }, createdAt: T0, updatedAt: T0 },
      { id: 'f', kind: 'image', file: { name: 'no-attachment.png' }, createdAt: T0, updatedAt: T0 },
      'junk',
    ] } });
    expect(read.items.map((i) => i.id)).toEqual(['a', 'c', 'e']);
    expect(read.items[0].title).toBeUndefined();
  });

  it('reads a link only over http(s), and a preview image only over https', () => {
    const read = readCollection({ collection: { items: [
      item({ id: 'a', url: 'javascript:alert(1)' }),
      item({ id: 'b', url: 'https://ok.example/p', image: 'http://insecure.example/i.png', favicon: 'https://ok.example/f.ico' }),
    ] } });
    expect(read.items.map((i) => i.id)).toEqual(['b']);
    expect(read.items[0].image).toBeUndefined();
    expect(read.items[0].favicon).toBe('https://ok.example/f.ico');
  });

  it('reads a canvas place only when it makes sense, keeping the item either way', () => {
    const read = readCollection({ collection: { items: [
      item({ id: 'a', canvas: { x: 10, y: -20, w: 300, h: 180, z: 2 } }),
      item({ id: 'b', canvas: { x: Number.NaN, y: 0, w: 200 } }),
      item({ id: 'c', canvas: { x: 0, y: 0, w: 99999, z: -1 } }),
    ] } });
    expect(read.items[0].canvas).toEqual({ x: 10, y: -20, w: 300, h: 180, z: 2 });
    expect(read.items[1].canvas).toBeUndefined();
    expect(read.items[2].canvas).toEqual({ x: 0, y: 0, w: CARD_W_MAX });
  });

  it('caps what a page could make too long', () => {
    const read = readCollection({ collection: { items: [item({ id: 'a', title: 'x'.repeat(1000), description: 'y'.repeat(2000) })] } });
    expect(read.items[0].title).toHaveLength(300);
    expect(read.items[0].description).toHaveLength(500);
  });
});

describe('withCollection — the page keeps everything else it holds', () => {
  it('replaces only the collection, never in place', () => {
    const before = { blocks: [], cover: 'dusk' };
    const next = withCollection(before, doc(item({ id: 'a' })));
    expect(next).toEqual({ blocks: [], cover: 'dusk', collection: { items: [item({ id: 'a' })] } });
    expect(before).toEqual({ blocks: [], cover: 'dusk' });
    expect(withCollection(undefined, doc())).toEqual({ collection: { items: [] } });
  });
});

describe('what a collected thing is', () => {
  it('reads a link by what it points at', () => {
    expect(itemKindOfUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe('video');
    expect(itemKindOfUrl('https://example.com/brand/guidelines.pdf')).toBe('pdf');
    expect(itemKindOfUrl('https://raw.githubusercontent.com/a/b/logo.png')).toBe('image');
    expect(itemKindOfUrl('https://open.spotify.com/track/1')).toBe('audio');
    expect(itemKindOfUrl('https://linear.app')).toBe('link');
    expect(itemKindOfUrl('https://www.instagram.com/p/x/')).toBe('link');
  });

  it('makes a link, a note and a file, stamped with when they arrived', () => {
    expect(linkItem('id1', 'https://linear.app', T0)).toEqual({ id: 'id1', kind: 'link', url: 'https://linear.app', createdAt: T0, updatedAt: T0 });
    expect(noteItem('id2', '  Why I saved this  ', T0)).toEqual({ id: 'id2', kind: 'note', note: 'Why I saved this', createdAt: T0, updatedAt: T0 });
    const file = { attachmentId: 'att1', name: 'Moodboard.png', mime: 'image/png', size: 2048 };
    expect(fileItem('id3', file, T0)).toEqual({ id: 'id3', kind: 'image', title: 'Moodboard', file, createdAt: T0, updatedAt: T0 });
    expect(fileItem('id4', { attachmentId: 'att2', name: 'brief.pdf', mime: 'application/pdf', size: 1 }, T0).kind).toBe('pdf');
    expect(fileItem('id5', { attachmentId: 'att3', name: 'clip.mov', mime: 'video/quicktime', size: 1 }, T0).kind).toBe('video');
    expect(fileItem('id6', { attachmentId: 'att4', name: 'notes.key', mime: null, size: null }, T0).kind).toBe('file');
  });
});

describe('changing a collection', () => {
  it('adds new items first, in the order given, and never twice', () => {
    const next = addItems(doc(item({ id: 'old' })), [item({ id: 'n1' }), item({ id: 'n2' }), item({ id: 'old' })]);
    expect(next.items.map((i) => i.id)).toEqual(['n1', 'n2', 'old']);
  });

  it('removes items by id', () => {
    const next = removeItems(doc(item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })), ['a', 'c', 'nope']);
    expect(next.items.map((i) => i.id)).toEqual(['b']);
  });

  it('renames an item as the person wrote it, and dates the change', () => {
    const next = renameItem(doc(item({ id: 'a', title: 'Old' })), 'a', '  Amazing typography reference ', T1);
    expect(next.items[0]).toMatchObject({ title: 'Amazing typography reference', updatedAt: T1 });
    expect(renameItem(next, 'a', '   ', T1).items[0].title).toBeUndefined();
  });

  it('fills what a link says only where the item is still empty, and dates nothing', () => {
    const before = doc(item({ id: 'a', url: 'https://example.com/post', title: 'Mine' }));
    const filled = fillFromMeta(before, 'a', 'https://example.com/post', {
      url: 'https://example.com/post', title: 'Theirs', author: 'Ann', description: 'On type', siteName: 'Example',
      image: 'https://example.com/og.png', favicon: 'https://example.com/f.ico', published: '2024-03-05T10:00:00Z',
    });
    expect(filled.items[0]).toEqual({
      ...before.items[0], author: 'Ann', description: 'On type', siteName: 'Example',
      image: 'https://example.com/og.png', favicon: 'https://example.com/f.ico', published: '2024-03-05',
    });
  });

  it('never fills from an answer about a link the item no longer has, or one that says nothing', () => {
    const before = doc(item({ id: 'a', url: 'https://example.com/b' }));
    expect(fillFromMeta(before, 'a', 'https://example.com/a', { url: 'https://example.com/a', title: 'A' })).toBe(before);
    expect(fillFromMeta(before, 'a', 'https://example.com/b', null)).toBe(before);
    expect(fillFromMeta(before, 'gone', 'https://example.com/b', { url: 'https://example.com/b', title: 'B' })).toBe(before);
  });

  it('remembers the shape a picture turned out to be, as a cache', () => {
    const next = rememberShape(doc(item({ id: 'a' })), 'a', 0.5625);
    expect(next.items[0]).toMatchObject({ shape: 0.5625, updatedAt: T0 });
    expect(rememberShape(next, 'a', 0.563)).toBe(next);
  });
});

describe('the canvas arrangement — layout, never content', () => {
  it('places items where they were put, keeping their layer, and dates nothing', () => {
    const before = doc(item({ id: 'a', canvas: { x: 0, y: 0, w: 240, z: 3 } }), item({ id: 'b' }));
    const placed = placeItems(before, { a: { x: 50, y: 60, w: 300, h: 200 }, b: { x: 1, y: 2, w: 240 }, gone: { x: 0, y: 0, w: 240 } });
    expect(placed.items[0]).toEqual({ ...before.items[0], canvas: { x: 50, y: 60, w: 300, h: 200, z: 3 } });
    expect(placed.items[1].canvas).toEqual({ x: 1, y: 2, w: 240 });
    expect(placed.items.map((i) => i.updatedAt)).toEqual([T0, T0]);
  });

  it('brings items to the front, above everything, in the order given', () => {
    const before = doc(
      item({ id: 'a', canvas: { x: 0, y: 0, w: 240, z: 5 } }),
      item({ id: 'b', canvas: { x: 0, y: 0, w: 240 } }),
      item({ id: 'c', canvas: { x: 0, y: 0, w: 240, z: 1 } }),
    );
    const front = bringToFront(before, ['c', 'b']);
    expect(front.items.map((i) => i.canvas?.z)).toEqual([5, 7, 6]);
    expect(bringToFront(front, ['b'])).toBe(front);
  });

  it('reads the saved places as boxes the canvas geometry works with', () => {
    const d = doc(item({ id: 'a', canvas: { x: 1, y: 2, w: 240, h: 100, z: 1 } }), item({ id: 'b' }));
    expect(boxesOf(d)).toEqual({ a: { x: 1, y: 2, w: 240, h: 100 } });
  });
});


// COLLECTION_PLAN K7 — a Collection's own tags (COLLECTION_VIEW_BRIEF §14–16, §31, §42).
describe('tags — a Collection\'s own words for what its items are about', () => {
  const tag = (id: string, name: string, color: CollectionTag['color'] = 'gray'): CollectionTag => ({ id, name, color });
  const tagged = (...tags: CollectionTag[]) => (...items: CollectionItem[]): CollectionDoc => ({ items, tags });

  it('reads a vocabulary once each — ids and names, names without case — and a colour it knows', () => {
    const read = readCollection({ collection: {
      tags: [
        { id: 't1', name: '  Typography ', color: 'purple' },
        { id: 't2', name: 'typography', color: 'blue' },
        { id: 't1', name: 'Again', color: 'blue' },
        { id: 't3', name: 'Web', color: 'neon' },
        { id: 't4', name: '   ' },
        { name: 'No id' },
        'junk',
      ],
      items: [item({ id: 'a', tags: ['t3', 'gone', 't1', 't3', 7] as unknown as string[] })],
    } });
    expect(read.tags).toEqual([tag('t1', 'Typography', 'purple'), tag('t3', 'Web', 'gray')]);
    expect(read.items[0].tags).toEqual(['t3', 't1']);
  });

  it('a Collection with no tags reads as it did before tags existed', () => {
    expect(readCollection({ collection: { items: [item({ id: 'a', tags: ['t1'] })] } })).toEqual({ items: [item({ id: 'a' })] });
  });

  it('ensureTag finds a tag by name without case, or makes one in the next colour', () => {
    const start = tagged(tag('t1', 'Typography', 'gray'))();
    expect(ensureTag(start, 'TYPOGRAPHY', 'new').tag).toEqual(tag('t1', 'Typography', 'gray'));
    expect(ensureTag(start, 'TYPOGRAPHY', 'new').doc).toBe(start);
    const made = ensureTag(start, '  Packaging  ', 't2');
    expect(made.tag?.name).toBe('Packaging');
    expect(made.tag?.color).not.toBe('gray');
    expect(made.doc.tags?.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(ensureTag(start, '   ', 'x')).toEqual({ doc: start, tag: null });
  });

  it('setItemTags sets exactly the tags given — known ones, once — and dates the item', () => {
    const d = tagged(tag('t1', 'A'), tag('t2', 'B'))(item({ id: 'a' }), item({ id: 'b' }));
    const next = setItemTags(d, 'a', ['t2', 'nope', 't2', 't1'], T1);
    expect(next.items[0]).toMatchObject({ tags: ['t2', 't1'], updatedAt: T1 });
    expect(next.items[1]).toBe(d.items[1]);
    expect(setItemTags(next, 'a', ['t2', 't1'], '2030-01-01T00:00:00.000Z')).toBe(next);
    const cleared = setItemTags(next, 'a', [], T1);
    expect(cleared.items[0]).not.toHaveProperty('tags');
  });

  it('tagItems puts one tag on many at once, and takes it off, dating only the items that change', () => {
    const d = tagged(tag('t1', 'A'))(item({ id: 'a', tags: ['t1'] }), item({ id: 'b' }), item({ id: 'c' }));
    const on = tagItems(d, ['a', 'b'], 't1', true, T1);
    expect(on.items.map((i) => i.tags)).toEqual([['t1'], ['t1'], undefined]);
    expect(on.items[0]).toBe(d.items[0]);
    expect(on.items[1].updatedAt).toBe(T1);
    const off = tagItems(on, ['a', 'b', 'c'], 't1', false, T1);
    expect(off.items.every((i) => !('tags' in i))).toBe(true);
    expect(tagItems(d, ['b'], 'missing', true, T1)).toBe(d);
  });

  it('itemTags resolves an item\'s tags in the order they were put on', () => {
    const d = tagged(tag('t1', 'A'), tag('t2', 'B'))(item({ id: 'a', tags: ['t2', 't1'] }));
    expect(itemTags(d, d.items[0]).map((t) => t.name)).toEqual(['B', 'A']);
  });

  it('renameTag renames everywhere at once, but never onto another tag\'s name', () => {
    const d = tagged(tag('t1', 'Typo'), tag('t2', 'Web'))();
    expect(renameTag(d, 't1', 'Typography').tags?.[0].name).toBe('Typography');
    expect(renameTag(d, 't1', 'web')).toBe(d);
    expect(renameTag(d, 't1', '  ')).toBe(d);
    expect(recolorTag(d, 't2', 'green').tags?.[1].color).toBe('green');
    expect(recolorTag(d, 't2', 'gray')).toBe(d);
  });

  it('deleteTag takes it out of the vocabulary and off every item, without dating them', () => {
    const d = tagged(tag('t1', 'A'), tag('t2', 'B'))(item({ id: 'a', tags: ['t1', 't2'] }), item({ id: 'b', tags: ['t1'] }));
    const next = deleteTag(d, 't1');
    expect(next.tags).toEqual([tag('t2', 'B')]);
    expect(next.items[0]).toMatchObject({ tags: ['t2'], updatedAt: T0 });
    expect(next.items[1]).not.toHaveProperty('tags');
    expect(deleteTag(deleteTag(next, 't2'), 't2')).not.toHaveProperty('tags');
  });

  it('a tagged Collection survives the trip into a page and back', () => {
    const d = tagged(tag('t1', 'Brand', 'orange'))(item({ id: 'a', tags: ['t1'] }));
    expect(readCollection(withCollection({ blocks: [] }, d))).toEqual(d);
  });
});

// COLLECTION_PLAN K8 — the order a Collection is read in, and arranging it by hand (§29).
describe('order — the Collection\'s own, and one item moved in it', () => {
  it('a sort is kept on the Collection, and manual is kept by leaving it out', () => {
    const d = doc(item({ id: 'a' }));
    expect(setSort(d, 'name')).toEqual({ ...d, sort: 'name' });
    expect(setSort(d, 'updated')).toEqual({ ...d, sort: 'updated' });
    expect(setSort(setSort(d, 'name'), 'manual')).not.toHaveProperty('sort');
    expect(setSort(d, 'manual')).toBe(d);
    expect(setSort(setSort(d, 'name'), 'name')).toEqual({ ...d, sort: 'name' });
  });

  it('a sort survives the trip into a page and back, and junk does not', () => {
    const d: CollectionDoc = { ...doc(item({ id: 'a' })), sort: 'updated' };
    expect(readCollection(withCollection({}, d))).toEqual(d);
    expect(readCollection({ collection: { items: [], sort: 'sideways' } })).not.toHaveProperty('sort');
    expect(readCollection({ collection: { items: [], sort: 'manual' } })).not.toHaveProperty('sort');
  });

  it('an item moves to a place among the others, and is never dated by it', () => {
    const d = doc(item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' }));
    const ids = (next: CollectionDoc) => next.items.map((i) => i.id);
    expect(ids(moveItem(d, 'a', 2))).toEqual(['b', 'c', 'a']);
    expect(ids(moveItem(d, 'c', 0))).toEqual(['c', 'a', 'b']);
    expect(ids(moveItem(d, 'a', 99))).toEqual(['b', 'c', 'a']);
    expect(ids(moveItem(d, 'c', -4))).toEqual(['c', 'a', 'b']);
    expect(moveItem(d, 'a', 0)).toBe(d);
    expect(moveItem(d, 'nope', 1)).toBe(d);
    expect(moveItem(d, 'c', 0).items[0].updatedAt).toBe(T0);
  });
});

// COLLECTION_PLAN K9 — what someone wrote about a collected thing (COLLECTION_VIEW_BRIEF §18, §38).
describe('notes on an item', () => {
  const body = (...texts: string[]) => texts.map((t, i) => ({ id: `b${i}`, type: 'text' as const, text: t }));

  it('a body is kept on the item, and nothing is kept when nothing was written', () => {
    const written = setItemBody(doc(item({ id: 'a' })), 'a', body('Why I saved this', 'Love the typography.'), T1);
    expect(written.items[0].body).toHaveLength(2);
    expect(written.items[0].updatedAt).toBe(T1);
    expect(setItemBody(written, 'a', body(''), T1).items[0]).not.toHaveProperty('body');
    expect(setItemBody(doc(item({ id: 'a' })), 'nope', body('x'), T1).items[0]).not.toHaveProperty('body');
  });

  it('a note item IS its body: its own words follow what is written there', () => {
    const next = setItemBody(doc(item({ id: 'n', kind: 'note', note: 'One line' })), 'n', body('One line', 'And another'), T1);
    expect(next.items[0].note).toBe('One line\n\nAnd another');
    expect(itemName(next.items[0])).toBe('One line');
  });

  it('itemBody opens what was written, or a note\'s own words, or an empty line', () => {
    expect(itemBody(item({ id: 'a' })).map((b) => b.text)).toEqual(['']);
    expect(itemBody(item({ id: 'n', kind: 'note', note: 'A thought\n\nand more' })).map((b) => b.text)).toEqual(['A thought', 'and more']);
    const written = setItemBody(doc(item({ id: 'a' })), 'a', body('Kept'), T1).items[0];
    expect(itemBody(written).map((b) => b.text)).toEqual(['Kept']);
  });

  it('a body survives the trip into a page and back, and junk does not', () => {
    const d = setItemBody(doc(item({ id: 'a' })), 'a', body('Kept'), T1);
    expect(readCollection(withCollection({}, d))).toEqual(d);
    const read = (raw: unknown) => readCollection({ collection: { items: [{ ...item({ id: 'a' }), body: raw }] } }).items[0];
    expect(read('nope')).not.toHaveProperty('body');
    expect(read([])).not.toHaveProperty('body');
    expect(read([{ id: 'x', type: 'text', text: '   ' }])).not.toHaveProperty('body');
  });
});

// COLLECTION_PLAN K10 — what a selection of items can be taken away as (§16).
describe('links of a selection', () => {
  it('is every address there is, in the order shown, and nothing for what has none', () => {
    const items = [
      item({ id: 'a', url: 'https://one.example/a' }),
      item({ id: 'n', kind: 'note', url: undefined, note: 'A thought' }),
      item({ id: 'b', url: 'https://two.example/b' }),
      item({ id: 'f', kind: 'image', url: undefined, file: { attachmentId: 'x', name: 'shot.png', mime: 'image/png', size: 1 } }),
    ];
    expect(itemLinks(items)).toEqual(['https://one.example/a', 'https://two.example/b']);
    expect(itemLinks([items[1], items[3]])).toEqual([]);
    expect(itemLinks([])).toEqual([]);
  });
});

// COLLECTION_PLAN K11 — how a Collection shows itself (COLLECTION_VIEW_BRIEF §28), for everyone who opens it.
describe('presentation', () => {
  const one = doc(item({ id: 'a' }));

  it('keeps only what is not the ordinary, and keeps nothing when everything is', () => {
    expect(setView(one, { size: 'large' })).toEqual({ ...one, view: { size: 'large' } });
    expect(setView(setView(one, { size: 'large' }), { size: 'medium' })).not.toHaveProperty('view');
    expect(setView(one, { size: 'medium' })).toBe(one);
    const two = setView(setView(one, { size: 'small' }), { fit: 'cover' });
    expect(two.view).toEqual({ size: 'small', fit: 'cover' });
    expect(setView(two, { titles: false }).view).toEqual({ size: 'small', fit: 'cover', titles: false });
    expect(setView(two, { titles: true })).toBe(two);
  });

  it('collectionView answers for every Collection, set or not', () => {
    expect(collectionView(one)).toEqual({ size: 'medium', fit: 'original', titles: true });
    expect(collectionView(setView(one, { size: 'large', titles: false }))).toEqual({ size: 'large', fit: 'original', titles: false });
  });

  it('survives the trip into a page and back, and junk does not', () => {
    const d = setView(one, { size: 'large', fit: 'contain', titles: false });
    expect(readCollection(withCollection({}, d))).toEqual(d);
    expect(readCollection({ collection: { items: [], view: { size: 'enormous', fit: 7, titles: 'yes' } } })).not.toHaveProperty('view');
    expect(readCollection({ collection: { items: [], view: 'big' } })).not.toHaveProperty('view');
  });
});
