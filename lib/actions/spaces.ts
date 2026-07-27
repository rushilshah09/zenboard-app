'use server';
// Spaces (workspaces / "organizations"). Create a space and switch the active
// one. The active space is stored in a cookie (SPACE_COOKIE) so server reads are
// consistent; creating a space switches into it. RLS scopes spaces to the owner.
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SPACE_COOKIE } from '@/lib/active-space';
import type { SpaceTag } from '@/types/database';

const COOKIE_OPTS = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const };

export async function createSpace(input: { name: string; emoji?: string; color?: string; tag?: SpaceTag }): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const name = input.name.trim();
  if (!name) return { error: 'Name your space.' };

  const { data: last } = await supabase.from('spaces').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort = ((last?.sort_order as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from('spaces')
    .insert({ user_id: user.id, name, emoji: input.emoji || '✦', color: input.color || '#7B8B5F', tag: input.tag ?? 'WORK', sort_order: sort })
    .select('id').single();
  if (error || !data) return { error: error?.message ?? 'Could not create space.' };

  (await cookies()).set(SPACE_COOKIE, data.id, COOKIE_OPTS); // switch into the new space
  return { id: data.id };
}

export async function setActiveSpace(id: string): Promise<{ ok: true }> {
  (await cookies()).set(SPACE_COOKIE, id, COOKIE_OPTS);
  return { ok: true };
}
