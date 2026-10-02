import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ── ASKING A MEETING, AS SOURCE GUARDS ──────────────────────────────────────
//
// `chooseAndRun` is a server action, so it is callable from any browser with any arguments, and
// the meeting path spends the shared free pool on a client's words. The properties below are what
// keep it a READER — it resolves, it asks, it writes nothing, and it shows only what was checked —
// and each is one careless edit away from gone. The rules it delegates to are tested where they
// live: lib/ask.test.ts (resolution), lib/meeting-ask.test.ts (verification),
// lib/meeting-answer.test.ts (assembly).

const strip = (path: string) => readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const code = strip('lib/actions/ask.ts');
const engine = strip('lib/meeting-answer.ts');

/** The body of one function, up to the next top-level declaration. */
const fn = (src: string, name: string) => {
  const start = src.search(new RegExp(`(export )?async function ${name}\\(`));
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const next = src.slice(start + 1).search(/\n(export )?(async )?function |\n(const|type) /);
  return next === -1 ? src.slice(start) : src.slice(start, start + 1 + next);
};

describe('asking a meeting', () => {
  it('writes nothing: resolving a meeting and answering from it only read', () => {
    for (const name of ['askMeeting', 'answerMeeting', 'meetingRows', 'recentMeetings']) {
      expect(fn(code, name), name).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    }
    expect(engine).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it('reads through the caller’s own session, so RLS decides which meetings exist', () => {
    expect(code + engine).not.toMatch(/createAdminClient|service_role|SERVICE_ROLE/);
    expect(fn(code, 'answerMeeting')).toMatch(/answerFromMeeting\(db, /);
  });

  it('checks the session before a chosen meeting is asked', () => {
    const body = fn(code, 'chooseAndRun');
    expect(body.indexOf('await requireSession()')).toBeGreaterThan(-1);
    expect(body.indexOf('await requireSession()')).toBeLessThan(body.indexOf("then === 'ask_meeting'"));
  });

  it('never takes the model’s words as an id: a phrase is resolved against real rows', () => {
    const body = fn(code, 'askMeeting');
    expect(body).toMatch(/resolveMeetingPhrase\(phrase, await meetingRows\(db\)/);
    expect(body).not.toMatch(/eq\('id', (command\.meeting|phrase)/);
    // The open meeting comes from the address the browser sent, re-read by the engine through RLS.
    expect(body).toMatch(/ctx\.ref\?\.type === 'meeting'/);
  });

  it('shows only a checked answer: the engine verifies before it returns', () => {
    expect(fn(engine, 'answerFromMeeting')).toMatch(/const answer = verifyAnswer\(res\.data, lines,/);
    // The action never talks to the model about a meeting itself — there is no second, unchecked path.
    expect(code).not.toMatch(/MEETING_ASK_SYSTEM|meetingAskSchema/);
  });

  it('spends the caller’s own allowance, counted in their own day, as a client-words feature', () => {
    const body = fn(engine, 'answerFromMeeting');
    expect(body).toMatch(/feature: 'meeting-ask'/);
    expect(body).toMatch(/userId: args\.userId/);
    expect(body).toMatch(/timeZone: args\.timeZone/);
  });

  it('asks nothing of a model when the meeting cannot be read or has nothing in it', () => {
    const body = fn(engine, 'answerFromMeeting');
    expect(body.indexOf("reason: 'missing'")).toBeLessThan(body.indexOf('deps.generate('));
    expect(body.indexOf("reason: 'empty'")).toBeLessThan(body.indexOf('deps.generate('));
  });
});
