// The morning digest worker — master plan §7O channel 2, and the last of the
// three channels to be built.
//
// SHAPE BORROWED FROM THE REMINDER WORKER, DELIBERATELY. Same POST-only
// contract, same constant-time bearer check, same fail-closed 503 when no
// secret is configured, same counts-only response. Two cron endpoints that
// authenticate differently is two things to get wrong; see
// `app/api/cron/reminders/route.ts` for the reasoning behind each.
//
// WHAT IS DIFFERENT: the claim. A reminder claims a ROW it owns
// (`tasks.reminded_at`). A digest owns no row, so the claim is a conditional
// update of the sender's own preferences guarded on the stored date — the same
// idea (one winner, decided by the database, not by the caller) expressed
// against jsonb. Two overlapping runs cannot both send.
//
// AND THE CLOCK IS THE READER'S. "Send at 08:00" means *their* 08:00, so every
// decision here is made in the user's own stored timezone. A worker that used
// its own clock would mail an IST user at 13:30 and call it morning.
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail, siteOrigin } from '@/lib/email';
import { todayISO, minutesOfDayIn, readTimeZone } from '@/lib/date';
import { readDigestPrefs, digestDue, digestEmail, DIGEST_KEY, type SkipReason } from '@/lib/digest';
import { loadDigest } from '@/lib/digest-data';

/**
 * Most people to consider in one run. Everyone past this waits for the next
 * tick, which is why the window in `lib/digest.ts` is hours and not minutes.
 */
const BATCH = 500;

type ProfileRow = { id: string; preferences: Record<string, unknown> | null };

function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const expected = process.env.REMINDER_CRON_SECRET;
  // Fail closed, and share the reminder worker's secret on purpose: they are one
  // scheduler's credentials, and a second secret is a second thing to rotate and
  // forget. Both endpoints are the same trust level — internal, machine-only.
  if (!expected) return Response.json({ error: 'not configured' }, { status: 503 });

  const auth = request.headers.get('authorization') ?? '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!given || !secretMatches(given, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const origin = siteOrigin();

  // WHO IS CONSIDERED IS DECIDED IN JS, NOT IN THE QUERY — deliberately.
  //
  // The obvious version filters with `.eq('preferences->digest->>enabled',
  // 'true')`. It works, and it is also unverifiable: a jsonb path with a typo
  // in it does not error, it returns an empty set, because a missing key is
  // NULL and `NULL = true` is merely false. A mistyped path would mean this
  // endpoint reported `considered: 0` and looked healthy forever while nobody
  // ever received a digest. (Probed against the live database, 2026-08-06: a
  // deliberately bogus path answered 200 with `[]`, exactly like a correct one
  // matching nobody.)
  //
  // `readDigestPrefs` makes the same decision, is pure, and has tests. The
  // query fetches the two columns it was going to fetch anyway. The only thing
  // given up is not reading rows for people who never opted in — which, for a
  // product whose `profiles` table is one row per person and small, is not a
  // trade worth an unverifiable expression. Revisit if that stops being true;
  // `scanned` below is the number to watch.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, preferences')
    .limit(BATCH);

  if (error) return Response.json({ error: 'query failed' }, { status: 500 });

  const rows = (data ?? []) as unknown as ProfileRow[];
  const scanned = rows.length;
  const skipped: Record<SkipReason, number> = {
    off: 0, vacation: 0, early: 0, late: 0, 'already-sent': 0,
  };
  let considered = 0;
  let empty = 0;
  let claimed = 0;
  let sent = 0;

  for (const row of rows) {
    considered += 1;
    const prefs = readDigestPrefs(row.preferences);
    const tz = readTimeZone(row.preferences);

    // Their clock, not the worker's.
    const today = todayISO(tz);
    const nowMinutes = minutesOfDayIn(new Date(), tz) ?? 0;

    const verdict = digestDue(prefs, { today, nowMinutes });
    if (!verdict.due) { skipped[verdict.reason] += 1; continue; }

    const built = await loadDigest(supabase, { userId: row.id, today, tz, preferences: row.preferences });
    const mail = digestEmail(built, origin);
    // NOTHING TO SAY MEANS NO CLAIM EITHER. Burning the day's claim on an empty
    // 08:00 would mean a client request arriving at 08:30 waits until tomorrow;
    // leaving it unclaimed lets the next tick inside the window pick it up.
    if (!mail) { empty += 1; continue; }

    // Claim BEFORE sending. The other order can mail twice when two runs
    // overlap; this order can at worst mark a day sent whose mail then failed,
    // which costs one digest rather than duplicating one.
    const won = await claimToday(supabase, row.id, today);
    if (!won) { skipped['already-sent'] += 1; continue; }
    claimed += 1;

    const { data: userRes } = await supabase.auth.admin.getUserById(row.id);
    const to = userRes?.user?.email;
    if (!to) continue;
    if (await sendEmail({ to, subject: mail.subject, text: mail.text })) sent += 1;
  }

  // Counts only — no addresses, no titles. A guessed URL must not become a leak.
  //
  // `scanned` is here so that "nobody got a digest" can never be silent: a
  // response of `scanned: 6, considered: 0` says the worker ran and nobody has
  // opted in, while `scanned: 0` says something is wrong with the query itself.
  // Without it the two are the same JSON.
  return Response.json({ ok: true, scanned, considered, claimed, sent, empty, skipped });
}

/**
 * Stamp today's date into `preferences.digest.lastSent`, but only if it is not
 * already there.
 *
 * The guard on the jsonb path is what makes this a claim rather than a write:
 * PostgREST turns it into a WHERE, Postgres evaluates it under the row lock, and
 * exactly one concurrent run gets a row back.
 *
 * IT IS AN `or(is.null, neq)` AND NOT A BARE `neq`, WHICH IS THE WHOLE POINT.
 * `lastSent` is absent until the first digest ever goes out, and in SQL
 * `NULL <> '2026-08-06'` is NULL, not true — so a bare `neq` matches no row,
 * and the FIRST digest for every account would never send. Silently: the
 * endpoint would answer 200 and report nothing due. Verified against the live
 * database (2026-08-06): the bare form matched 0 of 6 profiles, this form
 * matched 6, and the same NULL exclusion reproduces on `preferences->>timezone`,
 * a key that really is set on only some rows.
 *
 * The read-merge-write around it is the same pattern `updatePreferences` has
 * always used, and carries the same narrow risk: a preference changed by the
 * user in the same instant could be overwritten. Accepted — this runs once a
 * morning, and the alternative is a migration for a `jsonb_set` RPC.
 */
async function claimToday(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  today: string,
): Promise<boolean> {
  const { data: fresh } = await supabase
    .from('profiles').select('preferences').eq('id', userId).maybeSingle();
  const prefs = ((fresh?.preferences as Record<string, unknown> | null) ?? {});
  const digest = { ...((prefs[DIGEST_KEY] ?? {}) as Record<string, unknown>), lastSent: today };

  const { data: won } = await supabase
    .from('profiles')
    .update({ preferences: { ...prefs, [DIGEST_KEY]: digest } })
    .eq('id', userId)
    .or(`preferences->${DIGEST_KEY}->>lastSent.is.null,preferences->${DIGEST_KEY}->>lastSent.neq.${today}`)
    .select('id')
    .maybeSingle();
  return !!won;
}

// The day itself — tasks, meetings, content, requests, capacity — is read by
// `loadDigest` (lib/digest-data.ts), shared with the MCP `today` tool.
