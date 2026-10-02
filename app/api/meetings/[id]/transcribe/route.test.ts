import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calls, fakeDb, type Query } from '@/test/fake-db';

// The door every piece of a recorded meeting comes through. What is guarded here is the ORDER of
// refusals — nothing is transcribed, and no allowance spent, for a request that should never have
// got that far — and that a caller only ever reaches their own meeting.

const state: {
  session: 'ok' | 'none';
  meeting: { id: string; title: string; client_id: string | null } | null;
  transcribeCalls: unknown[];
  result: unknown;
  queries: Query[];
} = { session: 'ok', meeting: null, transcribeCalls: [], result: null, queries: [] };

vi.mock('@/lib/auth', () => ({
  requireSession: async () => {
    if (state.session === 'none') throw new Error('Not authenticated');
    const { db, queries } = fakeDb((q) => {
      if (q.table === 'meetings') return { data: state.meeting };
      if (q.table === 'clients') return { data: { name: 'Meridian Studio' } };
      if (q.table === 'projects') return { data: [{ name: 'Brand refresh' }] };
      return { data: null };
    });
    state.queries = queries;
    return { supabase: db, user: { id: 'u1' } };
  },
}));
vi.mock('@/lib/user-tz', () => ({ userTimezone: async () => 'Asia/Kolkata' }));
vi.mock('@/lib/ai/transcribe', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/transcribe')>()),
  transcribe: async (req: unknown) => { state.transcribeCalls.push(req); return state.result; },
}));

const { POST } = await import('./route');

const HOST = 'https://zenboard.test';
const params = (id = 'm1') => ({ params: Promise.resolve({ id }) });
function req(opts: { origin?: string | null; type?: string; seconds?: string; body?: Uint8Array<ArrayBuffer>; language?: string } = {}) {
  const headers: Record<string, string> = {
    'content-type': opts.type ?? 'audio/webm;codecs=opus',
    'x-audio-seconds': opts.seconds ?? '12.5',
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? HOST;
  if (opts.language) headers['x-language'] = opts.language;
  return new Request(`${HOST}/api/meetings/m1/transcribe`, { method: 'POST', headers, body: opts.body ?? new Uint8Array(4096) });
}

beforeEach(() => {
  state.session = 'ok';
  state.meeting = { id: 'm1', title: 'Brand refresh kickoff', client_id: 'c1' };
  state.transcribeCalls = [];
  state.result = { ok: true, provider: 'groq', data: { segments: [{ start: 0, end: 2, text: 'Hello.', words: [{ word: 'Hello.', start: 0, end: 1 }] }], language: 'en', duration: 2 } };
});

const reason = async (r: Response) => ((await r.json()) as { reason?: string }).reason;

describe('who may send audio', () => {
  it('refuses another site’s page, before it even asks who is calling', async () => {
    state.session = 'none';
    const res = await POST(req({ origin: 'https://evil.example' }), params());
    expect(res.status).toBe(403);
    expect(await reason(res)).toBe('forbidden');
  });

  it('refuses a signed-out caller', async () => {
    state.session = 'none';
    const res = await POST(req(), params());
    expect(res.status).toBe(401);
    expect(state.transcribeCalls).toEqual([]);
  });

  it('only reaches the caller’s own meeting — RLS decides, and an unknown one is 404', async () => {
    state.meeting = null;
    const res = await POST(req(), params('someone-elses'));
    expect(res.status).toBe(404);
    expect(state.transcribeCalls).toEqual([]);
    expect(calls(state.queries.find((q) => q.table === 'meetings')!, 'eq')).toEqual([['id', 'someone-elses']]);
  });
});

describe('what counts as a piece of a meeting', () => {
  it('refuses a container no browser records in', async () => {
    const res = await POST(req({ type: 'application/pdf' }), params());
    expect(res.status).toBe(415);
  });

  it('refuses a piece that claims to be too long, or empty', async () => {
    expect((await POST(req({ seconds: '600' }), params())).status).toBe(413);
    expect((await POST(req({ seconds: '0' }), params())).status).toBe(400);
    expect((await POST(req({ body: new Uint8Array(10) }), params())).status).toBe(400);
    expect((await POST(req({ body: new Uint8Array(5 * 1024 * 1024) }), params())).status).toBe(413);
    expect(state.transcribeCalls).toEqual([]);
  });
});

describe('a piece that gets through', () => {
  it('is transcribed with the meeting’s names as vocabulary, in the caller’s day and allowance', async () => {
    const res = await POST(req({ language: 'en' }), params());
    expect(res.status).toBe(200);
    const [sent] = state.transcribeCalls as { mime: string; seconds: number; language?: string; vocabulary?: string; userId: string; timeZone: string }[];
    expect(sent).toMatchObject({
      mime: 'audio/webm', seconds: 12.5, language: 'en', userId: 'u1', timeZone: 'Asia/Kolkata',
      vocabulary: 'Brand refresh kickoff with Meridian Studio about Brand refresh.',
    });
  });

  it('answers with segments and nothing more — the words, not the audio or the word timings', async () => {
    const body = await (await POST(req(), params())).json();
    expect(body).toEqual({ segments: [{ start: 0, end: 2, text: 'Hello.' }], language: 'en', duration: 2 });
  });

  it('ignores a language header that is not a language code', async () => {
    await POST(req({ language: 'en; drop table' }), params());
    expect((state.transcribeCalls[0] as { language?: string }).language).toBeUndefined();
  });

  it('says why when the transcriber cannot: a limit is 429, a busy host 503', async () => {
    state.result = { ok: false, reason: 'limit' };
    const limited = await POST(req(), params());
    expect(limited.status).toBe(429);
    expect(await reason(limited)).toBe('limit');
    state.result = { ok: false, reason: 'unavailable' };
    expect((await POST(req(), params())).status).toBe(503);
  });
});
