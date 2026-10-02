'use server';
// Writing the fabric. `lib/connected.ts` has read the `mentions` table since
// 0027 shipped; this is the first thing that puts rows in it, which is what
// turns every backlink section in the app from an empty list into a real one.
//
// Called from a document's autosave. Three properties it must have, in order:
//
//   1. NEVER take the save down. A document that refuses to save because an
//      edge table hiccuped is a catastrophe; a missing backlink is a nuisance.
//      Everything here is best-effort and returns rather than throws.
//   2. Write only what changed. Every keystroke saves, so a naive
//      delete-all-then-insert would hammer a table the Connected panel reads.
//   3. Be idempotent. 0027's unique index means a duplicate insert is a
//      conflict, not a second edge — `ignoreDuplicates` makes that a no-op.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { mentionsSupported, type EntityRef } from '@/lib/connected';
import { diffMentions, mentionsInDoc, type MentionBlock, type MentionProp } from '@/lib/mentions';

import type { EntityType } from '@/lib/connected';

/** What the table gives back. `target_type` is a plain column, so it is widened
 *  to EntityType at the boundary rather than trusted blindly downstream. */
type StoredEdge = { id: string; target_type: EntityType; target_id: string; anchor: string | null };

/**
 * Reconcile one source's outgoing mentions against what its content now says.
 *
 * `origin` lets absolute "Copy link" URLs resolve; it comes from the caller
 * because a server action has no window. Passing nothing still catches every
 * relative link, which is what the editor writes.
 */
export async function syncMentions(
  source: EntityRef,
  blocks: MentionBlock[] | null | undefined,
  opts: { origin?: string; props?: MentionProp[] | null } = {},
): Promise<{ ok: true; inserted: number; removed: number } | { skipped: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { skipped: 'not authenticated' };
    if (!(await mentionsSupported(supabase))) return { skipped: '0027 not applied' };

    // Body AND properties in one pass: a relation property is a reference, and
    // syncing the two halves separately would make each delete the other's rows.
    const next = mentionsInDoc(blocks, opts.props, { self: source, origin: opts.origin });

    const { data: existing, error: readErr } = await supabase
      .from('mentions')
      .select('id, target_type, target_id, anchor')
      .eq('source_type', source.type)
      .eq('source_id', source.id);
    if (readErr) return { skipped: readErr.message };

    const { insert, remove } = diffMentions((existing ?? []) as StoredEdge[], next);
    // The overwhelmingly common case: you typed a word and touched no links.
    if (!insert.length && !remove.length) return { ok: true, inserted: 0, removed: 0 };

    const sid = await activeSpaceId(supabase, user.id);

    // Removals first. If the two collide — a link moved to another block, so
    // the same target arrives with a new anchor — doing it in this order means
    // the unique index never sees both rows at once.
    if (remove.length) {
      await supabase.from('mentions').delete().in('id', remove.map((r) => r.id));
    }
    if (insert.length) {
      await supabase.from('mentions').insert(
        insert.map((e) => ({
          user_id: user.id,
          space_id: sid,
          source_type: source.type,
          source_id: source.id,
          target_type: e.target_type,
          target_id: e.target_id,
          anchor: e.anchor,
          context: e.context,
          origin: 'mention' as const,
        })),
      );
      // No conflict handling on purpose. The diff above means a collision can
      // only come from a genuine race (the same document saving from two tabs),
      // and 0027's unique index is an EXPRESSION index — `coalesce(anchor,'')` —
      // which `onConflict` cannot name. A rejected duplicate leaves exactly the
      // row we wanted anyway, and the whole call is best-effort by design.
    }
    return { ok: true, inserted: insert.length, removed: remove.length };
  } catch (e) {
    // Property 1. The caller does not check this and must not have to.
    return { skipped: e instanceof Error ? e.message : 'unknown error' };
  }
}

/**
 * Forget everything a source pointed AT, when the source itself is gone.
 *
 * The reverse direction is deliberately left alone: 0027 has no FK on
 * `target_id`, because §7H wants a deleted target to become a TOMBSTONE — the
 * backlink stays and renders struck-through rather than vanishing, which is the
 * difference between "that page was deleted" and a list that silently shrinks.
 */
export async function forgetMentionsFrom(source: EntityRef): Promise<void> {
  try {
    const supabase = await createClient();
    if (!(await mentionsSupported(supabase))) return;
    await supabase.from('mentions').delete()
      .eq('source_type', source.type).eq('source_id', source.id);
  } catch { /* best effort — see syncMentions */ }
}
