// THE navigation projection for Documents — the one place that answers "where
// does this document live, and what sits next to it?".
//
// Everything that draws a trail, a breadcrumb menu, a "move to" picker or a
// location line reads it from here. That rule is not decoration: `connected.ts`,
// `goal-rollup.ts` and `habit-schedule.ts` all exist because two callers had
// each worked the same hierarchy out for themselves and quietly disagreed.
//
// Pure and synchronous on purpose. `DocumentsView` already holds every folder
// and every page of the space before the header renders, so a sibling lookup is
// an array filter — there is nothing here to await. (The DS breadcrumb still
// types its menu source as possibly-async, so a space large enough to need
// paging can become async later without touching a call site.)
//
// See DOCUMENT_NAVIGATION_UX.md §2 for what each level is supposed to show.

/** The five rail views. Not containers — filters — except `draft`/`templates`/
 *  `trash`, which are genuinely "the pages that belong nowhere else". */
export type SectionKind = 'draft' | 'all' | 'collections' | 'shared' | 'templates' | 'trash';

export type NavKind = 'space' | 'section' | 'folder' | 'database' | 'collection' | 'page';

/** One row in a breadcrumb menu, or one crumb in the trail. */
export type NavNode = {
  /** Space id · SectionKind · folder id · page id. Unique within a kind, not across. */
  id: string;
  kind: NavKind;
  label: string;
  /** Emoji (space, page icon). The caller decides how to render it. */
  emoji?: string | null;
  /** On the current trail — the ✓ and the held highlight. */
  current?: boolean;
  /** Opening this row's submenu would show something. */
  hasChildren?: boolean;
};

// ── The source rows ──────────────────────────────────────────────────────────
// Structural subsets of the real tables, so a caller can pass its existing rows
// straight in (Page carries far more than this; extra keys are ignored).

export type NavSpace = { id: string; name: string; emoji?: string | null };
export type NavFolder = { id: string; name: string; parent_folder_id: string | null };
export type NavPage = {
  id: string;
  folder_id: string | null;
  parent_id?: string | null;
  title: string | null;
  type: string;
  icon?: string | null;
  client_visible?: boolean | null;
  archived_at?: string | null;
};

export type NavSource = {
  spaces: NavSpace[];
  activeSpaceId: string | null;
  folders: NavFolder[];
  /** Every page of the space, archived ones included — `trash` needs them. */
  pages: NavPage[];
};

// Labels are the RAIL's labels, verbatim. One name per concept: a crumb reading
// "Drafts" beside a rail row reading "Draft" is two names for one place.
export const SECTIONS: { kind: SectionKind; label: string }[] = [
  { kind: 'draft', label: 'Draft' },
  { kind: 'all', label: 'All documents' },
  { kind: 'collections', label: 'Collections' },
  { kind: 'shared', label: 'Shared' },
  { kind: 'templates', label: 'Templates' },
  { kind: 'trash', label: 'Trash' },
];

const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.kind, s.label])) as Record<SectionKind, string>;

/** Display title. Empty stays empty in the database (Notion-style placeholder in
 *  the editor); "Untitled" is a *display* fallback and belongs only here. */
export function pageLabel(p: Pick<NavPage, 'title'>): string {
  return p.title?.trim() || 'Untitled';
}

const pageKind = (p: NavPage): NavKind => (p.type === 'database' ? 'database' : p.type === 'collection' ? 'collection' : 'page');

// ── Tree walks ───────────────────────────────────────────────────────────────
// Every walk carries a `seen` set. A folder whose parent chain loops back on
// itself is not reachable through the UI, but it is reachable through a bad
// migration, and an infinite loop in a header takes the whole page down.

function folderById(src: NavSource, id: string | null): NavFolder | null {
  return id ? src.folders.find((f) => f.id === id) ?? null : null;
}
function pageById(src: NavSource, id: string | null): NavPage | null {
  return id ? src.pages.find((p) => p.id === id) ?? null : null;
}

/** Root-first chain of folders down to and including `folderId`. */
export function folderChain(src: NavSource, folderId: string | null): NavFolder[] {
  const out: NavFolder[] = [];
  const seen = new Set<string>();
  let f = folderById(src, folderId);
  while (f && !seen.has(f.id)) {
    seen.add(f.id);
    out.unshift(f);
    f = folderById(src, f.parent_folder_id);
  }
  return out;
}

/** Root-first chain of ancestor pages ABOVE `pageId` (never the page itself). */
export function pageChain(src: NavSource, pageId: string | null): NavPage[] {
  const out: NavPage[] = [];
  const seen = new Set<string>();
  const p = pageById(src, pageId);
  if (p) seen.add(p.id);
  let parent = pageById(src, p?.parent_id ?? null);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    out.unshift(parent);
    parent = pageById(src, parent.parent_id ?? null);
  }
  return out;
}

/**
 * Which section a page belongs to when it has no folder.
 *
 * Not a guess: a template's home IS Templates and an archived page's home IS
 * Trash, so saying "Drafts" for either would name a place the page isn't in.
 */
export function sectionOf(p: NavPage): SectionKind {
  if (p.archived_at) return 'trash';
  if (p.type === 'template') return 'templates';
  // A Collection's home is the Index (COLLECTION_PLAN X1), the way a template's is Templates.
  if (p.type === 'collection') return 'collections';
  return 'draft';
}

// ── Membership ───────────────────────────────────────────────────────────────

const live = (src: NavSource) => src.pages.filter((p) => !p.archived_at);

export function pagesInSection(src: NavSource, kind: SectionKind): NavPage[] {
  switch (kind) {
    case 'trash': return src.pages.filter((p) => p.archived_at);
    case 'shared': return live(src).filter((p) => p.client_visible);
    case 'templates': return live(src).filter((p) => p.type === 'template');
    case 'draft': return live(src).filter((p) => !p.folder_id && p.type !== 'template');
    case 'all': return live(src);
    case 'collections': return live(src).filter((p) => p.type === 'collection');
  }
}

/** Top-level pages of a folder — nested children hang off their parent instead. */
const topLevelPagesIn = (src: NavSource, folderId: string | null) =>
  live(src).filter((p) => (p.folder_id ?? null) === folderId && !p.parent_id);

const childFolders = (src: NavSource, parentId: string | null) =>
  src.folders.filter((f) => (f.parent_folder_id ?? null) === parentId);

const childPages = (src: NavSource, parentId: string) =>
  live(src).filter((p) => p.parent_id === parentId);

// ── The trail ────────────────────────────────────────────────────────────────

export type TrailTarget =
  | { kind: 'page'; id: string }
  | { kind: 'folder'; id: string }
  | { kind: 'section'; id: SectionKind };

/**
 * The breadcrumb trail, root-first: where the page lives, then the page.
 *
 * It does NOT start at the workspace any more. Every document in the view shares
 * that level, the sidebar already names it and switches it, and the user's brief
 * for the trail was "only show information that is relevant to the current page …
 * do not expose unnecessary hierarchy" (2026-09-14). A trail that opened on the
 * workspace spent its first crumb on the one thing that never differs.
 */
export function docTrail(src: NavSource, target: TrailTarget): NavNode[] {
  const out: NavNode[] = [];

  const pushFolders = (folderId: string | null) => {
    for (const f of folderChain(src, folderId)) {
      out.push({ id: f.id, kind: 'folder', label: f.name, hasChildren: hasChildren(src, { id: f.id, kind: 'folder', label: f.name }) });
    }
  };
  const pushSection = (kind: SectionKind) => {
    out.push({ id: kind, kind: 'section', label: SECTION_LABEL[kind], hasChildren: pagesInSection(src, kind).length > 0 });
  };

  if (target.kind === 'section') {
    pushSection(target.id);
  } else if (target.kind === 'folder') {
    pushFolders(target.id);
  } else {
    const page = pageById(src, target.id);
    if (!page) return out;
    // Where the page lives: a folder chain when it has one, otherwise the
    // section that owns homeless pages of its kind.
    if (page.folder_id) pushFolders(page.folder_id);
    else pushSection(sectionOf(page));
    // …then every page above it, then the page.
    for (const a of pageChain(src, page.id)) {
      out.push({ id: a.id, kind: pageKind(a), label: pageLabel(a), emoji: a.icon, hasChildren: childPages(src, a.id).length > 0 });
    }
    out.push({ id: page.id, kind: pageKind(page), label: pageLabel(page), emoji: page.icon, current: true, hasChildren: childPages(src, page.id).length > 0 });
  }

  // The last crumb is where you are, whatever kind it turned out to be.
  const last = out[out.length - 1];
  if (last) last.current = true;
  return out;
}

// ── What a crumb's menu shows ────────────────────────────────────────────────

/**
 * The rows a crumb opens: its SIBLINGS, itself among them and checked.
 *
 * One rule for every level, which is what makes the trail learnable — hovering
 * anything answers the same question ("what else is here?"). Descending is the
 * submenu's job, never this list's.
 */
export function siblingsOf(src: NavSource, node: NavNode): NavNode[] {
  switch (node.kind) {
    case 'space':
      return src.spaces.map((s) => ({
        id: s.id, kind: 'space' as const, label: s.name, emoji: s.emoji,
        current: s.id === node.id, hasChildren: s.id === node.id,
      }));

    case 'section':
      return SECTIONS.map((s) => ({
        id: s.kind, kind: 'section' as const, label: s.label,
        current: s.kind === node.id, hasChildren: pagesInSection(src, s.kind).length > 0,
      }));

    case 'folder': {
      const self = folderById(src, node.id);
      return childFolders(src, self?.parent_folder_id ?? null).map((f) => ({
        id: f.id, kind: 'folder' as const, label: f.name,
        current: f.id === node.id, hasChildren: hasChildren(src, { id: f.id, kind: 'folder', label: f.name }),
      }));
    }

    case 'page':
    case 'database':
    case 'collection': {
      const self = pageById(src, node.id);
      if (!self) return [];
      // Siblings = the pages sharing this page's parent. Under a page that
      // means its children; at the top of a folder or section it means the
      // other top-level pages there.
      const pool = self.parent_id
        ? childPages(src, self.parent_id)
        : self.folder_id
          ? topLevelPagesIn(src, self.folder_id)
          : pagesInSection(src, sectionOf(self)).filter((p) => !p.parent_id);
      return pool.map((p) => ({
        id: p.id, kind: pageKind(p), label: pageLabel(p), emoji: p.icon,
        current: p.id === node.id, hasChildren: childPages(src, p.id).length > 0,
      }));
    }
  }
}

/** What hovering a row opens — one level down. Empty means no `>` was drawn. */
export function childrenOf(src: NavSource, node: NavNode): NavNode[] {
  switch (node.kind) {
    case 'space':
      // Only the ACTIVE space can be descended into: the others' folders and
      // pages are not loaded, and RLS would need a round trip to get them.
      return node.id === src.activeSpaceId
        ? SECTIONS.map((s) => ({ id: s.kind, kind: 'section' as const, label: s.label, hasChildren: pagesInSection(src, s.kind).length > 0 }))
        : [];

    case 'section':
      return pagesInSection(src, node.id as SectionKind)
        .filter((p) => !p.parent_id)
        .map((p) => ({ id: p.id, kind: pageKind(p), label: pageLabel(p), emoji: p.icon, hasChildren: childPages(src, p.id).length > 0 }));

    case 'folder':
      return [
        ...childFolders(src, node.id).map((f) => ({
          id: f.id, kind: 'folder' as const, label: f.name,
          hasChildren: hasChildren(src, { id: f.id, kind: 'folder' as const, label: f.name }),
        })),
        ...topLevelPagesIn(src, node.id).map((p) => ({
          id: p.id, kind: pageKind(p), label: pageLabel(p), emoji: p.icon,
          hasChildren: childPages(src, p.id).length > 0,
        })),
      ];

    case 'page':
    case 'database':
    case 'collection':
      return childPages(src, node.id).map((p) => ({
        id: p.id, kind: pageKind(p), label: pageLabel(p), emoji: p.icon,
        hasChildren: childPages(src, p.id).length > 0,
      }));
  }
}

/**
 * The heading over a crumb's list of siblings — Notion's "Other pages in …".
 *
 * A list with no heading reads as a list of SOMEWHERE; naming what holds the
 * rows says which question the menu is answering. Sections get none: they are
 * the Docs rail's own five rows, and a heading would only repeat that.
 */
export function siblingsHeading(src: NavSource, node: NavNode): string | undefined {
  switch (node.kind) {
    case 'space':
      return 'Workspaces';
    case 'section':
      return undefined;
    case 'folder': {
      const parent = folderById(src, folderById(src, node.id)?.parent_folder_id ?? null);
      return parent ? `Folders in ${parent.name}` : 'Folders';
    }
    case 'page':
    case 'database':
    case 'collection': {
      const self = pageById(src, node.id);
      if (!self) return undefined;
      const parentPage = pageById(src, self.parent_id ?? null);
      if (parentPage) return `Pages in ${pageLabel(parentPage)}`;
      const folder = folderById(src, self.folder_id);
      return `Pages in ${folder ? folder.name : SECTION_LABEL[sectionOf(self)]}`;
    }
  }
}

/** Cheap `hasChildren` for folders — avoids building both child arrays twice. */
function hasChildren(src: NavSource, node: Pick<NavNode, 'id' | 'kind' | 'label'>): boolean {
  if (node.kind !== 'folder') return false;
  return childFolders(src, node.id).length > 0 || topLevelPagesIn(src, node.id).length > 0;
}
