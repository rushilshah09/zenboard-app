// THE one answer to "what is waiting on somebody who is not me?"
//
// ── THE PROBLEM (PRODUCT_THINKING §3, §6) ───────────────────────────────────
// The brief asks Today to answer six questions the moment it opens. Five of them
// it already could. This is the one it could not:
//
//     What is waiting for someone else?
//
// The data existed the whole time — an approval sitting `awaiting`, a request
// we bounced back as `needs_info`, an invoice sent and now past its due date —
// but each lived on a different screen, so answering the question meant
// visiting three places and remembering what you saw. That is the fragmented
// workflow the product exists to remove, reproduced INSIDE the product.
//
// ── THE DEFINITION, AND WHY IT IS NARROW ────────────────────────────────────
// Waiting means **the next move is not yours**. That is the whole value: it is
// the exact complement of a to-do list, and the moment it starts including
// things you could act on, it becomes a second to-do list and you stop trusting
// either.
//
// So a task blocked by another of YOUR tasks is deliberately NOT here. That is
// sequencing, not waiting — the next move is still yours, it is just later.
// `lib/task-links.ts` already greys those in place, which is the right
// treatment for work you own.
//
// Today every waiting item is waiting on a CLIENT, because the app is
// single-owner: there is no teammate to be blocked by. When team seats land,
// "assigned to someone else and not started" becomes a fourth source and the
// shape below already carries `who`.
import type { RequestDecision } from '@/lib/request-status';

/** What kind of move we are waiting for. Drives the wording and the icon. */
export type WaitingKind = 'approval' | 'answer' | 'payment';

export type WaitingItem = {
  id: string;
  kind: WaitingKind;
  /** The thing itself — a deliverable's name, the question asked, an invoice number. */
  title: string;
  /** Who owes the move. Null when the record has no client attached. */
  who: string | null;
  /** When the ball left our court — ISO. Drives "waiting 6 days". */
  since: string;
  /** Where to go to act on it. */
  href: string;
  /** Past the date it was promised by. Only invoices carry a hard date. */
  overdue: boolean;
};

/** Rows this file needs. Structural, so callers' own types satisfy them. */
export type WaitingSources = {
  approvals: { id: string; title: string | null; status: string; created_at: string; project_id: string }[];
  requests: { id: string; title: string | null; body: string; status: string; created_at: string; project_id: string }[];
  invoices: { id: string; number: string; status: string; due_date: string | null; issue_date: string | null; client_name?: string | null }[];
  /** project id → client name, for saying WHO we are waiting on. */
  clientOf: Record<string, string | null>;
};

/** The order the list is read in. Not alphabetical, not by kind: oldest first,
 *  because the thing that has been waiting longest is the thing to chase. */
function byAge(a: WaitingItem, b: WaitingItem): number {
  // Overdue always leads — a missed date is a different category of late from
  // "nobody has answered yet", however long the latter has been sitting.
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return a.since < b.since ? -1 : 1;
}

const firstLine = (s: string): string => {
  const line = (s || '').trim().split('\n')[0]?.trim() ?? '';
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
};

/**
 * Everything currently sitting with someone else.
 *
 * Every branch reads a status EXPLICITLY rather than "not done": a list of
 * things you are waiting on must never grow a row because a status nobody
 * recognised defaulted into it.
 */
export function waitingOn(src: WaitingSources, todayISO: string): WaitingItem[] {
  const out: WaitingItem[] = [];

  // 1. A deliverable sent for sign-off that nobody has decided on.
  for (const a of src.approvals) {
    if (a.status !== 'awaiting') continue;
    out.push({
      id: `approval:${a.id}`,
      kind: 'approval',
      title: a.title?.trim() || 'Deliverable',
      who: src.clientOf[a.project_id] ?? null,
      since: a.created_at,
      href: `/projects/${a.project_id}?tab=portal`,
      overdue: false,
    });
  }

  // 2. A question we asked the client and they have not answered.
  //    `needs_info` ONLY: `pending` is waiting on US to decide, which is the
  //    opposite of this list and the easiest mistake to make here.
  for (const r of src.requests) {
    if ((r.status as RequestDecision) !== 'needs_info') continue;
    out.push({
      id: `request:${r.id}`,
      kind: 'answer',
      title: r.title?.trim() || firstLine(r.body) || 'Client request',
      who: src.clientOf[r.project_id] ?? null,
      since: r.created_at,
      href: `/projects/${r.project_id}?tab=portal`,
      overdue: false,
    });
  }

  // 3. An invoice issued and unpaid. `sent` and `overdue` both count — the two
  //    are the same fact at different times, and a draft is still ours.
  for (const i of src.invoices) {
    if (i.status !== 'sent' && i.status !== 'overdue') continue;
    const due = i.due_date;
    out.push({
      id: `invoice:${i.id}`,
      kind: 'payment',
      title: i.number,
      who: i.client_name ?? null,
      since: i.issue_date ?? i.due_date ?? todayISO,
      href: `/money/${i.id}`,
      overdue: !!due && due < todayISO,
    });
  }

  return out.sort(byAge);
}

/** One sentence for the whole list — what Today shows before you expand it. */
export function waitingSummary(items: WaitingItem[]): string | null {
  if (items.length === 0) return null;
  const overdue = items.filter((i) => i.overdue).length;
  const n = `${items.length} ${items.length === 1 ? 'thing' : 'things'}`;
  return overdue > 0 ? `${n}, ${overdue} overdue` : n;
}

/** "Waiting on Acme" / "Waiting" — the row's own line. Never invents a name. */
export function waitingLabel(item: WaitingItem): string {
  const verb: Record<WaitingKind, string> = {
    approval: 'Awaiting approval',
    answer: 'Awaiting an answer',
    payment: 'Awaiting payment',
  };
  return item.who ? `${verb[item.kind]} from ${item.who}` : verb[item.kind];
}
