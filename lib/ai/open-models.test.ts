import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { TRAINS_ON_INPUT, providersFor } from './gateway';
import { GEMINI_ENDPOINT, GEMINI_MODEL } from './gemini';
import { GROQ_ENDPOINT, GROQ_MODEL } from './groq';
import { NVIDIA_ENDPOINT } from './nvidia';
import type { AIProviderId } from './provider';
import { GROQ_TRANSCRIBE_ENDPOINT, GROQ_WHISPER_MODEL, WHISPER_MODEL } from './transcribe';
import { EMBED_MODEL, TEXT_MODEL } from './workers-ai';

// ── WHAT ZENBOARD RUNS, AND WHAT IT MERELY CALLS ────────────────────────────
//
// Two standing rules, and they are not the same rule:
//
//  1. USER DIRECTIVE 2026-09-29: "we only have to use opensource free models". This governs every
//     model Zenboard RUNS — the weights on Workers AI. Each is open-weight under a permissive
//     licence AND on Cloudflare's FREE plan, which is a strict subset of their catalogue: probing
//     the account on 2026-09-29 showed glm-5.2/5.3, deepseek-v4-flash and kimi-k2.6 refused with
//     "not available on the Workers Free plan". A paid model fails loudly; it is never silently
//     billed.
//  2. USER DIRECTIVE 2026-09-29, later the same day: "we have to use gemini its best and free now".
//     Gemini is a hosted API Zenboard CALLS. Its weights are closed, so rule 1 cannot apply to it
//     — which is exactly why it is written down here instead of being waved through: every hosted
//     provider must appear in HOSTS below with its licence status and its data policy, so a fourth
//     one cannot be added without somebody answering both questions.
//
// The names mislead, so they are spelled out once: `@cf/openai/gpt-oss-20b` is NOT the OpenAI API.
// `gpt-oss` is the open-weights model OpenAI published under Apache 2.0, run here on Cloudflare's
// own hardware. There is no OpenAI key in this repository.

/** Weights Zenboard runs itself. Open licence and free plan are both required. */
const RUNS: Record<string, string> = {
  '@cf/openai/gpt-oss-120b': 'Apache-2.0 open weights · Workers AI free plan',
  '@cf/baai/bge-m3': 'MIT · Workers AI free plan',
  // Meeting transcription (MEETINGS_PLAN.md M1) — the same weights Groq serves as the fallback.
  '@cf/openai/whisper-large-v3-turbo': 'MIT open weights · Workers AI free plan',
};

/** APIs Zenboard calls. Each one answers: open weights? free? does it train on what it is sent? */
const HOSTS: Record<AIProviderId, { endpoints: string[]; openWeights: boolean; free: boolean; trainsOnInput: boolean }> = {
  'workers-ai': { endpoints: [], openWeights: true, free: true, trainsOnInput: false },
  groq: { endpoints: [GROQ_ENDPOINT, GROQ_TRANSCRIBE_ENDPOINT], openWeights: true, free: true, trainsOnInput: false },
  // The two that train. Chosen by the user with that stated ("we have to pay by something"); the
  // gateway keeps a client's own words away from both unless the account holder opts in.
  gemini: { endpoints: [GEMINI_ENDPOINT], openWeights: false, free: true, trainsOnInput: true },
  // Open weights, but a TRIAL: NVIDIA's terms forbid production use without a subscription
  // (lib/ai/nvidia.ts). Its key comes out, or a subscription goes in, before customers arrive.
  nvidia: { endpoints: [NVIDIA_ENDPOINT], openWeights: true, free: true, trainsOnInput: true },
};

const files = readdirSync('lib/ai').filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
const source = files.map((f) => readFileSync(`lib/ai/${f}`, 'utf8')).join('\n');
const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('every model Zenboard RUNS is open-weight and on a free plan', () => {
  it('runs nothing outside the declared list', () => {
    for (const [name, id] of Object.entries({ TEXT_MODEL, EMBED_MODEL, WHISPER_MODEL })) {
      expect(RUNS[id], `${name} = ${id} is not declared as open-weight and free`).toBeDefined();
    }
  });

  it('names a permissive licence and the free plan for each', () => {
    for (const reason of Object.values(RUNS)) {
      expect(reason).toMatch(/Apache-2\.0|MIT/);
      expect(reason).toContain('free plan');
    }
  });

  it('runs the same weights on Workers AI and Groq, so failing over changes nothing', () => {
    const bare = (m: string) => m.replace(/^@cf\//, '').replace(/^openai\//, '');
    expect(bare(TEXT_MODEL)).toBe(bare(GROQ_MODEL));
    expect(bare(WHISPER_MODEL)).toBe(bare(GROQ_WHISPER_MODEL));
  });
});

describe('every hosted API is declared, with its tradeoff written down', () => {
  it('reaches only the endpoints of declared hosts', () => {
    const declared = Object.values(HOSTS).flatMap((h) => h.endpoints);
    const urls = [...new Set(code.match(/https?:\/\/[^'"`\s)]+/g) ?? [])];
    expect(urls.sort()).toEqual([...declared].sort());
  });

  it('holds a key only for a host that is declared free', () => {
    const keys = [...new Set(code.match(/process\.env\.[A-Z_]*API_KEY/g) ?? [])].sort();
    expect(keys).toEqual(['process.env.GEMINI_API_KEY', 'process.env.GROQ_API_KEY', 'process.env.NVIDIA_API_KEY']);
    for (const h of Object.values(HOSTS)) expect(h.free).toBe(true);
  });

  it('imports no vendor SDK — every host is plain fetch over an OpenAI-shaped body', () => {
    expect(code).not.toMatch(/@google\/genai|@anthropic-ai|\bfrom 'openai'|@mistralai|cohere-ai|openai-node/);
  });

  it('gates every host that trains on its inputs, and only those', () => {
    // Behaviour, not a pattern in the source: with no opt-in, a client's own words reach no host
    // whose terms say it trains, and everything else still has a way through.
    const trains = (Object.entries(HOSTS) as [AIProviderId, (typeof HOSTS)[AIProviderId]][])
      .filter(([, h]) => h.trainsOnInput).map(([id]) => id).sort();
    expect([...TRAINS_ON_INPUT].sort()).toEqual(trains);
    const prev = { a: process.env.AI_SHARE_CLIENT_WORDS, g: process.env.GEMINI_SENSITIVE };
    delete process.env.AI_SHARE_CLIENT_WORDS;
    delete process.env.GEMINI_SENSITIVE;
    try {
      const all = (Object.keys(HOSTS) as AIProviderId[]).map((id) => ({ id }));
      const kept = providersFor('meeting-items', all).map((p) => p.id);
      for (const id of trains) expect(kept, `${id} trains and must not see a client's words`).not.toContain(id);
      expect(kept.length).toBeGreaterThan(0);
      expect(providersFor('draft', all).map((p) => p.id).sort()).toEqual(Object.keys(HOSTS).sort());
    } finally {
      if (prev.a !== undefined) process.env.AI_SHARE_CLIENT_WORDS = prev.a;
      if (prev.g !== undefined) process.env.GEMINI_SENSITIVE = prev.g;
    }
  });

  it('runs a free-tier Gemini model, not one that moved behind billing', () => {
    // Pro moved behind billing in May 2026; the free tier is the Flash family (checked 2026-09-29).
    expect(GEMINI_MODEL).toMatch(/flash/i);
  });
});
