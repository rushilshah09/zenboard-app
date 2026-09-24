'use server';
// Habits: create / rename / delete, plus per-day check-off. One habit_log row
// per (habit, day); checking on upserts a done=true row, checking off deletes
// it. RLS scopes everything to the user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { userTimezone } from '@/lib/user-tz';
import { todayISO as dayId } from '@/lib/date';
import { scheduleColumns, type HabitSchedule } from '@/lib/habit-schedule';
import { requireSession } from '@/lib/auth';

// Active space, or create the default "Personal" space (mirrors the other hubs).
async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

// The day id a server action writes must be the USER's calendar date, not the
// runtime's. On Cloudflare the runtime is UTC, so an IST user checking something
// off at 01:00 logged it against YESTERDAY. `userTimezone()` reads the zone the
// browser reported (profiles.preferences.timezone) and falls back to UTC — the
// old behaviour — when it hasn't synced yet.
async function todayISO() {
  return dayId(await userTimezone());
}

// Create a habit. `opts` (time of day / repeat schedule / goal) is Habits-v2
// (migration 0025); those columns are only sent when provided, and a
// missing-column error retries without them so the plain Today-home add keeps
// working before 0025 is applied.
export async function addHabit(
  title: string,
  opts?: { timeOfDay?: string; goalTarget?: number; schedule?: HabitSchedule },
): Promise<{ error: string } | { id: string }> {
  const clean = title.trim();
  if (!clean) return { error: 'Habit needs a name.' };
  const { supabase, user } = await requireSession();
  const sid = await spaceId(supabase, user.id);
  const base = { user_id: user.id, space_id: sid, title: clean, cadence: 'daily', active: true };
  const extra = {
    ...(opts?.timeOfDay ? { time_of_day: opts.timeOfDay } : {}),
    ...(opts?.goalTarget ? { goal_target: opts.goalTarget } : {}),
    ...(opts?.schedule ? scheduleColumns(opts.schedule) : {}),
  };
  let res = await supabase.from('habits').insert({ ...base, ...extra }).select('id').single();
  if (res.error && Object.keys(extra).length) res = await supabase.from('habits').insert(base).select('id').single();
  if (res.error || !res.data) return { error: res.error?.message ?? 'Could not add habit.' };
  return { id: res.data.id };
}

// Change what a habit IS: its name, when it happens, how often, and what counts
// as done. All of it optional; only what's passed is written. Falls back to a
// name-only update if the v2 columns aren't there yet.
export async function updateHabit(
  id: string,
  patch: { title?: string; timeOfDay?: string; goalTarget?: number; schedule?: HabitSchedule },
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const title = patch.title?.trim();
  if (patch.title !== undefined && !title) return { error: 'Habit needs a name.' };
  const nameOnly = { ...(title ? { title } : {}) };
  const full = {
    ...nameOnly,
    ...(patch.timeOfDay ? { time_of_day: patch.timeOfDay } : {}),
    ...(patch.goalTarget ? { goal_target: patch.goalTarget } : {}),
    ...(patch.schedule ? scheduleColumns(patch.schedule) : {}),
  };
  if (!Object.keys(full).length) return { ok: true };
  const res = await supabase.from('habits').update(full).eq('id', id);
  if (!res.error) return { ok: true };
  if (!Object.keys(nameOnly).length) return { error: res.error.message };
  const fb = await supabase.from('habits').update(nameOnly).eq('id', id);
  return fb.error ? { error: fb.error.message } : { ok: true };
}

// Log N-of-target progress for a day. `count` is how many times it was done;
// `done` is set only once the target is met, so everything that reads the old
// `done` column (Today home, the streak query) keeps its exact meaning and a
// partial day never claims completion. count <= 0 clears the day.
export async function setHabitCount(
  habitId: string,
  count: number,
  target: number,
  date?: string,
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const logDate = date ?? await todayISO();
  const n = Math.max(0, Math.min(Math.max(1, target), Math.round(count)));
  if (n === 0) {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', logDate);
    return error ? { error: error.message } : { ok: true };
  }
  const done = n >= Math.max(1, target);
  const row = { user_id: user.id, habit_id: habitId, log_date: logDate, done, status: 'done', count: n };
  let res = await supabase.from('habit_logs').upsert(row, { onConflict: 'habit_id,log_date' });
  // Pre-0025: no count column, so a partial can't be stored — record the day
  // only once it is actually complete rather than lying in either direction.
  if (res.error) {
    if (!done) return { ok: true };
    res = await supabase.from('habit_logs').upsert(
      { user_id: user.id, habit_id: habitId, log_date: logDate, done: true },
      { onConflict: 'habit_id,log_date' },
    );
  }
  return res.error ? { error: res.error.message } : { ok: true };
}

// Set a habit's status for a day: done · skipped · none (clears it). Habits-v2 —
// `status` is only written when the column exists (retries without on error);
// a skip degrades to "not done" on a pre-0025 DB.
export async function setHabitStatus(
  habitId: string,
  status: 'done' | 'skipped' | 'none',
  date?: string,
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const logDate = date ?? await todayISO();
  if (status === 'none') {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', logDate);
    return error ? { error: error.message } : { ok: true };
  }
  const done = status === 'done';
  let res = await supabase.from('habit_logs').upsert({ user_id: user.id, habit_id: habitId, log_date: logDate, done, status }, { onConflict: 'habit_id,log_date' });
  if (res.error) res = await supabase.from('habit_logs').upsert({ user_id: user.id, habit_id: habitId, log_date: logDate, done }, { onConflict: 'habit_id,log_date' });
  return res.error ? { error: res.error.message } : { ok: true };
}

export async function renameHabit(id: string, title: string): Promise<{ error: string } | { ok: true }> {
  const clean = title.trim();
  if (!clean) return { error: 'Habit needs a name.' };
  const { supabase } = await requireSession();
  const { error } = await supabase.from('habits').update({ title: clean }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Archive a habit — it leaves the journal and the review but keeps its history,
// which is the reversible middle ground between "living with it" and deleting
// every log it ever wrote. Falls back to `active` if 0025 isn't applied.
export async function archiveHabit(id: string, archived = true): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const res = await supabase.from('habits').update({ archived }).eq('id', id);
  if (!res.error) return { ok: true };
  const fb = await supabase.from('habits').update({ active: !archived }).eq('id', id);
  return fb.error ? { error: fb.error.message } : { ok: true };
}

// Delete a habit; habit_logs cascade away with it.
export async function deleteHabit(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { error } = await supabase.from('habits').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Toggle a habit's completion for today (or a given ISO date).
export async function toggleHabit(
  habitId: string,
  done: boolean,
  date?: string,
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const logDate = date ?? await todayISO();
  if (done) {
    const { error } = await supabase
      .from('habit_logs')
      .upsert({ user_id: user.id, habit_id: habitId, log_date: logDate, done: true }, { onConflict: 'habit_id,log_date' });
    return error ? { error: error.message } : { ok: true };
  }
  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('habit_id', habitId)
    .eq('log_date', logDate);
  return error ? { error: error.message } : { ok: true };
}
