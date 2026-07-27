// Documents — folders + pages (notes/docs) in a space, with a file browser
// ("Organize"), breadcrumb navigation, the folder-tree rail, and a Notion-style
// block editor. Folders/pages nest at any depth (RLS-scoped to the space).
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { DocumentsView, type Folder, type Page } from '@/components/documents/documents-view';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);

  const [{ data: space }, { data: folders }, { data: profile }] = await Promise.all([
    supabase.from('spaces').select('name').eq('id', sid).maybeSingle(),
    supabase.from('folders').select('id, name, parent_folder_id, sort_order, created_at').eq('space_id', sid).order('sort_order'),
    supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
  ]);
  const userName = profile?.full_name?.trim() || user!.email?.split('@')[0] || 'You';
  const userInitial = userName.charAt(0).toUpperCase();

  // Prefer the 0007 column set (sort_index, pins, etc.); fall back if not applied.
  let pages: Page[] | null;
  const withSort = await supabase.from('pages').select('id, folder_id, parent_id, title, type, content, tags, updated_at, created_at, sort_index, is_pinned, is_favorite, archived_at, icon').eq('space_id', sid).order('sort_index').order('updated_at', { ascending: false });
  if (withSort.error) {
    pages = (await supabase.from('pages').select('id, folder_id, title, type, content, tags, updated_at, created_at').eq('space_id', sid).order('updated_at', { ascending: false })).data as Page[] | null;
  } else {
    pages = withSort.data as Page[] | null;
  }

  return (
    <DocumentsView
      initialFolders={(folders as Folder[]) ?? []}
      initialPages={pages ?? []}
      initialPageId={page ?? null}
      spaceName={space?.name ?? 'Documents'}
      userInitial={userInitial}
      userName={userName}
    />
  );
}
