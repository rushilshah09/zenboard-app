'use server';
// Ritual mutations — daily planning / shutdown / weekly review. One row per
// user+type+date (upsert). RLS scopes to the user.
import { userTimezone } from '@/lib/user-tz';
import { todayISO } from '@/lib/date';
import { requireSession } from '@/lib/auth';

export async function saveRitual(
  type: 'daily_plan' | 'daily_shutdown' | 'weekly_review',
  payload: { reflection?: string; highlightTaskId?: string | null; energy?: number | null; data?: Record<string, unknown> },
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  const { error } = await supabase.from('rituals').upsert({
    user_id: user.id,
    type,
    // The user's calendar date, not the runtime's — a shutdown logged at
    // 00:30 IST belongs to the day that just ended, not the one before it.
    ritual_date: todayISO(await userTimezone()),
    reflection: payload.reflection ?? null,
    highlight_task_id: payload.highlightTaskId ?? null,
    energy: payload.energy ?? null,
    data: payload.data ?? {},
    completed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type,ritual_date' });
  return error ? { error: error.message } : { ok: true };
}
