'use server';
// ── ASK, ASSEMBLED ──────────────────────────────────────────────────────────
//
// `lib/ask.ts` holds the rules — the commands, what the model is told, how a phrase becomes a
// record, how time words become a day. This file is the only part that touches the database, and
// it does it through THE SAME SERVER ACTIONS THE BUTTONS CALL. `addTask` here is the `addTask`
// Home's composer calls; `rescheduleTask` is the one the drag handler calls. That is not tidiness:
// every rule those actions enforce — the space, the recurrence, the Google push, the RLS scope —
// is enforced for a sentence typed in Ask too, because there is no second path to enforce it on.
//
// ── WHY A CONFIRMED PROPOSAL IS STILL SAFE ──────────────────────────────────
// `runProposal` takes an object that has been to the browser and back, so it must be assumed
// forged. It is safe for a reason worth stating rather than trusting: every write below goes
// through an action that opens an RLS-scoped client for the CALLER, and every one of them filters
// `.eq('id', …)` on top of that. A tampered id therefore selects zero rows — it cannot reach
// another account's work, only fail. The proposal is re-read before it is performed anyway, so the
// sentence in the transcript afterwards names the row that was actually touched.
//
// ── ON DEMAND, NEVER ON LOAD ────────────────────────────────────────────────
// Same rule as `lib/actions/inbox-file.ts`: nothing here runs because a page rendered. A model's
// latency belongs behind a key the person pressed.

import { notReady } from '@/lib/not-ready';
import { generateJSON } from '@/lib/ai/gateway';
import {
  ASK_INPUT_MAX, ASK_MAX_TOKENS, MAX_OPTIONS, NO_COMMAND,
  askInput, askSchema, askSystem, describe, isProblem, meetingCandidate, phraseWords, readCommand, resolveMeetingPhrase, resolveOne, resolveWhen,
  type AskCommand, type AskContext, type Candidate, type MeetingRow, type When,
} from '@/lib/ask';
import { requireSession } from '@/lib/auth';
import { dayWindow, formatClock, formatRelativeDay, formatWeekday, isoDateIn, todayISO } from '@/lib/date';
import { recordHref, type EntityType } from '@/lib/connected';
import { searchRecords, type RecordHit } from '@/lib/search';
import { loadNaturalDate } from '@/lib/natural-date';
import { userTimezone } from '@/lib/user-tz';
import { addEvent } from '@/lib/actions/events';
import { addProject } from '@/lib/actions/projects';
import { remindersSupported, setReminder } from '@/lib/actions/reminders';
import { addTask, rescheduleTask, toggleTask } from '@/lib/actions/tasks';
import { answerFromMeeting } from '@/lib/meeting-answer';
import { answerText, quoteHref, quoteSource } from '@/lib/meeting-ask';
import type { RowTask } from '@/components/tasks/task-row';

type DB = Awaited<ReturnType<typeof requireSession>>['supabase'];

/** Rows pulled as candidates for one phrase. Enough to choose well, small enough to score in memory. */
const CANDIDATES = 40;
/** Rows a "show me" answer prints. Past this it is a page, and the answer links to one. */
const SHOW_LIMIT = 25;
/** How long an event lasts when the person did not say. The calendar's own default meeting. */
const DEFAULT_EVENT_MINUTES = 30;

// ── What comes back ─────────────────────────────────────────────────────────

/** A record the answer can point at. `href` is `recordHref` — the one address in the product. */
export type AskRecord = { type: EntityType; id: string; label: string; href?: string };

/** A task in an answer, in THE shape `<TaskRow>` takes — the chat draws the same row as every other list. */
export type AskTask = RowTask & { project?: { name: string; color: string | null } | null };

export type AskEvent = { id: string; title: string; startsAt: string; endsAt: string | null; allDay: boolean; clock?: string };

/** A line an answer rests on: the words, who said them and when, and the meeting opened at that moment. */
export type AskQuote = { text: string; source: string; href: string };

/**
 * A performed-but-not-yet-done act, waiting for one click.
 *
 * Only the three commands in `TOUCHES_EXISTING` produce one, and each carries the resolved id plus
 * the label it was resolved to, so the offer can show WHICH record — which is the half of the
 * mistake a person can catch at a glance.
 */
export type Proposal =
  | { do: 'complete_task'; id: string; label: string }
  | { do: 'reschedule_task'; id: string; label: string; day: string; dayLabel: string }
  | { do: 'create_reminder'; id: string; label: string; at: string; atLabel: string };

export type AskAnswer =
  /** Nothing was done; these are words. */
  | { kind: 'said'; text: string }
  /** Something was done. `record` is what it made, if it made one. */
  | { kind: 'did'; text: string; record?: AskRecord }
  /** Something is offered, and waits. */
  | { kind: 'offer'; text: string; proposal: Proposal }
  /**
   * Several records fit the phrase. The person picks; Ask does not (lib/ask.ts rule 2). `then` is
   * what picking does: one of the offers, or asking the chosen meeting `question`.
   */
  | { kind: 'choose'; text: string; options: Candidate[]; then: Proposal['do'] | 'ask_meeting'; when?: When | null; question?: string }
  | { kind: 'tasks'; text: string; day: string; tasks: AskTask[] }
  | { kind: 'agenda'; text: string; day: string; events: AskEvent[] }
  | { kind: 'found'; text: string; hits: AskRecord[] }
  /**
   * An answer read from a meeting (MEETINGS_PLAN M3), with the lines it rests on — each opens the
   * meeting at its moment. `partial`: a long meeting, of which only the relevant parts were read.
   */
  | { kind: 'quoted'; text: string; quotes: AskQuote[]; record: AskRecord; partial: boolean }
  /** It could not be done, and the sentence says why. */
  | { kind: 'error'; text: string };

/**
 * ONE STEP OF THE REASONING, in words the person can check against their own data.
 *
 * USER DIRECTION 2026-09-29: "Chain Of Thought preview", pointing at Claude's thinking block. What
 * this product can honestly show is NOT a token stream — `lib/ask.ts` is a command spine, and the
 * model's whole output is one validated `AskCommand`. It never writes, never names a record and
 * never computes a date; the app does all three. So the model's "thoughts" would be a single JSON
 * object, and showing it would be theatre.
 *
 * What IS worth showing is the part a person can be wrong about: which command the sentence was
 * read as, which words were taken as the subject, and what a time phrase resolved to. Those are
 * the three places Ask can misread you, and each one is checkable at a glance — the same standard
 * the inbox clerk already holds ("3 tasks in Meridian Coffee mention 'palette'", never
 * "92% confident"). A trace nobody can verify is worse than no trace.
 */
export type AskStep = { label: string; detail: string };

/**
 * The receipts for one answer. Built at the ONE place that has both the command and the context,
 * rather than threaded through eleven `perform` helpers — each of which would then have to
 * remember to carry it, and one that forgot would silently show a shorter reasoning than it used.
 */
async function traceFor(command: AskCommand, ctx: Ctx): Promise<AskStep[]> {
  const steps: AskStep[] = [{ label: 'Read it as', detail: describe(command) }];

  // The words taken as the subject — what a person checks first when Ask picks the wrong thing.
  const subject = 'task' in command ? command.task
    : 'title' in command ? command.title
    : 'query' in command ? command.query
    : null;
  if (subject) steps.push({ label: 'Took the subject to be', detail: subject });

  // A time phrase and what it became. This is the step that earns the whole disclosure: "Friday"
  // is a different day depending on which Friday, and the app resolved it, not the model.
  const phrase = 'when' in command ? command.when : null;
  if (phrase) {
    const when = await whenOf(phrase, ctx);
    steps.push({
      label: `Read “${phrase}” as`,
      // Discriminate on `kind`, which is the WHOLE point of that union: whether the person said a
      // clock time is the difference between an all-day event and a 12:00 one, and the trace has
      // to show back the distinction they actually made rather than flattening it to a date.
      detail: when
        ? (when.kind === 'instant' ? instantLabel(when.at, ctx) : dayLabel(when.day, ctx))
        : 'not a time I could read',
    });
  }

  if ('project' in command && command.project) steps.push({ label: 'Filed under', detail: command.project });
  if ('client' in command && command.client) steps.push({ label: 'For the client', detail: command.client });
  return steps;
}

const said = (text: string): AskAnswer => ({ kind: 'said', text });
const oops = (text: string): AskAnswer => ({ kind: 'error', text });

/** What each gateway failure means to the person who just typed. Never a code, never "something went wrong". */
const FAILURE = {
  limit: 'That is all the AI for today. Everything else in Zenboard still works, and this resets tomorrow.',
  unavailable: 'I could not reach a model just now. Try again in a moment.',
  invalid: 'I could not make sense of that. Try saying it a different way.',
} as const;

// ── Reading the sentence ────────────────────────────────────────────────────

/**
 * What the browser says is open, as an address — the same `{type, id}` every other part of this
 * product addresses a record with (`lib/connected.ts`).
 */
export type AskRef = { type: EntityType; id: string };

/**
 * Turn one message into an answer.
 *
 * `ref` is the record the person has open, so "this" means something. **Only its ADDRESS crosses
 * from the browser; the title is read here**, through the caller's own RLS-scoped client. A
 * tampered ref therefore reads nothing, and a label cannot be put in the prompt by anyone but the
 * database — which matters because that label is the one piece of page content the model sees.
 */
export async function ask(message: string, ref?: AskRef | null): Promise<AskAnswer & { trace?: AskStep[] }> {
  const text = message.trim();
  if (!text) return said('Say what you need.');
  if (text.length > ASK_INPUT_MAX) return oops(`That is longer than I can read in one go: ${ASK_INPUT_MAX.toLocaleString()} characters at a time.`);

  const { supabase, user } = await requireSession();
  const tz = await userTimezone();
  const now = new Date();
  const today = todayISO(tz);

  const context = ref ? await contextFor(supabase, ref) : null;

  const answer = await generateJSON({
    feature: 'ask',
    system: askSystem,
    // The weekday of the person's OWN today — derived from the day id, never from the server's
    // clock, which on Cloudflare is UTC and is a day behind for anyone east of it after midnight.
    input: askInput(text, { today, weekday: formatWeekday(today) ?? '', context }),
    schema: askSchema,
    maxTokens: ASK_MAX_TOKENS,
    userId: user.id,
    timeZone: tz,
  });
  if (!answer.ok) return oops(FAILURE[answer.reason]);

  const command = readCommand(answer.data);
  // A half-heard sentence is a question back, not an error: the repair is one more word.
  if (isProblem(command)) return said(command.problem);

  const ctx: Ctx = { tz, now, ref: ref ?? null };
  const done = await perform(supabase, user.id, command, ctx);
  // The reasoning rides ALONGSIDE the answer rather than inside its union: every `kind` can carry
  // it, and no branch of `perform` has to be edited to gain one.
  return { ...done, trace: await traceFor(command, ctx) };
}

/** `ref` is what the person has open, so "this meeting" can be answered without asking which. */
type Ctx = { tz: string; now: Date; ref?: AskRef | null };

async function perform(db: DB, userId: string, command: AskCommand, ctx: Ctx): Promise<AskAnswer> {
  switch (command.command) {
    case 'none': return said(command.reply || NO_COMMAND);
    case 'create_task': return createTask(db, command, ctx);
    case 'schedule_event': return scheduleEvent(command, ctx);
    case 'create_project': return createProject(db, command);
    case 'complete_task': return offerOnTask(db, command.task, 'complete_task', null, ctx);
    case 'reschedule_task': return offerOnTask(db, command.task, 'reschedule_task', command.when, ctx);
    case 'create_reminder': return offerOnTask(db, command.task, 'create_reminder', command.when, ctx);
    case 'show_tasks': return showTasks(db, command.when, ctx);
    case 'show_agenda': return showAgenda(db, command.when, ctx);
    case 'find': return find(db, command.query);
    case 'ask_meeting': return askMeeting(db, userId, command, ctx);
  }
}

// ── Time, in words a person recognises ──────────────────────────────────────

/**
 * The person's time words, read.
 *
 * chrono-node arrives through `lib/natural-date.ts`, which is THE importer of it and loads it
 * dynamically — guarded by `lib/natural-date.test.ts`, because a static import puts ~78 KB on
 * every screen that can show a date field and nothing fails when it happens. A second importer
 * here would be a second answer to "how does this app read a typed date", which is the thing that
 * seam exists to prevent.
 *
 * A parser that could not load reads as "that is not a time", which the caller says out loud.
 */
async function whenOf(phrase: string | null, ctx: Ctx): Promise<When | null> {
  if (!phrase) return null;
  const parser = await loadNaturalDate();
  return parser ? resolveWhen(parser, phrase, ctx.now, ctx.tz) : null;
}

/**
 * A day as this app writes a day everywhere else — "Today", "Tomorrow", else "Fri 2 Oct". Never a
 * raw ISO string in front of a person.
 *
 * `now` is passed EXPLICITLY as the person's own today. `formatRelativeDay` compares against the
 * real clock by default, and on Cloudflare that clock is UTC — so for anyone east of London the
 * word "Today" would be wrong for part of every night.
 */
const dayLabel = (day: string, ctx: Ctx): string =>
  formatRelativeDay(day, { now: todayISO(ctx.tz), weekday: true }) ?? day;

const instantLabel = (at: string, ctx: Ctx): string => {
  const day = isoDateIn(at, ctx.tz);
  const clock = formatClock(at, ctx.tz);
  return `${day ? dayLabel(day, ctx) : ''}${clock ? ` at ${clock}` : ''}`.trim();
};

// ── Creations — they run, and they say what they did ────────────────────────

async function createTask(db: DB, command: Extract<AskCommand, { command: 'create_task' }>, ctx: Ctx): Promise<AskAnswer> {
  // A project named by phrase is resolved like any other record; naming one that does not exist is
  // worth saying, because the alternative is a task quietly filed nowhere the person expects.
  let projectId: string | null = null;
  let projectName: string | null = null;
  if (command.project) {
    const found = await resolveProject(db, command.project);
    if (found.kind === 'none') return said(`I could not find a project called "${command.project}".`);
    if (found.kind === 'many') return said(`Which project: ${found.options.map((o) => o.label).join(', ')}?`);
    projectId = found.match.id;
    projectName = found.match.label;
  }

  const when = await whenOf(command.when, ctx);
  // NO DATE SAID MEANS TODAY, which is what every other composer in this app does with a typed
  // task (Home's, the Tasks page's). `lib/task-intake.ts` deliberately does the opposite — but its
  // own header says why that is a different case: intake is for a task you did NOT sit down to
  // write. Here the person just did. One act, one behaviour ([[zenboard-consistency-principle]]).
  const res = await addTask({
    title: command.title,
    scheduledDate: when?.day,
    projectId,
    priority: command.priority ?? undefined,
    estimateMinutes: command.estimateMinutes ?? undefined,
  });
  if ('error' in res) return oops(res.error);

  const where = projectName ? ` in ${projectName}` : '';
  const day = when?.day ?? todayISO(ctx.tz);
  return {
    kind: 'did',
    text: `Added ${command.title}${where}, on ${dayLabel(day, ctx)}.`,
    record: { type: 'task', id: res.id, label: command.title, href: recordHref('task', res.id) },
  };
}

async function scheduleEvent(command: Extract<AskCommand, { command: 'schedule_event' }>, ctx: Ctx): Promise<AskAnswer> {
  const when = await whenOf(command.when, ctx);
  if (!when) return said(`I could not read "${command.when}" as a time. Try "tomorrow at 2" or "Friday".`);

  // Whether they said a CLOCK time is what decides an all-day entry from a timed one — the
  // distinction is theirs, and `resolveWhen` preserves it rather than imposing an hour.
  if (when.kind === 'day') {
    const res = await addEvent({ title: command.title, startsAt: `${when.day}T00:00:00.000Z`, allDay: true });
    if ('error' in res) return oops(res.error);
    return { kind: 'did', text: `${command.title} is on ${dayLabel(when.day, ctx)}.`, record: { type: 'event', id: res.id, label: command.title, href: recordHref('event', res.id) } };
  }

  const minutes = command.durationMinutes ?? DEFAULT_EVENT_MINUTES;
  const ends = new Date(Date.parse(when.at) + minutes * 60_000).toISOString();
  const res = await addEvent({ title: command.title, startsAt: when.at, endsAt: ends });
  if ('error' in res) return oops(res.error);
  return {
    kind: 'did',
    text: `${command.title} is on ${instantLabel(when.at, ctx)}.`,
    record: { type: 'event', id: res.id, label: command.title, href: recordHref('event', res.id) },
  };
}

async function createProject(db: DB, command: Extract<AskCommand, { command: 'create_project' }>): Promise<AskAnswer> {
  let clientId: string | null = null;
  let clientName: string | null = null;
  if (command.client) {
    const found = await resolveClient(db, command.client);
    if (found.kind === 'none') return said(`I could not find a client called "${command.client}".`);
    if (found.kind === 'many') return said(`Which client: ${found.options.map((o) => o.label).join(', ')}?`);
    clientId = found.match.id;
    clientName = found.match.label;
  }
  const res = await addProject({ name: command.title, clientId });
  if ('error' in res) return oops(res.error);
  return {
    kind: 'did',
    text: `Started ${command.title}${clientName ? ` for ${clientName}` : ''}.`,
    record: { type: 'project', id: res.id, label: command.title, href: recordHref('project', res.id) },
  };
}

// ── Commands that name an existing record — offered, never performed ────────

async function offerOnTask(db: DB, phrase: string, then: Proposal['do'], whenPhrase: string | null, ctx: Ctx): Promise<AskAnswer> {
  if (then === 'create_reminder' && !(await remindersSupported(db))) {
    return oops(notReady('Reminders aren’t available yet.', '0031').error);
  }

  const when = await whenOf(whenPhrase, ctx);
  if (whenPhrase && !when) return said(`I could not read "${whenPhrase}" as a time. Try "Friday" or "Monday at 9".`);
  // A reminder is a MOMENT — "remind me on Friday" with no hour has no hour to fire at, and
  // inventing 9am is the product deciding something the person did not.
  if (then === 'create_reminder' && when?.kind !== 'instant') return said('What time on that day?');

  const found = await resolveOne(phrase, await openTasks(db, phrase));
  if (found.kind === 'none') return said(`I could not find an open task matching "${phrase}".`);
  if (found.kind === 'many') return { kind: 'choose', text: 'Which one?', options: found.options, then, when };

  const proposal = proposalFor(then, found.match, when, ctx);
  return { kind: 'offer', text: describeProposal(proposal), proposal };
}

function proposalFor(then: Proposal['do'], match: Candidate, when: When | null, ctx: Ctx): Proposal {
  if (then === 'complete_task') return { do: 'complete_task', id: match.id, label: match.label };
  if (then === 'reschedule_task') {
    const day = when?.day ?? todayISO(ctx.tz);
    return { do: 'reschedule_task', id: match.id, label: match.label, day, dayLabel: dayLabel(day, ctx) };
  }
  const at = when?.kind === 'instant' ? when.at : ctx.now.toISOString();
  return { do: 'create_reminder', id: match.id, label: match.label, at, atLabel: instantLabel(at, ctx) };
}

/** The sentence on the offer. It names the RESOLVED record, which is the half a person can check. */
function describeProposal(proposal: Proposal): string {
  switch (proposal.do) {
    case 'complete_task': return `Tick off ${proposal.label}`;
    case 'reschedule_task': return `Move ${proposal.label} to ${proposal.dayLabel}`;
    case 'create_reminder': return `Remind you about ${proposal.label} on ${proposal.atLabel}`;
  }
}

/**
 * Perform an offer the person accepted.
 *
 * The row is READ BACK FIRST, for two reasons: the transcript afterwards should name the title
 * that was actually touched rather than the one shown a moment ago, and a task deleted or already
 * ticked in another tab should say so instead of reporting a write that changed nothing.
 */
export async function runProposal(proposal: Proposal): Promise<AskAnswer> {
  const { supabase } = await requireSession();
  const tz = await userTimezone();
  const ctx: Ctx = { tz, now: new Date() };

  const { data } = await supabase.from('tasks').select('id,title,done').eq('id', proposal.id).maybeSingle();
  const row = data as { id: string; title: string; done: boolean } | null;
  if (!row) return oops('That task is not there any more.');
  const label = row.title?.trim() || 'Untitled';
  const record: AskRecord = { type: 'task', id: row.id, label, href: recordHref('task', row.id) };

  switch (proposal.do) {
    case 'complete_task': {
      if (row.done) return { kind: 'did', text: `${label} was already done.`, record };
      const res = await toggleTask(row.id, true, todayISO(tz));
      return 'error' in res ? oops(res.error) : { kind: 'did', text: `Ticked off ${label}.`, record };
    }
    case 'reschedule_task': {
      const res = await rescheduleTask(row.id, proposal.day);
      return 'error' in res ? oops(res.error) : { kind: 'did', text: `Moved ${label} to ${dayLabel(proposal.day, ctx)}.`, record };
    }
    case 'create_reminder': {
      const res = await setReminder(row.id, proposal.at);
      return 'error' in res ? oops(res.error) : { kind: 'did', text: `I will remind you about ${label} on ${instantLabel(proposal.at, ctx)}.`, record };
    }
  }
}

/**
 * Accept one of the options from a `choose`.
 *
 * The chosen id came from a list this server produced a moment ago, and is re-read by
 * `runProposal` — so this builds the proposal and performs it in one step, which is what the
 * person means by clicking a name: they are answering "which one", not asking for a second offer.
 */
export async function chooseAndRun(
  id: string,
  then: Proposal['do'] | 'ask_meeting',
  when: When | null,
  question?: string | null,
): Promise<AskAnswer> {
  const { supabase, user } = await requireSession();
  const tz = await userTimezone();
  const ctx: Ctx = { tz, now: new Date() };
  // "Which meeting?" answered: ask it. The id is read back through the caller's own RLS-scoped
  // client inside `answerMeeting`, so a forged one reads nothing and says so.
  if (then === 'ask_meeting') {
    const q = (question ?? '').trim();
    if (!q || q.length > ASK_INPUT_MAX) return said('What would you like to know about the meeting?');
    return answerMeeting(supabase, user.id, id, q, ctx);
  }
  const { data } = await supabase.from('tasks').select('id,title').eq('id', id).maybeSingle();
  const row = data as { id: string; title: string } | null;
  if (!row) return oops('That task is not there any more.');
  return runProposal(proposalFor(then, { id: row.id, label: row.title?.trim() || 'Untitled' }, when, ctx));
}

// ── Reads ───────────────────────────────────────────────────────────────────

async function showTasks(db: DB, whenPhrase: string | null, ctx: Ctx): Promise<AskAnswer> {
  const when = await whenOf(whenPhrase, ctx);
  const day = when?.day ?? todayISO(ctx.tz);

  const { data } = await db
    .from('tasks')
    .select('id,title,done,priority,highlight,estimate_minutes,project_id,projects(name,color)')
    .eq('scheduled_date', day)
    .order('sort_order', { ascending: true })
    .limit(SHOW_LIMIT);

  type Row = { id: string; title: string; done: boolean; priority: RowTask['priority']; highlight: boolean; estimate_minutes: number | null; projects: { name: string; color: string | null } | null };
  const tasks: AskTask[] = ((data as unknown as Row[] | null) ?? []).map((t) => ({
    id: t.id, title: t.title, done: t.done, priority: t.priority ?? 'low', highlight: !!t.highlight,
    estimate_minutes: t.estimate_minutes, project: t.projects ?? null,
  }));

  const open = tasks.filter((t) => !t.done).length;
  const label = dayLabel(day, ctx);
  const text = tasks.length === 0
    ? `Nothing on ${label}.`
    : open === 0 ? `All done on ${label}.` : `${open} open on ${label}.`;
  return { kind: 'tasks', text, day, tasks };
}

async function showAgenda(db: DB, whenPhrase: string | null, ctx: Ctx): Promise<AskAnswer> {
  const when = await whenOf(whenPhrase, ctx);
  const day = when?.day ?? todayISO(ctx.tz);
  // The day's bounds in the PERSON'S zone — the same rule every other day query in this app uses,
  // because on Cloudflare the server's own midnight is the wrong one for everybody east of London.
  const { startISO, endISO } = dayWindow(day, ctx.tz);

  const { data } = await db
    .from('calendar_events')
    .select('id,title,starts_at,ends_at,all_day')
    .gte('starts_at', startISO).lt('starts_at', endISO)
    .order('starts_at', { ascending: true })
    .limit(SHOW_LIMIT);

  type Row = { id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean };
  const events: AskEvent[] = ((data as Row[] | null) ?? []).map((e) => ({
    id: e.id, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at, allDay: !!e.all_day,
    clock: e.all_day ? undefined : formatClock(e.starts_at, ctx.tz),
  }));

  const label = dayLabel(day, ctx);
  return { kind: 'agenda', text: events.length ? `${events.length} on ${label}.` : `Nothing on ${label}.`, day, events };
}

async function find(db: DB, query: string): Promise<AskAnswer> {
  // THE search — the same function the command palette and the @-mention picker call, so a thing
  // findable one way is findable every way, and a new record type lights up all three at once.
  const hits: RecordHit[] = await searchRecords(db, query, { limit: 4 });
  const found: AskRecord[] = hits.slice(0, SHOW_LIMIT).map((h) => ({ type: h.type, id: h.id, label: h.title, href: h.href }));
  return { kind: 'found', text: found.length ? `${found.length} for "${query}".` : `Nothing for "${query}".`, hits: found };
}

// ── The record the person has open ──────────────────────────────────────────

/** Where each addressable type keeps the words a person would call it. */
const TITLE_OF: Partial<Record<EntityType, { table: string; column: string }>> = {
  task: { table: 'tasks', column: 'title' },
  project: { table: 'projects', column: 'name' },
  client: { table: 'clients', column: 'name' },
  doc: { table: 'pages', column: 'title' },
  content: { table: 'pages', column: 'title' },
  meeting: { table: 'meetings', column: 'title' },
  event: { table: 'calendar_events', column: 'title' },
};

/**
 * Read the open record's title, so "this" can be explained to the model.
 *
 * An unknown type, a missing row or someone else's id all give NULL, and a null context simply
 * leaves the pronoun unexplained — the model then asks which one, which is the correct outcome and
 * not an error. Nothing here is worth failing a sentence over.
 */
async function contextFor(db: DB, ref: AskRef): Promise<AskContext | null> {
  const where = TITLE_OF[ref.type];
  if (!where) return null;
  try {
    const { data } = await db.from(where.table as 'tasks').select(where.column).eq('id', ref.id).maybeSingle();
    const label = (data as Record<string, unknown> | null)?.[where.column];
    return typeof label === 'string' && label.trim() ? { type: ref.type, label: label.trim() } : null;
  } catch {
    return null;
  }
}

// ── Asking a meeting (MEETINGS_PLAN M3) ─────────────────────────────────────

/** Words that point at the open meeting rather than name one. */
const THIS_MEETING = /^(?:this|it|that|here|this one|the meeting|this meeting|that meeting|the call|this call|that call)$/i;

/**
 * Answer a question from a meeting — the open one when the person says "this", else the one their
 * words name (`resolveMeetingPhrase`, lib/ask.ts). Same rule as every other record here (rule 2):
 * an unclear phrase is a question back, never a guess, because an answer read from the WRONG
 * meeting is a confident wrong answer.
 */
async function askMeeting(db: DB, userId: string, command: Extract<AskCommand, { command: 'ask_meeting' }>, ctx: Ctx): Promise<AskAnswer> {
  const phrase = command.meeting?.trim() ?? '';
  const open = ctx.ref?.type === 'meeting' ? ctx.ref.id : null;

  if (!phrase || THIS_MEETING.test(phrase)) {
    if (open) return answerMeeting(db, userId, open, command.question, ctx);
    // Nothing open and nothing named: offer the latest few rather than pick one.
    const recent = await recentMeetings(db, ctx);
    if (recent.length === 0) return said('You have no meetings yet. Record one, and ask me about it afterwards.');
    return { kind: 'choose', text: 'Which meeting?', options: recent.slice(0, MAX_OPTIONS), then: 'ask_meeting', when: null, question: command.question };
  }

  const found = resolveMeetingPhrase(phrase, await meetingRows(db), ctx.now, ctx.tz);
  if (found.kind === 'none') return said(`I could not find a meeting matching "${phrase}".`);
  if (found.kind === 'many') return { kind: 'choose', text: 'Which meeting?', options: found.options, then: 'ask_meeting', when: null, question: command.question };
  return answerMeeting(db, userId, found.match.id, command.question, ctx);
}

async function answerMeeting(db: DB, userId: string, meetingId: string, question: string, ctx: Ctx): Promise<AskAnswer> {
  const res = await answerFromMeeting(db, { userId, meetingId, question, timeZone: ctx.tz });
  if (!res.ok) {
    if (res.reason === 'missing') return oops('That meeting is not there any more.');
    if (res.reason === 'empty') return said(`${res.title?.trim() || 'That meeting'} has no notes or transcript yet, so there is nothing to answer from.`);
    return oops(FAILURE[res.reason]);
  }
  const { meeting, answer } = res;
  return {
    kind: 'quoted',
    text: answerText(answer),
    quotes: answer.kind === 'not-found' ? [] : answer.quotes.map((q) => ({ text: q.text, source: quoteSource(q), href: quoteHref(meeting.id, q) })),
    record: { type: 'meeting', id: meeting.id, label: meeting.title?.trim() || 'Meeting', href: recordHref('meeting', meeting.id) },
    partial: answer.partial,
  };
}

/**
 * The most recent meetings, newest first. NOT narrowed by the phrase in the database: "the
 * Ridgeline call" names the CLIENT, which is not in the meeting's title, so a title filter would
 * miss exactly the phrasing people use most. Forty is enough to choose from and small to score.
 */
async function meetingRows(db: DB): Promise<MeetingRow[]> {
  const { data } = await db.from('meetings').select('id,title,met_at,clients(name)').order('met_at', { ascending: false }).limit(CANDIDATES);
  type Row = { id: string; title: string; met_at: string; clients: { name: string } | null };
  return ((data as unknown as Row[] | null) ?? []).map((m) => ({ id: m.id, title: m.title, metAt: m.met_at, client: m.clients?.name ?? null }));
}

/** The meetings that have happened, newest first — what "which meeting?" offers. */
async function recentMeetings(db: DB, ctx: Ctx): Promise<Candidate[]> {
  return (await meetingRows(db)).filter((m) => Date.parse(m.metAt) <= ctx.now.getTime()).map((m) => meetingCandidate(m, ctx.tz));
}

// ── Candidates ──────────────────────────────────────────────────────────────

/**
 * The open tasks worth scoring against this phrase.
 *
 * NARROWED IN THE DATABASE, SCORED IN `lib/ask.ts`. Pulling every open task would be a scan and a
 * payload; narrowing on the whole phrase would match nothing, because nobody's task is titled "the
 * buildojo logo". So any single content word gets a row into the running, and the scoring decides.
 * The terms are safe to interpolate for the reason `phraseWords` states: they cannot contain the
 * punctuation PostgREST's filter grammar is made of.
 */
async function openTasks(db: DB, phrase: string): Promise<Candidate[]> {
  const terms = phraseWords(phrase);
  let q = db.from('tasks').select('id,title,scheduled_date').eq('done', false);
  if (terms.length) q = q.or(terms.map((t) => `title.ilike.%${t}%`).join(','));
  const { data } = await q.order('updated_at', { ascending: false }).limit(CANDIDATES);
  type Row = { id: string; title: string; scheduled_date: string | null };
  return ((data as Row[] | null) ?? []).map((t) => ({ id: t.id, label: t.title?.trim() || 'Untitled', hint: t.scheduled_date }));
}

async function resolveProject(db: DB, phrase: string) {
  const terms = phraseWords(phrase);
  let q = db.from('projects').select('id,name');
  if (terms.length) q = q.or(terms.map((t) => `name.ilike.%${t}%`).join(','));
  const { data } = await q.order('updated_at', { ascending: false }).limit(CANDIDATES);
  type Row = { id: string; name: string };
  return resolveOne(phrase, ((data as Row[] | null) ?? []).map((p) => ({ id: p.id, label: p.name?.trim() || 'Untitled' })));
}

async function resolveClient(db: DB, phrase: string) {
  const terms = phraseWords(phrase);
  let q = db.from('clients').select('id,name');
  if (terms.length) q = q.or(terms.map((t) => `name.ilike.%${t}%`).join(','));
  const { data } = await q.order('updated_at', { ascending: false }).limit(CANDIDATES);
  type Row = { id: string; name: string };
  return resolveOne(phrase, ((data as Row[] | null) ?? []).map((c) => ({ id: c.id, label: c.name?.trim() || 'Untitled' })));
}

