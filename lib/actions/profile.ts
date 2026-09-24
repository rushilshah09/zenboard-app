'use server';
// Profile (account) mutations. RLS scopes the row to the signed-in user.
import { createClient } from '@/lib/supabase/server';
import { FEED_TOKEN_KEY, newFeedToken, looksLikeFeedToken } from '@/lib/calendar-feed';

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

// ── Calendar feed (principle 11 · "your plan in any calendar app") ────────────

/**
 * The subscribe URL, minting a token on first ask.
 *
 * Lazy on purpose: a token that exists is a live URL into someone's schedule, so
 * accounts that never subscribe never have one. It is stored in the same
 * `preferences` jsonb as everything else here, which is why this whole feature
 * needs no migration.
 */
export async function getCalendarFeedToken(): Promise<{ error: string } | { token: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = (prof?.preferences as Record<string, unknown>) ?? {};
  const existing = prefs[FEED_TOKEN_KEY];
  if (typeof existing === 'string' && looksLikeFeedToken(existing)) return { token: existing };

  const token = newFeedToken();
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, preferences: { ...prefs, [FEED_TOKEN_KEY]: token } }, { onConflict: 'id' });
  return error ? { error: error.message } : { token };
}

/**
 * Rotate the token — every existing subscription stops updating immediately.
 *
 * The only defence a bearer URL has. It is destructive in a way a dialog cannot
 * undo, so the caller confirms first; here it is a plain write.
 */
export async function rotateCalendarFeedToken(): Promise<{ error: string } | { token: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = (prof?.preferences as Record<string, unknown>) ?? {};
  const token = newFeedToken();
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, preferences: { ...prefs, [FEED_TOKEN_KEY]: token } }, { onConflict: 'id' });
  return error ? { error: error.message } : { token };
}

/** Turn the feed off entirely: the token is removed and the URL 404s. */
export async function disableCalendarFeed(): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
  delete prefs[FEED_TOKEN_KEY];
  const { error } = await supabase.from('profiles').upsert({ id: user.id, preferences: prefs }, { onConflict: 'id' });
  return error ? { error: error.message } : { ok: true };
}
