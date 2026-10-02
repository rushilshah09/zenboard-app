import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ── THE DRAFT DOOR, AS SOURCE GUARDS ────────────────────────────────────────
//
// `draftFor` is callable from any browser and writes prose in the person's name, some of it for a
// client to read. The rules are tested where they live (lib/draft.test.ts); these guard the wiring,
// and three of them guard the things that would turn a helpful draft into a liability.

const code = readFileSync('lib/actions/draft.ts', 'utf8')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const body = code.slice(code.indexOf('export async function draftFor('));

describe('draftFor', () => {
  it('needs a live session before it reads or spends anything', () => {
    expect(body.indexOf('await requireSession()')).toBeGreaterThan(-1);
    expect(body.indexOf('await requireSession()')).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('writes nothing at all — not the draft, not a stamp', () => {
    expect(code).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it('checks the draft before the browser sees it, and refuses rather than repairs', () => {
    expect(body).toMatch(/const checked = verifyDraft\(res\.data,/);
    expect(body).toMatch(/return checked\.ok \? \{ draft: checked\.draft \} : fail\(checked\.problem\)/);
  });

  // THE ONE THAT MATTERS MOST. The voice examples are the person's OLDER writing: they name clients,
  // figures and deliverables that may no longer be true. Checking against them would license a draft
  // to repeat last month's number as this month's.
  it('checks against the record only, never against the voice examples', () => {
    expect(body).toMatch(/input\.slice\(0, input\.indexOf\('<\/record>'\) \+ 9\)/);
  });

  it('will not spend a call on a record with nothing in it', () => {
    const guard = body.indexOf('!enoughToDraft(gathered.facts)');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('spends the caller’s own allowance, counted in their own day', () => {
    expect(body).toMatch(/userId: user\.id/);
    expect(body).toMatch(/timeZone: tz/);
  });

  it('never reaches a provider directly', () => {
    expect(code).not.toMatch(/from '@\/lib\/ai\/(workers-ai|groq)'/);
  });
});

describe('the arithmetic is done here, never asked for', () => {
  it('sums minutes and totals an invoice in code, and formats them the one way this app does', () => {
    // The model is told "never estimate, round, total or calculate", which is only honest if the
    // numbers arrive already worked out and already written the way every other screen writes them.
    expect(code).toMatch(/formatMinutes\(m, \{ long: true \}\)/);
    expect(code).toMatch(/items\.reduce\(\(n, i\) => n \+ \(Number\(i\.quantity\) \|\| 0\) \* \(Number\(i\.unit_amount\) \|\| 0\), 0\)/);
    expect(code).toMatch(/formatMoney\(total, \{ exact: true \}\)/);
    expect(code).toMatch(/Math\.round\(Number\(g\.progress\) \* 100\)/);
  });
});

describe('what each moment reads', () => {
  it('covers all six §7Q names, and only proposal-scope takes the person’s words', () => {
    for (const m of ['shutdown', 'weekly-review', 'client-update', 'invoice-note', 'close-out']) {
      expect(code, m).toContain(`moment === '${m}'`);
    }
    expect(body).toMatch(/if \(moment === 'proposal-scope'\)/);
    // The app cannot know what somebody is about to propose; a model asked to invent a scope would
    // be inventing the commitment.
    expect(body).toMatch(/const words = \(brief \?\? ''\)\.trim\(\)/);
    expect(body).toMatch(/if \(words\.length < 20\) return fail\('nothing'\)/);
  });

  it('covers a client update from the LAST thing they told that client', () => {
    expect(code).toMatch(/\.eq\('type', CLIENT_UPDATE\)[\s\S]{0,200}order\('created_at', \{ ascending: false \}\)\.limit\(1\)/);
  });

  it('takes the voice from their own past updates on that project, not a setting', () => {
    expect(code).toMatch(/async function voiceOf\(db: DB, projectId: string\)/);
    expect(code).toMatch(/\.eq\('type', CLIENT_UPDATE\)/);
    expect(code).not.toMatch(/preferences[\s\S]{0,40}(tone|voice)/i);
  });

  it('scopes what it can to the caller’s space, and everything else by id under RLS', () => {
    for (const q of code.split('.from(').slice(1)) {
      const head = q.slice(0, 300);
      expect(head).toMatch(/\.eq\('space_id', spaceId\)|\.eq\('id', id\)|\.eq\('project_id', (id|projectId)\)|gte\('started_at'|gte\('met_at'/);
    }
  });
});
