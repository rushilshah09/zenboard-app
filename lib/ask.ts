// ── ASK — the natural-language command spine ────────────────────────────────
//
// USER BRIEF 2026-09-29: *"The existing Chat should become the natural-language command center for
// Zenboard … Do not make users navigate through multiple screens for simple actions that can be
// completed through Chat."*
//
// This file is the RULES. `lib/actions/ask.ts` is the only part that touches the database, and
// `components/ask/*` is the only part that draws anything. Everything below is pure, so each rule
// is asserted exactly — with no model, no network and no database in the test.
//
// ── THE THREE RULES, AND WHY EACH ONE EXISTS ────────────────────────────────
//
//  1. **A MODEL CHOOSES FROM A FIXED LIST. IT NEVER WRITES.** It picks one of the commands below
//     and fills in arguments; the executing code is the same server action the buttons already
//     call. There is no path from a model's words to a row. This is `lib/draft.ts` rule 1
//     generalised from prose to action: the model proposes, the product performs.
//
//  2. **A MODEL NEVER NAMES A RECORD.** It hands back the PHRASE the person used ("the buildojo
//     logo"), never an id, because an id is the one thing it cannot know and the one thing it will
//     happily invent. The server resolves the phrase against real rows, and an ambiguous match is
//     a QUESTION, never a guess — `resolveOne` below returns the candidates and the conversation
//     asks which. This is `draft.ts` rule 3 ("no fact that was not in the facts") applied to
//     records: no record the app does not have.
//
//  3. **A MODEL NEVER DOES DATE ARITHMETIC.** It hands back the person's own time words
//     ("friday", "tomorrow at 12"), and `resolveWhen` reads them with chrono-node against a known
//     instant in the person's own zone. Asking a model what date next Friday is buys a confident
//     wrong answer; asking it to repeat what it heard cannot fail. It is also why the whole date
//     path below is testable with no model in the room.
//
// ── WHAT DECIDES WHETHER SOMETHING RUNS OR IS OFFERED ───────────────────────
//
// Not "is it a write" — almost everything here is. The line is **whether the command touches a
// record that already exists**, because that is where this goes wrong. Creating a task from a
// misheard sentence costs one glance and an undo. *Completing the wrong task*, or moving the wrong
// meeting, is the model reaching into work the person already did — and the part it got wrong is
// WHICH ONE, which is exactly what a person can check at a glance if they are shown the title.
// So: creations run, and say what they did. Everything that names an existing record is offered
// with its real title, and waits for one click. `TOUCHES_EXISTING` below is that rule, and
// `lib/ask.test.ts` asserts no command escapes the classification.

import { z } from 'zod';

import { addDaysISO, formatRelativeDay, isoDateIn, todayISO } from '@/lib/date';

// ── The commands ────────────────────────────────────────────────────────────

/**
 * Every verb Ask can perform, and nothing else.
 *
 * **A module adds its verbs here, it does not grow a second assistant.** Mail's "draft a reply"
 * and Meetings' "create tasks from this meeting" are rows in this list when those modules land —
 * which is the whole reason this file exists before either of them. A feature that answers
 * questions through its own model call is a second product with its own failure modes, its own
 * allowance and its own idea of what a task is.
 */
export const ASK_COMMANDS = [
  'create_task',
  'complete_task',
  'reschedule_task',
  'schedule_event',
  'create_reminder',
  'create_project',
  'show_tasks',
  'show_agenda',
  'find',
  'ask_meeting',
  'none',
] as const;

export type AskCommandId = (typeof ASK_COMMANDS)[number];

/**
 * The commands that name a record the person already has. These are OFFERED, never run — see the
 * header. Stated as a set rather than a flag on each command so the classification is one thing to
 * read, and so the test can prove the two lists together cover every command exactly once.
 */
export const TOUCHES_EXISTING: ReadonlySet<AskCommandId> = new Set<AskCommandId>([
  'complete_task',
  'reschedule_task',
  'create_reminder',
]);

/** The commands that only READ. They run, and they answer; nothing is written and nothing is offered. */
export const READ_ONLY: ReadonlySet<AskCommandId> = new Set<AskCommandId>([
  'show_tasks',
  'show_agenda',
  'find',
  'ask_meeting',
  'none',
]);

// ── What the model is allowed to say ────────────────────────────────────────

/**
 * The shape the gateway validates.
 *
 * **Every field is optional here and required later, on purpose.** A discriminated union would be
 * the tighter schema, but the gateway treats a schema miss as a FAILED ATTEMPT and moves to the
 * next provider (lib/ai/gateway.ts step 3), so a model that emits one stray `null` costs the chain
 * instead of costing itself. This schema checks the SHAPE; `readCommand` below checks the MEANING
 * and can say what was missing in a sentence the person reads. Two layers, both tested.
 */
export const askSchema = z.object({
  command: z.enum(ASK_COMMANDS),
  /** A new thing's name — a task title, an event title, a project name. */
  title: z.string().nullish(),
  /** The phrase naming a task that already exists. Never an id (rule 2). */
  task: z.string().nullish(),
  /** The person's own time words. Never a date the model computed (rule 3). */
  when: z.string().nullish(),
  /** The phrase naming a project, resolved server-side like `task`. */
  project: z.string().nullish(),
  /** The phrase naming a client, resolved server-side like `task`. */
  client: z.string().nullish(),
  priority: z.enum(['low', 'med', 'high']).nullish(),
  estimateMinutes: z.number().int().positive().max(24 * 60).nullish(),
  durationMinutes: z.number().int().positive().max(24 * 60).nullish(),
  /** What to search for, for `find`. */
  query: z.string().nullish(),
  /** For `ask_meeting`: the person's question, in their own words. */
  question: z.string().nullish(),
  /** For `ask_meeting`: the phrase naming the meeting, resolved server-side like `task`. "this" = the open one. */
  meeting: z.string().nullish(),
  /** For `none` only: what to say back. */
  reply: z.string().nullish(),
});

export type AskRaw = z.infer<typeof askSchema>;

/** The maximum a command answer can need. Small: this returns arguments, never prose. */
export const ASK_MAX_TOKENS = 300;

/** Longest thing a person may ask in one go. Past this it is a document, not a command. */
export const ASK_INPUT_MAX = 2000;

// ── The narrowed command ────────────────────────────────────────────────────

export type AskCommand =
  | { command: 'create_task'; title: string; when: string | null; project: string | null; priority: 'low' | 'med' | 'high' | null; estimateMinutes: number | null }
  | { command: 'complete_task'; task: string }
  | { command: 'reschedule_task'; task: string; when: string }
  | { command: 'schedule_event'; title: string; when: string; durationMinutes: number | null; client: string | null }
  | { command: 'create_reminder'; task: string; when: string }
  | { command: 'create_project'; title: string; client: string | null }
  | { command: 'show_tasks'; when: string | null }
  | { command: 'show_agenda'; when: string | null }
  | { command: 'find'; query: string }
  | { command: 'ask_meeting'; question: string; meeting: string | null }
  | { command: 'none'; reply: string };

/** Why a well-formed answer still could not be performed. The person reads these, so they are sentences. */
export type AskProblem = { problem: string };

export type AskReading = AskCommand | AskProblem;

export const isProblem = (r: AskReading): r is AskProblem => 'problem' in r;

const text = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/**
 * Turn what the model said into a command that can actually be performed, or say what was missing.
 *
 * The missing-field messages are written as the thing to ask NEXT ("Which task?"), not as an error,
 * because that is what the conversation does with them — a command missing its subject is a
 * half-heard sentence, and the repair is one more word from the person, not a failure.
 */
export function readCommand(raw: AskRaw): AskReading {
  const title = text(raw.title);
  const task = text(raw.task);
  const when = text(raw.when);
  const project = text(raw.project);
  const client = text(raw.client);

  switch (raw.command) {
    case 'create_task':
      if (!title) return { problem: 'What should the task be called?' };
      return { command: 'create_task', title, when, project, priority: raw.priority ?? null, estimateMinutes: raw.estimateMinutes ?? null };

    case 'complete_task':
      if (!task) return { problem: 'Which task should I tick off?' };
      return { command: 'complete_task', task };

    case 'reschedule_task':
      if (!task) return { problem: 'Which task should I move?' };
      if (!when) return { problem: 'When should I move it to?' };
      return { command: 'reschedule_task', task, when };

    case 'schedule_event':
      if (!title) return { problem: 'What should I call it?' };
      if (!when) return { problem: 'When is it?' };
      return { command: 'schedule_event', title, when, durationMinutes: raw.durationMinutes ?? null, client };

    case 'create_reminder':
      if (!task) return { problem: 'Which task should I remind you about?' };
      if (!when) return { problem: 'When should I remind you?' };
      return { command: 'create_reminder', task, when };

    case 'create_project':
      if (!title) return { problem: 'What should the project be called?' };
      return { command: 'create_project', title, client };

    case 'show_tasks':
      return { command: 'show_tasks', when };

    case 'show_agenda':
      return { command: 'show_agenda', when };

    case 'find': {
      const query = text(raw.query) ?? title ?? task;
      if (!query) return { problem: 'What should I look for?' };
      return { command: 'find', query };
    }

    case 'ask_meeting': {
      // The question is the person's own sentence; a model that dropped it can fall back to what it
      // put in `query`, but never to nothing — a meeting cannot be asked an empty question.
      const question = text(raw.question) ?? text(raw.query);
      if (!question) return { problem: 'What would you like to know about the meeting?' };
      return { command: 'ask_meeting', question, meeting: text(raw.meeting) };
    }

    case 'none':
      return { command: 'none', reply: text(raw.reply) ?? NO_COMMAND };
  }
}

/** What Ask says when it understood the words and none of its verbs fit. Stated once, so it reads the same everywhere. */
export const NO_COMMAND = 'I can add and move tasks, put things on your calendar, set reminders, start projects, find what you already have, and answer questions about your meetings. That one I cannot do yet.';

// ── Time ────────────────────────────────────────────────────────────────────

/**
 * A resolved time.
 *
 * **Whether the person said a CLOCK time is what decides which of these it is**, and that is not a
 * detail — it is the difference between an all-day event and a 12:00 one, and between "move it to
 * Friday" (a day on the plan) and "remind me Friday at 9" (an instant). chrono reports exactly
 * this as `isCertain('hour')`, so the product reads the distinction the person actually made
 * instead of imposing a default hour on them.
 */
export type When =
  /** A day on the plan. `day` is a day id in the person's zone (never `toISOString().slice(0,10)`). */
  | { kind: 'day'; day: string }
  /** A moment. `at` is a full ISO instant; `day` is the day it falls on in the person's zone. */
  | { kind: 'instant'; at: string; day: string };

/** Just enough of chrono-node to read a phrase, so this file stays testable with a fake. */
export type ChronoLike = {
  parse: (
    text: string,
    ref?: { instant?: Date; timezone?: string | number },
    option?: { forwardDate?: boolean },
  ) => { start: { date: () => Date; isCertain: (unit: 'hour') => boolean } }[];
};

/**
 * Read the person's time words against a known instant in their own zone.
 *
 * `forwardDate` is on because every one of these commands is about work: "friday" said on a
 * Saturday means the Friday coming, not the one that just went. chrono without it resolves to the
 * nearest Friday in either direction, which on a Saturday is yesterday — a task quietly moved into
 * the past, which is the worst possible answer because it looks like it worked.
 */
export function resolveWhen(chrono: ChronoLike, phrase: string, now: Date, tz: string): When | null {
  const trimmed = phrase.trim();
  if (!trimmed) return null;

  let results: ReturnType<ChronoLike['parse']>;
  try {
    results = chrono.parse(trimmed, { instant: now, timezone: tz }, { forwardDate: true });
  } catch {
    return null;
  }
  const first = results[0];
  if (!first) return null;

  const date = first.start.date();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const day = isoDateIn(date, tz);
  if (!day) return null;

  return first.start.isCertain('hour') ? { kind: 'instant', at: date.toISOString(), day } : { kind: 'day', day };
}

/**
 * The day a "show me…" command means when the person named no day at all.
 *
 * Today, and deliberately not "whatever you are looking at": someone who asks *"show me today's
 * tasks"* while standing on next Tuesday's board means today. The page context steers which RECORD
 * "this" is (see `askInput`); it does not steer which day "my tasks" means.
 */
export const defaultDay = (tz: string): string => todayISO(tz);

// ── Resolving a phrase to a record ──────────────────────────────────────────

/** A candidate row, as the resolver sees it. Deliberately minimal — this file never queries. */
export type Candidate = { id: string; label: string; hint?: string | null };

export type Resolution =
  /** Exactly one record is a good enough match to act on. */
  | { kind: 'one'; match: Candidate }
  /** Several are plausible. The conversation ASKS; it does not pick (rule 2). */
  | { kind: 'many'; options: Candidate[] }
  /** Nothing matched. */
  | { kind: 'none' };

/** How many options are worth showing before the list stops being a question and becomes a search. */
export const MAX_OPTIONS = 5;

/**
 * Score a candidate against the phrase the person used, 0–1.
 *
 * Plain and explainable on purpose. A fuzzy library would score `"the logo"` against `"Blog audit"`
 * on shared letters, and the failure mode of this whole feature is a confident wrong record — so
 * the scoring only rewards things a person would call a match: the same string, one containing the
 * other, or the phrase's real words appearing in the label.
 */
export function score(phrase: string, label: string): number {
  const p = norm(phrase);
  const l = norm(label);
  if (!p || !l) return 0;
  if (p === l) return 1;
  if (l.includes(p)) return 0.9;
  if (p.includes(l)) return 0.8;

  const wanted = words(p);
  if (wanted.length === 0) return 0;
  const have = new Set(words(l));
  const covered = wanted.filter((w) => have.has(w)).length / wanted.length;

  // Every word the person said landed: this is the thing, and it can be acted on.
  if (covered === 1) return CONFIDENT;
  // MOST of what they said landed ("finish the buildojo logo" against "Buildojo logo v2"): worth
  // asking about, never worth doing — the band below deliberately cannot reach CONFIDENT.
  // Anything less is a WORD IN COMMON, not a match: "the buildojo logo" shares "logo" with "Logo
  // feedback call" and must come back as nothing, or the person is asked to choose from junk and
  // the honest "I could not find that" answer never happens.
  return covered >= PARTIAL_FLOOR ? covered * 0.5 : 0;
}

/** Below this, a match is not a match. Above it and alone, it is the answer. */
export const CONFIDENT = 0.7;

/** How much of what the person said must land before a partial match is even worth asking about. */
export const PARTIAL_FLOOR = 0.6;

/**
 * Words that carry no identity. Dropped before scoring so *"the buildojo logo"* and *"Buildojo
 * logo"* are the same question, and so `"the call"` cannot match a record purely on "the".
 */
const NOISE = new Set(['the', 'a', 'an', 'my', 'our', 'this', 'that', 'for', 'to', 'of', 'on', 'in', 'about', 'with', 'please', 'task', 'item']);

const norm = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const words = (normalized: string): string[] => normalized.split(' ').filter((w) => w && !NOISE.has(w));

/**
 * The words in a phrase that are worth narrowing a query by.
 *
 * **These go into a database filter, so what they cannot contain is the point.** `norm` above
 * strips everything outside `[a-z0-9\s]`, which means a term can never carry the comma, parenthesis
 * or dot that PostgREST's `or(…)` grammar is made of — a phrase cannot become a filter. That is
 * why the caller may interpolate these directly, and why this is the only function allowed to
 * produce them.
 */
export function phraseWords(phrase: string, max = 4): string[] {
  return words(norm(phrase)).slice(0, max);
}

/**
 * Pick the record the person meant, or ask.
 *
 * **A clear winner is one that is confident AND alone at the top.** Two records scoring 0.9 are
 * not a 50/50 call to make silently — with "Logo v2" and "Logo v3" both open, guessing is wrong
 * half the time and the person finds out later. So near-ties go back as a question, which costs
 * one click and cannot be wrong.
 */
export function resolveOne(phrase: string, candidates: Candidate[]): Resolution {
  const scored = candidates
    .map((c) => ({ c, s: score(phrase, c.label) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) return { kind: 'none' };

  const [best, next] = scored;
  const clear = best.s >= CONFIDENT && (!next || next.s < best.s);
  if (clear) return { kind: 'one', match: best.c };

  const plausible = scored.filter((x) => x.s >= best.s * 0.6).slice(0, MAX_OPTIONS);
  return plausible.length === 1 && best.s >= CONFIDENT
    ? { kind: 'one', match: best.c }
    : { kind: 'many', options: plausible.map((x) => x.c) };
}

// ── Resolving a phrase to a MEETING ─────────────────────────────────────────

/** A meeting as the resolver sees it: what it was called, who it was with, when. */
export type MeetingRow = { id: string; title: string; metAt: string; client: string | null };

/** A meeting as a person names it — its title and who it was with — and when it was, to tell two apart. */
export const meetingCandidate = (m: MeetingRow, tz?: string): Candidate => ({
  id: m.id,
  label: [m.title?.trim() || 'Meeting', m.client?.trim()].filter(Boolean).join(' · '),
  hint: formatRelativeDay(m.metAt, { now: tz ? todayISO(tz) : undefined }) ?? null,
});

/**
 * Words that NAME a meeting rather than say it is one. "Meeting", "call" and "sync" are what it
 * is, not which one — and left in, "the Ridgeline call" scores half its words against "Kickoff ·
 * Ridgeline" and falls under `PARTIAL_FLOOR`, so the plainest phrasing found nothing.
 */
const MEETING_NOUNS = new Set(['meeting', 'meetings', 'call', 'calls', 'one', 'sync', 'chat', 'session']);
const namingWords = (phrase: string): string => phraseWords(phrase, 6).filter((w) => !MEETING_NOUNS.has(w)).join(' ');

/** "my last meeting", "the latest Ridgeline call". */
const LATEST = /\b(?:last|latest|most recent|previous)\b/i;
/** The two day words worth reading without a parser: a meeting asked about is in the past, so they need no direction. */
const DAY_WORD = /\b(today|yesterday)(?:[’']s)?\b/i;

/**
 * Which meeting the person means, by the same rule as every other record (rule 2): one clear
 * match, or a question back — never a guess, because an answer read from the WRONG meeting is a
 * confident wrong answer about a client.
 *
 * `rows` are newest first. Three shapes of phrase, in order:
 *   · a DAY — "yesterday's call": the meetings on that day in the person's own zone, narrowed by
 *     whatever else the phrase names;
 *   · LATEST — "my last meeting", "the last Ridgeline call": the most recent that has HAPPENED
 *     (a meeting scheduled for next week is nobody's "last meeting"), among the ones named;
 *   · anything else — scored like a task or a project (`resolveOne`), on the words that name it.
 */
export function resolveMeetingPhrase(phrase: string, rows: readonly MeetingRow[], now: Date, tz: string): Resolution {
  const named = (list: readonly MeetingRow[], words: string) =>
    (words ? list.filter((m) => score(words, meetingCandidate(m).label) > 0) : [...list]);

  const day = DAY_WORD.exec(phrase)?.[1]?.toLowerCase();
  if (day) {
    // FROM `now`, NOT FROM THE CLOCK. This read `todayISO(tz)`, which asks the machine what day it
    // is and ignores the `now` this function was handed — while the `LATEST` branch below uses
    // `now` correctly, so one function had two ideas of the present. In production the two agree
    // (the action passes `new Date()`), which is why it survived; anything that passes a different
    // `now` — a fixture, a replay, a request that began before midnight — silently got the wrong
    // day. It stayed invisible until the real date rolled past the test's pinned Tue 29 Sep and
    // "today’s meeting" started resolving to nothing.
    // A parameter that some branches honour and others quietly ignore is worse than no parameter.
    const today = isoDateIn(now, tz) ?? todayISO(tz);
    const id = day === 'today' ? today : addDaysISO(today, -1);
    const found = named(rows.filter((m) => isoDateIn(m.metAt, tz) === id), namingWords(phrase.replace(DAY_WORD, ' ')));
    if (found.length === 1) return { kind: 'one', match: meetingCandidate(found[0], tz) };
    return found.length ? { kind: 'many', options: found.slice(0, MAX_OPTIONS).map((m) => meetingCandidate(m, tz)) } : { kind: 'none' };
  }

  if (LATEST.test(phrase)) {
    const past = rows.filter((m) => Date.parse(m.metAt) <= now.getTime());
    const found = named(past, namingWords(phrase.replace(LATEST, ' ')));
    return found.length ? { kind: 'one', match: meetingCandidate(found[0], tz) } : { kind: 'none' };
  }

  const words = namingWords(phrase);
  const resolved = resolveOne(words || phrase, rows.map((m) => meetingCandidate(m, tz)));
  return resolved;
}

// ── What the model is told ──────────────────────────────────────────────────

/**
 * The system prompt. FIXED per feature and never the person's words — the gateway's contract.
 *
 * It is written as a list of refusals as much as instructions, because the failure modes here are
 * all the model being helpful: computing a date, inventing an id, answering a question it was not
 * asked, or reaching for a verb that does not exist rather than saying so.
 */
export const askSystem = [
  'You turn one sentence from a person into ONE command for their workspace app, as JSON.',
  '',
  'Reply with a JSON object with a "command" field, one of:',
  '- create_task: a new task. Fields: title (required), when, project, priority (low|med|high), estimateMinutes.',
  '- complete_task: tick off a task that exists. Fields: task (required).',
  '- reschedule_task: move an existing task to another day. Fields: task (required), when (required).',
  '- schedule_event: put something on the calendar. Fields: title (required), when (required), durationMinutes, client.',
  '- create_reminder: be reminded about an existing task. Fields: task (required), when (required).',
  '- create_project: a new project. Fields: title (required), client.',
  '- show_tasks: show tasks for a day. Fields: when.',
  '- show_agenda: show the calendar for a day. Fields: when.',
  '- find: look up something the person already HAS in this app: tasks, projects, clients, documents, invoices, forms, content, meetings. Fields: query (required).',
  '- ask_meeting: a question about what was said, decided or promised in a meeting ("what did Alex say about the budget?", "what did I promise?", "summarise the last call"). Fields: question (required: their question, in their own words), meeting (the words they used for the meeting; "this" if they mean the one they have open; leave it out if they did not name one).',
  '- none: nothing above fits. Fields: reply (one short sentence saying so).',
  '',
  'RULES, all of which matter more than being helpful:',
  '1. NEVER calculate a date. Copy the person\'s own time words into "when" exactly as they said them ("friday", "tomorrow at 12", "next week"). Never output a calendar date unless they said one.',
  '2. NEVER invent an id. "task", "project" and "client" hold the words the person used to refer to the thing. Copy those words; do not describe or expand them.',
  '3. "title" is for something NEW. "task" is for something that already exists. Never put the same thing in both.',
  '4. If the sentence asks for something none of the commands do, use "none", and say in one sentence what you cannot do. Do not bend it into the nearest command.',
  '5. This app does NOT hold email, chat messages, files on their computer, or the web. Anything about those is "none", never "find". Searching this app for an email and reporting nothing tells them their inbox is empty, which you do not know.',
  '6. One command only, for the main thing they asked. Never explain, never add prose outside the JSON.',
  '7. "find" locates a record; "ask_meeting" answers from what was SAID in a meeting. A question about what someone said, agreed, decided or promised is ask_meeting, never find.',
].join('\n');

/** The page the person is looking at, so "this" means something. */
export type AskContext = {
  /** What kind of record is open, if any — 'task', 'project', 'client', 'meeting'… */
  type: string;
  /** Its title, as shown. */
  label: string;
};

/**
 * Wrap the person's words with the little the model needs to read them.
 *
 * **The context is given as the ANSWER to "this", not as a fact to use.** Saying "the open record
 * is X" invites a model to make every command about X; saying what the word "this" refers to is
 * the narrow thing actually needed for *"move this task to Friday"*. Today is given for the same
 * reason — so the model can tell a weekday that has passed from one that has not, WITHOUT
 * computing anything, which rule 1 forbids.
 */
export function askInput(message: string, opts: { today: string; weekday: string; context?: AskContext | null }): string {
  const lines = [`Today is ${opts.weekday}, ${opts.today}.`];
  if (opts.context) lines.push(`If they say "this", they mean the ${opts.context.type} they have open, called "${opts.context.label}".`);
  lines.push('', 'They said:', message.slice(0, ASK_INPUT_MAX));
  return lines.join('\n');
}

// ── Saying what happened ────────────────────────────────────────────────────

/**
 * What a command will do, in words, before it does it — the sentence on the offer.
 *
 * It names the RESOLVED record, not the phrase the person typed, because the whole point of the
 * offer is to show which record was picked. "Tick off the logo one" confirms nothing; "Tick off
 * **Buildojo logo v2**" is a thing a person can be wrong about at a glance.
 */
export function describe(command: AskCommand, resolved: { label?: string | null; when?: string | null } = {}): string {
  const subject = resolved.label ?? ('task' in command ? command.task : 'title' in command ? command.title : '');
  const at = resolved.when ? ` to ${resolved.when}` : '';

  switch (command.command) {
    case 'complete_task': return `Tick off ${subject}`;
    case 'reschedule_task': return `Move ${subject}${at || ' '}`.trimEnd();
    case 'create_reminder': return `Remind you about ${subject}${resolved.when ? ` on ${resolved.when}` : ''}`;
    case 'create_task': return `Add ${subject}`;
    case 'schedule_event': return `Schedule ${subject}`;
    case 'create_project': return `Start ${subject}`;
    case 'show_tasks': return 'Show tasks';
    case 'show_agenda': return 'Show the calendar';
    case 'find': return `Find ${command.query}`;
    case 'ask_meeting': return command.question;
    case 'none': return command.reply;
  }
}

/** The examples when a meeting is open: what people ask a meeting (MEETINGS_PLAN M3, the user's brief). */
export const ASK_MEETING_EXAMPLES = [
  'What did we decide?',
  'What did I promise to do?',
  'What did they say about the budget?',
  'What is still open?',
] as const;

/** Which examples to offer: a meeting's own questions when one is open, the general ones otherwise. */
export const askExamples = (openType?: string | null): readonly string[] =>
  openType === 'meeting' ? ASK_MEETING_EXAMPLES : ASK_EXAMPLES;

/** The examples under an empty conversation. Real sentences, in the app's own vocabulary, sentence case. */
export const ASK_EXAMPLES = [
  'Add a task to finish the Buildojo logo on Friday',
  'What am I doing today?',
  'Schedule a call with Alex tomorrow at 12',
  'Remind me about the invoice on Monday',
] as const;
