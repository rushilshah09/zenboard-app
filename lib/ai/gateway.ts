import 'server-only';

// ── THE AI GATEWAY ──────────────────────────────────────────────────────────
//
// The ONE way any part of Zenboard asks a model for anything (the AI plan's §18 and rule 3). A
// feature hands over its instructions, the person's material and a schema; it gets back either
// data that PASSED the schema, or a reason it could not. It never sees a provider, a raw string or
// a half-parsed object — which is the plan's rule 2 made structural: a model's words cannot reach
// the database, or the screen, without going through a validator first.
//
// In order, for every request:
//   1. The allowance. Past today's share, the answer is 'limit' and no provider is called.
//   2. The chain. Workers AI first (free, and the data stays on the network the app runs on), then
//      Groq with the same model. Past the pool guard Workers AI steps aside for the fallback; past
//      the ceiling it steps aside even when there is none, so the free pool is never overdrawn.
//   3. Each attempt must produce a JSON object that the feature's schema accepts. An empty answer,
//      a truncated one, bad JSON or a schema miss is a FAILED attempt and the next provider is
//      tried. A thrown call (timeout, 429, outage) is the same.
//   4. Every attempt, good or bad, is one row in the usage ledger, with what it cost.
//
// What this deliberately does NOT do: retry the same provider, stream, or keep a conversation.
// Each is a way to spend the shared pool on the same failure twice.

import type { ZodType } from 'zod';

import { gemini } from './gemini';
import { groq } from './groq';
import { nvidia } from './nvidia';
import type { AICompletion, AIProvider, AIProviderId, AIUsage } from './provider';
import { CLIENT_WORDS, DAILY_ALLOWANCE, POOL_GUARD_NEURONS, ledger, type AIFeature, type UsageLedger } from './usage';
import { NEURONS, workersAI } from './workers-ai';

export type AIFailure =
  /** This person has used today's allowance. */
  | 'limit'
  /** No provider could be reached, or every one of them failed to answer. */
  | 'unavailable'
  /** A provider answered, but nothing it said passed validation. */
  | 'invalid';

export type AIResult<T> =
  | { ok: true; data: T; provider: AIProviderId }
  | { ok: false; reason: AIFailure };

export type JSONRequest<T> = {
  feature: AIFeature;
  /** Fixed per feature. Never the person's words. */
  system: string;
  /** The person's material, already wrapped and bounded by the feature. */
  input: string;
  schema: ZodType<T>;
  maxTokens: number;
  /** Whose allowance this spends, and the zone their "today" is counted in. */
  userId: string;
  timeZone: string;
};

export type GatewayDeps = {
  providers: AIProvider[];
  ledger: UsageLedger;
  /** How long one attempt may take before the next provider is tried. */
  timeoutMs: number;
};

/**
 * Past this, Workers AI is skipped even with no fallback: the remainder of the free 10,000 is the
 * margin for requests already in flight, because on a paid Workers plan the next Neuron is billed.
 */
export const POOL_CEILING_NEURONS = NEURONS.perDayFree - 200;

/**
 * The chain, in order of first choice — decided by MEASUREMENT on Zenboard's own jobs
 * (lib/ai/bake-off.live.test.ts, 2026-09-29), not by reputation:
 *   1. Groq, gpt-oss-120b — 0.75 s, 3/3, free, does not train, production allowed.
 *   2. Workers AI, the same weights — 3.8 s, 3/3, the floor: no key, no per-minute limit.
 *   3. NVIDIA's catalog — overflow only: its free endpoints timed out (25 s) or were "temporarily
 *      overloaded" on 5 of 6 models, it trains on inputs, and its trial terms forbid production.
 *   4. Gemini — overflow only: ~20 s and 1/3 on the day, and its free tier trains on inputs.
 * A provider with no key is not in the chain; `providersFor` keeps a client's own words away from
 * the ones that train; `chainFor` steps Workers AI aside when the shared pool runs low.
 */
const DEFAULTS: GatewayDeps = { providers: [groq, workersAI, nvidia, gemini], ledger, timeoutMs: 25_000 };

const NO_USAGE: AIUsage = { inputTokens: 0, outputTokens: 0, neurons: null };

/**
 * The JSON object in a model's answer. Hosts in JSON mode return bare JSON, but a fallback may wrap
 * it in a code fence or a sentence, and refusing a correct answer over its wrapping would waste the
 * call. Anything that still does not parse is `undefined`, a failed attempt.
 */
export function parseJSONObject(text: string | null): unknown {
  if (!text) return undefined;
  // Reasoning models on some hosts think out loud in the answer itself; the thinking is not the
  // answer, and its braces would be read as the object.
  const bare = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(bare);
  } catch {
    const first = firstObject(bare);
    if (first === null) return undefined;
    try {
      return JSON.parse(first);
    } catch {
      return undefined;
    }
  }
}

/**
 * The FIRST BALANCED `{…}` in a piece of text, or null.
 *
 * WHY BALANCED, RATHER THAN THE FIRST `{` TO THE LAST `}`. Measured on Workers AI 2026-09-29:
 * roughly one gpt-oss answer in ten to a long meeting comes back as TWO complete JSON objects, one
 * after the other — the model answers, then answers again. `finish` is `stop` and each object is
 * valid on its own, but a span reaching to the last `}` covers both, parses as nothing, and the
 * whole call is thrown away: a write-up the person waited thirty seconds for, lost to a second
 * opinion nobody asked for. Taking the first complete object keeps the answer the model committed
 * to first, which is the same rule `verifyFilings` already uses when a model files one thought
 * twice.
 *
 * Braces inside strings are not structure — `{"text":"a } b"}` must not end at that `}` — so the
 * scan tracks strings and their escapes rather than counting characters.
 */
export function firstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  // Never closed: the answer was cut off mid-object. The gateway already refuses a truncated
  // answer, and half an object is not a smaller answer — it is a different one.
  return null;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer within ${ms} ms.`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Hosts whose FREE tier uses what it is sent to improve their models — read in their own terms
 * (Gemini API Additional Terms, "Unpaid Services"; NVIDIA API Trial Terms §3.3), 2026-09-29.
 */
export const TRAINS_ON_INPUT: ReadonlySet<AIProviderId> = new Set<AIProviderId>(['gemini', 'nvidia']);

/**
 * May a host that trains on its inputs see a CLIENT'S OWN WORDS? Off unless the account holder sets
 * `AI_SHARE_CLIENT_WORDS=1` (`GEMINI_SENSITIVE=1`, its first name, still counts).
 */
export function clientWordsMayTrain(): boolean {
  return process.env.AI_SHARE_CLIENT_WORDS === '1' || process.env.GEMINI_SENSITIVE === '1';
}

/**
 * Whose material may go where.
 *
 * Most of what Zenboard sends a model is the PERSON'S OWN writing — their captured thoughts, their
 * task titles, the record of their own week — and the account holder has chosen to trade that for
 * free models ("if we don't have money then we have to pay by something", 2026-09-29). A meeting
 * transcript is not theirs to trade: it is somebody else's speech, recorded inside a working
 * relationship and often an NDA, and that person agreed to nothing. So hosts that train on their
 * inputs are kept away from those features unless the account holder deliberately says otherwise,
 * and the decision is made HERE, once, rather than remembered at each call site.
 */
export function providersFor<P extends { id: AIProviderId }>(feature: AIFeature, all: P[]): P[] {
  if (!CLIENT_WORDS.has(feature) || clientWordsMayTrain()) return all;
  return all.filter((p) => !TRAINS_ON_INPUT.has(p.id));
}

/**
 * The providers to try, in order, given how much of the shared pool is gone. Generic, because the
 * transcription chain (lib/ai/transcribe.ts) draws on the same pool and obeys the same guard.
 */
export function chainFor<P extends { id: AIProviderId }>(available: P[], poolNeurons: number | null): P[] {
  if (poolNeurons === null) return available;
  const others = available.filter((p) => p.id !== 'workers-ai');
  if (poolNeurons >= POOL_CEILING_NEURONS) return others;
  if (poolNeurons >= POOL_GUARD_NEURONS && others.length > 0) return others;
  return available;
}

export async function generateJSON<T>(req: JSONRequest<T>, deps: GatewayDeps = DEFAULTS): Promise<AIResult<T>> {
  const available = providersFor(req.feature, deps.providers.filter((p) => p.available()));
  if (available.length === 0) return { ok: false, reason: 'unavailable' };

  // One round trip for both reads.
  const [used, pool] = await Promise.all([
    deps.ledger.usedToday(req.userId, req.timeZone),
    available.some((p) => p.id === 'workers-ai') ? deps.ledger.poolToday() : Promise.resolve(null),
  ]);
  if (used !== null && used >= DAILY_ALLOWANCE) return { ok: false, reason: 'limit' };

  const chain = chainFor(available, pool);
  if (chain.length === 0) return { ok: false, reason: 'unavailable' };

  let answeredBadly = false;
  for (const provider of chain) {
    const row = { userId: req.userId, feature: req.feature, provider: provider.id, model: provider.model };

    let completion: AICompletion;
    try {
      completion = await withTimeout(
        provider.complete({ system: req.system, input: req.input, format: 'json', maxTokens: req.maxTokens }),
        deps.timeoutMs,
      );
    } catch {
      await deps.ledger.record({ ...row, ok: false, usage: NO_USAGE });
      continue;
    }

    // A truncated answer is never trusted, even when the cut happened to leave valid JSON behind.
    const parsed = completion.finish === 'length' ? undefined : parseJSONObject(completion.text);
    const checked = parsed === undefined ? null : req.schema.safeParse(parsed);
    const ok = checked?.success === true;
    await deps.ledger.record({ ...row, ok, usage: completion.usage });
    if (checked?.success) return { ok: true, data: checked.data, provider: provider.id };
    answeredBadly = true;
  }

  return { ok: false, reason: answeredBadly ? 'invalid' : 'unavailable' };
}
