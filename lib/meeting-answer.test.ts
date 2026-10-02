import { describe, expect, it } from 'vitest';

import type { generateJSON, JSONRequest } from '@/lib/ai/gateway';
import { CLIENT_WORDS } from '@/lib/ai/usage';
import { answerFromMeeting } from './meeting-answer';
import type { MeetingDB } from './meeting-data';

// ── ONE QUESTION, ONE MEETING, NO NETWORK ───────────────────────────────────
// The engine's rules are tested where they live (lib/meeting-ask.test.ts). This file tests the
// assembly: what is read, what the model is handed, what happens when a part is missing.

type Row = Record<string, unknown>;

/** Just the query shape these reads use: from → select → eq → maybeSingle. Records every read. */
function fakeDb(tables: Record<string, Row[]>, broken: string[] = []) {
  const reads: string[] = [];
  const db = {
    from(table: string) {
      let cols = '';
      let row: Row | undefined;
      const q = {
        select(c: string) { cols = c; return q; },
        eq(col: string, val: unknown) { row = (tables[table] ?? []).find((r) => r[col] === val); return q; },
        async maybeSingle() {
          reads.push(`${table}(${cols})`);
          // A column or table that is not there yet reads as PostgREST reports it.
          if (broken.includes(`${table}(${cols})`)) return { data: null, error: { code: '42703', message: 'does not exist' } };
          if (!row) return { data: null, error: null };
          return { data: Object.fromEntries(cols.split(',').map((c) => [c.trim(), row![c.trim()]])), error: null };
        },
      };
      return q;
    },
  };
  return { db: db as unknown as MeetingDB, reads };
}

const MEETING = { id: 'm1', title: 'Logo direction call', notes: 'Priya wants it warmer', client_id: 'c1', summary: null };
const SEGMENTS = [
  { id: 's0', start: 0, end: 4, speaker: 'them', text: 'For the budget, we have about eight thousand for this phase.' },
  { id: 's1', start: 271, end: 275, speaker: 'them', text: 'Launch is March 3rd, before the app goes live.' },
];
const TABLES = {
  meetings: [MEETING],
  meeting_transcripts: [{ meeting_id: 'm1', segments: SEGMENTS }],
  clients: [{ id: 'c1', name: 'Ridgeline' }],
};

/**
 * A model that answers from a script, and remembers what it was asked. Its answer goes through the
 * request's own schema, exactly as the gateway's does — defaults filled, a wrong shape refused.
 */
function scripted(data: unknown, ok = true) {
  const asked: JSONRequest<unknown>[] = [];
  const generate = (async (req: JSONRequest<unknown>) => {
    asked.push(req);
    if (!ok) return { ok: false, reason: 'limit' };
    const checked = req.schema.safeParse(data);
    return checked.success ? { ok: true, data: checked.data, provider: 'groq' } : { ok: false, reason: 'invalid' };
  }) as unknown as typeof generateJSON;
  return { generate, asked };
}

const ARGS = { userId: 'u1', meetingId: 'm1', question: 'What is the budget?', timeZone: 'Asia/Kolkata' };

describe('answering one question from one meeting', () => {
  it('reads the meeting, hands the model the meeting and the question, and checks the answer', async () => {
    const { db } = fakeDb(TABLES);
    const model = scripted({ found: true, answer: 'They have about eight thousand for this phase.', quotes: [{ line: 't1', text: 'we have about eight thousand' }] });
    const res = await answerFromMeeting(db, ARGS, { generate: model.generate });

    expect(res).toEqual({
      ok: true,
      meeting: { id: 'm1', title: 'Logo direction call' },
      answer: {
        kind: 'answer',
        text: 'They have about eight thousand for this phase.',
        quotes: [{ text: 'For the budget, we have about eight thousand for this phase.', label: 't1', kind: 'said', start: 0, speaker: 'them' }],
        partial: false,
      },
    });
    const req = model.asked[0];
    expect(req.feature).toBe('meeting-ask');
    expect(req.input).toContain('Meeting: Logo direction call\nWith: Ridgeline');
    expect(req.input).toContain('[n1] Priya wants it warmer');
    expect(req.input).toContain('[t2] 4:31 Them: Launch is March 3rd');
    expect(req.input.trimEnd().endsWith('Question: What is the budget?')).toBe(true);
    expect(req.userId).toBe('u1');
    expect(req.timeZone).toBe('Asia/Kolkata');
  });

  it('is a client-words feature, so a provider that trains on its input never sees it', () => {
    expect(CLIENT_WORDS.has('meeting-ask')).toBe(true);
  });

  it('says the meeting is gone when the caller cannot read it, without spending a model call', async () => {
    const { db } = fakeDb({ ...TABLES, meetings: [] });
    const model = scripted({});
    expect(await answerFromMeeting(db, ARGS, { generate: model.generate })).toEqual({ ok: false, reason: 'missing' });
    expect(model.asked).toHaveLength(0);
  });

  it('says there is nothing to answer from when a meeting has no notes and no recording', async () => {
    const { db } = fakeDb({ ...TABLES, meetings: [{ ...MEETING, notes: '  ' }], meeting_transcripts: [] });
    const model = scripted({});
    expect(await answerFromMeeting(db, ARGS, { generate: model.generate })).toEqual({ ok: false, reason: 'empty', title: 'Logo direction call' });
    expect(model.asked).toHaveLength(0);
  });

  it('still answers when the write-up column (0047) is not there yet', async () => {
    const { db, reads } = fakeDb(TABLES, ['meetings(summary)']);
    const model = scripted({ found: false });
    const res = await answerFromMeeting(db, ARGS, { generate: model.generate });
    expect(reads).toContain('meetings(summary)');
    expect(res).toMatchObject({ ok: true, answer: { kind: 'not-found' } });
  });

  it('still answers from the notes when the transcript table (0046) is not there', async () => {
    const { db } = fakeDb(TABLES, ['meeting_transcripts(segments)']);
    const model = scripted({ found: true, answer: 'Priya wants it warmer.', quotes: [{ line: 'n1', text: 'Priya wants it warmer' }] });
    const res = await answerFromMeeting(db, ARGS, { generate: model.generate });
    expect(model.asked[0].input).not.toContain('[t1]');
    expect(res).toMatchObject({ ok: true, answer: { kind: 'answer', quotes: [{ label: 'n1', kind: 'note', start: null }] } });
  });

  it('passes the gateway’s reason on, so the person hears the right sentence', async () => {
    const { db } = fakeDb(TABLES);
    expect(await answerFromMeeting(db, ARGS, { generate: scripted(null, false).generate })).toEqual({ ok: false, reason: 'limit', title: 'Logo direction call' });
  });

  it('reads the meeting it was given and no other', async () => {
    const { db, reads } = fakeDb({ ...TABLES, meetings: [MEETING, { ...MEETING, id: 'm2', title: 'Someone else’s' }] });
    const model = scripted({ found: false });
    await answerFromMeeting(db, ARGS, { generate: model.generate });
    expect(reads[0]).toBe('meetings(id, title, notes, client_id)');
    expect(model.asked[0].input).not.toContain('Someone else');
  });
});
