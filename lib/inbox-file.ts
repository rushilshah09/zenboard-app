// ── THE INBOX KNOWS WHERE THINGS GO ─────────────────────────────────────────
//
// MASTER_PRODUCT_PLAN §7Q's *File* capability: "triage/inbox suggestions (project, date, label,
// 'similar task exists') learned from YOUR filing history. One tap to accept; off by default;
// never auto-applies."
//
// EVERYTHING IN THIS FILE IS ARITHMETIC. That is the point, not a limitation. PRODUCT_THINKING's
// standing decision is to "build the DETERMINISTIC version of each flow first" — because if the
// clerk files a client's work under the wrong client, trust in the whole system goes, and a rule
// that got it wrong can be read and corrected while a model that got it wrong can only be re-run.
// A model is asked only about the thoughts these rules leave unplaced, through lib/inbox-ai.ts,
// and it proposes into the same shape with the same receipts.
//
// FOUR RULES, inherited from the derived detectors (lib/detectors.ts), which make the same promise
// about memories that this makes about filing:
//
//  1. **Pure.** Rows in, proposals out. No Supabase, no clock, no timezone — the caller resolves
//     all three, which is what makes a proposal testable rather than a rumour.
//  2. **A proposal is not a filing.** Nothing here writes. A proposal becomes a project_id the
//     ordinary way: the person presses the key they would have pressed anyway.
//  3. **Silence is the default.** No proposal unless the evidence is both real and clearly points
//     one way. A wrong suggestion costs more than a missing one, because the missing one leaves
//     triage exactly as fast as it is today.
//  4. **Every proposal carries its evidence** in words a person can check against their own data:
//     "3 tasks in Meridian Coffee mention 'palette'" — never "92% confident".
//
// WHAT IT LEARNS FROM is the person's own filed tasks: the titles they have already put in each
// project. Nothing global, nothing shared between accounts, nothing stored — the index is built
// per request from rows the caller already had to load.

import { CHIP_KINDS, parseTask } from '@/lib/task-parse';
import { contentTokens, flatten, saysPhrase } from '@/lib/text-match';

/** A task already filed somewhere: one piece of evidence about what belongs there. */
export type FiledTask = { title: string; projectId: string };

/**
 * One title, filed under one thing — a project or a label. The scorer is written over this rather
 * than over projects, because "which of my piles does this look like?" is the same question either
 * way and asking it twice in two dialects is how two answers drift apart. A task with two labels is
 * two rows here; a task with one project is one.
 */
export type FiledUnder = { title: string; bucketId: string };

/** A label a thought could carry. Named separately from a project because it is not a home. */
export type FileLabel = { id: string; name: string };

/** A place a thought could go. `client` is the name of whoever it is for, when it has one. */
export type FileProject = { id: string; name: string; client?: string | null };

/** An unfiled thought, as the Inbox holds it. */
export type Thought = { id: string; title: string };

/** Where a proposal came from, which is also how much it can be trusted. */
export type FileSource = 'name' | 'history' | 'model';

/** "This belongs in Meridian Coffee." */
export type ProjectProposal = {
  projectId: string;
  projectName: string;
  /** 0–1. Orders the list and gates it; never rendered as a number. */
  confidence: number;
  /** "Why do you think this?", in one line. */
  evidence: string;
  source: FileSource;
};

/** "You wrote 'by Thursday'." The words are the person's own — this is never inferred. */
export type DateProposal = { date: string; evidence: string };

/** "This one is usually 'Waiting'." A label is not a home, so it is never part of the filing key. */
export type LabelProposal = { labelId: string; labelName: string; confidence: number; evidence: string };

/** "You already have this." A warning, not a filing. */
export type DuplicateOf = { taskId: string; title: string };

/** Everything the clerk has to say about one thought. Any field may be absent; usually most are. */
export type FileProposals = {
  thoughtId: string;
  project?: ProjectProposal;
  scheduled?: DateProposal;
  due?: DateProposal;
  label?: LabelProposal;
  duplicate?: DuplicateOf;
};

// ── THE SCORER ──────────────────────────────────────────────────────────────

/**
 * Enough evidence to say anything at all — AS A SHARE OF WHAT ONE PERFECT WORD IS WORTH, not an
 * absolute. A word used by exactly one project scores log(1 + projects), so a fixed bar would mean
 * "one distinctive word is enough" for somebody with nine projects and "never" for somebody with
 * three. The bar is that one word, very slightly discounted: a single word the person uses in one
 * project and nowhere else IS the signal here, and a single ordinary word cannot reach it because
 * lib/text-match.ts drops the words every to-do list shares.
 */
const MIN_SCORE_SHARE = 0.9;

/** The bar, for a person with this many projects. */
export function minScore(index: Index): number {
  return Math.log(1 + index.buckets) * MIN_SCORE_SHARE;
}

/**
 * How sure the strongest answer has to be before it is offered. Below this the honest answer is
 * the picker the person already has.
 */
export const MIN_CONFIDENCE = 0.45;

/** A thought and an open task this alike are the same thought written twice. */
const DUPLICATE_OVERLAP = 0.6;

export type Index = {
  /** bucketId → token → how many of that bucket's filed tasks use it. */
  byBucket: Map<string, Map<string, number>>;
  /** token → how many buckets use it at all. */
  spread: Map<string, number>;
  buckets: number;
};

/** The filing history, as the scorer reads it. Built per request; nothing is cached or stored. */
export function indexBuckets(filed: FiledUnder[]): Index {
  const byBucket = new Map<string, Map<string, number>>();
  for (const t of filed) {
    const counts = byBucket.get(t.bucketId) ?? new Map<string, number>();
    // Per TITLE, not per occurrence: a title that says "palette" twice is still one task that
    // mentions palettes, and the receipt under the proposal counts tasks.
    for (const tok of new Set(contentTokens(t.title))) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    byBucket.set(t.bucketId, counts);
  }
  const spread = new Map<string, number>();
  for (const counts of byBucket.values()) {
    for (const tok of counts.keys()) spread.set(tok, (spread.get(tok) ?? 0) + 1);
  }
  return { byBucket, spread, buckets: byBucket.size };
}

/** The project history, which is the one every caller had before labels existed. */
export function indexHistory(filed: FiledTask[]): Index {
  return indexBuckets(filed.map((t) => ({ title: t.title, bucketId: t.projectId })));
}

/**
 * How much a word narrows things down. A word used in every project says nothing about which one;
 * a word used in exactly one says a great deal. Inverse document frequency over the person's OWN
 * projects, which is why a studio that only ever works on coffee brands is not drowned by "coffee".
 */
function idf(index: Index, token: string): number {
  const df = index.spread.get(token) ?? 0;
  if (df === 0) return 0;
  return Math.log(1 + index.buckets / df);
}

type Scored = { bucketId: string; score: number; token: string; tasks: number };

/** Every pile this thought has anything in common with, strongest first. */
export function scoreBuckets(title: string, index: Index): Scored[] {
  const tokens = new Set(contentTokens(title));
  const out: Scored[] = [];
  for (const [bucketId, counts] of index.byBucket) {
    let score = 0;
    let best = { token: '', weight: 0, tasks: 0 };
    for (const tok of tokens) {
      const tasks = counts.get(tok);
      if (!tasks) continue;
      // A word carries more when several tasks in that project use it, but with diminishing
      // returns: the fifth mention of "palette" is not five times the evidence of the first.
      const weight = idf(index, tok) * (1 + Math.log(tasks));
      score += weight;
      if (weight > best.weight) best = { token: tok, weight, tasks };
    }
    if (score > 0) out.push({ bucketId, score, token: best.token, tasks: best.tasks });
  }
  return out.sort((a, b) => b.score - a.score || a.bucketId.localeCompare(b.bucketId));
}

/**
 * How sure the winner is: how much of the evidence points at it, discounted by whether there is
 * enough evidence to be pointing with. Both halves are needed — a lone weak match holds 100% of a
 * negligible total, and a strong match matters less when a second project matches nearly as well.
 */
export function confidenceOf(ranked: Scored[], bar: number): number {
  const best = ranked[0];
  if (!best || best.score < bar) return 0;
  const total = ranked.reduce((n, r) => n + r.score, 0);
  const share = best.score / total;
  const enough = best.score / (best.score + bar);
  return share * enough;
}

// ── THE PROPOSALS ───────────────────────────────────────────────────────────

const quote = (s: string) => `“${s}”`;

/**
 * The thought names a project or the client it is for. This beats the history score outright: a
 * person who writes "Meridian" has already told us where it goes, and no amount of word overlap
 * elsewhere is a better answer than what they said.
 *
 * The client's name is matched as a whole PHRASE and the project's the same way, because a client
 * called "Atlas Coffee" must not be found in "coffee with Dev" — the substring match that would
 * allow that is the single most damaging mistake this file could make.
 */
export function namedProject(title: string, projects: FileProject[]): ProjectProposal | undefined {
  for (const p of projects) {
    const name = p.name.trim();
    if (name.length >= 3 && saysPhrase(title, name)) {
      return { projectId: p.id, projectName: p.name, confidence: 0.95, evidence: `You wrote ${quote(name)}.`, source: 'name' };
    }
  }
  for (const p of projects) {
    const client = (p.client ?? '').trim();
    if (client.length >= 3 && saysPhrase(title, client)) {
      return {
        projectId: p.id, projectName: p.name, confidence: 0.9,
        evidence: `You wrote ${quote(client)}, and ${p.name} is their project.`, source: 'name',
      };
    }
  }
  // THERE IS NO SHORTCUT FOR HALF A NAME, and the test that proves why is the reason. A rule that
  // took the first word of a client's name as long as it was "long enough to be a name" filed
  // "Atlas of typefaces to buy" under Atlas Coffee and "Ring the Meridian bookshop" under Meridian
  // Coffee. Every name is an ordinary word to somebody. The case it was meant to catch — writing
  // "Meridian" for "Meridian Coffee" — is caught the moment the person has ever used that word in
  // that project, which is what the history scorer is, and until then the honest answer is silence.
  return undefined;
}

/** Where the person's own filing history says this belongs, or nothing. */
export function historyProject(title: string, index: Index, projects: FileProject[]): ProjectProposal | undefined {
  const ranked = scoreBuckets(title, index);
  const confidence = confidenceOf(ranked, minScore(index));
  if (confidence < MIN_CONFIDENCE) return undefined;
  const best = ranked[0];
  const project = projects.find((p) => p.id === best.bucketId);
  if (!project) return undefined;
  const n = best.tasks;
  return {
    projectId: project.id,
    projectName: project.name,
    confidence,
    // Both halves agree, because the sentence is read far more often than it is written:
    // "1 task in Packaging v2 mentions" / "2 tasks in Brand refresh mention".
    evidence: `${n} ${n === 1 ? 'task' : 'tasks'} in ${project.name} ${n === 1 ? 'mentions' : 'mention'} ${quote(best.token)}.`,
    source: 'history',
  };
}

/**
 * The words the parser consumed: what `full` has that `stripped` does not, in order. The grammar
 * only ever deletes a matched span (lib/task-parse.ts `take`), never reorders or rewrites, so a
 * walk down both word lists recovers the phrase exactly as the person typed it.
 */
export function consumedWords(full: string, stripped: string): string {
  // Words are matched WITHOUT their punctuation, because removing a phrase can move punctuation
  // onto its neighbour: taking "by Monday" out of "the quote by Monday, then call" leaves "the
  // quote, then call", and comparing "quote" with "quote," threw the walk out of step for the rest
  // of the sentence — which is how a two-word phrase came back as the whole second half of a title.
  const bare = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase();
  const kept = stripped.split(/\s+/).filter(Boolean).map(bare);
  const out: string[] = [];
  let j = 0;
  for (const w of full.split(/\s+/).filter(Boolean)) {
    if (j < kept.length && kept[j] === bare(w)) { j++; continue; }
    out.push(w);
  }
  return out.join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * A date the thought SAYS, never one it implies. The words come out of the person's own title
 * through the capture grammar (lib/task-parse.ts), so "send the quote by Thursday" proposes
 * Thursday and "send the quote" proposes nothing at all.
 *
 * THE RECEIPT QUOTES THE PERSON, NOT US. It would be easier to show the chip capture would have
 * drawn — "Due Thu 1 Oct" — but they did not write that, we did, and a receipt you cannot find in
 * your own sentence is not a receipt. So the title is parsed twice, once with the date kind
 * ignored, and the difference between the two is the phrase to quote.
 *
 * There is no guard against a date in the past, because the grammar cannot produce one: every
 * phrase it knows resolves to today or forward from today, and a weekday is strictly future. A
 * month-old thought that says "Friday" therefore proposes the coming Friday, which is the only
 * reading anyone can act on — and the receipt shows the word it came from.
 *
 * The title is left exactly as written when this is accepted. Capture strips the words it consumed
 * because the person is watching it happen; a thought that arrived through the MCP tool, an import
 * or an email was written somewhere else, and rewriting it days later would edit their words.
 */
export function saidDate(title: string, projects: FileProject[]): Pick<FileProposals, 'scheduled' | 'due'> {
  const refs = projects.map((p) => ({ id: p.id, name: p.name }));
  const full = parseTask(title, refs);
  const out: Pick<FileProposals, 'scheduled' | 'due'> = {};
  // The phrase, recovered by running that ONE rule and nothing else. Ignoring only the rule in
  // question does not work: with `due` switched off, "by Thursday" is read by the `when` rule
  // instead and the receipt came out as the single word "by".
  const wrote = (kind: 'when' | 'due') => {
    const solo = parseTask(title, refs, new Set(CHIP_KINDS.filter((k) => k !== kind)));
    // A rule reads a different date on its own when another rule had moved a phrase out of its way
    // ("send the quote by Monday, then call Friday"). A receipt for the wrong day is worse than no
    // suggestion, so the proposal goes rather than the receipt.
    const alone = kind === 'due' ? solo.dueDate : solo.scheduledDate;
    if (!alone || alone !== (kind === 'due' ? full.dueDate : full.scheduledDate)) return '';
    const said = consumedWords(title.trim(), solo.title).trim();
    return said ? `You wrote ${quote(said)}.` : '';
  };
  if (full.scheduledDate) {
    const evidence = wrote('when');
    if (evidence) out.scheduled = { date: full.scheduledDate, evidence };
  }
  if (full.dueDate) {
    const evidence = wrote('due');
    if (evidence) out.due = { date: full.dueDate, evidence };
  }
  return out;
}

/**
 * The label this thought would have got, read from the labels the person puts on tasks like it.
 *
 * SAME SCORER, SEPARATE ANSWER, AND DELIBERATELY NOT PART OF FILING. A project is where a thought
 * goes; a label is something it IS. Bundling them under one key would make one press agree to two
 * things the person was only shown one of, which is what "every suggestion is a one-tap accept"
 * (§7Q) rules out. So this is offered where labels are already chosen, marked, and never applied by
 * the filing key.
 *
 * A label index is thinner than a project one — a task carries a label for a reason its title
 * often does not say — so the bar is the same and the silence is expected to be longer.
 */
export function historyLabel(title: string, index: Index, labels: FileLabel[]): LabelProposal | undefined {
  const ranked = scoreBuckets(title, index);
  const confidence = confidenceOf(ranked, minScore(index));
  if (confidence < MIN_CONFIDENCE) return undefined;
  const best = ranked[0];
  const label = labels.find((l) => l.id === best.bucketId);
  if (!label) return undefined;
  const n = best.tasks;
  return {
    labelId: label.id,
    labelName: label.name,
    confidence,
    evidence: `${n} ${n === 1 ? 'task' : 'tasks'} labelled ${label.name} ${n === 1 ? 'mentions' : 'mention'} ${quote(best.token)}.`,
  };
}

/**
 * The same thought, already written down. Compared as sets of distinguishing words, so word order
 * and the glue between them do not matter ("send Meridian the palettes" ≡ "send the palettes to
 * Meridian") while a different subject always does.
 */
export function duplicateOf(title: string, open: { id: string; title: string }[]): DuplicateOf | undefined {
  const mine = new Set(contentTokens(title));
  if (mine.size === 0) {
    // Nothing distinguishing left — only an exact repeat is safe to call a duplicate.
    const flat = flatten(title);
    const same = flat ? open.find((t) => flatten(t.title) === flat) : undefined;
    return same ? { taskId: same.id, title: same.title } : undefined;
  }
  let best: { taskId: string; title: string; overlap: number } | undefined;
  for (const t of open) {
    const theirs = new Set(contentTokens(t.title));
    if (theirs.size === 0) continue;
    let shared = 0;
    for (const tok of mine) if (theirs.has(tok)) shared++;
    const overlap = shared / Math.max(mine.size, theirs.size);
    if (overlap >= DUPLICATE_OVERLAP && (!best || overlap > best.overlap)) {
      best = { taskId: t.id, title: t.title, overlap };
    }
  }
  return best ? { taskId: best.taskId, title: best.title } : undefined;
}

/**
 * Everything the rules can say about one thought.
 *
 * `open` is every other open task — the thought itself must not be in it, or it is its own
 * duplicate. The caller filters, because only the caller knows which rows it loaded.
 */
export function proposeFor(
  thought: Thought,
  projects: FileProject[],
  index: Index,
  open: { id: string; title: string }[],
  labels?: { index: Index; all: FileLabel[] },
): FileProposals {
  const project = namedProject(thought.title, projects) ?? historyProject(thought.title, index, projects);
  const duplicate = duplicateOf(thought.title, open.filter((t) => t.id !== thought.id));
  const label = labels && historyLabel(thought.title, labels.index, labels.all);
  return {
    thoughtId: thought.id,
    ...saidDate(thought.title, projects),
    ...(project && { project }),
    ...(label && { label }),
    ...(duplicate && { duplicate }),
  };
}

/** Does this proposal set say anything worth drawing? */
export function saysSomething(p: FileProposals): boolean {
  return Boolean(p.project || p.scheduled || p.due || p.label || p.duplicate);
}

/**
 * The whole Inbox, read at once. Thoughts the rules cannot place come back with no `project`, and
 * their ids are what lib/inbox-ai.ts asks a model about.
 */
export function proposeAll(
  thoughts: Thought[],
  projects: FileProject[],
  filed: FiledTask[],
  open: { id: string; title: string }[],
  labelled?: { filed: FiledUnder[]; all: FileLabel[] },
): FileProposals[] {
  const index = indexHistory(filed);
  const labels = labelled && labelled.all.length > 0
    ? { index: indexBuckets(labelled.filed), all: labelled.all }
    : undefined;
  return thoughts.map((t) => proposeFor(t, projects, index, open, labels));
}

/** The thoughts the rules left without a home — the only ones a model is ever asked about. */
export function unplaced(proposals: FileProposals[], thoughts: Thought[]): Thought[] {
  const placed = new Set(proposals.filter((p) => p.project).map((p) => p.thoughtId));
  return thoughts.filter((t) => !placed.has(t.id));
}

/** Why there is no answer. The same vocabulary the meeting clerk uses, for the same reasons. */
export type FileFailure = 'empty' | 'limit' | 'unavailable' | 'invalid';

/**
 * What the person is told when there is no answer.
 *
 * IT LIVES HERE, NOT IN THE ACTION, and that is not filing tidiness — it is the only place it can
 * live. A `'use server'` module may export **async functions and nothing else**: Next validates the
 * module's exports at module-evaluation time, so one `export const` object took down every route
 * that imported the file, with "A 'use server' file can only export async functions, found object."
 * The Tasks page went white on it. The same law is why a `'use server'` file cannot re-export
 * ([[zenboard-project-milestones]]) — a re-export is an export of whatever it found.
 *
 * Copy is not an action anyway: this is read by the client to render a failure, and the action
 * imports it like any other pure value.
 */
export const FILE_MESSAGES: Record<FileFailure | 'offline' | 'stale' | 'failed', string> = {
  empty: 'There is nothing in your inbox to file.',
  limit: 'You’ve used today’s AI suggestions. They reset tomorrow.',
  unavailable: 'Suggestions aren’t available right now. Try again in a minute.',
  invalid: 'The inbox couldn’t be read this time. Try again.',
  offline: 'Couldn’t reach Zenboard. Check your connection and try again.',
  stale: 'Zenboard has been updated. Reload the page to get suggestions.',
  failed: 'Something went wrong getting suggestions. Reload the page and try again.',
};
