'use client';
// ── THE RECORDING, APP-WIDE ─────────────────────────────────────────────────
//
// One recording at a time, owned by the page rather than by any screen: start it from a meeting,
// go and look at the client's invoices, come back — it has kept recording, and the transcript has
// kept growing (MEETINGS_PLAN.md, stage M1). Mounted through <RecorderHost> once in the app shell,
// exactly like the focus timer, and read through the hooks at the bottom.
//
// THE PIPELINE, piece by piece:
//   recorder cuts a piece at a pause → written to the device (lib/meeting-chunk-queue.ts) → sent to
//   /api/meetings/:id/transcribe → words placed on the meeting's clock and attributed Me/Them
//   (lib/meeting-transcript.ts) → merged into the meeting's transcript → saved (debounced).
// A piece leaves the device only once its words are in the transcript.
//
// WHAT GOES WRONG IN REAL MEETINGS, and what happens:
//   · offline / transcription busy → the piece waits, retried with backoff; recording carries on.
//   · the day's allowance is used → waits for it to come back; nothing is lost.
//   · the session expires → stops sending; the pieces finish after the next sign-in.
//   · the tab is closed mid-meeting → the next page load finds the pieces and finishes them. Pieces a
//     LIVE tab is still sending are not touched: every tab holds a lock for its lifetime, and only a
//     piece whose tab no longer holds one is picked up.
//   · migration 0046 is not applied → the live transcript still shows; it just cannot be kept, and
//     the meeting says so.

import { useSyncExternalStore } from 'react';

import { loadMeetingTranscript, saveMeetingTranscript } from '@/lib/actions/meetings';
import { dequeue, enqueue, markAttempt, waiting, type QueuedChunk } from '@/lib/meeting-chunk-queue';
import { MeetingRecorder, openSources, recorderSupport, type RecordedChunk, type RecorderWarning } from '@/lib/meeting-recorder';
import {
  mergeSegments, placeSegments, retryableProblem, type HeardSegment, type TranscribeProblem, type TranscriptSegment,
} from '@/lib/meeting-transcript';

export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'paused';
export type StartError = 'denied' | 'no-device' | 'unsupported' | 'busy';

export type RecordingState = {
  status: RecordingStatus;
  meetingId: string | null;
  title: string;
  withCall: boolean;
  /** Seconds recorded, pauses excluded; updates once a second. */
  elapsed: number;
  warning: RecorderWarning | null;
  startError: StartError | null;
  /** The transcription problem still standing, cleared by the next piece that succeeds. */
  problem: TranscribeProblem | null;
};

export type MeetingTranscriptState = {
  segments: TranscriptSegment[];
  language: string | null;
  /** Seconds of meeting covered. */
  duration: number;
  /** 'loading' while the saved transcript is fetched; words recorded meanwhile are kept and merged. */
  loaded: 'no' | 'loading' | 'yes';
  /** False once a save said 0046 is missing: shown for this visit, not kept. */
  saves: boolean;
  /** Pieces of this meeting still waiting for their words. */
  pending: number;
};

const EMPTY_TRANSCRIPT: MeetingTranscriptState = { segments: [], language: null, duration: 0, loaded: 'no', saves: true, pending: 0 };

// ── Stores ───────────────────────────────────────────────────────────────────

function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) { value = next; listeners.forEach((l) => l()); },
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

const IDLE: RecordingState = { status: 'idle', meetingId: null, title: '', withCall: false, elapsed: 0, warning: null, startError: null, problem: null };
const recording = store<RecordingState>(IDLE);
const levels = store<{ me: number; them: number | null }>({ me: 0, them: null });
const transcripts = store<Record<string, MeetingTranscriptState>>({});

const patch = (p: Partial<RecordingState>) => recording.set({ ...recording.get(), ...p });

function patchTranscript(meetingId: string, p: Partial<MeetingTranscriptState> | ((t: MeetingTranscriptState) => Partial<MeetingTranscriptState>)) {
  const all = transcripts.get();
  const cur = all[meetingId] ?? EMPTY_TRANSCRIPT;
  transcripts.set({ ...all, [meetingId]: { ...cur, ...(typeof p === 'function' ? p(cur) : p) } });
}

// ── Recording ────────────────────────────────────────────────────────────────

let recorder: MeetingRecorder | null = null;
/** This page load. A piece carries it, so another tab can tell a live piece from a left-over one. */
const TAB = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const OWNER = (tab: string) => `zb-rec-owner:${tab}`;

/**
 * Start recording a meeting. Must be called from the click itself: the browser only offers the
 * call's tab to share inside a user gesture.
 */
export async function startRecording(meeting: { id: string; title: string }, withCall: boolean): Promise<void> {
  const cur = recording.get();
  if (cur.status !== 'idle') { patch({ startError: 'busy' }); return; }
  const support = recorderSupport();
  if (!support.record) { patch({ startError: 'unsupported' }); return; }

  recording.set({ ...IDLE, status: 'starting', meetingId: meeting.id, title: meeting.title, withCall: withCall && support.callAudio });
  let sources: Awaited<ReturnType<typeof openSources>>;
  try {
    sources = await openSources(withCall && support.callAudio);
  } catch (e) {
    const name = (e as { name?: string })?.name;
    recording.set({ ...IDLE, startError: name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-device' : 'denied' });
    return;
  }

  const r = new MeetingRecorder(sources, {
    onChunk: (c) => { void accept(meeting.id, c); },
    onLevels: (me, them, elapsed) => {
      levels.set({ me, them });
      if (Math.floor(elapsed) !== Math.floor(recording.get().elapsed)) patch({ elapsed });
    },
    onWarning: (w) => patch({ warning: w }),
    onEnded: () => {
      recorder = null;
      levels.set({ me: 0, them: null });
      recording.set({ ...IDLE, problem: recording.get().problem });
    },
  });
  try {
    await r.start();
  } catch {
    sources.mic.getTracks().forEach((t) => t.stop());
    sources.call?.getTracks().forEach((t) => t.stop());
    recording.set({ ...IDLE, startError: 'unsupported' });
    return;
  }
  recorder = r;
  patch({ status: 'recording', warning: sources.warning ?? null, withCall: Boolean(sources.call) });
  void ensureLoaded(meeting.id);
}

export function pauseRecording(): void {
  if (!recorder || recording.get().status !== 'recording') return;
  recorder.pause();
  patch({ status: 'paused' });
}

export function resumeRecording(): void {
  if (!recorder || recording.get().status !== 'paused') return;
  recorder.resume();
  patch({ status: 'recording' });
}

/** Stop at once. The last pieces carry on being transcribed after the recording is over. */
export async function stopRecording(): Promise<void> {
  const r = recorder;
  const meetingId = recording.get().meetingId;
  recorder = null;
  recording.set({ ...IDLE, problem: recording.get().problem });
  levels.set({ me: 0, them: null });
  if (r) await r.stop();
  if (meetingId) {
    finishing.add(meetingId);
    void settle(meetingId);
  }
}

// ── When a recording is fully done ───────────────────────────────────────────
//
// "Done" is later than Stop: the last pieces are still being transcribed, and the transcript still
// has to be saved before anything on the server can read it. Listeners hear about a meeting once,
// at that moment — which is when the write-up (MEETINGS_PLAN.md M2) is worth asking for.

const finishing = new Set<string>();
const finishedListeners = new Set<(meetingId: string) => void>();

/** Hear when a stopped recording's last words are in and saved. Returns the unsubscribe. */
export function onRecordingFinished(cb: (meetingId: string) => void): () => void {
  finishedListeners.add(cb);
  return () => { finishedListeners.delete(cb); };
}

async function settle(meetingId: string): Promise<void> {
  if (!finishing.has(meetingId) || queue.some((q) => q.meetingId === meetingId)) return;
  finishing.delete(meetingId);
  const t = timers.get(meetingId);
  if (t) { clearTimeout(t); timers.delete(meetingId); }
  await save(meetingId);
  finishedListeners.forEach((cb) => cb(meetingId));
}

export function clearStartError(): void {
  patch({ startError: null });
}

// ── Pieces → words ───────────────────────────────────────────────────────────

let queue: QueuedChunk[] = [];
let pumping = false;
let blockedUntil = 0;
let halted = false;
let failures = 0;
let wake: ReturnType<typeof setTimeout> | null = null;

function countPending() {
  const by: Record<string, number> = {};
  for (const c of queue) by[c.meetingId] = (by[c.meetingId] ?? 0) + 1;
  const all = transcripts.get();
  const ids = new Set([...Object.keys(all), ...Object.keys(by)]);
  for (const id of ids) if ((all[id]?.pending ?? 0) !== (by[id] ?? 0)) patchTranscript(id, { pending: by[id] ?? 0 });
}

async function accept(meetingId: string, c: RecordedChunk): Promise<void> {
  const piece: QueuedChunk = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    meetingId, owner: TAB, created: Date.now(), attempts: 0,
    blob: c.blob, mime: c.mime, start: c.start, end: c.end, me: c.me, them: c.them, levels: c.levels,
  };
  queue.push(piece);
  countPending();
  await enqueue(piece);
  pump();
}

function later(ms: number) {
  if (wake) clearTimeout(wake);
  wake = setTimeout(() => { wake = null; pump(); }, ms);
}

function pump(): void {
  if (pumping || halted || queue.length === 0) return;
  const wait = blockedUntil - Date.now();
  if (wait > 0) { later(wait); return; }
  pumping = true;
  void drain().finally(() => { pumping = false; });
}

type Outcome = { ok: true; segments: HeardSegment[]; language: string | null } | { ok: false; reason: TranscribeProblem };

async function send(c: QueuedChunk): Promise<Outcome> {
  try {
    const res = await fetch(`/api/meetings/${encodeURIComponent(c.meetingId)}/transcribe`, {
      method: 'POST',
      headers: { 'content-type': c.mime, 'x-audio-seconds': String(Math.max(0.1, c.end - c.start)) },
      body: c.blob,
    });
    const body = await res.json().catch(() => null) as { segments?: HeardSegment[]; language?: string | null; reason?: TranscribeProblem } | null;
    if (res.ok && body && Array.isArray(body.segments)) return { ok: true, segments: body.segments, language: body.language ?? null };
    return { ok: false, reason: body?.reason ?? (res.status >= 500 ? 'unavailable' : 'invalid') };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

async function drain(): Promise<void> {
  while (queue.length && !halted) {
    const wait = blockedUntil - Date.now();
    if (wait > 0) { later(wait); return; }
    const c = queue[0];
    const out = await send(c);

    if (out.ok) {
      failures = 0;
      await ensureLoaded(c.meetingId);
      const placed = placeSegments(out.segments, c.start, { me: c.me, them: c.them }, (i) => `${c.id.slice(0, 8)}-${i}`, c.levels);
      patchTranscript(c.meetingId, (t) => ({
        segments: mergeSegments(t.segments, placed),
        duration: Math.max(t.duration, c.end),
        language: t.language ?? out.language,
      }));
      await done(c);
      if (recording.get().problem) patch({ problem: null });
      scheduleSave(c.meetingId);
      continue;
    }

    const reason = out.reason;
    if (reason === 'auth') {
      // Nothing will succeed until a new sign-in. The pieces stay on the device and finish then.
      halted = true;
      patch({ problem: 'auth' });
      return;
    }
    if (reason === 'missing') {
      for (const x of queue.filter((q) => q.meetingId === c.meetingId)) await done(x);
      patch({ problem: 'missing' });
      continue;
    }
    if (reason === 'limit') {
      patch({ problem: 'limit' });
      blockedUntil = Date.now() + 15 * 60_000;
      later(15 * 60_000);
      return;
    }
    if (retryableProblem(reason)) {
      failures += 1;
      if (reason === 'invalid') {
        const again = await markAttempt(c);
        queue[0] = again;
        // A piece the transcriber cannot read three times will not be read the fourth.
        if (again.attempts >= 3) { await done(again); patch({ problem: 'invalid' }); continue; }
      }
      patch({ problem: reason });
      const backoff = Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5));
      blockedUntil = Date.now() + backoff;
      later(backoff);
      return;
    }
    // format · too-long · empty · forbidden · migration: sending this piece again will not help.
    await done(c);
    if (reason !== 'empty') patch({ problem: reason });
  }
}

async function done(c: QueuedChunk) {
  queue = queue.filter((q) => q.id !== c.id);
  countPending();
  await dequeue(c.id);
  // A save for a meeting whose words are all in: scheduled saves are flushed by `settle`.
  if (finishing.has(c.meetingId)) void settle(c.meetingId);
}

/** Back online: whatever was waiting on the network goes now. */
export function onReconnect(): void {
  if (recording.get().problem === 'offline' || blockedUntil > Date.now()) {
    blockedUntil = 0;
    failures = 0;
    pump();
  }
}

/**
 * Pieces left on this device by a page that is gone — closed mid-meeting, crashed, signed out. Every
 * live tab holds a lock named for itself; a piece whose tab holds none has nobody finishing it.
 * Claimed under a lock of its own, so two new tabs never both take the same pieces.
 */
export async function adoptLeftovers(): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const claim = async () => {
    const held = locks ? new Set(((await locks.query()).held ?? []).map((l) => l.name)) : new Set<string>();
    const mine = new Set(queue.map((q) => q.id));
    const orphans = (await waiting()).filter((c) => !mine.has(c.id) && c.owner !== TAB && !held.has(OWNER(c.owner)));
    for (const c of orphans) {
      const adopted = { ...c, owner: TAB };
      await enqueue(adopted);
      queue.push(adopted);
    }
    if (orphans.length) { countPending(); pump(); }
  };
  if (locks) await locks.request('zb-rec-claim', claim);
  else await claim();
}

/** Hold this tab's liveness lock for as long as the page lives. */
export function holdOwnership(): void {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return;
  void locks.request(OWNER(TAB), () => new Promise<void>(() => {}));
}

// ── The saved transcript ─────────────────────────────────────────────────────

const loading = new Map<string, Promise<void>>();

/**
 * Fetch a meeting's saved transcript once, and merge it under whatever was recorded meanwhile —
 * a save must never replace a transcript it has not seen.
 */
export function ensureLoaded(meetingId: string): Promise<void> {
  const cur = transcripts.get()[meetingId];
  if (cur?.loaded === 'yes') return Promise.resolve();
  const inflight = loading.get(meetingId);
  if (inflight) return inflight;
  patchTranscript(meetingId, { loaded: 'loading' });
  const p = (async () => {
    try {
      const res = await loadMeetingTranscript(meetingId);
      const saved = res.transcript;
      patchTranscript(meetingId, (t) => ({
        loaded: 'yes',
        saves: res.supported,
        segments: saved ? mergeSegments(saved.segments, t.segments) : t.segments,
        duration: Math.max(t.duration, saved?.duration ?? 0),
        language: t.language ?? saved?.language ?? null,
      }));
    } catch {
      // Offline, or signed out: what is recorded is still shown; the next piece tries the load again.
      patchTranscript(meetingId, { loaded: 'no' });
    } finally {
      loading.delete(meetingId);
    }
  })();
  loading.set(meetingId, p);
  return p;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(meetingId: string, delay = 3_000): void {
  const t = timers.get(meetingId);
  if (t) clearTimeout(t);
  timers.set(meetingId, setTimeout(() => { timers.delete(meetingId); void save(meetingId); }, delay));
}

async function save(meetingId: string): Promise<void> {
  const t = transcripts.get()[meetingId];
  if (!t || t.loaded !== 'yes' || !t.saves || t.segments.length === 0) return;
  try {
    const res = await saveMeetingTranscript(meetingId, { segments: t.segments, language: t.language, duration: t.duration });
    if ('error' in res) {
      if (res.reason === 'migration') patchTranscript(meetingId, { saves: false });
      else scheduleSave(meetingId, 20_000);
    }
  } catch {
    scheduleSave(meetingId, 20_000);
  }
}

/** Anything unsaved goes now — the page is being hidden and may not come back. */
export function flushSaves(): void {
  for (const [id, t] of timers) { clearTimeout(t); timers.delete(id); void save(id); }
}

export function isRecordingActive(): boolean {
  const s = recording.get().status;
  return s === 'recording' || s === 'paused' || s === 'starting';
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useRecording(): RecordingState {
  return useSyncExternalStore(recording.subscribe, recording.get, () => IDLE);
}

const SILENT = { me: 0, them: null };
export function useRecordingLevels(): { me: number; them: number | null } {
  return useSyncExternalStore(levels.subscribe, levels.get, () => SILENT);
}

const NONE: Record<string, MeetingTranscriptState> = {};
export function useMeetingTranscript(meetingId: string): MeetingTranscriptState {
  const all = useSyncExternalStore(transcripts.subscribe, transcripts.get, () => NONE);
  return all[meetingId] ?? EMPTY_TRANSCRIPT;
}
