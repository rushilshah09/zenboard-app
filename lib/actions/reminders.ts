'use server';
// Reminders, write side — master plan §7B / §7O channel 3. The rules live in
// lib/reminders.ts; this file only performs them.
//
// GATED. Migration 0031 adds `tasks.remind_at` and `tasks.reminded_at`; until it
// is applied `remindersSupported()` reports false, every action here returns a
// clean "not available yet", the Remind chip is hidden and the scheduler never
// issues a query. The app is correct before and after.
import { notReady } from '@/lib/not-ready';
import { createClient } from '@/lib/supabase/server';
import { notifyOwner } from '@/lib/notify';
import { requireSession } from '@/lib/auth';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0031 applied? A zero-row probe against the column — the same
 * fetch-time capability pattern as `taskEventsSupported` / `mentionsSupported`.
 * The COLUMN, not the table: `tasks` has existed since 0001, so a table probe
 * would report the feature as available on every unmigrated database.
 */
export async function remindersSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('tasks').select('remind_at').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = () => notReady('Reminders aren’t available yet.', '0031');

/**
 * Set or clear a task's one reminder.
 *
 * `reminded_at` is ALWAYS cleared in the same write, and that is the whole
 * reason delivery can claim on `reminded_at is null` (see 0031's header).
 * Moving a reminder makes it undelivered again — which is also the behaviour a
 * person expects: if you push a reminder to tomorrow, tomorrow's one should
 * still speak, even though today's already did.
 */
export async function setReminder(
  taskId: string,
  atISO: string | null,
): Promise<{ error: string } | { ok: true; remindAt: string | null }> {
  const { supabase } = await requireSession();
  if (!(await remindersSupported(supabase))) return NOT_READY();

  let remindAt: string | null = null;
  if (atISO) {
    const t = Date.parse(atISO);
    if (Number.isNaN(t)) return { error: 'That is not a valid time.' };
    remindAt = new Date(t).toISOString();
  }

  const { error } = await supabase
    .from('tasks')
    .update({ remind_at: remindAt, reminded_at: null })
    .eq('id', taskId);
  return error ? { error: error.message } : { ok: true, remindAt };
}

export type ReminderClaim =
  /** This caller won the claim and owns delivering it. */
  | { claimed: true; id: string; title: string; remindAt: string | null }
  /** Someone else already delivered it — another tab, another device, or a worker. */
  | { claimed: false };

/**
 * Claim a reminder for delivery, exactly once.
 *
 * THE POINT OF THIS FUNCTION. The app can be open in three tabs on two
 * machines, each running its own scheduler, each seeing the same reminder come
 * due at the same second. A conditional UPDATE is the arbiter: Postgres runs it
 * under a row lock, so exactly one caller matches `reminded_at is null` and
 * gets a row back. Everyone else gets nothing and stays silent. No lock table,
 * no leader election, no dedupe window that could be wrong.
 *
 * The notification row is written only by the winner, which is what makes
 * "one reminder → one entry in the bell" true rather than hopeful.
 */
export async function claimReminder(taskId: string): Promise<ReminderClaim> {
  const { supabase, user } = await requireSession();
  if (!(await remindersSupported(supabase))) return { claimed: false };

  const { data, error } = await supabase
    .from('tasks')
    .update({ reminded_at: new Date().toISOString() })
    .eq('id', taskId)
    .is('reminded_at', null)
    .select('id, title, remind_at')
    .maybeSingle();
  if (error || !data) return { claimed: false };

  // The durable half of delivery. The toast is transient by design — you can be
  // away from the screen when it appears — so the bell is where a reminder
  // actually lives (§7O: "aggregation not interruption"). Through `notifyOwner`,
  // which is THE place a notification row is written and already treats the
  // write as a courtesy that can never fail the caller's real action.
  //
  // No time is baked into the body on purpose. This runs on the server, where
  // the zone is UTC and the locale is not the user's — a "6:00 PM" written here
  // would be a different hour than the one they picked. The bell renders its
  // own relative time from `created_at`, on the client, where that is knowable.
  await notifyOwner(supabase, {
    userId: user.id,
    kind: 'task.reminder',
    title: data.title,
    body: 'Reminder',
    link: { href: `/tasks?task=${data.id}` },
  });

  return { claimed: true, id: data.id, title: data.title, remindAt: data.remind_at ?? null };
}
