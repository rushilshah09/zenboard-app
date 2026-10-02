import { afterEach, describe, expect, it, vi } from 'vitest';

import { GROQ_ENDPOINT, GROQ_MODEL, groq } from './groq';

// Groq cannot be reached from a test and there is no key in development, so what is checked is
// what would be SENT: the same model and settings as Workers AI, which is the whole point of it
// being the fallback, and nothing of the request leaking back out through an error.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the Groq provider', () => {
  it('exists only when its key does', () => {
    vi.stubEnv('GROQ_API_KEY', '');
    expect(groq.available()).toBe(false);
    vi.stubEnv('GROQ_API_KEY', 'gsk_test');
    expect(groq.available()).toBe(true);
  });

  it('sends the same model and settings as the primary', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_test');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"actions":[]}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    })));
    vi.stubGlobal('fetch', fetchMock);

    const res = await groq.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 700 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_ENDPOINT);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer gsk_test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'I' }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 700,
      reasoning_effort: 'low',
    });
    expect(GROQ_MODEL).toBe('openai/gpt-oss-120b');
    expect(res.text).toBe('{"actions":[]}');
    expect(res.usage.neurons).toBeNull();
  });

  it('fails with the status only, never the body', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"echo of the client meeting"}', { status: 429 })));
    const err = await groq.complete({ system: 'S', input: 'secret', format: 'json', maxTokens: 1 }).catch((e: Error) => e.message);
    expect(err).toBe('Groq answered 429.');
  });

  it('refuses to call without a key', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    await expect(groq.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 1 })).rejects.toThrow(/not set/);
  });
});
