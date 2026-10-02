import * as chrono from 'chrono-node';
import { describe, expect, it } from 'vitest';

import {
  ASK_COMMANDS, ASK_EXAMPLES, ASK_MEETING_EXAMPLES, CONFIDENT, MAX_OPTIONS, NO_COMMAND, READ_ONLY, TOUCHES_EXISTING,
  askExamples, askInput, askSchema, askSystem, describe as describeCommand, isProblem, meetingCandidate, readCommand,
  resolveMeetingPhrase, resolveOne, resolveWhen, score, type AskCommandId, type AskRaw, type Candidate, type MeetingRow,
} from './ask';

/** A Monday, 09:00 in London, as an instant. Every date assertion below is relative to this. */
const NOW = new Date('2026-09-28T08:00:00.000Z');
const TZ = 'Europe/London';

const raw = (over: Partial<AskRaw> & { command: AskCommandId }): AskRaw => askSchema.parse(over);

describe('the classification — what runs and what is offered', () => {
  // The header's rule, as arithmetic: a command that is in neither set is a command nobody decided
  // about, and the default would be to RUN it. That is the wrong default to arrive at by omission.
  it('sorts every command into exactly one of runs / offered / read-only', () => {
    for (const c of ASK_COMMANDS) {
      const offered = TOUCHES_EXISTING.has(c);
      const reads = READ_ONLY.has(c);
      expect(offered && reads, `${c} is in both sets`).toBe(false);
    }
    const unclassified = ASK_COMMANDS.filter((c) => !TOUCHES_EXISTING.has(c) && !READ_ONLY.has(c));
    // What remains is exactly the creations — they run, and say what they did.
    expect(unclassified).toEqual(['create_task', 'schedule_event', 'create_project']);
  });

  it('offers, rather than performs, everything that names a record the person already has', () => {
    expect([...TOUCHES_EXISTING].sort()).toEqual(['complete_task', 'create_reminder', 'reschedule_task']);
  });
});

describe('reading what the model said', () => {
  it('asks for the subject rather than failing, when a command arrives without one', () => {
    expect(readCommand(raw({ command: 'complete_task' }))).toEqual({ problem: 'Which task should I tick off?' });
    expect(readCommand(raw({ command: 'reschedule_task', task: 'logo' }))).toEqual({ problem: 'When should I move it to?' });
    expect(readCommand(raw({ command: 'create_task' }))).toEqual({ problem: 'What should the task be called?' });
  });

  it('treats whitespace as absent — a model padding a field has said nothing', () => {
    expect(isProblem(readCommand(raw({ command: 'create_task', title: '   ' })))).toBe(true);
  });

  it('keeps a new thing and an existing thing in different fields', () => {
    const made = readCommand(raw({ command: 'create_task', title: 'Finish the logo' }));
    expect(made).toMatchObject({ command: 'create_task', title: 'Finish the logo' });
    const found = readCommand(raw({ command: 'complete_task', task: 'the logo' }));
    expect(found).toMatchObject({ command: 'complete_task', task: 'the logo' });
  });

  it('lets a day-less "show me" through — the day has a default, the subject does not', () => {
    expect(readCommand(raw({ command: 'show_tasks' }))).toEqual({ command: 'show_tasks', when: null });
  });

  it('falls back to what it has when find arrives without a query, rather than asking twice', () => {
    expect(readCommand(raw({ command: 'find', title: 'Northwind' }))).toEqual({ command: 'find', query: 'Northwind' });
  });

  it('says what it cannot do in its own words, or in ours when it gave none', () => {
    expect(readCommand(raw({ command: 'none' }))).toEqual({ command: 'none', reply: NO_COMMAND });
    expect(readCommand(raw({ command: 'none', reply: 'I cannot send email yet.' }))).toEqual({ command: 'none', reply: 'I cannot send email yet.' });
  });

  it('accepts the stray nulls a model emits, which is the whole reason the schema is loose', () => {
    expect(() => askSchema.parse({ command: 'create_task', title: 'Logo', task: null, when: null, project: null, client: null, priority: null, estimateMinutes: null, durationMinutes: null, query: null, reply: null })).not.toThrow();
  });
});

describe('time — read, never calculated', () => {
  it('reads a bare weekday as a DAY and a spoken time as an INSTANT', () => {
    // The distinction the person made: an all-day thing vs a 12:00 one.
    expect(resolveWhen(chrono, 'friday', NOW, TZ)).toEqual({ kind: 'day', day: '2026-10-02' });
    const at = resolveWhen(chrono, 'tomorrow at 12', NOW, TZ);
    expect(at?.kind).toBe('instant');
    expect(at).toMatchObject({ day: '2026-09-29' });
  });

  it('always looks forward — a weekday named on a later day means the one coming', () => {
    // Said on a Wednesday, "monday" is the Monday ahead. Without forwardDate chrono answers with
    // the Monday two days BEHIND, which moves a task into the past and looks like it worked.
    const wednesday = new Date('2026-09-30T08:00:00.000Z');
    expect(resolveWhen(chrono, 'monday', wednesday, TZ)).toEqual({ kind: 'day', day: '2026-10-05' });
  });

  it('resolves the day in the person\'s zone, not the server\'s', () => {
    // 23:30 in Auckland on the 28th is still the 28th there and already the 29th in UTC.
    const late = new Date('2026-09-28T10:30:00.000Z');
    expect(resolveWhen(chrono, 'today', late, 'Pacific/Auckland')).toEqual({ kind: 'day', day: '2026-09-28' });
  });

  it('returns null for words that are not a time, rather than a plausible date', () => {
    expect(resolveWhen(chrono, 'the buildojo logo', NOW, TZ)).toBeNull();
    expect(resolveWhen(chrono, '', NOW, TZ)).toBeNull();
    expect(resolveWhen(chrono, '   ', NOW, TZ)).toBeNull();
  });

  it('survives a parser that throws instead of taking the conversation down', () => {
    const broken = { parse: () => { throw new Error('nope'); } };
    expect(resolveWhen(broken, 'friday', NOW, TZ)).toBeNull();
  });
});

describe('resolving a phrase to a record', () => {
  const tasks: Candidate[] = [
    { id: 't1', label: 'Buildojo logo v2' },
    { id: 't2', label: 'Blog audit' },
    { id: 't3', label: 'Logo feedback call' },
  ];

  it('ignores the words that carry no identity', () => {
    expect(resolveOne('the buildojo logo', tasks)).toEqual({ kind: 'one', match: tasks[0] });
  });

  it('will not match a record on one shared word', () => {
    // "the buildojo logo" shares "logo" with "Logo feedback call" and must not land there — not
    // even as a question, or the honest "I could not find that" answer never happens.
    expect(resolveOne('the buildojo logo', [tasks[2]])).toEqual({ kind: 'none' });
  });

  it('asks about a mostly-landed phrase, and never acts on one', () => {
    // "finish the buildojo logo" against "Buildojo logo v2": two of three words. Worth a question.
    const r = resolveOne('finish the buildojo logo', tasks);
    expect(r.kind).toBe('many');
    expect(score('finish the buildojo logo', 'Buildojo logo v2')).toBeLessThan(CONFIDENT);
  });

  it('asks rather than guessing when two records are equally good', () => {
    const twins: Candidate[] = [{ id: 'a', label: 'Logo v2' }, { id: 'b', label: 'Logo v3' }];
    const r = resolveOne('logo', twins);
    expect(r.kind).toBe('many');
    if (r.kind === 'many') expect(r.options).toHaveLength(2);
  });

  it('answers none when nothing is close, instead of the least bad row', () => {
    expect(resolveOne('quarterly tax return', tasks)).toEqual({ kind: 'none' });
  });

  it('never offers more options than a question can hold', () => {
    const many: Candidate[] = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, label: `Logo ${i}` }));
    const r = resolveOne('logo', many);
    expect(r.kind).toBe('many');
    if (r.kind === 'many') expect(r.options.length).toBeLessThanOrEqual(MAX_OPTIONS);
  });

  it('scores an exact name above a containing one, and both above a word overlap', () => {
    expect(score('Blog audit', 'Blog audit')).toBe(1);
    expect(score('audit', 'Blog audit')).toBeGreaterThanOrEqual(CONFIDENT);
    expect(score('blog redesign', 'Blog audit')).toBeLessThan(CONFIDENT);
  });

  it('reads a phrase the same however it is capitalised, punctuated or accented', () => {
    expect(resolveOne('BUILDOJO LOGO!', tasks)).toEqual({ kind: 'one', match: tasks[0] });
    expect(score('café', 'Cafe')).toBe(1);
  });
});

describe('what the model is told', () => {
  it('forbids the four things it would otherwise do helpfully and wrongly', () => {
    expect(askSystem).toContain('NEVER calculate a date');
    expect(askSystem).toContain('NEVER invent an id');
    expect(askSystem).toContain('Do not bend it into the nearest command');
    // The fourth was found by asking a real model (lib/ai/ask.live.test.ts): "find my emails from
    // Alex" came back as `find`, which would search Zenboard and report "nothing", telling somebody
    // their inbox is empty on the strength of a table that has never seen an email.
    expect(askSystem).toContain('does NOT hold email');
    expect(askSystem).toMatch(/never "find"/);
  });

  it('names every command it is allowed to answer with, and no others', () => {
    for (const c of ASK_COMMANDS) expect(askSystem, c).toContain(`- ${c}:`);
    const named = [...askSystem.matchAll(/^- ([a-z_]+):/gm)].map((m) => m[1]);
    expect(named.sort()).toEqual([...ASK_COMMANDS].sort());
  });

  it('gives today as a fact so a weekday can be placed without arithmetic', () => {
    const input = askInput('move it to friday', { today: '2026-09-28', weekday: 'Monday' });
    expect(input).toContain('Today is Monday, 2026-09-28.');
  });

  it('explains the context as the meaning of "this", not as a subject to use', () => {
    const input = askInput('move this to friday', { today: '2026-09-28', weekday: 'Monday', context: { type: 'task', label: 'Buildojo logo v2' } });
    expect(input).toContain('If they say "this", they mean the task they have open, called "Buildojo logo v2".');
  });

  it('bounds what one message may carry', () => {
    const input = askInput('x'.repeat(9000), { today: '2026-09-28', weekday: 'Monday' });
    expect(input.length).toBeLessThan(2600);
  });
});

describe('the sentence on an offer', () => {
  it('names the record that was RESOLVED, not the words that were typed', () => {
    const cmd = readCommand(raw({ command: 'complete_task', task: 'the logo one' }));
    expect(isProblem(cmd)).toBe(false);
    if (isProblem(cmd)) return;
    expect(describeCommand(cmd, { label: 'Buildojo logo v2' })).toBe('Tick off Buildojo logo v2');
  });

  it('says where a move lands, because that is the other half of the mistake', () => {
    const cmd = readCommand(raw({ command: 'reschedule_task', task: 'logo', when: 'friday' }));
    if (isProblem(cmd)) throw new Error('should have read');
    expect(describeCommand(cmd, { label: 'Buildojo logo v2', when: 'Fri 2 Oct' })).toBe('Move Buildojo logo v2 to Fri 2 Oct');
  });
});

describe('asking a meeting (MEETINGS_PLAN M3 · ASK_PLAN A2)', () => {
  it('is a READ: it answers, and nothing is written or offered', () => {
    expect(READ_ONLY.has('ask_meeting')).toBe(true);
    expect(TOUCHES_EXISTING.has('ask_meeting')).toBe(false);
  });

  it('asks for the question rather than failing, when one arrives without it', () => {
    expect(readCommand(raw({ command: 'ask_meeting', meeting: 'this' }))).toEqual({ problem: 'What would you like to know about the meeting?' });
  });

  it('keeps the person’s question and their words for the meeting, never an id', () => {
    expect(readCommand(raw({ command: 'ask_meeting', question: 'What did Alex say about the budget?', meeting: 'the Ridgeline call' })))
      .toEqual({ command: 'ask_meeting', question: 'What did Alex say about the budget?', meeting: 'the Ridgeline call' });
    expect(readCommand(raw({ command: 'ask_meeting', question: 'What did we decide?' }))).toEqual({ command: 'ask_meeting', question: 'What did we decide?', meeting: null });
  });

  it('takes the question from `query` when a model put it there', () => {
    expect(readCommand(raw({ command: 'ask_meeting', query: 'What did I promise?' }))).toMatchObject({ question: 'What did I promise?' });
  });

  it('tells the model that find LOCATES and ask_meeting ANSWERS from what was said', () => {
    expect(askSystem).toMatch(/- ask_meeting: a question about what was said, decided or promised in a meeting/);
    expect(askSystem).toMatch(/"find" locates a record; "ask_meeting" answers from what was SAID/);
    expect(NO_COMMAND).toMatch(/answer questions about your meetings/);
  });

  it('offers a meeting’s own questions when one is open, and the general ones otherwise', () => {
    expect(askExamples('meeting')).toBe(ASK_MEETING_EXAMPLES);
    expect(askExamples('task')).toBe(ASK_EXAMPLES);
    expect(askExamples(null)).toBe(ASK_EXAMPLES);
    // Sentence case, questions a person would really ask — never a feature list.
    for (const e of ASK_MEETING_EXAMPLES) expect(e[0]).toBe(e[0].toUpperCase());
  });

  it('describes the command as the question itself', () => {
    expect(describeCommand({ command: 'ask_meeting', question: 'What did we decide?', meeting: null })).toBe('What did we decide?');
  });
});

describe('which meeting the person means', () => {
  // Newest first, as the action reads them. "Now" is Tue 29 Sep 2026, 10:00 in Kolkata.
  const now = new Date('2026-09-29T04:30:00.000Z');
  const tz = 'Asia/Kolkata';
  const rows: MeetingRow[] = [
    { id: 'future', title: 'Design review', metAt: '2026-10-02T06:00:00.000Z', client: 'Ridgeline' },
    { id: 'today', title: 'Logo direction call', metAt: '2026-09-29T03:30:00.000Z', client: 'Ridgeline' },
    // 23:00 on the 28th in Kolkata — the 28th there, though it is still the 28th in UTC too.
    { id: 'yesterday', title: 'Menu check-in', metAt: '2026-09-28T17:30:00.000Z', client: 'Copper Row' },
    { id: 'kickoff', title: 'Kickoff', metAt: '2026-09-09T05:00:00.000Z', client: 'Ridgeline' },
    { id: 'beacon', title: 'Sitemap review', metAt: '2026-09-02T05:00:00.000Z', client: 'Beacon Health' },
  ];
  const id = (phrase: string) => {
    const r = resolveMeetingPhrase(phrase, rows, now, tz);
    return r.kind === 'one' ? r.match.id : r.kind === 'many' ? r.options.map((o) => o.id) : null;
  };

  it('names a meeting by its client, which is how people say it', () => {
    expect(id('the Beacon call')).toBe('beacon');
    expect(id('the Copper Row meeting')).toBe('yesterday');
  });

  it('names one by its title, with or without the word "meeting"', () => {
    expect(id('the kickoff')).toBe('kickoff');
    expect(id('sitemap review meeting')).toBe('beacon');
  });

  it('asks which, when several meetings fit equally', () => {
    expect(id('the Ridgeline call')).toEqual(['future', 'today', 'kickoff']);
  });

  it('reads "last" as the most recent that has HAPPENED — never one still on the calendar', () => {
    expect(id('my last meeting')).toBe('today');
    expect(id('the last Ridgeline call')).toBe('today');
    expect(id('the previous Beacon meeting')).toBe('beacon');
    expect(id('the last Northwind call')).toBeNull();
  });

  it('reads today and yesterday in the person’s own zone', () => {
    expect(id('today’s meeting')).toBe('today');
    expect(id("yesterday's call")).toBe('yesterday');
    expect(id('yesterday’s Ridgeline call')).toBeNull();
  });

  it('finds nothing rather than something, for a meeting that does not exist', () => {
    expect(id('the Northwind workshop')).toBeNull();
  });

  it('shows a meeting as its title and who it was with, and when, to tell two apart', () => {
    const c = meetingCandidate(rows[3], tz);
    expect(c.label).toBe('Kickoff · Ridgeline');
    expect(c.hint).toBeTruthy();
    expect(meetingCandidate({ ...rows[3], client: null, title: '  ' }).label).toBe('Meeting');
  });
});
