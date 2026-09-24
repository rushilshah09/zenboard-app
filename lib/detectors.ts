// The derived detectors — master plan §7X §4.1, M3.
//
// THIS IS THE DIFFERENTIATOR, and it is worth being precise about why. mymind,
// Supermemory, Mem0 and Zep must all be TOLD things. Zenboard already holds the
// invoices, the time entries and the completions — so the most valuable memories
// in this product are the ones nobody types: *this client has paid late three
// quarters running*, *work on this project runs a third over*, *you finish
// things in the morning and plan them for the afternoon*.
//
// FOUR RULES, and each is load-bearing:
//
//  1. **Pure.** Every detector takes plain rows and returns proposals. No
//     Supabase import, no clock, no timezone — the caller resolves all three.
//     That is what makes them testable, and a detector you cannot test is a
//     rumour generator.
//  2. **A proposal is not a memory.** Nothing here writes. "Never write a memory
//     silently" is the clerk doctrine and §8's never-list puts it first; these
//     return candidates for a human to accept or refuse.
//  3. **Silence is the default.** Every detector returns null unless the pattern
//     is both real and worth a sentence. §9 sets the honest measure: below ~50%
//     acceptance the detectors are noise and should be CUT, not tuned — so they
//     start conservative and stay quiet about the ordinary. "This client pays on
//     time" is not a memory; it is the absence of one.
//  4. **Every proposal carries its evidence**, in the words a person would use.
//     A derived fact you cannot interrogate is exactly the thing that makes a
//     memory system feel like surveillance rather than help.
//
// NO AI. The plan is explicit that M1–M4 contain none: the module has to be
// worth using before a model touches it, or we cannot tell whether the model is
// helping. Everything below is arithmetic.
import type { MemoryKind, MemorySubject } from '@/lib/memory';

/** A candidate fact. Becomes a `memories` row only when a human accepts it. */
export type Proposal = {
  /**
   * Stable across runs, for the same pattern about the same subject.
   *
   * It is what makes accept and dismiss STICK: an accepted proposal is stored in
   * the memory's `anchor`, a dismissed one in `profiles.preferences`, and both
   * suppress it next time. Without a stable key a dismissed proposal returns
   * every single load, which is worse than never having detected it.
   */
  key: string;
  subject: MemorySubject;
  /** The fact, as it will read if accepted. Self-contained — see NAMES below. */
  body: string;
  kind: MemoryKind;
  /** 0–1. Orders the list; never rendered as a number. */
  confidence: number;
  /** "Why do you think this?" — the receipt, in one line. */
  evidence: string;
};

// NAMES ARE BAKED INTO THE BODY ("Meridian Studio pays about 6 days late")
// rather than left implicit from the subject. A fact has to read correctly in
// ⌘K Recall, where nothing around it says who it is about. The cost is that
// renaming a client leaves an old fact wording the old name — which is correct
// for a system whose whole premise is that facts are snapshots with a validity,
// not live queries.

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Middle value; the mean would let one catastrophic invoice invent a pattern. */
export function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * How sure to be, from how much was seen and how consistently it pointed the
 * same way.
 *
 * Capped BELOW 1 on purpose: §3.1 says a derived fact starts under 1 and rises
 * when confirmed. A detector that claimed certainty would sort above the things
 * you told us yourself, which is exactly backwards.
 */
export function derivedConfidence(samples: number, agreement: number): number {
  return clamp(agreement * (0.4 + 0.06 * samples), 0.3, 0.85);
}

// Every count reaching this helper is above a minimum of 3 or more, so the
// singular branch is currently unreachable. It stays because those minimums are
// tunable constants at the top of each detector, and "1 days late" is exactly
// the kind of thing a threshold change ships silently.
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── 1. Payment rhythm, per client ────────────────────────────────────────────

export type SettledInvoice = {
  clientId: string;
  clientName: string;
  /** When it was due, and when money actually arrived. Both calendar dates. */
  dueDate: string;
  paidOn: string;
};

/** Below this many settled invoices, a "rhythm" is a coincidence. */
export const PAYMENT_MIN_INVOICES = 3;
/** Inside this many days of the due date IS on time — and on time is not a fact. */
export const PAYMENT_TOLERANCE_DAYS = 3;

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string): number | null => {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
};

/**
 * "Meridian Studio pays about 6 days late."
 *
 * The single most useful thing this module can know, and one no external tool
 * can: it needs your invoices and your payments in the same place.
 *
 * Median rather than mean, and a tolerance band, so the output is a RHYTHM and
 * not a reaction to one invoice that went to the wrong address. Unaffected by
 * the Stripe/Razorpay hold — it reads invoice history, never a processor.
 */
export function paymentRhythm(rows: SettledInvoice[]): Proposal[] {
  const byClient = new Map<string, { name: string; deltas: number[] }>();
  for (const r of rows) {
    const d = daysBetween(r.dueDate, r.paidOn);
    if (d === null) continue;
    const cur = byClient.get(r.clientId) ?? { name: r.clientName, deltas: [] };
    cur.deltas.push(d);
    byClient.set(r.clientId, cur);
  }

  const out: Proposal[] = [];
  for (const [clientId, { name, deltas }] of byClient) {
    if (deltas.length < PAYMENT_MIN_INVOICES) continue;
    const mid = median(deltas);
    if (Math.abs(mid) <= PAYMENT_TOLERANCE_DAYS) continue;   // on time — rule 3

    const late = mid > 0;
    // How many invoices actually agree with the verdict. A median can sit past
    // the tolerance on a split sample, and "about 6 days late" would then be a
    // claim about a client who is simply erratic.
    const agreeing = deltas.filter((d) => (late ? d > PAYMENT_TOLERANCE_DAYS : d < -PAYMENT_TOLERANCE_DAYS)).length;
    const agreement = agreeing / deltas.length;
    if (agreement < 0.6) continue;

    const days = Math.abs(Math.round(mid));
    out.push({
      key: `payment-rhythm:${clientId}`,
      subject: { type: 'client', id: clientId },
      body: late
        ? `${name} pays about ${plural(days, 'day')} late.`
        : `${name} pays about ${plural(days, 'day')} early.`,
      kind: 'pattern',
      confidence: derivedConfidence(deltas.length, agreement),
      evidence: `${agreeing} of ${plural(deltas.length, 'settled invoice')}, measured from the due date.`,
    });
  }
  return out;
}

// ── 2. Estimate accuracy, per project ────────────────────────────────────────

export type MeasuredTask = {
  projectId: string;
  projectName: string;
  estimateMinutes: number;
  actualMinutes: number;
};

/** Below this many measured tasks, a ratio is one bad afternoon. */
export const ESTIMATE_MIN_TASKS = 5;

/**
 * "The Acme rebrand runs about 40% over estimate."
 *
 * Only tasks with BOTH an estimate and real tracked time count — a task you
 * never estimated says nothing about your estimating, and one you never tracked
 * says nothing about the work. Totals are compared rather than per-task ratios
 * averaged, because a 5-minute task that took 15 would otherwise read as a 200%
 * overrun and drown a week of accurate work.
 */
export function estimateAccuracy(rows: MeasuredTask[]): Proposal[] {
  const byProject = new Map<string, { name: string; est: number; act: number; n: number }>();
  for (const r of rows) {
    if (!(r.estimateMinutes > 0) || !(r.actualMinutes > 0)) continue;
    const cur = byProject.get(r.projectId) ?? { name: r.projectName, est: 0, act: 0, n: 0 };
    cur.est += r.estimateMinutes;
    cur.act += r.actualMinutes;
    cur.n += 1;
    byProject.set(r.projectId, cur);
  }

  const out: Proposal[] = [];
  for (const [projectId, { name, est, act, n }] of byProject) {
    if (n < ESTIMATE_MIN_TASKS || est <= 0) continue;
    const ratio = act / est;
    if (ratio > 0.8 && ratio < 1.25) continue;   // estimating fine — rule 3

    const over = ratio >= 1.25;
    const pct = Math.round(Math.abs(ratio - 1) * 100);
    out.push({
      key: `estimate-accuracy:${projectId}`,
      subject: { type: 'project', id: projectId },
      body: over
        ? `Work on ${name} takes about ${pct}% longer than estimated.`
        : `Work on ${name} comes in about ${pct}% under estimate.`,
      kind: 'pattern',
      // Agreement is 1 here: the ratio IS the aggregate, so the only thing
      // moderating confidence is how many tasks went into it.
      confidence: derivedConfidence(n, 1),
      evidence: `${plural(n, 'task')} with both an estimate and tracked time.`,
    });
  }
  return out;
}

// ── 3. The hours you actually finish work in ─────────────────────────────────

/** Below this many completions, an hour histogram is noise. */
export const HOURS_MIN_COMPLETIONS = 20;
/** How wide a "when you work" window is. Four hours is a morning or an afternoon. */
export const HOURS_WINDOW = 4;

const clock = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

/**
 * "You finish most work between 09:00 and 13:00."
 *
 * Takes LOCAL hours (0–23), already converted by the caller — a detector that
 * did its own timezone maths would be the fifth place in this app that decides
 * what day it is, and `lib/date.ts` exists precisely so there is one.
 *
 * The window wraps midnight, because plenty of people finish work at 23:00 and
 * a detector that could not see that would tell a night owl nothing at all.
 */
export function workingHours(hours: number[], opts: { window?: number } = {}): Proposal[] {
  const valid = hours.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  if (valid.length < HOURS_MIN_COMPLETIONS) return [];

  const width = opts.window ?? HOURS_WINDOW;
  const counts = new Array(24).fill(0) as number[];
  for (const h of valid) counts[h] += 1;

  // A window must START on an hour you actually finish things in. Without that
  // rule, [09,10,11] with nothing at 08 ties between 08:00–12:00 and
  // 09:00–13:00 — identical totals — and the scan reports the one with an empty
  // leading hour, which is padding presented as a habit.
  let best = { start: -1, total: -1 };
  for (let start = 0; start < 24; start += 1) {
    if (counts[start] === 0) continue;
    let total = 0;
    for (let i = 0; i < width; i += 1) total += counts[(start + i) % 24];
    if (total > best.total) best = { start, total };
  }
  if (best.start < 0) return [];

  const share = best.total / valid.length;
  // Half of everything inside a four-hour window is a real habit; less than that
  // is just "you work during the day", which nobody needs told.
  if (share < 0.5) return [];

  return [{
    key: 'working-hours:self',
    subject: { type: 'self', id: null },
    body: `You finish most of your work between ${clock(best.start)} and ${clock(best.start + width)}.`,
    kind: 'pattern',
    confidence: derivedConfidence(Math.min(valid.length, 40), share),
    evidence: `${Math.round(share * 100)}% of ${plural(valid.length, 'completed task')} landed in that window.`,
  }];
}

/**
 * Everything, ordered the way the review band reads: surest first.
 *
 * Detectors are deliberately independent — one that throws or returns nothing
 * must not silence the others — so this is a plain concat rather than a pipeline.
 */
export function rankProposals(proposals: Proposal[]): Proposal[] {
  return [...proposals].sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));
}
