// Documents — folders + pages (notes/docs) in a space, with a file browser
// ("Organize"), breadcrumb navigation, the folder-tree rail, and a Notion-style
// block editor. Folders/pages nest at any depth (RLS-scoped to the space).
import { spaceList } from '@/lib/active-space';
import { DocumentsView, type Folder, type Page } from '@/components/documents/documents-view';
import { commentsSupported } from '@/lib/actions/comments';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';
import { currentProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const { supabase, user, sid } = await pageScope();

  // `spaceList` is request-memoized (the layout already asked for it), so the
  // breadcrumb's workspace switcher costs no extra round trip — and it makes
  // the `spaces` query that used to fetch this space's name redundant.
  // `commentsSupported` rides this wave rather than being asked for from the
  // client: it is a zero-row probe the server can answer for free, and the
  // alternative is a round trip before the editor knows whether to offer the
  // "Comment" action at all (§7H, 0037).
  // The pages go out in the SAME wave as the folders; they used to wait for it,
  // though neither read needs the other. The display name comes from the profile
  // the page scope has already read, instead of a second profiles query.
  const [spaces, { data: folders }, profile, commentsEnabled, pages] = await Promise.all([
    spaceList(),
    supabase.from('folders').select('id, name, parent_folder_id, sort_order, created_at').eq('space_id', sid).order('sort_order'),
    currentProfile(),
    commentsSupported(supabase),
    // Prefer the 0007 column set (sort_index, pins, etc.); fall back if not applied.
    // project_id / client_id feed <DocLinks> + the Connected panel (§3.4). They are
    // in the 0007 column set, so they ride along with the preferred select and are
    // simply absent (undefined) on the fallback path.
    // `database_id is null` = a STANDALONE document. Since 0028 every database row
    // is also a `pages` row, so without this filter the Docs hub would list every
    // row of every database as a loose document. A row belongs to its database and
    // is reached through it, never through this hub.
    (async (): Promise<Page[] | null> => {
      const withSort = await supabase.from('pages').select('id, folder_id, parent_id, title, type, content, tags, updated_at, created_at, sort_index, is_pinned, is_favorite, archived_at, icon, project_id, client_id').eq('space_id', sid).is('database_id', null).order('sort_index').order('updated_at', { ascending: false });
      if (!withSort.error) return withSort.data as Page[] | null;
      // Pre-0028 fallback: no `database_id` column, so nothing to exclude.
      return (await supabase.from('pages').select('id, folder_id, title, type, content, tags, updated_at, created_at').eq('space_id', sid).order('updated_at', { ascending: false })).data as Page[] | null;
    })(),
  ]);
  const userName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'You';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <>
      <PageStamp />
      <DocumentsView
        initialFolders={(folders as Folder[]) ?? []}
        initialPages={pages ?? []}
        initialPageId={page ?? null}
        userInitial={userInitial}
        userName={userName}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, emoji: s.emoji }))}
        activeSpaceId={sid}
        commentsEnabled={commentsEnabled}
      />
    </>
  );
}
