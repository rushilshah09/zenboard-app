// ── A MEETING'S TRANSCRIPT ──────────────────────────────────────────────────
//
// The shape a recorded meeting's words are kept in (0046 `meeting_transcripts.segments`), and the
// pure rules that build it: where a chunk's words sit on the meeting's clock, who said them, how
// chunks merge, and how the whole reads as text for the clerk. No browser and no database here —
// the recorder (lib/meeting-recorder.ts) and the server both lean on these, and both are tested
// through them.
//
// WHO SPOKE IS MEASURED, NOT GUESSED. The recorder captures the microphone and the call as separate
// channels and keeps each one's loudness every 100 ms. A stretch of speech belongs to whichever
// channel was carrying it — the way Granola labels "Me" and "Them" without a bot and without a
// diarisation model that would guess, and sometimes guess wrong, about a client.

import { z } from 'zod';

/** 'me' = the microphone, 'them' = the call's audio, null = only one channel was recorded. */
export type Speaker = 'me' | 'them' | null;

/** One stretch of speech, timed in seconds from the start of the recording (pauses excluded). */
export type TranscriptSegment = { id: string; start: number; end: number; speaker: Speaker; text: string };

/** How often the recorder measures each channel's loudness. */
export const ENERGY_STEP_MS = 100;

/** Loudness per channel, one reading per ENERGY_STEP_MS on the recording clock. */
export type EnergyTimeline = { me: ArrayLike<number>; them: ArrayLike<number> | null };

/** Below this RMS a channel is not carrying speech; above it, it might be. */
export const SPEECH_RMS = 0.012;

/** A transcript longer than this is not a meeting; the save is refused rather than truncated. */
export const MAX_SEGMENTS = 6_000;
export const MAX_SEGMENT_CHARS = 2_000;

export const segmentSchema = z.object({
  id: z.string().min(1).max(64),
  start: z.number().finite().nonnegative(),
  end: z.number().finite().nonnegative(),
  speaker: z.enum(['me', 'them']).nullable(),
  text: z.string().min(1).max(MAX_SEGMENT_CHARS),
});
export const transcriptSchema = z.array(segmentSchema).max(MAX_SEGMENTS);

/** Why a chunk has no words, from the recorder's side: the route's refusals and the network's. */
export type TranscribeProblem =
  | 'forbidden' | 'auth' | 'format' | 'too-long' | 'empty' | 'missing'
  | 'limit' | 'unavailable' | 'invalid' | 'offline' | 'migration';

/**
 * What the recorder says about a problem, one sentence each. Most are about the TRANSCRIPT, not the
 * recording: the recording goes on, and what could not be transcribed yet is kept and tried again.
 */
export const TRANSCRIBE_MESSAGES: Record<TranscribeProblem, string> = {
  forbidden: 'This page can’t send audio to Zenboard. Reload it and try again.',
  auth: 'Your session has ended. Sign in again, and the rest of the meeting will be transcribed.',
  format: 'This browser records in a format Zenboard can’t read. Try Chrome, Edge or Safari.',
  'too-long': 'A piece of the recording was too long to send. The rest carries on.',
  empty: 'A piece of the recording was empty and was skipped.',
  missing: 'This meeting no longer exists, so its transcript can’t be kept.',
  limit: 'You’ve transcribed today’s two hours. Recording goes on; the rest is transcribed tomorrow.',
  unavailable: 'Transcription is busy right now. The recording is safe and will be transcribed shortly.',
  invalid: 'A piece of the recording couldn’t be transcribed. Trying again.',
  offline: 'You’re offline. The recording is safe and will be transcribed when you reconnect.',
  migration: 'Transcripts can’t be saved yet.', // the action warns the developer about 0046
};

/** Will sending the same chunk again help? A limit waits for tomorrow; a gone meeting never will. */
export function retryableProblem(p: TranscribeProblem): boolean {
  return p === 'unavailable' || p === 'invalid' || p === 'offline';
}

/** The words-with-times a transcriber returns for ONE chunk, timed from the chunk's own start. */
export type HeardSegment = { start: number; end: number; text: string };

function mean(values: ArrayLike<number>, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(values.length, Math.ceil(to));
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += values[i];
  return sum / (b - a);
}

/**
 * The loudness a channel reaches when someone is actually talking on it: a high percentile of its
 * readings, so one cough does not set the scale. Each channel is judged against its OWN level,
 * because a microphone and a call's digital audio arrive at very different volumes.
 */
export function speakingLevel(values: ArrayLike<number>): number {
  const loud: number[] = [];
  for (let i = 0; i < values.length; i++) if (values[i] > SPEECH_RMS) loud.push(values[i]);
  if (loud.length === 0) return SPEECH_RMS;
  loud.sort((x, y) => x - y);
  return loud[Math.min(loud.length - 1, Math.floor(loud.length * 0.9))];
}

/**
 * Who said the words between `start` and `end` (seconds on the recording clock).
 *
 * Each channel's loudness over that stretch is divided by its own speaking level, and the louder
 * one — relative to itself — spoke. Relative, because on laptop speakers the microphone also hears
 * the call: that echo is real energy on the mic, but it is quiet next to the person at the mic, and
 * the call's channel is at its own full level. Null when only the microphone was recorded (an
 * in-person meeting) or neither channel carried speech.
 */
export function speakerFor(
  start: number,
  end: number,
  energy: EnergyTimeline,
  levels: { me: number; them: number } = {
    me: speakingLevel(energy.me),
    them: energy.them ? speakingLevel(energy.them) : SPEECH_RMS,
  },
): Speaker {
  if (!energy.them) return null;
  const per = 1000 / ENERGY_STEP_MS;
  const me = mean(energy.me, start * per, end * per);
  const them = mean(energy.them, start * per, end * per);
  if (me < SPEECH_RMS && them < SPEECH_RMS) return null;
  return them / levels.them > me / levels.me ? 'them' : 'me';
}

/**
 * One chunk's segments, placed on the recording clock and attributed.
 *
 * `chunkStart` is where the chunk began on the recording clock; the transcriber timed its segments
 * from zero. `chunkEnergy` is the loudness recorded DURING the chunk (reading 0 = the chunk's
 * start), kept with the chunk so a transcript finished after a reload is still attributed.
 * `levels` are the whole recording's speaking levels when the recorder knows them — a better scale
 * than one chunk's, which may be one person talking throughout.
 */
export function placeSegments(
  heard: HeardSegment[],
  chunkStart: number,
  chunkEnergy: EnergyTimeline,
  makeId: (i: number) => string,
  levels: { me: number; them: number } = {
    me: speakingLevel(chunkEnergy.me),
    them: chunkEnergy.them ? speakingLevel(chunkEnergy.them) : SPEECH_RMS,
  },
): TranscriptSegment[] {
  return heard
    .map((h) => ({ ...h, text: h.text.replace(/\s+/g, ' ').trim() }))
    .filter((h) => h.text)
    .map((h, i) => {
      const from = Math.max(0, h.start);
      const to = Math.max(from, h.end);
      return {
        id: makeId(i),
        start: round(chunkStart + from),
        end: round(chunkStart + to),
        speaker: speakerFor(from, to, chunkEnergy, levels),
        text: h.text.slice(0, MAX_SEGMENT_CHARS),
      };
    });
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Two transcripts as one, in time order. Chunks can come back out of order (a retried upload), and
 * the same chunk can come back twice (a retry whose first answer arrived late), so a segment already
 * present — same start, same words — is not added again.
 */
export function mergeSegments(existing: TranscriptSegment[], incoming: TranscriptSegment[]): TranscriptSegment[] {
  const seen = new Set(existing.map((s) => `${Math.round(s.start * 10)}|${s.text}`));
  const fresh = incoming.filter((s) => !seen.has(`${Math.round(s.start * 10)}|${s.text}`));
  if (fresh.length === 0) return existing;
  return [...existing, ...fresh].sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * How the talking was shared: seconds spoken on each channel. MeetGeek sells this as the
 * talk-to-listen ratio; here it falls out of the two channels for nothing. Null when the call was not
 * recorded (one channel cannot tell anyone apart) or nobody has spoken yet.
 */
export function talkShare(segments: TranscriptSegment[]): { me: number; them: number; mine: number } | null {
  let me = 0;
  let them = 0;
  for (const s of segments) {
    const d = Math.max(0, s.end - s.start);
    if (s.speaker === 'me') me += d;
    else if (s.speaker === 'them') them += d;
  }
  if (me + them < 1) return null;
  return { me, them, mine: Math.round((me / (me + them)) * 100) };
}

/** "4:05", "1:02:03" — a position in a recording, the way every player writes it. */
export function formatStamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** The label a speaker is shown with. The person reading is "Me"; everyone on the call is "Them". */
export const SPEAKER_LABEL: Record<'me' | 'them', string> = { me: 'Me', them: 'Them' };

/**
 * Consecutive segments from the same speaker, as one turn — how a transcript is READ. A new turn
 * starts when the speaker changes, or after a pause long enough to be a new thought.
 */
export function turns(segments: TranscriptSegment[], gap = 8): { speaker: Speaker; start: number; end: number; segments: TranscriptSegment[] }[] {
  const out: { speaker: Speaker; start: number; end: number; segments: TranscriptSegment[] }[] = [];
  for (const s of segments) {
    const last = out.at(-1);
    if (last && last.speaker === s.speaker && s.start - last.end <= gap) {
      last.segments.push(s);
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ speaker: s.speaker, start: s.start, end: s.end, segments: [s] });
    }
  }
  return out;
}

/**
 * The transcript as the clerk reads it: one line per turn, "Me:" / "Them:" when known. The
 * meeting clerk's instructions already say the note-taker is whoever is labelled "Me", so a
 * recorded call arrives already telling it whose commitments are whose.
 */
export function transcriptText(segments: TranscriptSegment[]): string {
  return turns(segments)
    .map((t) => {
      const words = t.segments.map((s) => s.text).join(' ');
      return t.speaker ? `${SPEAKER_LABEL[t.speaker]}: ${words}` : words;
    })
    .join('\n');
}

/**
 * Names the recogniser should spell the way the client does, as the sentence Whisper's prompt
 * expects: the meeting, the client, their projects. Whisper reads roughly the last 224 tokens of
 * its prompt, so this stays short, and it is the only "custom vocabulary" anyone has to set up —
 * Zenboard already knows these names.
 */
export function vocabularyPrompt(input: { title?: string | null; client?: string | null; projects?: string[] }): string | undefined {
  const parts: string[] = [];
  const title = input.title?.trim();
  if (title && title.toLowerCase() !== 'meeting') parts.push(title.replace(/[.\s]+$/, ''));
  if (input.client?.trim()) parts.push(`with ${input.client.trim()}`);
  const projects = (input.projects ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 6);
  if (projects.length) parts.push(`about ${projects.join(', ')}`);
  const prompt = parts.join(' ').slice(0, 220).trim();
  return prompt ? `${prompt}.` : undefined;
}
