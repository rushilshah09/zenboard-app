// ── THE PROVIDER: GOOGLE GEMINI (free tier) ─────────────────────────────────
//
// USER DIRECTIVE 2026-09-29: "we have to use gemini its best and free now", reaffirmed after the
// objection below was put to them. It is recorded here rather than argued again, because the
// tradeoff is real and whoever reads this file next deserves to know it was chosen, not missed.
//
// WHAT WAS TRADED. Google's FREE tier uses prompts and responses to improve Google's products,
// including human review; the PAID tier does not. Zenboard's material includes a client's meeting
// transcript. Two things follow, and both are built:
//   · `providersFor` (lib/ai/gateway.ts) decides whether the features that carry a client's own
//     words may use this provider at all. It is OFF by default — meeting transcripts stay on
//     Workers AI, where the request never leaves the network the app runs on — and one environment
//     variable turns it on (`AI_SHARE_CLIENT_WORDS=1`; `GEMINI_SENSITIVE=1`, its first name, too).
//   · Moving to Gemini's paid tier removes the trade entirely and needs no code change here.
//
// It is also CLOSED-WEIGHT, which is why lib/ai/open-models.test.ts treats it separately: the
// standing "open source free models" rule still governs every model Zenboard can RUN, and Gemini is
// a hosted API that Zenboard can only CALL.
//
// The transport is Google's OpenAI-compatible endpoint, so `readChatCompletion` reads it unchanged
// and this provider is the same shape as Groq's. The free tier is roughly 10 requests a minute and
// 500 a day per key (checked 2026-09-29), which is the same order as Workers AI's free pool — so
// this is a peer of the primary, not a replacement for the chain.

import { readChatCompletion, type AIProvider } from './provider';

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/**
 * The free-tier flagship. Pro moved behind billing in May 2026, so a Flash model is the whole free
 * tier; `GEMINI_MODEL` overrides it without a deploy, which is how a newer Flash is adopted.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash';

/** Slower than this and the person has given up waiting; the gateway moves on. */
const TIMEOUT_MS = 20_000;

/** A key as the environment holds it, trimmed: a pasted key with a stray space fails every call. */
const key = () => (process.env.GEMINI_API_KEY ?? '').trim();

/** Gemini serving one model: the app runs `gemini`; the bake-off builds one per candidate. */
export function geminiProvider(model: string = GEMINI_MODEL): AIProvider {
  return {
    id: 'gemini',
    model,
    available: () => Boolean(key()),
    async complete(req) {
      const k = key();
      if (!k) throw new Error('GEMINI_API_KEY is not set.');
      const res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.input },
          ],
          ...(req.format === 'json' && { response_format: { type: 'json_object' } }),
          max_tokens: req.maxTokens,
          // Gemini 3 thinks by default, and its thinking counts against `max_tokens`: measured
          // 2026-09-29, a 200-token ceiling came back as "Here is the JSON requested:" and nothing
          // else. Low, like every other provider here.
          reasoning_effort: 'low',
          // The same settings as the other providers, so which one answered is not felt.
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The status only. A provider's error body can echo the request, and the request is a person's
      // working notes.
      if (!res.ok) throw new Error(`Gemini answered ${res.status}.`);
      return readChatCompletion(await res.json());
    },
  };
}

export const gemini = geminiProvider();
