'use server';
// Collection (database) mutations — Notion-style databases hosted by pages of
// type 'database'. RLS scopes everything to the user; needs migration 0013.
//
// The generated Supabase types don't include the 0013 tables until typegen is
// re-run after the migration is applied, so these actions talk to the tables
// through a deliberately untyped accessor (results are cast at the edges).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { defaultCollection, type Collection, type DbRow, type PropDef, type ViewDef } from '@/lib/collections';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}
const tbl = (supabase: unknown, table: string): any => (supabase as { from: (t: string) => any }).from(table);

// Loads the collection hosted by a page, creating it (with the default
// Name/Status/Tags schema) on first open — so any page of type 'database'
// becomes a working database with zero extra setup.
export async function getDatabase(pageId: string): Promise<{ error: string } | { collection: Collection; rows: DbRow[] }> {
  const { supabase, user } = await requireUser();
  const found = await tbl(supabase, 'collections')
    .select('id, page_id, name, props, views').eq('page_id', pageId).maybeSingle();
  if (found.error) return { error: found.error.message as string };
  let col = found.data as Collection | null;
  if (!col) {
    const sid = await activeSpaceId(supabase, user.id);
    const def = defaultCollection();
    const ins = await tbl(supabase, 'collections')
      .insert({ user_id: user.id, space_id: sid, page_id: pageId, props: def.props, views: def.views })
      .select('id, page_id, name, props, views').single();
    if (ins.error || !ins.data) return { error: (ins.error?.message as string) ?? 'Could not create database.' };
    col = ins.data as Collection;
  }
  const rowsRes = await tbl(supabase, 'collection_rows')
    .select('id, title, data, sort_index, created_at, updated_at')
    .eq('collection_id', col.id).order('sort_index');
  if (rowsRes.error) return { error: rowsRes.error.message as string };
  return { collection: col, rows: (rowsRes.data as DbRow[]) ?? [] };
}

// Standalone collection for an inline database block (page_id stays null —
// the block carries the collection id in the page content). Seeds one empty
// row so the new database is immediately editable (Notion's default state).
export async function createCollection(viewKind?: ViewDef['kind']): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await activeSpaceId(supabase, user.id);
  const def = defaultCollection();
  if (viewKind && def.views[0]) def.views[0] = { ...def.views[0], kind: viewKind, name: viewKind.charAt(0).toUpperCase() + viewKind.slice(1) };
  const ins = await tbl(supabase, 'collections')
    .insert({ user_id: user.id, space_id: sid, name: '', props: def.props, views: def.views })
    .select('id').single();
  if (ins.error || !ins.data) return { error: (ins.error?.message as string) ?? 'Could not create database.' };
  const id = ins.data.id as string;
  await tbl(supabase, 'collection_rows')
    .insert({ collection_id: id, user_id: user.id, space_id: sid, title: '', data: {}, sort_index: Date.now() });
  return { id };
}

// All of the user's databases — for the "Linked view of database" picker.
export async function listCollections(): Promise<{ error: string } | { collections: { id: string; name: string; page_id: string | null }[] }> {
  const { supabase } = await requireUser();
  const res = await tbl(supabase, 'collections')
    .select('id, name, page_id').order('updated_at', { ascending: false });
  if (res.error) return { error: res.error.message as string };
  return { collections: (res.data as { id: string; name: string; page_id: string | null }[]) ?? [] };
}

// "Turn into page": hands an inline collection to a page of type 'database'.
// The inline block keeps rendering the same collection — it becomes a linked
// view of the new page's database (Notion's replacement behavior).
export async function attachCollectionToPage(id: string, pageId: string): Promise<{ error: string } | { ok: true; name: string }> {
  const { supabase } = await requireUser();
  const res = await tbl(supabase, 'collections')
    .update({ page_id: pageId, updated_at: new Date().toISOString() })
    .eq('id', id).select('name').single();
  if (res.error || !res.data) return { error: (res.error?.message as string) ?? 'Could not convert database.' };
  return { ok: true, name: (res.data.name as string) ?? '' };
}

// Loads a collection by id (inline database blocks).
export async function getCollection(id: string): Promise<{ error: string } | { collection: Collection; rows: DbRow[] }> {
  const { supabase } = await requireUser();
  const found = await tbl(supabase, 'collections')
    .select('id, page_id, name, props, views').eq('id', id).maybeSingle();
  if (found.error) return { error: found.error.message as string };
  if (!found.data) return { error: 'Database not found.' };
  const rowsRes = await tbl(supabase, 'collection_rows')
    .select('id, title, data, sort_index, created_at, updated_at')
    .eq('collection_id', id).order('sort_index');
  if (rowsRes.error) return { error: rowsRes.error.message as string };
  return { collection: found.data as Collection, rows: (rowsRes.data as DbRow[]) ?? [] };
}

export async function updateCollection(id: string, patch: { name?: string; props?: PropDef[]; views?: ViewDef[] }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await tbl(supabase, 'collections')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  return error ? { error: error.message as string } : { ok: true };
}

export async function addDbRow(collectionId: string, input: { title?: string; data?: Record<string, unknown>; sortIndex?: number }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await activeSpaceId(supabase, user.id);
  const { data, error } = await tbl(supabase, 'collection_rows')
    .insert({ collection_id: collectionId, user_id: user.id, space_id: sid, title: input.title ?? '', data: input.data ?? {}, sort_index: input.sortIndex ?? Date.now() })
    .select('id').single();
  if (error || !data) return { error: (error?.message as string) ?? 'Could not add row.' };
  return { id: data.id as string };
}

export async function updateDbRow(id: string, patch: { title?: string; data?: Record<string, unknown>; sortIndex?: number }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) upd.title = patch.title;
  if (patch.data !== undefined) upd.data = patch.data;
  if (patch.sortIndex !== undefined) upd.sort_index = patch.sortIndex;
  const { error } = await tbl(supabase, 'collection_rows').update(upd).eq('id', id);
  return error ? { error: error.message as string } : { ok: true };
}

export async function deleteDbRow(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await tbl(supabase, 'collection_rows').delete().eq('id', id);
  return error ? { error: error.message as string } : { ok: true };
}
