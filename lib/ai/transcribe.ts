import 'server-only';

// ── TRANSCRIPTION ───────────────────────────────────────────────────────────
//
// Audio → words with times, for the meeting recorder (MEETINGS_PLAN.md, stage M1). The text gateway
// (lib/ai/gateway.ts) answers with validated JSON; this is its twin for audio, and it keeps every
// rule the gateway has: one chain, the shared-pool guard, a per-person allowance, every attempt on
// the ledger, and nothing a provider says reaches anyone without being checked.
//
// THE MODEL: Whisper large-v3-turbo, open weights (MIT), run by Workers AI on the free plan and by
// Groq's free tier — the same weights on both, so a fallback never changes what the person reads,
// and neither host trains on what it is sent. Measured on the account 2026-09-29 against a
// three-sentence test conversation: WebM/Opus, WAV and MP3 all accepted; word timestamps and the
// language returned; ~2 s for 14 s of speech; 10.73 Neurons (46.6 a minute); and a vocabulary prompt
// spelled "Meridian" the way the client does.
//
// WHY ON THE SERVER, reversing 2026-09-27's "audio stays on the device": at browser size Whisper is
// the weakest option measured (whisper-base.en WER 10.32 against large-v3's 7.44), and the brief is
// a notetaker as good as Granola or Otter. The cost is bounded instead: two hours of audio a person a
// day, and the pool guard that already protects the text features.
//
// AUDIO IS NEVER KEPT. It arrives, is transcribed, and is gone with the request.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { z } from 'zod';

import { chainFor } from './gateway';
import type { AIProviderId, AIUsage } from './provider';
import { DAILY_AUDIO_SECONDS, ledger, type UsageLedger } from './usage';

export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';
export const GROQ_TRANSCRIBE_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';

/** Cloudflare's published price, used only when a response does not report its own. */
export const WHISPER_NEURONS_PER_MINUTE = 46.63;

/** One request is one chunk of a meeting — seconds, not minutes. Anything bigger is refused. */
export const MAX_CHUNK_SECONDS = 60;
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

/** The containers a browser records in, plus the ones a file upload may bring. */
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4'] as const;

export type Word = { word: string; start: number; end: number };
/** One stretch of speech, timed in seconds from the start of the chunk it came from. */
export type Heard = { start: number; end: number; text: string; words: Word[] };
export type Transcription = { segments: Heard[]; language: string | null; duration: number };

export type TranscribeFailure =
  /** This person has transcribed today's allowance of audio. */
  | 'limit'
  /** No host could be reached, or the shared pool is spent and nothing else can answer. */
  | 'unavailable'
  /** A host answered with something that is not a transcript. */
  | 'invalid';

export type TranscribeResult =
  | { ok: true; data: Transcription; provider: AIProviderId }
  | { ok: false; reason: TranscribeFailure };

export type TranscribeRequest = {
  audio: Uint8Array;
  /** The container, as the browser named it. Parameters (`;codecs=opus`) are ignored. */
  mime: string;
  /** How long the chunk is, measured by the recorder — used to refuse BEFORE spending anything. */
  seconds: number;
  /** ISO 639-1, when the meeting's language is already known. Absent = detect. */
  language?: string;
  /** Names worth spelling right: the client, their projects, the meeting's title. */
  vocabulary?: string;
  userId: string;
  timeZone: string;
};

/** A host that turns audio into a transcript. */
export interface Transcriber {
  id: AIProviderId;
  model: string;
  available(): boolean;
  transcribe(req: Pick<TranscribeRequest, 'audio' | 'mime' | 'language' | 'vocabulary'>): Promise<{ raw: unknown; neurons: number | null }>;
}

// ── Reading what a host said ─────────────────────────────────────────────────

const num = z.number().finite().nonnegative();
const rawWord = z.object({ word: z.string(), start: num, end: num });
const rawSegment = z.object({ start: num, end: num, text: z.string(), words: z.array(rawWord).optional() });

/** Workers AI's shape and Groq's verbose_json both carry these; anything else fails the attempt. */
const rawTranscription = z.object({
  segments: z.array(rawSegment).default([]),
  /** Groq puts words at the top level, not inside segments. */
  words: z.array(rawWord).optional(),
  language: z.string().optional(),
  duration: num.optional(),
  transcription_info: z.object({ language: z.string().optional(), duration: num.optional() }).optional(),
});

/** Whisper names a language in full on some hosts ("english") and by code on others ("en"). */
const LANGUAGE_CODES: Record<string, string> = {
  english: 'en', hindi: 'hi', spanish: 'es', french: 'fr', german: 'de', portuguese: 'pt',
  italian: 'it', dutch: 'nl', japanese: 'ja', chinese: 'zh', korean: 'ko', arabic: 'ar',
  russian: 'ru', turkish: 'tr', marathi: 'mr', gujarati: 'gu', tamil: 'ta', telugu: 'te',
  bengali: 'bn', urdu: 'ur', kannada: 'kn', malayalam: 'ml', punjabi: 'pa',
};

export function languageCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (/^[a-z]{2,3}$/.test(v)) return v;
  return LANGUAGE_CODES[v] ?? null;
}

/**
 * A host's answer as a Transcription, or null when it is not one. Text is trimmed, empty stretches
 * dropped, times put in order, and words re-homed into the stretch they fall in (Groq lists them
 * separately). Nothing is invented: a segment without words keeps an empty list.
 */
export function readTranscription(raw: unknown): Transcription | null {
  const parsed = rawTranscription.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const loose = (r.words ?? []).map((w) => ({ word: w.word.trim(), start: w.start, end: Math.max(w.start, w.end) }));

  const segments: Heard[] = [];
  for (const s of r.segments) {
    const text = s.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = s.start;
    const end = Math.max(s.start, s.end);
    const words = (s.words
      ? s.words.map((w) => ({ word: w.word.trim(), start: w.start, end: Math.max(w.start, w.end) }))
      : loose.filter((w) => w.start >= start - 0.05 && w.start < end + 0.05)
    ).filter((w) => w.word);
    segments.push({ start, end, text, words });
  }
  segments.sort((a, b) => a.start - b.start);

  const duration = r.transcription_info?.duration ?? r.duration ?? (segments.at(-1)?.end ?? 0);
  return { segments, language: languageCode(r.transcription_info?.language ?? r.language), duration };
}

// ── The hosts ────────────────────────────────────────────────────────────────

type Binding = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };

function binding(): Binding | undefined {
  try {
    return (getCloudflareContext().env as { AI?: Binding }).AI;
  } catch {
    return undefined;
  }
}

const baseType = (mime: string) => mime.split(';')[0].trim().toLowerCase();

/** Whisper on Workers AI. `getBinding` is injectable for the live evaluation, like the text provider. */
export function workersWhisper(getBinding: () => Binding | undefined = binding): Transcriber {
  return {
    id: 'workers-ai',
    model: WHISPER_MODEL,
    available: () => Boolean(getBinding()),
    async transcribe(req) {
      const run = getBinding();
      if (!run) throw new Error('Workers AI binding "AI" is missing.');
      const out = await run.run(WHISPER_MODEL, {
        audio: Buffer.from(req.audio).toString('base64'),
        ...(req.language && { language: req.language }),
        ...(req.vocabulary && { initial_prompt: req.vocabulary }),
        // Skips the silences Whisper otherwise fills with "Thank you." — its best-known invention.
        vad_filter: true,
      }) as { usage?: { neurons?: unknown } };
      const neurons = typeof out?.usage?.neurons === 'number' ? out.usage.neurons : null;
      return { raw: out, neurons };
    },
  };
}

/** Whisper on Groq's free tier. Exists only when GROQ_API_KEY does. */
export const groqWhisper: Transcriber = {
  id: 'groq',
  model: GROQ_WHISPER_MODEL,
  available: () => Boolean((process.env.GROQ_API_KEY ?? '').trim()),
  async transcribe(req) {
    const key = (process.env.GROQ_API_KEY ?? '').trim();
    if (!key) throw new Error('GROQ_API_KEY is not set.');
    const type = baseType(req.mime);
    const ext = type.split('/')[1]?.replace('x-', '').replace('mpeg', 'mp3') ?? 'webm';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(req.audio)], { type }), `chunk.${ext}`);
    form.append('model', GROQ_WHISPER_MODEL);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    form.append('timestamp_granularities[]', 'word');
    form.append('temperature', '0');
    if (req.language) form.append('language', req.language);
    if (req.vocabulary) form.append('prompt', req.vocabulary);
    const res = await fetch(GROQ_TRANSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    // The status only: an error body can echo what was sent, and what was sent is a client speaking.
    if (!res.ok) throw new Error(`Groq answered ${res.status}.`);
    return { raw: await res.json(), neurons: null };
  },
};

// ── The chain ────────────────────────────────────────────────────────────────

export type TranscribeDeps = { transcribers: Transcriber[]; ledger: UsageLedger };
// Groq first: measured 0.37 s for 13.8 s of speech, with word timings, on its own free quota (8 audio
// hours a day) — which leaves Workers AI's shared 10,000 Neurons for text. Workers AI's Whisper, the
// same weights, is the fallback.
const DEFAULTS: TranscribeDeps = { transcribers: [groqWhisper, workersWhisper()], ledger };

const NO_TOKENS: Pick<AIUsage, 'inputTokens' | 'outputTokens'> = { inputTokens: 0, outputTokens: 0 };

export async function transcribe(req: TranscribeRequest, deps: TranscribeDeps = DEFAULTS): Promise<TranscribeResult> {
  const available = deps.transcribers.filter((t) => t.available());
  if (available.length === 0) return { ok: false, reason: 'unavailable' };

  const seconds = Math.min(Math.max(req.seconds, 0), MAX_CHUNK_SECONDS);
  const [used, pool] = await Promise.all([
    deps.ledger.audioToday(req.userId, req.timeZone),
    available.some((t) => t.id === 'workers-ai') ? deps.ledger.poolToday() : Promise.resolve(null),
  ]);
  if (used !== null && used + seconds > DAILY_AUDIO_SECONDS) return { ok: false, reason: 'limit' };

  const chain = chainFor(available, pool);
  if (chain.length === 0) return { ok: false, reason: 'unavailable' };

  let answeredBadly = false;
  for (const t of chain) {
    const row = { userId: req.userId, feature: 'transcribe' as const, provider: t.id, model: t.model };
    let raw: unknown;
    let neurons: number | null;
    try {
      ({ raw, neurons } = await t.transcribe(req));
    } catch {
      await deps.ledger.record({ ...row, ok: false, usage: { ...NO_TOKENS, neurons: null }, audioSeconds: 0 });
      continue;
    }
    const heard = readTranscription(raw);
    const audioSeconds = heard?.duration || seconds;
    // Workers AI reports what it billed; otherwise the published rate stands in, so the pool guard
    // never undercounts a call it did not see the bill for.
    const billed = t.id === 'workers-ai' ? (neurons ?? (audioSeconds / 60) * WHISPER_NEURONS_PER_MINUTE) : null;
    await deps.ledger.record({ ...row, ok: heard !== null, usage: { ...NO_TOKENS, neurons: billed }, audioSeconds });
    if (heard) return { ok: true, data: heard, provider: t.id };
    answeredBadly = true;
  }
  return { ok: false, reason: answeredBadly ? 'invalid' : 'unavailable' };
}
