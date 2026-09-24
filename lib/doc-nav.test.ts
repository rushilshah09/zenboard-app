import { describe, it, expect } from 'vitest';
import {
  docTrail, siblingsOf, childrenOf, folderChain, pageChain, sectionOf,
  pagesInSection, siblingsHeading, pageLabel,
  type NavSource, type NavPage, type NavNode,
} from './doc-nav';

const page = (o: Partial<NavPage> & { id: string }): NavPage => ({
  folder_id: null, parent_id: null, title: o.id, type: 'note', ...o,
});

// Learning ─┬ Motion ─┬ After Effects ─ Keyframes (nested page)
//           │         └ Premiere
//           └ UX
// plus a loose draft, a template, an archived page and a second space.
const src: NavSource = {
  spaces: [{ id: 's1', name: 'Rushil’s Brain', emoji: '🧠' }, { id: 's2', name: 'Studio' }],
  activeSpaceId: 's1',
  folders: [
    { id: 'learning', name: 'Learning', parent_folder_id: null },
    { id: 'motion', name: 'Motion', parent_folder_id: 'learning' },
    { id: 'ux', name: 'UX', parent_folder_id: 'learning' },
    { id: 'brand', name: 'Brand Assets', parent_folder_id: null },
  ],
  pages: [
    page({ id: 'ae', title: 'After Effects', folder_id: 'motion' }),
    page({ id: 'keyframes', title: 'Keyframes', folder_id: 'motion', parent_id: 'ae' }),
    page({ id: 'premiere', title: 'Premiere', folder_id: 'motion' }),
    page({ id: 'sources', title: 'Learning Sources', folder_id: 'learning' }),
    page({ id: 'db', title: 'Reading list', folder_id: 'learning', type: 'database' }),
    page({ id: 'loose', title: '', folder_id: null }),
    page({ id: 'tpl', title: 'Kickoff', type: 'template' }),
    page({ id: 'gone', title: 'Old', folder_id: 'brand', archived_at: '2026-01-01' }),
    page({ id: 'shared', title: 'Scope', folder_id: 'brand', client_visible: true }),
  ],
};

const labels = (ns: NavNode[]) => ns.map((n) => n.label);

describe('pageLabel', () => {
  it('falls back to Untitled only for display', () => {
    expect(pageLabel({ title: '' })).toBe('Untitled');
    expect(pageLabel({ title: '  ' })).toBe('Untitled');
    expect(pageLabel({ title: 'Real' })).toBe('Real');
  });
});

describe('folderChain / pageChain', () => {
  it('walks root-first and includes the folder itself', () => {
    expect(folderChain(src, 'motion').map((f) => f.name)).toEqual(['Learning', 'Motion']);
  });

  it('walks page ancestors but never the page itself', () => {
    expect(pageChain(src, 'keyframes').map((p) => p.id)).toEqual(['ae']);
    expect(pageChain(src, 'ae')).toEqual([]);
  });

  it('survives a cyclic parent chain instead of hanging', () => {
    const looped: NavSource = {
      ...src,
      folders: [{ id: 'a', name: 'A', parent_folder_id: 'b' }, { id: 'b', name: 'B', parent_folder_id: 'a' }],
    };
    expect(folderChain(looped, 'a').map((f) => f.id)).toEqual(['b', 'a']);
  });
});

describe('sectionOf', () => {
  it('sends a homeless page to the section that actually owns it', () => {
    expect(sectionOf(page({ id: 'x' }))).toBe('draft');
    expect(sectionOf(page({ id: 'x', type: 'template' }))).toBe('templates');
    // Archived wins over template — Trash is where it IS.
    expect(sectionOf(page({ id: 'x', type: 'template', archived_at: 'now' }))).toBe('trash');
  });
});

// COLLECTION_PLAN X1: the Index is a section, Collections — a Collection's home the way Templates is a template's.
describe('the Collections section', () => {
  it('is where a Collection belongs, and Trash wins as ever', () => {
    expect(sectionOf(page({ id: 'c', type: 'collection' }))).toBe('collections');
    expect(sectionOf(page({ id: 'c', type: 'collection', archived_at: 'now' }))).toBe('trash');
  });

  it('lists every live Collection, filed or not, and nothing else', () => {
    const s: NavSource = {
      spaces: [], activeSpaceId: null, folders: [],
      pages: [
        page({ id: 'c1', type: 'collection' }),
        page({ id: 'c2', type: 'collection', folder_id: 'f1' }),
        page({ id: 'c3', type: 'collection', archived_at: 'now' }),
        page({ id: 'd1' }),
      ],
    };
    expect(pagesInSection(s, 'collections').map((p) => p.id)).toEqual(['c1', 'c2']);
  });
});

describe('pagesInSection', () => {
  it('keeps archived pages out of every section but Trash', () => {
    expect(pagesInSection(src, 'trash').map((p) => p.id)).toEqual(['gone']);
    expect(pagesInSection(src, 'all').map((p) => p.id)).not.toContain('gone');
  });
  it('Drafts is "no folder, not a template"', () => {
    expect(pagesInSection(src, 'draft').map((p) => p.id)).toEqual(['loose']);
  });
  it('Shared reads client_visible', () => {
    expect(pagesInSection(src, 'shared').map((p) => p.id)).toEqual(['shared']);
  });
});

describe('docTrail', () => {
  // The trail names where THIS page lives, and nothing above that. It used to
  // open on the workspace — hierarchy every document in the view shares, which
  // the sidebar already names and switches (user brief, 2026-09-14: "do not
  // expose unnecessary hierarchy").
  it('starts where the page lives and walks the folder chain to the page', () => {
    expect(labels(docTrail(src, { kind: 'page', id: 'ae' })))
      .toEqual(['Learning', 'Motion', 'After Effects']);
  });

  it('includes ancestor PAGES, not just folders', () => {
    expect(labels(docTrail(src, { kind: 'page', id: 'keyframes' })))
      .toEqual(['Learning', 'Motion', 'After Effects', 'Keyframes']);
  });

  it('names the section a homeless page lives in', () => {
    expect(labels(docTrail(src, { kind: 'page', id: 'loose' }))).toEqual(['Draft', 'Untitled']);
    expect(labels(docTrail(src, { kind: 'page', id: 'tpl' }))).toEqual(['Templates', 'Kickoff']);
  });

  it('never includes the workspace', () => {
    for (const target of [{ kind: 'page', id: 'keyframes' }, { kind: 'folder', id: 'ux' }, { kind: 'section', id: 'draft' }] as const) {
      expect(docTrail(src, target).map((n) => n.kind)).not.toContain('space');
    }
  });

  it('marks exactly one crumb current — the last', () => {
    const t = docTrail(src, { kind: 'page', id: 'ae' });
    expect(t.filter((c) => c.current).map((c) => c.label)).toEqual(['After Effects']);
  });

  it('carries the page kind so a database is not drawn as a doc', () => {
    const t = docTrail(src, { kind: 'page', id: 'db' });
    expect(t[t.length - 1].kind).toBe('database');
  });

  it('works with no page open (a folder or a section is the destination)', () => {
    expect(labels(docTrail(src, { kind: 'folder', id: 'motion' }))).toEqual(['Learning', 'Motion']);
    expect(labels(docTrail(src, { kind: 'section', id: 'trash' }))).toEqual(['Trash']);
  });

  it('is empty for a page id that no longer exists', () => {
    expect(docTrail(src, { kind: 'page', id: 'deleted' })).toEqual([]);
  });
});

describe('siblingsHeading — what a crumb menu says it is listing', () => {
  // Notion heads the list "Other pages in Studio Departments". Without a heading
  // a menu of siblings reads as a list of somewhere, which is why hovering a
  // crumb felt like opening a random menu.
  it('a page lists the pages beside it, named by what holds them', () => {
    expect(siblingsHeading(src, { id: 'ae', kind: 'page', label: 'After Effects' })).toBe('Pages in Motion');
    expect(siblingsHeading(src, { id: 'keyframes', kind: 'page', label: 'Keyframes' })).toBe('Pages in After Effects');
    expect(siblingsHeading(src, { id: 'loose', kind: 'page', label: 'Untitled' })).toBe('Pages in Draft');
    expect(siblingsHeading(src, { id: 'db', kind: 'database', label: 'Reading list' })).toBe('Pages in Learning');
  });

  it('a folder lists the folders beside it', () => {
    expect(siblingsHeading(src, { id: 'motion', kind: 'folder', label: 'Motion' })).toBe('Folders in Learning');
    expect(siblingsHeading(src, { id: 'learning', kind: 'folder', label: 'Learning' })).toBe('Folders');
  });

  it('the sections need no heading — they are the Docs rail itself', () => {
    expect(siblingsHeading(src, { id: 'draft', kind: 'section', label: 'Draft' })).toBeUndefined();
  });
});

describe('siblingsOf — one rule at every level', () => {
  it('space → every workspace, active one checked', () => {
    const rows = siblingsOf(src, { id: 's1', kind: 'space', label: 'Rushil’s Brain' });
    expect(labels(rows)).toEqual(['Rushil’s Brain', 'Studio']);
    expect(rows.find((r) => r.current)?.id).toBe('s1');
  });

  it('folder → folders sharing its parent, itself among them and checked', () => {
    const rows = siblingsOf(src, { id: 'motion', kind: 'folder', label: 'Motion' });
    expect(labels(rows)).toEqual(['Motion', 'UX']);
    expect(rows.find((r) => r.current)?.id).toBe('motion');
    expect(rows.find((r) => r.id === 'motion')?.hasChildren).toBe(true);
    expect(rows.find((r) => r.id === 'ux')?.hasChildren).toBe(false);
  });

  it('nested page → the other children of its parent page', () => {
    expect(labels(siblingsOf(src, { id: 'keyframes', kind: 'page', label: 'Keyframes' }))).toEqual(['Keyframes']);
  });

  it('top-level page in a folder → the folder’s other top-level pages, nested ones excluded', () => {
    const rows = siblingsOf(src, { id: 'ae', kind: 'page', label: 'After Effects' });
    expect(labels(rows)).toEqual(['After Effects', 'Premiere']);
    expect(rows.map((r) => r.id)).not.toContain('keyframes');
  });

  it('homeless page → its section’s top-level pages', () => {
    expect(labels(siblingsOf(src, { id: 'loose', kind: 'page', label: 'Untitled' }))).toEqual(['Untitled']);
  });

  it('section → all six, current checked', () => {
    const rows = siblingsOf(src, { id: 'templates', kind: 'section', label: 'Templates' });
    // Collections joined the sections on 2026-09-16 (COLLECTION_PLAN X1) — the Index, beside All documents.
    expect(labels(rows)).toEqual(['Draft', 'All documents', 'Collections', 'Shared', 'Templates', 'Trash']);
    expect(rows.find((r) => r.current)?.id).toBe('templates');
  });
});

describe('childrenOf — one level down', () => {
  it('folder → child folders first, then its top-level pages', () => {
    expect(labels(childrenOf(src, { id: 'learning', kind: 'folder', label: 'Learning' })))
      .toEqual(['Motion', 'UX', 'Learning Sources', 'Reading list']);
  });

  it('folder children exclude pages nested under another page', () => {
    expect(labels(childrenOf(src, { id: 'motion', kind: 'folder', label: 'Motion' })))
      .toEqual(['After Effects', 'Premiere']);
  });

  it('page → its child pages', () => {
    expect(labels(childrenOf(src, { id: 'ae', kind: 'page', label: 'After Effects' }))).toEqual(['Keyframes']);
  });

  it('only the ACTIVE space can be descended into — the others aren’t loaded', () => {
    expect(childrenOf(src, { id: 's1', kind: 'space', label: 'Rushil’s Brain' })).toHaveLength(6);
    expect(childrenOf(src, { id: 's2', kind: 'space', label: 'Studio' })).toEqual([]);
  });

  it('archived pages never appear as children', () => {
    expect(labels(childrenOf(src, { id: 'brand', kind: 'folder', label: 'Brand Assets' }))).toEqual(['Scope']);
  });
});

describe('a Collection is its own kind of page', () => {
  // COLLECTION_ITEM_BRIEF: a Collection sits beside a database — never a view of one, and never a plain document.
  const withCollection: NavSource = { ...src, pages: [...src.pages, page({ id: 'refs', title: 'Brand references', folder_id: 'learning', type: 'collection' })] };

  it('is listed as a collection wherever pages are listed', () => {
    const inLearning = childrenOf(withCollection, { id: 'learning', kind: 'folder', label: 'Learning' });
    expect(inLearning.find((n) => n.id === 'refs')?.kind).toBe('collection');
  });

  it('names what holds it, as any page does', () => {
    expect(siblingsHeading(withCollection, { id: 'refs', kind: 'collection', label: 'Brand references' })).toBe('Pages in Learning');
    expect(siblingsOf(withCollection, { id: 'refs', kind: 'collection', label: 'Brand references' }).some((n) => n.id === 'refs' && n.current)).toBe(true);
  });
});
