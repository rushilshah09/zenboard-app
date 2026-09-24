import { describe, it, expect } from 'vitest';
import type { CollectionDoc, CollectionItem, CollectionTag } from './collection';
import {
  ADDED_LABEL, NO_FILTER, SORT_LABEL, canReorder, findItems, isFiltering, itemSearchText, itemSource, kindsPresent, matchesFilter,
  matchesSearch, itemOrigin, searchWords, sortItems, sourcesPresent, type AddedWindow,
} from './collection-find';

// COLLECTION_PLAN K8 — finding and ordering a Collection's items (COLLECTION_VIEW_BRIEF §29, §31–32).
const at = (h: number) => `2026-09-15T${String(h).padStart(2, '0')}:00:00.000Z`;
const item = (over: Partial<CollectionItem> & { id: string }): CollectionItem =>
  ({ kind: 'link', url: `https://example.com/${over.id}`, createdAt: at(1), updatedAt: at(1), ...over });
const TAGS: CollectionTag[] = [
  { id: 'type', name: 'Typography', color: 'purple' },
  { id: 'web', name: 'Web', color: 'blue' },
  { id: 'brand', name: 'Branding', color: 'orange' },
];
const ids = (items: CollectionItem[]) => items.map((i) => i.id);

const zoo = item({ id: 'zoo', kind: 'video', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', title: 'Me at the zoo', author: 'jawed', createdAt: at(9), published: '2005-04-23', tags: ['brand'] });
const swiss = item({ id: 'swiss', url: 'https://www.instagram.com/p/C0/', title: 'Swiss poster wall', createdAt: at(8), tags: ['type'] });
const linear = item({ id: 'linear', url: 'https://linear.app', title: 'Linear', siteName: 'Linear', description: 'Purpose-built for planning.', createdAt: at(7), published: '2024-01-10', tags: ['web', 'brand'] });
const guide = item({ id: 'guide', kind: 'pdf', url: 'https://example.com/brand/guidelines.pdf', title: 'Café guidelines', createdAt: at(6) });
const note = item({ id: 'note', kind: 'note', url: undefined, note: 'Idea: a quieter onboarding\nOne question at a time.', createdAt: at(5) });
const upload = item({ id: 'upload', kind: 'image', url: undefined, file: { attachmentId: 'a1', name: 'moodboard-12.png', mime: 'image/png', size: 10 }, createdAt: at(4) });
const DOC: CollectionDoc = { items: [zoo, swiss, linear, guide, note, upload], tags: TAGS };

describe('search — every word, anywhere an item says something (§32)', () => {
  const find = (q: string) => ids(DOC.items.filter((i) => matchesSearch(i, DOC.tags, q)));

  it('reads names, sources, domains, authors, descriptions, words, files, kinds and tags', () => {
    expect(find('zoo')).toEqual(['zoo']);
    expect(find('YouTube')).toEqual(['zoo']);
    expect(find('instagram')).toEqual(['swiss']);
    expect(find('linear.app')).toEqual(['linear']);
    expect(find('jawed')).toEqual(['zoo']);
    expect(find('planning')).toEqual(['linear']);
    expect(find('quieter')).toEqual(['note']);
    expect(find('moodboard')).toEqual(['upload']);
    expect(find('pdf')).toEqual(['guide']);
    expect(find('typography')).toEqual(['swiss']);
  });

  it('asks for every word, without case or accents', () => {
    expect(find('BRANDING linear')).toEqual(['linear']);
    expect(find('cafe')).toEqual(['guide']);
    expect(find('branding zoo linear')).toEqual([]);
    expect(find('   ')).toEqual(ids(DOC.items));
    expect(searchWords('  Café  Poster ')).toEqual(['cafe', 'poster']);
  });

  it('reads what was written about an item, which is why a Collection is a research tool (§38)', () => {
    const noted = item({ id: 'noted', title: 'Poster', body: [{ id: 'b1', type: 'text', text: 'Why I saved this: the grid.' }] });
    expect(matchesSearch(noted, TAGS, 'grid')).toBe(true);
    expect(matchesSearch(noted, TAGS, 'saved grid')).toBe(true);
    expect(itemSearchText(noted, TAGS)).toContain('why i saved this');
  });

  it('a tag renamed is found by its new name at once — the item holds the id, not the word', () => {
    const renamed = TAGS.map((t) => (t.id === 'type' ? { ...t, name: 'Lettering' } : t));
    expect(itemSearchText(swiss, renamed)).toContain('lettering');
    expect(itemSearchText(swiss, renamed)).not.toContain('typography');
  });
});

describe('filters — a kind, and tags that must all be there (§31, §42)', () => {
  it('any of the kinds asked for', () => {
    expect(ids(DOC.items.filter((i) => matchesFilter(i, { ...NO_FILTER, kinds: ['video', 'pdf'] })))).toEqual(['zoo', 'guide']);
  });

  it('every tag asked for — "Branding + Web" is what carries both', () => {
    expect(ids(DOC.items.filter((i) => matchesFilter(i, { ...NO_FILTER, tags: ['brand'] })))).toEqual(['zoo', 'linear']);
    expect(ids(DOC.items.filter((i) => matchesFilter(i, { ...NO_FILTER, tags: ['brand', 'web'] })))).toEqual(['linear']);
  });

  it('kindsPresent offers only the kinds the Collection has, in their own order', () => {
    expect(kindsPresent(DOC)).toEqual(['link', 'image', 'video', 'pdf', 'note']);
    expect(kindsPresent({ items: [] })).toEqual([]);
  });

  it('a source is where an item came from — an upload or a note came from nowhere', () => {
    const from = (...sources: string[]) => ids(DOC.items.filter((i) => matchesFilter(i, { ...NO_FILTER, sources })));
    expect(from('Instagram')).toEqual(['swiss']);
    expect(from('YouTube', 'linear.app')).toEqual(['zoo', 'linear']);
    expect(from('Image')).toEqual([]); // a kind is not a source: nothing sent you your own upload
    expect(sourcesPresent({ items: [note, upload] })).toEqual([]);
  });

  it('one origin is offered once, under the name the site gave — however its items name themselves', () => {
    // Two things from example.com: one that gave its name and one that did not. That is ONE source.
    const talk = item({ id: 'talk', kind: 'audio', url: 'https://example.com/talks/tone.mp3', siteName: 'Example' });
    expect(sourcesPresent({ ...DOC, items: [...DOC.items, talk] })).toEqual([
      { key: 'example.com', label: 'Example' },
      { key: 'Instagram', label: 'Instagram' },
      { key: 'linear.app', label: 'Linear' },
      { key: 'YouTube', label: 'YouTube' },
    ]);
    expect(ids([guide, talk].filter((i) => matchesFilter(i, { ...NO_FILTER, sources: ['example.com'] })))).toEqual(['guide', 'talk']);
    expect(itemOrigin(talk)).toBe('example.com');
    expect(itemOrigin(note)).toBeUndefined();
    // And they sort together, because Source groups by where things came from.
    expect(ids(sortItems([zoo, guide, talk], 'source'))).toEqual(['guide', 'talk', 'zoo']);
  });

  it('collected within the last so many days — "Created within last 7 days" (§31)', () => {
    const now = Date.parse('2026-09-15T12:00:00.000Z');
    const old = item({ id: 'old', createdAt: '2026-09-01T12:00:00.000Z' });
    const recent = item({ id: 'recent', createdAt: '2026-09-14T12:00:00.000Z' });
    const within = (added: AddedWindow) => ids([old, recent].filter((i) => matchesFilter(i, { ...NO_FILTER, added }, now)));
    expect(within(7)).toEqual(['recent']);
    expect(within(30)).toEqual(['old', 'recent']);
    expect(ADDED_LABEL[7]).toBe('Last 7 days');
  });

  it('isFiltering is anything that hides an item', () => {
    expect(isFiltering('', NO_FILTER)).toBe(false);
    expect(isFiltering('  ', NO_FILTER)).toBe(false);
    expect(isFiltering('x', NO_FILTER)).toBe(true);
    expect(isFiltering('', { ...NO_FILTER, kinds: ['note'] })).toBe(true);
    expect(isFiltering('', { ...NO_FILTER, sources: ['YouTube'] })).toBe(true);
    expect(isFiltering('', { ...NO_FILTER, added: 7 })).toBe(true);
  });
});

describe('order (§29)', () => {
  it('manual is the order kept; recently added is newest first', () => {
    const shuffled = [guide, zoo, note];
    expect(ids(sortItems(shuffled, 'manual'))).toEqual(['guide', 'zoo', 'note']);
    expect(ids(sortItems(shuffled, 'added'))).toEqual(['zoo', 'guide', 'note']);
  });

  it('name reads numbers as numbers and ignores case', () => {
    const a = item({ id: 'a', title: 'ref 10' });
    const b = item({ id: 'b', title: 'Ref 9' });
    const c = item({ id: 'c', title: 'apple' });
    expect(ids(sortItems([a, b, c], 'name'))).toEqual(['c', 'b', 'a']);
  });

  it('source groups by where things came from, then by name', () => {
    expect(itemSource(linear)).toBe('Linear');
    expect(itemSource(upload)).toBe('Image');
    expect(itemSource(guide)).toBe('example.com');
    expect(ids(sortItems(DOC.items, 'source'))).toEqual(['guide', 'upload', 'swiss', 'linear', 'note', 'zoo']);
  });

  it('published is newest first, and the undated follow, newest added first', () => {
    expect(ids(sortItems(DOC.items, 'published'))).toEqual(['linear', 'zoo', 'swiss', 'guide', 'note', 'upload']);
  });

  it('recently updated is what changed last, newest first — a note reread is at the front (§29)', () => {
    const a = item({ id: 'a', createdAt: at(1), updatedAt: at(5) });
    const b = item({ id: 'b', createdAt: at(9), updatedAt: at(9) });
    const c = item({ id: 'c', createdAt: at(3), updatedAt: at(7) });
    expect(ids(sortItems([a, b, c], 'updated'))).toEqual(['b', 'c', 'a']);
    expect(SORT_LABEL.updated).toBe('Recently updated');
  });

  it('ties keep the manual order', () => {
    const same = [item({ id: 'x', title: 'Same' }), item({ id: 'y', title: 'same' })];
    expect(ids(sortItems(same, 'name'))).toEqual(['x', 'y']);
    expect(ids(sortItems([...same].reverse(), 'name'))).toEqual(['y', 'x']);
  });
});

describe('findItems — what the Collection shows', () => {
  it('narrows, then orders by the Collection\'s own sort', () => {
    const doc: CollectionDoc = { ...DOC, sort: 'name' };
    expect(ids(findItems(doc, 'brand', NO_FILTER))).toEqual(['guide', 'linear', 'zoo']);
    expect(ids(findItems(doc, '', { ...NO_FILTER, kinds: ['link'] }))).toEqual(['linear', 'swiss']);
  });

  it('with nothing asked for, it is every item in the manual order', () => {
    expect(findItems(DOC, '', NO_FILTER)).toEqual(DOC.items);
  });

  it('a drag can reorder only the manual order with nothing hidden', () => {
    expect(canReorder(DOC, '', NO_FILTER)).toBe(true);
    expect(canReorder(DOC, 'zoo', NO_FILTER)).toBe(false);
    expect(canReorder(DOC, '', { ...NO_FILTER, sources: ['YouTube'] })).toBe(false);
    expect(canReorder({ ...DOC, sort: 'added' }, '', NO_FILTER)).toBe(false);
  });
});
