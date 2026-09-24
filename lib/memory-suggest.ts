import 'server-only';
// Running the detectors against real data — master plan §7X §4.1, M3.
//
// `lib/detectors.ts` is pure arithmetic and knows nothing about Supabase. This
// file is the other half: it fetches what they need, converts timestamps into
// the user's own hours, and — most importantly — SUPPRESSES anything already
// answered. Nothing here writes a memory; that needs a human (§8).
//
// SUPPRESSION IS THE WHOLE DIFFERENCE between a useful review band and a nag.
// A proposal disappears for good once it has been either accepted or dismissed:
//
//   accepted  → the memory carries the proposal's key in `anchor`
//   dismissed → the key is in `profiles.preferences.memoryDismissed`
//
// Neither needed a new table. `anchor` is 0029's "where did this come from"
// column and a detector key is exactly that; `preferences` is where the app
// already keeps small per-user state (the calendar-feed token lives there).
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { currentProfile } from '@/lib/profile';
import { userTimezone } from '@/lib/user-tz';
import { minutesOfDayIn } from '@/lib/date';
import { memoriesSupported } from '@/lib/actions/memory';
import { recordHref } from '@/lib/connected';
import { subjectRef, dismissedKeys } from '@/lib/memory';
import {
  paymentRhythm, estimateAccuracy, workingHours, rankProposals,
  type Proposal, type SettledInvoice, type MeasuredTask,
} from '@/lib/detectors';

/** A proposal, plus what the band needs to render it. */
export type ProposalView = Proposal & {
  /** What the fact is about, in words. "About you" for `self`. */
  subjectLabel: string;
  href?: string;
};

/**
 * How many proposals the band offers at once.
 *
 * Four, and it is a UX limit rather than a technical one: this is a review
 * queue, and a queue you cannot clear in a sitting is one you stop opening.
 * The rest surface on the next visit, once these are answered.
 */
export const PROPOSAL_MAX = 4;

/**
 * The local hour a timestamp fell in, in the user's own zone.
 *
 * Built on `minutesOfDayIn` rather than a fresh `Intl.DateTimeFormat`, which is
 * not a style preference: `lib/date.ts` is THE date vocabulary and a test
 * (`date-vocabulary.test.ts`) fails the build for any formatter outside it. That
 * rule exists because a second, differently-configured formatter is how "18:05"
 * and "6:05 PM" end up on the same screen — and it caught this file.
 */
function localHour(iso: string, timeZone: string): number | null {
  const mins = minutesOfDayIn(iso, timeZone);
  return mins === undefined ? null : Math.floor(mins / 60);
}

const safe = async <T>(run: () => PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
  try {
    const { data } = await run();
    return data ?? [];
  } catch {
    return [];
  }
};

/**
 * Every pattern worth offering, newest evidence first.
 *
 * BOUNDED EVERYWHERE. Each source has a hard `limit` and the detectors' own
 * minimums do the rest — this runs on a page load, so an account with ten
 * thousand invoices must cost the same as one with fifty.
 *
 * Failures are swallowed per source (the `lib/connected.ts` doctrine): a review
 * band missing its payment proposals because `payments` hiccuped is useful; one
 * that throws and takes `/memory` down with it is not.
 */
export async function loadProposals(): Promise<ProposalView[]> {
  const user = await currentUser();
  if (!user) return [];

  const supabase = await createClient();
  if (!(await memoriesSupported(supabase))) return [];

  // No space filter: all three detectors read tables RLS already scopes to the
  // user, and a pattern in your invoices is not a per-space fact.
  const [timeZone, profile] = await Promise.all([userTimezone(), currentProfile()]);

  const [invoices, clients, projects, estimated, completions] = await Promise.all([
    // Settled invoices: the ones with both a due date and money against them.
    safe<{ id: string; client_id: string | null; due_date: string | null }>(() =>
      supabase.from('invoices').select('id,client_id,due_date')
        .eq('status', 'paid').not('due_date', 'is', null).not('client_id', 'is', null)
        .order('due_date', { ascending: false }).limit(200)),
    safe<{ id: string; name: string }>(() =>
      supabase.from('clients').select('id,name').limit(200)),
    safe<{ id: string; name: string }>(() =>
      supabase.from('projects').select('id,name').limit(200)),
    // Tasks that were estimated AND finished — the only ones that say anything
    // about estimating.
    safe<{ id: string; project_id: string | null; estimate_minutes: number | null }>(() =>
      supabase.from('tasks').select('id,project_id,estimate_minutes')
        .eq('done', true).not('project_id', 'is', null).not('estimate_minutes', 'is', null)
        .order('completed_at', { ascending: false }).limit(300)),
    safe<{ completed_at: string | null }>(() =>
      supabase.from('tasks').select('completed_at')
        .eq('done', true).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(400)),
  ]);

  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  // Payments for exactly the invoices above, then the LATEST payment per
  // invoice: a part-paid invoice settles when the last instalment lands, and
  // measuring from the first would flatter every client who pays in stages.
  const invoiceIds = invoices.map((i) => i.id);
  const payments = invoiceIds.length
    ? await safe<{ invoice_id: string; paid_on: string }>(() =>
      supabase.from('payments').select('invoice_id,paid_on').in('invoice_id', invoiceIds).limit(500))
    : [];
  const settledOn = new Map<string, string>();
  for (const p of payments) {
    const cur = settledOn.get(p.invoice_id);
    if (!cur || p.paid_on > cur) settledOn.set(p.invoice_id, p.paid_on);
  }

  const settled: SettledInvoice[] = [];
  for (const inv of invoices) {
    const paidOn = settledOn.get(inv.id);
    const name = inv.client_id ? clientName.get(inv.client_id) : undefined;
    if (!paidOn || !inv.due_date || !inv.client_id || !name) continue;
    settled.push({ clientId: inv.client_id, clientName: name, dueDate: inv.due_date, paidOn });
  }

  // Actual time per task, summed across sessions.
  const taskIds = estimated.map((t) => t.id);
  const entries = taskIds.length
    ? await safe<{ task_id: string | null; minutes: number | null }>(() =>
      supabase.from('time_entries').select('task_id,minutes').in('task_id', taskIds).limit(1000))
    : [];
  const actualByTask = new Map<string, number>();
  for (const e of entries) {
    if (!e.task_id) continue;
    actualByTask.set(e.task_id, (actualByTask.get(e.task_id) ?? 0) + (e.minutes ?? 0));
  }

  const measured: MeasuredTask[] = [];
  for (const t of estimated) {
    const name = t.project_id ? projectName.get(t.project_id) : undefined;
    const actual = actualByTask.get(t.id) ?? 0;
    if (!t.project_id || !name || !t.estimate_minutes || !actual) continue;
    measured.push({
      projectId: t.project_id, projectName: name,
      estimateMinutes: t.estimate_minutes, actualMinutes: actual,
    });
  }

  const hours = completions
    .map((t) => (t.completed_at ? localHour(t.completed_at, timeZone) : null))
    .filter((h): h is number => h !== null);

  const proposals = rankProposals([
    ...paymentRhythm(settled),
    ...estimateAccuracy(measured),
    ...workingHours(hours),
  ]);
  if (!proposals.length) return [];

  // ── Suppression ────────────────────────────────────────────────────────────
  const dismissed = new Set(dismissedKeys(profile?.preferences));
  const keys = proposals.map((p) => p.key);
  const accepted = await safe<{ anchor: string | null }>(() =>
    supabase.from('memories').select('anchor')
      .eq('source_type', 'detector').in('anchor', keys)
      .is('archived_at', null).limit(PROPOSAL_MAX * 4));
  const already = new Set(accepted.map((m) => m.anchor).filter((a): a is string => !!a));

  // A superseded derived fact is deliberately NOT suppressed: if you told us the
  // pattern changed, noticing the new one is the system working. `invalid_from`
  // is left out of the query above for exactly that reason.
  const live = proposals.filter((p) => !dismissed.has(p.key) && !already.has(p.key));

  return live.slice(0, PROPOSAL_MAX).map((p) => {
    // `subjectRef` is what keeps `self` out of `recordHref` — the subject
    // vocabulary has one member that is not a record, and this is the one
    // function in the app that knows it.
    const ref = subjectRef(p.subject);
    return {
      ...p,
      subjectLabel: ref
        ? (ref.type === 'client' ? clientName : projectName).get(ref.id) ?? 'Untitled'
        : 'About you',
      href: ref ? recordHref(ref.type, ref.id) : undefined,
    };
  });
}
