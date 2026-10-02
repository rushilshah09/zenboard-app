'use server';
// Memory, write side — master plan §7X, migration 0029. The rules live in
// lib/memory.ts; this file only performs them.
//
// GATED. Until 0029 is applied `memoriesSupported()` reports false, every action
// here returns a clean "not available yet", and the panel renders nothing. The
// app is correct before and after — rule 2, and the reason the capability probe
// is the house pattern rather than a workaround.
//
// THE ONE INVARIANT THIS FILE PROTECTS: a fact is superseded, never overwritten.
// `updateMemoryBody` exists only for fixing a typo and says so; changing what a
// memory CLAIMS goes through `supersedeMemory`, which leaves the old row intact
// with an end date and a pointer. Blur that and "what was true in March" stops
// having an answer, which is the entire reason this module is worth building.
import { notReady } from '@/lib/not-ready';
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { requireSession } from '@/lib/auth';
import {
  bodyProblem, normalizeBody, supersedePatch, validFromFor, BODY_MAX,
  dismissedKeys, DISMISSED_KEY, DISMISSED_MAX, confirmedConfidence,
  type Memory, type MemorySubject, type MemoryKind, type RememberInput,
} from '@/lib/memory';

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Is migration 0029 applied? A zero-row probe, the same fetch-time capability
 * pattern as `taskLinksSupported` / `attachmentsSupported`. Probing the TABLE is
 * correct here: 0029's whole contribution is a new table, so its absence is the
 * table's absence.
 */
export async function memoriesSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('memories').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

const NOT_READY = () => notReady('Memory isn’t available yet.', '0029');

/** Every column the app reads back, matching `COLUMNS` in lib/memory.ts. */
const RETURNING =
  'id,body,kind,subject_type,subject_id,origin,source_type,source_id,anchor,' +
  'valid_from,invalid_from,superseded_by,confidence,pinned,archived_at';

export type MemoryResult = { error: string } | { ok: true; memory: Memory };

/** The refusals a body can earn, in the words the user sees. One place, so the
 *  panel and the toolbar cannot disagree about why something was rejected. */
function refuseBody(body: string): string | null {
  const problem = bodyProblem(body);
  if (problem === 'empty') return 'Write the fact first.';
  if (problem === 'too-long') {
    return `A memory is one line: trim this to ${BODY_MAX} characters. Longer than that belongs in a doc.`;
  }
  return null;
}

/**
 * Which space a fact belongs to.
 *
 * A fact about a client belongs to the space that client lives in; a fact about
 * YOU is true everywhere and gets null (0029's reasoning, and the answer to the
 * plan's open question 2). Using the ACTIVE space for record subjects matches
 * `syncMentions` — the record you are looking at is in the space you are in.
 */
async function spaceFor(supabase: DB, userId: string, subject: MemorySubject): Promise<string | null> {
  if (subject.type === 'self') return null;
  return activeSpaceId(supabase, userId);
}

/**
 * Remember one fact.
 *
 * A duplicate is NOT an error the user caused — they tried to record something
 * true, and it is already recorded. 0029's partial unique index is what
 * guarantees it (two tabs can both miss a local check), and the message says
 * what happened rather than showing a constraint name.
 */
export async function remember(input: RememberInput): Promise<MemoryResult> {
  const { supabase, user } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();

  const refusal = refuseBody(input.body);
  if (refusal) return { error: refusal };
  const body = normalizeBody(input.body)!;

  const { subject } = input;
  // 0029's `memories_subject_shape` — enforced here too so a bad call fails with
  // a sentence instead of a check-constraint violation.
  if (subject.type === 'self' ? subject.id != null : !subject.id) {
    return { error: 'A memory needs to be about something.' };
  }

  const space_id = await spaceFor(supabase, user.id, subject);

  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: user.id,
      space_id,
      body,
      kind: input.kind ?? 'fact',
      subject_type: subject.type,
      subject_id: subject.id,
      origin: input.origin ?? 'told',
      source_type: input.source?.type ?? null,
      source_id: input.source?.id ?? null,
      anchor: input.source?.anchor ?? null,
      // Clamped rather than trusted: `confidence` reaches here from a detector's
      // arithmetic, and 0029's CHECK would reject an out-of-range value with a
      // constraint violation instead of a sentence.
      confidence: input.confidence == null ? 1 : Math.min(1, Math.max(0, input.confidence)),
    })
    .select(RETURNING)
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'You already remember that.' };
    return { error: error.message };
  }
  return { ok: true, memory: data as unknown as Memory };
}

/**
 * Replace a fact with what is true now.
 *
 * Two writes, and the order is the whole mechanism: the replacement is inserted
 * FIRST, because `superseded_by` has to point at a row that exists. If the
 * second write fails the first is rolled back by hand — leaving both rows
 * current would mean the panel shows a fact and its contradiction side by side,
 * which is worse than the supersession simply not happening.
 *
 * The old row is never edited to say the new thing. That is the point.
 */
export async function supersedeMemory(previousId: string, body: string): Promise<MemoryResult> {
  const { supabase, user } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();

  const refusal = refuseBody(body);
  if (refusal) return { error: refusal };
  const next = normalizeBody(body)!;

  const { data: previous, error: readErr } = await supabase
    .from('memories').select(RETURNING).eq('id', previousId).maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!previous) return { error: 'That memory is gone.' };
  const prev = previous as unknown as Memory;

  if (prev.invalid_from) return { error: 'That memory was already replaced.' };
  // Superseding a fact with itself is not a new claim about the world — and the
  // insert below would be refused by the dedupe index anyway, with a message
  // about duplicates that would not explain what just happened.
  if (normalizeBody(prev.body)!.toLowerCase() === next.toLowerCase()) {
    return { error: 'That is already what you know.' };
  }

  // ONE instant for both writes, so the interval is half-open with no gap and no
  // overlap — the property `isCurrent` is tested against.
  const at = new Date();
  const subject: MemorySubject = { type: prev.subject_type, id: prev.subject_id };
  const space_id = await spaceFor(supabase, user.id, subject);

  const { data: created, error: insErr } = await supabase
    .from('memories')
    .insert({
      user_id: user.id,
      space_id,
      body: next,
      kind: prev.kind,
      subject_type: prev.subject_type,
      subject_id: prev.subject_id,
      // A correction is something you told us, whatever the original was.
      origin: 'told',
      source_type: prev.source_type,
      source_id: prev.source_id,
      anchor: prev.anchor,
      valid_from: validFromFor(at),
    })
    .select(RETURNING)
    .single();

  if (insErr) {
    if (insErr.code === '23505') return { error: 'You already remember that.' };
    return { error: insErr.message };
  }
  const replacement = created as unknown as Memory;

  const { error: updErr } = await supabase
    .from('memories')
    .update(supersedePatch(replacement.id, at))
    .eq('id', previousId);

  if (updErr) {
    // Hand-rolled rollback. There is no transaction across two PostgREST calls,
    // and the alternative — two contradictory current facts — is the one state
    // this module must never be in.
    await supabase.from('memories').delete().eq('id', replacement.id);
    return { error: updErr.message };
  }
  return { ok: true, memory: replacement };
}

/**
 * Fix a typo. NOT a way to change what a fact claims — see the file header.
 *
 * The distinction is real: "Acme wants invocies on the 1st" and "Acme wants
 * invoices on the 1st" are the same fact spelled two ways, so rewriting in place
 * loses nothing. "…on the 15th" is a different fact and must supersede.
 * Nothing enforces which one a caller means, so the UI offers exactly one of
 * them: the panel edits, and a changed meaning is the user's own judgement.
 */
export async function updateMemoryBody(id: string, body: string): Promise<MemoryResult> {
  const { supabase } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();

  const refusal = refuseBody(body);
  if (refusal) return { error: refusal };

  const { data, error } = await supabase
    .from('memories')
    .update({ body: normalizeBody(body)! })
    .eq('id', id)
    .select(RETURNING)
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'You already remember that.' };
    return { error: error.message };
  }
  return { ok: true, memory: data as unknown as Memory };
}

/** Pin a fact: it floats to the top and is exempt from decay. The user override. */
export async function setMemoryPinned(id: string, pinned: boolean): Promise<MemoryResult> {
  const { supabase } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();
  const { data, error } = await supabase
    .from('memories').update({ pinned }).eq('id', id).select(RETURNING).single();
  return error ? { error: error.message } : { ok: true, memory: data as unknown as Memory };
}

/**
 * Stop being told this. Reversible, and deliberately the only ending the system
 * itself is ever allowed to reach (§5.4): archived can be undone, deleted cannot,
 * and a memory system that quietly loses things is worse than none.
 */
export async function archiveMemory(id: string, archived = true): Promise<MemoryResult> {
  const { supabase } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();
  const { data, error } = await supabase
    .from('memories')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id).select(RETURNING).single();
  return error ? { error: error.message } : { ok: true, memory: data as unknown as Memory };
}

/**
 * Actually delete one — the answer to the plan's open question 3.
 *
 * Only ever on the user's say-so, never on a timer and never as a cleanup: it is
 * how "undo" unwinds a memory created seconds ago, and how someone removes a
 * fact they never wanted recorded. Nothing in the product calls this on its own.
 */
export async function forgetMemory(id: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();
  const { error } = await supabase.from('memories').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// ── Proposals (M3) ───────────────────────────────────────────────────────────
//
// The clerk doctrine, enforced in code: a detector produces a candidate and
// NOTHING becomes a memory without one of these two calls. §8's never-list opens
// with "never write a memory silently" and this is where that is either true or
// it isn't.

/**
 * Say yes to a detected pattern.
 *
 * The proposal's key goes into `anchor` with `source_type = 'detector'`, which is
 * what stops the same pattern being offered again — and, read the other way, is
 * the receipt: it says which detector claimed this and about what.
 *
 * `origin: 'derived'` is honest about provenance. The fact was noticed by
 * Zenboard, and the panel says so ("Noticed by Zenboard") rather than letting a
 * machine-inferred claim wear the same clothes as one you stated yourself.
 */
export async function acceptProposal(
  p: { key: string; body: string; subject: MemorySubject; kind?: MemoryKind; confidence?: number },
): Promise<MemoryResult> {
  return remember({
    body: p.body,
    subject: p.subject,
    kind: p.kind ?? 'pattern',
    origin: 'derived',
    confidence: p.confidence,
    source: { type: 'detector', id: null, anchor: p.key },
  });
}

/**
 * Say no, permanently.
 *
 * Stored as a key in `profiles.preferences` rather than a row, because a refusal
 * is not a fact about your work — it is a preference about what this module is
 * allowed to bring up. Bounded: the oldest fall off past `DISMISSED_MAX`, and a
 * key that ages out can only ever be re-offered, never resurrect a memory.
 *
 * Idempotent, so a double-click cannot write the same key twice.
 */
export async function dismissProposal(key: string): Promise<{ error: string } | { ok: true }> {
  const { supabase, user } = await requireSession();
  if (!key.trim()) return { error: 'Nothing to dismiss.' };

  const { data: profile, error: readErr } = await supabase
    .from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  if (readErr) return { error: readErr.message };

  const preferences = (profile?.preferences ?? {}) as Record<string, unknown>;
  const current = dismissedKeys(preferences);
  if (current.includes(key)) return { ok: true };

  const next = [...current, key].slice(-DISMISSED_MAX);
  const { error } = await supabase
    .from('profiles')
    .update({ preferences: { ...preferences, [DISMISSED_KEY]: next } })
    .eq('id', user.id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * "Yes, still true."
 *
 * The other half of the temporal spine. Supersession records that a fact
 * CHANGED; this records that it was checked and did not — which is what makes a
 * derived guess earn its place over time, and what §3.1 meant by confidence
 * rising when confirmed.
 *
 * It also stamps `last_recalled_at`. That column and `recall_count` exist to
 * feed decay (§5.4), and a fact you confirmed a week ago is by definition not
 * one that has been forgotten.
 */
export async function confirmMemory(id: string): Promise<MemoryResult> {
  const { supabase } = await requireSession();
  if (!(await memoriesSupported(supabase))) return NOT_READY();

  // `recall_count` is deliberately NOT part of `Memory` — it feeds decay and is
  // never rendered, so widening the type would make every surface in the app
  // fetch a column none of them show. It is asked for HERE, where it is the one
  // thing being written, and nowhere else.
  const { data: row, error: readErr } = await supabase
    .from('memories').select(`${RETURNING}, recall_count`).eq('id', id).maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: 'That memory is gone.' };
  const current = row as unknown as Memory & { recall_count: number | null };

  // Confirming something that is no longer true would raise the confidence of a
  // superseded claim — the one row nobody should be able to vouch for.
  if (current.invalid_from) return { error: 'That memory was already replaced.' };

  const { data, error } = await supabase
    .from('memories')
    .update({
      confidence: confirmedConfidence(current.confidence),
      last_recalled_at: new Date().toISOString(),
      recall_count: (current.recall_count ?? 0) + 1,
    })
    .eq('id', id).select(RETURNING).single();
  return error ? { error: error.message } : { ok: true, memory: data as unknown as Memory };
}

/**
 * "I used this." The weaker of the two decay signals (§5.4).
 *
 * Called when a fact is actually RECALLED — selected out of ⌘K — and it moves
 * `last_recalled_at` only. Confidence is left exactly where it was on purpose:
 * looking something up proves you still need it, not that it is still true.
 * `confirmMemory` is the one that says true, and it is the one that raises.
 *
 * Fire-and-forget. It runs while the user is navigating away, so it must never
 * be something they can notice failing.
 */
export async function recallMemory(id: string): Promise<void> {
  try {
    const { supabase } = await requireSession();
    if (!(await memoriesSupported(supabase))) return;
    const { data } = await supabase
      .from('memories').select('recall_count').eq('id', id).maybeSingle();
    await supabase.from('memories').update({
      last_recalled_at: new Date().toISOString(),
      recall_count: ((data as { recall_count: number | null } | null)?.recall_count ?? 0) + 1,
    }).eq('id', id);
  } catch { /* best effort — a missed recall stamp costs a little decay, nothing more */ }
}
