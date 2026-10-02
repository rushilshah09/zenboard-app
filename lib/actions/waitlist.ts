'use server';
// ── JOINING THE WAITLIST ────────────────────────────────────────────────────
//
// The ONE write, and the only path into the `waitlist` table: there is no anon insert policy (0048),
// so a stranger cannot reach the table except through here. This file exports TWO functions and the
// count is a decision, not an inventory — every export of a `'use server'` module is a public
// endpoint. The write below, and the handle-availability read at the bottom that the form needs as
// somebody types. The reads that return other people's ADDRESSES live in lib/waitlist-data.ts, under
// `server-only`, where they cannot become endpoints at all. Guarded by lib/waitlist-flow.test.ts.
//
// JOINING TWICE IS NOT AN ERROR ANYONE SHOULD SEE. Someone who already holds #83 and submits again
// — a second tab, a refresh, a shared laptop — gets #83 back and their ticket, not "that email is
// taken". The unique index on lower(email) makes that safe under concurrency: two simultaneous
// submits race, one wins, and the loser reads the winner's row instead of failing.
//
// SPAM: the honeypot and the time trap (lib/spam-guard.ts, the same two the form renderer uses) plus
// Turnstile when its secret is deployed. Turnstile degrades to "off" when unconfigured rather than
// walling everyone out, so this works before the key exists and tightens the moment it lands.
//
// The result NEVER throws. An action that rejects is a page with no message on it; this returns
// `{ error }` and the form says something true. (See the action-failure rule in PROGRESS.)

import { createServiceClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { trippedHoneypot, tooFast, MIN_FILL_MS_SINGLE_FIELD } from '@/lib/spam-guard';
import { sendEmail, siteOrigin } from '@/lib/email';
import {
  emailLooksValid, normaliseEmail, normaliseName, isWaitlistSource, formatTicket,
  normaliseUsername, usernameProblem,
  type WaitlistSource,
} from '@/lib/waitlist';

export type JoinInput = {
  email: string;
  name?: string | null;
  /** The handle they are claiming as they join (user, 2026-09-30). Optional: a handle is a nice to
   *  have, and refusing somebody a place on the list because the name they wanted was gone would be
   *  the wrong way round. */
  username?: string | null;
  source?: string;
  /** Hidden field no person sees. */
  honeypot?: string;
  /** When the form was opened, ISO. */
  startedAt?: string;
  turnstileToken?: string | null;
};

export type JoinResult =
  | { ok: true; id: string; number: number; name: string | null; username: string | null; already: boolean }
  | { error: string };

export async function joinWaitlist(input: JoinInput): Promise<JoinResult> {
  const email = normaliseEmail(input.email ?? '');
  if (!emailLooksValid(email)) return { error: 'That doesn’t look like an email address.' };

  // A tripped guard is answered like a success: a bot learns nothing from it, and the rare real
  // person who trips one is not shown a wall. They simply do not get a row.
  if (trippedHoneypot(input.honeypot) || tooFast(input.startedAt, MIN_FILL_MS_SINGLE_FIELD)) {
    return { ok: true, id: '', number: 0, name: null, username: null, already: true };
  }
  if (!(await verifyTurnstile(input.turnstileToken))) {
    return { error: 'We couldn’t verify that. Please try again.' };
  }

  const name = normaliseName(input.name);
  const source: WaitlistSource = isWaitlistSource(input.source) ? input.source : 'site';

  // The handle is claimed IN THE SAME INSERT, so joining and claiming cannot half-happen: there is
  // no window where somebody has a place but not the name they asked for, and no bearer token has
  // to be handed to the browser to finish the job later.
  const wanted = input.username ? normaliseUsername(input.username) : null;
  if (wanted) {
    const why = usernameProblem(wanted);
    if (why) return { error: why };
  }

  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('waitlist')
      .insert({ email, name, source, ...(wanted ? { username: wanted, username_claimed_at: new Date().toISOString() } : {}) })
      .select('id, number, name, username')
      .single();

    if (!error && data) {
      void emailTicket(email, name, data.number);
      return { ok: true, id: data.id, number: data.number, name: data.name, username: data.username, already: false };
    }

    // TWO unique indexes now, so a 23505 has two meanings and they need different answers: the
    // email one means "you are already on the list" (not an error at all), the username one means
    // "pick another name" (and they are NOT on the list yet). Postgres names the index in the
    // message, which is the only thing that tells them apart.
    if (error?.code === '23505' && /username/i.test(`${error.message} ${error.details ?? ''}`)) {
      return { error: 'Someone just took that username. Try another.' };
    }
    if (error?.code === '23505') {
      const { data: mine } = await db.from('waitlist').select('id, number, name, username').eq('email', email).single();
      if (mine) return { ok: true, id: mine.id, number: mine.number, name: mine.name, username: mine.username, already: true };
    }

    // The table is not there yet (migration 0048 unapplied). Say so plainly rather than pretending
    // it worked — the site should not have shown this form at all (waitlistReady()).
    // TWO CODES, because the write goes through PostgREST, not straight to Postgres: PostgREST
    // answers a missing table with **PGRST205** ("not found in the schema cache") and only reports
    // Postgres's own 42P01 when the relation vanishes under a prepared statement. Checking 42P01
    // alone — which the first version did — turns a missing migration into "Something went wrong".
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return { error: 'The waitlist isn’t open yet. Please try again shortly.' };
    }
    return { error: 'Something went wrong. Please try again.' };
  } catch {
    return { error: 'Something went wrong. Please try again.' };
  }
}

/** Best-effort confirmation. NOTE: until zenboard.life is verified in Resend and RESEND_FROM is set,
 *  the shared sender only delivers to the Resend account's own address — so this reaches almost
 *  nobody today. That is why the ticket is shown ON THE PAGE and can be saved and shared from there;
 *  the email is a courtesy on top, never the delivery. sendEmail never throws. */
async function emailTicket(to: string, name: string | null, number: number) {
  const ticket = formatTicket(number);
  const hello = name ? `Hi ${name},` : 'Hi,';
  await sendEmail({
    to,
    subject: `You're ${ticket} on the Zenboard waitlist`,
    text: [
      hello,
      '',
      `You're on the list. Ticket ${ticket}.`,
      '',
      'Zenboard is one calm workspace to run your business: tasks, projects, calendar, documents, clients and invoices in one place.',
      '',
      `Your ticket: ${siteOrigin()}/waitlist`,
      '',
      'We’ll email you when your place comes up.',
    ].join('\n'),
  });
}

// ── IS A HANDLE FREE? ─────────────────────────────────────────────────────
//
// The form asks this as somebody types, so the answer arrives before they submit rather than as a
// rejection afterwards. It is an endpoint on purpose, and it is the only READ that is one: it
// discloses whether a handle is taken, which is inherent — nobody can be told "pick another" without
// being told that much — and nothing else. No address, no number, no row id.
//
// WHAT USED TO BE HERE. A second action claimed a handle in a SECOND step, authorised by the row's
// uuid handed to the browser as a bearer capability. The handle is now claimed in the same insert as
// the row (user, 2026-09-30: "username use when they fill"), so that step and its capability are
// gone — and the action outlived its only caller. A `'use server'` export is a PUBLIC ENDPOINT: an
// unreachable function is still reachable by anyone not using the form, so dead code here is not
// merely dead, it is a door left open onto a table that has no RLS policies at all.

export async function usernameAvailable(raw: string): Promise<{ ok: true; free: boolean } | { error: string }> {
  const problem = usernameProblem(raw);
  if (problem) return { error: problem };
  const username = normaliseUsername(raw);
  try {
    const { data, error } = await createServiceClient()
      .from('waitlist').select('id').ilike('username', username).maybeSingle();
    if (error) return { error: 'Couldn’t check that just now.' };
    return { ok: true, free: !data };
  } catch {
    return { error: 'Couldn’t check that just now.' };
  }
}
