import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GROQ_TRANSCRIBE_ENDPOINT, WHISPER_MODEL, groqWhisper, languageCode, readTranscription,
  transcribe, workersWhisper, type Transcriber, type TranscribeRequest,
} from './transcribe';
import { DAILY_AUDIO_SECONDS, type UsageLedger, type UsageRecord } from './usage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Workers AI's answer for the 13.8 s test conversation, as measured on the account 2026-09-29. */
const MEASURED = {
  transcription_info: { language: 'en', language_probability: 1, duration: 13.8061875, duration_after_vad: 13.8061875 },
  text: 'Thanks for jumping on. We loved the moodboard. …',
  word_count: 38,
  segments: [
    { start: 0, end: 4.28, text: ' Thanks for jumping on. We loved the moodboard. But the green feels too corporate.', words: [{ word: ' Thanks', start: 0, end: 0.3 }, { word: ' for', start: 0.3, end: 0.5 }] },
    { start: 4.28, end: 9.6, text: ' Got it. I will send two alternative palettes by Thursday.' },
    { start: 9.6, end: 13.8, text: '   ' },
  ],
  usage: { neurons: 10.729763415183225 },
};

describe('reading a transcriber’s answer', () => {
  it('reads the measured Workers AI shape: text trimmed, empty stretches dropped, words kept', () => {
    const t = readTranscription(MEASURED)!;
    expect(t.language).toBe('en');
    expect(t.duration).toBeCloseTo(13.806, 2);
    expect(t.segments.map((s) => s.text)).toEqual([
      'Thanks for jumping on. We loved the moodboard. But the green feels too corporate.',
      'Got it. I will send two alternative palettes by Thursday.',
    ]);
    expect(t.segments[0].words[0]).toEqual({ word: 'Thanks', start: 0, end: 0.3 });
    expect(t.segments[1].words).toEqual([]);
  });

  it('reads Groq’s verbose_json, re-homing its top-level words into their stretches', () => {
    const t = readTranscription({
      language: 'english', duration: 6,
      segments: [{ start: 0, end: 2.5, text: 'Hello there.' }, { start: 3, end: 6, text: 'Send the quote.' }],
      words: [{ word: 'Hello', start: 0, end: 0.4 }, { word: 'there.', start: 0.4, end: 1 }, { word: 'Send', start: 3.1, end: 3.4 }],
    })!;
    expect(t.language).toBe('en');
    expect(t.segments[0].words.map((w) => w.word)).toEqual(['Hello', 'there.']);
    expect(t.segments[1].words.map((w) => w.word)).toEqual(['Send']);
  });

  it('refuses anything that is not a transcript, rather than showing half of one', () => {
    expect(readTranscription(null)).toBeNull();
    expect(readTranscription({ segments: 'text' })).toBeNull();
    expect(readTranscription({ segments: [{ start: -1, end: 2, text: 'x' }] })).toBeNull();
    expect(readTranscription({ segments: [{ start: 'a', end: 2, text: 'x' }] })).toBeNull();
    expect(readTranscription({})).toEqual({ segments: [], language: null, duration: 0 });
  });

  it('names languages by code whichever way the host spells them', () => {
    expect(languageCode('en')).toBe('en');
    expect(languageCode('Hindi')).toBe('hi');
    expect(languageCode('klingon')).toBeNull();
    expect(languageCode(undefined)).toBeNull();
  });
});

describe('the hosts', () => {
  it('sends Workers AI the audio as base64 with the vocabulary and the silence filter', async () => {
    const sent: Record<string, unknown>[] = [];
    const w = workersWhisper(() => ({ run: async (model, input) => { expect(model).toBe(WHISPER_MODEL); sent.push(input); return MEASURED; } }));
    const out = await w.transcribe({ audio: new Uint8Array([1, 2, 3]), mime: 'audio/webm;codecs=opus', vocabulary: 'Kickoff with Meridian.', language: 'en' });
    expect(sent[0]).toEqual({ audio: 'AQID', language: 'en', initial_prompt: 'Kickoff with Meridian.', vad_filter: true });
    expect(out.neurons).toBeCloseTo(10.73, 2);
  });

  it('sends Groq a file with segment and word timings, and fails with the status only', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_test');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ segments: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await groqWhisper.transcribe({ audio: new Uint8Array([1]), mime: 'audio/webm;codecs=opus', vocabulary: 'Meridian.' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_TRANSCRIBE_ENDPOINT);
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect(form.getAll('timestamp_granularities[]')).toEqual(['segment', 'word']);
    expect(form.get('prompt')).toBe('Meridian.');
    expect((form.get('file') as File).name).toBe('chunk.webm');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('echo of a client speaking', { status: 500 })));
    await expect(groqWhisper.transcribe({ audio: new Uint8Array([1]), mime: 'audio/webm' })).rejects.toThrow('Groq answered 500.');
  });
});

// ── The chain ────────────────────────────────────────────────────────────────

function fake(id: 'workers-ai' | 'groq', reply: () => Promise<{ raw: unknown; neurons: number | null }>, available = true) {
  const calls: number[] = [];
  const t: Transcriber = { id, model: `${id}-whisper`, available: () => available, transcribe: async () => { calls.push(1); return reply(); } };
  return Object.assign(t, { calls });
}

function ledger(opts: { audio?: number | null; pool?: number | null } = {}) {
  const rows: UsageRecord[] = [];
  const l: UsageLedger = {
    usedToday: async () => 0,
    audioToday: async () => (opts.audio === undefined ? 0 : opts.audio),
    poolToday: async () => (opts.pool === undefined ? 0 : opts.pool),
    record: async (r) => { rows.push(r); },
  };
  return Object.assign(l, { rows });
}

const REQ: TranscribeRequest = { audio: new Uint8Array([1]), mime: 'audio/webm', seconds: 12, userId: 'u1', timeZone: 'Asia/Kolkata' };

describe('transcribing a piece of a meeting', () => {
  it('answers with the first host that transcribes, and records the audio it spent', async () => {
    const l = ledger();
    const res = await transcribe(REQ, { transcribers: [fake('workers-ai', async () => ({ raw: MEASURED, neurons: 10.73 }))], ledger: l });
    expect(res.ok && res.provider).toBe('workers-ai');
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0]).toMatchObject({ feature: 'transcribe', ok: true, audioSeconds: expect.closeTo(13.806, 2) });
    expect(l.rows[0].usage.neurons).toBeCloseTo(10.73, 2);
  });

  it('falls through to Groq when Workers AI throws or answers nonsense', async () => {
    for (const bad of [async () => { throw new Error('3036'); }, async () => ({ raw: { segments: 'x' }, neurons: 1 })]) {
      const l = ledger();
      const res = await transcribe(REQ, {
        transcribers: [fake('workers-ai', bad), fake('groq', async () => ({ raw: { segments: [{ start: 0, end: 1, text: 'hi' }] }, neurons: null }))],
        ledger: l,
      });
      expect(res.ok && res.provider).toBe('groq');
      expect(l.rows.map((r) => [r.provider, r.ok])).toEqual([['workers-ai', false], ['groq', true]]);
    }
  });

  it('counts a Workers AI call it got no bill for at the published rate, so the guard never undercounts', async () => {
    const l = ledger();
    await transcribe({ ...REQ, seconds: 60 }, { transcribers: [fake('workers-ai', async () => ({ raw: { segments: [], duration: 60 }, neurons: null }))], ledger: l });
    expect(l.rows[0].usage.neurons).toBeCloseTo(46.63, 2);
  });

  it('refuses past the day’s audio, before spending anything', async () => {
    const w = fake('workers-ai', async () => ({ raw: MEASURED, neurons: 10 }));
    const res = await transcribe(REQ, { transcribers: [w], ledger: ledger({ audio: DAILY_AUDIO_SECONDS - 5 }) });
    expect(res).toEqual({ ok: false, reason: 'limit' });
    expect(w.calls).toEqual([]);
  });

  it('treats an untracked ledger as no limit', async () => {
    const res = await transcribe(REQ, { transcribers: [fake('workers-ai', async () => ({ raw: MEASURED, neurons: 10 }))], ledger: ledger({ audio: null, pool: null }) });
    expect(res.ok).toBe(true);
  });

  it('leaves the shared pool alone past its ceiling, and says unavailable when nothing else can answer', async () => {
    const w = fake('workers-ai', async () => ({ raw: MEASURED, neurons: 10 }));
    expect(await transcribe(REQ, { transcribers: [w], ledger: ledger({ pool: 9_900 }) })).toEqual({ ok: false, reason: 'unavailable' });
    expect(w.calls).toEqual([]);
    const g = fake('groq', async () => ({ raw: MEASURED, neurons: null }));
    const res = await transcribe(REQ, { transcribers: [fake('workers-ai', async () => ({ raw: MEASURED, neurons: 1 })), g], ledger: ledger({ pool: 9_100 }) });
    expect(res.ok && res.provider).toBe('groq');
  });

  it('says unavailable with no host at all, and invalid when every answer was nonsense', async () => {
    expect(await transcribe(REQ, { transcribers: [fake('groq', async () => ({ raw: MEASURED, neurons: null }), false)], ledger: ledger() }))
      .toEqual({ ok: false, reason: 'unavailable' });
    expect(await transcribe(REQ, { transcribers: [fake('workers-ai', async () => ({ raw: 'x', neurons: 1 }))], ledger: ledger() }))
      .toEqual({ ok: false, reason: 'invalid' });
  });
});
