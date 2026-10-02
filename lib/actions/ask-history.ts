'use server';
// ── ASK REMEMBERS ITS CONVERSATIONS ─────────────────────────────────────────
//
// The write and read side of the history rail (migration 0049). The grouping rule is arithmetic
// and lives in `lib/ask-history.ts`; this file only talks to the database.
//
// GATED, and that is not politeness — SPRINT_RULES rule 2 says a feature that breaks the app until
// someone runs a migration is a partial feature. Until 0049 is applied `askHistorySupported()`
// reports false, every function here returns a clean empty result, the rail does not render, and
// Ask behaves exactly as it does today: one in-memory conversation that ends on reload. Correct
// before and after, with no error in front of anyone.
//
// ── THIS FILE EXPORTS ASYNC FUNCTIONS AND NOTHING ELSE ──────────────────────
// A `'use server'` module may not export a value of any kind — not a const, not a type alias used
// as a value, not a re-export. One `export const` of failure copy took the whole Tasks page down
// on 2026-09-29 (lib/actions/inbox-file.ts). The shapes live in `lib/ask-history.ts` and are
// imported here; `lib/actions/use-server-exports.test.ts` keeps it that way.
import { notReady } from '@/lib/not-ready';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { activeSpaceId } from '@/lib/active-space';
import { titleFor, type AskConversation } from '@/lib/ask-history';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0049 applied? A zero-row probe against the TABLE — unlike the reminders probe,
 * which has to name a column because `tasks` predates it, `ask_conversations` does not exist at
 * all before 0049, so its absence is the whole answer.
 */
export async function askHistorySupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('ask_conversations').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

/**
 * The rail's list: every conversation, newest first, WITHOUT its messages.
 *
 * `last_message_at desc` matches the index 0049 creates, so this stays one index scan however many
 * conversations accumulate. The 200 cap is the rail's own — past that the honest affordance is
 * search, not a longer scroll, and an uncapped list is a query whose cost grows with tenure.
 */
export async function listAskConversations(): Promise<AskConversation[]> {
  const { supabase } = await requireSession();
  if (!(await askHistorySupported(supabase))) return [];

  const { data, error } = await supabase
    .from('ask_conversations')
    .select('id, title, last_message_at, pinned')
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    title: (r.title as string) || 'New chat',
    lastMessageAt: r.last_message_at as string,
    pinned: Boolean(r.pinned),
  }));
}

/**
 * One conversation's messages, oldest first — what opening a row in the rail reads.
 *
 * `payload` carries the whole `AskAnswer`, its `trace` included, so a reopened conversation shows
 * the same receipts it showed live rather than a sentence with its evidence gone. RLS scopes the
 * read; the explicit `conversation_id` filter is what makes it ONE conversation.
 *
 * `created_at` comes back because the transcript is HEADED with when the sitting began, and the
 * first message's instant is that. It was already being ordered on and then thrown away, so the
 * header only worked for a conversation you were having live — the one case it was not built for.
 */
export async function loadAskConversation(
  conversationId: string,
): Promise<{ role: 'said' | 'answered'; body: string; payload: unknown; createdAt: string }[]> {
  const { supabase } = await requireSession();
  if (!(await askHistorySupported(supabase))) return [];

  const { data, error } = await supabase
    .from('ask_messages')
    .select('role, body, payload, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error || !data) return [];

  return data.map((r) => ({
    role: r.role === 'answered' ? 'answered' : 'said',
    body: (r.body as string) ?? '',
    payload: r.payload ?? null,
    createdAt: r.created_at as string,
  }));
}

/**
 * Record one exchange, creating the conversation on the first one.
 *
 * **It returns the conversation id and never throws.** History is a convenience laid over Ask, not
 * a precondition for it: if the write fails — offline, unmigrated, RLS — the answer the person is
 * reading is still on screen and still correct. An Ask that refused to answer because it could not
 * file the answer would be the tail wagging the dog.
 *
 * `last_message_at` is written in the same call that inserts the messages rather than by a
 * trigger, so one fact has one writer (0049's header).
 */
export async function recordAskTurn(
  conversationId: string | null,
  said: string,
  answered: string,
  payload: unknown,
): Promise<{ conversationId: string | null }> {
  try {
    const { supabase, user } = await requireSession();
    if (!(await askHistorySupported(supabase))) return { conversationId: null };

    let id = conversationId;
    if (!id) {
      const spaceId = await activeSpaceId(supabase, user.id);
      const { data, error } = await supabase
        .from('ask_conversations')
        .insert({ user_id: user.id, space_id: spaceId, title: titleFor(said) })
        .select('id')
        .single();
      if (error || !data) return { conversationId: null };
      id = data.id as string;
    }

    // Both rows in ONE insert: two round trips to record one exchange is two chances to store
    // half of it, and a question with no answer beneath it reads as a bug rather than as a
    // failed write ([[zenboard-perf-round-trips]] — every query is an RTT, and this one is on
    // the path the person just finished waiting on).
    await supabase.from('ask_messages').insert([
      { conversation_id: id, user_id: user.id, role: 'said', body: said, payload: null },
      { conversation_id: id, user_id: user.id, role: 'answered', body: answered, payload: payload ?? null },
    ]);
    await supabase
      .from('ask_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', id);

    return { conversationId: id };
  } catch {
    return { conversationId: null };
  }
}

/** Rename a conversation. The person's own words either way — a model never names a record. */
export async function renameAskConversation(id: string, title: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await askHistorySupported(supabase))) return notReady('Chat history isn’t available yet.', '0049');

  const clean = title.trim().slice(0, 200);
  if (!clean) return { error: 'A chat needs a name.' };

  const { error } = await supabase.from('ask_conversations').update({ title: clean }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/** Pin or unpin. Pinned conversations sit above the dated groups, as they do in the references. */
export async function pinAskConversation(id: string, pinned: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await askHistorySupported(supabase))) return notReady('Chat history isn’t available yet.', '0049');

  const { error } = await supabase.from('ask_conversations').update({ pinned }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Delete a conversation and, by `on delete cascade` (0049), its messages.
 *
 * The cascade is in the schema rather than a second statement here on purpose: a delete that takes
 * two calls can lose the second one and leave messages with no conversation — rows nothing lists
 * and nobody can reach, which is the shape of a leak.
 */
export async function deleteAskConversation(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await askHistorySupported(supabase))) return notReady('Chat history isn’t available yet.', '0049');

  const { error } = await supabase.from('ask_conversations').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}
