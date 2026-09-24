'use server';
// Library mutations — folders + pages (notes/docs). RLS scopes to the user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';

async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

export async function addFolder(name: string, parentFolderId?: string | null): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('folders')
    .insert({ user_id: user.id, space_id: sid, name: name.trim() || 'Folder', parent_folder_id: parentFolderId ?? null }).select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add folder.' };
  return { id: data.id };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addPage(input: {
  folderId?: string | null; title?: string; projectId?: string | null; type?: string;
  /**
   * An id the browser minted (`mintUuid`), so the page a block points at is final
   * from its first frame — a page made from `/page` inside another page is on
   * screen, linked and openable before this call returns. Omit and the database
   * picks one.
   */
  id?: string;
  /** The page it sits inside. One insert, so a child is never briefly a root page. */
  parentId?: string | null;
}): Promise<{ error: string } | { id: string }> {
  // Checked before anything is asked of the database: a malformed id would come
  // back as Postgres's own words, which nothing in the app may print.
  if ((input.id !== undefined && !UUID.test(input.id)) || (input.parentId && !UUID.test(input.parentId))) {
    return { error: 'Could not add page: invalid id.' };
  }
  const { supabase, user } = await requireSession();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('pages')
    // Empty title by default (Notion-style) so the editor shows the light "New
    // page" placeholder rather than a hard "Untitled" value; lists fall back to
    // "Untitled" only for display.
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: user.id, space_id: sid, folder_id: input.folderId ?? null, project_id: input.projectId ?? null,
      ...(input.parentId ? { parent_id: input.parentId } : {}),
      title: input.title?.trim() ?? '', type: input.type ?? 'note', content: { blocks: [] }, tags: [],
    })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add page.' };
  return { id: data.id };
}

// Fetch a single page's editable content (RLS scopes to the owner).
export async function getPage(id: string): Promise<{ error: string } | { id: string; title: string | null; content: Record<string, unknown>; icon: string | null; parentId: string | null; type: string }> {
  if (!UUID.test(id)) return { error: 'Not found.' };
  const { supabase } = await requireSession();
  const { data, error } = await supabase.from('pages').select('id, title, content, icon, parent_id, type').eq('id', id).maybeSingle();
  if (error || !data) return { error: error?.message ?? 'Not found.' };
  return {
    id: data.id, title: data.title, content: (data.content as Record<string, unknown>) ?? { blocks: [] },
    icon: (data.icon as string | null) ?? null, parentId: (data.parent_id as string | null) ?? null,
    // What kind of page it is — a document, a database, a Collection — so a page opened from a link
    // opens as itself (COLLECTION_ITEM_BRIEF).
    type: (data.type as string | null) ?? 'note',
  };
}

export async function updatePage(id: string, patch: { title?: string; content?: Record<string, unknown>; tags?: string[]; folder_id?: string | null; icon?: string | null }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('pages').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Attach a doc to a project and/or a client (master plan §3.4, "structural
// links already in FKs — mirrored automatically").
//
// Both columns have existed since 0007 and the Connected panel reads them, but
// nothing could ever WRITE them from Documents: `project_id` was settable only
// at creation, and only from Project Docs, while `client_id` had no writer
// anywhere in the app. So a doc's Connected panel was empty by construction.
//
// `undefined` leaves a column alone; `null` clears it. That distinction matters —
// setting a project must not silently unset a client.
export async function setPageLinks(
  id: string,
  links: { projectId?: string | null; clientId?: string | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const patch: { project_id?: string | null; client_id?: string | null } = {};
  if (links.projectId !== undefined) patch.project_id = links.projectId;
  if (links.clientId !== undefined) patch.client_id = links.clientId;
  if (!Object.keys(patch).length) return { ok: true };
  const { error } = await supabase.from('pages').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Persist drag reorder / re-parent. Each item carries its new folder and order.
// sort_index needs migration 0007; if it isn't applied we still persist the
// folder move (folder_id) so dragging between folders works regardless.
export async function movePages(updates: { id: string; folderId: string | null; sortIndex: number; parentId?: string | null }[]): Promise<{ error: string } | { ok: true; sortPersisted: boolean }> {
  const { supabase } = await requireSession();
  let sortPersisted = true;
  for (const u of updates) {
    const patch: { folder_id: string | null; sort_index: number; parent_id?: string | null } = { folder_id: u.folderId, sort_index: u.sortIndex };
    if (u.parentId !== undefined) patch.parent_id = u.parentId;
    const full = await supabase.from('pages').update(patch).eq('id', u.id);
    if (full.error) {
      sortPersisted = false;
      const fb = await supabase.from('pages').update({ folder_id: u.folderId, ...(u.parentId !== undefined ? { parent_id: u.parentId } : {}) }).eq('id', u.id);
      if (fb.error) return { error: fb.error.message };
    }
  }
  return { ok: true, sortPersisted };
}

export async function deletePage(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('pages').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// ── Page organization (0007 columns) ──
export async function setPagePinned(id: string, pinned: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('pages').update({ is_pinned: pinned }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
export async function setPageFavorite(id: string, favorite: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('pages').update({ is_favorite: favorite }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
export async function archivePage(id: string, archived: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('pages').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Deep-copy a page (title + content) into the same folder/parent.
export async function duplicatePage(id: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireSession();
  const { data: src } = await supabase.from('pages').select('space_id, folder_id, parent_id, title, type, content, tags, icon').eq('id', id).maybeSingle();
  if (!src) return { error: 'Not found.' };
  const { data, error } = await supabase.from('pages').insert({
    user_id: user.id, space_id: src.space_id, folder_id: src.folder_id, parent_id: src.parent_id,
    title: `${src.title?.trim() || 'Untitled'} copy`, type: src.type, content: src.content, tags: src.tags, icon: src.icon,
  }).select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not duplicate.' };
  return { id: data.id };
}

/**
 * Batch-import parsed Notion pages as documents (§7S).
 *
 * Everything lands unfiled — no folder — for the same reason `importTasks` lands
 * in the Inbox: an import that scatters pages into a structure the user did not
 * choose is harder to undo than one that leaves them in a pile.
 *
 * Notion's per-page properties come across as `content.props`, the same shape
 * the page property editor reads (lib/properties.ts), so they are visible and
 * editable rather than silently dropped. They arrive as `text` — typing them is
 * a later job, and a wrong type is worse than an honest string.
 */
export async function importDocs(
  docs: { title: string; blocks: unknown[]; properties: { name: string; value: string }[] }[],
): Promise<{ error: string } | { count: number }> {
  const { supabase, user } = await requireSession();
  const spaceId = await activeSpaceId(supabase, user.id);
  const clean = docs.slice(0, 500);
  if (!clean.length) return { count: 0 };

  const rows = clean.map((d) => ({
    user_id: user.id,
    space_id: spaceId,
    title: d.title.trim() || 'Untitled',
    type: 'note',
    content: {
      blocks: d.blocks,
      ...(d.properties.length
        ? {
            props: d.properties.map((p, i) => ({
              id: `imp${i}`, name: p.name, type: 'text', value: p.value,
            })),
          }
        : {}),
    },
    tags: [] as string[],
  }));

  const { data, error } = await supabase.from('pages').insert(rows).select('id');
  if (error) return { error: error.message };
  return { count: data?.length ?? clean.length };
}
