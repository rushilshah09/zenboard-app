// The active space (workspace / "organization"). Spaces scope what you see and
// where new items land. The choice lives in a cookie so server components and
// server actions resolve the same value. Falls back to the first space (by
// sort_order), creating a default "Personal" space if the account has none.
// RLS still scopes every row to the user — the space_id filter is additive.
import { cookies } from 'next/headers';
import type { createClient } from '@/lib/supabase/server';

export const SPACE_COOKIE = 'zb-space';

export async function activeSpaceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase.from('spaces').select('id').order('sort_order');
  const list = (data ?? []) as { id: string }[];
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
