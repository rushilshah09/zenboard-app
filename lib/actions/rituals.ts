'use server';
// Ritual mutations — daily planning / shutdown / weekly review. One row per
// user+type+date (upsert). RLS scopes to the user.
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

export async function saveRitual(
  type: 'daily_plan' | 'daily_shutdown' | 'weekly_review',
  payload: { reflection?: string; highlightTaskId?: string | null; energy?: number | null; data?: Record<string, unknown> },
): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('rituals').upsert({
    user_id: user.id,
    type,
    ritual_date: new Date().toISOString().slice(0, 10),
    reflection: payload.reflection ?? null,
    highlight_task_id: payload.highlightTaskId ?? null,
    energy: payload.energy ?? null,
    data: payload.data ?? {},
    completed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type,ritual_date' });
  return error ? { error: error.message } : { ok: true };
}
