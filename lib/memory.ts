// THE rules for what a memory is — master plan §7X, `MEMORY_MODULE_PLAN.md`,
// migration 0029. No React and no runtime Supabase import — the one query below
// takes its client as an argument — so the panel, the server action and the
// tests all decide "is this fact currently true?" the same way and none of them
// owns the answer. Same shape as `lib/connected.ts`, for the same reason.
//
// The whole module rests on one sentence: **a memory is a fact with a time
// validity.** Everything below is that sentence, plus the two things it does not
// say out loud — that a fact is atomic (one line, or it is a Doc), and that a
// fact is superseded rather than edited (or the history is a lie).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { EntityType, EntityRef } from '@/lib/connected';

type DB = SupabaseClient<Database>;

// ── The vocabulary ───────────────────────────────────────────────────────────

/**
 * Six kinds, fixed, matching 0029's CHECK. Deliberately NOT user-extensible: a
 * taxonomy the user maintains is filing by another name, and filing is the thing
 * this module exists to abolish.
 */
export const MEMORY_KINDS = ['preference', 'fact', 'decision', 'pattern', 'person', 'snippet'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** Sentence case, per the constitution. One word each — these sit in a 4-word chip. */
export const KIND_LABEL: Record<MemoryKind, string> = {
  preference: 'Preference',
  fact: 'Fact',
  decision: 'Decision',
  pattern: 'Pattern',
  person: 'Person',
  snippet: 'Snippet',
};

/** How a memory got here. Decides what the app may do with it, not just how it reads. */
export const MEMORY_ORIGINS = ['derived', 'marked', 'told', 'suggested'] as const;
export type MemoryOrigin = (typeof MEMORY_ORIGINS)[number];

/**
 * The receipt, in the words a person would use.
 *
 * A memory you cannot trace is a rumour, so every row can answer "why do you
 * think this?" — and for a fact you typed yourself the honest answer is "you
 * told me", not a fabricated source.
 */
export const ORIGIN_LABEL: Record<MemoryOrigin, string> = {
  derived: 'Noticed by Zenboard',
  marked: 'From a selection',
  told: 'You told me',
  suggested: 'Suggested',
};

/**
 * What a fact can be ABOUT. Every record type the fabric addresses, plus `self`
 * — you — which is the one subject with no row anywhere in the database.
 */
export type MemorySubjectType = EntityType | 'self';
export type MemorySubject = { type: MemorySubjectType; id: string | null };

/** The subject as an ordinary fabric ref, or null when the subject is you. */
export function subjectRef(s: MemorySubject): EntityRef | null {
  return s.type === 'self' || !s.id ? null : { type: s.type, id: s.id };
}

export const SELF: MemorySubject = { type: 'self', id: null };

export function sameSubject(a: MemorySubject, b: MemorySubject): boolean {
  return a.type === b.type && (a.id ?? null) === (b.id ?? null);
}

// ── The row ──────────────────────────────────────────────────────────────────

/** One row of `memories`, as every surface reads it. Mirrors 0029. */
export type Memory = {
  id: string;
  body: string;
  kind: MemoryKind;
  subject_type: MemorySubjectType;
  subject_id: string | null;
  origin: MemoryOrigin;
  source_type: string | null;
  source_id: string | null;
  anchor: string | null;
  valid_from: string;
  invalid_from: string | null;
  superseded_by: string | null;
  confidence: number;
  pinned: boolean;
  archived_at: string | null;
  /**
   * The decay signal (§5.4). Read from M4-decay onward, and the comment that
   * used to say these are "never rendered" was true right up until they became
   * the reason a fact sorts where it does. They are still never SHOWN — no
   * counter, no "last seen" line — they order, exactly like `confidence`.
   */
  last_recalled_at: string | null;
  recall_count: number;
};

export const subjectOf = (m: Memory): MemorySubject => ({ type: m.subject_type, id: m.subject_id });

// ── The body: atomic, one line ───────────────────────────────────────────────

/**
 * The cap, matching 0029's CHECK.
 *
 * It is a design statement rather than a storage limit: ten paragraphs of
 * meeting notes should produce three memories, not one blob. 280 is about two
 * lines at reading width — long enough for any real fact ("they pay on the 1st,
 * and only after a PO number is on the invoice"), short enough that a pasted
 * paragraph is visibly the wrong shape.
 */
export const BODY_MAX = 280;

/**
 * One line, no matter what arrived.
 *
 * A memory is very often a chunk of selected prose, which means newlines, soft
 * wraps and double spaces. All of it collapses: two facts differing only in
 * whitespace are one fact, and the dedupe index below depends on that being
 * true before anything reaches the database.
 *
 * It does NOT truncate. Silently cutting the end off someone's sentence would
 * store a fact that says something different from what they wrote — `bodyProblem`
 * makes over-long input a refusal the caller has to show, not a quiet edit.
 */
export function normalizeBody(input: string | null | undefined): string | null {
  const t = (input ?? '').replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}

export type BodyProblem = 'empty' | 'too-long';

/** Whether this body can be stored, and if not, which of the two reasons. */
export function bodyProblem(input: string | null | undefined): BodyProblem | null {
  const t = normalizeBody(input);
  if (!t) return 'empty';
  if (t.length > BODY_MAX) return 'too-long';
  return null;
}

/**
 * The dedupe identity — remembering the same thing about the same subject twice
 * is one fact, and the second attempt should be told so rather than quietly
 * making a twin. (Mem0's lesson, and the difference between a memory and a note
 * pile.)
 *
 * KEEP THIS IN STEP WITH `idx_memories_dedupe` in 0029. They are one rule
 * written twice — the index is the guarantee, this is how the app predicts it,
 * and a version that disagreed would show "remembered" for a row the database
 * had just rejected. Same nil-uuid coalesce, for the same reason: in a unique
 * index nulls never collide, so without it `self` would be the one subject with
 * no dedupe at all.
 */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
export function factKey(subject: MemorySubject, body: string): string {
  return `${subject.type}:${subject.id ?? NIL_UUID}:${(normalizeBody(body) ?? '').toLowerCase()}`;
}

/** Does this subject already know this? The local half of the rule above. */
export function alreadyKnown(existing: Memory[], subject: MemorySubject, body: string): Memory | null {
  const key = factKey(subject, body);
  return existing.find((m) => isCurrent(m) && factKey(subjectOf(m), m.body) === key) ?? null;
}

// ── The temporal spine ───────────────────────────────────────────────────────

const time = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/**
 * Is this fact true right now — or at any moment you name?
 *
 * THE predicate. `invalid_from is null` is the fast path every read uses and the
 * one 0029's partial index is built on; the `at` argument is what makes "what
 * was true in March" a question this module can answer at all.
 *
 * Archived rows are excluded here rather than at each call site: archiving is
 * the user saying "stop telling me this", and a surface that had to remember to
 * filter it would eventually forget.
 *
 * Half-open interval — `[valid_from, invalid_from)` — so a fact superseded at
 * noon and its replacement, valid from the same instant, never both read as true.
 */
export function isCurrent(m: Memory, at: Date | string = new Date()): boolean {
  const when = typeof at === 'string' ? time(at) : at.getTime();
  if (when === null) return false;
  if (m.archived_at && (time(m.archived_at) ?? 0) <= when) return false;
  const from = time(m.valid_from);
  if (from !== null && from > when) return false;
  const until = time(m.invalid_from);
  return until === null || until > when;
}

/** Everything that was true at a given moment. §5's "what was true in March". */
export function asOf(list: Memory[], at: Date | string = new Date()): Memory[] {
  return list.filter((m) => isCurrent(m, at));
}

/**
 * How much surer a fact gets when you say "yes, still true".
 *
 * §3.1 promised that derived facts "start below 1 and rise when confirmed", and
 * until M4 nothing ever raised one — the column moved in exactly one direction,
 * which made it a label rather than a signal.
 *
 * A STEP, not a jump to certainty. One confirmation is one observation; three
 * separate weeks of saying "still true" is what earns a fact the top of the
 * list. And it caps at 1 without ever exceeding it, because 0029's CHECK is the
 * real boundary and an app that has to be clamped at the database is an app that
 * got the rule wrong.
 */
export const CONFIRM_STEP = 0.15;
export function confirmedConfidence(current: number): number {
  const base = Number.isFinite(current) ? current : 0;
  return Math.min(1, Math.max(0, base) + CONFIRM_STEP);
}

// ── Decay (§5.4) ─────────────────────────────────────────────────────────────
//
// "A memory never recalled and never confirmed loses confidence and eventually
// archives itself. It is never DELETED by the system — archived is reversible,
// deleted is not, and a memory system that quietly loses things is worse than
// none."
//
// TWO DELIBERATE DIFFERENCES from that sentence, and both come from §9's "zero
// surprise" measure, which outranks tidiness:
//
//   1. **Decay is COMPUTED, never stored.** No cron, no sweep, no migration —
//      `fadedConfidence` is a pure function of time since the fact was last
//      touched. A stored decay would mean the number in the database drifts from
//      the number the rule implies, and then two surfaces disagree about how
//      sure we are.
//   2. **Nothing archives ITSELF.** A fact that vanished from a client page
//      while you were not looking is precisely the surprise this module cannot
//      afford. Fading is what stops a stale fact reaching the ambient 3 (§5.3) —
//      it drops in the ordering and stops being surfaced — and the "About to
//      fade" band on /memory ASKS before anything is archived. The plan's
//      outcome, one confirmation later.

/** Nothing fades inside this window. A fact you recorded last month is not stale. */
export const FADE_GRACE_DAYS = 90;
/** After the grace period, confidence halves every this-many days of silence. */
export const FADE_HALFLIFE_DAYS = 120;
/** Below this, a fact is "about to fade" and the review band asks about it. */
export const FADE_THRESHOLD = 0.25;

const DAY_MS = 86_400_000;

/**
 * When this fact was last given a reason to stay: recalled, confirmed, or —
 * failing both — established.
 */
export function lastTouched(m: Memory): number | null {
  return time(m.last_recalled_at) ?? time(m.valid_from);
}

/**
 * How sure we are TODAY, after silence.
 *
 * Exponential, not linear, and grace-gated: a fact decays only after 90 days
 * with nobody recalling or confirming it, and then halves every 120. Recalling
 * one resets the clock without touching the stored number — which is why
 * `recallMemory` writes only `last_recalled_at`, and `confirmMemory` (which
 * raises the stored value) is the stronger of the two signals.
 *
 * PINNED FACTS NEVER FADE. Pinning is the user saying "keep this in front of
 * me", and a rule that overrode it would be the system arguing with them.
 */
export function fadedConfidence(m: Memory, at: Date | string = new Date()): number {
  if (m.pinned) return m.confidence;
  const now = typeof at === 'string' ? time(at) : at.getTime();
  const touched = lastTouched(m);
  if (now === null || touched === null) return m.confidence;

  const silentDays = (now - touched) / DAY_MS - FADE_GRACE_DAYS;
  if (silentDays <= 0) return m.confidence;
  return m.confidence * Math.pow(0.5, silentDays / FADE_HALFLIFE_DAYS);
}

/** Has this fact gone quiet enough to be worth asking about? */
export function isFading(m: Memory, at: Date | string = new Date()): boolean {
  return isCurrent(m, at) && !m.pinned && fadedConfidence(m, at) < FADE_THRESHOLD;
}

/**
 * The facts about to fade, faintest first.
 *
 * Bounded like every other review list: this is a question queue, and one you
 * cannot clear in a sitting is one you stop opening.
 */
export function fadingFacts(list: Memory[], at: Date | string = new Date(), limit = 5): Memory[] {
  return list
    .filter((m) => isFading(m, at))
    .sort((a, b) => fadedConfidence(a, at) - fadedConfidence(b, at))
    .slice(0, limit);
}

/**
 * The facts a review should actually ask about, least certain first.
 *
 * Not everything you know — a review that lists forty facts is a wall, and the
 * honest answer to most of them is "obviously still true". The ones worth a
 * question are the ones the system is least sure of, and pinned facts are
 * excluded outright: pinning is the user having already answered.
 */
export function needsReview(list: Memory[], limit = 5): Memory[] {
  return list
    .filter((m) => isCurrent(m) && !m.pinned)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, limit);
}

/**
 * What a fact replaced — its predecessors, oldest first.
 *
 * THE MODULE'S FOUNDING CLAIM IS "facts are superseded, never overwritten", and
 * until this existed that claim was unfalsifiable from the outside: the chain
 * was in the data and on no screen. This is what makes it checkable.
 *
 * Walks `superseded_by` BACKWARDS. That column points from an old fact to the
 * one that replaced it, so the predecessor of `id` is whichever row points at
 * it — a reverse lookup, not a field read.
 *
 * Defensive about cycles. `superseded_by` has no constraint that forbids a loop
 * (A replaced by B replaced by A), and while nothing in the app can write one,
 * an infinite walk here would hang a render rather than fail one row.
 */
export function historyOf(all: Memory[], id: string): Memory[] {
  const predecessorOf = new Map<string, Memory>();
  for (const m of all) {
    if (m.superseded_by) predecessorOf.set(m.superseded_by, m);
  }

  const chain: Memory[] = [];
  const seen = new Set<string>([id]);
  let cursor = id;
  while (chain.length < all.length) {
    const prev = predecessorOf.get(cursor);
    if (!prev || seen.has(prev.id)) break;
    seen.add(prev.id);
    chain.push(prev);
    cursor = prev.id;
  }
  // Collected newest-first by construction; a history reads oldest-first.
  return chain.reverse();
}

/**
 * The order every memory surface shows facts in.
 *
 * Pinned first (the user overrides everything), then confidence, then most
 * recently established. Confidence orders and never decorates — it is the reason
 * a derived guess sits below something you stated, and it is deliberately never
 * rendered as a number.
 *
 * The confidence it sorts on is the FADED one (§5.4), which is the whole
 * mechanism behind "a memory never recalled eventually stops surfacing": the
 * ambient panel shows the top three, so a fact that has gone quiet for months
 * drops out of them without anything being hidden or deleted.
 *
 * Returns a new array; callers render server data they must not mutate.
 */
export function sortMemories(list: Memory[], at: Date | string = new Date()): Memory[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ca = fadedConfidence(a, at);
    const cb = fadedConfidence(b, at);
    if (ca !== cb) return cb - ca;
    return (time(b.valid_from) ?? 0) - (time(a.valid_from) ?? 0);
  });
}

/**
 * What changes on the OLD row when a fact is replaced.
 *
 * Supersession is two writes and their order matters: the replacement is
 * inserted first, because `superseded_by` has to point at a row that exists.
 * This is the second write, kept pure so the rule — a superseded fact stops
 * being true at exactly the instant its replacement starts — lives in one place
 * and is testable without a database.
 *
 * The old row is NOT edited to say the new thing. That is the whole point: an
 * overwritten fact takes its own history with it, and then "what was true in
 * March" has no answer.
 */
export function supersedePatch(replacementId: string, at: Date = new Date()) {
  return { invalid_from: at.toISOString(), superseded_by: replacementId };
}

/**
 * The moment a replacement becomes true — the same instant the old fact stops.
 *
 * Shared with `supersedePatch` by the caller passing one `Date` to both, which
 * is what keeps the interval half-open with no gap and no overlap.
 */
export function validFromFor(at: Date = new Date()): string {
  return at.toISOString();
}

/**
 * "About you" leads.
 *
 * It is the only subject with no other surface in the product — every record
 * subject is also reachable from its own page — so if it sorted like the rest,
 * the one group the memory home exists for would end up buried under the ones
 * that did not need it.
 *
 * A stable partition rather than a comparator, so everything else keeps the
 * order it arrived in. Generic over the group shape because BOTH the loader and
 * the page apply it: the loader orders what it fetched, and the page re-applies
 * it because it also SYNTHESISES an empty "About you" when there are no self
 * facts yet. One rule in one place, or the two would eventually disagree — and
 * the harness caught exactly that disagreement before this existed.
 */
export function selfFirst<T extends { subject: MemorySubject }>(groups: T[]): T[] {
  return [
    ...groups.filter((g) => g.subject.type === 'self'),
    ...groups.filter((g) => g.subject.type !== 'self'),
  ];
}

/**
 * Facts grouped by what they are ABOUT — the shape the `/memory` home reads in.
 *
 * "About you" leads (`selfFirst`); **everything else keeps the order it arrived
 * in**, which for a newest-first query means the subject you last learned
 * something about is at the top. Not alphabetical: this is a review surface, and
 * recency is what makes it one.
 *
 * Pure, so the ordering can be pinned by a test without a database.
 */
export function groupBySubject(rows: Memory[]): { key: string; subject: MemorySubject; items: Memory[] }[] {
  const byKey = new Map<string, Memory[]>();
  for (const m of rows) {
    const key = `${m.subject_type}:${m.subject_id ?? ''}`;
    byKey.set(key, [...(byKey.get(key) ?? []), m]);
  }
  const groups = [...byKey].map(([key, items]) => {
    const [type, id] = key.split(':');
    return {
      key,
      subject: { type: type as MemorySubjectType, id: id || null },
      items: sortMemories(items),
    };
  });
  return selfFirst(groups);
}

// ── Refused proposals (M3) ───────────────────────────────────────────────────
//
// Where "no, don't tell me that again" is kept. It lives in
// `profiles.preferences` rather than a table because a refusal is not a fact
// about your work — it is a preference about what this module may bring up.
//
// DEFINED HERE, not beside the detectors, and the reason is structural: both the
// loader that reads dismissals and the action that writes them would otherwise
// have to import each other. This module is the one they already share.

/** The key inside `profiles.preferences`. */
export const DISMISSED_KEY = 'memoryDismissed';

/** Bounded, so one JSON column cannot grow forever. Oldest fall off first — and
 *  a key that ages out can only be re-OFFERED, never resurrect a memory. */
export const DISMISSED_MAX = 200;

/** The refused keys, defensively — `preferences` is untyped JSON. */
export function dismissedKeys(preferences: unknown): string[] {
  const raw = (preferences as Record<string, unknown> | null)?.[DISMISSED_KEY];
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** What a new memory needs. Defined here rather than in the action file because
 *  a `'use server'` module may only export async functions. */
export type RememberInput = {
  body: string;
  subject: MemorySubject;
  kind?: MemoryKind;
  /**
   * `told` (typed) · `marked` (selected) · `derived` (a detector noticed it and
   * YOU accepted it — M3). `suggested` waits for the clerk at M5.
   *
   * `derived` does NOT mean "written by the system": §8's never-list forbids
   * that outright. It means a proposal a human said yes to, which is why this
   * value can only arrive through `acceptProposal`.
   */
  origin?: Extract<MemoryOrigin, 'told' | 'marked' | 'derived'>;
  /**
   * The receipt — where this came from, so the fact can be traced back.
   *
   * `id` is nullable because a DERIVED fact has no single source row: it comes
   * from arithmetic over many. Those carry `type: 'detector'` and put the
   * proposal's stable key in `anchor`, which is what stops the same pattern
   * being offered again once accepted.
   */
  source?: { type: string; id?: string | null; anchor?: string | null } | null;
  /** 0–1. Derived facts start below 1 and rise when confirmed (§3.1). */
  confidence?: number;
};

/**
 * How many facts a record surface shows before asking.
 *
 * Three, from §5.3: the ambient surface exists to save you re-deriving the two
 * or three things you'd have gone digging for, and a wall of cards to scroll is
 * mymind's product rather than this one. The rest are one click away.
 */
export const AMBIENT_MAX = 3;

/** Every column a surface reads. Deliberately not `*`: `recall_count` and
 *  `last_recalled_at` feed decay and are never rendered. Exported so the home
 *  loader selects exactly the same shape rather than growing a second `Memory`. */
export const MEMORY_COLUMNS =
  'id,body,kind,subject_type,subject_id,origin,source_type,source_id,anchor,' +
  'valid_from,invalid_from,superseded_by,confidence,pinned,archived_at,' +
  // Decay (§5.4). Not `*` even now: 0029 has columns no surface reads.
  'last_recalled_at,recall_count';

/**
 * What is currently known about one subject.
 *
 * Space is deliberately NOT a filter here: the subject is already space-scoped
 * (a client lives in one space), so adding the condition would only be able to
 * hide a fact from the very record it is about. RLS scopes to the user, as
 * everywhere.
 *
 * Returns [] on any failure, including the table not existing yet — the same
 * doctrine as `lib/connected.ts`. A panel that renders nothing before migration
 * 0029 is correct; one that throws takes a client page down with it.
 */
export async function loadMemoriesFor(
  db: DB,
  subject: MemorySubject,
  opts: { limit?: number } = {},
): Promise<Memory[]> {
  try {
    let q = db.from('memories').select(MEMORY_COLUMNS)
      .eq('subject_type', subject.type)
      .is('invalid_from', null)
      .is('archived_at', null)
      .order('pinned', { ascending: false })
      .order('valid_from', { ascending: false })
      .limit(opts.limit ?? 50);
    // `self` is the one subject stored with a null id, so it needs `is` rather
    // than `eq` — PostgREST's `eq.null` matches nothing at all, silently.
    q = subject.id ? q.eq('subject_id', subject.id) : q.is('subject_id', null);

    const { data, error } = await q;
    if (error) return [];
    return sortMemories((data ?? []) as unknown as Memory[]);
  } catch {
    return [];
  }
}
