import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ── THE CLERK'S OTHER DOOR, AS SOURCE GUARDS ────────────────────────────────
//
// `suggestFiling` is callable from any browser (every exported function of a 'use server' file is)
// and it spends the shared free pool. The logic is tested where it lives (lib/inbox-file.test.ts,
// lib/inbox-ai.test.ts, lib/ai/gateway.test.ts); this guards the wiring — the properties that make
// it a clerk rather than a filing robot, each one edit away from gone.

const code = readFileSync('lib/actions/inbox-file.ts', 'utf8')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const body = (() => {
  const start = code.indexOf('export async function suggestFiling(');
  expect(start, 'suggestFiling exists').toBeGreaterThan(-1);
  return code.slice(start);
})();

describe('suggestFiling', () => {
  it('needs a live session before it reads or spends anything', () => {
    expect(body.indexOf('await requireSession()')).toBeGreaterThan(-1);
    expect(body.indexOf('await requireSession()')).toBeLessThan(body.indexOf("from('tasks')"));
    expect(body.indexOf('await requireSession()')).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('reads only the caller’s own space, on every query that can name one', () => {
    // RLS scopes every table to the owner; the space is what further scopes it to the workspace
    // they are looking at. Cut at each `.from(` so one query cannot borrow the next one's filter.
    // `task_labels` is the one table with no space of its own — it is scoped by `user_id` in RLS
    // (migration 0014) and read exactly this way by the Tasks route itself.
    const queries = Object.fromEntries(
      body.split('.from(').slice(1).map((q) => [q.slice(1, q.indexOf(q[0], 1)), q.slice(0, 400)]),
    );
    expect(Object.keys(queries).sort()).toEqual(['labels', 'projects', 'task_labels', 'tasks']);
    for (const t of ['tasks', 'projects', 'labels']) expect(queries[t]).toMatch(/\.eq\('space_id', spaceId\)/);
    expect(queries.task_labels).toContain(".select('task_id, label_id')");
  });

  it('never learns a label from the thought it is about to label', () => {
    // Every inbox item that already carries a label would otherwise vote for its own label, and the
    // clerk would report the person's own filing back to them as a discovery.
    expect(body).toMatch(/!thoughts\.some\(\(t\) => t\.id === tl\.task_id\)/);
  });

  it('writes nothing: a proposal becomes a filing only when the person accepts it', () => {
    expect(body).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it('runs the rules before the model, and asks about nothing else', () => {
    expect(body.indexOf('proposeAll(')).toBeLessThan(body.indexOf('generateJSON('));
    expect(body).toMatch(/const rest = unplaced\(proposals, thoughts\)/);
    expect(body).toMatch(/input: filingInput\(rest,/);
  });

  it('does not call a model when there is nothing to ask, or nothing to choose between', () => {
    const guard = body.indexOf('rest.length === 0 || projects.length < 2');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('verifies the model’s answer before the browser sees it, and never reaches a provider', () => {
    expect(body).toMatch(/verifyFilings\(res\.data, rest,/);
    expect(code).not.toMatch(/from '@\/lib\/ai\/(workers-ai|groq)'/);
  });

  it('never lets a model overrule a rule', () => {
    // The model is asked only about thoughts the rules left unplaced, and even so the merge checks
    // again — an answer about a placed thought cannot displace the evidence that placed it.
    expect(body).toMatch(/const guess = !p\.project && fromModel\.get\(p\.thoughtId\)/);
  });

  it('keeps the rules’ proposals when the model fails', () => {
    expect(body).toMatch(/if \(!res\.ok\) return \{ proposals, modelFailed: true \}/);
  });

  it('spends the caller’s own allowance, counted in their own day', () => {
    expect(body).toMatch(/userId: user\.id/);
    expect(body).toMatch(/timeZone: await userTimezone\(\)/);
  });

  it('never suggests filing into an archived project', () => {
    expect(body).toMatch(/p\.status !== 'archived'/);
  });
});
