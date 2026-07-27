'use client';
// Live database stores — the stateful half of the database core engine.
// One store per collection, shared by EVERY mounted view (full page, inline
// block, linked views): an edit in one view propagates to all others in the
// same frame, because they all read this store. Cross-client edits arrive
// through Supabase Realtime on collection_rows.
//
//   · optimistic ops (UI applies instantly, server follows)
//   · autosave (debounced, merged patches per collection / per row)
//   · undo/redo (inverse ops, database-scoped — separate from the doc editor)
//   · demo mode (dev-preview: everything local, nothing persisted)
//
// No JSX and no rendering concerns live here — views subscribe via useDbState.
import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateCollection, addDbRow, updateDbRow, deleteDbRow } from '@/lib/actions/collections';
import type { Collection, DbRow, PropDef, PropType } from '@/lib/collections';
import { migrateProp, type ResolveCollection } from '@/lib/db-engine';

export type DbState = { col: Collection; rows: DbRow[] };
type ColPatch = Partial<Pick<Collection, 'name' | 'props' | 'views'>>;
type RowPatch = { title?: string; data?: Record<string, unknown> };
type UndoEntry = { undo: () => void; redo: () => void };

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
  private record(entry: UndoEntry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  // ── ops ──
  patchCol(patch: ColPatch) {
    const prior: ColPatch = {};
    for (const k of Object.keys(patch) as (keyof ColPatch)[]) (prior as Record<string, unknown>)[k] = this.state.col[k];
    const apply = (p: ColPatch) => { this.silent((s) => ({ ...s, col: { ...s.col, ...p } })); this.queueColSave(p); };
    apply(patch);
    this.record({ undo: () => apply(prior), redo: () => apply(patch) });
  }

  patchRow(id: string, patch: RowPatch) {
    const row = this.state.rows.find((r) => r.id === id); if (!row) return;
    const prior: RowPatch = {};
    if (patch.title !== undefined) prior.title = row.title;
    if (patch.data !== undefined) prior.data = row.data;
    const holder = { id };
    const apply = (p: RowPatch) => {
      this.silent((s) => ({ ...s, rows: s.rows.map((r) => (r.id === holder.id ? { ...r, ...p, updated_at: now() } : r)) }));
      this.queueRowSave(holder, p);
    };
    apply(patch);
    this.record({ undo: () => apply(prior), redo: () => apply(patch) });
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

  addRow(input: { title?: string; data?: Record<string, unknown>; sortIndex?: number } = {}): string {
    const holder = { id: 'tmp-' + Math.random().toString(36).slice(2, 9) };
    const make = (): DbRow => ({
      id: holder.id, title: input.title ?? '', data: input.data ?? {},
      sort_index: input.sortIndex ?? Date.now(), created_at: now(), updated_at: now(),
    });
    const insert = () => {
      this.silent((s) => ({ ...s, rows: [...s.rows, make()] }));
      if (this.demo) return;
      addDbRow(this.state.col.id, { title: input.title, data: input.data, sortIndex: input.sortIndex ?? Date.now() })
        .then((res) => { if ('id' in res) this.swapRowId(holder, res.id); else this.dropRow(holder.id); })
        .catch(() => this.dropRow(holder.id));
    };
    const remove = () => {
      const gone = holder.id;
      this.dropRow(gone);
      if (!this.demo && !gone.startsWith('tmp-')) deleteDbRow(gone);
      holder.id = 'tmp-' + Math.random().toString(36).slice(2, 9); // future redo re-inserts fresh
    };
    insert();
    this.record({ undo: remove, redo: insert });
    return holder.id;
  }

  removeRow(id: string) {
    const i = this.state.rows.findIndex((r) => r.id === id); if (i < 0) return;
    const snapshot = this.state.rows[i];
    const holder = { id };
    const remove = () => {
      this.dropRow(holder.id);
      if (!this.demo && !holder.id.startsWith('tmp-')) deleteDbRow(holder.id);
    };
    const restore = () => {
      this.silent((s) => {
        const rows = [...s.rows]; rows.splice(Math.min(i, rows.length), 0, { ...snapshot, id: holder.id });
        return { ...s, rows };
      });
      if (this.demo) return;
      addDbRow(this.state.col.id, { title: snapshot.title, data: snapshot.data, sortIndex: snapshot.sort_index })
        .then((res) => { if ('id' in res) this.swapRowId(holder, res.id); });
    };
    remove();
    this.record({ undo: restore, redo: remove });
  }

  undo() { const e = this.undoStack.pop(); if (!e) return; e.undo(); this.redoStack.push(e); }
  redo() { const e = this.redoStack.pop(); if (!e) return; e.redo(); this.undoStack.push(e); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  // ── internals ──
  private dropRow(id: string) {
    const q = this.rowSaves.get(id); if (q) { clearTimeout(q.timer); this.rowSaves.delete(id); }
    this.silent((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));
  }
  private swapRowId(holder: { id: string }, real: string) {
    const tmp = holder.id; holder.id = real;
    const pending = this.rowSaves.get(tmp);
    if (pending) { this.rowSaves.delete(tmp); this.rowSaves.set(real, pending); }
    this.silent((s) => ({ ...s, rows: s.rows.map((r) => (r.id === tmp ? { ...r, id: real } : r)) }));
  }
  private queueColSave(patch: ColPatch) {
    if (this.demo) return;
    const merged = { ...this.colSave?.patch, ...patch };
    if (this.colSave) clearTimeout(this.colSave.timer);
    this.colSave = { patch: merged, timer: setTimeout(() => { this.colSave = null; updateCollection(this.state.col.id, merged); }, SAVE_MS) };
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
        if (!holder.id.startsWith('tmp-')) updateDbRow(holder.id, merged);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_rows', filter: 'collection_id=eq.' + this.state.col.id }, (payload) => {
        const rec = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<DbRow> & { id?: string };
        const id = rec?.id; if (!id) return;
        if (payload.eventType === 'DELETE') {
          if (this.state.rows.some((r) => r.id === id)) this.silent((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));
          return;
        }
        const incoming: DbRow = {
          id, title: rec.title ?? '', data: (rec.data as Record<string, unknown>) ?? {},
          sort_index: rec.sort_index ?? Date.now(), created_at: rec.created_at ?? now(), updated_at: rec.updated_at ?? now(),
        };
        const local = this.state.rows.find((r) => r.id === id);
        if (!local) { this.silent((s) => ({ ...s, rows: [...s.rows, incoming] })); return; }
        if (this.rowSaves.has(id)) return; // local unsaved edits win
        if (new Date(incoming.updated_at).getTime() >= new Date(local.updated_at).getTime()) {
          this.silent((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? incoming : r)) }));
        }
      })
      .subscribe();
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
