// ── THE PROVIDER: NVIDIA API CATALOG (free trial endpoints) ────────────────
//
// USER DIRECTIVE 2026-09-29, with build.nvidia.com's free endpoints: "all advanced models we can
// use" — and, when the data terms were put to them, "I am okay if they use our data; if we don't
// have money then we have to pay by something."
//
// WHAT NVIDIA'S TERMS SAY (NVIDIA API Trial Terms of Service, read 2026-09-29) — written down so the
// next person knows this was chosen with them in view:
//   · §1.2  access is "for limited trial purposes only and without use of the API Service or
//           Generated Content in production" — internal testing and evaluation, unless a
//           Subscription is bought (NVIDIA AI Enterprise, or a partner's).
//   · §3.3  NVIDIA collects "User Content and Generated Content to improve NVIDIA products and
//           services, including AI models".
//   · §2.6(a), §4.3  no confidential information and no personal data.
// Three consequences, all built:
//   1. It exists only when NVIDIA_API_KEY does. Before Zenboard serves customers, the key comes out
//      (or a Subscription goes in) — no code changes either way, and the chain carries on without it.
//   2. It trains on what it is sent, so the gateway keeps a CLIENT'S OWN WORDS away from it, the same
//      switch as Gemini (`providersFor` in gateway.ts): the account holder may trade their own data,
//      not their clients'.
//   3. It is the first choice when present, because these are the strongest open models Zenboard
//      can reach for free: DeepSeek V4.1 Flash is ExtractBench 87.11 against gpt-oss-20b's absence
//      from that board, and IFStruct-class JSON from a 552B MoE with 8B active (fast).
//
// The transport is NVIDIA's OpenAI-compatible endpoint, so `readChatCompletion` reads it unchanged.

import { readChatCompletion, type AIProvider } from './provider';

export const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * The model, overridable without a deploy (`NVIDIA_MODEL`): any "Free Endpoint" model in the catalog
 * speaks this API — `z-ai/glm-5.3`, `moonshotai/kimi-k3` and the Nemotrons among them.
 */
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash';

/** The free endpoints are shared GPUs; slower than this and the person has stopped waiting. */
const TIMEOUT_MS = 25_000;

/** A key as the environment holds it, trimmed: a pasted key with a stray space fails every call. */
const key = () => (process.env.NVIDIA_API_KEY ?? '').trim();

/**
 * NVIDIA's catalog serving one model. The app runs `nvidia` (NVIDIA_MODEL); the model bake-off
 * (lib/ai/bake-off.live.test.ts) builds one per candidate to compare them on Zenboard's own jobs.
 */
export function nvidiaProvider(model: string = NVIDIA_MODEL): AIProvider {
  return {
    id: 'nvidia',
    model,
    available: () => Boolean(key()),
    async complete(req) {
      const k = key();
      if (!k) throw new Error('NVIDIA_API_KEY is not set.');
      const res = await fetch(NVIDIA_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.input },
          ],
          ...(req.format === 'json' && { response_format: { type: 'json_object' } }),
          max_tokens: req.maxTokens,
          temperature: 0.2,
          stream: false,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The status only: an error body can echo the request.
      if (!res.ok) throw new Error(`NVIDIA answered ${res.status}.`);
      return readChatCompletion(await res.json());
    },
  };
}

export const nvidia = nvidiaProvider();
