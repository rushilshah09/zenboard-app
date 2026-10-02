import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseJSONObject } from './gateway';
import { NVIDIA_ENDPOINT, NVIDIA_MODEL, nvidia } from './nvidia';

// NVIDIA's catalog cannot be reached from a test, and its key is the account holder's to create,
// so what is checked is what would be SENT, and that nothing of the request leaks back out.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the NVIDIA provider', () => {
  it('exists only when its key does', () => {
    vi.stubEnv('NVIDIA_API_KEY', '');
    expect(nvidia.available()).toBe(false);
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    expect(nvidia.available()).toBe(true);
  });

  it('defaults to the strongest fast free model, and says so on the usage row', () => {
    expect(NVIDIA_MODEL).toBe('deepseek-ai/deepseek-v4.1-flash');
    expect(nvidia.model).toBe(NVIDIA_MODEL);
  });

  it('speaks the OpenAI-compatible API the other hosts speak', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"draft":"ok"}', reasoning_content: 'thinking' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 40, completion_tokens: 9 },
    })));
    vi.stubGlobal('fetch', fetchMock);

    const res = await nvidia.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 600 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(NVIDIA_ENDPOINT);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer nvapi-test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: NVIDIA_MODEL,
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'I' }],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      stream: false,
    });
    expect(res.text).toBe('{"draft":"ok"}');
    expect(res.usage).toEqual({ inputTokens: 40, outputTokens: 9, neurons: null });
  });

  it('fails with the status only, never the body', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"echo of a client’s words"}', { status: 429 })));
    const err = await nvidia.complete({ system: 'S', input: 'secret', format: 'json', maxTokens: 1 }).catch((e: Error) => e.message);
    expect(err).toBe('NVIDIA answered 429.');
  });

  it('refuses to call without a key', async () => {
    vi.stubEnv('NVIDIA_API_KEY', '');
    await expect(nvidia.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 1 })).rejects.toThrow(/not set/);
  });
});

describe('a reasoning model that thinks out loud in its answer', () => {
  it('has its thinking set aside before the answer is read', () => {
    expect(parseJSONObject('<think>maybe {"a":0} or not</think>\n{"a":1}')).toEqual({ a: 1 });
    expect(parseJSONObject('<THINK>\n{x}\n</THINK>```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
});
