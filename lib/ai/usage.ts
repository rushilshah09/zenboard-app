import 'server-only';

// ── THE USAGE LEDGER ────────────────────────────────────────────────────────
//
// Every AI act is one row in `ai_usage` (migration 0045). The gateway reads it for two limits:
//
//   · A DAILY ALLOWANCE PER PERSON. The free pool is shared by everyone, so one person's afternoon
//     must not be everybody's outage. Counted in the person's own day, because "resets tomorrow"
//     has to mean their tomorrow.
//   · A GUARD ON WORKERS AI'S FREE POOL. Its 10,000 Neurons a day belong to the whole account and
//     reset at 00:00 UTC. Past the guard the gateway skips Workers AI and uses the fallback, so
//     Zenboard never starts spending money nobody decided to spend.
//
// UNTRACKED IS NOT BLOCKED. Until 0045 is applied every read fails, and a failed read answers
// `null` ("not tracked"), which the gateway treats as no limit. The alternative — refusing all AI
// because a ledger is missing — would make a bookkeeping table a switch for the whole feature.
// There is no probe query: the read IS the probe, so a request costs no extra round trip.
//
// Writes go through the service role only (the migration explains why a person may not write their
// own rows), and a failed write never fails the act it was recording.

import { createServiceClient } from '@/lib/supabase/server';
import { dayWindow, todayISO } from '@/lib/date';
import type { AIProviderId, AIUsage } from './provider';

/** One name per AI act, as it is recorded. Add a feature here before it can be recorded. */
export type AIFeature = 'meeting-items' | 'meeting-notes' | 'meeting-ask' | 'inbox-file' | 'draft' | 'transcribe' | 'ask';

/**
 * The features whose INPUT is somebody else's words, not the account holder's.
 *
 * A meeting transcript is another person speaking, recorded inside a working relationship they did
 * not licence to anybody. Everything else Zenboard sends is the person's own writing about their
 * own work. The gateway keeps a provider that trains on its inputs away from this set unless the
 * account holder opts in (lib/ai/gateway.ts `providersFor`).
 */
export const CLIENT_WORDS: ReadonlySet<AIFeature> = new Set<AIFeature>(['meeting-items', 'meeting-notes', 'meeting-ask', 'transcribe']);

/** Successful AI acts per person per day. Generous for real work; a wall for a runaway loop. */
export const DAILY_ALLOWANCE = 40;

/**
 * Audio a person may have transcribed per day, in seconds: two hours of meetings.
 *
 * Transcription is metered in AUDIO, not in acts — an hour of meeting is ~200 chunks, and counting
 * those against `DAILY_ALLOWANCE` would spend a whole day's AI on one call. Two hours is a heavy
 * meeting day for one person; the shared pool (and its guard) is what bounds everybody together.
 */
export const DAILY_AUDIO_SECONDS = 2 * 60 * 60;

/** Neurons of Workers AI's 10,000-a-day free pool after which the gateway stops drawing on it. */
export const POOL_GUARD_NEURONS = 9_000;

export type UsageRecord = {
  userId: string;
  feature: AIFeature;
  provider: AIProviderId;
  model: string;
  ok: boolean;
  usage: AIUsage;
  /** Seconds of audio this act transcribed (0046). Absent for everything that is not audio. */
  audioSeconds?: number;
};

export interface UsageLedger {
  /** Successful acts since the start of the person's day, or null when not tracked. */
  usedToday(userId: string, tz: string): Promise<number | null>;
  /** Seconds of audio transcribed for the person since the start of their day, or null. */
  audioToday(userId: string, tz: string): Promise<number | null>;
  /** Neurons drawn from Workers AI's pool since 00:00 UTC, or null when not tracked. */
  poolToday(): Promise<number | null>;
  record(row: UsageRecord): Promise<void>;
}

/** Midnight UTC: when Workers AI's free allocation resets, whatever zone anyone is in. */
export function utcDayStart(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export const ledger: UsageLedger = {
  async usedToday(userId, tz) {
    try {
      const { startISO } = dayWindow(todayISO(tz), tz);
      const { count, error } = await createServiceClient()
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('ok', true)
        // Transcription has its own allowance, in minutes: see DAILY_AUDIO_SECONDS.
        .neq('feature', 'transcribe')
        .gte('created_at', startISO);
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  },

  async audioToday(userId, tz) {
    try {
      const { startISO } = dayWindow(todayISO(tz), tz);
      // Summed here rather than in SQL: one person's day is a few hundred rows at most, and a
      // function for it would be one more thing the migration has to grant.
      const { data, error } = await createServiceClient()
        .from('ai_usage')
        .select('audio_seconds')
        .eq('user_id', userId)
        .eq('feature', 'transcribe')
        .eq('ok', true)
        .gte('created_at', startISO);
      if (error) return null;
      return ((data ?? []) as { audio_seconds: number | string | null }[])
        .reduce((n, r) => n + (Number(r.audio_seconds) || 0), 0);
    } catch {
      return null;
    }
  },

  async poolToday() {
    try {
      const { data, error } = await createServiceClient().rpc('ai_pool_neurons', { since: utcDayStart() });
      if (error) return null;
      const n = Number(data);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  },

  async record(row) {
    try {
      const base = {
        user_id: row.userId,
        feature: row.feature,
        provider: row.provider,
        model: row.model,
        ok: row.ok,
        input_tokens: Math.round(row.usage.inputTokens),
        output_tokens: Math.round(row.usage.outputTokens),
        neurons: row.usage.neurons ?? 0,
      };
      const db = createServiceClient();
      if (row.audioSeconds === undefined) {
        await db.from('ai_usage').insert(base);
        return;
      }
      const audio = Math.max(0, Math.round(row.audioSeconds * 100) / 100);
      const { error } = await db.from('ai_usage').insert({ ...base, audio_seconds: audio });
      // Before 0046 there is no audio column. The row still matters — its Neurons feed the pool
      // guard — so it is written without the column rather than lost.
      if (error) await db.from('ai_usage').insert(base);
    } catch {
      // The ledger is bookkeeping. Losing one row is better than failing the act it describes.
    }
  },
};
