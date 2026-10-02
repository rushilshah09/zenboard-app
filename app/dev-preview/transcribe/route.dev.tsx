// DEV ONLY — `.dev.tsx` is a route extension only under `next dev` (next.config.ts), so no
// production build ever contains this file. It exists so the meeting recorder can be verified end to
// end without a session: the real recorder, the real Whisper, the real attribution — only the
// sign-in and the allowance are skipped (there is no user to count against).
//
//   GET  → the two-voice test conversation (test/fixtures/meeting-two-voices.webm): the note-taker
//          on the LEFT channel, the client on the RIGHT, five turns with pauses between them. The
//          clients harness plays the left channel as a fake microphone and the right as a fake
//          shared call (`?fakemic=1`).
//   POST → one piece of a recording, transcribed by the production chain exactly as
//          /api/meetings/:id/transcribe would, minus the session and the ledger.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AUDIO_TYPES, MAX_CHUNK_SECONDS, groqWhisper, transcribe, workersWhisper } from '@/lib/ai/transcribe';
import type { UsageLedger } from '@/lib/ai/usage';

export const dynamic = 'force-dynamic';

const NO_LEDGER: UsageLedger = {
  usedToday: async () => null,
  audioToday: async () => null,
  poolToday: async () => null,
  record: async () => {},
};

export async function GET() {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const audio = await readFile(join(process.cwd(), 'test/fixtures/meeting-two-voices.webm'));
  return new Response(new Uint8Array(audio), { headers: { 'content-type': 'audio/webm', 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(AUDIO_TYPES as readonly string[]).includes(mime)) return Response.json({ reason: 'format' }, { status: 415 });
  const seconds = Number(req.headers.get('x-audio-seconds'));
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_CHUNK_SECONDS) return Response.json({ reason: 'too-long' }, { status: 413 });
  const audio = new Uint8Array(await req.arrayBuffer());
  const res = await transcribe(
    { audio, mime, seconds, vocabulary: 'Brand refresh kickoff with Meridian Studio.', userId: 'dev-preview', timeZone: 'UTC' },
    // The production order — Groq first, Workers AI behind it — so this checks the chain users get.
    { transcribers: [groqWhisper, workersWhisper()], ledger: NO_LEDGER },
  );
  if (!res.ok) return Response.json({ reason: res.reason }, { status: 503 });
  return Response.json({
    segments: res.data.segments.map(({ start, end, text }) => ({ start, end, text })),
    language: res.data.language,
    duration: res.data.duration,
  });
}
