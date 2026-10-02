'use client';
// The Documents trail — `Learning / Motion / After Effects`, where every crumb is
// an entry point rather than a label.
//
// This file is the WIRING and nothing else: `lib/doc-nav.ts` decides what sits
// where, `components/ds/ui/breadcrumbs.tsx` decides how a menu looks and
// behaves, and the verbs come in as handlers from `DocumentsView`, which owns
// the optimistic state. Keeping the three apart is what lets Projects or
// Clients grow a trail later without copying any of this.
//
// See DOCUMENT_NAVIGATION_UX.md for the spec these three files implement — and
// its 2026-09-14 revision: every crumb, the open page's included, answers ONE
// question ("what else is here?"), with nothing from outside the branch.
import { Icon, type Crumb, type CrumbMenuItem, type CrumbMenuSection, Breadcrumbs } from '@/components/ds/ui';
import {
  FileText, Folder as FolderIcon, Cards, ShareNetwork, Layout, Trash2, Database, Images, Plus, type IconType,
} from '@/components/ds/icons';
import { PageIcon } from '@/components/ui/page-icon';
import {
  docTrail, siblingsOf, childrenOf, siblingsHeading, SECTIONS,
  type NavNode, type NavSource, type SectionKind, type TrailTarget,
} from '@/lib/doc-nav';

const SECTION_ICON: Record<SectionKind, IconType> = {
  draft: FileText, all: Cards, collections: Images, shared: ShareNetwork, templates: Layout, trash: Trash2,
};

/** The verbs. Every one of them is already implemented in DocumentsView — the
 *  trail must never open its own second path to the same mutation. */
export interface DocNavHandlers {
  openPage: (id: string) => void;
  openFolder: (id: string) => void;
  openSection: (kind: SectionKind) => void;
  /** `parentId` nests the new page under an existing one. */
  newPage: (opts: { folderId: string | null; parentId?: string | null; type?: 'note' | 'template' | 'database' | 'collection' }) => void;
  /** Reveals the rail's inline folder-create input, parented here. Folders have
   *  no rename anywhere in the app, so creating one unnamed would be a dead end. */
  newFolder: (parentFolderId: string | null) => void;
}

export interface DocBreadcrumbsProps extends NavSource {
  target: TrailTarget;
  handlers: DocNavHandlers;
  className?: string;
}

export function DocBreadcrumbs({
  spaces, activeSpaceId, folders, pages, target, handlers, className,
}: DocBreadcrumbsProps) {
  const src: NavSource = { spaces, activeSpaceId, folders, pages };

  // ── Rendering one node ─────────────────────────────────────────────────────

  /** A menu row's glyph: every row has one, so a list of places scans as a list. */
  function glyph(n: NavNode) {
    if (n.kind === 'space') {
      return n.emoji
        ? <span aria-hidden className="text-[15px] leading-none">{n.emoji}</span>
        : <Icon icon={Cards} size={16} />;
    }
    if (n.kind === 'section') return <Icon icon={SECTION_ICON[n.id as SectionKind]} size={16} />;
    if (n.kind === 'folder') return <Icon icon={FolderIcon} size={16} />;
    if (n.kind === 'database') return <Icon icon={Database} size={16} />;
    if (n.kind === 'collection') return n.emoji ? <PageIcon icon={n.emoji} size={16} /> : <Icon icon={Images} size={16} />;
    return n.emoji ? <PageIcon icon={n.emoji} size={16} /> : <Icon icon={FileText} size={16} />;
  }

  /** A CRUMB's glyph: only an icon someone chose. A generic document or folder
   *  glyph in front of every crumb is noise the words already carry — Notion's
   *  trail draws an icon only where the page has its own. */
  function crumbGlyph(n: NavNode) {
    return (n.kind === 'page' || n.kind === 'database' || n.kind === 'collection') && n.emoji ? <PageIcon icon={n.emoji} size={16} /> : undefined;
  }

  function go(n: NavNode) {
    switch (n.kind) {
      case 'section': return handlers.openSection(n.id as SectionKind);
      case 'folder': return handlers.openFolder(n.id);
      case 'page':
      case 'database':
      case 'collection': return handlers.openPage(n.id);
      // No crumb or menu row is a workspace any more (see `docTrail`).
      case 'space': return;
    }
  }

  // Ids are namespaced by kind: a folder and a page may share an id space in
  // theory, and two rows keyed the same would collapse into one.
  const toItem = (n: NavNode): CrumbMenuItem => ({
    id: `${n.kind}:${n.id}`,
    label: n.label,
    icon: glyph(n),
    current: n.current,
    onSelect: () => go(n),
    children: n.hasChildren ? () => descend(n) : undefined,
  });

  /** What a row with a `>` opens: one level down, plus the way to add to it. */
  function descend(n: NavNode): CrumbMenuSection[] {
    const kids = childrenOf(src, n);
    const sections: CrumbMenuSection[] = [];
    if (kids.length) sections.push({ items: kids.map(toItem) });
    const create = creators(n);
    if (create.length) sections.push({ items: create });
    return sections;
  }

  /** The "+ New …" rows at the foot of a menu — always creating INTO `n`. */
  function creators(n: NavNode): CrumbMenuItem[] {
    const add = (id: string, label: string, icon: IconType, onSelect: () => void): CrumbMenuItem =>
      ({ id: `new:${id}`, label, icon: <Icon icon={icon} size={16} />, onSelect });

    switch (n.kind) {
      case 'space':
        return [];
      case 'section': {
        const kind = n.id as SectionKind;
        // Trash and Shared are not places you can put a new document — Trash is
        // an end state and Shared is a consequence of sharing one.
        if (kind === 'trash' || kind === 'shared') return [];
        // The Index makes Collections; the other sections make a doc (a template, in Templates).
        if (kind === 'collections') {
          return [add(`collection-${kind}`, 'New collection', Images, () => handlers.newPage({ folderId: null, type: 'collection' }))];
        }
        const template = kind === 'templates';
        return [add(
          `page-${kind}`,
          template ? 'New template' : 'New doc',
          Plus,
          () => handlers.newPage({ folderId: null, type: template ? 'template' : 'note' }),
        )];
      }
      case 'folder':
        return [
          add(`page-${n.id}`, 'New doc', Plus, () => handlers.newPage({ folderId: n.id })),
          add(`db-${n.id}`, 'New database', Database, () => handlers.newPage({ folderId: n.id, type: 'database' })),
          add(`collection-${n.id}`, 'New collection', Images, () => handlers.newPage({ folderId: n.id, type: 'collection' })),
          add(`folder-${n.id}`, 'New folder', FolderIcon, () => handlers.newFolder(n.id)),
        ];
      default: {
        // A page's menu lists its siblings, so "new" here means "another one
        // beside this", which is the folder or parent it already sits in.
        const self = pages.find((p) => p.id === n.id);
        if (!self) return [];
        return [add(
          `page-beside-${n.id}`,
          'New doc',
          Plus,
          () => handlers.newPage({ folderId: self.folder_id ?? null, parentId: self.parent_id ?? null }),
        )];
      }
    }
  }

  /**
   * A crumb's menu: what is beside it — itself among them, checked — under a
   * heading naming what holds them, and the way to add one more.
   *
   * The same for every crumb, the open page's included. That crumb used to swap
   * its siblings for six document actions, a second copy of the header's ⋯, and
   * every menu led with Recent and Favorites: information from outside the branch
   * the crumb describes (⌘K is the place for it).
   */
  function menuFor(n: NavNode): CrumbMenuSection[] {
    const sections: CrumbMenuSection[] = [{ label: siblingsHeading(src, n), items: siblingsOf(src, n).map(toItem) }];
    const create = creators(n);
    if (create.length) sections.push({ items: create });
    return sections;
  }

  // ── The trail ──────────────────────────────────────────────────────────────

  const trail = docTrail(src, target);
  const items: Crumb[] = trail.map((node) => ({
    label: node.label,
    icon: crumbGlyph(node),
    onNavigate: () => go(node),
    menu: () => menuFor(node),
    searchPlaceholder: 'Search…',
    emptyLabel: node.kind === 'folder' ? 'No pages in this folder yet' : 'No pages inside this one',
  }));

  return <Breadcrumbs items={items} className={className} />;
}

/** Re-exported so DocumentsView can build a target without importing two modules. */
export { SECTIONS };
export type { SectionKind, TrailTarget };
