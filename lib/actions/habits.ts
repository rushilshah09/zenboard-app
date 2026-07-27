'use server';
// Habits: create / rename / delete, plus per-day check-off. One habit_log row
// per (habit, day); checking on upserts a done=true row, checking off deletes
// it. RLS scopes everything to the user.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

// Active space, or create the default "Personal" space (mirrors the other hubs).
async function spaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return activeSpaceId(supabase, userId);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Create a daily habit. `opts` (time of day / goal) is Habits-v2 (migration 0025);
// those columns are only sent when provided, and a missing-column error retries
// without them so the plain Today-home add keeps working before 0025 is applied.
export async function addHabit(
  title: string,
  opts?: { timeOfDay?: string; goalTarget?: number; goalPeriod?: string },
): Promise<{ error: string } | { id: string }> {
  const clean = title.trim();
  if (!clean) return { error: 'Habit needs a name.' };
  const { supabase, user } = await requireUser();
  const sid = await spaceId(supabase, user.id);
  const base = { user_id: user.id, space_id: sid, title: clean, cadence: 'daily', active: true };
  const extra = {
    ...(opts?.timeOfDay ? { time_of_day: opts.timeOfDay } : {}),
    ...(opts?.goalTarget ? { goal_target: opts.goalTarget } : {}),
    ...(opts?.goalPeriod ? { goal_period: opts.goalPeriod } : {}),
  };
  let res = await supabase.from('habits').insert({ ...base, ...extra }).select('id').single();
  if (res.error && Object.keys(extra).length) res = await supabase.from('habits').insert(base).select('id').single();
  if (res.error || !res.data) return { error: res.error?.message ?? 'Could not add habit.' };
  return { id: res.data.id };
}

// Set a habit's status for a day: done · skipped · none (clears it). Habits-v2 —
// `status` is only written when the column exists (retries without on error);
// a skip degrades to "not done" on a pre-0025 DB.
export async function setHabitStatus(
  habitId: string,
  status: 'done' | 'skipped' | 'none',
  date?: string,
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const logDate = date ?? todayISO();
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
  const { supabase } = await requireUser();
  const { error } = await supabase.from('habits').update({ title: clean }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Delete a habit; habit_logs cascade away with it.
export async function deleteHabit(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('habits').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// Toggle a habit's completion for today (or a given ISO date).
export async function toggleHabit(
  habitId: string,
  done: boolean,
  date?: string,
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const logDate = date ?? todayISO();
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
