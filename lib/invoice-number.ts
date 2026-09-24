// Invoice numbering — one rule, because there is now more than one caller.
//
// This lived inside lib/actions/money.ts as a private `nextNumber(supabase)`
// that counted the invoice table and trusted RLS to scope the count to the
// signed-in owner. That was fine while every caller was an owner action. §7M's
// accept crossing is not: it runs on the PUBLIC path, through the service role,
// where RLS is off and a bare count returns every invoice in the database —
// which for a new user would silently number their first invoice INV-014.
//
// So the scope is a parameter now. There is no unique index on `number` (two
// users legitimately both have INV-001), which is exactly why nothing would
// have complained.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type AnyDB = SupabaseClient<Database>;

/** The trailing digits of "INV-014", "2026-07", "7" — or null if there are none. */
export function numberSuffix(number: string): number | null {
  const m = /(\d+)\s*$/.exec(number ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * The highest number in use, plus one — NOT the row count plus one.
 *
 * Counting reuses a number as soon as anything is deleted or voided, which
 * produces two invoices called INV-004 and one very bad conversation with an
 * accountant. Taking the maximum costs the same single query and cannot repeat.
 */
export function nextNumberFrom(existing: string[], pad = 3): string {
  const highest = existing.reduce((max, n) => Math.max(max, numberSuffix(n) ?? 0), 0);
  return `INV-${String(highest + 1).padStart(pad, '0')}`;
}

/**
 * The owner's next invoice number.
 *
 * `userId` is required rather than inferred: the whole point of this file is
 * that one of the callers has no RLS to fall back on.
 */
export async function nextInvoiceNumber(db: AnyDB, userId: string): Promise<string> {
  const { data } = await db.from('invoices').select('number').eq('user_id', userId);
  return nextNumberFrom((data ?? []).map((r) => r.number));
}
