import 'server-only';
// The `/memory` home's loader — master plan §7X §7, M2.
//
// THE PAGE IS FOR REVIEW, NOT BROWSING, and that shapes this file: it returns
// facts GROUPED BY WHAT THEY ARE ABOUT, because the question the page answers is
// "what do I know, and about whom" — not "show me everything in one long list".
// A wall of cards to scroll is mymind's product; ours is a page you can read.
//
// There is deliberately no search parameter here. ⌘K is the one search
// (never-list: "no second search box"), and memories joined that index in
// `lib/search.ts` rather than growing a sibling.
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { activeSpaceId } from '@/lib/active-space';
import { resolveRefs, recordHref } from '@/lib/connected';
import type { EntityRef } from '@/lib/connected';
import { memoriesSupported } from '@/lib/actions/memory';
import {
  MEMORY_COLUMNS, groupBySubject, subjectRef, historyOf, asOf, needsReview, fadingFacts,
  type Memory, type MemorySubject,
} from '@/lib/memory';

export type MemoryGroup = {
  /** Stable React key — `type:id`, with `self` collapsing to a single group. */
  key: string;
  subject: MemorySubject;
  label: string;
  /** Where the subject lives, when it still exists and has a route. */
  href?: string;
  /** The subject no longer resolves — kept, struck through, never silently dropped. */
  tombstone?: boolean;
  items: Memory[];
};

export type MemoryHome = {
  /** False until migration 0029 is applied. The page says so rather than lying. */
  supported: boolean;
  groups: MemoryGroup[];
  archived: Memory[];
  /** Currently-true, unarchived facts. The number in the header. */
  total: number;
  /** Facts that have gone quiet long enough to be worth asking about (§5.4). */
  fading: Memory[];
  /**
   * What each rendered fact replaced, keyed by its id. Empty for most facts —
   * the overwhelming majority of things you know have never changed.
   */
  history: Record<string, Memory[]>;
  /**
   * The day being viewed, when it is not today (`?on=YYYY-MM-DD`). The page says
   * so loudly: a screen showing March's facts that looks like today's is the
   * worst possible outcome for a module whose point is knowing WHEN things were
   * true.
   */
  asOfDay?: string;
};

const EMPTY: MemoryHome = { supported: false, groups: [], archived: [], total: 0, history: {}, fading: [] };

/**
 * Everything currently known, plus the archive.
 *
 * SPACE RULE (0029, and the plan's open question 2): a fact carries a
 * `space_id`, or `null` meaning "true everywhere". Facts about YOU are the null
 * ones, so the filter has to be `space_id = active OR space_id is null` — an
 * `eq` alone would hide exactly the facts that have no other home, which is the
 * bug this comment exists to stop someone "simplifying" back in.
 */
export async function loadMemoryHome(opts: { on?: string } = {}): Promise<MemoryHome> {
  const user = await currentUser();
  if (!user) return EMPTY;

  const supabase = await createClient();
  if (!(await memoriesSupported(supabase))) return EMPTY;

  const spaceId = await activeSpaceId(supabase, user.id);
  // `?on=` is a calendar date; it is read as the END of that day so "1 March"
  // means everything true at any point during the 1st, not at midnight sharp.
  const asOfDay = /^\d{4}-\d{2}-\d{2}$/.test(opts.on ?? '') ? opts.on : undefined;

  const [{ data: live }, { data: gone }, { data: replaced }] = await Promise.all([
    // AS-OF changes what "live" means: on a past day the currently-true rows are
    // the wrong set entirely, so the filter drops and `asOf` decides instead.
    (asOfDay
      ? supabase.from('memories').select(MEMORY_COLUMNS).is('archived_at', null)
      : supabase.from('memories').select(MEMORY_COLUMNS).is('invalid_from', null).is('archived_at', null)
    )
      .or(`space_id.eq.${spaceId},space_id.is.null`)
      .order('valid_from', { ascending: false })
      .limit(500),
    // The archive is a disclosure at the foot of the page, so it is bounded
    // hard: it exists to let you restore something you regret, not to be read.
    supabase.from('memories').select(MEMORY_COLUMNS)
      .not('archived_at', 'is', null)
      .or(`space_id.eq.${spaceId},space_id.is.null`)
      .order('archived_at', { ascending: false })
      .limit(50),
    // Superseded rows — the raw material for every history chain on the page.
    // One extra query rather than a lazy fetch per row: a page with 30 facts
    // would otherwise be 30 round trips the moment anyone started expanding.
    supabase.from('memories').select(MEMORY_COLUMNS)
      .not('invalid_from', 'is', null)
      .or(`space_id.eq.${spaceId},space_id.is.null`)
      .order('invalid_from', { ascending: false })
      .limit(300),
  ]);

  const superseded = (replaced ?? []) as unknown as Memory[];
  const fetched = (live ?? []) as unknown as Memory[];
  // On a past day, everything that had not yet been archived is a candidate and
  // `asOf` — the same tested predicate the panel uses — picks the survivors.
  const rows = asOfDay ? asOf([...fetched, ...superseded], `${asOfDay}T23:59:59.999Z`) : fetched;
  const archived = (gone ?? []) as unknown as Memory[];

  // Chains for exactly the rows being rendered. `historyOf` needs the superseded
  // pool AND the current rows, because the link it follows points forward.
  const pool = [...rows, ...superseded];
  const history: Record<string, Memory[]> = {};
  for (const m of rows) {
    const chain = historyOf(pool, m.id);
    if (chain.length) history[m.id] = chain;
  }

  // Grouping and ordering are `groupBySubject` (pure, tested). This file only
  // adds the half that needs the database: what each subject is CALLED.
  const grouped = groupBySubject(rows);

  // One batched call through the app's single answer to "what is this id called".
  const refs = grouped.map((g) => subjectRef(g.subject)).filter((r): r is EntityRef => !!r);
  const names = refs.length ? await resolveRefs(supabase, refs) : new Map<string, string>();

  const groups: MemoryGroup[] = grouped.map(({ key, subject, items }) => {
    if (subject.type === 'self') return { key, subject, label: 'About you', items };

    // RESOLVED vs NAMED are different questions, and conflating them shipped a
    // blank heading: an untitled doc resolves to the empty string, which is not
    // null, so `name ?? 'Deleted'` kept it — and the group rendered as a bare
    // count above its facts with nothing saying what they were about.
    //
    // `undefined` means the row is gone (tombstone). An empty title means the
    // row is there and simply has no name yet, which is "Untitled" — the same
    // word every other surface in the app uses for it.
    const name = names.get(`${subject.type}:${subject.id}`);
    const resolved = name !== undefined;
    return {
      key,
      subject,
      // A subject that no longer resolves keeps its facts. They were true about
      // something, and silently dropping them would be the one behaviour a
      // memory system must never have.
      label: resolved ? (name.trim() || 'Untitled') : 'Deleted',
      href: resolved ? recordHref(subject.type, subject.id!) : undefined,
      tombstone: !resolved,
      items,
    };
  });

  // Computed from rows already in hand — decay is a read-time rule, so this
  // costs no query. Never on a past day: "about to fade" is a question about
  // now, and asking it from a March view would be asking about a different fact
  // set than the one the answer would touch.
  const fading = asOfDay ? [] : fadingFacts(rows);

  return { supported: true, groups, archived, total: rows.length, history, asOfDay, fading };
}

/**
 * The facts the weekly review should ask about — §7X §5.4.
 *
 * "Memory's natural curation moment, and where §7G already puts *is this still
 * true?* for goals. Same question, same place." This is the loader for that
 * step: least-certain first, capped, and never a pinned fact.
 *
 * Returns an empty list rather than throwing when 0029 is absent, so the review
 * is one step shorter and nothing else changes.
 */
export async function loadReviewMemories(): Promise<{ id: string; body: string; confidence: number }[]> {
  const user = await currentUser();
  if (!user) return [];

  const supabase = await createClient();
  if (!(await memoriesSupported(supabase))) return [];

  const spaceId = await activeSpaceId(supabase, user.id);
  const { data } = await supabase.from('memories').select(MEMORY_COLUMNS)
    .is('invalid_from', null).is('archived_at', null)
    .or(`space_id.eq.${spaceId},space_id.is.null`)
    // Ordered by confidence in the DATABASE as well as in `needsReview`: the cap
    // is applied after the sort either way, and fetching 500 rows to keep 5
    // would be a page-load cost for a step most weeks answers in seconds.
    .order('confidence', { ascending: true })
    .limit(40);

  return needsReview((data ?? []) as unknown as Memory[])
    .map((m) => ({ id: m.id, body: m.body, confidence: m.confidence }));
}
