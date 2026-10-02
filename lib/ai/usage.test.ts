import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calls, fakeDb, type Query } from '@/test/fake-db';

// The ledger talks to the database through the service role. Replace that client with a recording
// fake: what matters is which rows were ASKED for (whose, since when) and that a failure anywhere
// reads as "not tracked" rather than as a wall.
const state: {
  respond: (q: Query) => unknown;
  rpc: (fn: string, args: Record<string, unknown>) => unknown;
  queries: Query[];
  rpcCalls: [string, Record<string, unknown>][];
} = { respond: () => ({ data: [] }), rpc: () => ({ data: 0, error: null }), queries: [], rpcCalls: [] };

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => {
    const { db, queries } = fakeDb((q) => state.respond(q) as never);
    state.queries = queries;
    return {
      from: (db as { from: (t: string) => unknown }).from,
      rpc: async (fn: string, args: Record<string, unknown>) => { state.rpcCalls.push([fn, args]); return state.rpc(fn, args); },
    };
  },
}));

const { ledger, utcDayStart } = await import('./usage');

beforeEach(() => {
  state.respond = () => ({ data: [] });
  state.rpc = () => ({ data: 0, error: null });
  state.rpcCalls = [];
});

describe('the allowance counts one person’s successful acts in their own day', () => {
  it('asks for this person, successes only, since the start of THEIR day', async () => {
    state.respond = () => ({ data: null, count: 7, error: null });
    expect(await ledger.usedToday('u1', 'Asia/Kolkata')).toBe(7);
    const q = state.queries[0];
    expect(q.table).toBe('ai_usage');
    expect(calls(q, 'eq')).toEqual([['user_id', 'u1'], ['ok', true]]);
    const [[col, since]] = calls(q, 'gte') as [string, string][];
    expect(col).toBe('created_at');
    // Midnight in Kolkata is 18:30 UTC the day before: a UTC midnight here would be the bug.
    expect(since).toMatch(/T18:30:00(\.000)?Z$/);
  });

  it('reads a failed query (no migration yet) as not tracked', async () => {
    state.respond = () => ({ data: null, count: null, error: { message: 'relation "ai_usage" does not exist' } });
    expect(await ledger.usedToday('u1', 'UTC')).toBeNull();
  });
});

describe('the pool guard reads everyone’s Workers AI spend since midnight UTC', () => {
  it('asks the service-role function, from midnight UTC', async () => {
    state.rpc = () => ({ data: '4321.5', error: null });
    expect(await ledger.poolToday()).toBe(4321.5);
    expect(state.rpcCalls).toEqual([['ai_pool_neurons', { since: utcDayStart() }]]);
  });

  it('is not tracked when the function is missing or says something odd', async () => {
    state.rpc = () => ({ data: null, error: { message: 'Could not find the function' } });
    expect(await ledger.poolToday()).toBeNull();
    state.rpc = () => ({ data: 'lots', error: null });
    expect(await ledger.poolToday()).toBeNull();
  });

  it('starts the day where Cloudflare does', () => {
    expect(utcDayStart(new Date('2026-09-28T03:04:05+05:30'))).toBe('2026-09-27T00:00:00.000Z');
    expect(utcDayStart(new Date('2026-09-28T23:59:59Z'))).toBe('2026-09-28T00:00:00.000Z');
  });
});

describe('recording', () => {
  it('writes one row with whole token counts and the reported Neurons', async () => {
    await ledger.record({
      userId: 'u1', feature: 'meeting-items', provider: 'workers-ai', model: '@cf/openai/gpt-oss-20b', ok: true,
      usage: { inputTokens: 361.2, outputTokens: 292, neurons: 14.53 },
    });
    const [[row]] = calls(state.queries[0], 'insert') as [Record<string, unknown>][];
    expect(row).toEqual({
      user_id: 'u1', feature: 'meeting-items', provider: 'workers-ai', model: '@cf/openai/gpt-oss-20b',
      ok: true, input_tokens: 361, output_tokens: 292, neurons: 14.53,
    });
  });

  it('records a host that reports no bill as zero Neurons', async () => {
    await ledger.record({ userId: 'u1', feature: 'meeting-items', provider: 'groq', model: 'm', ok: false, usage: { inputTokens: 0, outputTokens: 0, neurons: null } });
    const [[row]] = calls(state.queries[0], 'insert') as [Record<string, unknown>][];
    expect(row.neurons).toBe(0);
  });

  it('never throws, because the ledger must not fail the act it describes', async () => {
    state.respond = () => { throw new Error('connection reset'); };
    await expect(ledger.record({ userId: 'u1', feature: 'meeting-items', provider: 'groq', model: 'm', ok: true, usage: { inputTokens: 1, outputTokens: 1, neurons: null } })).resolves.toBeUndefined();
  });
});
