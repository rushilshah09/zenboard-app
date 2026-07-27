'use server';
import { activeSpaceId } from '@/lib/active-space';
// Calendar events: create / update / delete. Timestamps arrive as full ISO
// strings (the client owns the user's timezone). RLS scopes everything to the
// user. When the user has a Google Calendar connection, changes are pushed back
// to Google (best-effort — a failed push never blocks the local write).
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getValidAccessToken, pushCreate, pushUpdate, pushDelete } from '@/lib/google-calendar';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

// Google token for write-back, or null if not connected. Never throws.
async function googleToken(userId: string) {
  try { return await getValidAccessToken(createServiceClient(), userId); } catch { return null; }
}

// First space, or create the default "Personal" space (mirrors the other hubs).
async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

export type EventInput = { title: string; startsAt: string; endsAt?: string | null; allDay?: boolean; color?: string | null };

export async function addEvent(input: EventInput): Promise<{ error: string } | { id: string }> {
  const title = input.title.trim();
  if (!title) return { error: 'Event needs a title.' };
  if (!input.startsAt) return { error: 'Event needs a time.' };
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const allDay = !!input.allDay;
  const ends = allDay ? null : (input.endsAt || null);
  const base = { user_id: user.id, space_id: sid, title, starts_at: input.startsAt, ends_at: ends, all_day: allDay, source: 'manual' };
  const withColor = input.color ? { ...base, color: input.color } : base;
  let { data, error } = await supabase.from('calendar_events').insert(withColor).select('id').single();
  // Gracefully retry without color if the column isn't migrated yet.
  if (error && /color/i.test(error.message)) ({ data, error } = await supabase.from('calendar_events').insert(base).select('id').single());
  if (error || !data) return { error: error?.message ?? 'Could not add event.' };

  // Push to Google if connected → adopt the google id so it stays in two-way sync.
  try {
    const conn = await googleToken(user.id);
    if (conn) {
      const gid = await pushCreate(conn.token, conn.calendarId, { title, startsAt: input.startsAt, endsAt: ends, allDay });
      if (gid) await supabase.from('calendar_events').update({ external_id: gid, source: 'google' }).eq('id', data.id);
    }
  } catch { /* best-effort */ }

  return { id: data.id };
}

export async function updateEvent(
  id: string,
  patch: { title?: string; startsAt?: string; endsAt?: string | null; allDay?: boolean; color?: string | null },
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const row: { title?: string; starts_at?: string; ends_at?: string | null; all_day?: boolean; color?: string | null } = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { error: 'Event needs a title.' };
    row.title = t;
  }
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.allDay !== undefined) {
    row.all_day = patch.allDay;
    if (patch.allDay) row.ends_at = null; // all-day events carry no end time
  }
  if (patch.color !== undefined) row.color = patch.color;
  if (Object.keys(row).length === 0) return { ok: true };
  // `color` isn't in the generated types until 0012 is applied; cast + runtime fallback.
  let { error } = await supabase.from('calendar_events').update(row as never).eq('id', id);
  // Gracefully retry without color if the column isn't migrated yet.
  if (error && /color/i.test(error.message)) {
    const { color: _c, ...rest } = row;
    error = Object.keys(rest).length ? (await supabase.from('calendar_events').update(rest).eq('id', id)).error : null;
  }
  if (error) return { error: error.message };

  // Mirror the change to Google if this event is linked.
  try {
    const { data: ev } = await supabase.from('calendar_events').select('external_id, title, starts_at, ends_at, all_day').eq('id', id).maybeSingle();
    if (ev?.external_id) {
      const conn = await googleToken(user.id);
      if (conn) await pushUpdate(conn.token, conn.calendarId, ev.external_id, { title: ev.title, startsAt: ev.starts_at, endsAt: ev.ends_at, allDay: ev.all_day });
    }
  } catch { /* best-effort */ }

  return { ok: true };
}

export async function deleteEvent(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from('calendar_events').select('external_id').eq('id', id).maybeSingle();
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) return { error: error.message };

  try {
    if (ev?.external_id) {
      const conn = await googleToken(user.id);
      if (conn) await pushDelete(conn.token, conn.calendarId, ev.external_id);
    }
  } catch { /* best-effort */ }

  return { ok: true };
}
