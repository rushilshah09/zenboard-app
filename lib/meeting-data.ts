import 'server-only';
// ── READING A MEETING'S RECORDED PARTS ──────────────────────────────────────
//
// The transcript (0046) and the write-up (0047) are each read by more than one clerk act — the
// write-up reads the transcript (lib/actions/meetings.ts), Ask reads both (lib/meeting-answer.ts)
// — so each read is written once, here, and validated on the way out of the database the same way
// every time.
//
// Both are TOLERANT: a table or column that is not there yet (a migration not applied) reads as
// "none", because every caller has an honest answer for none, and none has one for a thrown error.

import type { requireSession } from '@/lib/auth';
import { storedNotesSchema, type MeetingNotes } from '@/lib/meeting-notes';
import { transcriptSchema, type TranscriptSegment } from '@/lib/meeting-transcript';

export type MeetingDB = Awaited<ReturnType<typeof requireSession>>['supabase'];

/** A meeting's recorded pieces, in order. None when it was never recorded, or 0046 is missing. */
export async function readSegments(db: MeetingDB, meetingId: string): Promise<TranscriptSegment[]> {
  const { data, error } = await db.from('meeting_transcripts').select('segments').eq('meeting_id', meetingId).maybeSingle();
  if (error || !data) return [];
  const parsed = transcriptSchema.safeParse((data as { segments: unknown }).segments);
  return parsed.success ? parsed.data : [];
}

/** The write-up kept on a meeting. Null when there is none, it no longer parses, or 0047 is missing. */
export async function readWriteUp(db: MeetingDB, meetingId: string): Promise<MeetingNotes | null> {
  const { data, error } = await db.from('meetings').select('summary').eq('id', meetingId).maybeSingle();
  if (error || !data) return null;
  const parsed = storedNotesSchema.safeParse((data as { summary: unknown }).summary);
  return parsed.success ? (parsed.data as MeetingNotes) : null;
}
