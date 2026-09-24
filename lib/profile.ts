import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';

export type ProfileRow = { full_name: string | null; preferences: unknown };

/**
 * The signed-in user's profile row, fetched at most once per request.
 *
 * Two different things want this row on every single navigation — the (app)
 * layout, for the display name and the stored timezone, and `userTimezone()`,
 * for the timezone alone — and each was issuing its own query. Same row, same
 * request, ~220ms apiece.
 *
 * Selecting both columns here means one round trip answers both questions. Any
 * new caller that needs something off `profiles` should widen this select rather
 * than add a query.
 */
export const currentProfile = cache(async (): Promise<ProfileRow | null> => {
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles').select('full_name, preferences').eq('id', user.id).maybeSingle();
  return (data as ProfileRow | null) ?? null;
});
