// The active space (workspace / "organization"). Spaces scope what you see and
// where new items land. The choice lives in a cookie so server components and
// server actions resolve the same value. Falls back to the first space (by
// sort_order), creating a default "Personal" space if the account has none.
// RLS still scopes every row to the user — the space_id filter is additive.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import type { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export const SPACE_COOKIE = 'zb-space';

/** Derived from the schema, not hand-written, so it cannot drift from the table. */
export type SpaceRow = Pick<
  Database['public']['Tables']['spaces']['Row'],
  'id' | 'name' | 'emoji' | 'color' | 'tag'
>;

/**
 * The space list, fetched at most once per request.
 *
 * `activeSpaceId` is called from the layout AND from the page's loader on every
 * navigation, and the layout then fetched `spaces` a third time for the switcher
 * — three round trips (~660ms) for a list that cannot change mid-render.
 *
 * The memo lives on this zero-argument function rather than on `activeSpaceId`
 * itself: `cache()` keys on arguments, and `activeSpaceId` takes a client object
 * that is a different reference at every call site, so wrapping it would never
 * hit. Callers keep their existing signature.
 *
 * It selects the switcher's columns too, so the layout can render the switcher
 * from this one query instead of issuing its own.
 */
export const spaceList = cache(async (): Promise<SpaceRow[]> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('spaces').select('id, name, emoji, color, tag').order('sort_order');
  return (data ?? []) as SpaceRow[];
});

export async function activeSpaceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const list = await spaceList();
  if (list.length === 0) {
    const { data: made, error } = await supabase
      .from('spaces')
      .insert({ user_id: userId, name: 'Personal', emoji: '🌿', color: '#7B8B5F', tag: 'LIFE' })
      .select('id').single();
    if (error || !made) throw new Error(error?.message ?? 'Could not create a space.');
    return made.id;
  }
  const want = (await cookies()).get(SPACE_COOKIE)?.value;
  return want && list.some((s) => s.id === want) ? want : list[0].id;
}
