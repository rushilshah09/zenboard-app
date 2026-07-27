'use client';
// Documents hub — pixel-matched to the HiFi frames:
//   · 230px rail: Draft (always plum) · All Projects · Shared · Templates,
//     a collapsible "Folders" section (caret + inline create), Trash2 pinned low.
//     Rows3 34px / radius 6 / 14px labels; active row = grey pill.
//   · content topbar: grid views get the [+ New Page][Folder][Template] outline
//     buttons; an open doc gets breadcrumb chips (Private · folder · title) with
//     the save status + Share on the right.
//   · 271×320 card grid: grey dashed "New Note" card, white doc cards with
//     title/updated/tag-chips head over a content-preview body.
//   · editor: white sheet card (r12) floating on the canvas.
// All operations preserved: create (page/template/folder), rename, duplicate,
// favorite, move-to-folder, share link, archive/restore, delete. Autosaved.
import { useEffect, useRef, useState } from 'react';
import { FileText, Repeat, Plus, Trash2, Hash, Tag, X, Ellipsis, EllipsisVertical, Star, Undo2, ArrowUp, ChevronRight, ChevronDown, Folder as FolderIcon, Cards, ShareNetwork, Link as LinkIcon, Layout, Upload, History, Search, PanelLeft, Filter, ArrowLeft, ArrowRight, Smile, Image, MessageCircle, Pencil, Grid2x2, Rows3 } from "@/components/ds/icons";
import { Icon, IconButton, SegmentedControl, MenuPanel, MenuItem, MenuLabel, MenuSeparator } from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import { addFolder, addPage, updatePage, deletePage, movePages, setPageFavorite, archivePage, duplicatePage } from '@/lib/actions/library';
import { attachCollectionToPage } from '@/lib/actions/collections';
import { BlockEditor } from '@/components/documents/block-editor';
import { CoverPicker } from '@/components/documents/cover-picker';
import { PropertyList, type DocProp } from '@/components/documents/doc-properties';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { DatabasePage } from '@/components/documents/database-view';
import type { Collection, DbRow } from '@/lib/collections';
import { PageIcon } from '@/components/ui/page-icon';
import { type Block, type BlockType, toBlocks, serialize } from '@/lib/blocks';
import { coverCss, isImageCover, randomCover } from '@/lib/covers';
import { paletteFor } from '@/lib/palette';

export type Folder = { id: string; name: string; parent_folder_id: string | null; sort_order: number; created_at?: string };
export type Page = { id: string; folder_id: string | null; parent_id?: string | null; title: string | null; type: string; content: Record<string, unknown> | unknown[]; tags: string[]; updated_at: string; created_at?: string; sort_index?: number; is_pinned?: boolean; is_favorite?: boolean; archived_at?: string | null; icon?: string | null; client_visible?: boolean };

type View = { kind: 'draft' | 'all' | 'shared' | 'templates' | 'trash' } | { kind: 'folder'; id: string };

// Document extras (redesign): stored inside the page content JSON next to blocks.
// `cover` is a gradient id from lib/covers or an uploaded image data-URL;
// `coverPos` is the vertical crop position (0–100) for image covers.
export type { DocProp } from '@/components/documents/doc-properties';
export type DocComment = { id: string; text: string; at: string };
export type DocMeta = { cover?: string; coverPos?: number; props?: DocProp[]; comments?: DocComment[] };

const typeIcon = (t: string) => (t === 'review' ? Repeat : t === 'template' ? Layout : FileText);
// Tag chip glyph colors — stable per tag name.

function ago(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 604800) return Math.floor(d / 86400) + 'd ago';
  const months = Math.floor(d / 2592000);
  if (months >= 1) return months + ' month' + (months === 1 ? '' : 's') + ' ago';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
// Card preview: the first content lines, uniform and quiet (per HiFi).
function previewLines(content: Page['content']): string[] {
  return toBlocks(content).filter((b) => b.text.trim() && b.type !== 'code').slice(0, 9).map((b) => b.text);
}

export function DocumentsView({ initialFolders, initialPages, initialPageId = null, spaceName = 'Documents', userInitial = 'U', userName = 'You' }: { initialFolders: Folder[]; initialPages: Page[]; initialPageId?: string | null; spaceName?: string; userInitial?: string; userName?: string }) {
  const [folders, setFolders] = useState(initialFolders);
  const [pages, setPages] = useState(initialPages);
  useEffect(() => { setFolders(initialFolders); }, [initialFolders]);
  useEffect(() => { setPages(initialPages); }, [initialPages]);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialPageId && initialPages.some((p) => p.id === initialPageId) ? initialPageId : null,
  );
  const [view, setView] = useState<View>({ kind: 'draft' });
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
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toolMenu, setToolMenu] = useState(false);
  const [gridView, setGridView] = useState<'grid' | 'list'>('grid');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [flash, setFlash] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);
  const skipSaveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [docMenu, setDocMenu] = useState(false);
  const note = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2000); };

  // Document extras (redesign) — cover, properties, resources. They ride along
  // inside the page's content JSON next to `blocks`, so no schema change is
  // needed and older docs simply have none.
  const [docMeta, setDocMeta] = useState<DocMeta>({});
  const readMeta = (content: Page['content']): DocMeta => {
    const o = (content && typeof content === 'object' && !Array.isArray(content) ? content : {}) as Record<string, unknown>;
    return {
      cover: typeof o.cover === 'string' ? o.cover : undefined,
      coverPos: typeof o.coverPos === 'number' ? o.coverPos : undefined,
      props: Array.isArray(o.props)
        ? (o.props as Partial<DocProp>[])
            .filter((p): p is DocProp => !!p && typeof p.id === 'string')
            .map((p) => ({ ...p, name: p.name ?? '', type: p.type ?? 'text' }))
        : undefined,
      comments: Array.isArray(o.comments) ? (o.comments as DocComment[]).filter((c) => c && typeof c.text === 'string') : undefined,
    };
  };
  const [iconPicker, setIconPicker] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  // load draft when the selected page changes
  useEffect(() => {
    if (selectedId && selectedId !== loadedRef.current) {
      const p = pages.find((x) => x.id === selectedId);
      if (p) {
        setTitle(p.title ?? ''); setBlocks(toBlocks(p.content)); setTags(p.tags ?? []); setDocMeta(readMeta(p.content));
        setCommentOpen(false); setIconPicker(false);
        loadedRef.current = selectedId; skipSaveRef.current = true; setSave('idle');
      }
    }
  }, [selectedId, pages]);

  // autosave (debounced) — skips the post-load run and unsaved temp rows
  useEffect(() => {
    if (loadedRef.current !== selectedId || !selectedId || selectedId.startsWith('tmp-')) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    setSave('saving');
    const id = selectedId;
    const t = setTimeout(async () => {
      // Persist the title exactly as typed — empty stays empty (Notion-style),
      // so the editor keeps showing the light "New page" placeholder instead of a
      // hard "Untitled" value. Lists fall back to "Untitled" only for display.
      const nextTitle = title.trim();
      const content = { ...serialize(blocks), ...(docMeta.cover ? { cover: docMeta.cover } : {}), ...(docMeta.cover && docMeta.coverPos != null ? { coverPos: docMeta.coverPos } : {}), ...(docMeta.props?.length ? { props: docMeta.props } : {}), ...(docMeta.comments?.length ? { comments: docMeta.comments } : {}) };
      const res = await updatePage(id, { title: nextTitle, content, tags });
      if (res && 'error' in res) { setSave('error'); return; }
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, title: nextTitle, content, tags, updated_at: new Date().toISOString() } : p)));
      setSave('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [title, blocks, tags, docMeta, selectedId]);

  async function newPage(folderId: string | null = null, type: 'note' | 'template' | 'database' = 'note') {
    const tmp = 'tmp-' + Date.now();
    setPages((ps) => [{ id: tmp, folder_id: folderId, title: '', type, content: { blocks: [] }, tags: [], updated_at: new Date().toISOString() }, ...ps]);
    setSelectedId(tmp);
    const res = await addPage({ folderId, type });
    if ('id' in res) {
      setPages((ps) => ps.map((p) => (p.id === tmp ? { ...p, id: res.id } : p)));
      setSelectedId((cur) => (cur === tmp ? res.id : cur));
      if (loadedRef.current === tmp) loadedRef.current = res.id;
    } else {
      setPages((ps) => ps.filter((p) => p.id !== tmp));
    }
  }

  // "Turn into page" on an inline database: create a database page, hand the
  // collection to it, and open it. The inline block stays behind as a linked
  // view of the now-page-owned database (Notion's replacement behavior).
  async function expandCollection(colId: string) {
    const res = await addPage({ folderId: currentFolderId, type: 'database' });
    if (!('id' in res)) return;
    const att = await attachCollectionToPage(colId, res.id);
    if ('error' in att) { await deletePage(res.id); return; }
    const title = att.name?.trim() || 'Untitled';
    if (title !== 'Untitled') updatePage(res.id, { title });
    setPages((ps) => [{ id: res.id, folder_id: currentFolderId, title, type: 'database', content: { blocks: [] }, tags: [], updated_at: new Date().toISOString() }, ...ps]);
    setSelectedId(res.id);
  }

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');
  async function createFolder() {
    const n = folderDraft.trim(); if (!n) { setCreatingFolder(false); return; }
    const parent = view.kind === 'folder' ? view.id : null;
    setFolderDraft(''); setCreatingFolder(false);
    const tmp = 'tmp-' + Date.now();
    setFolders((f) => [...f, { id: tmp, name: n, parent_folder_id: parent, sort_order: f.length, created_at: new Date().toISOString() }]);
    const res = await addFolder(n, parent);
    if ('id' in res) setFolders((f) => f.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else setFolders((f) => f.filter((x) => x.id !== tmp));
  }

  async function removePage(id: string) {
    setPages((ps) => ps.filter((p) => p.id !== id));
    if (selectedId === id) { loadedRef.current = null; setSelectedId(null); }
    if (!id.startsWith('tmp-')) await deletePage(id);
  }

  function addTag() {
    const t = tagDraft.trim().replace(/^#/, ''); if (!t || tags.includes(t)) { setTagDraft(''); return; }
    setTags((ts) => [...ts, t]); setTagDraft('');
  }

  // ── Page operations (optimistic) ──
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const patchPage = (id: string, patch: Partial<Page>) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  async function fav(id: string, v: boolean) { patchPage(id, { is_favorite: v }); const r = await setPageFavorite(id, v); if ('error' in r) patchPage(id, { is_favorite: !v }); }
  async function archive(id: string, v: boolean) {
    patchPage(id, { archived_at: v ? new Date().toISOString() : null });
    if (v && selectedId === id) { loadedRef.current = null; setSelectedId(null); }
    const r = await archivePage(id, v); if ('error' in r) patchPage(id, { archived_at: v ? null : new Date().toISOString() });
  }
  async function renameTo(id: string, title: string) {
    const t = title.trim() || 'Untitled'; patchPage(id, { title: t }); setRenamingId(null);
    await updatePage(id, { title: t });
  }
  async function dup(id: string) {
    const src = pages.find((p) => p.id === id); if (!src) return;
    setMenuFor(null);
    const res = await duplicatePage(id);
    if ('id' in res) {
      const copy: Page = { ...src, id: res.id, title: `${src.title?.trim() || 'Untitled'} copy`, updated_at: new Date().toISOString(), is_pinned: false, is_favorite: false };
      setPages((ps) => { const i = ps.findIndex((p) => p.id === id); return [...ps.slice(0, i + 1), copy, ...ps.slice(i + 1)]; });
      setSelectedId(res.id);
    }
  }
  async function moveTo(id: string, folderId: string | null) {
    setMenuFor(null);
    patchPage(id, { folder_id: folderId });
    if (!id.startsWith('tmp-')) await movePages([{ id, folderId, sortIndex: 0 }]);
  }
  function share(id: string) {
    const url = `${window.location.origin}/documents?page=${id}`;
    navigator.clipboard?.writeText(url).then(() => note('Link copied')).catch(() => note(url));
  }

  const selected = pages.find((p) => p.id === selectedId) ?? null;
  const live = pages.filter((p) => !p.archived_at);
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
    return live; // all
  }
  const allTags = [...new Set(live.flatMap((p) => p.tags ?? []))].sort();
  const query = q.trim().toLowerCase();
  const sortedPages = [...gridPages()]
    .filter((p) => !tagFilter || (p.tags ?? []).includes(tagFilter))
    .filter((p) => !query || (p.title ?? '').toLowerCase().includes(query) || (p.tags ?? []).some((t) => t.toLowerCase().includes(query)))
    .sort((a, b) => Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false) || b.updated_at.localeCompare(a.updated_at));

  const openView = (v: View) => { setSelectedId(null); loadedRef.current = null; setView(v); };
  const currentFolderId = view.kind === 'folder' ? view.id : null;
  const selFolder = selected ? folderById(selected.folder_id ?? null) : null;

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
    <div style={{ display: 'flex', height: '100%', animation: 'fadein 220ms' }}>
      {/* ── Rail — 230px, rows 34px/r6, per the redesign ── */}
      {!railHidden && (
      <div style={{ width: 230, borderRight: '1px solid var(--line)', background: 'var(--paper)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top icon row: collapse rail · search · new page */}
        <div className="flex h-11 shrink-0 items-center px-3">
          <IconButton size="sm" label="Hide sidebar" icon={<Icon icon={PanelLeft} size={16} />} onClick={() => setRailHidden(true)} />
          <div className="flex-1" />
          <IconButton size="sm" label="Search documents" selected={searching} aria-expanded={searching} icon={<Icon icon={Search} size={16} />} onClick={() => { setSearching((v) => !v); if (searching) setQ(''); }} />
          <IconButton size="sm" label="New page" icon={<Icon icon={Plus} size={16} />} onClick={() => newPage(currentFolderId, view.kind === 'templates' ? 'template' : 'note')} />
        </div>
        {searching && (
          <div style={{ padding: '0 12px 8px' }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setSearching(false); } }} placeholder="Search…" autoComplete="off" data-1p-ignore data-lpignore="true"
              className="doc-search"
              style={{ width: '100%', height: 28, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', outline: 'none', background: 'var(--paper-2)', fontSize: 'var(--text-small-size)', padding: '0 8px', color: 'var(--ink)' }} />
          </div>
        )}
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RailItem icon={FileText} label="Draft" on={!selected && view.kind === 'draft'} onClick={() => openView({ kind: 'draft' })} />
          <RailItem icon={Cards} label="All Projects" on={!selected && view.kind === 'all'} onClick={() => openView({ kind: 'all' })} />
          <RailItem icon={ShareNetwork} label="Shared" on={!selected && view.kind === 'shared'} onClick={() => openView({ kind: 'shared' })} />
          <RailItem icon={Layout} label="Templates" on={!selected && view.kind === 'templates'} onClick={() => openView({ kind: 'templates' })} />
        </div>

        {/* Collapsible Folders section */}
        <div style={{ padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', height: 32 }}>
            <button onClick={() => setFoldersOpen((v) => !v)} aria-expanded={foldersOpen} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, height: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <Icon icon={foldersOpen ? ChevronDown : ChevronRight} size={12} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--text-secondary)' }}>Folders</span>
            </button>
            <button onClick={() => { setFoldersOpen(true); setCreatingFolder((c) => !c); }} title="New folder" aria-label="New folder" style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 'var(--r-xs)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Icon icon={Plus} size={14} />
            </button>
          </div>
          {foldersOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 5 }}>
              {creatingFolder && (
                <input autoFocus autoComplete="off" data-1p-ignore data-lpignore="true" value={folderDraft} onChange={(e) => setFolderDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setCreatingFolder(false); }} onBlur={createFolder} placeholder="Folder name" style={{ border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', outline: 'none', background: 'var(--paper-2)', fontSize: 'var(--text-small-size)', padding: '6px 8px', color: 'var(--ink)' }} />
              )}
              {renderFolders(null, 0)}
              {folders.length === 0 && !creatingFolder && (
                <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', padding: '2px 8px' }}>No folders yet</div>
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
            {/* Doc topbar — redesign: ← → nav · quiet doc crumb · right cluster */}
            <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-1.5 bg-paper px-3">
              <IconButton size="sm" label="Back" icon={<Icon icon={ArrowLeft} size={16} />} onClick={() => { setSelectedId(null); loadedRef.current = null; }} />
              <IconButton size="sm" label="Forward" disabled icon={<Icon icon={ArrowRight} size={16} />} />
              {selFolder && (
                <button onClick={() => openView({ kind: 'folder', id: selFolder.id })} className="zb-press inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-caption text-ink-500">
                  <Icon icon={FolderIcon} size={12} /> {selFolder.name} <Icon icon={ChevronDown} size={12} style={{ transform: 'rotate(-90deg)' }} />
                </button>
              )}
              <span className="inline-flex min-w-0 max-w-[280px] items-center gap-1.5 text-caption text-ink-500">
                {selected.icon ? <PageIcon icon={selected.icon} size={12} /> : <Icon icon={typeIcon(selected.type)} size={12} className="shrink-0" />}
                <span className="truncate">{selected.title || 'New page'}</span>
              </span>
              <div className="flex-1" />
              {flash && <span className="mr-1 text-meta text-[var(--accent)]">{flash}</span>}
              <span className={cn('inline-flex h-8 cursor-default items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-body', save === 'error' ? 'text-danger-600' : 'text-ink-500')}>
                <Icon icon={History} size={16} className="text-ink-500" />
                {save === 'saving' ? 'Saving…' : save === 'error' ? 'Save failed — retrying' : `Edited ${ago(selected.updated_at)}`}
              </span>
              <button onClick={() => share(selected.id)} title="Share" className="zb-press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-body text-ink-600">
                <Icon icon={Upload} size={16} /> Share <Icon icon={ChevronDown} size={12} className="text-ink-600" />
              </button>
              <IconButton size="md" label="Copy link" icon={<Icon icon={LinkIcon} size={16} />} onClick={() => share(selected.id)} />
              {/* Favorite = a single star that fills in when saved (Notion/Linear
                  convention) — matches the doc rows + context menu, which already
                  use the star. Outline when not saved, accent-filled when saved. */}
              <IconButton size="md" label={selected.is_favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!selected.is_favorite} className={selected.is_favorite ? 'text-[var(--accent)]' : undefined} icon={<Icon icon={Star} size={16} weight={selected.is_favorite ? 'fill' : 'regular'} />} onClick={() => fav(selected.id, !selected.is_favorite)} />
              <div className="relative">
                <IconButton size="md" label="More actions" selected={docMenu} icon={<Icon icon={EllipsisVertical} size={16} weight="bold" />} onClick={() => setDocMenu((v) => !v)} />
                {docMenu && (
                  <DocContextMenu p={selected} folders={folders} userName={userName} pos={{ top: 38, right: 0 }}
                    onClose={() => setDocMenu(false)}
                    onOpenTab={() => window.open(`/documents?page=${selected.id}`, '_blank', 'noopener')}
                    onCopyLink={() => share(selected.id)}
                    onFav={() => fav(selected.id, !selected.is_favorite)}
                    onDup={() => dup(selected.id)}
                    onMove={(fid) => moveTo(selected.id, fid)}
                    onDelete={() => archive(selected.id, true)}
                  />
                )}
              </div>
            </div>

            {/* Scroller — the redesign's white sheet fills the whole doc region
                (paper-2, 60px top / 820px column). TOC + counter sit outside it. */}
            <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--paper-2)' }}>
                {/* Cover — fixed height, full-bleed across the document container */}
                {docMeta.cover && (
                  <DocCover
                    cover={docMeta.cover} pos={docMeta.coverPos}
                    onCover={(c) => setDocMeta((m) => ({ ...m, cover: c, coverPos: c && isImageCover(c) && c === m.cover ? m.coverPos : undefined }))}
                    onPos={(p) => setDocMeta((m) => ({ ...m, coverPos: p }))}
                  />
                )}
            {/* 56px side padding reserves the block-control gutter (44px) left of
                the writing column, so handles never clip or shift the text. */}
            <div ref={sheetRef} style={{ width: '100%', maxWidth: 868, margin: '0 auto', padding: docMeta.cover ? '24px 56px 120px' : '60px 56px 120px', flexShrink: 0 }}>
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
                  onCover={(c) => setDocMeta((m) => ({ ...m, cover: c, coverPos: undefined }))}
                  onComment={() => setCommentOpen(true)}
                />
                {/* Title — redesign: 24/500, quiet placeholder */}
                <input ref={titleRef} value={title} autoComplete="off" data-1p-ignore data-lpignore="true" onChange={(e) => setTitle(e.target.value)} placeholder="New page"
                  className="doc-title-input"
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-display)', fontSize: 'var(--text-stat-size)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: '32px', color: 'var(--text-primary)', marginTop: 4 }} />
                {selected.type === 'database' ? (
                  /* Database page — the collection views replace the block canvas */
                  <DatabasePage pageId={selected.id}
                    demoDb={(selected.content as { demoDb?: { collection: Collection; rows: DbRow[] } })?.demoDb} />
                ) : (
                  <>
                {/* Properties + Resources (redesign) */}
                <DocProps meta={docMeta} onChange={setDocMeta} page={selected} userName={userName} />
                {/* Comments (redesign "Add comment" flow) */}
                <DocComments
                  comments={docMeta.comments ?? []} composerOpen={commentOpen} initial={userInitial}
                  onPost={(t) => setDocMeta((m) => ({ ...m, comments: [...(m.comments ?? []), { id: 'c' + Date.now(), text: t, at: new Date().toISOString() }] }))}
                  onRemove={(id) => setDocMeta((m) => ({ ...m, comments: (m.comments ?? []).filter((c) => c.id !== id) }))}
                  onCloseComposer={() => setCommentOpen(false)}
                />
                {/* Tags (existing feature — quiet row under resources) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {tags.map((t) => { const c = paletteFor(t); return (
                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption-size)', color: c.text, background: c.bg, borderRadius: 'var(--r-xs)', padding: '4px 4px 4px 6px', lineHeight: 1 }}>
                      <Icon icon={Hash} size={12} weight="bold" style={{ color: c.dot }} />{t}
                      <button onClick={() => setTags((ts) => ts.filter((x) => x !== t))} aria-label={`remove ${t}`} style={{ display: 'grid', placeItems: 'center', width: 14, height: 14, borderRadius: '50%', border: 'none', background: 'transparent', color: c.text, opacity: 0.7, cursor: 'pointer' }}><Icon icon={X} size={12} /></button>
                    </span>
                  ); })}
                  <input value={tagDraft} autoComplete="off" data-1p-ignore data-lpignore="true" onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="add tag…" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', width: 90, padding: 0 }} />
                </div>
                {/* Divider between the property zone and the block canvas */}
                <div style={{ height: 1, background: 'var(--line-2)', margin: '24px 0 18px' }} />
                <BlockEditor blocks={blocks} onChange={setBlocks} onCreateDatabasePage={() => newPage(currentFolderId, 'database')} onExpandCollection={expandCollection} />
                  </>
                )}
            </div>
            </div>
            {selected.type !== 'database' && (
              <>
                {/* Floating table-of-contents indicator (right, per HiFi) */}
                <DocToc blocks={blocks} scrollRef={scrollRef} />
                {/* Live counter pill — floats at the bottom edge of the open document */}
                <DocStats blocks={blocks} title={title} />
              </>
            )}
          </>
        ) : (
          <>
            {/* Grid toolbar — right-aligned Filter ⌄ + ⋮ (per the redesign). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 5, flexShrink: 0 }}>
              {railHidden && (
                <IconButton size="sm" label="Show sidebar" icon={<Icon icon={PanelLeft} size={16} />} onClick={() => setRailHidden(false)} />
              )}
              {view.kind === 'trash' && <span style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', padding: '4px 2px' }}>Trash</span>}
              {view.kind === 'folder' && <span style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', padding: '4px 2px' }}>{folderById(view.id)?.name}</span>}
              <div style={{ flex: 1 }} />
              {flash && <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--accent-text)', paddingRight: 4 }}>{flash}</span>}
              {/* View toggle — grid / list segmented control (per the home HiFi) */}
              <SegmentedControl
                aria-label="View layout"
                value={gridView}
                onValueChange={(v) => setGridView(v as 'grid' | 'list')}
                options={[
                  { value: 'grid', 'aria-label': 'Grid view', label: <Icon icon={Grid2x2} size={16} /> },
                  { value: 'list', 'aria-label': 'List view', label: <Icon icon={Rows3} size={16} /> },
                ]}
              />
              <div style={{ position: 'relative' }}>
                <button onClick={() => { setFilterOpen((v) => !v); setToolMenu(false); }} aria-haspopup="menu" aria-expanded={filterOpen} className="zb-press"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', borderRadius: 'var(--r-sm)', border: 'none', background: filterOpen || tagFilter ? 'var(--hover)' : 'transparent', color: 'var(--ink-2)', fontSize: 'var(--text-body-size)', cursor: 'pointer' }}>
                  <Icon icon={Filter} size={16} /> {tagFilter ? `Filter: ${tagFilter}` : 'Filter'} <Icon icon={ChevronDown} size={12} style={{ color: 'var(--text-secondary)' }} />
                </button>
                {filterOpen && (
                  <MenuPanel aria-label="Filter by tag" className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[200px]">
                    <MenuLabel>Filter by tag</MenuLabel>
                    <div className="max-h-60 overflow-y-auto">
                      <MenuItem active={!tagFilter} onClick={() => { setTagFilter(null); setFilterOpen(false); }}>All documents</MenuItem>
                      {allTags.map((t) => (
                        <MenuItem key={t} active={tagFilter === t}
                          icon={<span className="size-2 shrink-0 rounded-full" style={{ background: paletteFor(t).dot }} />}
                          onClick={() => { setTagFilter(t); setFilterOpen(false); }}>{t}</MenuItem>
                      ))}
                      {allTags.length === 0 && <div className="px-2 py-1 text-caption text-ink-500">No tags yet</div>}
                    </div>
                  </MenuPanel>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <IconButton size="sm" label="More actions" selected={toolMenu} aria-haspopup="menu" aria-expanded={toolMenu} icon={<Icon icon={EllipsisVertical} size={16} weight="bold" />} onClick={() => { setToolMenu((v) => !v); setFilterOpen(false); }} />
                {toolMenu && view.kind !== 'trash' && (
                  <MenuPanel aria-label="Create" className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[200px]">
                    <MenuLabel>Create</MenuLabel>
                    {[['New page', Plus, () => newPage(currentFolderId, 'note')] as const, ['New template', Layout, () => newPage(currentFolderId, 'template')] as const, ['New folder', FolderIcon, () => { setFoldersOpen(true); setCreatingFolder(true); }] as const].map(([label, MIcon, run]) => (
                      <MenuItem key={label} icon={<Icon icon={MIcon} size={16} className="shrink-0" />}
                        onClick={() => { setToolMenu(false); run(); }}>{label}</MenuItem>
                    ))}
                  </MenuPanel>
                )}
              </div>
            </div>

            {/* Card grid / list — recessed well surface (per the home HiFi):
                grid = 220×280 cards (gap 20); list = full-width rows. */}
            <div style={{ flex: 1, background: 'var(--well)', padding: '12px 12px 80px' }}>
              <div style={gridView === 'grid'
                ? { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', gap: 20 }
                : { display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 960, margin: '0 auto' }}>
                {view.kind !== 'trash' && (
                  gridView === 'grid' ? (
                    <button onClick={() => newPage(currentFolderId, view.kind === 'templates' ? 'template' : 'note')} className="zb-press doc-newnote"
                      style={{ width: 220, height: 280, borderRadius: 'var(--r-lg)', border: '1px dashed var(--line-3)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <Icon icon={FileText} size={16} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 'var(--text-body-lg-size)', fontWeight: 500, letterSpacing: '-0.02em' }}>New Note</span>
                    </button>
                  ) : (
                    <button onClick={() => newPage(currentFolderId, view.kind === 'templates' ? 'template' : 'note')} className="zb-press doc-newnote"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 40, borderRadius: 'var(--r-md)', border: '1px dashed var(--line-3)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 12px' }}>
                      <Icon icon={Plus} size={16} /> <span style={{ fontSize: 'var(--text-body-size)', fontWeight: 500 }}>New Note</span>
                    </button>
                  )
                )}
                {sortedPages.map((p) => (
                  <DocCard key={p.id} p={p} layout={gridView} trash={view.kind === 'trash'} folders={folders} userName={userName}
                    renaming={renamingId === p.id}
                    menuOpen={menuFor === p.id}
                    onOpen={() => { if (view.kind !== 'trash') setSelectedId(p.id); }}
                    onMenu={() => setMenuFor(menuFor === p.id ? null : p.id)}
                    onCloseMenu={() => setMenuFor(null)}
                    onRename={() => { setMenuFor(null); setRenamingId(p.id); }}
                    onRenameTo={(t) => renameTo(p.id, t)} onCancelRename={() => setRenamingId(null)}
                    onDup={() => dup(p.id)} onFav={() => { fav(p.id, !p.is_favorite); setMenuFor(null); }}
                    onShare={() => { setMenuFor(null); share(p.id); }}
                    onMove={(fid) => moveTo(p.id, fid)}
                    onArchive={() => { archive(p.id, true); setMenuFor(null); }}
                    onRestore={() => archive(p.id, false)}
                    onDelete={() => { setMenuFor(null); removePage(p.id); }}
                  />
                ))}
                {sortedPages.length === 0 && (
                  <div style={{ width: '100%', textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)' }}>
                    {view.kind === 'trash' ? 'Trash is empty.' : view.kind === 'shared' ? 'Nothing shared yet.' : null}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`
        .doc-card:hover{box-shadow:var(--shadow-crisp)}
        /* Ghost page controls (Add icon · Add cover · Add comment): full pill
           surface — icon + label react together, layout never shifts. */
        .doc-ghost{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border:none;background:transparent;border-radius:var(--r-sm);font-size:12px;font-weight:500;color:var(--disabled-text);cursor:pointer;transition:background var(--dur-fast) var(--ease),color var(--dur-fast) var(--ease)}
        .doc-ghost:hover{background:var(--hover);color:var(--text-secondary)}
        /* Property value cells highlight as whole surfaces (Notion). */
        .prop-cell{border-radius:var(--r-sm);transition:background var(--dur-fast) var(--ease)}
        .prop-cell:hover{background:var(--hover)}
        /* Search field: quiet at rest, soft wash on hover, ring on focus. */
        .doc-search{transition:background var(--dur-fast) var(--ease),box-shadow var(--dur-fast) var(--ease)}
        .doc-search:hover{background:var(--paper-3) !important}
        .doc-search:focus{box-shadow:0 0 0 2px var(--accent-border)}
        /* Hover pill (pencil | ⋮): hidden by default, fades in on card hover and
           stays visible while its menu is open. */
        .doc-cardmenu{opacity:0;transition:opacity var(--dur-fast) var(--ease)}
        .doc-card:hover .doc-cardmenu,.doc-cardmenu[data-open="true"]{opacity:1}
        @media (hover:none){.doc-cardmenu{opacity:1}}
        /* Grid card hover — uniform paper-3 wash (body is transparent) */
        .doc-card:not(.doc-listrow):hover{background:var(--paper-3)}
        .doc-listrow:hover{background:var(--paper-3)}
        /* Fluid grid cards below the fixed-column breakpoint (design is 220px) */
        @media (max-width: 560px) {
          .doc-card:not(.doc-listrow){width:100% !important;height:auto !important;min-height:200px}
          .doc-newnote{width:100% !important}
          .doc-listtags{display:none}
        }
        /* Cover: fixed height, 100% width; shorter on small screens */
        .doc-cover{height:279px} /* measured from the change-cover HiFi */
        @media (max-width: 680px){.doc-cover{height:180px}}
        .doc-cover:hover .doc-cover-actions{opacity:1 !important}
        .doc-proprow:hover .doc-prop-x{opacity:1 !important}
        .doc-title-input::placeholder{color:var(--disabled-text)}
        .prop-input::placeholder{color:var(--text-muted)}
      `}</style>
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
    <button onClick={onClick}
      className={cn('flex h-[34px] w-full cursor-pointer items-center gap-2 rounded-sm border-0 pr-2 text-left transition-colors', on ? 'bg-surface-hover' : 'bg-transparent hover:bg-surface-hover')}
      style={{ paddingLeft: 8 + indent * 16 }}>
      {/* Nav icons follow the PRIMARY sidebar: outline (regular) weight via the DS
          <Icon> seam — never fill. Fill is reserved for tiny active-state glyphs. */}
      <Icon icon={icon} size={16} weight="regular" style={{ color: iconColor, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: text, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && <span className="num" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>{count}</span>}
    </button>
  );
}

// Breadcrumb chip — icon 14 · 12px text · 4px 10px · r8 (per HiFi).
function Chip({ icon, label, caret, muted, onClick }: { icon?: typeof FileText; label: string; caret?: boolean; muted?: boolean; onClick?: () => void }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--r-md)', fontSize: 'var(--text-caption-size)', lineHeight: '16px', color: muted ? 'var(--text-secondary)' : 'var(--ink)', fontWeight: muted ? 400 : 500, maxWidth: 240 };
  const inner = (
    <>
      {icon && <Icon icon={icon} size={14} weight={muted ? 'regular' : 'fill'} style={{ color: muted ? 'var(--text-secondary)' : 'var(--ink-2)', flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {caret && <Icon icon={ChevronDown} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
    </>
  );
  if (!onClick) return <span style={base}>{inner}</span>;
  return <button onClick={onClick} className="zb-press" style={{ ...base, border: 'none', background: 'transparent', cursor: 'pointer' }}>{inner}</button>;
}

// Tag chips (redesign): white pill · tag glyph in the palette color · 10px text.
function TagChips({ tags, max }: { tags: string[]; max: number }) {
  if (!tags.length) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      {tags.slice(0, max).map((t) => { const c = paletteFor(t); return (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 5px', borderRadius: 'var(--r-xs)', background: 'var(--paper-2)', boxShadow: 'inset 0 0 0 1px var(--line-2)', fontSize: 'var(--text-micro-size)', lineHeight: 1, color: 'color-mix(in srgb, var(--ink) 72%, transparent)', whiteSpace: 'nowrap' }}>
          <Icon icon={Tag} size={12} weight="fill" style={{ color: c.dot, flexShrink: 0 }} />{t}
        </span>
      ); })}
    </span>
  );
}

// Doc card — grid (220×280, paper-3 head over preview body) or list (full-width
// row). Hover reveals a grouped pencil (rename) + ⋮ (menu) control; the menu is
// the sectioned DocContextMenu. Per the home + popup HiFi.
function DocCard({ p, layout, trash, folders, userName, renaming, menuOpen, onOpen, onMenu, onCloseMenu, onRename, onRenameTo, onCancelRename, onDup, onFav, onShare, onMove, onArchive, onRestore, onDelete }: {
  p: Page; layout: 'grid' | 'list'; trash: boolean; folders: Folder[]; userName: string; renaming: boolean; menuOpen: boolean;
  onOpen: () => void; onMenu: () => void; onCloseMenu: () => void; onRename: () => void; onRenameTo: (t: string) => void; onCancelRename: () => void;
  onDup: () => void; onFav: () => void; onShare: () => void; onMove: (fid: string | null) => void; onArchive: () => void; onRestore: () => void; onDelete: () => void;
}) {
  const lines = previewLines(p.content);
  const titleInput = (
    <input autoFocus defaultValue={p.title ?? ''} autoComplete="off" data-1p-ignore data-lpignore="true"
      onKeyDown={(e) => { if (e.key === 'Enter') onRenameTo((e.target as HTMLInputElement).value); if (e.key === 'Escape') onCancelRename(); }}
      onClick={(e) => e.stopPropagation()} onBlur={(e) => onRenameTo(e.target.value)}
      style={{ flex: 1, minWidth: 0, border: '1px solid var(--accent-border)', borderRadius: 'var(--r-xs)', outline: 'none', background: 'var(--paper-2)', fontSize: 'var(--text-body-size)', padding: '3px 6px', color: 'var(--ink)' }} />
  );
  // Hover control cluster (grouped pencil + menu), or trash restore/delete.
  const actions = trash ? (
    <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
      <button onClick={(e) => { e.stopPropagation(); onRestore(); }} title="Restore" aria-label="Restore" style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={Undo2} size={14} /></button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete forever" aria-label="Delete forever" style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red-text)' }}><Icon icon={Trash2} size={14} /></button>
    </span>
  ) : (
    // Grouped control: pencil | ⋮ with a hairline between (per the hover HiFi).
    // Visibility is driven purely by CSS (.doc-card:hover / [data-open]) — an inline
    // opacity would out-specify the hover rule and the pill would never appear.
    <span className="doc-cardmenu" data-open={menuOpen ? 'true' : undefined} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 'var(--r-sm)', background: 'var(--paper-2)', boxShadow: '0 0 0 1px var(--line-2), var(--shadow-sm)', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <button onClick={(e) => { e.stopPropagation(); onRename(); }} title="Rename" aria-label="Rename" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 30, height: 26, borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={Pencil} size={14} /></button>
      <span aria-hidden style={{ width: 1, height: 18, background: 'var(--line)', flexShrink: 0 }} />
      <button onClick={(e) => { e.stopPropagation(); onMenu(); }} title="More" aria-label="Page menu" className="zb-press" style={{ display: 'grid', placeItems: 'center', width: 30, height: 26, borderRadius: 0, border: 'none', background: menuOpen ? 'var(--hover)' : 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={Ellipsis} size={16} weight="bold" /></button>
    </span>
  );
  const menu = menuOpen && (
    <DocContextMenu p={p} folders={folders} userName={userName} pos={{ top: 34, right: 4 }} onClose={onCloseMenu}
      onOpenTab={() => window.open(`/documents?page=${p.id}`, '_blank', 'noopener')}
      onCopyLink={onShare} onFav={onFav} onDup={onDup} onMove={onMove} onDelete={onArchive} />
  );

  // ── List row ──
  if (layout === 'list') {
    return (
      <div className="doc-card doc-listrow" onClick={trash ? undefined : onOpen} style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 8px 0 12px', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', transition: 'box-shadow 140ms', cursor: trash ? 'default' : 'pointer' }}>
        {p.icon ? <PageIcon icon={p.icon} size={16} /> : <Icon icon={typeIcon(p.type)} size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        {renaming ? titleInput : (
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} title={p.title || 'Untitled'} style={{ flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none', cursor: trash ? 'default' : 'pointer', textAlign: 'left', fontSize: 'var(--text-body-size)', fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Untitled'}</button>
        )}
        {p.is_favorite && <Icon icon={Star} size={12} weight="fill" style={{ color: 'var(--accent-text)', flexShrink: 0 }} />}
        <span className="doc-listtags" style={{ flexShrink: 0 }}><TagChips tags={p.tags ?? []} max={2} /></span>
        <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', width: 92, textAlign: 'right' }}>{ago(p.updated_at)}</span>
        {actions}
        {menu}
      </div>
    );
  }

  // ── Grid card ──
  // The whole card opens the doc; the pencil/menu/rename stop propagation so
  // their own actions fire instead.
  return (
    <div className="doc-card" onClick={trash ? undefined : onOpen} style={{ position: 'relative', width: 220, height: 280, borderRadius: 'var(--r-lg)', background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', overflow: 'visible', transition: 'box-shadow 140ms', cursor: trash ? 'default' : 'pointer' }}>
      {/* Head — paper-3 strip, 1px hairline to the body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--paper-3)', borderRadius: '12px 12px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {renaming ? titleInput : (
              <button onClick={(e) => { e.stopPropagation(); onOpen(); }} title={p.title || 'Untitled'} style={{ minWidth: 0, padding: 0, background: 'transparent', border: 'none', cursor: trash ? 'default' : 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                {p.icon && <PageIcon icon={p.icon} size={15} />}
                <span style={{ minWidth: 0, fontSize: 'var(--text-body-size)', fontWeight: 500, lineHeight: '18px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Untitled'}</span>
              </button>
            )}
            <span style={{ fontSize: 'var(--text-caption-size)', lineHeight: '16px', color: 'var(--text-muted)' }}>Updated {ago(p.updated_at)}</span>
          </div>
          {p.is_favorite && <Icon icon={Star} size={12} weight="fill" style={{ color: 'var(--accent-text)', flexShrink: 0, marginTop: 2 }} />}
          {actions}
        </div>
        <TagChips tags={p.tags ?? []} max={3} />
      </div>
      {/* Body — quiet content preview on the paper-2 sheet (card handles click) */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', padding: 12, overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
        {lines.length ? lines.map((l, i) => (
          <span key={i} style={{ display: 'block', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', lineHeight: '17px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</span>
        )) : (
          <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>Empty page</span>
        )}
      </div>
      {menu}
    </div>
  );
}

// Document context menu (redesign): a 200px sectioned sheet — text-only rows,
// full-width hairlines between sections, Delete in red, and a "last edited"
// footer. Per the popup HiFi.
//   [Open in New Tab] | [Copy Link] | [Star · Duplicate · Move to +] | [Delete] · footer
function DocContextMenu({ p, folders, userName, pos, onClose, onOpenTab, onCopyLink, onFav, onDup, onMove, onDelete }: {
  p: Page; folders: Folder[]; userName: string; pos: { top: number; right?: number; left?: number };
  onClose: () => void; onOpenTab: () => void; onCopyLink: () => void; onFav: () => void; onDup: () => void; onMove: (fid: string | null) => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [onClose]);
  const editedAt = (() => {
    try { return new Date(p.updated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return ago(p.updated_at); }
  })();
  const row = (label: string, onClick: () => void, opts?: { danger?: boolean; caret?: boolean; plus?: boolean; active?: boolean }) => (
    <MenuItem key={label} danger={opts?.danger} className={opts?.active ? 'bg-surface-hover' : undefined}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      trailing={opts?.caret ? <Icon icon={ChevronRight} size={12} className="text-ink-500" /> : opts?.plus ? <Icon icon={Plus} size={14} className="text-ink-500" /> : undefined}>
      {label}
    </MenuItem>
  );
  return (
    <MenuPanel ref={ref} aria-label="Document actions" className="absolute z-[60] w-[200px]" style={pos}>
      {row('Open in New Tab', () => { onClose(); onOpenTab(); })}
      <MenuSeparator />
      {row('Copy Link', () => { onClose(); onCopyLink(); })}
      <MenuSeparator />
      {row(p.is_favorite ? 'Unstar' : 'Star', () => { onClose(); onFav(); })}
      {row('Duplicate', () => { onClose(); onDup(); })}
      <div className="relative">
        {row('Move to', () => setMoveOpen((v) => !v), { plus: true, active: moveOpen })}
        {moveOpen && (
          <MenuPanel aria-label="Move to folder" className="absolute right-[calc(100%+4px)] top-0 max-h-[220px] w-[180px] overflow-y-auto">
            {(p.folder_id ?? null) !== null && (
              <MenuItem icon={<Icon icon={FileText} size={14} className="shrink-0" />} onMouseDown={(e) => { e.preventDefault(); onClose(); onMove(null); }}>Draft (no folder)</MenuItem>
            )}
            {folders.filter((f) => f.id !== p.folder_id).map((f) => (
              <MenuItem key={f.id} icon={<Icon icon={FolderIcon} size={14} className="shrink-0" />} onMouseDown={(e) => { e.preventDefault(); onClose(); onMove(f.id); }}>{f.name}</MenuItem>
            ))}
            {folders.length === 0 && <div className="px-2.5 py-1.5 text-caption text-ink-500">No folders</div>}
          </MenuPanel>
        )}
      </div>
      <MenuSeparator />
      {row('Delete', () => { onClose(); onDelete(); }, { danger: true })}
      {/* Footer — last-edited attribution (per the popup HiFi) */}
      <div className="-mx-2 -mb-2 mt-1 rounded-b-lg border-t border-line-soft bg-paper-3 px-3.5 pb-2.5 pt-2">
        <div className="text-micro leading-[1.4] text-ink-500">Last edited by {userName}</div>
        <div className="text-micro leading-[1.4] text-ink-500">{editedAt}</div>
      </div>
    </MenuPanel>
  );
}

// ── Redesign: ghost action row + cover picker + properties/resources ─────────
// "Add icon · Add cover · Add comment" (redesign ghost trio above the title).
// Each is a full hover surface (.doc-ghost): rounded wash, icon + label react
// together. The row is pulled left by the pill padding so text stays aligned
// with the title, and the pills never shift layout.
function GhostActions({ hasIcon, hasCover, onIcon, onCover, onComment }: {
  hasIcon: boolean; hasCover: boolean; onIcon: (icon: string) => void; onCover: (cover: string) => void; onComment: () => void;
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
      {!hasCover && (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button onClick={() => { setCoverOpen((v) => !v); setIconOpen(false); }} aria-haspopup="dialog" aria-expanded={coverOpen} className="doc-ghost">
            <Icon icon={Image} size={12} /> Add cover
          </button>
          {coverOpen && <CoverPicker onPick={onCover} onClose={() => setCoverOpen(false)} />}
        </span>
      )}
      <button onClick={onComment} className="doc-ghost">
        <Icon icon={MessageCircle} size={12} /> Add comment
      </button>
    </div>
  );
}

// Full-bleed document cover: fixed height (via .doc-cover), gradient or image.
// Hover actions bottom-right — Change (picker) · Random · Reposition (images).
// Repositioning drags the crop window; Save persists, Cancel/Esc reverts.
function DocCover({ cover, pos, onCover, onPos }: {
  cover: string; pos?: number;
  onCover: (c?: string) => void; onPos: (p?: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repos, setRepos] = useState<number | null>(null); // live position while repositioning
  const bandRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const image = isImageCover(cover);
  const shownPos = repos ?? pos ?? 50;

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
    <div ref={bandRef} className="doc-cover" onMouseDown={onRepoMouseDown}
      style={{ position: 'relative', width: '100%', flexShrink: 0, background: image ? 'var(--well)' : coverCss(cover), cursor: repos !== null ? 'ns-resize' : undefined, userSelect: repos !== null ? 'none' : undefined }}>
      {image && (
        <span aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data-URL cover */}
          <img src={cover} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${shownPos}%`, display: 'block' }} />
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
        <span className="doc-cover-actions" style={{ position: 'absolute', right: 10, top: 10, opacity: pickerOpen ? 1 : 0, transition: 'opacity var(--dur-fast) var(--ease)' }}>
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
                onClose={() => setPickerOpen(false)} />
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
function DocComments({ comments, composerOpen, initial, onPost, onRemove, onCloseComposer }: {
  comments: DocComment[]; composerOpen: boolean; initial: string;
  onPost: (text: string) => void; onRemove: (id: string) => void; onCloseComposer: () => void;
}) {
  const [draft, setDraft] = useState('');
  if (!composerOpen && comments.length === 0) return null;
  const avatar = (
    <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, flexShrink: 0, borderRadius: 'var(--r-sm)', background: 'var(--well)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)', fontWeight: 400, lineHeight: 1 }}>{initial}</span>
  );
  const post = () => { const t = draft.trim(); if (!t) return; onPost(t); setDraft(''); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
      {comments.map((c) => (
        <div key={c.id} className="doc-proprow" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
          {avatar}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <span style={{ fontSize: 'var(--text-body-size)', lineHeight: '20px', color: 'var(--ink-2)', overflowWrap: 'break-word' }}>{c.text}</span>
            <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginLeft: 8, whiteSpace: 'nowrap' }}>{ago(c.at)}</span>
          </div>
          <button onClick={() => onRemove(c.id)} aria-label="Delete comment" className="doc-prop-x" style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, marginTop: 2, borderRadius: 'var(--r-xs)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0 }}>
            <Icon icon={X} size={12} />
          </button>
        </div>
      ))}
      {composerOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px 3px 0', borderRadius: 'var(--r-sm)' }}>
          {avatar}
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') post(); if (e.key === 'Escape') { setDraft(''); onCloseComposer(); } }}
            placeholder="Add a comment…" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="doc-title-input"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-size)', lineHeight: '20px', color: 'var(--ink)', padding: 0 }} />
          {draft.trim() && (
            <button onClick={post} aria-label="Post comment"
              style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, flexShrink: 0, borderRadius: 'var(--r-full)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', cursor: 'pointer' }}>
              <Icon icon={ArrowUp} size={14} weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Properties zone under the title (Notion-style typed properties).
function DocProps({ meta, onChange, page, userName }: { meta: DocMeta; onChange: React.Dispatch<React.SetStateAction<DocMeta>>; page: Page; userName: string }) {
  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <PropertyList
        props={meta.props ?? []}
        onChange={(next) => onChange((m) => ({ ...m, props: next }))}
        ctx={{ userName, createdAt: page.created_at, updatedAt: page.updated_at, pageId: page.id }}
      />
    </div>
  );
}

// Floating table-of-contents indicator — one line per heading, active in ink,
// the rest at 31% ink (measured from the HiFi). Tracks the section nearest the
// top on scroll; clicking a line scrolls that heading into view. Fixed to the
// right margin and hidden on narrow viewports so it never overlaps the text.
function DocToc({ blocks, scrollRef }: { blocks: Block[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const heads = blocks.filter((b) => b.type === 'h1' || b.type === 'h2' || b.type === 'h3');
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
  const lineW = (t: BlockType) => (t === 'h1' ? 22 : t === 'h2' ? 16 : 11);
  const goTo = (id: string) => { const el = scrollRef.current?.querySelector(`[data-block-id="${id}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  return (
    <div onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
      style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {!expanded ? (
        heads.map((h) => {
          const on = h.id === activeId;
          return (
            <button key={h.id} title={h.text || h.type.toUpperCase()} className="doc-toc-line"
              onClick={() => goTo(h.id)}
              style={{ display: 'flex', justifyContent: 'flex-end', width: 44, padding: '6px 0', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <span style={{ display: 'block', width: on ? lineW(h.type) + 4 : lineW(h.type), height: 2, borderRadius: 2, background: on ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 31%, transparent)', transition: 'width 160ms var(--ease), background 160ms var(--ease)' }} />
            </button>
          );
        })
      ) : (
        // Hover-expanded progress panel — line glyph + section label per heading,
        // active row highlighted (DS popover language).
        <MenuPanel aria-label="Document sections" className="flex min-w-[200px] max-w-[280px] flex-col">
          {heads.map((h) => {
            const on = h.id === activeId;
            return (
              <MenuItem key={h.id} onClick={() => goTo(h.id)} className={on ? 'bg-surface-hover text-ink-900' : undefined}
                icon={<span aria-hidden className="block h-0.5 shrink-0 rounded-[2px]" style={{ width: lineW(h.type), background: on ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 31%, transparent)' }} />}>
                {h.text || h.type.toUpperCase()}
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
function DocStats({ blocks, title }: { blocks: Block[]; title: string }) {
  const text = [title, ...blocks.map((b) => b.text)].filter(Boolean).join('\n');
  const flat = text.replace(/\n/g, '');
  const characters = flat.length;
  const words = (text.match(/\S+/g) ?? []).length;
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length;
  const paragraphs = blocks.filter((b) => b.text.trim()).length;
  const spaces = (flat.match(/ /g) ?? []).length;
  const items: [number, string][] = [
    [characters, 'Characters'], [words, 'words'], [sentences, 'sentences'], [paragraphs, 'paragraphs'], [spaces, 'Spaces'],
  ];
  return (
    <div aria-label="Document statistics" style={{ position: 'absolute', bottom: 0, right: 60, zIndex: 8, display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: 'var(--well-2)', borderRadius: 'var(--r-md) var(--r-md) 0 0', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {items.map(([n, label]) => (
        <span key={label} style={{ fontSize: 'var(--text-micro-size)', lineHeight: '10px', color: 'var(--text-muted)' }}>
          <span className="num" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }}>{n}</span> {label}
        </span>
      ))}
    </div>
  );
}
