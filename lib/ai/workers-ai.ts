// ── THE PROVIDER: CLOUDFLARE WORKERS AI ─────────────────────────────────────
//
// The free inference the account already has: 10,000 Neurons a DAY, no card, no second vendor, and
// the request never leaves the network the app already runs on. It is the FLOOR of the gateway's
// chain: Groq serves the same weights first (faster, its own free quota), and this answers whenever
// Groq cannot — no key, no per-minute limit.
//
// WHY gpt-oss-120b (2026-09-29, up from 20b). Every AI act here is STRUCTURED — proposals the app
// validates before anyone sees them — and chosen by MEASUREMENT on Zenboard's own three jobs
// (meeting → commitments, inbox → projects, record → client update), through their verifiers
// (lib/ai/bake-off.live.test.ts):
//   · gpt-oss-120b  3/3 · 3.8 s average on Workers AI · 0.75 s on Groq
//   · gpt-oss-20b   3/3 · 2–14 s here (one 36 s outlier)
//   · NVIDIA's free catalog (DeepSeek V4.1 Flash, GLM-5.3, Gemma 4, Nemotron 3 Super): 0–1 of 3,
//     timing out at 25 s or "Service temporarily overloaded"; Gemini 3.5 Flash 1/3 at ~20 s.
//   · the 1B this file first picked is LAST of 111 on GPQA (18.7) — cheap, and cheap for a reason.
// Both passing sizes are the same open weights (Apache-2.0); the larger one is kept because the
// jobs ahead (whole-meeting notes, questions over a transcript) are the hard ones, and on Groq it
// costs no time. At LOW reasoning effort, pinned below: at the default, one measured call spent its
// whole 1,500-token ceiling reasoning and returned NOTHING after 14 s.
//
// Transcription runs here only as the fallback: Groq's free Whisper leads (lib/ai/transcribe.ts),
// because Whisper costs 46.6 Neurons per audio minute of the same shared 10,000.
//
// Server-only. `getCloudflareContext` throws in the browser, which is the guard rail rather than a
// thing to work around.

import { getCloudflareContext } from '@opennextjs/cloudflare';

import { readChatCompletion, type AIProvider } from './provider';

/** Reading and proposing: measured best of the free open models (header). */
export const TEXT_MODEL = '@cf/openai/gpt-oss-120b';
/** Meaning, for search. A million tokens costs about a tenth of one meeting's transcription. */
export const EMBED_MODEL = '@cf/baai/bge-m3';

/**
 * What a Neuron buys, from Cloudflare's published per-model prices (checked 2026-09-28), kept here
 * so a cost claim in a comment can be checked against a number. The binding also REPORTS the
 * Neurons each call spent, and that reported figure is what the usage ledger records.
 */
export const NEURONS = {
  perDayFree: 10_000,
  whisperPerAudioMinute: 41.14,
  textPerMillionInput: 31_818,
  textPerMillionOutput: 68_182,
  embedPerMillionInput: 1_075,
} as const;

type Binding = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
type Env = { AI?: Binding };

function binding(): Binding | undefined {
  try {
    return (getCloudflareContext().env as Env).AI;
  } catch {
    return undefined;
  }
}

const MISSING = 'Workers AI binding "AI" is missing: declare it in wrangler.jsonc.';

/** The binding, or a clear failure. A missing binding is a deploy problem, never a runtime guess. */
function ai(): Binding {
  const b = binding();
  if (!b) throw new Error(MISSING);
  return b;
}

/**
 * The provider over any binding. `getBinding` is injectable so the live evaluation
 * (lib/ai/meeting-items.live.test.ts) can run the real model through wrangler's platform proxy,
 * where there is no Cloudflare request context.
 */
export function workersAIProvider(
  getBinding: () => Binding | undefined = binding,
  /** The model to run. Overridden ONLY by the model bake-off (lib/ai/bake-off.live.test.ts), which
   *  compares candidates on Zenboard's own tasks; the app always runs TEXT_MODEL. */
  model: string = TEXT_MODEL,
): AIProvider {
  return {
    id: 'workers-ai',
    model,
    available: () => Boolean(getBinding()),
    async complete(req) {
      const run = getBinding();
      if (!run) throw new Error(MISSING);
      const out = await run.run(model, {
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.input },
        ],
        ...(req.format === 'json' && { response_format: { type: 'json_object' } }),
        max_tokens: req.maxTokens,
        // Low: proposals are extraction, not puzzles, and every reasoning token is billed as
        // output and counts against `max_tokens` (see the header for what medium did).
        reasoning_effort: 'low',
        // Near-deterministic. The same transcript should propose the same items twice.
        temperature: 0.2,
      });
      return readChatCompletion(out);
    },
  };
}

export const workersAI = workersAIProvider();

/** One vector per string, for search. Batched because the cost is per token, not per call. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out = (await ai().run(EMBED_MODEL, { text: texts })) as { data?: number[][] };
  return out?.data ?? [];
}
