import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateJSON } from './gateway';
import type { AIProvider } from './provider';
import type { UsageLedger } from './usage';
import { TEXT_MODEL, workersAIProvider } from './workers-ai';
import { nvidiaProvider } from './nvidia';
import { groqProvider } from './groq';
import { geminiProvider } from './gemini';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  MEETING_NOTES_SYSTEM, NOTES_MAX_TOKENS, meetingNotesSchema, verifyNotes, writeUpInput,
} from '@/lib/meeting-notes';
import {
  INBOX_FILE_MAX_TOKENS, INBOX_FILE_SYSTEM, filingInput, inboxFilingSchema, verifyFilings,
} from '@/lib/inbox-ai';
import type { FileProject, Thought } from '@/lib/inbox-file';
import {
  DRAFT_MAX_TOKENS, draftInput, draftSchema, draftSystem, verifyDraft, type Fact,
} from '@/lib/draft';

// ── THE BAKE-OFF ────────────────────────────────────────────────────────────
//
// USER DIRECTIVE 2026-09-29: "we only have to use opensource free models" — and "the BEST open
// source free models". This is how that question is answered here, because the AI plan already
// says to choose models "against Zenboard's actual tasks rather than benchmark scores", and the
// leaderboards disagree with each other about the very models we can run:
//
//   · IFStruct (JSON to a schema, no constrained decoding): gpt-oss-20b 91.95, #2 of 5 — and
//     Qwen3.8-27B is not on it at all.
//   · ExtractBench (extraction from a document): Qwen3.8-27B 89.75, #2 of 10 — and gpt-oss-20b is
//     not on it at all.
//   · Neither board has ANYTHING to say about writing a client update from a record, which is what
//     §7Q's *Draft* does, and which is the half of this app where being wrong is most expensive.
//
// So each candidate runs the app's own three jobs, through the app's own prompts, gateway and
// VERIFIERS, and is scored on what the person would actually get: did the answer survive the
// check, what did it cost in Neurons, how long did it take. A model that writes beautifully and
// fails verification scores zero here, which is correct — the person never sees it.
//
// It spends real Neurons on every candidate, so it is opt-in and separate from the suite:
//
//   ZB_LIVE_AI=1 npx vitest run lib/ai/bake-off.live.test.ts
//   ZB_LIVE_AI=1 ZB_MODELS='@cf/qwen/qwen3.8-27b,@cf/openai/gpt-oss-20b' npx vitest run lib/ai/bake-off.live.test.ts
const LIVE = process.env.ZB_LIVE_AI === '1';

/** The free-tier, open-weight text models Workers AI serves that are worth this app's jobs. */
const CANDIDATES = (process.env.ZB_MODELS ?? [
  '@cf/openai/gpt-oss-20b',      // ours. IFStruct 91.95 (#2 of 5). Apache-2.0, MoE.
  '@cf/qwen/qwen3.8-27b',        // ExtractBench 89.75 (#2 of 10). Apache-2.0.
  '@cf/zai-org/glm-5.3-flash',   // ExtractBench 80.75 (#6). MIT.
  '@cf/openai/gpt-oss-120b',     // the larger sibling: the ceiling, at a price.
].join(',')).split(',').map((m) => m.trim()).filter(Boolean);

const TRANSCRIPT = `Call with Meridian Coffee — brand refresh kickoff
Priya: Thanks for jumping on. We loved the moodboard, but the green feels too corporate.
Me: Got it. I'll send two alternative palettes by Thursday, one warmer and one earthier.
Priya: Great. Also, can the logo work on our cups? The cup print is tiny.
Me: Good point — I'll do a small-size test of the mark on the cup template.
Priya: We still owe you the old brand files, I'll ask Dev to send them tomorrow.
Me: Perfect. Could you also quote for a menu board redesign? Not urgent.
Me: Sure, I'll put together a quote next week.`;

const PROJECTS: FileProject[] = [
  { id: 'p-mer', name: 'Brand refresh', client: 'Meridian Coffee' },
  { id: 'p-fern', name: 'Lobby screens', client: 'Fernwood Hotels' },
  { id: 'p-atlas', name: 'Packaging v2', client: 'Atlas Coffee' },
  { id: 'p-studio', name: 'Studio admin', client: null },
];
const EXAMPLES = new Map([
  ['p-mer', ['Send two alternative palettes', 'Palette review with Priya']],
  ['p-fern', ['Wire up the lobby screen analytics', 'Book the screen install']],
  ['p-atlas', ['Revised dieline for the kraft stock', 'Check print costs with the supplier']],
  ['p-studio', ['Renew the studio insurance', 'File Q2 taxes']],
]);
const THOUGHTS: Thought[] = [
  { id: 'i-0', title: 'Proof the kraft label copy once more' },
  { id: 'i-1', title: 'Chase the coffee client for the signed estimate' }, // ambiguous: must be left
  { id: 'i-2', title: 'Book a dentist appointment' },                      // personal: must be left
  { id: 'i-3', title: 'Ask the screen installer about mounting height' },
];

const DRAFT_FACTS: Fact[] = [
  { label: 'Project', lines: ['Brand refresh, for Meridian Coffee'] },
  { label: 'Finished since 12 Sep', lines: ['Send two alternative palettes', 'Small-size test of the mark on the cup template'] },
  { label: 'Coming up next', lines: ['Quote for the menu board redesign'] },
];

type Score = { model: string; task: string; ok: boolean; note: string; neurons: number; ms: number };

describe.skipIf(!LIVE)('which free open-weight model does Zenboard’s own jobs best', () => {
  let dispose: (() => Promise<void>) | undefined;
  let env: { AI: { run: (m: string, i: Record<string, unknown>) => Promise<unknown> } };
  const scores: Score[] = [];

  beforeAll(async () => {
    // Every transcript and inbox here is invented for the test, so the hosts that train on their
    // inputs may see it: the gate in `providersFor` protects real clients' words, not fixtures.
    process.env.AI_SHARE_CLIENT_WORDS = '1';
    // The hosted providers' keys live in .env.local. Next loads it for the app but deliberately
    // skips it under NODE_ENV=test, so it is read here directly — or every hosted candidate reads
    // as "no key" and the bake-off quietly measures nothing.
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    const { getPlatformProxy } = await import('wrangler');
    const proxy = await getPlatformProxy<typeof env>();
    dispose = proxy.dispose;
    env = proxy.env;
  }, 60_000);

  afterAll(async () => {
    const byModel = new Map<string, Score[]>();
    for (const s of scores) byModel.set(s.model, [...(byModel.get(s.model) ?? []), s]);
    const rows = [...byModel].map(([model, ss]) => ({
      model,
      passed: ss.filter((s) => s.ok).length,
      of: ss.length,
      neurons: ss.reduce((n, s) => n + s.neurons, 0),
      ms: Math.round(ss.reduce((n, s) => n + s.ms, 0) / ss.length),
    })).sort((a, b) => b.passed - a.passed || a.neurons - b.neurons);

    console.log('\n╔══ BAKE-OFF: Zenboard’s own three jobs, through its own verifiers ══');
    for (const r of rows) {
      console.log(`║ ${r.passed}/${r.of}  ${String(Math.round(r.neurons)).padStart(5)} neurons  ${String(r.ms).padStart(6)} ms avg  ${r.model}`);
    }
    for (const s of scores.filter((x) => !x.ok)) console.log(`║   ✗ ${s.model} — ${s.task}: ${s.note}`);
    console.log('╚' + '═'.repeat(66) + '\n');
    if (process.env.ZB_BAKEOFF_OUT) writeFileSync(process.env.ZB_BAKEOFF_OUT, JSON.stringify({ rows, scores }, null, 2));
    await dispose?.();
  });

  /** One job, one model, through the real gateway and the real verifier. */
  async function run(
    model: string, task: string,
    req: { system: string; input: string; schema: Parameters<typeof generateJSON>[0]['schema']; maxTokens: number },
    check: (data: unknown) => { ok: boolean; note: string },
  ) {
    const ledger: UsageLedger & { neurons: number } = {
      neurons: 0, usedToday: async () => 0, audioToday: async () => 0, poolToday: async () => 0,
      record: async (r) => { ledger.neurons += r.usage.neurons ?? 0; },
    };
    // `@cf/…` runs on Workers AI; `groq:`, `nvidia:` and `gemini:<model>` on those hosts' free tiers.
    const provider: AIProvider = model.startsWith('groq:') ? groqProvider(model.slice(5))
      : model.startsWith('nvidia:') ? nvidiaProvider(model.slice(7))
      : model.startsWith('gemini:') ? geminiProvider(model.slice(7))
      : workersAIProvider(() => env.AI, model);
    const started = Date.now();
    const res = await generateJSON(
      { feature: 'meeting-items', system: req.system, input: req.input, schema: req.schema, maxTokens: req.maxTokens, userId: 'bake', timeZone: 'UTC' },
      { providers: [provider], ledger, timeoutMs: 90_000 },
    );
    const ms = Date.now() - started;
    const scored = res.ok ? check(res.data) : { ok: false, note: `gateway: ${res.reason}` };
    scores.push({ model, task, ...scored, neurons: ledger.neurons, ms });
    return scored;
  }

  for (const model of CANDIDATES) {
    describe(model, () => {
      it('writes a meeting up, keeping each side’s commitments apart', async () => {
        const ctx = { title: 'Brand refresh kickoff', clientName: 'Meridian Coffee' };
        const { input } = writeUpInput(ctx, TRANSCRIPT);
        const r = await run(model, 'meeting', { system: MEETING_NOTES_SYSTEM, input, schema: meetingNotesSchema, maxTokens: NOTES_MAX_TOKENS }, (data) => {
          const out = verifyNotes(data as never, TRANSCRIPT, { context: ctx });
          const has = (l: { text: string }[], re: RegExp) => l.some((a) => re.test(a.text));
          const mine = has(out.mine, /palette/i) && has(out.mine, /cup|mark/i);
          const stolen = has(out.mine, /brand files/i); // Dev sends those, not me
          return {
            ok: mine && !stolen && out.summary.length > 0,
            note: `${out.mine.length} mine, ${out.theirs.length} theirs${stolen ? ', took the CLIENT’s commitment' : ''}${mine ? '' : ', missed mine'}${out.summary ? '' : ', no summary survived'}`,
          };
        });
        expect(typeof r.ok).toBe('boolean');
      }, 120_000);

      it('files the clear thoughts and leaves the ambiguous one alone', async () => {
        const r = await run(model, 'filing', { system: INBOX_FILE_SYSTEM, input: filingInput(THOUGHTS, PROJECTS, EXAMPLES), schema: inboxFilingSchema, maxTokens: INBOX_FILE_MAX_TOKENS }, (data) => {
          const out = verifyFilings(data as never, THOUGHTS, PROJECTS);
          const right = out.get('i-0')?.projectId === 'p-atlas' && out.get('i-3')?.projectId === 'p-fern';
          const restrained = !out.has('i-1') && !out.has('i-2');
          return { ok: right && restrained, note: `${out.size} filed${restrained ? '' : ', guessed the ambiguous/personal one'}${right ? '' : ', missed a clear one'}` };
        });
        expect(typeof r.ok).toBe('boolean');
      }, 120_000);

      it('writes a client update that survives the fact check', async () => {
        const input = draftInput(DRAFT_FACTS);
        const r = await run(model, 'draft', { system: draftSystem('client-update'), input, schema: draftSchema, maxTokens: DRAFT_MAX_TOKENS }, (data) => {
          const out = verifyDraft(data as never, input);
          return out.ok
            ? { ok: out.draft.length > 40, note: `${out.draft.length} chars: ${out.draft.slice(0, 110)}` }
            : { ok: false, note: out.problem === 'unchecked' ? `invented ${out.offending.join(', ')}` : 'said nothing' };
        });
        expect(typeof r.ok).toBe('boolean');
      }, 120_000);
    });
  }

  it('keeps the app pointed at a model that was actually measured', () => {
    expect(CANDIDATES).toContain(TEXT_MODEL);
  });
});
