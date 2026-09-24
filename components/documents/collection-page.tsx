'use client';
// A Collection, open (COLLECTION_PLAN K4–K5; COLLECTION_ITEM_BRIEF §3–8).
//
// A Collection is its own item — a page of type `collection` — and this is what it shows: what it
// has gathered, as a masonry that arranges itself or as a canvas arranged by hand ("Grid | Canvas").
// Both draw the same items from one store (lib/collection-store.ts), so switching between them
// creates, removes and changes nothing.
//
// Collecting is quick by design (COLLECTION_VIEW_BRIEF §10–12): paste a link anywhere on the page,
// drop files onto it, or use Add. Every change is undoable (⌘Z), and a deletion says so, with Undo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoundingBox, Images, LayoutGrid, Plus, Search, Tag, X } from '@/components/ds/icons';
import { Button, EmptyState, Icon, IconButton, SegmentedControl, copyText, toast } from '@/components/ds/ui';
import type { CanvasBoxes } from '@/lib/canvas';
import {
  addItems, bringToFront, collectionView, ensureTag, fileItem, fillFromMeta, itemLinks, moveItem, placeItems, removeItems, rememberShape,
  renameItem, setItemBody, setItemTags, setSort, setView, tagItems, type CollectionSort, type CollectionView,
} from '@/lib/collection';
import { NO_FILTER, canReorder, findItems, isFiltering, type CollectionFilter } from '@/lib/collection-find';
import { itemCountLabel } from '@/lib/collection-index';
import { collectionStoreFor, useCollection, type CollectionStore } from '@/lib/collection-store';
import { collectText, parseCollectable } from '@/lib/collect';
import { isTypingTarget } from '@/lib/list-keys';
import { isTempId, mintUuid } from '@/lib/temp-id';
import type { LinkMeta } from '@/lib/unfurl';
import { uploadAttachment } from '@/lib/use-attachment';
import { useLatest } from '@/lib/use-latest';
import { palette } from '@/lib/palette';
import { OptionList } from '@/components/ui/select';
import { CollectComposer } from './collect-composer';
import { CollectionFindBar } from './collection-find-bar';
import { CollectionViewSettings } from './collection-view-settings';
import { CollectionCanvas } from './collection-canvas';
import { CollectionGrid } from './collection-grid';
import { CollectionItemPage } from './collection-item-page';
import { Pop } from './db-pop';

type Mode = 'grid' | 'canvas';

export function CollectionPage({ pageId, content, startAdding = false, onStartedAdding }: {
  pageId: string;
  content?: Record<string, unknown>;
  /** Opened from the Index's + on an empty Collection: it arrives with Add open. */
  startAdding?: boolean;
  /** Said once Add has opened for `startAdding`, so the request is not repeated the next time. */
  onStartedAdding?: () => void;
}) {
  // The harness's Collections say so: everything stays in the browser, and nothing is saved.
  const demo = content?.demoCollection === true;
  const store = useMemo(() => collectionStoreFor(pageId, content, { demo }), [pageId, content, demo]);
  const doc = useCollection(store);
  useEffect(() => () => { void store.flush(); }, [store]);

  // A presentation and a selection belong to the Collection on screen: the next one opens in its grid.
  const [surface, setSurface] = useState<{ store: CollectionStore; mode: Mode }>({ store, mode: 'grid' });
  const mode: Mode = surface.store === store ? surface.mode : 'grid';
  const [asked, setAsked] = useState<{ store: CollectionStore; query: string; filter: CollectionFilter }>({ store, query: '', filter: NO_FILTER });
  const query = asked.store === store ? asked.query : '';
  const filter = asked.store === store ? asked.filter : NO_FILTER;
  const sort: CollectionSort = doc.sort ?? 'manual';
  // How it shows itself — a setting of the Collection, saved like the order and never an undo step.
  const view = collectionView(doc);
  const changeView = (patch: CollectionView) => store.learn((d) => setView(d, patch));
  // The order is arrangement, not content: choosing one is saved, but ⌘Z never undoes a way of looking.
  const setOrder = (next: CollectionSort) => store.learn((d) => setSort(d, next));
  // The grid shows what was asked for; the canvas always shows everything, where it was put.
  const shown = useMemo(() => findItems(doc, query, filter), [doc, query, filter]);
  const narrowed = isFiltering(query, filter);
  const reorderable = canReorder(doc, query, filter);
  // Something collected must be seen: whatever was being looked for is put down when an item arrives.
  const showEverything = () => { if (narrowed) setAsked({ store, query: '', filter: NO_FILTER }); };

  const [picked, setPicked] = useState<{ store: CollectionStore; ids: string[]; anchor: string | null }>({ store, ids: [], anchor: null });
  const selected = useMemo(() => {
    if (picked.store !== store) return new Set<string>();
    const present = new Set(doc.items.map((i) => i.id));
    return new Set(picked.ids.filter((id) => present.has(id)));
  }, [picked, store, doc]);
  const select = useCallback((ids: Iterable<string>, anchor: string | null = null) => setPicked({ store, ids: [...ids], anchor }), [store]);

  const toggle = (id: string, range: boolean) => {
    const order = shown.map((i) => i.id);
    const from = range && picked.anchor ? order.indexOf(picked.anchor) : -1;
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      select(new Set([...selected, ...order.slice(lo, hi + 1)]), picked.anchor);
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    select(next, id);
  };

  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = openId ? doc.items.find((i) => i.id === openId) ?? null : null;
  const [addOpen, setAddOpen] = useState(startAdding);
  // The Index asked for Add, and it is open: the request is spent.
  useEffect(() => { if (startAdding) onStartedAdding?.(); }, [startAdding, onStartedAdding]);
  const [tagOpen, setTagOpen] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const learn = useCallback((id: string, url: string, meta: LinkMeta | null) => store.learn((d) => fillFromMeta(d, id, url, meta)), [store]);
  const learnShape = useCallback((id: string, shape: number) => store.learn((d) => rememberShape(d, id, shape)), [store]);
  const place = useCallback((boxes: CanvasBoxes, front: string[]) => {
    store.change((d) => bringToFront(placeItems(d, boxes), front));
  }, [store]);

  const collect = (text: string) => {
    const ids = collectText(store, text);
    if (!ids.length) return;
    showEverything();
    const step = store.lastStep();
    toast({ message: ids.length === 1 ? 'Item added.' : `${ids.length} items added.`, action: { label: 'Undo', onAction: () => store.undoStep(step) } });
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    showEverything();
    if (!demo && isTempId(store.pageId)) {
      toast({ message: 'The collection is still being created. Try again in a moment.', variant: 'error' });
      return;
    }
    if (demo) {
      // The harness has no storage: its files are drawn from this browser, and never saved.
      const now = new Date().toISOString();
      store.change((d) => addItems(d, files.map((f) => fileItem(mintUuid(), { attachmentId: `demo:${URL.createObjectURL(f)}`, name: f.name, mime: f.type || null, size: f.size }, now))));
      return;
    }
    setUploading((u) => [...u, ...files.map((f) => f.name)]);
    await Promise.all(files.map(async (file) => {
      const res = await uploadAttachment({ page_id: store.pageId }, file);
      setUploading((u) => {
        const i = u.indexOf(file.name);
        return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
      });
      if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
      const a = res.attachment;
      store.change((d) => addItems(d, [fileItem(mintUuid(), { attachmentId: a.id, name: a.filename, mime: a.mime_type, size: a.size_bytes }, new Date().toISOString())]));
    }));
  };

  // ── Tags (K7). Each is ONE undoable change — making a tag and putting it on included.
  const nowIso = () => new Date().toISOString();
  const toggleItemTag = (itemId: string, tagId: string) => store.change((d) => {
    const current = d.items.find((i) => i.id === itemId)?.tags ?? [];
    return setItemTags(d, itemId, current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId], nowIso());
  });
  const createItemTag = (itemId: string, name: string) => store.change((d) => {
    const { doc: next, tag } = ensureTag(d, name, mintUuid());
    if (!tag) return d;
    const current = next.items.find((i) => i.id === itemId)?.tags ?? [];
    return current.includes(tag.id) ? next : setItemTags(next, itemId, [...current, tag.id], nowIso());
  });
  // The selection's tags: the ones EVERY selected item carries. Picking one of those takes it off them all;
  // picking any other puts it on them all.
  const selectedItems = doc.items.filter((i) => selected.has(i.id));
  const sharedTags = (doc.tags ?? []).filter((t) => selectedItems.length > 0 && selectedItems.every((i) => i.tags?.includes(t.id))).map((t) => t.id);
  const tagSelection = (tagId: string) => {
    const on = !sharedTags.includes(tagId);
    store.change((d) => tagItems(d, [...selected], tagId, on, nowIso()));
  };
  const createSelectionTag = (name: string) => store.change((d) => {
    const { doc: next, tag } = ensureTag(d, name, mintUuid());
    return tag ? tagItems(next, [...selected], tag.id, true, nowIso()) : d;
  });

  // What a selection is taken away as (§16): every address it holds, one to a line.
  const copyLinks = () => {
    const links = itemLinks(selectedItems);
    if (!links.length) { toast({ message: 'Nothing here has a link.' }); return; }
    copyText(links.join('\n'), links.length === 1 ? 'Link copied.' : `${links.length} links copied.`);
  };

  const remove = (ids: string[]) => {
    if (!ids.length || !store.change((d) => removeItems(d, ids))) return;
    const step = store.lastStep();
    select([]);
    toast({ message: ids.length === 1 ? 'Item deleted.' : `${ids.length} items deleted.`, action: { label: 'Undo', onAction: () => store.undoStep(step) } });
  };

  // A paste, and the keys that act on a Collection, are its own when nothing else owns them: never
  // while typing, and never under a dialog or a menu it is not inside.
  const latest = useLatest({ collect, addFiles, remove, select, selected, store, items: shown });
  useEffect(() => {
    const owns = (target: EventTarget | null) => {
      const root = rootRef.current;
      if (!root || isTypingTarget(target)) return false;
      const active = document.activeElement;
      if (active && active !== document.body && !root.contains(active)) return false;
      const layers = [...document.querySelectorAll('[role="dialog"], [role="menu"]')].filter((d) => d.getAttribute('data-state') !== 'closed');
      return !layers.some((d) => !d.contains(root));
    };
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || !owns(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) { e.preventDefault(); void latest.current.addFiles(files); return; }
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!parseCollectable(text).urls.length) return;
      e.preventDefault();
      latest.current.collect(text);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !owns(e.target)) return;
      const { store: s, selected: chosen } = latest.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && key === 'a') { e.preventDefault(); latest.current.select(latest.current.items.map((i) => i.id)); return; }
      if (e.key === 'Escape' && chosen.size) { e.preventDefault(); latest.current.select([]); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && chosen.size) { e.preventDefault(); latest.current.remove([...chosen]); }
    };
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [latest]);

  const empty = doc.items.length === 0 && uploading.length === 0;

  return (
    <div ref={rootRef} data-collection-page className={mode === 'canvas' ? 'relative' : 'relative pb-20'}
      onDragOver={(e) => {
        const types = [...e.dataTransfer.types];
        if (!types.includes('Files') && !types.includes('text/uri-list')) return;
        e.preventDefault();
        if (!dropping) setDropping(true);
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }}
      onDrop={(e) => {
        setDropping(false);
        const files = [...e.dataTransfer.files];
        if (files.length) { e.preventDefault(); void addFiles(files); return; }
        const links = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'))
          .split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).join('\n');
        if (!parseCollectable(links).urls.length) return;
        e.preventDefault();
        collect(links);
      }}>
      {/* The Collection's own bar: how much it holds (or what is selected), how to see it, and Add. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {selected.size > 0 ? (
          <div role="toolbar" aria-label="Selected items" className="flex items-center gap-1">
            <span className="px-1 text-meta font-medium text-ink-800">{selected.size} selected</span>
            {selected.size === 1 && <Button size="sm" variant="ghost" onClick={() => setOpenId([...selected][0])}>Open</Button>}
            <div className="relative">
              <Button size="sm" variant="ghost" icon={<Icon icon={Tag} size={16} />} aria-expanded={tagOpen} onClick={() => setTagOpen(true)}>Tag</Button>
              {tagOpen && (
                <Pop onClose={() => setTagOpen(false)} width={260}>
                  <OptionList multi placeholder="Search or create a tag…"
                    options={(doc.tags ?? []).map((t) => ({ value: t.id, label: t.name, dot: palette(t.color).dot }))}
                    selected={sharedTags}
                    onPick={tagSelection}
                    onCreate={createSelectionTag} />
                </Pop>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={copyLinks}>{selected.size === 1 ? 'Copy link' : 'Copy links'}</Button>
            <Button size="sm" variant="ghost" onClick={() => remove([...selected])}>Delete</Button>
            {selected.size < shown.length && (
              <Button size="sm" variant="ghost" onClick={() => select(shown.map((i) => i.id))}>Select all</Button>
            )}
            <IconButton size="sm" label="Clear selection" icon={<Icon icon={X} size={16} />} onClick={() => select([])} />
          </div>
        ) : (
          <span className="text-meta text-ink-500">
            {!doc.items.length ? 'Nothing collected yet'
              : narrowed ? `${shown.length} of ${doc.items.length}`
              : itemCountLabel(doc.items.length)}
          </span>
        )}
        <span className="flex-1" />
        {mode === 'grid' && doc.items.length > 0 && (
          <>
            <CollectionFindBar doc={doc} query={query} onQuery={(q) => setAsked({ store, query: q, filter })}
              filter={filter} onFilter={(f) => setAsked({ store, query, filter: f })} sort={sort} onSort={setOrder} />
            <CollectionViewSettings view={view} onView={changeView} />
          </>
        )}
        <SegmentedControl aria-label="Collection layout" fit="content" value={mode} onValueChange={(v) => setSurface({ store, mode: v as Mode })}
          options={[
            { value: 'grid', label: <span className="flex items-center gap-1.5"><Icon icon={LayoutGrid} size={16} />Grid</span> },
            { value: 'canvas', label: <span className="flex items-center gap-1.5"><Icon icon={BoundingBox} size={16} />Canvas</span> },
          ]} />
        <div className="relative">
          <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />} aria-expanded={addOpen} onClick={() => setAddOpen(true)}>Add</Button>
          {addOpen && (
            <Pop onClose={() => setAddOpen(false)} right width={320}>
              <CollectComposer canUpload={demo || !isTempId(store.pageId)}
                onCollect={(text) => { setAddOpen(false); collect(text); }}
                onFiles={(files) => { setAddOpen(false); void addFiles(files); }} />
            </Pop>
          )}
        </div>
      </div>

      {uploading.length > 0 && (
        <p role="status" className="mb-2 text-meta text-ink-600">
          Uploading {uploading.length === 1 ? uploading[0] : `${uploading.length} files`}…
        </p>
      )}

      {empty ? (
        <EmptyState size="inline" illustration={<Icon icon={Images} size={20} />}
          title="Collect anything"
          description="Paste a link, drop a file, or add one."
          secondary={<Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>Add</Button>} />
      ) : mode === 'grid' ? (
        shown.length === 0 ? (
          <EmptyState size="inline" illustration={<Icon icon={Search} size={20} />}
            title="Nothing matches"
            description="Try fewer words, or clear the filters."
            secondary={<Button size="sm" variant="secondary" onClick={() => setAsked({ store, query: '', filter: NO_FILTER })}>Clear</Button>} />
        ) : (
          <CollectionGrid items={shown} vocabulary={doc.tags} view={view} selected={selected} onOpen={setOpenId} onToggle={toggle}
            onDelete={(id) => remove([id])} onLearn={learn} onShape={learnShape}
            reorderable={reorderable} onMove={(id, index) => store.change((d) => moveItem(d, id, index))}
            onRename={(id, title) => store.change((d) => renameItem(d, id, title, nowIso()))}
            onToggleTag={toggleItemTag} />
        )
      ) : (
        <CollectionCanvas cameraKey={pageId} items={doc.items} vocabulary={doc.tags} selected={selected} onSelect={select} onOpen={setOpenId}
          onDelete={(id) => remove([id])} onPlace={place} onLearn={learn} onShape={learnShape} />
      )}

      {/* The drop zone appears only while something is being dragged over the Collection. */}
      {dropping && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg border-2 border-dashed border-accent bg-accent-wash">
          <span className="text-ui font-medium text-ink-900">Drop to add to this collection</span>
        </div>
      )}

      {openItem && (
        <CollectionItemPage key={openItem.id} item={openItem} vocabulary={doc.tags} onClose={() => setOpenId(null)}
          attachTo={demo || isTempId(store.pageId) ? undefined : { page_id: store.pageId }}
          onBody={(blocks) => store.learn((d) => setItemBody(d, openItem.id, blocks, new Date().toISOString()))}
          onToggleTag={(tagId) => toggleItemTag(openItem.id, tagId)}
          onCreateTag={(name) => createItemTag(openItem.id, name)}
          onRename={(title) => store.change((d) => renameItem(d, openItem.id, title, new Date().toISOString()))}
          onDelete={() => { setOpenId(null); remove([openItem.id]); }} />
      )}
    </div>
  );
}
