import 'server-only';
// ── READING THE WAITLIST ────────────────────────────────────────────────────
//
// THESE ARE NOT SERVER ACTIONS, AND THAT IS THE POINT. Every export of a `'use server'` file is a
// callable endpoint — a stranger can POST to it. `listWaitlist` returns other people's email
// addresses, so it must never be one; it is a plain server-only function that the admin page calls
// after it has checked who is asking (lib/admin.ts). The one WRITE lives in lib/actions/waitlist.ts,
// where an endpoint is exactly what is wanted.
//
// THE PROBE. Migration 0048 is applied by hand, so the table may not exist yet. `waitlistReady()`
// answers that once per request, and the site uses it to decide whether to show the form at all —
// a form that silently drops what people type is worse than no form. Same capability-probe pattern
// as the rest of the product.

import { createServiceClient } from '@/lib/supabase/server';
import { WAITLIST_SEED, joinedTotal } from '@/lib/waitlist';

export type WaitlistRow = {
  id: string;
  number: number;
  email: string;
  name: string | null;
  /** The handle they claimed as they joined, held for them until launch. Null when they skipped it.
   *  It is on the ROW because it is claimed in the same insert (lib/actions/waitlist.ts) — and it is
   *  in this type because the person who runs the platform has to be able to answer "who is
   *  @rushil?" when that account is created. A handle collected and never shown back is a promise
   *  made to somebody that nobody can keep. */
  username: string | null;
  username_claimed_at: string | null;
  source: string;
  created_at: string;
};

/**
 * Is migration 0048 applied? A one-row read.
 *
 * NOT `head: true`, AND THAT IS THE WHOLE POINT. A HEAD request has no body by definition, so
 * PostgREST's 404 for a missing table arrives with **zero bytes** — supabase-js has nothing to parse
 * and hands back `error: null`. The first version of this probe used `head` and therefore answered
 * "ready" for a table that did not exist, which put a live form on the site that failed on submit.
 * Measured against the deployed project: HEAD → 404, 0 bytes; GET → 404, 166 bytes carrying
 * `PGRST205`. A probe must ask a question the answer can actually come back from.
 */
export async function waitlistReady(): Promise<boolean> {
  try {
    const { error } = await createServiceClient().from('waitlist').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/** The number the site shows: the seed plus everyone stored. Falls back to the seed alone while the
 *  table is missing, so the social proof card reads correctly before the migration lands. */
export async function waitlistCount(): Promise<number> {
  try {
    const { count, error } = await createServiceClient().from('waitlist').select('id', { head: true, count: 'exact' });
    // `count` is null whenever the read did not succeed — including the headless 404 above, which
    // reports no error at all. Both roads lead to the seed, which is the honest answer.
    if (error || count == null) return WAITLIST_SEED;
    return joinedTotal(count);
  } catch {
    return WAITLIST_SEED;
  }
}

/** Everyone on the list, newest first. Callers must have established WHO is asking first. */
export async function listWaitlist(): Promise<WaitlistRow[]> {
  try {
    const { data, error } = await createServiceClient()
      .from('waitlist')
      .select('id, number, email, name, username, username_claimed_at, source, created_at')
      .order('created_at', { ascending: false });
    return error ? [] : ((data ?? []) as WaitlistRow[]);
  } catch {
    return [];
  }
}
