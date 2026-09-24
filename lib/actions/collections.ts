'use server';
// Collection (database) mutations — Notion-style databases hosted by pages of
// type 'database'. RLS scopes everything to the user; needs migration 0013.
//
// The generated Supabase types don't include the 0013 tables until typegen is
// re-run after the migration is applied, so these actions talk to the tables
// through a deliberately untyped accessor (results are cast at the edges).
//
// ── A ROW IS A PAGE (migration 0028, readers repointed here) ────────────────
// Rows live in `pages where database_id = <collection>`, not in
// `collection_rows`. This file is the ONLY place that knows the mapping:
//
//   DbRow.title   → pages.title
//   DbRow.data    → pages.properties   (keyed by property id, never by name)
//   DbRow.content → pages.content      (was smuggled into data.__content)
//   DbRow.order   → pages.row_order    (text fractional index, lib/row-order)
//   type          = 'row'              (the marker 0028's backfill wrote)
//
// Everything a page can do, a row now does for free: icons, covers, archive,
// version history, backlinks. Nothing else in the app may read `collection_rows`
// — it is frozen, kept only so 0028 stays reversible up to this commit, and a
// later migration retires it.
//
// ── GATED, because 0028 is not applied everywhere ──────────────────────────
// A live probe on 2026-08-03 found `pages.database_id`, `pages.properties`,
// `pages.row_order` and `collection_rows.page_id` ALL MISSING from the running
// database — 0028 has never actually been run there, whatever PROGRESS.md says.
// `types/database.ts` is hand-authored, so it lists the columns regardless and
// hid the gap from tsc.
//
// So every row path asks first, exactly like `mentionsSupported` (0027) and
// `goalsV2Supported` (0026): with the columns, rows are pages; without them,
// the old `collection_rows` path runs unchanged. A half-migrated app is still a
// working app — which is 0028's own stated strategy.
//
// The mapping to and from the legacy shape lives here and nowhere else, so the
// rest of the app only ever sees one `DbRow`. When the migration lands, delete
// `legacyToRow`, the `supported` branches, and this comment.
//
// NOTE: once the columns exist and this file starts writing them, rolling 0028
// back is no longer safe — rows created here exist only as pages, and
// `0028_rows_are_pages_rollback.sql` would delete them. Its edit guard catches
// the common case; the honest statement is that it becomes a one-way door.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { activeSpaceId } from '@/lib/active-space';
import { defaultCollection, normalizeCollection, type Collection, type DbRow, type PropDef, type ViewDef } from '@/lib/collections';
import { orderBetween } from '@/lib/row-order';
import { requireSession } from '@/lib/auth';

const tbl = (supabase: unknown, table: string): any => (supabase as { from: (t: string) => any }).from(table);

/** The page columns a row is made of. One list, so a select can never drift
 *  from the mapper below. */
const ROW_COLS = 'id, title, properties, content, row_order, created_at, updated_at';

type PageRow = {
  id: string; title: string | null;
  properties: Record<string, unknown> | null;
  content: Record<string, unknown> | null;
  row_order: string | null;
  created_at: string; updated_at: string;
};

/** page → DbRow. `row_order` is nullable in 0028 (it was seeded, but a page
 *  written by something else would not have one), and an empty key sorts first
 *  rather than throwing. */
const toRow = (p: PageRow): DbRow => ({
  id: p.id,
  title: p.title ?? '',
  data: p.properties ?? {},
  content: p.content ?? undefined,
  order: p.row_order ?? '',
  created_at: p.created_at,
  updated_at: p.updated_at,
});

// ── The 0028 gate ──────────────────────────────────────────────────────────

/**
 * Does `pages` carry the 0028 columns? A zero-row probe, the same fetch-time
 * capability pattern as `mentionsSupported` / `goalsV2Supported`.
 *
 * Memoized for the life of the server process: a migration cannot appear
 * mid-request, and this would otherwise cost a round trip on every row read.
 * A failed probe is NOT cached — a transient network error must not pin the app
 * to the legacy path until it restarts.
 */
let rowsArePages: boolean | null = null;
async function rowsArePagesSupported(supabase: unknown): Promise<boolean> {
  if (rowsArePages !== null) return rowsArePages;
  try {
    const { error } = await tbl(supabase, 'pages').select('database_id').limit(0);
    if (error) {
      // "column does not exist" is a real answer worth remembering; anything
      // else (offline, auth) is not.
      if ((error.code as string) === '42703') { rowsArePages = false; return false; }
      return false;
    }
    rowsArePages = true;
    return true;
  } catch {
    return false;
  }
}

/** The legacy `collection_rows` shape. */
type LegacyRow = {
  id: string; title: string | null; data: Record<string, unknown> | null;
  sort_index: number | null; created_at: string; updated_at: string;
};
const LEGACY_COLS = 'id, title, data, sort_index, created_at, updated_at';

/**
 * collection_rows → DbRow, so callers never learn which era they are in.
 *
 * Two translations: the body comes out of the `__content` key it was smuggled
 * into, and the numeric `sort_index` becomes a text key that sorts identically
 * (base 36, zero-padded to 12 — the same trick 0028's backfill uses in hex, and
 * wide enough for epoch millis).
 */
function legacyToRow(r: LegacyRow): DbRow {
  const data = { ...(r.data ?? {}) };
  const body = data.__content;
  delete data.__content;
  return {
    id: r.id,
    title: r.title ?? '',
    data,
    content: body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined,
    order: Math.max(0, Math.round(r.sort_index ?? 0)).toString(36).padStart(12, '0'),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** Every row of a collection, in manual order. */
async function loadRows(supabase: unknown, collectionId: string): Promise<{ error: string } | { rows: DbRow[] }> {
  if (await rowsArePagesSupported(supabase)) {
    const res = await tbl(supabase, 'pages')
      .select(ROW_COLS).eq('database_id', collectionId).is('archived_at', null)
      .order('row_order', { nullsFirst: true });
    if (res.error) return { error: res.error.message as string };
    return { rows: ((res.data as PageRow[]) ?? []).map(toRow) };
  }
  const res = await tbl(supabase, 'collection_rows')
    .select(LEGACY_COLS).eq('collection_id', collectionId).order('sort_index');
  if (res.error) return { error: res.error.message as string };
  return { rows: ((res.data as LegacyRow[]) ?? []).map(legacyToRow) };
}

// Loads the collection hosted by a page, creating it (with the default
// Name/Status/Tags schema) on first open — so any page of type 'database'
// becomes a working database with zero extra setup.
export async function getDatabase(pageId: string): Promise<{ error: string } | { collection: Collection; rows: DbRow[] }> {
  const { supabase, user } = await requireSession();
  const found = await tbl(supabase, 'collections')
    .select('id, page_id, name, props, views').eq('page_id', pageId).maybeSingle();
  if (found.error) return { error: found.error.message as string };
  let col = found.data ? normalizeCollection(found.data as Collection) : null;
  if (!col) {
    const sid = await activeSpaceId(supabase, user.id);
    const def = defaultCollection();
    const ins = await tbl(supabase, 'collections')
      .insert({ user_id: user.id, space_id: sid, page_id: pageId, props: def.props, views: def.views })
      .select('id, page_id, name, props, views').single();
    if (ins.error || !ins.data) return { error: (ins.error?.message as string) ?? 'Could not create database.' };
    col = normalizeCollection(ins.data as Collection);
  }
  const rows = await loadRows(supabase, col.id);
  if ('error' in rows) return rows;
  return { collection: col, rows: rows.rows };
}

// A database the screen is ALREADY showing (`newDatabase` in lib/db-store): the
// browser minted its ids and rendered its schema, and edits may already be queued
// against them. So this writes under exactly those ids — never fresh ones — in
// order: the database, then its first row. If the row cannot be written the
// database is removed again, so a failure leaves nothing half-made behind.
//
// The ids are checked before anything is asked: a placeholder reaching Postgres
// is the `invalid input syntax for type uuid: "tmp-…"` a new database page printed.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function createDatabase(input: {
  collectionId: string; firstRowId: string; pageId?: string | null;
  /** The first row's property values as the screen shows them (its status's first option). */
  firstRowData?: Record<string, unknown>;
  props: PropDef[]; views: ViewDef[];
}): Promise<{ error: string } | { ok: true }> {
  const { collectionId, firstRowId, pageId, props, views } = input;
  // Input from a browser: only a plain object may become a row's property bag.
  const firstRowData = input.firstRowData && typeof input.firstRowData === 'object' && !Array.isArray(input.firstRowData)
    ? input.firstRowData : {};
  const ids = pageId == null ? [collectionId, firstRowId] : [collectionId, firstRowId, pageId];
  if (!ids.every((id) => UUID.test(id))) return { error: 'Could not create database: invalid id.' };
  const { supabase, user } = await requireSession();
  const sid = await activeSpaceId(supabase, user.id);
  const col = await tbl(supabase, 'collections')
    .insert({ id: collectionId, user_id: user.id, space_id: sid, page_id: pageId ?? null, name: '', props, views });
  if (col.error) return { error: col.error.message as string };
  // The same first key the screen gave the row (`orderBetween(null, null)` is a
  // constant), so the row does not move when the server's copy arrives.
  const row = (await rowsArePagesSupported(supabase))
    ? await tbl(supabase, 'pages').insert({
      id: firstRowId, user_id: user.id, space_id: sid, database_id: collectionId, type: 'row',
      title: '', properties: firstRowData, content: { blocks: [] }, row_order: orderBetween(null, null),
    })
    : await tbl(supabase, 'collection_rows')
      .insert({ id: firstRowId, collection_id: collectionId, user_id: user.id, space_id: sid, title: '', data: firstRowData, sort_index: Date.now() });
  if (row.error) {
    await tbl(supabase, 'collections').delete().eq('id', collectionId);
    return { error: row.error.message as string };
  }
  return { ok: true };
}

// All of the user's databases — for the "Linked view of database" picker.
export async function listCollections(): Promise<{ error: string } | { collections: { id: string; name: string; page_id: string | null }[] }> {
  const { supabase } = await requireSession();
  const res = await tbl(supabase, 'collections')
    .select('id, name, page_id').order('updated_at', { ascending: false });
  if (res.error) return { error: res.error.message as string };
  return { collections: (res.data as { id: string; name: string; page_id: string | null }[]) ?? [] };
}

// "Turn into page": hands an inline collection to a page of type 'database'.
// The inline block keeps rendering the same collection — it becomes a linked
// view of the new page's database (Notion's replacement behavior).
export async function attachCollectionToPage(id: string, pageId: string): Promise<{ error: string } | { ok: true; name: string }> {
  const { supabase } = await requireSession();
  const res = await tbl(supabase, 'collections')
    .update({ page_id: pageId, updated_at: new Date().toISOString() })
    .eq('id', id).select('name').single();
  if (res.error || !res.data) return { error: (res.error?.message as string) ?? 'Could not convert database.' };
  return { ok: true, name: (res.data.name as string) ?? '' };
}

// Loads a collection by id (inline database blocks).
export async function getCollection(id: string): Promise<{ error: string } | { collection: Collection; rows: DbRow[] }> {
  const { supabase } = await requireSession();
  const found = await tbl(supabase, 'collections')
    .select('id, page_id, name, props, views').eq('id', id).maybeSingle();
  if (found.error) return { error: found.error.message as string };
  if (!found.data) return { error: 'Database not found.' };
  const rows = await loadRows(supabase, id);
  if ('error' in rows) return rows;
  return { collection: normalizeCollection(found.data as Collection), rows: rows.rows };
}

export async function updateCollection(id: string, patch: { name?: string; props?: PropDef[]; views?: ViewDef[] }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await tbl(supabase, 'collections')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  return error ? { error: error.message as string } : { ok: true };
}

export async function addDbRow(
  collectionId: string,
  input: { title?: string; data?: Record<string, unknown>; content?: Record<string, unknown>; order?: string },
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  const sid = await activeSpaceId(supabase, user.id);
  if (!(await rowsArePagesSupported(supabase))) {
    const { data, error } = await tbl(supabase, 'collection_rows')
      .insert({
        collection_id: collectionId, user_id: user.id, space_id: sid,
        title: input.title ?? '', sort_index: Date.now(),
        // The body goes back where the old schema kept it.
        data: { ...(input.data ?? {}), ...(input.content ? { __content: input.content } : {}) },
      })
      .select('id').single();
    if (error || !data) return { error: (error?.message as string) ?? 'Could not add row.' };
    return { id: data.id as string };
  }
  // The caller normally knows where the row goes (it holds the loaded list and
  // computed the key optimistically). When it doesn't, ask the database for the
  // current last key rather than guessing — two rows appended from two tabs
  // must not collide.
  let order = input.order;
  if (!order) {
    const last = await tbl(supabase, 'pages')
      .select('row_order').eq('database_id', collectionId)
      .order('row_order', { ascending: false }).limit(1).maybeSingle();
    order = orderBetween((last.data?.row_order as string | undefined) ?? null, null);
  }
  const { data, error } = await tbl(supabase, 'pages')
    .insert({
      user_id: user.id, space_id: sid, database_id: collectionId, type: 'row',
      title: input.title ?? '', properties: input.data ?? {},
      content: input.content ?? { blocks: [] }, row_order: order,
    })
    .select('id').single();
  if (error || !data) return { error: (error?.message as string) ?? 'Could not add row.' };
  return { id: data.id as string };
}

export async function updateDbRow(
  id: string,
  patch: { title?: string; data?: Record<string, unknown>; content?: Record<string, unknown>; order?: string },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await rowsArePagesSupported(supabase))) {
    const old: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) old.title = patch.title;
    if (patch.order !== undefined) { /* no reorder UI exists on the legacy path */ }
    if (patch.content !== undefined || patch.data !== undefined) {
      // The old schema keeps the body inside the property bag, so changing
      // either one means rewriting both — a read-modify-write, and the
      // lost-update the 0028 split exists to remove. Unavoidable here.
      const cur = await tbl(supabase, 'collection_rows').select('data').eq('id', id).maybeSingle();
      const base = { ...((cur.data?.data as Record<string, unknown>) ?? {}) };
      const body = patch.content !== undefined ? patch.content : base.__content;
      const next = patch.data !== undefined ? { ...patch.data } : (delete base.__content, base);
      old.data = body ? { ...next, __content: body } : next;
    }
    const { error } = await tbl(supabase, 'collection_rows').update(old).eq('id', id);
    return error ? { error: error.message as string } : { ok: true };
  }
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) upd.title = patch.title;
  if (patch.data !== undefined) upd.properties = patch.data;
  if (patch.content !== undefined) upd.content = patch.content;
  if (patch.order !== undefined) upd.row_order = patch.order;
  // `database_id is not null` is a guard, not a filter: it makes this action
  // incapable of writing a standalone document even if it were handed a
  // document's id. The two share a table now, so the reach has to be narrowed
  // deliberately.
  const { error } = await tbl(supabase, 'pages').update(upd).eq('id', id).not('database_id', 'is', null);
  return error ? { error: error.message as string } : { ok: true };
}

export async function deleteDbRow(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = (await rowsArePagesSupported(supabase))
    ? await tbl(supabase, 'pages').delete().eq('id', id).not('database_id', 'is', null)
    : await tbl(supabase, 'collection_rows').delete().eq('id', id);
  return error ? { error: error.message as string } : { ok: true };
}
