// Google Calendar two-way sync. Pulls the user's primary calendar into
// calendar_events (source='google') and pushes Zenboard changes back to Google.
// OAuth tokens are captured in the auth callback and stored server-only in
// calendar_connections (service-role). Access tokens are refreshed here with the
// app's GOOGLE_OAUTH_CLIENT_ID/SECRET env vars.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type SB = SupabaseClient<Database>;

// Read/write calendar scope (needed for write-back) + email for the account label.
export const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar email';

// Import window: a little behind, ~60 days ahead. Keeps the mirror bounded.
const PAST_DAYS = 1;
const AHEAD_DAYS = 60;

export type GEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export type EventRow = {
  user_id: string; space_id: string | null; title: string;
  starts_at: string; ends_at: string | null; all_day: boolean; source: string; external_id: string | null;
};

/**
 * Google's events → Zenboard rows. PURE, and separated from the fetch so the
 * mapping can be argued with in a test rather than only through a live account —
 * which matters here more than usual, because the live half needs someone's real
 * Google consent and cannot be exercised from a test at all.
 *
 * TWO SHAPES, and Google distinguishes them by WHICH FIELD IS PRESENT rather
 * than by a flag: a timed event carries `dateTime`, an all-day event carries
 * `date`. Everything below follows from that.
 */
export function mapGoogleEvents(items: GEvent[], userId: string, spaceId: string | null): EventRow[] {
  return items
    .filter((e) => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
    .map((e) => {
      const allDay = !!e.start?.date && !e.start?.dateTime;
      const startsAt = e.start?.dateTime ?? new Date(`${e.start!.date}T00:00:00Z`).toISOString();
      // An all-day event kept NO end at all, so a three-day conference arrived
      // as a single day and left the feed claiming the wrong thing. Google's
      // `end.date` is EXCLUSIVE, which is also what ICS DTEND means and what
      // lib/ics.ts already assumed — so it carries across unchanged.
      const endsAt = allDay
        ? (e.end?.date ? new Date(`${e.end.date}T00:00:00Z`).toISOString() : null)
        : (e.end?.dateTime ?? null);
      return {
        user_id: userId,
        space_id: spaceId,
        title: (e.summary?.trim() || '(no title)').slice(0, 500),
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDay,
        source: 'google',
        external_id: e.id ?? null,
      };
    });
}

// Fetch + map the primary calendar's events in the window. Recurring events are
// expanded into instances (singleEvents=true), so a weekly meeting shows on each day.
async function fetchPrimaryEvents(
  accessToken: string, userId: string, spaceId: string | null,
): Promise<{ ok: false; error: string } | { ok: true; rows: EventRow[] }> {
  const timeMin = new Date(Date.now() - PAST_DAYS * 86400000).toISOString();
  const timeMax = new Date(Date.now() + AHEAD_DAYS * 86400000).toISOString();
  const url =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
    `?singleEvents=true&orderBy=startTime&maxResults=250` +
    `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'Google access expired — reconnect to sync.' };
  if (!res.ok) return { ok: false, error: 'Could not reach Google Calendar. Try again.' };

  const json = (await res.json()) as { items?: GEvent[] };
  return { ok: true, rows: mapGoogleEvents(json.items ?? [], userId, spaceId) };
}

// Replace the user's google events with a fresh window and record sync metadata
// in profiles.preferences (merged, never clobbering other prefs). RLS scopes all
// writes to the user via the passed (cookie-auth) client.
export async function importGoogleEvents(
  supabase: SB,
  userId: string,
  accessToken: string,
): Promise<{ count: number } | { error: string }> {
  const { data: space } = await supabase.from('spaces').select('id').order('sort_order').limit(1).maybeSingle();
  const spaceId = space?.id ?? null;

  const fetched = await fetchPrimaryEvents(accessToken, userId, spaceId);
  if (!fetched.ok) return { error: fetched.error };
  const rows = fetched.rows;

  // Mirror: drop the user's existing google events, then insert the fresh window.
  const del = await supabase.from('calendar_events').delete().eq('user_id', userId).eq('source', 'google');
  if (del.error) return { error: del.error.message };
  if (rows.length) {
    const ins = await supabase.from('calendar_events').insert(rows);
    if (ins.error) return { error: ins.error.message };
  }

  // Merge sync metadata into preferences.
  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', userId).maybeSingle();
  const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
  prefs.gcal_connected = true;
  prefs.gcal_last_synced = new Date().toISOString();
  prefs.gcal_event_count = rows.length;
  await supabase.from('profiles').update({ preferences: prefs }).eq('id', userId);

  return { count: rows.length };
}

// ── Connection + token management (service-role only) ──────────────────────────
// `service` MUST be the service-role client — calendar_connections has RLS on with
// no policies, so the anon/authenticated clients can't touch it.

export async function storeConnection(
  service: SB,
  userId: string,
  conn: { accessToken: string | null; refreshToken: string | null; expiresInSec?: number | null; email?: string | null },
): Promise<void> {
  const expiresAt = conn.expiresInSec ? new Date(Date.now() + conn.expiresInSec * 1000).toISOString() : null;
  // Don't blow away an existing refresh_token if Google didn't send a new one
  // (it only returns it on the first consent / prompt=consent).
  const row: {
    user_id: string; provider: string; calendar_id: string; updated_at: string;
    access_token?: string; refresh_token?: string; token_expires_at?: string; account_email?: string;
  } = { user_id: userId, provider: 'google', calendar_id: 'primary', updated_at: new Date().toISOString() };
  if (conn.accessToken) row.access_token = conn.accessToken;
  if (conn.refreshToken) row.refresh_token = conn.refreshToken;
  if (expiresAt) row.token_expires_at = expiresAt;
  if (conn.email) row.account_email = conn.email;
  await service.from('calendar_connections').upsert(row, { onConflict: 'user_id,provider' });
}

// Read the connection and return a non-expired access token, refreshing via
// Google's token endpoint if needed. Returns null if not connected / unrefreshable.
export async function getValidAccessToken(
  service: SB,
  userId: string,
): Promise<{ token: string; calendarId: string } | null> {
  const { data: conn } = await service.from('calendar_connections').select('*').eq('user_id', userId).eq('provider', 'google').maybeSingle();
  if (!conn) return null;
  const calendarId = conn.calendar_id || 'primary';
  const stillValid = conn.access_token && conn.token_expires_at && new Date(conn.token_expires_at).getTime() > Date.now() + 60000;
  if (stillValid) return { token: conn.access_token as string, calendarId };

  if (!conn.refresh_token) return conn.access_token ? { token: conn.access_token, calendarId } : null;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID, clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return conn.access_token ? { token: conn.access_token, calendarId } : null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: conn.refresh_token, grant_type: 'refresh_token' }),
  });
  if (!res.ok) {
    // A DEAD GRANT IS NOT A FAILED REQUEST. Google answers `invalid_grant` when
    // the refresh token has been revoked, expired (apps still in "Testing"
    // publishing status get seven days), or the account password changed —
    // none of which any amount of retrying fixes. Left alone, the connection row
    // survives forever: every sync spends a round trip to be told the same
    // thing, the app keeps offering a Sync button that cannot work, and the user
    // is never told the one thing they need to know, which is to reconnect.
    //
    // A transient failure is the opposite and must NOT clear anything, or a
    // flaky minute would silently sign someone out of their calendar.
    if (await isRevoked(res)) await forgetConnection(service, userId);
    return null;
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  await service.from('calendar_connections').update({
    access_token: j.access_token,
    token_expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'google');
  return { token: j.access_token, calendarId };
}

/**
 * Is this refresh failure permanent?
 *
 * Pure enough to test: the decision is entirely "what did Google say", and
 * getting it wrong in either direction is costly — treating a transient blip as
 * fatal disconnects someone who was fine, and treating a revocation as
 * transient leaves a connection that can never work.
 */
export function isFatalGrantStatus(status: number, body: string): boolean {
  if (status >= 500) return false;              // Google having a bad minute
  if (status === 429) return false;             // rate limited, come back later
  if (status !== 400 && status !== 401) return false;
  return /invalid_grant|invalid_client|unauthorized_client/.test(body);
}

async function isRevoked(res: Response): Promise<boolean> {
  let body = '';
  try { body = await res.text(); } catch { /* unreadable body → treat as transient */ }
  return isFatalGrantStatus(res.status, body);
}

/**
 * Forget a connection whose grant is gone, so the app's state matches Google's.
 * Clearing `gcal_connected` is what puts the UI back to offering "Connect"
 * instead of a Sync that silently does nothing.
 */
async function forgetConnection(service: SB, userId: string): Promise<void> {
  try {
    await service.from('calendar_connections').delete().eq('user_id', userId).eq('provider', 'google');
    const { data: prof } = await service.from('profiles').select('preferences').eq('id', userId).maybeSingle();
    const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
    delete prefs.gcal_connected;
    delete prefs.gcal_last_synced;
    delete prefs.gcal_event_count;
    await service.from('profiles').update({ preferences: prefs }).eq('id', userId);
  } catch { /* best-effort: never let cleanup break the caller */ }
}

export async function hasConnection(service: SB, userId: string): Promise<boolean> {
  const { data } = await service.from('calendar_connections').select('id').eq('user_id', userId).eq('provider', 'google').maybeSingle();
  return !!data;
}

// ── Write-back (Zenboard → Google) ─────────────────────────────────────────────
export type EvtInput = { title: string; startsAt: string; endsAt: string | null; allDay: boolean };

export function gBody(ev: EvtInput) {
  if (ev.allDay) {
    const day = ev.startsAt.slice(0, 10);
    const nextDay = (iso: string) => new Date(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
    // Honour a real end. This used to hard-code one day, so pushing a multi-day
    // event to Google silently shortened it — the same collapse the read path
    // had, which is why the round trip looked consistent while both were wrong.
    // `end.date` is exclusive at both ends of the wire, so it passes straight
    // through; the guard is only for a stored end that is missing or backwards.
    const end = ev.endsAt && ev.endsAt.slice(0, 10) > day ? ev.endsAt.slice(0, 10) : nextDay(day);
    return { summary: ev.title, start: { date: day }, end: { date: end } };
  }
  const end = ev.endsAt || new Date(new Date(ev.startsAt).getTime() + 3600000).toISOString();
  return { summary: ev.title, start: { dateTime: ev.startsAt }, end: { dateTime: end } };
}

const gUrl = (calendarId: string, id?: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${id ? '/' + encodeURIComponent(id) : ''}`;

// Create on Google → returns the new google event id (or null on failure; best-effort).
export async function pushCreate(token: string, calendarId: string, ev: EvtInput): Promise<string | null> {
  const res = await fetch(gUrl(calendarId), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(gBody(ev)) });
  if (!res.ok) return null;
  const j = (await res.json()) as { id?: string };
  return j.id ?? null;
}

export async function pushUpdate(token: string, calendarId: string, googleId: string, ev: EvtInput): Promise<boolean> {
  const res = await fetch(gUrl(calendarId, googleId), { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(gBody(ev)) });
  return res.ok;
}

export async function pushDelete(token: string, calendarId: string, googleId: string): Promise<boolean> {
  const res = await fetch(gUrl(calendarId, googleId), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return res.ok || res.status === 410; // 410 = already gone
}
