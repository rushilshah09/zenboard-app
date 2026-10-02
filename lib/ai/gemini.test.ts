import { afterEach, describe, expect, it, vi } from 'vitest';

import { GEMINI_ENDPOINT, gemini } from './gemini';
import { TRAINS_ON_INPUT, chainFor, clientWordsMayTrain, providersFor } from './gateway';
import type { AIProvider } from './provider';
import { CLIENT_WORDS } from './usage';

// Gemini cannot be reached from a test, so what is checked is what would be SENT, what is never
// sent back out, and — the part that matters — WHOSE material is allowed to reach it at all.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const fake = (id: AIProvider['id']): AIProvider =>
  ({ id, model: id, available: () => true, complete: async () => { throw new Error('no'); } });

describe('the Gemini provider', () => {
  it('exists only when its key does', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(gemini.available()).toBe(false);
    vi.stubEnv('GEMINI_API_KEY', 'AIza-test');
    expect(gemini.available()).toBe(true);
  });

  it('speaks the OpenAI shape, so one reader serves every provider', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'AIza-test');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"draft":"ok"}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    })));
    vi.stubGlobal('fetch', fetchMock);

    const out = await gemini.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 200 });
    expect(out.text).toBe('{"draft":"ok"}');
    expect(out.finish).toBe('stop');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GEMINI_ENDPOINT);
    const body = JSON.parse(String(init.body));
    expect(body.messages).toEqual([{ role: 'system', content: 'S' }, { role: 'user', content: 'I' }]);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBe(0.2);
  });

  it('never repeats the request back out through an error', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'AIza-test');
    vi.stubGlobal('fetch', async () => new Response('the transcript you sent was: Priya said…', { status: 400 }));
    await expect(gemini.complete({ system: 'S', input: 'secret', format: 'json', maxTokens: 10 }))
      .rejects.toThrow('Gemini answered 400.');
  });

  it('sends the key in a header, never in the URL', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'AIza-secret');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] })));
    vi.stubGlobal('fetch', fetchMock);
    await gemini.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 10 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('AIza-secret');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer AIza-secret');
  });
});

// ── THE PART THE USER DECIDED, AND THE PART THAT PROTECTS SOMEBODY ELSE ─────
describe('whose words may reach a provider that trains on them', () => {
  const all = [fake('nvidia'), fake('gemini'), fake('workers-ai'), fake('groq')];

  it('names a meeting transcript, and its audio, as somebody else’s words', () => {
    expect(CLIENT_WORDS.has('meeting-items')).toBe(true);
    expect(CLIENT_WORDS.has('transcribe')).toBe(true);
    // The person's own thoughts and their own week are theirs to send.
    expect(CLIENT_WORDS.has('inbox-file')).toBe(false);
    expect(CLIENT_WORDS.has('draft')).toBe(false);
  });

  it('keeps every host that trains away from a client’s transcript unless the account holder opts in', () => {
    vi.stubEnv('AI_SHARE_CLIENT_WORDS', '');
    vi.stubEnv('GEMINI_SENSITIVE', '');
    expect(clientWordsMayTrain()).toBe(false);
    expect(providersFor('meeting-items', all).map((p) => p.id)).toEqual(['workers-ai', 'groq']);

    vi.stubEnv('AI_SHARE_CLIENT_WORDS', '1');
    expect(clientWordsMayTrain()).toBe(true);
    expect(providersFor('meeting-items', all).map((p) => p.id)).toEqual(['nvidia', 'gemini', 'workers-ai', 'groq']);
  });

  it('still honours the switch’s first name', () => {
    vi.stubEnv('AI_SHARE_CLIENT_WORDS', '');
    vi.stubEnv('GEMINI_SENSITIVE', '1');
    expect(providersFor('meeting-items', all).map((p) => p.id)).toEqual(['nvidia', 'gemini', 'workers-ai', 'groq']);
  });

  it('names exactly the hosts whose free terms say they train', () => {
    expect([...TRAINS_ON_INPUT].sort()).toEqual(['gemini', 'nvidia']);
  });

  it('lets the person’s own material go wherever the chain says', () => {
    vi.stubEnv('AI_SHARE_CLIENT_WORDS', '');
    vi.stubEnv('GEMINI_SENSITIVE', '');
    for (const f of ['inbox-file', 'draft'] as const) {
      expect(providersFor(f, all).map((p) => p.id), f).toEqual(['nvidia', 'gemini', 'workers-ai', 'groq']);
    }
  });

  it('still has a provider for a transcript when only training hosts have keys', () => {
    // Workers AI needs no key, so removing the trainers can never leave the feature with nothing.
    vi.stubEnv('AI_SHARE_CLIENT_WORDS', '');
    vi.stubEnv('GEMINI_SENSITIVE', '');
    expect(providersFor('meeting-items', all).length).toBeGreaterThan(0);
  });

  it('leaves the pool guard alone: it is about Workers AI’s free Neurons, not about privacy', () => {
    const past = chainFor(all, 9_500);
    expect(past.map((p) => p.id)).toEqual(['nvidia', 'gemini', 'groq']);
  });
});
