// ── THE SECOND PROVIDER: GROQ'S FREE TIER ───────────────────────────────────
//
// FIRST in the chain (measured 2026-09-29: gpt-oss-120b answered in 0.75 s, against 3.8 s on
// Workers AI), and the same open weights as the floor under it, so failing over never changes what
// someone gets back. Its free tier is its own quota, which keeps Workers AI's shared pool in reserve.
//
// It exists only when GROQ_API_KEY does. With no key the gateway simply has one provider, which is
// a correct product, not a broken one. The key is a server secret (Cloudflare dashboard, or
// `.env.local` in development) and is read on each call, never at import, so adding it needs no
// redeploy of this file.
//
// Groq does not use API inputs to train models, which is the bar every provider here has to clear
// (see provider.ts for the one that did not).

import { readChatCompletion, type AIProvider } from './provider';

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'openai/gpt-oss-120b';

/** Slower than this and the person has given up waiting; the gateway moves on. */
const TIMEOUT_MS = 20_000;

/** Groq serving one model: the app runs `groq`; the bake-off builds one per candidate. */
export function groqProvider(model: string = GROQ_MODEL): AIProvider {
  return {
    id: 'groq',
    model,
    available: () => Boolean((process.env.GROQ_API_KEY ?? '').trim()),
    async complete(req) {
      const key = (process.env.GROQ_API_KEY ?? '').trim();
      if (!key) throw new Error('GROQ_API_KEY is not set.');
      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.input },
          ],
          ...(req.format === 'json' && { response_format: { type: 'json_object' } }),
          max_completion_tokens: req.maxTokens,
          // The same settings as Workers AI, so the fallback behaves like the primary.
          reasoning_effort: 'low',
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The status only. A provider's error body can echo the request, and the request is a client's
      // meeting.
      if (!res.ok) throw new Error(`Groq answered ${res.status}.`);
      return readChatCompletion(await res.json());
    },
  };
}

export const groq = groqProvider();
