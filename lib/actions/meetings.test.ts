import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ── THE WRITE-UP'S DOOR, AS SOURCE GUARDS (MEETINGS_PLAN.md M2) ─────────────
//
// `writeUpMeeting` is callable from any browser (every exported function of a 'use server' file
// is), it spends the shared free pool, and it produces PROSE about a client's own speech. The rules
// are tested where they live (lib/meeting-notes.test.ts); these guard the wiring — the properties
// that keep it a clerk, each one careless edit away from gone.

const code = readFileSync('lib/actions/meetings.ts', 'utf8')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of one exported function, up to the next top-level declaration. */
const fn = (name: string) => {
  const start = code.indexOf(`export async function ${name}(`);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const next = code.slice(start + 1).search(/\n(export )?(async )?function /);
  return next === -1 ? code.slice(start) : code.slice(start, start + 1 + next);
};

describe('writeUpMeeting', () => {
  const body = fn('writeUpMeeting');

  it('needs a live session before it spends anything', () => {
    expect(body.indexOf('await requireSession()')).toBeGreaterThan(-1);
    expect(body.indexOf('await requireSession()')).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('only reads a meeting the caller can see, and checks before calling a model', () => {
    // RLS scopes the lookup to the owner; an id from another account finds nothing.
    expect(body).toMatch(/\.from\('meetings'\)\s*\n?\s*\.select\('id, notes, title, summary, clients\(name\)'\)\.eq\('id', meetingId\)/);
    expect(body.indexOf(".from('meetings')")).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('refuses material too short to write up, without calling a model', () => {
    expect(body.indexOf('MIN_TRANSCRIPT_CHARS')).toBeLessThan(body.indexOf('generateJSON('));
  });

  it('verifies what comes back before the browser sees it, and never reaches a provider', () => {
    expect(body).toMatch(/verifyNotes\(res\.data, material/);
    expect(body.indexOf('verifyNotes(')).toBeLessThan(body.indexOf('.update('));
    expect(code).not.toMatch(/from '@\/lib\/ai\/(workers-ai|groq|gemini|nvidia)'/);
  });

  it('writes ONLY the write-up: the person\u2019s own notes are never touched', () => {
    // The one update in this function names the two columns 0047 added and nothing else.
    const updates = body.match(/\.update\(\{[^}]*\}/g) ?? [];
    expect(updates.length).toBe(1);
    expect(updates[0]).toContain('summary');
    expect(updates[0]).toContain('summarized_at');
    expect(updates[0]).not.toMatch(/\bnotes\b:/);
  });

  it('writes up the transcript AND the typed notes, not one or the other', () => {
    expect(body).toMatch(/notesMaterial\(typed, await recordedText\(supabase, meetingId\)\)/);
  });

  it('hands the model who the meeting was with, so a line may name the client', () => {
    expect(body).toMatch(/const context = \{ title: row\.title, clientName: row\.clients\?\.name \?\? null \}/);
    expect(body).toMatch(/writeUpInput\(context, material\)/);
    expect(body).toMatch(/verifyNotes\([\s\S]*?context,/);
  });

  it('carries forward every "no" the person already gave', () => {
    // Writing again must not re-ask what was dismissed; `verifyNotes` keeps only the ones that
    // still match something the new write-up says.
    expect(body).toMatch(/dismissed: previous\.success \? previous\.data\.dismissed : \[\]/);
  });

  it('spends the caller\u2019s own allowance, counted in their own day', () => {
    expect(body).toMatch(/userId: user\.id/);
    expect(body).toMatch(/timeZone: await userTimezone\(\)/);
  });

  it('is recorded under a feature name the ledger knows is a client\u2019s words', () => {
    expect(body).toMatch(/feature: 'meeting-notes'/);
    // lib/ai/usage.ts CLIENT_WORDS must contain it, or a transcript could reach a provider that
    // trains on it. Asserted there too; named here so removing it breaks both.
    expect(readFileSync('lib/ai/usage.ts', 'utf8')).toMatch(/CLIENT_WORDS[\s\S]{0,200}'meeting-notes'/);
  });
});

describe('the write-up is read, dismissed and removed without touching anything else', () => {
  it('reads what is kept, and survives 0047 not being applied', () => {
    const body = fn('loadMeetingWriteUp');
    expect(body).toMatch(/if \(error\) return \{ supported: false, notes: null \}/);
    // Validated on the way OUT as well as in: a stored blob is data, not a promise about its shape.
    expect(body).toMatch(/storedNotesSchema\.safeParse/);
  });

  it('accepts only a key naming a list a person can answer', () => {
    const body = fn('dismissWriteUpItem');
    expect(body).toMatch(/\/\^\(mine\|asks\|theirs\):\//);
    expect(body).toMatch(/key\.length > 300/);
  });

  it('removes the write-up and nothing else', () => {
    const body = fn('clearMeetingWriteUp');
    expect(body).toMatch(/\.update\(\{ summary: null, summarized_at: null \}\)/);
    expect(body).not.toMatch(/\.delete\(\)/);
  });
});
