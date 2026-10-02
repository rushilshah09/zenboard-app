import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { readChatCompletion } from './provider';
import { EMBED_MODEL, NEURONS, TEXT_MODEL, workersAIProvider } from './workers-ai';

// What things cost is arithmetic, so the arithmetic is a test rather than a comment. Transcribing a
// meeting costs several times what reading its transcript does, and in absolute terms the shared
// pool buys only a handful of transcriptions a day — which is why transcription goes to Groq's own
// free quota first (lib/ai/transcribe.ts) and draws on this pool only when Groq cannot answer.
describe('the free-tier budget decides where inference happens', () => {
  const MEETING_MINUTES = 30;
  const MEETING_TOKENS = 5_000;
  const ANSWER_TOKENS = 600;
  const toRead = (MEETING_TOKENS / 1e6) * NEURONS.textPerMillionInput + (ANSWER_TOKENS / 1e6) * NEURONS.textPerMillionOutput;
  const toTranscribe = MEETING_MINUTES * NEURONS.whisperPerAudioMinute;

  it('transcribing a meeting costs several times what reading it costs', () => {
    expect(toTranscribe / toRead).toBeGreaterThan(5);
  });

  it('leaves room for dozens of meetings read a day but only a handful transcribed', () => {
    expect(NEURONS.perDayFree / toRead, 'meetings read a day').toBeGreaterThanOrEqual(40);
    expect(NEURONS.perDayFree / toTranscribe, 'meetings transcribed a day').toBeLessThan(15);
  });

  it('embedding every doc is affordable where transcription is not', () => {
    expect(NEURONS.embedPerMillionInput).toBeLessThan(NEURONS.textPerMillionInput);
  });

  it('keeps audio out of the text provider: transcription has its own chain', () => {
    const src = readFileSync(new URL('./workers-ai.ts', import.meta.url), 'utf8');
    expect(src, 'audio goes through lib/ai/transcribe.ts').not.toMatch(/@cf\/openai\/whisper/);
    expect(TEXT_MODEL).toBe('@cf/openai/gpt-oss-120b');
    expect(EMBED_MODEL).toMatch(/^@cf\//);
  });

  it('declares the binding it depends on', () => {
    const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
    expect(wrangler).toMatch(/"ai":\s*\{\s*\n\s*"binding":\s*"AI"/);
  });
});

describe('the Workers AI provider', () => {
  const OUT = {
    object: 'chat.completion',
    choices: [{ message: { role: 'assistant', content: '{"actions":[]}', reasoning_content: 'thinking…' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 361, completion_tokens: 292, neurons: 14.53 },
  };

  function binding(out: unknown = OUT) {
    const sent: { model: string; input: Record<string, unknown> }[] = [];
    return { sent, run: async (model: string, input: Record<string, unknown>) => { sent.push({ model, input }); return out; } };
  }

  it('asks for low reasoning effort, JSON and the ceiling it was given', async () => {
    // Measured: at the default effort one call spent all 1,500 tokens reasoning and returned
    // nothing after 14 s. Low answered the same transcript in 3.1 s for 14.5 Neurons.
    const b = binding();
    const res = await workersAIProvider(() => b).complete({ system: 'S', input: 'I', format: 'json', maxTokens: 900 });
    expect(b.sent[0].model).toBe(TEXT_MODEL);
    expect(b.sent[0].input).toMatchObject({
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'I' }],
      response_format: { type: 'json_object' },
      max_tokens: 900,
      reasoning_effort: 'low',
    });
    expect(res).toEqual({ text: '{"actions":[]}', finish: 'stop', usage: { inputTokens: 361, outputTokens: 292, neurons: 14.53 } });
  });

  it('asks for no JSON mode when the feature wants text', async () => {
    const b = binding();
    await workersAIProvider(() => b).complete({ system: 'S', input: 'I', format: 'text', maxTokens: 100 });
    expect(b.sent[0].input).not.toHaveProperty('response_format');
  });

  it('is unavailable, and says why, without a binding', async () => {
    const p = workersAIProvider(() => undefined);
    expect(p.available()).toBe(false);
    await expect(p.complete({ system: 'S', input: 'I', format: 'json', maxTokens: 1 })).rejects.toThrow(/binding "AI" is missing/);
  });
});

describe('reading a chat completion', () => {
  it('reads the measured shape, and a cut-off one as length with no text', () => {
    expect(readChatCompletion({ choices: [{ message: { content: null }, finish_reason: 'length' }], usage: { prompt_tokens: 361, completion_tokens: 1500, neurons: 47.47 } }))
      .toEqual({ text: null, finish: 'length', usage: { inputTokens: 361, outputTokens: 1500, neurons: 47.47 } });
  });

  it('reads the older `response` shape, including an object in JSON mode', () => {
    expect(readChatCompletion({ response: '{"a":1}' }).text).toBe('{"a":1}');
    expect(readChatCompletion({ response: { a: 1 } }).text).toBe('{"a":1}');
    expect(readChatCompletion({ response: { a: 1 } }).finish).toBe('stop');
  });

  it('never throws on a shape it does not know', () => {
    for (const odd of [null, undefined, 'text', 42, { choices: 'x' }, { choices: [{}] }, { usage: { prompt_tokens: -3 } }]) {
      const r = readChatCompletion(odd);
      expect(r.text).toBeNull();
      expect(r.usage.inputTokens).toBeGreaterThanOrEqual(0);
    }
    expect(readChatCompletion({ choices: [{ message: { content: '   ' }, finish_reason: 'stop' }] }).text).toBeNull();
  });
});
