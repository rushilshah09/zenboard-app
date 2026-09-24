import { describe, it, expect } from 'vitest';
import { toBlocks, blocksToText, blocksToMarkdown, type Block, asBlockType, BLOCK_TYPES, BLOCK_MENU, slashMenu, menuKey, markdownPrefix, FILTERED_SECTION, hasBody } from './blocks';

/**
 * A link block carries YOUR note, not just the URL.
 *
 * The bookmark card already showed a description, but it was SCRAPED from the
 * page — and for the links people actually paste that is useless: a Drive
 * folder says "Sign in to continue", a Figma file says "Figma". The sentence
 * that matters ("Final logos — use these, not the old folder") had nowhere to
 * live, and the two functions below would have dropped it silently, which is
 * the same failure that once took a proposal's prices out of copied text.
 */
const link = (text: string, src = 'https://drive.google.com/x'): Block =>
  ({ id: 'b1', type: 'bookmark', text, src });

describe('link block notes', () => {
  it('keeps the note in searchable text, alongside the URL', () => {
    const t = blocksToText([link('Final logos — use these, not the old folder')]);
    expect(t).toContain('Final logos');
    expect(t).toContain('drive.google.com');
  });

  it('falls back to the bare URL when no note was written', () => {
    expect(blocksToText([link('')])).toContain('drive.google.com');
    expect(blocksToText([link('   ')]).trim()).toBe('https://drive.google.com/x');
  });

  it('exports the note as the link label', () => {
    // A bare URL in an export loses the one line saying what it is for.
    expect(blocksToMarkdown([link('Approved 12 Aug')]))
      .toContain('[Approved 12 Aug](https://drive.google.com/x)');
  });

  it('exports a plain URL when there is no note', () => {
    expect(blocksToMarkdown([link('')]).trim()).toBe('https://drive.google.com/x');
  });

  it('survives the round trip through storage', () => {
    // `toBlocks` is the trust boundary and DROPS any field it does not name.
    // The note rides on `text`, which every block has always carried — which is
    // precisely why this feature needed no migration.
    const [out] = toBlocks([{ id: 'b1', type: 'bookmark', text: 'Brand assets', src: 'https://x.com/a' }]);
    expect(out.text).toBe('Brand assets');
    expect(out.src).toBe('https://x.com/a');
  });

  it('applies to every link-shaped block, not just bookmarks', () => {
    // file / pdf / video / audio / embed all take a URL and all deserve a note;
    // one of them behaving differently is how a rule stops being a rule.
    for (const type of ['embed', 'video', 'audio', 'pdf', 'file'] as const) {
      const b: Block = { id: 'x', type, text: 'The brief', src: 'https://x.com/a' };
      expect(blocksToText([b])).toContain('The brief');
      expect(blocksToMarkdown([b])).toContain('[The brief]');
    }
  });
});

describe('a database block remembers the layout it was made with', () => {
  // "Try again" on a database that failed to save must make the SAME layout the
  // person picked from the slash menu — a board retried as a table is a
  // different thing than they asked for. `normalize` is the trust boundary for
  // stored content and drops every field it does not name.
  it('keeps a known layout through a save and reload', () => {
    const [b] = toBlocks({ blocks: [{ id: 'b1', type: 'collection', text: '', colId: 'error:offline', dbKind: 'board' }] });
    expect(b).toMatchObject({ type: 'collection', colId: 'error:offline', dbKind: 'board' });
  });

  it('drops a layout it does not know, and never puts one on another block type', () => {
    const [bad, text] = toBlocks({ blocks: [
      { id: 'b1', type: 'collection', text: '', colId: 'x', dbKind: 'spreadsheet' },
      { id: 'b2', type: 'text', text: 'hi', dbKind: 'board' },
    ] });
    expect(bad.dbKind).toBeUndefined();
    expect(text.dbKind).toBeUndefined();
  });
});

describe('asBlockType — the trust boundary on the one field everything switches on', () => {
  it('keeps every real type', () => {
    for (const t of BLOCK_TYPES) expect(asBlockType(t)).toBe(t);
  });

  // The failure this guard exists for is SILENT: the block rendered, edited and
  // saved, but matched nothing in the editor's type maps, so it dropped out of
  // the document's typography onto the app's 14px UI text. 'p' is not a guess —
  // it is what the Documents harness had been seeding, and the only reason it
  // was ever noticed is that a measurement said 14px where the code said 16.
  it('lands an unrecognised type on text rather than nowhere', () => {
    for (const t of ['p', 'paragraph', 'heading_1', 'PARAGRAPH', '']) expect(asBlockType(t)).toBe('text');
  });

  it('lands a missing or non-string type on text', () => {
    for (const t of [undefined, null, 0, 1, {}, [], true]) expect(asBlockType(t)).toBe('text');
  });

  it('a block with an unknown type keeps its words', () => {
    const [b] = toBlocks({ blocks: [{ id: 'x', type: 'p', text: 'Kickoff notes' }] });
    expect(b.type).toBe('text');
    expect(b.text).toBe('Kickoff notes');
    expect(b.id).toBe('x');
  });
});

describe('slashMenu — the ONE list the menu draws and Enter picks from', () => {
  // The menu used to draw its rows regrouped while Enter picked from the list in
  // DATA order. Line items and Accept sat before the database entries in the data
  // and after them on screen — so arrowing to "Table view" and pressing Enter
  // inserted Line items. A row's place in this list is its keyboard index.
  it('lists the groups in the order they are drawn', () => {
    const rows = slashMenu('', []);
    const sections = rows.map((r) => r.section).filter((g, i, a) => g !== a[i - 1]);
    expect(sections).toEqual(['Basic blocks', 'Media', 'Database', 'Advanced blocks']);
    const tableView = rows.findIndex((r) => r.label === 'Table view');
    expect(rows.slice(0, tableView).some((r) => r.type === 'lineitems' || r.type === 'accept')).toBe(false);
  });

  it('puts recent picks first, and tells database layouts apart', () => {
    // Recents stored the block TYPE, so every database was "collection" — a board
    // you had just made came back as "Table view".
    const recent = slashMenu('', ['collection:board', 'h2']).filter((r) => r.section === 'Recent');
    expect(recent.map((r) => r.label)).toEqual(['Board view', 'Heading 2']);
  });

  it('drops a remembered key that no longer names exactly one entry', () => {
    expect(slashMenu('', ['collection', 'no-such-block']).filter((r) => r.section === 'Recent')).toEqual([]);
  });

  it('ranks what you typed: the exact name, then names starting with it, then keywords', () => {
    const labels = slashMenu('table', []).map((r) => r.label);
    expect(labels.slice(0, 2)).toEqual(['Table', 'Table view']);
    expect(labels.indexOf('Database — Inline')).toBeGreaterThan(1);
  });

  it('finds a layout by the word people use for it', () => {
    expect(slashMenu('kanban', [])[0].label).toBe('Board view');
    expect(slashMenu('calendar', [])[0].label).toBe('Calendar view');
    // COLLECTION_ITEM_BRIEF §12: "/collection" makes a Collection — its own item, never a database view.
    expect(slashMenu('collection', [])[0].label).toBe('Collection');
    expect(slashMenu('linked', [])[0].label).toBe('Linked view of database');
  });

  it('puts typed results under one heading — the ranking, not the group, is the order', () => {
    expect(new Set(slashMenu('view', []).map((r) => r.section))).toEqual(new Set([FILTERED_SECTION]));
  });

  it('shows only shortcuts that really make the block as you type', () => {
    // The row's trailing hint ("#", "##", "```") is a promise about typing; a
    // hint the editor does not honour would teach a keystroke that does nothing.
    const withShortcut = BLOCK_MENU.filter((m) => m.shortcut);
    expect(withShortcut.length).toBeGreaterThanOrEqual(10);
    for (const m of withShortcut) {
      const typed = markdownPrefix(m.shortcut + ' ') ?? markdownPrefix(m.shortcut!);
      expect(typed, `${m.label} ${m.shortcut}`).toBe(m.type);
    }
  });

  it('gives every entry a caption for its preview', () => {
    for (const m of BLOCK_MENU) {
      expect(m.hint.length, m.label).toBeGreaterThan(8);
      expect(m.hint.endsWith('.'), m.label).toBe(false);
    }
  });
});

describe('the database entries of the slash menu', () => {
  const db = BLOCK_MENU.filter((m) => m.type === 'collection');

  it('offer every layout that renders, and the three ways to place a database', () => {
    expect(db.map((m) => m.label)).toEqual([
      'Table view', 'Board view', 'Gallery view', 'List view', 'Calendar view', 'Timeline view',
      'Database — Inline', 'Database — Full page', 'Linked view of database',
    ]);
  });

  it('each says something different, and is remembered as itself', () => {
    expect(new Set(db.map((m) => m.hint)).size).toBe(db.length);
    expect(new Set(db.map(menuKey)).size).toBe(db.length);
  });
});

describe('hasBody — whether a page has anything in it', () => {
  it('is false for a new page, an empty paragraph and stray whitespace', () => {
    expect(hasBody(undefined)).toBe(false);
    expect(hasBody({ blocks: [] })).toBe(false);
    expect(hasBody({ blocks: [{ id: 'a', type: 'text', text: '' }, { id: 'b', type: 'h2', text: '   ' }] })).toBe(false);
  });

  it('is true for a word, and for a block that is something without words', () => {
    expect(hasBody({ blocks: [{ id: 'a', type: 'text', text: 'Brief' }] })).toBe(true);
    expect(hasBody({ blocks: [{ id: 'a', type: 'divider', text: '' }] })).toBe(true);
    expect(hasBody({ blocks: [{ id: 'a', type: 'collection', text: '', colId: 'x' }] })).toBe(true);
  });

  it('never throws on content that is not a block document', () => {
    expect(hasBody('text')).toBe(false);
    expect(hasBody({ blocks: [null, 3, 'x'] })).toBe(false);
  });
});

describe('the Collection entry of the slash menu', () => {
  // COLLECTION_ITEM_BRIEF: a Collection is its own item — a page of its own, beside a database, never a view of one.
  const entry = BLOCK_MENU.find((m) => m.label === 'Collection');

  it('makes a page of its own kind, remembered as itself', () => {
    expect(entry).toMatchObject({ type: 'page', page: 'collection', group: 'Basic blocks' });
    expect(menuKey(entry!)).toBe('page:collection');
    expect(menuKey(BLOCK_MENU.find((m) => m.label === 'Page')!)).toBe('page');
  });

  it('is not a database entry', () => {
    expect(BLOCK_MENU.filter((m) => m.type === 'collection').some((m) => m.label.includes('Collection'))).toBe(false);
  });
});
