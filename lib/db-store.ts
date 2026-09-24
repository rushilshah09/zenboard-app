'use client';
// Live database stores — the stateful half of the database core engine.
// One store per collection, shared by EVERY mounted view (full page, inline
// block, linked views): an edit in one view propagates to all others in the
// same frame, because they all read this store. Cross-client edits arrive
// through Supabase Realtime on `pages` — a row IS a page since 0028, so the
// channel filters on `database_id` rather than watching a separate rows table.
//
//   · optimistic ops (UI applies instantly, server follows)
//   · autosave (debounced, merged patches per collection / per row)
//   · undo/redo (inverse ops, database-scoped — separate from the doc editor)
//   · demo mode (dev-preview: everything local, nothing persisted)
//
// No JSX and no rendering concerns live here — views subscribe via useDbState.
import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { unstable_isUnrecognizedActionError } from 'next/navigation';
// `toast` is a module-singleton store dispatch, not a component — importing it
// here costs no rendering concern and keeps the "never silent on failure" rule
// (INTERACTION_STANDARDS §2.5) with the code that actually knows a write failed.
// An optimistic row that vanishes without a word is the bug this prevents.
import { toast } from '@/components/ds/ui/toast';
import { updateCollection, addDbRow, updateDbRow, deleteDbRow, createDatabase } from '@/lib/actions/collections';
import { classifyRejection, FAILURE_COPY } from '@/lib/action-failure';
import { defaultCollection, genId, nextColor, type Collection, type DbRow, type PropDef, type PropOption, type PropType, type ViewDef } from '@/lib/collections';
import { migrateProp, newRowValues, type ResolveCollection } from '@/lib/db-engine';
import { orderAppend, orderBetween } from '@/lib/row-order';
import { isTempId, mintUuid } from '@/lib/temp-id';

/** What Realtime hands us for a row — the `pages` column names, before the
 *  mapping into row-shaped fields. */
type PageRecord = {
  id?: string; title?: string | null;
  properties?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  row_order?: string | null;
  created_at?: string; updated_at?: string;
};

/** The pre-0028 `collection_rows` payload, kept until the migration lands. */
type LegacyRecord = {
  id?: string; title?: string | null; data?: Record<string, unknown> | null;
  sort_index?: number | null; created_at?: string; updated_at?: string;
};

/** Legacy payload → DbRow. Mirrors `legacyToRow` in lib/actions/collections.ts;
 *  both die together when 0028 is applied. */
function legacyIncoming(rec: LegacyRecord): DbRow {
  const data = { ...(rec.data ?? {}) };
  const body = data.__content;
  delete data.__content;
  return {
    id: rec.id!, title: rec.title ?? '', data,
    content: body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined,
    order: Math.max(0, Math.round(rec.sort_index ?? 0)).toString(36).padStart(12, '0'),
    created_at: rec.created_at ?? now(), updated_at: rec.updated_at ?? now(),
  };
}

export type DbState = { col: Collection; rows: DbRow[] };
type ColPatch = Partial<Pick<Collection, 'name' | 'props' | 'views'>>;
// `content` is the row's body. It rides the same debounced save queue as the
// properties do, so typing in a row's page costs one write, not two.
/** A change to one row. `order` moves it — a board drop writes its column and its place as ONE step. */
type RowPatch = { title?: string; data?: Record<string, unknown>; content?: Record<string, unknown>; order?: string };
export type UndoEntry = { undo: () => void; redo: () => void };
/** How creating a database on the server came out. */
type Creation = { ok: true } | { error: string };

const SAVE_MS = 400;
const now = () => new Date().toISOString();

export class DbStore {
  private state: DbState;
  private listeners = new Set<() => void>();
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private colSave: { timer: ReturnType<typeof setTimeout>; patch: ColPatch } | null = null;
  private rowSaves = new Map<string, { timer: ReturnType<typeof setTimeout>; patch: RowPatch }>();
  private channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
  readonly demo: boolean;

  constructor(col: Collection, rows: DbRow[], demo: boolean) {
    this.state = { col, rows };
    this.demo = demo;
  }

  // ── creation gate ──
  // A database made on this device exists on screen before it exists on the
  // server. Until the server confirms it, every write waits here, and if creation
  // fails none is sent: a row saved against a database the server never made is a
  // write to nothing. Loaded and demo stores are ready from birth.
  private ready: Promise<boolean> = Promise.resolve(true);
  markCreating(creation: Promise<Creation>) {
    this.ready = creation.then((r) => !('error' in r), () => false);
  }
  /** Resolves true once the server has this database — at once for a loaded one. */
  created(): Promise<boolean> { return this.ready; }

  // ── placeholder → server id ──
  // New opens a new row's page at once, under the placeholder `addRow` minted; the
  // server's id replaces it a moment later. A view that is holding the placeholder
  // must still find the row, or the page it has just opened closes itself.
  private swapped = new Map<string, string>();
  /** The id a row goes by now, following any placeholder the server has replaced. */
  currentId(id: string): string {
    let cur = id;
    for (let hops = 0; hops < 8 && this.swapped.has(cur); hops++) cur = this.swapped.get(cur)!;
    return cur;
  }
  private origin = new Map<string, string>(); // server id → the placeholder it replaced
  /** A React key that survives the swap. Keyed by id, a just-added row remounted when
   *  its real id arrived — and dropped the caret of someone typing its name. */
  stableKey(id: string): string {
    return this.origin.get(id) ?? id;
  }
  private whenReady(send: () => void) {
    if (this.demo) return;
    void this.ready.then((ok) => { if (ok) send(); });
  }

  // ── subscription (React + realtime lifecycle) ──
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (!this.demo && this.listeners.size === 1) this.attachRealtime();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.detachRealtime();
    };
  };
  getState = (): DbState => this.state;
  private emit() { for (const fn of this.listeners) fn(); }
  private set(next: DbState) { this.state = next; this.emit(); }

  // ── silent mutation (undo/redo/realtime replay — records nothing) ──
  private silent(fn: (s: DbState) => DbState) { this.set(fn(this.state)); }
  // Entries recorded inside `transact` gather here and become ONE step.
  private collecting: UndoEntry[] | null = null;
  private record(entry: UndoEntry) {
    if (this.collecting) { this.collecting.push(entry); return; }
    this.undoStack.push(entry);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  /**
   * Several ops as ONE undo step — a drop that moves a row, re-keys the rows around
   * it and clears the sort that was in its way is one thing the person did, so ⌘Z
   * takes all of it back at once. Returns the step, for a toast's Undo.
   */
  transact(fn: () => void): UndoEntry | null {
    if (this.collecting) { fn(); return null; } // already inside one: it joins the outer step
    const bag: UndoEntry[] = [];
    this.collecting = bag;
    try { fn(); } finally { this.collecting = null; }
    if (!bag.length) return null;
    const entry: UndoEntry = bag.length === 1 ? bag[0] : {
      undo: () => { for (let i = bag.length - 1; i >= 0; i--) bag[i].undo(); },
      redo: () => { for (const e of bag) e.redo(); },
    };
    this.record(entry);
    return entry;
  }

  // ── ops ──
  /** Returns the undo step, so a toast can offer to take this one change back. */
  patchCol(patch: ColPatch): UndoEntry {
    const prior: ColPatch = {};
    for (const k of Object.keys(patch) as (keyof ColPatch)[]) (prior as Record<string, unknown>)[k] = this.state.col[k];
    const apply = (p: ColPatch) => { this.silent((s) => ({ ...s, col: { ...s.col, ...p } })); this.queueColSave(p); };
    apply(patch);
    const entry: UndoEntry = { undo: () => apply(prior), redo: () => apply(patch) };
    this.record(entry);
    return entry;
  }

  patchRow(id: string, patch: RowPatch) {
    const row = this.state.rows.find((r) => r.id === id); if (!row) return;
    const prior: RowPatch = {};
    if (patch.title !== undefined) prior.title = row.title;
    if (patch.data !== undefined) prior.data = row.data;
    if (patch.content !== undefined) prior.content = row.content;
    if (patch.order !== undefined) prior.order = row.order;
    const holder = { id };
    const apply = (p: RowPatch) => {
      this.silent((s) => ({ ...s, rows: s.rows.map((r) => (r.id === holder.id ? { ...r, ...p, updated_at: now() } : r)) }));
      this.queueRowSave(holder, p);
    };
    apply(patch);
    this.record({ undo: () => apply(prior), redo: () => apply(patch) });
  }

  /**
   * A new option on a select, multi-select or status property, in the next colour —
   * typed into a cell's picker, wherever that cell is (a table, a card's page, a page
   * opened three levels deep). Returned so the cell can pick it at once.
   */
  createOption(propId: string, name: string): PropOption {
    const p = this.state.col.props.find((x) => x.id === propId);
    const option: PropOption = { id: genId(), name, color: nextColor(p?.options?.length ?? 0) };
    this.patchCol({ props: this.state.col.props.map((x) => (x.id === propId ? { ...x, options: [...(x.options ?? []), option] } : x)) });
    return option;
  }

  // Retype a property (§9.3): swap its type and migrate every row's value in a
  // single, atomic undo step. Prop change + affected row edits apply and persist
  // together; undo restores both.
  retypeProp(propId: string, newType: PropType) {
    const prop = this.state.col.props.find((p) => p.id === propId);
    if (!prop || prop.type === newType) return;
    const { prop: newProp, values } = migrateProp(prop, this.state.rows, newType);
    const nextProps = this.state.col.props.map((p) => (p.id === propId ? newProp : p));
    const priorProps = this.state.col.props;
    const nextData = new Map<string, Record<string, unknown>>();
    const priorData = new Map<string, Record<string, unknown>>();
    for (const id of Object.keys(values)) {
      const row = this.state.rows.find((r) => r.id === id); if (!row) continue;
      priorData.set(id, row.data);
      const d = { ...row.data };
      if (values[id] === undefined) delete d[propId]; else d[propId] = values[id];
      nextData.set(id, d);
    }
    const apply = (props: PropDef[], data: Map<string, Record<string, unknown>>) => {
      this.silent((s) => ({
        col: { ...s.col, props },
        rows: s.rows.map((r) => (data.has(r.id) ? { ...r, data: data.get(r.id)!, updated_at: now() } : r)),
      }));
      this.queueColSave({ props });
      for (const [id, d] of data) this.queueRowSave({ id }, { data: d });
    };
    apply(nextProps, nextData);
    this.record({ undo: () => apply(priorProps, priorData), redo: () => apply(nextProps, nextData) });
  }

  addRow(input: { title?: string; data?: Record<string, unknown>; order?: string } = {}): string {
    const holder = { id: 'tmp-' + Math.random().toString(36).slice(2, 9) };
    // Computed at insert time, not once: undo-then-redo must land after
    // whatever else arrived in between, not back in the old gap.
    const make = (order: string): DbRow => ({
      id: holder.id, title: input.title ?? '', data: input.data ?? {},
      content: { blocks: [] }, order, created_at: now(), updated_at: now(),
    });
    const insert = () => {
      const order = input.order ?? orderAppend(this.state.rows);
      this.silent((s) => ({ ...s, rows: [...s.rows, make(order)] }));
      this.whenReady(() => {
        addDbRow(this.state.col.id, { title: input.title, data: input.data, order })
          .then((res) => { if ('id' in res) this.swapRowId(holder, res.id); else this.rollbackRow(holder.id, 'Could not add the row.'); })
          .catch(() => this.rollbackRow(holder.id, 'Could not add the row.'));
      });
    };
    const remove = () => {
      const gone = holder.id;
      this.dropRow(gone);
      if (!isTempId(gone)) this.whenReady(() => deleteDbRow(gone));
      holder.id = 'tmp-' + Math.random().toString(36).slice(2, 9); // future redo re-inserts fresh
    };
    insert();
    this.record({ undo: remove, redo: insert });
    return holder.id;
  }

  removeRow(id: string): UndoEntry | null {
    const i = this.state.rows.findIndex((r) => r.id === id); if (i < 0) return null;
    const snapshot = this.state.rows[i];
    const holder = { id };
    const remove = () => {
      this.dropRow(holder.id);
      const id = holder.id;
      if (!isTempId(id)) this.whenReady(() => deleteDbRow(id));
    };
    const restore = () => {
      this.silent((s) => {
        const rows = [...s.rows]; rows.splice(Math.min(i, rows.length), 0, { ...snapshot, id: holder.id });
        return { ...s, rows };
      });
      // Restores to its ORIGINAL key, so an undone delete comes back where it
      // was rather than at the bottom of the list.
      this.whenReady(() => {
        addDbRow(this.state.col.id, { title: snapshot.title, data: snapshot.data, content: snapshot.content, order: snapshot.order })
          .then((res) => { if ('id' in res) this.swapRowId(holder, res.id); else this.rollbackRow(holder.id, 'Could not restore the row.'); })
          .catch(() => this.rollbackRow(holder.id, 'Could not restore the row.'));
      });
    };
    remove();
    const entry: UndoEntry = { undo: restore, redo: remove };
    this.record(entry);
    // Returned so a caller can offer a targeted "Undo" on the toast. Cmd+Z
    // already worked; nothing in the UI ever said so.
    return entry;
  }

  /**
   * Undo one specific entry — and only while it is still the newest. A toast
   * lives for 8s, long enough for the user to edit something else first; a
   * blind `undo()` would then revert THAT instead of the row they meant.
   */
  undoEntry(entry: UndoEntry) {
    if (this.undoStack[this.undoStack.length - 1] !== entry) return false;
    this.undo();
    return true;
  }

  undo() { const e = this.undoStack.pop(); if (!e) return; e.undo(); this.redoStack.push(e); }
  redo() { const e = this.redoStack.pop(); if (!e) return; e.redo(); this.undoStack.push(e); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  // ── internals ──
  /**
   * A server write for an OPTIMISTIC row failed: take the row back out and say
   * so. Rolling back quietly is what made a flaky connection look like the app
   * eating your work — the row appeared, then vanished with no explanation.
   */
  private rollbackRow(id: string, message: string) {
    this.dropRow(id);
    toast({ message, variant: 'error' });
  }
  private dropRow(id: string) {
    const q = this.rowSaves.get(id); if (q) { clearTimeout(q.timer); this.rowSaves.delete(id); }
    this.silent((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));
  }
  private swapRowId(holder: { id: string }, real: string) {
    const tmp = holder.id; holder.id = real;
    this.swapped.set(tmp, real);
    this.origin.set(real, this.origin.get(tmp) ?? tmp);
    const pending = this.rowSaves.get(tmp);
    if (pending) { this.rowSaves.delete(tmp); this.rowSaves.set(real, pending); }
    this.silent((s) => ({ ...s, rows: s.rows.map((r) => (r.id === tmp ? { ...r, id: real } : r)) }));
  }
  private queueColSave(patch: ColPatch) {
    if (this.demo) return;
    const merged = { ...this.colSave?.patch, ...patch };
    if (this.colSave) clearTimeout(this.colSave.timer);
    this.colSave = { patch: merged, timer: setTimeout(() => { this.colSave = null; this.whenReady(() => updateCollection(this.state.col.id, merged)); }, SAVE_MS) };
  }
  private queueRowSave(holder: { id: string }, patch: RowPatch) {
    if (this.demo) return;
    const prev = this.rowSaves.get(holder.id);
    const merged = { ...prev?.patch, ...patch };
    if (prev) clearTimeout(prev.timer);
    this.rowSaves.set(holder.id, {
      patch: merged,
      timer: setTimeout(() => {
        this.rowSaves.delete(holder.id);
        this.whenReady(() => { if (!isTempId(holder.id)) updateDbRow(holder.id, merged); });
      }, SAVE_MS),
    });
  }

  // Cross-client sync: apply remote row changes unless we have local pending
  // edits for that row (local wins until saved; realtime echoes then agree).
  private attachRealtime() {
    if (this.channel) return;
    const supabase = createClient();
    this.channel = supabase
      .channel('zb-db-' + this.state.col.id)
      // BOTH eras are watched, because which one is live is a property of the
      // database, not of this build: 0028 may not be applied yet (see the gate
      // in lib/actions/collections.ts). Only one of these two can ever produce
      // rows, and a filter on a column that does not exist simply never
      // matches — so subscribing to both costs a channel binding and removes an
      // "is it migrated?" question the client has no cheap way to answer.
      //
      // A DELETE payload carries only the replica identity (the primary key by
      // default), so the filter column is absent there — the filter is applied
      // server-side either way, and the `some(r => r.id === id)` check below is
      // what keeps a stray event harmless.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_rows', filter: 'collection_id=eq.' + this.state.col.id }, (payload) => {
        const rec = (payload.eventType === 'DELETE' ? payload.old : payload.new) as LegacyRecord;
        this.applyRemote(payload.eventType, rec?.id, () => legacyIncoming(rec));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pages', filter: 'database_id=eq.' + this.state.col.id }, (payload) => {
        const rec = (payload.eventType === 'DELETE' ? payload.old : payload.new) as PageRecord;
        this.applyRemote(payload.eventType, rec?.id, () => ({
          id: rec.id!, title: rec.title ?? '', data: rec.properties ?? {}, content: rec.content ?? undefined,
          order: rec.row_order ?? '', created_at: rec.created_at ?? now(), updated_at: rec.updated_at ?? now(),
        }));
      })
      .subscribe();
  }

  /**
   * Merge one remote change. Both eras land here so the conflict rules are
   * stated once: a local unsaved edit always wins, and an older remote write
   * never overwrites a newer local one.
   */
  private applyRemote(event: string, id: string | undefined, build: () => DbRow) {
    if (!id) return;
    if (event === 'DELETE') {
      if (this.state.rows.some((r) => r.id === id)) this.silent((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));
      return;
    }
    const incoming = build();
    const local = this.state.rows.find((r) => r.id === id);
    if (!local) { this.silent((s) => ({ ...s, rows: [...s.rows, incoming] })); return; }
    if (this.rowSaves.has(id)) return; // local unsaved edits win
    if (new Date(incoming.updated_at).getTime() >= new Date(local.updated_at).getTime()) {
      this.silent((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? incoming : r)) }));
    }
  }
  private detachRealtime() {
    if (!this.channel) return;
    createClient().removeChannel(this.channel);
    this.channel = null;
  }
}

// ── Registry — the "one collection, many views" guarantee ──
const stores = new Map<string, DbStore>();

// Returns the live store for a collection, creating it from the given data on
// first request. Later seeds do NOT clobber a live store (it may hold newer
// optimistic edits than the fetch that just resolved).
export function seedStore(col: Collection, rows: DbRow[], opts?: { demo?: boolean }): DbStore {
  const existing = stores.get(col.id);
  if (existing) return existing;
  const store = new DbStore(col, rows, !!opts?.demo);
  stores.set(col.id, store);
  return store;
}

// ── Databases created on this device ──
// A new database renders from what the browser just made, under ids the browser
// minted, while the server catches up. `beginDatabase` registers that store —
// holding its writes until `creation` settles — so every view of the collection,
// and the page that hosts it, finds it without a fetch.
//
// The registry is observable for one reason: a database whose creation FAILED
// leaves it, and a view still showing it must go back to the server rather than
// keep taking edits that can never be saved.
const pageStores = new Map<string, string>(); // page id → collection id
const registryListeners = new Set<() => void>();
const registryChanged = () => registryListeners.forEach((fn) => fn());
export function subscribeStores(fn: () => void): () => void {
  registryListeners.add(fn);
  return () => { registryListeners.delete(fn); };
}

export function beginDatabase(col: Collection, rows: DbRow[], creation: Promise<Creation>, pageId?: string): DbStore {
  const store = new DbStore(col, rows, false);
  store.markCreating(creation);
  stores.set(col.id, store);
  if (pageId) pageStores.set(pageId, col.id);
  const forget = () => {
    if (stores.get(col.id) !== store) return;
    stores.delete(col.id);
    for (const [page, id] of pageStores) if (id === col.id) pageStores.delete(page);
    registryChanged();
  };
  void creation.then((r) => { if ('error' in r) forget(); }, forget);
  registryChanged();
  return store;
}

/**
 * Make a database on this device, now: the default schema (its first view of
 * `kind`) and one empty row, under ids minted here that the server will keep.
 * The caller renders `store` at once, then calls `persist` when the database can
 * be saved — straight away for an inline block, once its page exists for a
 * full-page one — or `abandon` if it never can. Edits made in between wait for
 * the outcome, and are dropped with the database if it fails.
 */
export function newDatabase(opts: { kind?: ViewDef['kind']; pageId?: string } = {}) {
  const { props, views } = defaultCollection(opts.kind);
  const col: Collection = { id: mintUuid(), page_id: null, name: '', props, views };
  const at = now();
  // `orderBetween(null, null)` is a constant: the same key the server writes.
  // The first row starts the way every new row does (`newRowValues`): in its status's
  // first option, not in "No Status".
  const first: DbRow = { id: mintUuid(), title: '', data: newRowValues(props, views[0]), content: { blocks: [] }, order: orderBetween(null, null), created_at: at, updated_at: at };
  let settle!: (outcome: Creation) => void;
  const store = beginDatabase(col, [first], new Promise<Creation>((resolve) => { settle = resolve; }), opts.pageId);
  return {
    store,
    /** Save it — under `pageId`, the host page's REAL id, for a full-page database. */
    persist(pageId?: string): Promise<Creation> {
      // The schema as it stands NOW: a property added while the page was being
      // created goes in with the database instead of trailing it.
      const current = store.getState().col;
      const saved = createDatabase({ collectionId: col.id, firstRowId: first.id, firstRowData: first.data, pageId, props: current.props, views: current.views })
        // A THROWN failure carries no message worth showing (production reduces a
        // server throw to a digest), so say what is true, in ActionFailureNet's
        // words where they are true here. Its `server` line promises a refresh,
        // and nothing refreshes after this catch — so that case gets a plain one.
        .catch((e: unknown): Creation => {
          const kind = classifyRejection(e, { isStaleDeployment: unstable_isUnrecognizedActionError });
          return { error: kind === 'unreachable' || kind === 'stale' ? FAILURE_COPY[kind] : 'Could not create database.' };
        });
      void saved.then(settle);
      return saved;
    },
    abandon(error: string) { settle({ error }); },
  };
}

/** "Turn into page": show a collection this device already holds on a page that
 *  does not have its real id yet. */
export function hostOnPage(pageId: string, colId: string) {
  if (!stores.has(colId)) return;
  pageStores.set(pageId, colId);
  registryChanged();
}

/**
 * A page created under a placeholder id got its real one: its database follows.
 * The placeholder keeps pointing at it too — a view still rendering under it
 * re-reads before the new id reaches it, and a placeholder is never reused.
 */
export function linkPageStore(fromPageId: string, toPageId: string) {
  const colId = pageStores.get(fromPageId);
  if (!colId) return;
  pageStores.set(toPageId, colId);
  registryChanged();
}

/** A database fetched from the server joins the registry — found by its page too,
 *  when it has one. Call it from the fetch's callback, never in render: it notifies. */
export function receiveDatabase(col: Collection, rows: DbRow[], pageId?: string): DbStore {
  const store = seedStore(col, rows);
  if (pageId) pageStores.set(pageId, col.id);
  registryChanged();
  return store;
}

export function storeForPage(pageId: string | null | undefined): DbStore | null {
  const colId = pageId ? pageStores.get(pageId) : undefined;
  return (colId && stores.get(colId)) || null;
}

/**
 * The page a database lives on, when this device knows one: the page the server says
 * owns it, else the last real page it was hosted on here ("Turn into page" moments
 * ago). Null for a database that is only a block in a document.
 */
export function pageForCollection(colId: string): string | null {
  const own = stores.get(colId)?.getState().col.page_id;
  if (own) return own;
  let found: string | null = null;
  for (const [page, id] of pageStores) if (id === colId && !isTempId(page)) found = page;
  return found;
}

export function storeForCollection(id: string | null | undefined): DbStore | null {
  return (id && stores.get(id)) || null;
}

/** The store this device holds for a page / a collection, re-read whenever the
 *  registry changes. Null means the server has to be asked (see `loadPlan`). */
export function usePageStore(pageId: string | null | undefined): DbStore | null {
  return useSyncExternalStore(subscribeStores, () => storeForPage(pageId), () => null);
}
export function useCollectionStore(id: string | null | undefined): DbStore | null {
  return useSyncExternalStore(subscribeStores, () => storeForCollection(id), () => null);
}

/**
 * What a database view does with the id it was handed. It never asks the server
 * about a placeholder id: a page created a moment earlier mounted under `tmp-…`,
 * fetched with it, and printed Postgres's uuid error as the page.
 */
export type LoadPlan = 'wait' | 'local' | 'fetch';
export function loadPlan(id: string | null | undefined, local: DbStore | null): LoadPlan {
  if (local) return 'local';
  if (!id || isTempId(id)) return 'wait';
  return 'fetch';
}

// Engine resolver: lets rollups/relations read sibling collections that are
// currently loaded. Unloaded collections resolve to null (engine degrades).
export const resolveCollection: ResolveCollection = (id) => {
  const s = stores.get(id);
  return s ? { collection: s.getState().col, rows: s.getState().rows } : null;
};

// React binding — views subscribe to a store's state.
export function useDbState(store: DbStore): DbState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
