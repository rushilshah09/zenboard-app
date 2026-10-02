// POST /api/meetings/:id/transcribe — one chunk of a meeting's audio in, its words with times out.
//
// A ROUTE, NOT A SERVER ACTION, on purpose: Next runs server actions one at a time per page, and a
// chunk takes a few seconds to transcribe — as an action, every note saved and every task made
// during a meeting would wait behind the recorder. Routes run beside them.
//
// What it guards, in order: the request comes from this site (a route does not get the Origin check
// a server action does), the session is live, the audio is a container a browser records in and
// small enough to be one chunk, the meeting is the caller's (RLS), and the person has allowance
// left (lib/ai/transcribe.ts). Nothing is stored here: the audio is gone when the response is, and
// the words go back to the recorder, which owns the transcript.

import { requireSession } from '@/lib/auth';
import { userTimezone } from '@/lib/user-tz';
import { AUDIO_TYPES, MAX_CHUNK_BYTES, MAX_CHUNK_SECONDS, transcribe } from '@/lib/ai/transcribe';
import { vocabularyPrompt, type TranscribeProblem } from '@/lib/meeting-transcript';

export const dynamic = 'force-dynamic';

const STATUS: Record<TranscribeProblem, number> = {
  forbidden: 403, auth: 401, format: 415, 'too-long': 413, empty: 400, missing: 404,
  limit: 429, unavailable: 503, invalid: 502, offline: 503, migration: 503,
};

const refuse = (reason: TranscribeProblem) => Response.json({ reason }, { status: STATUS[reason] });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return refuse('forbidden');
    } catch {
      return refuse('forbidden');
    }
  }

  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession();
  } catch {
    return refuse('auth');
  }
  const { supabase, user } = session;
  const { id } = await params;

  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(AUDIO_TYPES as readonly string[]).includes(mime)) return refuse('format');

  const seconds = Number(req.headers.get('x-audio-seconds'));
  if (!Number.isFinite(seconds) || seconds <= 0) return refuse('empty');
  if (seconds > MAX_CHUNK_SECONDS) return refuse('too-long');

  const languageHeader = req.headers.get('x-language');
  const language = languageHeader && /^[a-z]{2,3}$/.test(languageHeader) ? languageHeader : undefined;

  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.byteLength > MAX_CHUNK_BYTES) return refuse('too-long');
  if (audio.byteLength < 256) return refuse('empty');

  const { data: meeting } = await supabase.from('meetings').select('id, title, client_id').eq('id', id).maybeSingle();
  if (!meeting) return refuse('missing');
  const m = meeting as { id: string; title: string; client_id: string | null };

  // The names worth spelling right, and the zone "today" is counted in — one round trip for all three.
  const [client, projects, timeZone] = await Promise.all([
    m.client_id ? supabase.from('clients').select('name').eq('id', m.client_id).maybeSingle() : Promise.resolve({ data: null }),
    m.client_id ? supabase.from('projects').select('name').eq('client_id', m.client_id).limit(6) : Promise.resolve({ data: [] }),
    userTimezone(),
  ]);

  const res = await transcribe({
    audio,
    mime,
    seconds,
    language,
    vocabulary: vocabularyPrompt({
      title: m.title,
      client: (client.data as { name: string } | null)?.name ?? null,
      projects: ((projects.data ?? []) as { name: string }[]).map((p) => p.name),
    }),
    userId: user.id,
    timeZone,
  });
  if (!res.ok) return refuse(res.reason);

  return Response.json({
    segments: res.data.segments.map(({ start, end, text }) => ({ start, end, text })),
    language: res.data.language,
    duration: res.data.duration,
  });
}
