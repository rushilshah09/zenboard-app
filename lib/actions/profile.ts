'use server';
// Profile (account) mutations. RLS scopes the row to the signed-in user.
import { createClient } from '@/lib/supabase/server';

export type ProfileRole = 'individual' | 'freelancer' | 'founder';

export async function updateProfile(patch: {
  full_name?: string | null;
  hourly_rate?: number;
  role?: ProfileRole | null;
  onboarding_complete?: boolean;
}): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  // upsert so a missing profile row is created rather than silently no-op'ing
  const { error } = await supabase.from('profiles').upsert({ id: user.id, ...patch }, { onConflict: 'id' });
  return error ? { error: error.message } : { ok: true };
}

// Merge keys into the profiles.preferences jsonb WITHOUT clobbering the others
// (accent/density/gcal metadata all live there) — same read-merge-write pattern
// as the Google-Calendar sync writer. Used by onboarding to store the day-end
// time (preferences.dayEnd) the shutdown ritual + capacity line read later.
export async function updatePreferences(patch: Record<string, unknown>): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const preferences = { ...((prof?.preferences as Record<string, unknown>) ?? {}), ...patch };
  const { error } = await supabase.from('profiles').upsert({ id: user.id, preferences }, { onConflict: 'id' });
  return error ? { error: error.message } : { ok: true };
}
