import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { POOL_CEILING_NEURONS, chainFor, firstObject, generateJSON, parseJSONObject, type GatewayDeps } from './gateway';
import type { AICompletion, AIProvider, AIProviderId } from './provider';
import { DAILY_ALLOWANCE, POOL_GUARD_NEURONS, type UsageLedger, type UsageRecord } from './usage';

const schema = z.object({ items: z.array(z.string()) });

const answer = (text: string | null, finish: AICompletion['finish'] = 'stop'): AICompletion => ({
  text, finish, usage: { inputTokens: 100, outputTokens: 20, neurons: 2.5 },
});

/** A provider that answers from a script, and remembers that it was asked. */
function fake(id: AIProviderId, reply: () => Promise<AICompletion>, available = true) {
  const calls: string[] = [];
  const p: AIProvider = {
    id, model: `${id}-model`, available: () => available,
    complete: async (req) => { calls.push(req.input); return reply(); },
  };
  return Object.assign(p, { calls });
}

function ledger(opts: { used?: number | null; pool?: number | null } = {}) {
  const rows: UsageRecord[] = [];
  const l: UsageLedger = {
    usedToday: async () => (opts.used === undefined ? 0 : opts.used),
    audioToday: async () => 0,
    poolToday: async () => (opts.pool === undefined ? 0 : opts.pool),
    record: async (r) => { rows.push(r); },
  };
  return Object.assign(l, { rows });
}

const REQ = { feature: 'meeting-items' as const, system: 'sys', input: 'the transcript', schema, maxTokens: 500, userId: 'u1', timeZone: 'Asia/Kolkata' };
const deps = (providers: AIProvider[], l: UsageLedger, timeoutMs = 1_000): GatewayDeps => ({ providers, ledger: l, timeoutMs });

describe('the gateway answers with validated data or a reason, never a raw string', () => {
  it('returns the first provider’s answer when it passes the schema', async () => {
    const w = fake('workers-ai', async () => answer('{"items":["a"]}'));
    const g = fake('groq', async () => answer('{"items":["b"]}'));
    const l = ledger();
    const res = await generateJSON(REQ, deps([w, g], l));
    expect(res).toEqual({ ok: true, data: { items: ['a'] }, provider: 'workers-ai' });
    expect(g.calls).toEqual([]);
    expect(l.rows).toEqual([{ userId: 'u1', feature: 'meeting-items', provider: 'workers-ai', model: 'workers-ai-model', ok: true, usage: answer('').usage }]);
  });

  it('falls through a thrown call, an empty answer, bad JSON and a schema miss', async () => {
    for (const bad of [
      async () => { throw new Error('429'); },
      async () => answer(null),
      async () => answer('not json at all'),
      async () => answer('{"items":"one"}'),
    ]) {
      const l = ledger();
      const res = await generateJSON(REQ, deps([fake('workers-ai', bad), fake('groq', async () => answer('{"items":[]}'))], l));
      expect(res).toEqual({ ok: true, data: { items: [] }, provider: 'groq' });
      expect(l.rows.map((r) => [r.provider, r.ok])).toEqual([['workers-ai', false], ['groq', true]]);
    }
  });

  it('never trusts a truncated answer, even one that happens to parse', async () => {
    const l = ledger();
    const res = await generateJSON(REQ, deps([fake('workers-ai', async () => answer('{"items":[]}', 'length'))], l));
    expect(res).toEqual({ ok: false, reason: 'invalid' });
  });

  it('says unavailable when nobody answered and invalid when answers were unusable', async () => {
    const down = fake('workers-ai', async () => { throw new Error('down'); });
    expect(await generateJSON(REQ, deps([down], ledger()))).toEqual({ ok: false, reason: 'unavailable' });
    const garbled = fake('workers-ai', async () => answer('{'));
    expect(await generateJSON(REQ, deps([garbled], ledger()))).toEqual({ ok: false, reason: 'invalid' });
    expect(await generateJSON(REQ, deps([fake('groq', async () => answer('{}'), false)], ledger()))).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('gives up on a provider that does not answer in time', async () => {
    const slow = fake('workers-ai', () => new Promise(() => {}));
    const res = await generateJSON(REQ, deps([slow, fake('groq', async () => answer('{"items":["late"]}'))], ledger(), 20));
    expect(res).toEqual({ ok: true, data: { items: ['late'] }, provider: 'groq' });
  });

  it('records every attempt, including the ones that failed, so the ledger is the bill', async () => {
    const l = ledger();
    await generateJSON(REQ, deps([fake('workers-ai', async () => answer('nope')), fake('groq', async () => answer('nope'))], l));
    expect(l.rows).toHaveLength(2);
    expect(l.rows.every((r) => !r.ok)).toBe(true);
  });
});

describe('the allowance and the shared pool', () => {
  it('refuses past today’s allowance without calling anyone', async () => {
    const w = fake('workers-ai', async () => answer('{"items":[]}'));
    const res = await generateJSON(REQ, deps([w], ledger({ used: DAILY_ALLOWANCE })));
    expect(res).toEqual({ ok: false, reason: 'limit' });
    expect(w.calls).toEqual([]);
  });

  it('treats an untracked ledger (no migration yet) as no limit, not as a wall', async () => {
    const res = await generateJSON(REQ, deps([fake('workers-ai', async () => answer('{"items":[]}'))], ledger({ used: null, pool: null })));
    expect(res.ok).toBe(true);
  });

  it('steps Workers AI aside past the guard when there is a fallback', () => {
    const w = fake('workers-ai', async () => answer(''));
    const g = fake('groq', async () => answer(''));
    expect(chainFor([w, g], 0).map((p) => p.id)).toEqual(['workers-ai', 'groq']);
    expect(chainFor([w, g], POOL_GUARD_NEURONS).map((p) => p.id)).toEqual(['groq']);
    // With no fallback, the rest of the FREE allocation is still spent…
    expect(chainFor([w], POOL_GUARD_NEURONS).map((p) => p.id)).toEqual(['workers-ai']);
    // …but never past the ceiling, where the next Neuron may be billed.
    expect(chainFor([w], POOL_CEILING_NEURONS)).toEqual([]);
    expect(chainFor([w, g], null).map((p) => p.id)).toEqual(['workers-ai', 'groq']);
  });

  it('keeps the guard and the ceiling inside the free 10,000', () => {
    expect(POOL_GUARD_NEURONS).toBeLessThan(POOL_CEILING_NEURONS);
    expect(POOL_CEILING_NEURONS).toBeLessThan(10_000);
  });

  it('reports unavailable, not a limit, when the pool is spent and nothing else can answer', async () => {
    const res = await generateJSON(REQ, deps([fake('workers-ai', async () => answer('{"items":[]}'))], ledger({ pool: POOL_CEILING_NEURONS })));
    expect(res).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('reading JSON out of an answer', () => {
  it('reads bare JSON, a fenced block and JSON inside a sentence', () => {
    expect(parseJSONObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseJSONObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSONObject('Here you go: {"a":1} — hope that helps')).toEqual({ a: 1 });
  });

  it('answers undefined for anything that is not JSON', () => {
    expect(parseJSONObject(null)).toBeUndefined();
    expect(parseJSONObject('')).toBeUndefined();
    expect(parseJSONObject('{"a":')).toBeUndefined();
    expect(parseJSONObject('no braces here')).toBeUndefined();
  });

  // MEASURED ON WORKERS AI, 2026-09-29: about one gpt-oss answer in ten to a long meeting comes
  // back as TWO complete objects, one after the other — `finish` is `stop`, each is valid alone,
  // and the old first-`{`-to-last-`}` span covered both and parsed as nothing. A thirty-second
  // write-up was being thrown away over a second opinion nobody asked for.
  it('keeps the first answer when a model answers twice', () => {
    expect(parseJSONObject('{"summary":"first","mine":[]}\n{"summary":"second","mine":[]}'))
      .toEqual({ summary: 'first', mine: [] });
    expect(parseJSONObject('{"a":1}{"b":2}')).toEqual({ a: 1 });
  });

  it('does not end an object at a brace inside a string', () => {
    // A quote, a decision or a task title may contain a brace; it is text, not structure.
    expect(parseJSONObject('prefix {"text":"a } b","n":1} suffix')).toEqual({ text: 'a } b', n: 1 });
    expect(parseJSONObject('{"text":"she said \\"} \\" and left","n":2}')).toEqual({ text: 'she said "} " and left', n: 2 });
  });

  it('keeps reading nested objects to the right closing brace', () => {
    expect(parseJSONObject('x {"a":{"b":{"c":1}},"d":2} y')).toEqual({ a: { b: { c: 1 } }, d: 2 });
  });

  it('refuses half an object rather than guessing the rest', () => {
    // The gateway already distrusts a truncated answer; half an object is a different answer, not
    // a shorter one.
    expect(firstObject('{"a":1')).toBeNull();
    expect(firstObject('no braces')).toBeNull();
    expect(firstObject('{"a":1}')).toBe('{"a":1}');
  });
});

describe('every AI call goes through the gateway', () => {
  // The plan's rule 3, as structure: a provider imported anywhere else is a model's output that
  // can reach the screen or the database without a validator in between.
  const ROOTS = ['app', 'components', 'lib'];
  const PROVIDER = /from ['"](?:@\/lib\/ai\/|\.\.?\/(?:ai\/)?)(?:workers-ai|groq)['"]/;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (e === 'node_modules' || e.startsWith('.')) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) files.push(full);
    }
  };
  ROOTS.forEach(walk);

  it('imports a provider only inside lib/ai', () => {
    const outside = files.filter((f) => !f.startsWith(join('lib', 'ai')) && PROVIDER.test(readFileSync(f, 'utf8')));
    expect(outside).toEqual([]);
  });
});
