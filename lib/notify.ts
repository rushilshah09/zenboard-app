import 'server-only';
// Owner notifications — the one place a notification row is written. Public portal
// and form actions call this after they've resolved (token-scoped) which owner the
// event belongs to, so the service role is writing on the owner's behalf, never on
// a caller-supplied user id. The bell reads these back through RLS (owner-only).
//
// A notification is a courtesy: this NEVER throws and never blocks the caller's real
// action. If the insert fails, the client's request/reply/response still succeeds.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type AnyDB = SupabaseClient<Database>;

export type NotifyKind =
  | 'portal.request'   // client submitted a new request
  | 'portal.reply'     // client replied in a request thread
  | 'portal.approval'  // client approved / requested changes on a deliverable
  | 'form.response';   // someone completed a form

/** A destination the bell can navigate to when the row is clicked. */
export type NotifyLink = { href: string };

export async function notifyOwner(
  db: AnyDB,
  n: { userId: string | null | undefined; kind: NotifyKind; title: string; body?: string | null; link?: NotifyLink },
): Promise<void> {
  try {
    if (!n.userId) return;
    await db.from('notifications').insert({
      user_id: n.userId,
      kind: n.kind,
      title: n.title.slice(0, 200),
      body: n.body ? n.body.slice(0, 500) : null,
      link: n.link ?? null,
    });
  } catch {
    /* courtesy only — never a gate on the caller's action */
  }
}
