'use server';
// Saved-view mutations (migration 0015). A saved view is a named filter combo
// recalled from the Tasks rail. Reads happen through the browser client
// (RLS-scoped) so the surface can probe support and degrade gracefully; writes
// go through here. The 0015 table isn't in the generated DB types until typegen
// is re-run, so we go through a deliberately untyped accessor (cast at edges),
// matching lib/actions/collections.ts / labels.ts.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (supabase: unknown, table: string): any => (supabase as { from: (t: string) => any }).from(table);

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

export type SavedFilter = { view?: string; filter?: string; labelId?: string | null; listId?: string | null };

export async function createSavedView(name: string, filter: SavedFilter): Promise<{ error: string } | { id: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'View name is required' };
  const { supabase, user } = await requireUser();
  const spaceId = await activeSpaceId(supabase, user.id);
  const { data: last } = await tbl(supabase, 'saved_views').select('sort_order').eq('space_id', spaceId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await tbl(supabase, 'saved_views')
    .insert({ user_id: user.id, space_id: spaceId, name: trimmed, filter, sort_order: ((last?.sort_order as number | null) ?? -1) + 1 })
    .select('id').single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function deleteSavedView(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await tbl(supabase, 'saved_views').delete().eq('id', id).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}
