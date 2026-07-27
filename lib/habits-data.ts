// Loader for the redesigned Habits page (/habits) — the Habitify-inspired journal.
// Returns each active habit with its time-of-day, goal, the viewed DATE's status
// (done · skipped · none) and current streak. Degrades gracefully: if 0025 isn't
// applied it falls back to the simple shape (everything "any time", no skip).
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';
export type HabitStatus = 'done' | 'skipped' | 'none';

export type BoardHabit = {
  id: string;
  title: string;
  timeOfDay: TimeOfDay;
  goalTarget: number;
  goalPeriod: 'day' | 'week';
  color: string | null;
  status: HabitStatus; // for the viewed date
  streak: number;
};

export type HabitsBoard = { habits: BoardHabit[]; date: string; supported: boolean; error: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Consecutive done-days ending on (or the day before) the viewed date.
function streakEndingOn(dates: Set<string>, dateISO: string): number {
  let streak = 0;
  const d = new Date(dateISO + 'T00:00:00');
  if (!dates.has(iso(d))) d.setDate(d.getDate() - 1);
  while (dates.has(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

type FullRow = { id: string; title: string; time_of_day: string | null; goal_target: number | null; goal_period: string | null; color: string | null };
type LogRow = { habit_id: string; log_date: string; done: boolean; status?: string };

export async function loadHabitsBoard(dateISO?: string): Promise<HabitsBoard> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const date = dateISO ?? iso(new Date());

  // v2 columns first; fall back to the simple list if 0025 isn't applied.
  let supported = true;
  let rows: FullRow[] = [];
  const full = await supabase.from('habits')
    .select('id, title, time_of_day, goal_target, goal_period, color')
    .eq('space_id', sid).eq('active', true).eq('archived', false)
    .order('sort_order').order('created_at');
  if (full.error) {
    supported = false;
    const base = await supabase.from('habits').select('id, title').eq('space_id', sid).eq('active', true).order('created_at');
    if (base.error) return { habits: [], date, supported: false, error: true };
    rows = ((base.data as { id: string; title: string }[]) ?? []).map((r) => ({ ...r, time_of_day: 'any', goal_target: 1, goal_period: 'day', color: null }));
  } else {
    rows = (full.data as FullRow[]) ?? [];
  }
  if (!rows.length) return { habits: [], date, supported, error: false };

  const ids = rows.map((r) => r.id);
  const since = iso(new Date(Date.now() - 120 * 86400000));
  const cols = supported ? 'habit_id, log_date, done, status' : 'habit_id, log_date, done';
  const logsRes = await supabase.from('habit_logs').select(cols).gte('log_date', since).in('habit_id', ids);

  const doneByHabit = new Map<string, Set<string>>();
  const statusOnDate = new Map<string, HabitStatus>();
  for (const l of ((logsRes.data as unknown as LogRow[]) ?? [])) {
    if (l.done) {
      const s = doneByHabit.get(l.habit_id) ?? new Set<string>();
      s.add(l.log_date);
      doneByHabit.set(l.habit_id, s);
    }
    if (l.log_date === date) {
      if (l.done) statusOnDate.set(l.habit_id, 'done');
      else if (l.status === 'skipped') statusOnDate.set(l.habit_id, 'skipped');
    }
  }

  const habits: BoardHabit[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    timeOfDay: (['any', 'morning', 'afternoon', 'evening'].includes(r.time_of_day ?? 'any') ? r.time_of_day : 'any') as TimeOfDay,
    goalTarget: r.goal_target ?? 1,
    goalPeriod: (r.goal_period === 'week' ? 'week' : 'day'),
    color: r.color,
    status: statusOnDate.get(r.id) ?? 'none',
    streak: streakEndingOn(doneByHabit.get(r.id) ?? new Set<string>(), date),
  }));

  return { habits, date, supported, error: false };
}
