'use client';
// Documents hub — pixel-matched to the HiFi frames:
//   · 230px rail: Draft (always plum) · All Projects · Shared · Templates,
//     a collapsible "Folders" section (caret + inline create), Trash2 pinned low.
//     Rows3 34px / radius 6 / 14px labels; active row = grey pill.
//   · content topbar: grid views get the [+ New Page][Folder][Template] outline
//     buttons; an open doc gets breadcrumb chips (Private · folder · title) with
//     the save status + Share on the right.
//   · 271×320 card grid: grey dashed "New doc" card, white doc cards with
//     title/updated/tag-chips head over a content-preview body.
//   · editor: white sheet card (r12) floating on the canvas.
// All operations preserved: create (page/template/folder), rename, duplicate,
// favorite, move-to-folder, share link, archive/restore, delete. Autosaved.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FileText, Repeat, Plus, Trash2, Hash, X, Ellipsis, EllipsisVertical, Star, Undo2, ChevronDown, Folder as FolderIcon, Cards, ShareNetwork, Link as LinkIcon, Layout, History, Search, PanelLeft, Filter, ArrowLeft, Smile, Image, MessageCircle, Pencil, Grid2x2, Rows3, Upload, Database, Images } from "@/components/ds/icons";
import { Button, Icon, IconButton, SegmentedControl, MenuPanel, MenuItem, TextInput, EmptyState, EmptyLine, toast, toastReverted, dismissToast, useConfirm } from "@/components/ds/ui";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel,
} from "@/components/ds/ui/dropdown-menu";
import { cardGridClass } from '@/components/ds/ui/card';
import { HUB_RAIL_CLASS } from '@/components/ui/hub-layout';
import { NotionImportModal } from "@/components/documents/notion-import";
import { PageHeader } from '@/components/ui/page-header';
import { cn } from "@/lib/cn";
import { formatAgo, formatDayTime, todayISO } from '@/lib/date';
import { groupDocs } from '@/lib/doc-recency';
import { DocIndex } from '@/components/documents/doc-index';
import { useRecordParam } from '@/lib/hub-url';
import { ConnectedPanel } from '@/components/connected/connected-panel';
import { MemoryPanel } from '@/components/memory/memory-panel';
import { createClient } from '@/lib/supabase/client';
import { resolveRefs, recordHref } from '@/lib/connected';
import { useDocComments } from '@/components/documents/use-doc-comments';
import { DocThreads } from '@/components/documents/comment-thread';
import { PAGE_ANCHOR } from '@/lib/comments';
import { BODY_MAX, type MemorySubject } from '@/lib/memory';
import { remember, forgetMemory } from '@/lib/actions/memory';
import type { RememberHook } from '@/components/documents/rich-text';
import { DocLinks } from '@/components/documents/doc-links';
import { RailSectionHeading } from '@/components/ui/rail-section-heading';
import { addFolder, addPage, getPage, updatePage, deletePage, movePages, setPageFavorite, archivePage, duplicatePage } from '@/lib/actions/library';
import { saveVersion } from '@/lib/actions/versions';
import { syncMentions, forgetMentionsFrom } from '@/lib/actions/mentions';
import { VersionHistory } from '@/components/documents/version-history';
import { attachCollectionToPage } from '@/lib/actions/collections';
import dynamic from 'next/dynamic';
import { CoverPicker } from '@/components/documents/cover-picker';
import { PropertyList, type DocProp } from '@/components/documents/doc-properties';
import { normalizePropType, normalizeOption } from '@/lib/properties';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { DatabasePage } from '@/components/documents/database-view';
import { CollectionPage } from '@/components/documents/collection-page';
import { newDatabase, linkPageStore, hostOnPage, pageForCollection, storeForCollection } from '@/lib/db-store';
import { collectionDocFor, linkCollectionStore, settledCollectionContent } from '@/lib/collection-store';
import { COLLECTION_PAGE_TYPE, NEW_COLLECTION_NAME, readCollection } from '@/lib/collection';
import { COLLECTION_INDEX_SORTS, INDEX_SORT_LABEL, collectionEditedAt, sortCollections, type IndexSort } from '@/lib/collection-index';
import { CollectionIndexCard, NewCollectionCard } from '@/components/documents/collection-index';
import type { Collection, DbRow } from '@/lib/collections';
import { PageIcon } from '@/components/ui/page-icon';
import { type Block, toBlocks, serialize, hasBody } from '@/lib/blocks';
import { loadAcceptanceState, withdrawAcceptance, invoiceForAcceptance, type AcceptanceState } from '@/lib/actions/acceptance';

/** Stable empty state, so an ordinary document never re-renders the editor. */
const NO_ACCEPTANCES: AcceptanceState = { acceptances: [], hashes: [], invoices: {}, crossing: false };
import { coverCss, isImageCover, randomCover, coverAttachmentId } from '@/lib/covers';
import { useAttachmentUrl } from '@/lib/use-attachment';
import type { AttachmentOwner } from '@/lib/attachments';
import { paletteFor } from '@/lib/palette';
import { textStats, readingSeconds, speakingSeconds, formatDuration } from '@/lib/text-stats';
import { outlineOf, outlineDepths } from '@/lib/outline';
import { DocBreadcrumbs, type DocNavHandlers } from '@/components/documents/doc-breadcrumbs';
import type { NavSpace, SectionKind, TrailTarget } from '@/lib/doc-nav';
import { useRecents } from '@/lib/recents';
import { useNarrow } from '@/lib/use-narrow';
import { useServerState } from '@/lib/use-server-state';
import { isTempId, tempId } from '@/lib/temp-id';
import { onPageCreated, pageEntry, seedPages, whenCreated } from '@/lib/page-store';
import { isDocumentPage } from '@/lib/page-kinds';

// A ProseMirror editor CANNOT render on the server — it needs a real DOM to
// build its view — so every byte of it in the worker bundle was work thrown
// away on first paint. It also only ever appears inside a panel that opens on
// interaction, never in the initial HTML.
//
// `ssr: false` is therefore the correct shape, not only the smaller one, and
// `database-view.tsx` already loads it this way. Static imports here put the
// whole editor in the Cloudflare worker, which has a 3 MiB gzipped ceiling.
const BlockEditor = dynamic(
  () => import('@/components/documents/block-editor').then((m) => ({ default: m.BlockEditor })),
  { ssr: false },
);

export type Folder = { id: string; name: string; parent_folder_id: string | null; sort_order: number; created_at?: string };
// project_id / client_id are the doc's structural edges (§3.4) — read by the
// Connected panel and written by <DocLinks>. Optional because the page loader's
// pre-0007 fallback select doesn't include them.
export type Page = { id: string; folder_id: string | null; parent_id?: string | null; title: string | null; type: string; content: Record<string, unknown> | unknown[]; tags: string[]; updated_at: string; created_at?: string; sort_index?: number; is_pinned?: boolean; is_favorite?: boolean; archived_at?: string | null; icon?: string | null; client_visible?: boolean; project_id?: string | null; client_id?: string | null };

type View = { kind: 'draft' | 'all' | 'collections' | 'shared' | 'templates' | 'trash' } | { kind: 'folder'; id: string };

// Document extras (redesign): stored inside the page content JSON next to blocks.
// `cover` is a gradient id from lib/covers or an uploaded image data-URL;
// `coverPos` is the vertical crop position (0–100) for image covers.
export type { DocProp } from '@/components/documents/doc-properties';
export type DocComment = { id: string; text: string; at: string };
export type DocMeta = {
  cover?: string; coverPos?: number; props?: DocProp[]; comments?: DocComment[];
  /** Full width: the sheet drops its reading measure and fills the pane. */
  wide?: boolean;
};

const typeIcon = (t: string) => (t === 'review' ? Repeat : t === 'template' ? Layout : t === 'database' ? Database : t === COLLECTION_PAGE_TYPE ? Images : FileText);

// One line per view, naming the next action rather than the absence (§2.6).
// Before this, only Trash and Shared said anything at all — the other four fell
// through a ternary to `null` and rendered a blank grey field.
const EMPTY_COPY: Record<View['kind'], { title: string; body: string }> = {
  draft: { title: 'Nothing unfiled', body: 'Docs that aren’t in a folder show up here.' },
  all: { title: 'No documents yet', body: 'Meeting notes, briefs, scopes. Everything you write for this workspace lives here.' },
  collections: { title: 'No collections yet', body: 'Gather images, videos, links and files into a visual library.' },
  shared: { title: 'Nothing shared yet', body: 'Docs you send to a client through their portal show up here.' },
  templates: { title: 'No templates yet', body: 'Save a doc you rewrite often. A kickoff brief, a retro, and start from it next time.' },
  trash: { title: 'Trash is empty', body: 'Deleted docs rest here until you delete them for good.' },
  folder: { title: 'This folder is empty', body: 'Start a doc here, or move an existing one in from its page menu.' },
};
// Tag chip glyph colors — stable per tag name.

// Elapsed time on a comment: minutes matter here (a reply thread), so this asks
// for the `precise` scale. This was a private ladder with its own thresholds —
// Documents said "3 months ago" where the rest of the app said "2 Jun".
const ago = (iso: string) => formatAgo(iso, { precise: true }) ?? '';

// The Documents index layout, remembered per browser. A per-viewer convenience, so localStorage
// (CLAUDE.md: never for state that must be shared). Read once after hydration, never pushed:
// another tab switching ITS layout should not rearrange this one.
const DOC_LAYOUT_KEY = 'zb:docs:layout';
function readDocLayout(): 'grid' | 'list' {
  try { return window.localStorage.getItem(DOC_LAYOUT_KEY) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
}
const noLayoutSubscribe = () => () => {};
/**
 * A title textarea that fits its own content.
 *
 * The height is a MEASUREMENT of the laid-out text, so it is written to the DOM
 * rather than held in state — there is no value React could hold that would be
 * correct before the browser has wrapped the string.
 */
function growTitle(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}


// `spaceName` used to arrive here and go nowhere — nothing on the screen named
// the workspace. The trail names it now, from `spaces` + `activeSpaceId`, which
// is also what its menu switches between.
export function DocumentsView({ initialFolders, initialPages, initialPageId = null, userName = 'You', spaces = [], activeSpaceId = null, commentsEnabled = false, timeZone }: { initialFolders: Folder[]; initialPages: Page[]; initialPageId?: string | null; userInitial?: string; userName?: string; spaces?: NavSpace[]; activeSpaceId?: string | null; commentsEnabled?: boolean;
  /** The person's zone (profile), so the index's Today/Yesterday headings are the same on the server as in the browser. */
  timeZone?: string }) {
  const [folders, setFolders] = useServerState(initialFolders);
  const [pages, setPages] = useServerState(initialPages);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialPageId && initialPages.some((p) => p.id === initialPageId) ? initialPageId : null,
  );
  // The Collection Index has an address, `?view=collections`, so a link can land on it. The param is replaced, never
  // pushed — like `?page=` — because Documents' other views are not addresses and Back should not walk them.
  const [viewParam, setViewParam] = useRecordParam('view');
  // ALL DOCUMENTS is where Documents opens (2026-09-30). It opened on "Draft", which is really UNFILED
  // (`!folder_id`), so filing a doc into a folder made it vanish from the screen you land on.
  const [view, setView] = useState<View>(viewParam === 'collections' ? { kind: 'collections' } : { kind: 'all' });
  useEffect(() => { setViewParam(view.kind === 'collections' ? 'collections' : null); }, [view.kind, setViewParam]);

  // Pages inside pages (the Page block). The store that page blocks read their
  // names from learns every page this listing holds, and a page made anywhere on
  // this device — `/page` in a doc, or deep inside a database row — joins the
  // listing at once, in its parent's folder, so the tree and the trail can show it.
  useEffect(() => {
    // The listing already carries every page's body, so a page opened from a Page
    // block inside a peek shows at once instead of asking the server again.
    seedPages(pages.map((p) => ({
      id: p.id, title: p.title ?? '', icon: p.icon ?? null, parentId: p.parent_id ?? null, type: p.type,
      content: Array.isArray(p.content) ? { blocks: p.content } : p.content,
    })));
  }, [pages]);
  useEffect(() => onPageCreated((made) => {
    setPages((ps) => (ps.some((p) => p.id === made.id) ? ps : [{
      id: made.id, folder_id: ps.find((p) => p.id === made.parentId)?.folder_id ?? null, parent_id: made.parentId,
      title: made.title, type: made.type ?? 'note', content: { blocks: [] }, tags: [], updated_at: new Date().toISOString(),
    }, ...ps]));
  }), [setPages]);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [railHidden, setRailHidden] = useState(false);
  // Narrow viewports start with the rail tucked away (the toolbar button brings
  // it back); widening past the breakpoint restores it.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const apply = () => setRailHidden(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    window.addEventListener('resize', apply); // mq change alone can miss emulated/odd resizes
    return () => { mq.removeEventListener('change', apply); window.removeEventListener('resize', apply); };
  }, []);
  // Below this the header row can no longer carry words in BOTH lanes — see
  // the actions block. The DS breadcrumb has its own, lower threshold (768) for
  // swapping hover menus for a sheet; these are different questions.
  const headerTight = useNarrow(640);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // LIST IS THE PRIMARY DESIGN (2026-09-30) — an index is for finding, and finding is scanning —
  // and the choice is REMEMBERED. It was per-visit state that reset to the grid on every open.
  // Read through useSyncExternalStore: the server renders the list, the browser then shows a stored
  // grid with no hydration mismatch and no setState in an effect.
  const storedLayout = useSyncExternalStore(noLayoutSubscribe, readDocLayout, () => 'list' as const);
  const [pickedLayout, setPickedLayout] = useState<'grid' | 'list' | null>(null);
  const gridView = pickedLayout ?? storedLayout;
  const setGridView = (v: 'grid' | 'list') => {
    setPickedLayout(v);
    try { window.localStorage.setItem(DOC_LAYOUT_KEY, v); } catch { /* storage unavailable */ }
  };
  // The Collection Index's order — for this visit, like the grid/list choice above.
  const [indexSort, setIndexSort] = useState<IndexSort>('edited');
  // An empty Collection's + on the Index opens it with Add open — once: the Collection says when it has.
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const loadedRef = useRef<string | null>(null);
  const skipSaveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Re-fit the title on every change to the text AND to the column width — a
  // rail toggle rewraps it without a window resize, so a resize listener alone
  // would leave the box the wrong height with the last line clipped.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    growTitle(el);
    const host = el.parentElement;
    if (!host) return;
    let w = host.clientWidth;
    const ro = new ResizeObserver(() => {
      if (host.clientWidth === w) return;   // our own height write must not re-enter
      w = host.clientWidth;
      growTitle(el);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [title, selectedId]);
  const [docMenu, setDocMenu] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Document extras (redesign) — cover, properties, resources. They ride along
  // inside the page's content JSON next to `blocks`, so no schema change is
  // needed and older docs simply have none.
  const [docMeta, setDocMeta] = useState<DocMeta>({});
  const readMeta = (content: Page['content']): DocMeta => {
    const o = (content && typeof content === 'object' && !Array.isArray(content) ? content : {}) as Record<string, unknown>;
    return {
      cover: typeof o.cover === 'string' ? o.cover : undefined,
      coverPos: typeof o.coverPos === 'number' ? o.coverPos : undefined,
      // Absent means the reading measure, which is what every doc written before
      // this option existed should keep — so only `true` turns it on.
      wide: o.wide === true ? true : undefined,
      // Properties are stored as JSON, so retiring a spelling cannot be done by
      // editing a union — anything already saved keeps the old string. This is
      // the forward migration (lib/properties.ts): unknown or legacy type names
      // resolve to their canonical one, and options saved as `{ label }` before
      // the vocabulary merge become `{ name }`. Editing the doc writes the new
      // form back, so each page migrates itself once.
      props: Array.isArray(o.props)
        ? (o.props as Partial<DocProp>[])
            .filter((p): p is DocProp => !!p && typeof p.id === 'string')
            .map((p) => ({
              ...p,
              name: p.name ?? '',
              type: normalizePropType(p.type),
              ...(p.options ? { options: p.options.map(normalizeOption) } : {}),
            }))
        : undefined,
      comments: Array.isArray(o.comments) ? (o.comments as DocComment[]).filter((c) => c && typeof c.text === 'string') : undefined,
    };
  };
  const [iconPicker, setIconPicker] = useState(false);

  // Keep `?page=` in step with the open doc (§7J). The server already reads this
  // param into `initialPageId`, so the link worked on arrival but the address bar
  // then went stale — you could be sent to a doc but never send anyone to one.
  // replaceState is a pure URL swap: no re-render of the server component, no
  // refetch, and unsaved temp rows are skipped since their ids aren't addressable.
  const [, setPageParam] = useRecordParam('page');
  const [, pushRecent] = useRecents('document');
  useEffect(() => {
    if (isTempId(selectedId)) return;
    setPageParam(selectedId ?? null);
    // The same moment a doc becomes addressable it becomes worth remembering —
    // this is what fills the "Recent" section of every breadcrumb menu.
    if (selectedId) pushRecent(selectedId);
  }, [selectedId, setPageParam, pushRecent]);

  // Load the draft when the selected page changes — DURING RENDER, not in an
  // effect. This is React's documented "adjusting state when a prop changes",
  // and the difference is visible: an effect runs after the commit, so opening a
  // second document painted one frame carrying the FIRST one's title, blocks and
  // tags before correcting itself. Adjusting during the render of the same
  // component re-renders before anything reaches the screen, so that frame never
  // exists.
  //
  // The previous id is STATE, not the ref two lines up. Reading or writing a ref
  // during render is unsafe under concurrent rendering — the lint rule that
  // caught it is right — and the pattern React documents keeps the comparison in
  // state for exactly that reason. `loadedRef` stays where it is, doing its other
  // job: the autosave guard reads it to know the editor is showing the row it is
  // about to write. Splitting the two jobs is deliberate; folding autosave
  // bookkeeping into render would put a data-loss path on a hot code path.
  const [renderedId, setRenderedId] = useState<string | null>(null);
  if (selectedId && selectedId !== renderedId) {
    const p = pages.find((x) => x.id === selectedId);
    if (p) {
      setRenderedId(selectedId);
      setTitle(p.title ?? ''); setBlocks(toBlocks(p.content)); setTags(p.tags ?? []); setDocMeta(readMeta(p.content));
      setIconPicker(false);
      setSave('idle');
    }
  }

  // A page opened from a Page block that has nothing in it yet — one `/page` made a
  // moment ago — arrives with its name ready to type, as a new page does in Notion.
  // A Collection made a moment ago already has a name ("New collection") and no
  // items: it arrives with that name selected, so typing replaces it.
  const focusTitleFor = useRef<string | null>(null);
  const openChildPage = (id: string) => {
    const made = pageEntry(id)?.record;
    const unnamedCollection = made?.type === COLLECTION_PAGE_TYPE && made.title === NEW_COLLECTION_NAME && !readCollection(made.content).items.length;
    if (made && !hasBody(made.content) && (!made.title || unnamedCollection)) focusTitleFor.current = id;
    setSelectedId(id);
  };
  useEffect(() => {
    if (!renderedId || focusTitleFor.current !== renderedId) return;
    focusTitleFor.current = null;
    const frame = requestAnimationFrame(() => { titleRef.current?.focus(); titleRef.current?.select(); });
    return () => cancelAnimationFrame(frame);
  }, [renderedId]);

  // The autosave bookkeeping the load above deliberately leaves alone. Refs are
  // legal here, and `skipSave` stops the freshly-loaded draft from being written
  // straight back over the row it came from.
  useEffect(() => {
    if (selectedId && selectedId !== loadedRef.current && pages.some((x) => x.id === selectedId)) {
      loadedRef.current = selectedId;
      skipSaveRef.current = true;
    }
  }, [selectedId, pages]);

  // §7M signatures. Fetched only for documents that actually ask for one, so
  // opening any ordinary note stays a zero-round-trip operation. Refreshed when
  // an accept block is added, since the block is useless until the page has been
  // saved and can be signed.
  // What a file uploaded from this page hangs off (§7H, 0033). A `tmp-` row has
  // not been written yet, so there is no id to own anything — every surface that
  // uploads reads this ONE value rather than re-deriving the rule, which is how
  // the cover picker and the block editor came to disagree about it.
  const pageOwner: AttachmentOwner | undefined =
    selectedId && !isTempId(selectedId) ? { page_id: selectedId } : undefined;

  // Comments (§7H, 0037). `blockIds` is what tells a thread whether the block it
  // was anchored to still exists — an id set, so deleting a paragraph turns its
  // conversation into a labelled orphan rather than making it vanish.
  const blockIds = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);
  const dropLegacyComment = useCallback((id: string) => {
    setDocMeta((m) => ({ ...m, comments: (m.comments ?? []).filter((c) => c.id !== id) }));
  }, []);
  const comments = useDocComments({
    pageId: selectedId,
    enabled: commentsEnabled,
    blockIds,
    legacy: docMeta.comments,
    authorName: userName,
    onDeleteLegacy: dropLegacyComment,
  });

  const [loadedAccept, setLoadedAccept] = useState<{ pageId: string; state: AcceptanceState } | null>(null);
  const hasAcceptBlock = blocks.some((b) => b.type === 'accept');
  useEffect(() => {
    if (!selectedId || isTempId(selectedId) || !hasAcceptBlock) return;
    let live = true;
    loadAcceptanceState(selectedId).then((st) => { if (live) setLoadedAccept({ pageId: selectedId, state: st }); });
    return () => { live = false; };
  }, [selectedId, hasAcceptBlock]);

  // Derived rather than reset in the effect: the state is only valid for the
  // page it was fetched for. Clearing it on the way out would leave a window in
  // which the PREVIOUS document's signature renders on this one — a wrong name
  // on a contract, which is the worst version of a stale-render bug.
  const accept = hasAcceptBlock && loadedAccept?.pageId === selectedId
    ? loadedAccept.state
    : NO_ACCEPTANCES;

  async function withdrawAccept(id: string) {
    const ok = await confirm({
      title: 'Withdraw this acceptance?',
      body: 'The record of who accepted, when, and what they agreed to is deleted. This cannot be undone.',
      actionLabel: 'Withdraw',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await withdrawAcceptance(id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setLoadedAccept((cur) => (cur && { ...cur, state: { ...cur.state, acceptances: cur.state.acceptances.filter((a) => a.id !== id) } }));
  }

  // §7M's crossing, re-run by hand — for a proposal signed before 0035 existed,
  // or one whose draft was deleted. The recorded link is what makes clicking it
  // twice harmless.
  async function createAcceptInvoice(acceptanceId: string) {
    const res = await invoiceForAcceptance(acceptanceId);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setLoadedAccept((cur) => (cur && {
      ...cur,
      state: {
        ...cur.state,
        acceptances: cur.state.acceptances.map((a) => (a.id === acceptanceId ? { ...a, invoiceId: res.id } : a)),
        invoices: { ...cur.state.invoices, [res.id]: { number: res.number, status: 'draft' } },
      },
    }));
    toast({ message: `${res.number} drafted.`, variant: 'success' });
  }

  // A save still waiting when the page changes is written AT ONCE, not dropped.
  // Switching pages used to cancel the debounce, so anything typed in the last
  // 600ms before opening another page was lost — and `/page` opens the page it
  // makes immediately, so the Page block that had just been added to the parent
  // was lost every time. The same flush runs when Documents unmounts.
  const pendingSaveRef = useRef<{ id: string; run: () => void } | null>(null);
  useEffect(() => () => { pendingSaveRef.current?.run(); }, []);

  // A Collection's body is its items, and its store is their only writer (lib/collection-store.ts):
  // Documents names and tags a Collection page, and never writes back an older copy of what it holds.
  const collectionOpen = pages.some((p) => p.id === selectedId && p.type === COLLECTION_PAGE_TYPE);
  // autosave (debounced) — skips the post-load run and unsaved temp rows
  useEffect(() => {
    if (pendingSaveRef.current && pendingSaveRef.current.id !== selectedId) {
      pendingSaveRef.current.run();
      pendingSaveRef.current = null;
    }
    if (loadedRef.current !== selectedId || !selectedId || isTempId(selectedId)) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    setSave('saving');
    const id = selectedId;
    // `shown`: this page is still the one on screen, so its save state is the
    // chip's to report. A flushed save belongs to a page the person has left.
    const save = async (shown: boolean) => {
      // A page made a moment ago by `/page` may not exist on the server yet; an
      // update before it does would change no row and report success.
      const creation = whenCreated(id);
      if (creation && 'error' in (await creation)) { if (shown) setSave('error'); return; }
      // Persist the title exactly as typed — empty stays empty (Notion-style),
      // so the editor keeps showing the light "New doc" placeholder instead of a
      // hard "Untitled" value. Lists fall back to "Untitled" only for display.
      const nextTitle = title.trim();
      const content = { ...serialize(blocks), ...(docMeta.cover ? { cover: docMeta.cover } : {}), ...(docMeta.cover && docMeta.coverPos != null ? { coverPos: docMeta.coverPos } : {}), ...(docMeta.props?.length ? { props: docMeta.props } : {}), ...(docMeta.comments?.length ? { comments: docMeta.comments } : {}), ...(docMeta.wide ? { wide: true } : {}) };
      // Into the listing first, so a page left mid-debounce opens again with what
      // was typed rather than the listing's older copy.
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, title: nextTitle, ...(collectionOpen ? {} : { content }), tags } : p)));
      const res = await updatePage(id, collectionOpen ? { title: nextTitle, tags } : { title: nextTitle, content, tags });
      if (res && 'error' in res) {
        if (shown) setSave('error');
        else toast({ message: `Could not save “${nextTitle || 'Untitled'}”.`, variant: 'error' });
        return;
      }
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, updated_at: new Date().toISOString() } : p)));
      if (shown) setSave('saved');
      // A Collection has no document body to collect links from, or to keep versions of.
      if (collectionOpen) return;
      // Collect the fabric (§3.4). Every internal link in this document is a
      // reference to a record, and until now nothing collected them — the
      // `mentions` table has been read by the Connected panel since 0027 and
      // written by nothing, so every backlink section rendered empty by
      // construction. Best-effort and never awaited into the save path: a
      // missing backlink is a nuisance, a document that won't save is not.
      // Properties travel with the body: a relation property is a reference too,
      // and syncing the two halves separately would make each treat the other's
      // rows as stale and delete them on every keystroke.
      void syncMentions({ type: 'doc', id }, blocks, { origin: window.location.origin, props: docMeta.props }).catch(() => {});
      // Offer this state to history. The policy (lib/version-policy) coalesces a
      // run of edits into ONE entry, so most autosaves decline — history stays
      // readable instead of becoming a keystroke log. Never blocks the save.
      void saveVersion(id, content).catch(() => {});
    };
    pendingSaveRef.current = { id, run: () => void save(false) };
    const t = setTimeout(() => { pendingSaveRef.current = null; void save(true); }, 600);
    return () => clearTimeout(t);
  }, [title, blocks, tags, docMeta, selectedId, setPages, collectionOpen]);

  // `parentId` nests the new page under an existing one. `addPage` has no
  // parent argument, so the nesting is a second call — the page still appears
  // instantly, and a failed re-parent leaves a real page in the right folder
  // rather than nothing at all.
  async function newPage(folderId: string | null = null, type: 'note' | 'template' | 'database' | typeof COLLECTION_PAGE_TYPE = 'note', parentId: string | null = null) {
    const tmp = tempId();
    // A Collection is named from its first frame (COLLECTION_ITEM_BRIEF §12) and opens with that name
    // selected, so typing names it; a document keeps its placeholder.
    const name = type === COLLECTION_PAGE_TYPE ? NEW_COLLECTION_NAME : '';
    // A database page opens with its database already made: `newDatabase` seeds it
    // under this page's placeholder, so the table is there on the first frame and
    // nothing asks the server about `tmp-…` — which used to print Postgres's uuid
    // error as the page. It is saved once the page exists.
    const db = type === 'database' ? newDatabase({ pageId: tmp }) : null;
    setPages((ps) => [{ id: tmp, folder_id: folderId, parent_id: parentId, title: name, type, content: { blocks: [] }, tags: [], updated_at: new Date().toISOString() }, ...ps]);
    setSelectedId(tmp);
    if (type === COLLECTION_PAGE_TYPE) focusTitleFor.current = tmp;
    let res: Awaited<ReturnType<typeof addPage>>;
    try {
      res = await addPage({ folderId, type, ...(name ? { title: name } : {}) });
    } catch (e) {
      // A THROWN failure is the net's to report (ActionFailureNet); the database
      // made for this page only needs to know it will never be saved.
      db?.abandon('The page was not created.');
      throw e;
    }
    if ('id' in res) {
      // A Collection opened under its placeholder keeps its store, and saves under the real id.
      linkCollectionStore(tmp, res.id);
      if (db) {
        linkPageStore(tmp, res.id);
        void db.persist(res.id).then((saved) => {
          if ('error' in saved) toast({ message: 'Could not save the new database.', variant: 'error' });
        });
      }
      setPages((ps) => ps.map((p) => (p.id === tmp ? { ...p, id: res.id } : p)));
      setSelectedId((cur) => (cur === tmp ? res.id : cur));
      if (loadedRef.current === tmp) loadedRef.current = res.id;
      if (parentId) await movePages([{ id: res.id, folderId, sortIndex: 0, parentId }]);
    } else {
      db?.abandon('The page was not created.');
      // Never roll back in silence (§2.5): the page appeared, so its
      // disappearance needs a reason or it reads as the app losing work.
      setPages((ps) => ps.filter((p) => p.id !== tmp));
      setSelectedId((cur) => (cur === tmp ? null : cur));
      toast({ message: `Could not create the ${type === 'database' ? 'database' : type === COLLECTION_PAGE_TYPE ? 'collection' : 'doc'}.`, variant: 'error' });
    }
  }

  // "Turn into page" on an inline database: create a database page, hand the
  // collection to it, and open it. The inline block stays behind as a linked
  // view of the now-page-owned database (Notion's replacement behavior).
  async function expandCollection(colId: string) {
    // A database that already has its own page — this block is the view left behind
    // when it was turned into one — opens that page. Making another would move the
    // database again and leave the first page empty.
    const home = pageForCollection(colId);
    if (home && pages.some((p) => p.id === home)) { setSelectedId(home); return; }
    // Optimistic: this used to sit through TWO serial round trips (create the
    // page, then attach the collection) before anything appeared, so "turn into
    // page" felt broken on a slow link. The page opens now and reconciles after.
    const tmp = tempId();
    // The database is already live on this device — it is on screen in the block —
    // so the new page shows it at once instead of loading it again.
    hostOnPage(tmp, colId);
    setPages((ps) => [{ id: tmp, folder_id: currentFolderId, title: '', type: 'database', content: { blocks: [] }, tags: [], updated_at: new Date().toISOString() }, ...ps]);
    setSelectedId(tmp);
    const fail = (message: string) => {
      setPages((ps) => ps.filter((p) => p.id !== tmp));
      setSelectedId((cur) => (cur === tmp ? null : cur));
      toast({ message, variant: 'error' });
    };
    const res = await addPage({ folderId: currentFolderId, type: 'database' });
    if (!('id' in res)) return fail('Could not create the database page.');
    linkPageStore(tmp, res.id);
    // A database inserted a moment ago may still be on its way to the server, and
    // cannot be attached to a page until it has arrived.
    const arrived = await (storeForCollection(colId)?.created() ?? true);
    const att = arrived ? await attachCollectionToPage(colId, res.id) : { error: 'The database was never created.' };
    if ('error' in att) { await deletePage(res.id); return fail('Could not move the database to its own page.'); }
    const title = att.name?.trim() || 'Untitled';
    if (title !== 'Untitled') updatePage(res.id, { title });
    setPages((ps) => ps.map((p) => (p.id === tmp ? { ...p, id: res.id, title } : p)));
    setSelectedId((cur) => (cur === tmp ? res.id : cur));
    if (loadedRef.current === tmp) loadedRef.current = res.id;
  }

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');
  // Which folder the pending new folder goes into. `undefined` = "wherever the
  // rail's + was pressed from", i.e. the current view; a breadcrumb's "New
  // folder" names a parent explicitly, which the view alone cannot express.
  const [folderParent, setFolderParent] = useState<string | null | undefined>(undefined);
  async function createFolder() {
    const n = folderDraft.trim(); if (!n) { setCreatingFolder(false); setFolderParent(undefined); return; }
    const parent = folderParent !== undefined ? folderParent : view.kind === 'folder' ? view.id : null;
    setFolderParent(undefined);
    setFolderDraft(''); setCreatingFolder(false);
    const tmp = tempId();
    setFolders((f) => [...f, { id: tmp, name: n, parent_folder_id: parent, sort_order: f.length, created_at: new Date().toISOString() }]);
    const res = await addFolder(n, parent);
    if ('id' in res) setFolders((f) => f.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else { setFolders((f) => f.filter((x) => x.id !== tmp)); toast({ message: 'Could not create the folder.', variant: 'error' }); }
  }

  // "Delete forever", from the Trash view only. Nothing brings this back —
  // Trash IS the undo for a normal delete, so this is the end of the line.
  async function removePage(id: string) {
    const title = pages.find((p) => p.id === id)?.title?.trim() || 'Untitled';
    const ok = await confirm({
      title: `Delete “${title}” forever?`,
      body: 'It leaves Trash for good, with its content and comments. This can’t be undone.',
      actionLabel: 'Delete forever',
    });
    if (!ok) return;
    setPages((ps) => ps.filter((p) => p.id !== id));
    if (selectedId === id) { loadedRef.current = null; setSelectedId(null); }
    if (!isTempId(id)) {
      await deletePage(id);
      // What this doc POINTED AT goes with it. What pointed AT it stays, on
      // purpose: 0027 has no FK on `target_id` because §7H wants a deleted
      // target to leave a tombstone, not a list that silently shrinks.
      void forgetMentionsFrom({ type: 'doc', id }).catch(() => {});
    }
  }

  function addTag() {
    const t = tagDraft.trim().replace(/^#/, ''); if (!t || tags.includes(t)) { setTagDraft(''); return; }
    setTags((ts) => [...ts, t]); setTagDraft('');
  }

  // ── Page operations (optimistic) ──
  const [confirm, confirmUI] = useConfirm();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const patchPage = (id: string, patch: Partial<Page>) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  // A cover set from a gallery tile (2026-09-30). Written the way `withBlocks` writes a body: every
  // other key the content holds — blocks, comments, properties, width — rides along untouched, so
  // choosing a cover can never cost the page anything else. A NEW cover starts centred, as it does
  // in the editor; only re-picking the same picture keeps its position. Optimistic, and put back if
  // the write loses.
  async function setCover(p: Page, cover: string | undefined) {
    const prev = p.content;
    const next: Record<string, unknown> = prev && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : { blocks: toBlocks(prev) };
    if (next.cover !== cover) delete next.coverPos;
    if (cover) next.cover = cover; else delete next.cover;
    patchPage(p.id, { content: next });
    const r = await updatePage(p.id, { content: next }).catch(() => ({ error: 'unreachable' as const }));
    if ('error' in r) { patchPage(p.id, { content: prev }); toastReverted(r.error); }
  }
  async function fav(id: string, v: boolean) {
    patchPage(id, { is_favorite: v });
    const r = await setPageFavorite(id, v);
    if ('error' in r) { patchPage(id, { is_favorite: !v }); toastReverted(r.error); }
  }
  // "Delete" on a live page means Trash, which is reversible — so it acts at
  // once and offers Undo rather than asking (INTERACTION_STANDARDS §2.2). The
  // toast is also the only signal that the page went somewhere recoverable;
  // before this it just vanished off the grid with no feedback at all.
  async function archive(id: string, v: boolean) {
    patchPage(id, { archived_at: v ? new Date().toISOString() : null });
    if (v && selectedId === id) { loadedRef.current = null; setSelectedId(null); }
    let said: number | null = null;
    if (v) {
      const title = pages.find((p) => p.id === id)?.title?.trim() || 'Untitled';
      said = toast({ message: `“${title}” moved to Trash.`, action: { label: 'Undo', onAction: () => archive(id, false) } });
    }
    const r = await archivePage(id, v);
    if ('error' in r) {
      patchPage(id, { archived_at: v ? null : new Date().toISOString() });
      // Take the “moved to Trash” claim back down before contradicting it. Two
      // toasts, one saying it moved and one saying it didn’t, is worse than
      // either alone — and its Undo would now act on a page that never left.
      if (said !== null) dismissToast(said);
      toastReverted(r.error);
    }
  }
  async function renameTo(id: string, title: string) {
    const t = title.trim() || 'Untitled';
    const before = pages.find((p) => p.id === id)?.title ?? null;
    patchPage(id, { title: t }); setRenamingId(null);
    const r = await updatePage(id, { title: t });
    if (r && 'error' in r) { patchPage(id, { title: before }); toastReverted(r.error); }
  }
  async function dup(id: string) {
    const src = pages.find((p) => p.id === id); if (!src) return;
    setMenuFor(null);
    // A Collection's items are its store's, never the page list's (which holds what was loaded): saved
    // first, so the server copies what is on screen, and carried into the copy, so it opens with them.
    const content = src.type === COLLECTION_PAGE_TYPE && !Array.isArray(src.content) ? await settledCollectionContent(id, src.content) : src.content;
    const res = await duplicatePage(id);
    if ('id' in res) {
      // A copy is new: made now, so the Index's "Created" order puts it with the newest, not with its original.
      const now = new Date().toISOString();
      const copy: Page = { ...src, id: res.id, content, title: `${src.title?.trim() || 'Untitled'} copy`, created_at: now, updated_at: now, is_pinned: false, is_favorite: false };
      setPages((ps) => { const i = ps.findIndex((p) => p.id === id); return [...ps.slice(0, i + 1), copy, ...ps.slice(i + 1)]; });
      setSelectedId(res.id);
    }
  }
  async function moveTo(id: string, folderId: string | null) {
    setMenuFor(null);
    patchPage(id, { folder_id: folderId });
    if (!isTempId(id)) await movePages([{ id, folderId, sortIndex: 0 }]);
  }
  // Copying happens away from the user's eye, so it says so through the app's
  // one feedback channel (§2.5) rather than a private 2-second "flash" span this
  // view used to render in two different places at two different type sizes.
  function share(id: string) {
    // Through `recordHref`, not by hand: this had been the app's second copy of
    // "what a document's URL is", and a block link is that same address plus a
    // fragment (lib/block-link.ts). Two copies is how the two drift.
    const url = `${window.location.origin}${recordHref('doc', id) ?? `/documents?page=${id}`}`;
    navigator.clipboard?.writeText(url)
      .then(() => toast({ message: 'Link copied.' }))
      .catch(() => toast({ message: `Copy failed: the link is ${url}`, variant: 'error' }));
  }

  const selected = pages.find((p) => p.id === selectedId) ?? null;
  const rememberHook = useRememberFromDoc(selected);
  // A page claimed by another module is that module's, not Documents'
  // (lib/page-kinds.ts). Filtered HERE rather than only in the loader so every
  // view — draft, all, folders, search, trash — inherits it from one place.
  const live = pages.filter((p) => !p.archived_at && isDocumentPage(p.type));
  const archived = pages.filter((p) => p.archived_at);

  const folderById = (id: string | null) => (id ? folders.find((f) => f.id === id) ?? null : null);
  const childFolders = (id: string | null) => folders.filter((f) => (f.parent_folder_id ?? null) === id);
  const pagesIn = (id: string | null) => live.filter((p) => (p.folder_id ?? null) === id);

  // What the grid shows for the current view.
  function gridPages(): Page[] {
    if (view.kind === 'folder') return pagesIn(view.id);
    if (view.kind === 'shared') return live.filter((p) => p.client_visible);
    if (view.kind === 'templates') return live.filter((p) => p.type === 'template');
    if (view.kind === 'trash') return archived;
    if (view.kind === 'draft') return live.filter((p) => !p.folder_id && p.type !== 'template');
    if (view.kind === 'collections') return live.filter((p) => p.type === COLLECTION_PAGE_TYPE);
    return live; // all
  }
  const allTags = [...new Set(live.flatMap((p) => p.tags ?? []))].sort();
  const query = q.trim().toLowerCase();
  const matchingPages = gridPages()
    .filter((p) => !tagFilter || (p.tags ?? []).includes(tagFilter))
    .filter((p) => !query || (p.title ?? '').toLowerCase().includes(query) || (p.tags ?? []).some((t) => t.toLowerCase().includes(query)));
  // The Index reads in the order its sort chooses (lib/collection-index.ts), each Collection read as it stands on
  // this device: a Collection's items are its store's, and its last edit counts theirs.
  const indexEntries = view.kind === 'collections'
    ? sortCollections(matchingPages.map((p) => {
      const doc = collectionDocFor(p.id, p.content);
      return { page: p, doc, id: p.id, title: p.title ?? '', editedAt: collectionEditedAt(p.updated_at, doc), createdAt: p.created_at ?? p.updated_at, count: doc.items.length, pinned: !!p.is_pinned };
    }), indexSort)
    : [];
  const sortedPages = view.kind === 'collections'
    ? indexEntries.map((e) => e.page)
    : [...matchingPages].sort((a, b) => Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false) || b.updated_at.localeCompare(a.updated_at));

  const openView = (v: View) => { setSelectedId(null); loadedRef.current = null; setView(v); };
  const currentFolderId = view.kind === 'folder' ? view.id : null;

  // The current view named once, for the header's scope slot and its empty
  // state. This IS a scope ("July 2026" in Calendar), not a record — the rule
  // against titling a master/detail hub is about the selected *record*, and a
  // folder's name appears nowhere else on screen once the rail scrolls.
  const VIEW_META = {
    draft: { label: 'Unfiled', icon: FileText },
    all: { label: 'All documents', icon: Cards },
    collections: { label: 'Collections', icon: Images },
    shared: { label: 'Shared', icon: ShareNetwork },
    templates: { label: 'Templates', icon: Layout },
    trash: { label: 'Trash', icon: Trash2 },
  } as const;
  const viewMeta = view.kind === 'folder'
    ? { label: folderById(view.id)?.name ?? 'Folder', icon: FolderIcon }
    : VIEW_META[view.kind];
  const isTemplates = view.kind === 'templates';
  // The Collection Index (COLLECTION_PLAN X1): every Collection as a visual card, made and opened from here.
  const isIndex = view.kind === 'collections';
  // A filter or a search that matched nothing is a different screen from a view
  // that is genuinely empty — the first needs a way back, the second an intro.
  const filtered = Boolean(tagFilter || query);
  const createLabel = isIndex ? 'New collection' : isTemplates ? 'New template' : 'New doc';
  const [importing, setImporting] = useState(false);
  const createHere = () => newPage(currentFolderId, isIndex ? COLLECTION_PAGE_TYPE : isTemplates ? 'template' : 'note');
  // THE sidebar toggle, in the page header's lead. It used to live inside the
  // rail, which meant the control that brings the rail back disappeared with it
  // — and only the grid view carried a way back, so hiding the rail while a doc
  // was open stranded you. One button, always in the same place, both states.
  const railToggle = (
    <IconButton
      size="sm"
      label={railHidden ? 'Show sidebar' : 'Hide sidebar'}
      aria-expanded={!railHidden}
      icon={<Icon icon={PanelLeft} size={16} />}
      onClick={() => setRailHidden((v) => !v)}
    />
  );

  // ── The interactive trail (DOCUMENT_NAVIGATION_UX) ───────────────────────
  // Where the trail says you are, and the verbs it may call. Every handler
  // forwards to an operation that already existed on this view — the trail
  // never opens a second path to the same mutation.
  const trailTarget: TrailTarget = selected
    ? { kind: 'page', id: selected.id }
    : view.kind === 'folder'
      ? { kind: 'folder', id: view.id }
      : { kind: 'section', id: view.kind as SectionKind };

  const navHandlers: DocNavHandlers = {
    openPage: (id) => setSelectedId(id),
    openFolder: (id) => openView({ kind: 'folder', id }),
    openSection: (kind) => openView({ kind }),
    newPage: ({ folderId, parentId, type }) => { void newPage(folderId, type ?? 'note', parentId ?? null); },
    // Folders have no rename anywhere in the app, so one created unnamed from a
    // menu would be stuck as "Folder" for good. This reveals the rail's inline
    // input instead — pre-parented, cursor waiting.
    newFolder: (parentFolderId) => {
      setRailHidden(false);
      setFoldersOpen(true);
      setFolderParent(parentFolderId);
      setCreatingFolder(true);
    },
  };

  // Flat folder tree (children indented — no per-row carets, per HiFi).
  const renderFolders = (parent: string | null, depth: number): React.ReactNode =>
    childFolders(parent).map((f) => {
      const on = !selected && view.kind === 'folder' && view.id === f.id;
      return (
        <div key={f.id} style={{ width: '100%' }}>
          <RailItem icon={FolderIcon} label={f.name} on={on} variant="folder" indent={depth} onClick={() => openView({ kind: 'folder', id: f.id })} />
          {renderFolders(f.id, depth + 1)}
        </div>
      );
    });

  return (
    <div className="zb-page-in flex h-full flex-col">
      {/* THE header row, above BOTH panes — the same grammar as every other
          module, so the ••• lands on the app header's axis instead of the shell
          floating its own copy on top of a bespoke 44px toolbar. Its contents
          change with what's open: a doc gets the doc's crumb and actions, the
          grid gets the view's scope, filter and create. Documents was the last
          module with no header at all (INTERACTION_STANDARDS §1b). */}
      {selected ? (
        <PageHeader
          lead={(
            <>
              {railToggle}
              <IconButton size="sm" label="Back to documents" icon={<Icon icon={ArrowLeft} size={16} />} onClick={() => { setSelectedId(null); loadedRef.current = null; }} />
              {/* The Forward twin that used to sit here was `disabled` and always
                  would be — there is no forward history to walk. A permanently
                  disabled control is dead chrome, and the DS paints disabled with
                  a filled `bg-surface-disabled`, which made it the loudest thing
                  in the row. */}
              {/* THE trail. It repeats the H1 below on purpose: the header
                  stays put while the sheet scrolls, so this is the only thing
                  naming the doc once you're a page down — and now it is also
                  the fastest way to anywhere else (DOCUMENT_NAVIGATION_UX §2).
                  What stood here before was a folder chip whose caret opened
                  nothing and a <span> for the title. */}
              <DocBreadcrumbs
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                folders={folders}
                pages={pages}
                target={trailTarget}
                handlers={navHandlers}
                // The header's lead cluster is `shrink-0` for every page, so the
                // trail cannot be squeezed by the row — it has to know its own
                // ceiling or it draws straight through the actions on a phone.
                // 42vw is what's left at 375px once the two lead buttons and the
                // three actions have taken theirs; above `sm` there is room for
                // the crumb's own max-width to govern instead.
                className="max-w-[42vw] sm:max-w-none"
              />
            </>
          )}
          actions={(
            <>
              {/* Both of these give up their words on a phone. The trail now
                  starts this row, and a 375px header cannot carry a path, a
                  save stamp AND a labelled button — they used to simply draw on
                  top of each other. The stamp is reassurance, not an action, so
                  it goes first; "Copy link" keeps its glyph and its tooltip. */}
              {!headerTight && (
                <span className={cn('inline-flex h-8 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-body', save === 'error' ? 'text-danger-600' : 'text-ink-500')}>
                  <Icon icon={History} size={16} className="text-ink-500" />
                  {save === 'saving' ? 'Saving…' : save === 'error' ? 'Save failed, retrying' : `Edited ${ago(selected.updated_at)}`}
                </span>
              )}
              {/* One control per action: this row used to carry a "Share ⌄"
                  button whose caret opened nothing, a 🔗 icon beside it, and a
                  "Copy Link" row in the ⋮ menu — three affordances copying the
                  same URL. The labelled one stays; the menu keeps its row. */}
              {headerTight
                ? <IconButton size="sm" label="Copy link" icon={<Icon icon={LinkIcon} size={16} />} onClick={() => share(selected.id)} />
                : <Button size="sm" variant="ghost" icon={<Icon icon={LinkIcon} size={16} />} onClick={() => share(selected.id)}>Copy link</Button>}
              {/* Favorite = a single star that fills in when saved (Notion/Linear
                  convention) — matches the doc rows + context menu, which already
                  use the star. Outline when not saved, accent-filled when saved. */}
              <IconButton size="sm" label={selected.is_favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!selected.is_favorite} className={selected.is_favorite ? 'text-[var(--accent)]' : undefined} icon={<Icon icon={Star} size={16} state={!!selected.is_favorite} />} onClick={() => fav(selected.id, !selected.is_favorite)} />
              <div className="relative">
                <DocContextMenu p={selected} folders={folders} userName={userName}
                    open={docMenu} onOpenChange={setDocMenu}
                    trigger={<IconButton size="sm" label="More actions" selected={docMenu} icon={<Icon icon={EllipsisVertical} size={16} weight="bold" />} />}
                    onOpenTab={() => window.open(`/documents?page=${selected.id}`, '_blank', 'noopener')}
                    onCopyLink={() => share(selected.id)}
                    onFav={() => fav(selected.id, !selected.is_favorite)}
                    onHistory={() => setHistoryOpen(true)}
                    // A Collection is always as wide as the pane (COLLECTION_PLAN X3), so it offers no Full width.
                    wide={selected.type === COLLECTION_PAGE_TYPE ? undefined : !!docMeta.wide}
                    onWide={selected.type === COLLECTION_PAGE_TYPE ? undefined : (next) => setDocMeta((m) => ({ ...m, wide: next || undefined }))}
                    onDup={() => dup(selected.id)}
                    onMove={(fid) => moveTo(selected.id, fid)}
                    onDelete={() => archive(selected.id, true)}
                  />
              </div>
            </>
          )}
        />
      ) : (
        <PageHeader
          lead={railToggle}
          // NO scope title while the rail is on screen: the rail row for this
          // view is highlighted two rows below, so naming it here says the same
          // thing twice. It comes back only when the rail is hidden, because
          // then nothing else on screen names what you are looking at.
          icon={railHidden ? viewMeta.icon : undefined}
          title={railHidden ? viewMeta.label : undefined}
          count={railHidden ? sortedPages.length : undefined}
          // Filter, then layout, then the page's verb. The filter used to sit in
          // the left lane, alone against the far edge with the whole width of
          // the window between it and everything else; it belongs beside the
          // layout switch, because both answer "how am I looking at this".
          // Its trigger is the DS Button now — Tasks renders the identical one.
          actions={(
            <>
              {/* PORTALLED. This was an `absolute` MenuPanel, and it sits inside
                  an `overflow:hidden` header container — measured. It looked
                  fine only because the tag list is short; a longer list or a
                  narrower viewport slices it, which is exactly the bug the user
                  screenshotted on the document card menu. Same class, same fix. */}
              {/* The Index (COLLECTION_PLAN X2) is searched by name in the rail and ordered by its own sort;
                  filtering by tag, the list layout and Import are a document's tools. */}
              {!isIndex && (
              <div className="relative">
                <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant={filterOpen || tagFilter ? 'tinted' : 'ghost'}
                      icon={<Icon icon={Filter} size={16} />}
                      // On a phone this lane held Filter 89 + layout 76 +
                      // Import 82 + New doc 98 in 357px, and the lane clips —
                      // so the page's VERB lost its right edge. Filter and
                      // Import give up their words (the name moves to the
                      // aria-label); the verb keeps its own.
                      iconOnly={headerTight}
                      aria-label={headerTight ? (tagFilter ? `Filter: ${tagFilter}` : 'Filter') : undefined}
                      iconRight={headerTight ? undefined : <Icon icon={ChevronDown} size={12} className="text-ink-500" />}>
                      {headerTight ? null : (tagFilter ? `Filter: ${tagFilter}` : 'Filter')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" aria-label="Filter by tag" className="max-h-72 w-[200px] overflow-y-auto">
                    <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
                    <DropdownMenuItem active={!tagFilter} onSelect={() => setTagFilter(null)}>All documents</DropdownMenuItem>
                    {allTags.map((t) => (
                      <DropdownMenuItem key={t} active={tagFilter === t}
                        icon={<span className="size-2 shrink-0 rounded-full" style={{ background: paletteFor(t).dot }} />}
                        onSelect={() => setTagFilter(t)}>{t}</DropdownMenuItem>
                    ))}
                    {allTags.length === 0 && <EmptyLine className="px-2 py-1 text-caption">No tags yet</EmptyLine>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              )}
              {isIndex ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label={`Sort collections: ${INDEX_SORT_LABEL[indexSort]}`}
                      iconRight={<Icon icon={ChevronDown} size={12} className="text-ink-500" />}>
                      {INDEX_SORT_LABEL[indexSort]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" aria-label="Sort collections" className="w-44">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    {COLLECTION_INDEX_SORTS.map((s) => (
                      <DropdownMenuItem key={s} active={indexSort === s} onSelect={() => setIndexSort(s)}>{INDEX_SORT_LABEL[s]}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
              <SegmentedControl
                aria-label="View layout"
                value={gridView}
                onValueChange={(v) => setGridView(v as 'grid' | 'list')}
                options={[
                  { value: 'grid', 'aria-label': 'Grid view', label: <Icon icon={Grid2x2} size={16} /> },
                  { value: 'list', 'aria-label': 'List view', label: <Icon icon={Rows3} size={16} /> },
                ]}
              />
              )}
              {/* Import sits next to New, because "I have a folder of Notion
                  pages" is the same intent as "I want a document here" — it was
                  only reachable from Settings, which is where you configure the
                  app, not where you go with an export in hand. */}
              {view.kind !== 'trash' && !isIndex && (
                <Button size="sm" variant="ghost" icon={<Icon icon={Upload} size={16} />} iconOnly={headerTight}
                  aria-label={headerTight ? 'Import' : undefined} onClick={() => setImporting(true)}>{headerTight ? null : 'Import'}</Button>
              )}
              {view.kind !== 'trash' && (
                <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={createHere}>{createLabel}</Button>
              )}
              {/* The other things a page can be — a Database, a Collection (COLLECTION_ITEM_BRIEF §12) —
                  beside New rather than only inside a folder's menu. Templates are made as templates,
                  so the Templates view offers only that; the Index makes Collections. */}
              {view.kind !== 'trash' && !isTemplates && !isIndex && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton size="sm" label="More to create" icon={<Icon icon={ChevronDown} size={16} />} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem icon={<Icon icon={FileText} size={16} />} onSelect={() => void createHere()}>Doc</DropdownMenuItem>
                    <DropdownMenuItem icon={<Icon icon={Database} size={16} />} onSelect={() => void newPage(currentFolderId, 'database')}>Database</DropdownMenuItem>
                    <DropdownMenuItem icon={<Icon icon={Images} size={16} />} onSelect={() => void newPage(currentFolderId, COLLECTION_PAGE_TYPE)}>Collection</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        />
      )}
      <NotionImportModal open={importing} onOpenChange={setImporting} onImported={() => { if (typeof window !== 'undefined') window.location.reload(); }} />
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      {/* ── Rail ──
          HUB_RAIL_CLASS, not a private width: below `md` the rail stops being a
          column and stacks above the gallery. It used to be a hard 230px with
          `flexShrink: 0` and no narrow branch, so at a 420px viewport it kept
          all 230px and left the gallery 142px — narrower than a single card. */}
      {!railHidden && (
      <div className={cn(HUB_RAIL_CLASS, 'bg-paper')}>
        {/* Rails navigate; headers act. The hide button and the "+" both live in
            the page header now; what is left here is searching THIS list, a
            rail-scoped filter that belongs nowhere else.

            It used to be an ICON ALONE on a 44px row, right-aligned behind a
            flex spacer, which expanded into a SECOND row holding the input —
            80px of rail to filter a list, and at rest a lone glyph with nothing
            to explain it. It is one 32px field now: always there, says what it
            does, and costs less than the button did. The `searching` toggle
            state went with it — a field that is always visible has no mode. */}
        <div className="shrink-0 p-2">
          <TextInput
            size="sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }}
            onClear={q ? () => setQ('') : undefined}
            placeholder={isIndex ? 'Search collections' : 'Search docs'}
            aria-label={isIndex ? 'Search collections' : 'Search documents'}
            icon={<Icon icon={Search} size={16} />}
            autoComplete="off" data-1p-ignore data-lpignore="true"
          />
        </div>
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* "All Projects" was a HiFi label that survived into a Documents rail
              where it named the wrong noun — these are documents, and the app has
              one name per concept. Sentence case, per the glossary. FIRST, because it
              is where Documents opens. */}
          <RailItem icon={Cards} label="All documents" on={!selected && view.kind === 'all'} onClick={() => openView({ kind: 'all' })} />
          {/* UNFILED, not "Draft" (2026-09-30). The view is `!folder_id`: nothing about these docs
              is unfinished, they are simply not in a folder yet, and "Draft" promised a state the
              filter never checked. The internal id stays `draft` so no link or test moves. */}
          <RailItem icon={FileText} label="Unfiled" on={!selected && view.kind === 'draft'} onClick={() => openView({ kind: 'draft' })} />
          {/* The Collection Index (COLLECTION_PLAN X1): every Collection, as a visual card. */}
          <RailItem icon={Images} label="Collections" on={!selected && view.kind === 'collections'} onClick={() => openView({ kind: 'collections' })} />
          <RailItem icon={ShareNetwork} label="Shared" on={!selected && view.kind === 'shared'} onClick={() => openView({ kind: 'shared' })} />
          <RailItem icon={Layout} label="Templates" on={!selected && view.kind === 'templates'} onClick={() => openView({ kind: 'templates' })} />
        </div>

        {/* Collapsible Folders section */}
        <div style={{ padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* The rails' one section heading (components/ui/rail-section-heading.tsx), as Tasks, Calendar
              and the sidebar's Pinned draw it. */}
          <RailSectionHeading label="Folders" open={foldersOpen} onToggle={() => setFoldersOpen((v) => !v)}
            action={<IconButton size="xs" variant="ghost" label="New folder" icon={<Icon icon={Plus} size={12} />}
              onClick={() => { setFoldersOpen(true); setFolderParent(undefined); setCreatingFolder((c) => !c); }} />} />
          {foldersOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 5 }}>
              {creatingFolder && (
                <input autoFocus autoComplete="off" data-1p-ignore data-lpignore="true" value={folderDraft} onChange={(e) => setFolderDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setFolderParent(undefined); } }} onBlur={createFolder}
                  placeholder={folderParent ? `New folder in ${folderById(folderParent)?.name ?? 'folder'}` : 'Folder name'} style={{ border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', outline: 'none', background: 'var(--paper-2)', fontSize: 'var(--text-small-size)', padding: '6px 8px', color: 'var(--ink)' }} />
              )}
              {renderFolders(null, 0)}
              {folders.length === 0 && !creatingFolder && (
                <EmptyLine className="px-2 py-0.5 text-caption">No folders yet</EmptyLine>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', padding: 8, borderTop: '1px solid var(--line)' }}>
          <RailItem icon={Trash2} label="Trash" on={!selected && view.kind === 'trash'} onClick={() => openView({ kind: 'trash' })} count={archived.length || undefined} />
        </div>
      </div>
      )}

      {/* ── Content ── */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0, overflowY: selected ? 'hidden' : 'auto', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            {/* Scroller — THE WRITING SURFACE, and it is paper.
                
                This comment has said "the redesign's white sheet" since the
                redesign, and the code underneath it painted `--paper-2`. A
                document you type into is the one surface in the app that
                should be plain: the gallery is a place you BROWSE, so a
                recessed ground there is what lets the cards read as objects,
                but the editor is a place you WRITE, and a writing space with a
                tint reads as a preview of a document rather than the document.
                (User: "keep this as a white, this is writing space.")
                
                It matches its parent now, so the doc region is ONE surface
                with no seam across it — which is also why the cover, the
                title and the columns need no fill of their own. */}
            <div ref={scrollRef} data-bleed-root className="scroll-region" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
                {/* Cover — fixed height, full-bleed across the document container */}
                {docMeta.cover && (
                  <DocCover
                    cover={docMeta.cover} pos={docMeta.coverPos}
                    onCover={(c) => setDocMeta((m) => ({ ...m, cover: c, coverPos: c && isImageCover(c) && c === m.cover ? m.coverPos : undefined }))}
                    onPos={(p) => setDocMeta((m) => ({ ...m, coverPos: p }))}
                    attachTo={pageOwner}
                  />
                )}
            {/* 56px side padding reserves the block-control gutter (44px) left of
                the writing column, so handles never clip or shift the text. */}
            {/* THE MEASURE. 868 − 112 of padding gave a 756px column, which at the
                document's 16px body is 105 characters a line — nearly double the
                65–75 that continuous prose wants, and 20% past Notion's own. The
                sheet is Notion's 708px content column now (708 + 2×56), which
                measures 88 characters: the number the reference actually sets,
                and the one the brief asks to match. Wide blocks are unaffected —
                the cover band and the toolbar live outside this element. */}
            {/* A Collection has no page boundary (COLLECTION_INDEX_BRIEF §3): it takes the pane's width, its canvas
                reaches past the side padding named `--collection-bleed`, and nothing pads the page under it. */}
            <div ref={sheetRef} style={selected.type === COLLECTION_PAGE_TYPE
              ? { width: '100%', maxWidth: 'none', margin: '0 auto', padding: '60px 56px 0', flexShrink: 0, '--collection-bleed': '56px' } as React.CSSProperties
              : { width: '100%', maxWidth: docMeta.wide ? 'none' : 820, margin: '0 auto', padding: docMeta.cover ? '24px 56px 120px' : '60px 56px 120px', flexShrink: 0 }}>
                {/* Page icon — overlaps the cover edge; click re-opens the picker */}
                {selected.icon && (
                  <div style={{ marginBottom: 10, marginTop: docMeta.cover ? -50 : 0, position: 'relative', zIndex: 2, display: 'flex' }}>
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                      <button title="Change icon" aria-label="Change icon" aria-haspopup="dialog" aria-expanded={iconPicker} onClick={() => setIconPicker((v) => !v)} className="zb-press"
                        style={{ display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', padding: 4, margin: -4, borderRadius: 'var(--r-md)', cursor: 'pointer', lineHeight: 1 }}>
                        <PageIcon icon={selected.icon} size={52} />
                      </button>
                      {iconPicker && (
                        <EmojiPicker
                          onPick={async (ic) => { patchPage(selected.id, { icon: ic }); await updatePage(selected.id, { icon: ic }); }}
                          onRemove={async () => { patchPage(selected.id, { icon: null }); await updatePage(selected.id, { icon: null }); }}
                          onClose={() => setIconPicker(false)}
                        />
                      )}
                    </span>
                  </div>
                )}
                {/* Ghost actions — Add icon · Add cover · Add comment (redesign spec) */}
                <GhostActions
                  hasIcon={!!selected.icon} hasCover={!!docMeta.cover}
                  onIcon={async (ic) => { patchPage(selected.id, { icon: ic }); await updatePage(selected.id, { icon: ic }); }}
                  // A Collection is pictures already, and its body is its items: no cover, no page comments.
                  onCover={selected.type === COLLECTION_PAGE_TYPE ? undefined : (c) => setDocMeta((m) => ({ ...m, cover: c, coverPos: undefined }))}
                  onComment={selected.type === COLLECTION_PAGE_TYPE ? undefined : () => comments.open(PAGE_ANCHOR)}
                  attachTo={pageOwner}
                />
                {/* Title — the page's anchor, so it earns the top of the type
                    scale (28px, DS max) at display weight with tight tracking,
                    and real breathing room below before the property zone. A doc
                    title at 24/500 read like a section header, not the page. */}
                {/* A TEXTAREA, NOT AN INPUT. A title is the one string on the
                    page that must always be readable in full, and an <input>
                    cannot wrap: "Meeting notes - Client kickoff" needed 381px
                    and had 239 on a phone, so two thirds of it was scrolled out
                    of a field nobody thinks to scroll. It grows to fit instead.
                    Enter does not open a second line — a title is one string,
                    and every editor binds the key to "go into the document". */}
                <textarea ref={titleRef} value={title} rows={1} autoComplete="off" data-1p-ignore data-lpignore="true"
                  onChange={(e) => { setTitle(e.target.value); growTitle(e.currentTarget); }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    // A Collection has no first block: Enter settles its name and gives the page back its keys and paste.
                    if (selected.type === COLLECTION_PAGE_TYPE) { e.currentTarget.blur(); return; }
                    (sheetRef.current?.querySelector('[data-block-id] [contenteditable], [data-block-id] textarea') as HTMLElement | null)?.focus();
                  }}
                  placeholder={selected.type === COLLECTION_PAGE_TYPE ? NEW_COLLECTION_NAME : 'New doc'}
                  className="doc-title-input"
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', resize: 'none', overflow: 'hidden', fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1-size)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '36px', color: 'var(--text-primary)', marginTop: 4, marginBottom: 8, padding: 0, display: 'block' }} />
                {selected.type === 'database' ? (
                  /* Database page — the collection views replace the block canvas */
                  <DatabasePage pageId={selected.id}
                    demoDb={(selected.content as { demoDb?: { collection: Collection; rows: DbRow[] } })?.demoDb} />
                ) : selected.type === COLLECTION_PAGE_TYPE ? (
                  /* Collection page — its items, as a masonry or a canvas, replace the block canvas */
                  <CollectionPage pageId={selected.id} content={Array.isArray(selected.content) ? undefined : selected.content}
                    startAdding={addingTo === selected.id} onStartedAdding={() => setAddingTo(null)} />
                ) : (
                  <>
                {/* Properties + Resources (redesign) */}
                <DocProps meta={docMeta} onChange={setDocMeta} page={selected} userName={userName} />
                {/* Comments on the DOCUMENT (§7H). The same <Thread> the editor
                    draws under a block — one anchor is a block id, this one is
                    null. Resolved and orphaned threads live below it so a
                    finished conversation leaves the page without leaving. */}
                <DocThreads
                  open={comments.pageThreads} archived={comments.archived}
                  composing={comments.composingFor === PAGE_ANCHOR}
                  actions={comments.actions}
                  onCloseComposer={comments.close}
                />
                {/* Tags (existing feature — quiet row under resources) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {tags.map((t) => { const c = paletteFor(t); return (
                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption-size)', color: c.text, background: c.bg, borderRadius: 'var(--r-xs)', padding: '4px 4px 4px 6px', lineHeight: 1 }}>
                      <Icon icon={Hash} size={12} weight="bold" style={{ color: c.dot }} />{t}
                      <button onClick={() => setTags((ts) => ts.filter((x) => x !== t))} aria-label={`remove ${t}`} style={{ display: 'grid', placeItems: 'center', width: 14, height: 14, borderRadius: '50%', border: 'none', background: 'transparent', color: c.text, opacity: 0.7, cursor: 'pointer' }}><Icon icon={X} size={12} /></button>
                    </span>
                  ); })}
                  <input value={tagDraft} autoComplete="off" data-1p-ignore data-lpignore="true" onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="add tag…" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', width: 90, padding: 0 }} />
                </div>
                {/* Divider between the property zone and the block canvas —
                    on-scale margins (24/20), subtle line-2 (8% ink). */}
                <div style={{ height: 1, background: 'var(--line-2)', margin: '24px 0 20px' }} />
                <BlockEditor blocks={blocks} onChange={setBlocks}
                  pageId={selected.id}
                  {...(commentsEnabled ? { comments } : {})}
                  onCreateDatabasePage={() => newPage(currentFolderId, 'database')}
                  onExpandCollection={expandCollection}
                  onOpenPage={openChildPage}
                  acceptances={accept.acceptances} docHashes={accept.hashes} onWithdrawAccept={withdrawAccept}
                  acceptInvoices={accept.invoices}
                  onCreateAcceptInvoice={accept.crossing ? createAcceptInvoice : undefined}
                  {...(pageOwner ? { attachTo: pageOwner } : {})}
                  {...(rememberHook ? { remember: rememberHook } : {})} />
                  </>
                )}
            </div>
            </div>
            {selected.type !== 'database' && selected.type !== COLLECTION_PAGE_TYPE && (
              <>
                {/* Floating table-of-contents indicator (right, per HiFi) */}
                <DocToc blocks={blocks} scrollRef={scrollRef} />
                {/* Live counter pill — floats at the bottom edge of the open document */}
                <DocStats blocks={blocks} title={title} scrollRef={scrollRef} />
              </>
            )}
          </>
        ) : (
          <>
            {/* Card grid / list — recessed well surface (per the home HiFi):
                grid = 220×280 cards (gap 20); list = full-width rows. */}
            <div className="scroll-region" style={{ flex: 1, minHeight: 0, background: 'var(--well)', padding: '12px 12px 80px' }}>
              {/* The GRID RULE lives in the design system (`cardGridClass`), not
                  here. It was a `flex-wrap` of fixed 220px cards, which cannot
                  grow — measured 156px of dead space on every row of a 616px
                  pane, plus an `!important` media query to survive narrow
                  widths. `auto-fill` + `minmax` responds to the CONTAINER and
                  fills the row at any width, so the media query goes too. */}
              <div className={isIndex ? cardGridClass('md', 'gap-5') : undefined}>
                {/* The Collection Index (COLLECTION_PLAN X1–X2): "New collection" first, then every Collection as a
                    visual card with the same hover controls a doc card has. An empty Index uses the empty states below. */}
                {isIndex && sortedPages.length > 0 && <NewCollectionCard onCreate={createHere} />}
                {isIndex && indexEntries.map(({ page: p, doc }) => (
                  <CollectionIndexCard key={p.id} page={p} doc={doc}
                    renaming={renamingId === p.id}
                    onOpen={() => setSelectedId(p.id)}
                    onAdd={() => { setAddingTo(p.id); setSelectedId(p.id); }}
                    onRenameTo={(t) => renameTo(p.id, t)} onCancelRename={() => setRenamingId(null)}
                    actions={(
                      <DocCardActions p={p} folders={folders} userName={userName} menuOpen={menuFor === p.id}
                        onMenu={() => setMenuFor(menuFor === p.id ? null : p.id)} onCloseMenu={() => setMenuFor(null)}
                        onRename={() => { setMenuFor(null); setRenamingId(p.id); }}
                        onShare={() => { setMenuFor(null); share(p.id); }}
                        onFav={() => { fav(p.id, !p.is_favorite); setMenuFor(null); }}
                        onDup={() => dup(p.id)} onMove={(fid) => moveTo(p.id, fid)}
                        onArchive={() => { archive(p.id, true); setMenuFor(null); }} />
                    )} />
                ))}
                {/* NO CREATE CARD (2026-09-30). The dashed "New doc" tile took the best cell of the grid
                    to offer the journey the header's New doc — this view's brand action — already offers. */}
                {!isIndex && sortedPages.length > 0 && (
                  <DocIndex
                    // Trash and Templates are not about recency, so they are one ungrouped list.
                    groups={view.kind === 'trash' || isTemplates
                      ? [{ id: 'today', label: '', items: sortedPages }]
                      : groupDocs(sortedPages, todayISO(timeZone), timeZone)}
                    headings={!(view.kind === 'trash' || isTemplates)}
                    layout={gridView}
                    folders={folders}
                    renamingId={renamingId}
                    typeIcon={typeIcon}
                    ago={ago}
                    onOpen={(p) => { if (view.kind !== 'trash') setSelectedId(p.id); }}
                    onRenameTo={(p, t) => renameTo(p.id, t)}
                    onCancelRename={() => setRenamingId(null)}
                    onCover={view.kind === 'trash' ? undefined : setCover}
                    actions={(p) => view.kind === 'trash' ? (
                      // Always visible in Trash: restoring and deleting are what the view is for.
                      <span className="inline-flex items-center gap-0.5">
                        <IconButton size="xs" variant="ghost" label="Restore" icon={<Icon icon={Undo2} size={14} />} onClick={() => archive(p.id, false)} />
                        <IconButton size="xs" variant="ghost" label="Delete forever" className="text-danger-600" icon={<Icon icon={Trash2} size={14} />} onClick={() => { setMenuFor(null); removePage(p.id); }} />
                      </span>
                    ) : (
                      <DocCardActions p={p} folders={folders} userName={userName} menuOpen={menuFor === p.id}
                        onMenu={() => setMenuFor(menuFor === p.id ? null : p.id)} onCloseMenu={() => setMenuFor(null)}
                        onRename={() => { setMenuFor(null); setRenamingId(p.id); }}
                        onShare={() => { setMenuFor(null); share(p.id); }}
                        onFav={() => { fav(p.id, !p.is_favorite); setMenuFor(null); }}
                        onDup={() => dup(p.id)} onMove={(fid) => moveTo(p.id, fid)}
                        onArchive={() => { archive(p.id, true); setMenuFor(null); }} />
                    )}
                  />
                )}
                {/* Every view now says something when it's empty. Four of the six
                    used to render literally nothing (the ternary fell through to
                    `null`), so an empty Draft or folder was a blank grey field.
                    The action is `secondary` — the header already holds this
                    view's one filled accent. */}
                {sortedPages.length === 0 && (
                  <div className="w-full">
                    {filtered ? (
                      <EmptyState
                        illustration={<Icon icon={Filter} size={20} />}
                        title="Nothing matches"
                        description={tagFilter && query ? `No document here is tagged ${tagFilter} and matches “${q.trim()}”.` : tagFilter ? `Nothing here is tagged ${tagFilter}.` : `Nothing here matches “${q.trim()}”.`}
                        primary={<Button variant="secondary" onClick={() => { setTagFilter(null); setQ(''); }}>Clear filters</Button>}
                      />
                    ) : (
                      <EmptyState
                        illustration={<Icon icon={viewMeta.icon} size={20} />}
                        title={EMPTY_COPY[view.kind].title}
                        description={EMPTY_COPY[view.kind].body}
                        // No action on Trash or Shared: neither is a place you
                        // create into. A new page would land in Draft and leave
                        // the view you're looking at just as empty — an action
                        // that doesn't change the screen is worse than none.
                        primary={view.kind === 'trash' || view.kind === 'shared' ? undefined : (
                          <Button variant="secondary" icon={<Icon icon={Plus} size={16} />} onClick={createHere}>{createLabel}</Button>
                        )}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      </div>
      <style>{`
        /* No lift on hover: a state is a wash, never an elevation. The edge darkens instead (below). */
        /* Ghost page controls (Add icon · Add cover · Add comment): full pill
           surface — icon + label react together, layout never shifts. */
        .doc-ghost{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border:none;background:transparent;border-radius:var(--r-sm);font-size:12px;font-weight:500;color:var(--disabled-text);cursor:pointer;transition:background var(--duration-fast) var(--ease-hover),color var(--duration-fast) var(--ease-hover)}
        .doc-ghost:hover{background:var(--hover);color:var(--text-secondary)}
        /* Property value cells highlight as whole surfaces (Notion). */
        .prop-cell{border-radius:var(--r-sm);transition:background var(--duration-fast) var(--ease-hover)}
        .prop-cell:hover{background:var(--hover)}
        /* Search field: quiet at rest, soft wash on hover, ring on focus. */
        .doc-search{transition:background var(--duration-fast) var(--ease-hover),box-shadow var(--duration-fast) var(--ease-hover)}
        .doc-search:hover{background:var(--paper-3) !important}
        .doc-search:focus{box-shadow:0 0 0 2px var(--accent-border)}
        /* Hover pill (pencil | ⋮): hidden by default, fades in on card hover and
           stays visible while its menu is open — and while focus is inside the card,
           or tabbing onto Rename or the menu lands on a control nobody can see. */
        .doc-cardmenu{opacity:0;transition:opacity var(--duration-fast) var(--ease-hover)}
        .doc-card:hover .doc-cardmenu,.doc-card:focus-within .doc-cardmenu,.doc-row:hover .doc-cardmenu,.doc-row:focus-within .doc-cardmenu,.doc-tile:hover .doc-cardmenu,.doc-tile:focus-within .doc-cardmenu,.doc-cardmenu[data-open="true"]{opacity:1}
        @media (hover:none){.doc-cardmenu{opacity:1}}
        /* Grid card hover — uniform paper-3 wash (body is transparent) */
        .doc-card:hover{border-color:var(--line-3)}
        .doc-listrow:hover{background:var(--paper-3)}
        /* The two !important width overrides that used to live here are gone.
           They existed to undo the fixed 220x280 card below 560px — a layout
           fighting itself. auto-fill + minmax sizes the card at EVERY width, so
           there is nothing left to undo. The tag column still folds away,
           because that is a genuine content decision, not a geometry rescue. */
        @media (max-width: 560px) { .doc-listtags{display:none} }
        /* Cover: fixed height, 100% width; shorter on small screens */
        .doc-cover{height:279px} /* measured from the change-cover HiFi */
        @media (max-width: 680px){.doc-cover{height:180px}}
        /* The cover actions, comment delete and property chip buttons used to be
           revealed by rules here. They had no coarse-pointer branch, so on a
           phone they were invisible AND unreachable — and the rules reached
           across files into doc-properties. They use the DS reveal-on-hover
           utility now, which handles both. */
        .doc-title-input::placeholder{color:var(--disabled-text)}
        .prop-input::placeholder{color:var(--text-muted)}
      `}</style>
      {confirmUI}
      {/* Version history for the open document. Restoring rewrites `pages.content`
          server-side, so the host re-reads that page rather than guessing. */}
      {selected && historyOpen && (
        <VersionHistory
          pageId={selected.id}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestored={() => {
            getPage(selected.id).then((r) => {
              // Silence here would leave the PREVIOUS version on screen after a
              // restore, which reads as "the restore did nothing".
              if ('error' in r) return toast({ message: r.error, variant: 'error' });
              setTitle(r.title ?? '');
              setBlocks(toBlocks(r.content));
              setDocMeta(readMeta(r.content));
              skipSaveRef.current = true;   // the reload is not an edit
              setPages((ps) => ps.map((p) => (p.id === selected.id ? { ...p, title: r.title, content: r.content } : p)));
            });
          }}
        />
      )}
    </div>
  );
}

// 34px rail row — 16px filled icon · 14/400 label · radius 6. Selection is the
// warm wash + ink-2 (the app nav language, per the redesign). Unselected: nav
// rows read at --ink-4, folder rows at --ink.
function RailItem({ icon, label, on, variant = 'nav', indent = 0, onClick, count }: { icon: typeof FileText; label: string; on: boolean; variant?: 'nav' | 'folder'; indent?: number; onClick: () => void; count?: number }) {
  const restText = variant === 'folder' ? 'var(--ink)' : 'var(--text-secondary)';
  const text = on ? 'var(--ink-2)' : restText;
  const iconColor = on ? 'var(--ink-2)' : restText;
  return (
    <button onClick={onClick} aria-current={on ? 'true' : undefined}
      // `focus-ring`: these rail rows are the module's whole navigation and had
      // no focus affordance at all — tabbing through Documents was invisible.
      // Selected is `surface-selected` + medium, per the global sidebar's NavItem —
      // NOT `surface-hover`, which is what this used and which made a selected row
      // pixel-identical to a merely hovered one.
      className={cn('focus-ring flex h-[var(--row-nav)] w-full cursor-pointer items-center gap-2 rounded-sm border-0 pr-2 text-left transition-colors', on ? 'bg-surface-selected font-medium' : 'bg-transparent hover:bg-surface-hover')}
      style={{ paddingLeft: 8 + indent * 16 }}>
      {/* Nav icons follow the PRIMARY sidebar: outline (regular) weight via the DS
          <Icon> seam — never fill. Fill is reserved for tiny active-state glyphs. */}
      <Icon icon={icon} size={16} weight="regular" style={{ color: iconColor, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: text, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && <span className="num" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>{count}</span>}
    </button>
  );
}

// Tag chips (redesign): white pill · tag glyph in the palette color · 10px text.

// The hover controls every page card carries: a grouped pencil (rename) and ⋮ (the page's menu). A doc card and a
// Collection card on the Index use these same controls, so both kinds of card are used the same way
// (COLLECTION_PLAN X2).
function DocCardActions({ p, folders, userName, menuOpen, onMenu, onCloseMenu, onRename, onShare, onFav, onDup, onMove, onArchive }: {
  p: Page; folders: Folder[]; userName: string; menuOpen: boolean;
  onMenu: () => void; onCloseMenu: () => void; onRename: () => void; onShare: () => void; onFav: () => void; onDup: () => void;
  onMove: (fid: string | null) => void; onArchive: () => void;
}) {
  return (
    // Grouped control: pencil | ⋮ with a hairline between (per the hover HiFi).
    // Visibility is driven purely by CSS (.doc-card:hover / [data-open]) — an inline
    // opacity would out-specify the hover rule and the pill would never appear.
    <span className="doc-cardmenu" data-open={menuOpen ? 'true' : undefined} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 'var(--r-sm)', background: 'var(--paper-2)', boxShadow: '0 0 0 1px var(--line-2), var(--shadow-sm)', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <button onClick={(e) => { e.stopPropagation(); onRename(); }} title="Rename" aria-label="Rename" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 30, height: 26, borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={Pencil} size={14} /></button>
      <span aria-hidden style={{ width: 1, height: 18, background: 'var(--line)', flexShrink: 0 }} />
      {/* The menu now lives ON its trigger. It used to render as an absolutely
          positioned sibling of the card, which is what let the card clip it.
          Its content is portalled, but React still bubbles a click inside it up to the card, which opened the page
          under the menu as the item acted: Delete opened the page it had just put in Trash, Star opened the doc it
          starred. The menu's clicks stop here, for every card that carries these controls. */}
      <span onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
        <DocContextMenu p={p} folders={folders} userName={userName}
          open={menuOpen} onOpenChange={(next) => (next ? onMenu() : onCloseMenu())}
          trigger={
            <button onClick={(e) => e.stopPropagation()} title="More" aria-label="Page menu" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 30, height: 26, borderRadius: 0, border: 'none', background: menuOpen ? 'var(--hover)' : 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={Ellipsis} size={16} weight="bold" /></button>
          }
          onOpenTab={() => window.open(`/documents?page=${p.id}`, '_blank', 'noopener')}
          onCopyLink={onShare} onFav={onFav} onDup={onDup} onMove={onMove} onDelete={onArchive} />
      </span>
    </span>
  );
}

// The index's rows and tiles live in components/documents/doc-index.tsx (2026-09-30 redesign).

// Document context menu (redesign): a 200px sectioned sheet — text-only rows,
// full-width hairlines between sections, Delete in red, and a "last edited"
// footer. Per the popup HiFi.
//   [Open in New Tab] | [Copy Link] | [Star · Duplicate · Move to +] | [Delete] · footer
//
// PORTALLED RADIX, not a hand-rolled panel. This was a `MenuPanel` with
// `className="absolute"` plus a manual mousedown-outside listener and a manual
// submenu — and the user screenshotted it CLIPPED inside a document card, with
// "Move to" sliced off at the card edge.
//
// That is the documented failure: an absolutely-positioned panel is clipped by
// any scrolling/overflow ancestor, and once a box sets `overflow-x`, CSS
// computes `overflow-y` to match — so a wrapper that only meant to scroll
// sideways clips vertically too. CLAUDE.md's rule ("never hand-roll a dropdown
// — use the shadcn/Radix version") exists for exactly this.
//
// `DropdownMenuContent` portals to the body, flips and clamps into the viewport
// on both axes, follows the trigger, and brings roving-focus keyboard nav, type
// -ahead and the submenu safe-triangle for free. The caller passes its own
// trigger so the button keeps its existing look and `data-open` hover contract.
function DocContextMenu({ p, folders, userName, trigger, open, onOpenChange, align = 'end', onOpenTab, onCopyLink, onFav, onDup, onMove, onDelete, onHistory, wide, onWide }: {
  p: Page; folders: Folder[]; userName: string;
  /** The control that opens the menu — rendered as the Radix trigger. */
  trigger: React.ReactNode;
  open: boolean; onOpenChange: (next: boolean) => void;
  align?: 'start' | 'end';
  onOpenTab: () => void; onCopyLink: () => void; onFav: () => void; onDup: () => void; onMove: (fid: string | null) => void; onDelete: () => void;
  /** Only the open document offers history — a card in the grid has no body loaded. */
  onHistory?: () => void;
  /** Layout, for the open document only — a card has no sheet to widen. */
  wide?: boolean;
  onWide?: (next: boolean) => void;
}) {
  const editedAt = formatDayTime(p.updated_at) ?? ago(p.updated_at);
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} aria-label="Document actions" className="w-[220px]">
        <DropdownMenuItem onSelect={onOpenTab}>Open in new tab</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCopyLink}>Copy link</DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* The menu STAYS OPEN for this one. Every other row is a verb that
            takes you somewhere; this changes what you are looking at, and the
            only way to judge it is to see it. `preventDefault` on select is how
            Radix expresses "don't dismiss". */}
        {onWide && (
          <>
            <DropdownMenuCheckboxItem
              checked={!!wide}
              onSelect={(e) => { e.preventDefault(); onWide(!wide); }}
            >
              Full width
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        {onHistory && (
          <>
            <DropdownMenuItem onSelect={onHistory}>Version history</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onFav}>{p.is_favorite ? 'Unstar' : 'Star'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDup}>Duplicate</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[220px] w-[180px] overflow-y-auto">
            {(p.folder_id ?? null) !== null && (
              <DropdownMenuItem icon={<Icon icon={FileText} size={14} className="shrink-0" />} onSelect={() => onMove(null)}>
                Draft (no folder)
              </DropdownMenuItem>
            )}
            {folders.filter((f) => f.id !== p.folder_id).map((f) => (
              <DropdownMenuItem key={f.id} icon={<Icon icon={FolderIcon} size={14} className="shrink-0" />} onSelect={() => onMove(f.id)}>
                {f.name}
              </DropdownMenuItem>
            ))}
            {folders.length === 0 && <div className="px-2.5 py-1.5 text-caption text-ink-500">No folders</div>}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onSelect={onDelete}>Delete</DropdownMenuItem>
        {/* Footer — last-edited attribution (per the popup HiFi). Not an item:
            it is not selectable, so it must not take roving focus. */}
        <div className="-mx-1 -mb-1 mt-1 rounded-b-lg border-t border-line-soft bg-paper-3 px-3 pb-2 pt-2">
          <div className="text-micro leading-[1.4] text-ink-500">Last edited by {userName}</div>
          <div className="text-micro leading-[1.4] text-ink-500">{editedAt}</div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Redesign: ghost action row + cover picker + properties/resources ─────────
// "Add icon · Add cover · Add comment" (redesign ghost trio above the title).
// Each is a full hover surface (.doc-ghost): rounded wash, icon + label react
// together. The row is pulled left by the pill padding so text stays aligned
// with the title, and the pills never shift layout.
function GhostActions({ hasIcon, hasCover, onIcon, onCover, onComment, attachTo }: {
  hasIcon: boolean; hasCover: boolean; onIcon: (icon: string) => void;
  /** Absent where a page has no cover or comments of its own (a Collection). */
  onCover?: (cover: string) => void; onComment?: () => void;
  attachTo?: AttachmentOwner;
}) {
  const [iconOpen, setIconOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, minHeight: 24, marginLeft: -8 }}>
      {!hasIcon && (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button onClick={() => { setIconOpen((v) => !v); setCoverOpen(false); }} aria-haspopup="dialog" aria-expanded={iconOpen} className="doc-ghost">
            <Icon icon={Smile} size={12} /> Add icon
          </button>
          {iconOpen && <EmojiPicker onPick={onIcon} onClose={() => setIconOpen(false)} />}
        </span>
      )}
      {!hasCover && onCover && (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button onClick={() => { setCoverOpen((v) => !v); setIconOpen(false); }} aria-haspopup="dialog" aria-expanded={coverOpen} className="doc-ghost">
            <Icon icon={Image} size={12} /> Add cover
          </button>
          {coverOpen && <CoverPicker onPick={onCover} onClose={() => setCoverOpen(false)} attachTo={attachTo} />}
        </span>
      )}
      {onComment && (
        <button onClick={onComment} className="doc-ghost">
          <Icon icon={MessageCircle} size={12} /> Add comment
        </button>
      )}
    </div>
  );
}

// Full-bleed document cover: fixed height (via .doc-cover), gradient or image.
// Hover actions bottom-right — Change (picker) · Random · Reposition (images).
// Repositioning drags the crop window; Save persists, Cancel/Esc reverts.
function DocCover({ cover, pos, onCover, onPos, attachTo }: {
  cover: string; pos?: number;
  onCover: (c?: string) => void; onPos: (p?: number) => void;
  attachTo?: AttachmentOwner;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repos, setRepos] = useState<number | null>(null); // live position while repositioning
  const bandRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const image = isImageCover(cover);
  const shownPos = repos ?? pos ?? 50;
  // An uploaded cover is an attachment reference; the bucket is private, so its
  // URL is a short-lived signature minted on render. `data:` and `http` covers
  // are already usable as-is and never reach this hook.
  const { url: storedUrl } = useAttachmentUrl(coverAttachmentId(cover));
  const src = coverAttachmentId(cover) ? storedUrl : cover;

  // Drag-to-reposition: vertical delta maps to object-position percent.
  function onRepoMouseDown(e: React.MouseEvent) {
    if (repos === null) return;
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startPos: repos };
    const move = (ev: MouseEvent) => {
      const d = dragRef.current; const band = bandRef.current;
      if (!d || !band) return;
      const delta = ((ev.clientY - d.startY) / band.clientHeight) * 100;
      setRepos(Math.max(0, Math.min(100, d.startPos - delta)));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // Grouped action pill, per the "change cover" HiFi: paper-2 · 1px --line ·
  // r8 · 2px padding · 4px gap, chips 14/400 ink-4 (r6, 4px 6px), 1×13 dividers.
  const chip: React.CSSProperties = { padding: '4px 6px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)', fontWeight: 400, lineHeight: '20px', cursor: 'pointer', whiteSpace: 'nowrap' };
  const divider = <span aria-hidden style={{ width: 1, height: 13, background: 'var(--line)', flexShrink: 0 }} />;
  const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: 2, background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' };
  return (
    <div ref={bandRef} className="doc-cover group" onMouseDown={onRepoMouseDown}
      style={{ position: 'relative', width: '100%', flexShrink: 0, background: image ? 'var(--well)' : coverCss(cover), cursor: repos !== null ? 'ns-resize' : undefined, userSelect: repos !== null ? 'none' : undefined }}>
      {image && src && (
        <span aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL or an inline cover */}
          <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${shownPos}%`, display: 'block' }} />
        </span>
      )}
      {repos !== null ? (
        <>
          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', padding: '5px 12px', borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--ink) 62%, transparent)', color: 'var(--paper-2)', fontSize: 'var(--text-caption-size)', fontWeight: 500, pointerEvents: 'none' }}>Drag to reposition</span>
          <span style={{ ...pill, position: 'absolute', right: 10, top: 10 }} onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => { onPos(Math.round(repos)); setRepos(null); }} className="zb-press" style={chip}>Save position</button>
            {divider}
            <button onClick={() => setRepos(null)} className="zb-press" style={chip}>Cancel</button>
          </span>
        </>
      ) : (
        // Revealed by the DS utility so these stay reachable on touch, where
        // there is no hover at all. While the picker is open the class comes
        // off entirely — the actions must not fade out from under a popover.
        <span className={cn(!pickerOpen && 'reveal-on-hover')} style={{ position: 'absolute', right: 10, top: 10 }}>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <span style={pill}>
              <button onClick={() => setPickerOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={pickerOpen} className="zb-press" style={chip}>Change</button>
              {divider}
              {!image && <button onClick={() => onCover(randomCover(cover))} className="zb-press" style={chip}>Random</button>}
              {image && <button onClick={() => setRepos(pos ?? 50)} className="zb-press" style={chip}>Reposition</button>}
            </span>
            {pickerOpen && (
              <CoverPicker current={cover} align="right"
                onPick={(c) => onCover(c)}
                onRemove={() => onCover(undefined)}
                onClose={() => setPickerOpen(false)}
                attachTo={attachTo} />
            )}
          </span>
        </span>
      )}
    </div>
  );
}

// ── Comments (redesign "Add comment" flow) ──────────────────────────────────
// Measured from the "add comment" HiFi: 24px r6 well avatar with a 14/400
// ink-3 initial · quiet 14px composer, "Add a comment…" placeholder in the
// muted tone. Comments persist in the page content JSON next to blocks.

// Properties zone under the title (Notion-style typed properties), plus the
// doc's place in the graph (§3.4). A doc knows its project, its client and its
/**
 * "Remember this" from a selection in this document — §7X §4.2, the `marked`
 * capture path.
 *
 * THE SUBJECT RULE, and it is the whole design: a doc that belongs to a client
 * produces facts about the CLIENT, not about the doc. "They pay on the 1st" is
 * true of Meridian Studio wherever you happen to read it, and filing it against
 * the brief it was mentioned in would bury it in the one place you already were.
 * Only a doc with no client is itself the subject.
 *
 * A project would be a good subject too and is deliberately NOT offered yet: the
 * project overview does not host a memory panel, so a fact filed there would be
 * invisible. Never record something somewhere it cannot be read — that is what
 * keeps the module's "zero surprise" measure at zero, and it is why this returns
 * `undefined` (hiding the toolbar action entirely) rather than guessing.
 *
 * The client's name is resolved through `resolveRefs`, the app's ONE answer to
 * "what is this id called", and only for docs that have a client — so an
 * ordinary note still opens with no extra round trip.
 */
function useRememberFromDoc(page: Page | null): RememberHook | undefined {
  const clientId = page?.client_id ?? null;
  // The name AND the id it answers, as one value — so "is this name still the
  // right one?" is decided during render instead of by a reset effect that runs
  // after paint. Switching docs would otherwise show the previous client's name
  // for a frame, and the hint is the one thing telling you where a fact lands.
  const [resolved, setResolved] = useState<{ id: string; name: string } | null>(null);
  const clientName = resolved && resolved.id === clientId ? resolved.name : null;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    resolveRefs(createClient(), [{ type: 'client', id: clientId }])
      .then((found) => {
        const name = found.get(`client:${clientId}`);
        if (!cancelled && name) setResolved({ id: clientId, name });
      });
    return () => { cancelled = true; };
  }, [clientId]);

  return useMemo(() => {
    if (!page || isTempId(page.id)) return undefined;
    // A client doc waits for the name rather than offering "Remember about
    // Untitled" for a frame — the hint is the only thing telling the user where
    // the fact is going, so a wrong one is worse than a late one.
    if (clientId && !clientName) return undefined;

    const subject: MemorySubject = clientId
      ? { type: 'client', id: clientId }
      : { type: 'doc', id: page.id };

    return {
      subjectLabel: clientId ? clientName! : (page.title?.trim() || 'this doc'),
      max: BODY_MAX,
      onSave: async (body: string) => {
        const res = await remember({
          body,
          subject,
          origin: 'marked',
          // The receipt: every memory can answer "why do you think this?".
          source: { type: 'doc', id: page.id },
        });
        if ('error' in res) return res.error;
        const created = res.memory;
        toast({
          message: `Remembered about ${clientId ? clientName! : 'this doc'}.`,
          action: {
            label: 'Undo',
            // A hard delete of a row seconds old — undoing your own action
            // should leave nothing behind (§5.4).
            onAction: () => { forgetMemory(created.id); },
          },
        });
        return null;
      },
    };
  }, [page, clientId, clientName]);
}

// parent/children through columns nothing ever surfaced — until now the editor
// showed a title and a body and no sense of what the page belonged to.
function DocProps({ meta, onChange, page, userName }: { meta: DocMeta; onChange: React.Dispatch<React.SetStateAction<DocMeta>>; page: Page; userName: string }) {
  // Bumped after a link is saved so the Connected panel refetches — otherwise
  // you'd pick a project and watch nothing happen until a reload.
  const [linkVersion, setLinkVersion] = useState(0);
  return (
    // gap:2 matches the row gap INSIDE DocLinks and PropertyList (both gap-0.5),
    // so links and custom properties read as ONE evenly-spaced list — not two
    // groups 6px apart with 2px rows inside each (the "random" row rhythm).
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Links first: what the doc belongs to is part of its identity, and it
          keeps PropertyList's trailing "Add a property" as the last row. */}
      <DocLinks
        key={page.id}
        pageId={page.id}
        projectId={page.project_id ?? null}
        clientId={page.client_id ?? null}
        onChange={() => setLinkVersion((v) => v + 1)}
      />
      <PropertyList
        props={meta.props ?? []}
        onChange={(next) => onChange((m) => ({ ...m, props: next }))}
        ctx={{ userName, createdAt: page.created_at, updatedAt: page.updated_at, pageId: page.id }}
      />
      {/* Memory (§7X §5.2) — read-only here. A doc SHOWS what is known and stays
          out of the way; recording happens on the client, or from a selection in
          the body. It renders nothing at all unless this doc is itself the
          subject of a fact, which only happens for docs with no client. */}
      <MemoryPanel subject={{ type: 'doc', id: page.id }} className="mt-4" />

      {/* Connected is its own section below the properties — mt-4 keeps the ~18px
          break it had before the property rows tightened to a 2px rhythm. */}
      <ConnectedPanel self={{ type: 'doc', id: page.id }} refreshKey={linkVersion} className="mt-4" />
    </div>
  );
}

// Floating table-of-contents indicator — one line per heading, active in ink,
// the rest at 31% ink (measured from the HiFi). Tracks the section nearest the
// top on scroll; clicking a line scrolls that heading into view. Fixed to the
// right margin and hidden on narrow viewports so it never overlaps the text.
function DocToc({ blocks, scrollRef }: { blocks: Block[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  // The outline is headings PLUS the landmarks a reader can't see inside — a
  // collapsed toggle, a table, a callout (lib/outline.ts owns that rule).
  const heads = outlineOf(blocks);
  const depths = outlineDepths(heads);
  const [active, setActive] = useState<string | null>(heads[0]?.id ?? null);
  const activeValid = active !== null && heads.some((h) => h.id === active);
  const activeId = activeValid ? active : heads[0]?.id ?? null;
  useEffect(() => {
    const sc = scrollRef.current; if (!sc) return;
    const onScroll = () => {
      const rows = [...sc.querySelectorAll('[data-heading]')] as HTMLElement[];
      const top = sc.getBoundingClientRect().top + 90;
      let cur: string | null = rows[0]?.getAttribute('data-block-id') ?? null;
      for (const r of rows) { if (r.getBoundingClientRect().top <= top) cur = r.getAttribute('data-block-id'); else break; }
      if (cur) setActive(cur);
    };
    const id = setTimeout(onScroll, 60);
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(id); sc.removeEventListener('scroll', onScroll); };
  }, [scrollRef, blocks]);
  const [expanded, setExpanded] = useState(false);
  if (heads.length < 2) return null;
  // Rank reads as WIDTH: h1 widest, a landmark narrowest — the same signal the
  // indent gives in the expanded panel.
  const lineW = (level: 1 | 2 | 3 | 4) => (level === 1 ? 22 : level === 2 ? 16 : level === 3 ? 11 : 8);
  const goTo = (id: string) => { const el = scrollRef.current?.querySelector(`[data-block-id="${id}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  return (
    <div onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
      style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {!expanded ? (
        heads.map((h) => {
          const on = h.id === activeId;
          return (
            <button key={h.id} title={h.label} className="doc-toc-line"
              onClick={() => goTo(h.id)}
              style={{ display: 'flex', justifyContent: 'flex-end', width: 44, padding: '6px 0', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              {/* The active tick grows by 4px. That is a TRANSFORM, not a width:
                  the rail redraws on every scroll tick, and animating width
                  relayouts the row each frame. Origin right, because the ticks
                  are flush to the right edge and must stay pinned there. */}
              <span style={{ display: 'block', width: lineW(h.level), height: 2, borderRadius: 2, transformOrigin: 'right center', transform: on ? `scaleX(${(lineW(h.level) + 4) / lineW(h.level)})` : 'scaleX(1)', background: on ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 31%, transparent)', transition: 'transform var(--duration-base) var(--ease-standard), background var(--duration-base) var(--ease-hover)' }} />
            </button>
          );
        })
      ) : (
        // Hover-expanded progress panel — line glyph + section label per heading,
        // active row highlighted (DS popover language).
        <MenuPanel aria-label="Document sections" className="flex min-w-[200px] max-w-[280px] flex-col">
          {heads.map((h, i) => {
            const on = h.id === activeId;
            return (
              <MenuItem key={h.id} onClick={() => goTo(h.id)} className={on ? 'bg-surface-hover text-ink-900' : undefined}
                // Indent carries the hierarchy — a landmark reads as INSIDE the
                // section above it, not as another top-level heading.
                style={{ paddingInlineStart: 8 + depths[i] * 12 }}
                icon={<span aria-hidden className="block h-0.5 shrink-0 rounded-[2px]" style={{ width: lineW(h.level), background: on ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 31%, transparent)' }} />}>
                {h.label}
              </MenuItem>
            );
          })}
        </MenuPanel>
      )}
    </div>
  );
}

// Live counter — the design's status chip, flush with the bottom edge and
// right-anchored: --well-2 surface, top-rounded 8, pad 8, 12px item gap,
// 10px/10 muted text (characters · words · sentences · paragraphs · spaces).
// The counter is CONTEXTUAL: with nothing selected it describes the document;
// select text and it describes the selection, and adds the two numbers that only
// mean anything about a passage you're actually looking at — how long it takes to
// read, and to read aloud. Counting lives in lib/text-stats.ts so the two readouts
// can never disagree about what "24 sentences" means.
function DocStats({ blocks, title, scrollRef }: { blocks: Block[]; title: string; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [selText, setSelText] = useState('');

  useEffect(() => {
    // `selectionchange` is document-wide, so the handler checks the selection is
    // actually inside this document's scroller — a selection in the sidebar or a
    // popover must not repaint the doc's footer.
    const onSel = () => {
      const sel = window.getSelection();
      const host = scrollRef.current;
      if (!sel || sel.isCollapsed || !host || sel.rangeCount === 0) return setSelText('');
      const within = host.contains(sel.anchorNode) && host.contains(sel.focusNode);
      if (!within) return setSelText('');
      // Read the RANGES, not `sel.toString()`: they carry the same text, and a
      // document that isn't focused (background tab, an automated check) returns
      // "" from toString() while the ranges still hold the selection.
      let out = '';
      for (let i = 0; i < sel.rangeCount; i++) out += sel.getRangeAt(i).toString();
      setSelText(out);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [scrollRef]);

  const selecting = !!selText.trim();
  const docText = [title, ...blocks.map((b) => b.text)].filter(Boolean).join('\n');
  const s = textStats(selecting ? selText : docText);
  // With real blocks in hand, the block count beats splitting text on newlines.
  const paragraphs = selecting ? s.paragraphs : blocks.filter((b) => b.text.trim()).length;

  const items: [number, string][] = [
    [s.characters, 'characters'], [s.words, 'words'], [s.sentences, 'sentences'], [paragraphs, 'paragraphs'],
  ];

  return (
    <div aria-label={selecting ? 'Selection statistics' : 'Document statistics'} aria-live="polite"
      style={{ position: 'absolute', bottom: 0, right: 60, zIndex: 8, display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: 'var(--well-2)', borderRadius: 'var(--r-md) var(--r-md) 0 0', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {selecting && (
        <span style={{ fontSize: 'var(--text-micro-size)', lineHeight: '10px', color: 'var(--ink-2)', fontWeight: 600 }}>Selection</span>
      )}
      {items.map(([n, label]) => (
        <span key={label} style={{ fontSize: 'var(--text-micro-size)', lineHeight: '10px', color: 'var(--text-muted)' }}>
          <span className="num" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }}>{n}</span> {label}
        </span>
      ))}
      {selecting && s.words > 0 && (
        <>
          <span style={{ fontSize: 'var(--text-micro-size)', lineHeight: '10px', color: 'var(--text-muted)' }}>
            <span className="num" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }}>{formatDuration(readingSeconds(s.words))}</span> read
          </span>
          <span style={{ fontSize: 'var(--text-micro-size)', lineHeight: '10px', color: 'var(--text-muted)' }}>
            <span className="num" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }}>{formatDuration(speakingSeconds(s.words))}</span> aloud
          </span>
        </>
      )}
    </div>
  );
}
