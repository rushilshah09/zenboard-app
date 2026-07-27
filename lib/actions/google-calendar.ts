'use server';
// Google Calendar connection actions — pull-sync (Google → Zenboard) and
// disconnect. Connect + the first import happen via the OAuth callback; this
// pull re-fetches later Google changes using the stored refresh token (no
// re-consent). RLS scopes event/profile writes; tokens live behind the service role.
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getValidAccessToken, importGoogleEvents } from '@/lib/google-calendar';

// Pull the latest Google events into Zenboard. Refreshes the access token via the
// stored refresh token if needed. Returns skipped when not connected.
export async function syncGoogleCalendar(): Promise<{ error: string } | { ok: true; count: number } | { skipped: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const conn = await getValidAccessToken(createServiceClient(), user.id);
  if (!conn) return { skipped: true };
  const res = await importGoogleEvents(supabase, user.id, conn.token);
  if ('error' in res) return { error: res.error };
  return { ok: true, count: res.count };
}

export async function disconnectGoogleCalendar(): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const del = await supabase.from('calendar_events').delete().eq('user_id', user.id).eq('source', 'google');
  if (del.error) return { error: del.error.message };

  // Remove stored OAuth tokens (service-role — table is locked to the server).
  try { await createServiceClient().from('calendar_connections').delete().eq('user_id', user.id); } catch { /* best-effort */ }

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
  delete prefs.gcal_connected;
  delete prefs.gcal_last_synced;
  delete prefs.gcal_event_count;
  const upd = await supabase.from('profiles').update({ preferences: prefs }).eq('id', user.id);
  return upd.error ? { error: upd.error.message } : { ok: true };
}
