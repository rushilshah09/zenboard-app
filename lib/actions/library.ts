'use server';
// Library mutations — folders + pages (notes/docs). RLS scopes to the user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}
async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

export async function addFolder(name: string, parentFolderId?: string | null): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('folders')
    .insert({ user_id: user.id, space_id: sid, name: name.trim() || 'Folder', parent_folder_id: parentFolderId ?? null }).select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add folder.' };
  return { id: data.id };
}

export async function addPage(input: { folderId?: string | null; title?: string; projectId?: string | null; type?: string }): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const { data, error } = await supabase.from('pages')
    // Empty title by default (Notion-style) so the editor shows the light "New
    // page" placeholder rather than a hard "Untitled" value; lists fall back to
    // "Untitled" only for display.
    .insert({ user_id: user.id, space_id: sid, folder_id: input.folderId ?? null, project_id: input.projectId ?? null, title: input.title?.trim() ?? '', type: input.type ?? 'note', content: { blocks: [] }, tags: [] })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not add page.' };
  return { id: data.id };
}

// Fetch a single page's editable content (RLS scopes to the owner).
export async function getPage(id: string): Promise<{ error: string } | { id: string; title: string | null; content: Record<string, unknown> }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from('pages').select('id, title, content').eq('id', id).maybeSingle();
  if (error || !data) return { error: error?.message ?? 'Not found.' };
  return { id: data.id, title: data.title, content: (data.content as Record<string, unknown>) ?? { blocks: [] } };
}

export async function updatePage(id: string, patch: { title?: string; content?: Record<string, unknown>; tags?: string[]; folder_id?: string | null; icon?: string | null }): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('pages').update(patch).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Persist drag reorder / re-parent. Each item carries its new folder and order.
// sort_index needs migration 0007; if it isn't applied we still persist the
// folder move (folder_id) so dragging between folders works regardless.
export async function movePages(updates: { id: string; folderId: string | null; sortIndex: number; parentId?: string | null }[]): Promise<{ error: string } | { ok: true; sortPersisted: boolean }> {
  const { supabase } = await requireUser();
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
  const { supabase } = await requireUser();
  const { error } = await supabase.from('pages').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// ── Page organization (0007 columns) ──
export async function setPagePinned(id: string, pinned: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('pages').update({ is_pinned: pinned }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
export async function setPageFavorite(id: string, favorite: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('pages').update({ is_favorite: favorite }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
export async function archivePage(id: string, archived: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('pages').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Deep-copy a page (title + content) into the same folder/parent.
export async function duplicatePage(id: string): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await requireUser();
  const { data: src } = await supabase.from('pages').select('space_id, folder_id, parent_id, title, type, content, tags, icon').eq('id', id).maybeSingle();
  if (!src) return { error: 'Not found.' };
  const { data, error } = await supabase.from('pages').insert({
    user_id: user.id, space_id: src.space_id, folder_id: src.folder_id, parent_id: src.parent_id,
    title: `${src.title?.trim() || 'Untitled'} copy`, type: src.type, content: src.content, tags: src.tags, icon: src.icon,
  }).select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not duplicate.' };
  return { id: data.id };
}
