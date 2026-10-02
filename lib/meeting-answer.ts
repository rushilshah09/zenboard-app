import 'server-only';
// ── ONE QUESTION, ANSWERED FROM ONE MEETING ─────────────────────────────────
//
// The server half of lib/meeting-ask.ts: read the meeting through the caller's own RLS-scoped
// client, pick the lines one question may send, spend one AI act on them, and check what comes
// back before anyone sees it.
//
// NOT A SERVER ACTION, ON PURPOSE. Every export of a 'use server' file is callable from any
// browser; this is called from Ask (lib/actions/ask.ts), which has already checked the session and
// resolved WHICH meeting — so the only door to it is a door that asks first.

import { generateJSON } from '@/lib/ai/gateway';
import type { AIFailure } from '@/lib/ai/gateway';
import {
  MEETING_ASK_MAX_TOKENS, MEETING_ASK_SYSTEM, keyQuotes, meetingAskInput, meetingAskSchema, meetingLines,
  selectLines, verifyAnswer, type MeetingAnswer,
} from '@/lib/meeting-ask';
import { readSegments, readWriteUp, type MeetingDB } from '@/lib/meeting-data';

export type MeetingAnswerResult =
  | { ok: true; meeting: { id: string; title: string }; answer: MeetingAnswer }
  /** `empty`: the meeting has no notes and no transcript, so there is nothing to answer from. */
  | { ok: false; reason: 'missing' | 'empty' | AIFailure; title?: string };

export async function answerFromMeeting(
  db: MeetingDB,
  args: { userId: string; meetingId: string; question: string; timeZone: string },
  deps: { generate: typeof generateJSON } = { generate: generateJSON },
): Promise<MeetingAnswerResult> {
  const { data } = await db.from('meetings').select('id, title, notes, client_id').eq('id', args.meetingId).maybeSingle();
  const row = data as { id: string; title: string; notes: string | null; client_id: string | null } | null;
  if (!row) return { ok: false, reason: 'missing' };

  // One round trip for the three reads that do not depend on each other.
  const [segments, writeUp, client] = await Promise.all([
    readSegments(db, row.id),
    readWriteUp(db, row.id),
    row.client_id
      ? db.from('clients').select('name').eq('id', row.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lines = meetingLines(row.notes, segments);
  if (lines.length === 0) return { ok: false, reason: 'empty', title: row.title };

  const context = { title: row.title, clientName: (client.data as { name: string } | null)?.name ?? null };
  const selection = selectLines(lines, args.question, keyQuotes(writeUp));
  const res = await deps.generate({
    feature: 'meeting-ask',
    system: MEETING_ASK_SYSTEM,
    input: meetingAskInput(context, selection, args.question),
    schema: meetingAskSchema,
    maxTokens: MEETING_ASK_MAX_TOKENS,
    userId: args.userId,
    timeZone: args.timeZone,
  });
  if (!res.ok) return { ok: false, reason: res.reason, title: row.title };

  // Quotes are checked against EVERY line of the meeting, not just the ones sent: a model cannot
  // quote what it was not shown, and checking wider costs nothing.
  const answer = verifyAnswer(res.data, lines, { question: args.question, context, partial: selection.partial });
  return { ok: true, meeting: { id: row.id, title: row.title }, answer };
}
