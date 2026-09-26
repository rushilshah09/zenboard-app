'use server';
// ── FOCUS FROM BEFORE SIGNING IN, INTO THE ACCOUNT ──────────────────────────
//
// The website lets anyone run a focus session without an account (components/site/guest-focus.tsx),
// and keeps what they finish on their device. The user, 2026-09-26: "make this count: they log in to
// Zenboard and their sessions count". So the first time Zenboard opens signed in, those sessions come
// in as the account's own focus time: a `time_entries` row each, from the timer, not billable (nobody
// was a client yet), with a note that says what it was.
//
// Nothing from a browser is trusted: the list is re-checked here with the same rules the site keeps
// it by (lib/guest-focus.ts), and a session already in the account (the same start, from the timer)
// is never added twice, so a retry, a second tab or a second device offering the same list is safe.

import { requireSession } from '@/lib/auth';
import { focusNote, sanitizeGuestSessions } from '@/lib/guest-focus';

export async function importGuestFocus(input: unknown): Promise<{ imported: number } | { error: string }> {
  const sessions = sanitizeGuestSessions(input, new Date());
  if (!sessions.length) return { imported: 0 };
  const { supabase, user } = await requireSession();

  const { data: had, error: readError } = await supabase
    .from('time_entries')
    .select('started_at')
    .eq('user_id', user.id)
    .eq('source', 'timer')
    .in('started_at', sessions.map((s) => s.startedAt));
  if (readError) return { error: readError.message };
  const already = new Set((had ?? []).map((r) => new Date(r.started_at).toISOString()));

  const rows = sessions
    .filter((s) => !already.has(s.startedAt))
    .map((s) => ({
      user_id: user.id,
      source: 'timer' as const,
      billable: false,
      minutes: s.minutes,
      started_at: s.startedAt,
      ended_at: new Date(Date.parse(s.startedAt) + s.minutes * 60_000).toISOString(),
      note: focusNote(s.what),
    }));
  if (!rows.length) return { imported: 0 };
  const { error } = await supabase.from('time_entries').insert(rows);
  return error ? { error: error.message } : { imported: rows.length };
}
