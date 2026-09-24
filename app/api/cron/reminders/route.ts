// Reminder delivery when the app is closed — master plan §7O channel 3, the
// half the in-app scheduler cannot do.
//
// WHY THIS EXISTS. `components/reminders/reminder-scheduler.tsx` only speaks
// while a tab is open. A reminder set for 07:00 that you first hear about when
// you next open the laptop is not a reminder. This is the other deliverer.
//
// IT RUNS THE SAME CLAIM. That is the entire reason 0031 stored `reminded_at`
// as a timestamp rather than a boolean: two independent deliverers, one
// conditional UPDATE, exactly one winner, and no schema change to add this.
// If a tab is open when the cron fires, whichever gets there first wins and the
// other stays silent — the user is never told twice.
//
// WHY AN HTTP ENDPOINT AND NOT A CLOUDFLARE `scheduled` HANDLER. OpenNext
// compiles a Next app into a fetch handler; adding a `scheduled` export means
// owning a custom worker entry, which is deploy-time surface I cannot verify
// from here. An authenticated POST works with a Cloudflare Cron Trigger, a
// GitHub Action, cron-job.org or `curl` in a loop, and can be exercised
// locally. Trigger it every 5–15 minutes.
//
// SECURITY. This endpoint reads across users and sends mail, so it FAILS
// CLOSED: with no `REMINDER_CRON_SECRET` configured it refuses every request
// rather than defaulting to open. The response carries counts only, never task
// titles or addresses — a public URL must not become a data leak because
// someone guessed it.
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail, siteOrigin } from '@/lib/email';
import { workerDeliverable, reminderEmail, type ReminderDigestItem } from '@/lib/reminders';

/** Most reminders to look at in one run. A cron that falls behind catches up on the next tick. */
const BATCH = 200;

type DueRow = { id: string; user_id: string; title: string; remind_at: string };

/**
 * Constant-time-ish comparison. `===` on secrets leaks length and prefix
 * through timing; this is cheap insurance on a public endpoint.
 */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const expected = process.env.REMINDER_CRON_SECRET;
  // Fail closed. An unconfigured deployment must not run this for anyone who
  // finds the URL.
  if (!expected) return Response.json({ error: 'not configured' }, { status: 503 });

  const auth = request.headers.get('authorization') ?? '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!given || !secretMatches(given, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Only reminders that are set, undelivered and still open. The partial index
  // from 0031 covers exactly this predicate.
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, title, remind_at')
    .not('remind_at', 'is', null)
    .is('reminded_at', null)
    .eq('done', false)
    .lte('remind_at', new Date().toISOString())
    .order('remind_at', { ascending: true })
    .limit(BATCH);

  // A missing column means 0031 is not applied. That is not an error worth
  // alerting on — it is the gate — so it reports as a no-op run.
  if (error) {
    const gated = error.code === '42703';
    return Response.json({ ok: gated, gated, claimed: 0, emailed: 0 }, { status: gated ? 200 : 500 });
  }

  // Stale reminders are deliberately LEFT ALONE rather than claimed here — see
  // WORKER_MAX_LATE_MS. The in-app scheduler still puts them in the bell on the
  // next open, so nothing is lost; it just does not arrive by email days later.
  const deliverable = workerDeliverable((data ?? []) as DueRow[]);

  // Grouped by owner: one email per person per run, never one per reminder.
  const byUser = new Map<string, DueRow[]>();
  for (const row of deliverable) {
    const list = byUser.get(row.user_id);
    if (list) list.push(row);
    else byUser.set(row.user_id, [row]);
  }

  let claimed = 0;
  let emailed = 0;

  for (const [userId, rows] of byUser) {
    // Claim FIRST, email second. The other order can send mail for a reminder
    // another deliverer already handled; this order can at worst mark one
    // delivered whose email then fails — and the bell entry below still
    // carries it, so the user is not left with nothing.
    const won: ReminderDigestItem[] = [];
    for (const row of rows) {
      const { data: claimedRow } = await supabase
        .from('tasks')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('reminded_at', null)
        .select('id, title, remind_at')
        .maybeSingle();
      if (claimedRow) won.push(claimedRow as ReminderDigestItem);
    }
    if (!won.length) continue;
    claimed += won.length;

    // The durable half, exactly as the in-app path writes it, so a reminder
    // delivered by email is still in the bell when the app is next opened.
    await supabase.from('notifications').insert(
      won.map((w) => ({
        user_id: userId,
        kind: 'task.reminder',
        title: w.title,
        body: 'Reminder',
        link: { href: `/tasks?task=${w.id}` },
      })),
    );

    const mail = reminderEmail(won, siteOrigin());
    if (!mail) continue;
    // The address lives in auth, not in `profiles` — the same lookup the form
    // notifications use.
    const { data: userRes } = await supabase.auth.admin.getUserById(userId);
    const to = userRes?.user?.email;
    if (!to) continue;
    // Best-effort by contract (lib/email.ts never throws): a bounced email must
    // not fail the run and leave the rest of the batch undelivered.
    if (await sendEmail({ to, subject: mail.subject, text: mail.text })) emailed += 1;
  }

  // Counts only. No titles, no addresses.
  return Response.json({ ok: true, gated: false, claimed, emailed });
}
