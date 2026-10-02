import { readFileSync } from 'node:fs';

import * as chrono from 'chrono-node';
import { beforeAll, describe, expect, it } from 'vitest';

import { generateJSON } from './gateway';
import { groqProvider } from './groq';
import type { AIProvider } from './provider';
import type { UsageLedger } from './usage';
import {
  ASK_MAX_TOKENS, askInput, askSchema, askSystem, isProblem, readCommand, resolveWhen,
  type AskCommand, type AskContext,
} from '@/lib/ask';

// ── DOES ASK ACTUALLY UNDERSTAND THE SENTENCES IN THE BRIEF? ────────────────
//
// `lib/ask.test.ts` proves the RULES — the classification, the scoring, the time reading, the
// refusals in the prompt — with no model in the room, and it runs in the suite. This file answers
// the only question that file cannot: given a real sentence and a real provider, does the right
// command come back with the right arguments?
//
// It is the same shape as `lib/ai/bake-off.live.test.ts` and opt-in for the same reason — it calls
// a hosted model, so it must never run in CI or in a watch loop:
//
//   ZB_LIVE_AI=1 npx vitest run lib/ai/ask.live.test.ts
//
// EVERY CASE HERE IS A SENTENCE FROM THE USER'S OWN BRIEF, or the nearest thing this sprint's
// commands can do with one. The three assertions that matter most are not "did it pick the right
// verb" — they are the three rules the whole design rests on:
//
//   1. It hands back the person's TIME WORDS, never a date it worked out. Asserted by reading the
//      answer's `when` with the real parser and checking the DAY that falls out, which is what the
//      product does with it — so a model that answers "2026-10-09" instead of "friday" fails here
//      loudly rather than being wrong once a week in production.
//   2. It hands back the person's WORDS for a record, not an invented id.
//   3. It says `none` for something out of scope instead of bending it into the nearest verb.

const LIVE = process.env.ZB_LIVE_AI === '1';

/** A Monday, 09:00 London. Every expectation below is relative to this instant. */
const NOW = new Date('2026-09-28T08:00:00.000Z');
const TZ = 'Europe/London';
const TODAY = '2026-09-28';

const ledger = (): UsageLedger => ({
  usedToday: async () => 0,
  audioToday: async () => 0,
  poolToday: async () => 0,
  record: async () => {},
});

async function askLive(message: string, context?: AskContext): Promise<AskCommand> {
  const provider: AIProvider = groqProvider();
  const res = await generateJSON(
    {
      feature: 'ask',
      system: askSystem,
      input: askInput(message, { today: TODAY, weekday: 'Monday', context }),
      schema: askSchema,
      maxTokens: ASK_MAX_TOKENS,
      userId: 'live-test',
      timeZone: TZ,
    },
    { providers: [provider], ledger: ledger(), timeoutMs: 60_000 },
  );
  if (!res.ok) throw new Error(`gateway said ${res.reason}`);
  const command = readCommand(res.data);
  if (isProblem(command)) throw new Error(`incomplete: ${command.problem}`);
  return command;
}

/** Read an answer's time words exactly as the product reads them. */
const dayOf = (phrase: string | null) => resolveWhen(chrono, phrase ?? '', NOW, TZ)?.day ?? null;

describe.skipIf(!LIVE)('Ask, against a real model', () => {
  beforeAll(() => {
    // Next loads .env.local for the app but deliberately skips it under NODE_ENV=test, so the key
    // is read here directly — otherwise the provider reads as "no key" and this quietly measures
    // nothing. (Same note as the bake-off's: it cost a run there once.)
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  });

  it('"Create a task for the Buildojo logo" adds a task, and does not invent a day', async () => {
    const c = await askLive('Create a task for the Buildojo logo');
    expect(c.command).toBe('create_task');
    if (c.command !== 'create_task') return;
    expect(c.title.toLowerCase()).toContain('buildojo');
    // Nothing in the sentence is a time, so nothing may come back as one.
    expect(dayOf(c.when)).toBeNull();
  }, 60_000);

  it('"Add a task to finish the logo on Friday" keeps the day as the word the person said', async () => {
    const c = await askLive('Add a task to finish the logo on Friday');
    expect(c.command).toBe('create_task');
    if (c.command !== 'create_task') return;
    // RULE 1. The model may say "Friday", "friday", "this friday" — any of them read to the 2nd.
    // What it may NOT do is compute, because when it computes it is confidently wrong.
    expect(dayOf(c.when)).toBe('2026-10-02');
    expect(c.title.toLowerCase()).not.toContain('friday');
  }, 60_000);

  it('"Schedule a meeting with Alex tomorrow at 12" keeps the clock time, so it is not an all-day entry', async () => {
    const c = await askLive('Schedule a meeting with Alex tomorrow at 12');
    expect(c.command).toBe('schedule_event');
    if (c.command !== 'schedule_event') return;
    const when = resolveWhen(chrono, c.when, NOW, TZ);
    expect(when?.day).toBe('2026-09-29');
    // The person said an hour, so this has to survive as an INSTANT. A `day` here would put a
    // 12 o'clock meeting across the whole of tomorrow.
    expect(when?.kind).toBe('instant');
  }, 60_000);

  it('"Show me today\'s tasks" reads, and writes nothing', async () => {
    const c = await askLive("Show me today's tasks");
    expect(c.command).toBe('show_tasks');
  }, 60_000);

  it('"Move this task to Friday" resolves "this" from the open record, and names it in the person\'s words', async () => {
    const c = await askLive('Move this task to Friday', { type: 'task', label: 'Buildojo logo v2' });
    expect(c.command).toBe('reschedule_task');
    if (c.command !== 'reschedule_task') return;
    // RULE 2: it hands back WORDS, and they are the ones that will find the row. Never an id.
    expect(c.task.toLowerCase()).toContain('logo');
    expect(c.task).not.toMatch(/^[0-9a-f-]{16,}$/i);
    expect(dayOf(c.when)).toBe('2026-10-02');
  }, 60_000);

  it('"Remind me about the invoice on Monday at 9" is a reminder on the NEXT Monday, not today', async () => {
    const c = await askLive('Remind me about the invoice on Monday at 9');
    expect(c.command).toBe('create_reminder');
    if (c.command !== 'create_reminder') return;
    // Said ON a Monday. `forwardDate` is why this is the 5th and not today — a reminder that
    // resolves to this morning has already passed, and would never fire.
    expect(dayOf(c.when)).toBe('2026-10-05');
  }, 60_000);

  it('"Find my emails from Alex" says it cannot, rather than bending it into a search of the wrong thing', async () => {
    // RULE 3, and the one that keeps this honest while Mail is not built: the brief lists this
    // sentence, and the right answer today is to say so. When Mail lands it registers its verbs in
    // `ASK_COMMANDS` and this expectation changes to `find_email` — that is the whole migration.
    const c = await askLive('Find my emails from Alex');
    expect(c.command).toBe('none');
  }, 60_000);

  it('"delete everything" is not a command it has, and it does not improvise one', async () => {
    const c = await askLive('delete everything');
    expect(c.command).toBe('none');
  }, 60_000);
});
