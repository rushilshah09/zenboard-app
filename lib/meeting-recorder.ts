// ── THE MEETING RECORDER (browser) ──────────────────────────────────────────
//
// Captures a meeting the way Granola does — no bot joins the call — and hands it over in pieces
// small enough to transcribe while the meeting is still going (MEETINGS_PLAN.md, stage M1).
//
//   · TWO CHANNELS. The microphone (you) and, when you share it, the call's tab (everyone else).
//     They are mixed for the recording and measured SEPARATELY, ten times a second, which is how
//     the transcript can say who spoke without a diarisation model guessing (lib/meeting-transcript.ts).
//   · PIECES CUT AT PAUSES. A piece ends at the first pause after 6 s, or at 18 s whatever happens,
//     so the recogniser always gets whole sentences and the transcript arrives in step with the talk.
//     Each piece is a complete audio file (a fresh MediaRecorder per piece), because a slice of a
//     running recording is not something any recogniser can open.
//   · SILENCE IS NEVER SENT. A piece nobody spoke in is dropped here: it costs the shared pool
//     nothing, and it is where Whisper would otherwise invent a "Thank you."
//   · THE CLOCK IS THE AUDIO THREAD'S. Levels are measured in an AudioWorklet, not a timer: during a
//     call the Zenboard tab is usually in the background, where the browser slows timers to once a
//     minute — a timer-driven recorder would stop cutting pieces exactly when it is needed.
//
// Browser-only; nothing here runs on the server or touches the network.

import { ENERGY_STEP_MS, SPEECH_RMS } from '@/lib/meeting-transcript';

/** A piece of the meeting, ready to transcribe. Times are on the recording clock (pauses excluded). */
export type RecordedChunk = {
  blob: Blob;
  mime: string;
  start: number;
  end: number;
  /** Loudness during this piece, one reading per ENERGY_STEP_MS from its start. */
  me: number[];
  them: number[] | null;
  /** The recording's speaking level per channel when the piece was cut (see `speakingLevel`). */
  levels: { me: number; them: number };
};

export type RecorderWarning =
  /** Seconds in, and the microphone has heard nothing: muted, or the wrong device. */
  | 'silent-mic'
  /** The call's tab was shared without its sound ("Share tab audio" was off). */
  | 'call-no-audio'
  /** Sharing the call's tab was cancelled or stopped; recording carries on from the microphone. */
  | 'call-ended';

export type RecorderEvents = {
  onChunk(chunk: RecordedChunk): void;
  /** Ten times a second while recording: each channel's loudness (0..1 RMS). */
  onLevels?(me: number, them: number | null, elapsed: number): void;
  onWarning?(warning: RecorderWarning): void;
  /** The microphone went away (unplugged, permission revoked). The recording has stopped. */
  onEnded?(): void;
};

export const MIN_CHUNK_SECONDS = 6;
export const MAX_CHUNK_SECONDS = 18;
/** A pause at least this long ends a piece, once it is long enough to be one. */
export const CUT_SILENCE_SECONDS = 0.45;

/** Containers MediaRecorder may produce, best first. Safari records MP4/AAC, everyone else Opus. */
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function recordingMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** Can this browser record a meeting at all, and can it hear the call's tab too? */
export function recorderSupport(): { record: boolean; callAudio: boolean } {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const record = Boolean(md?.getUserMedia) && recordingMime() !== null && typeof AudioWorkletNode !== 'undefined';
  // Safari offers getDisplayMedia but never its audio; asking would share a silent tab.
  const safari = typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
  const mobile = typeof navigator !== 'undefined' && /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  return { record, callAudio: record && Boolean(md?.getDisplayMedia) && !safari && !mobile };
}

/**
 * The decision the recorder makes every tenth of a second, pure so it can be tested: cut the piece
 * now? A piece ends at a pause once it is long enough, and at the hard limit regardless.
 */
export function shouldCut(pieceSeconds: number, silentSeconds: number): boolean {
  if (pieceSeconds >= MAX_CHUNK_SECONDS) return true;
  return pieceSeconds >= MIN_CHUNK_SECONDS && silentSeconds >= CUT_SILENCE_SECONDS;
}

// The level meter, run on the audio thread. Input 0 is the microphone, input 1 the call. Every
// ~100 ms of audio it posts both channels' RMS. Written as source because an AudioWorklet module
// must be loaded by URL, and a Blob URL keeps it inside this file.
const METER = `
class ZbLevelMeter extends AudioWorkletProcessor {
  constructor() { super(); this.frames = 0; this.sums = [0, 0]; this.block = Math.round(sampleRate * ${ENERGY_STEP_MS / 1000}); }
  process(inputs) {
    let n = 128;
    for (let ch = 0; ch < 2; ch++) {
      const data = inputs[ch] && inputs[ch][0];
      if (!data) continue;
      n = data.length;
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i] * data[i];
      this.sums[ch] += s;
    }
    this.frames += n;
    if (this.frames >= this.block) {
      this.port.postMessage([Math.sqrt(this.sums[0] / this.frames), Math.sqrt(this.sums[1] / this.frames)]);
      this.frames = 0; this.sums = [0, 0];
    }
    return true;
  }
}
registerProcessor('zb-level-meter', ZbLevelMeter);
`;

/**
 * Ask for the sources, in the order the browser needs: the call's tab first (it must be asked for
 * inside the click), then the microphone. A call that is refused or shared without sound is not a
 * failure — the recording goes ahead from the microphone and says so.
 */
export async function openSources(withCall: boolean): Promise<{ mic: MediaStream; call: MediaStream | null; warning?: RecorderWarning }> {
  let call: MediaStream | null = null;
  let warning: RecorderWarning | undefined;
  if (withCall) {
    try {
      const shared = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // Chrome's hints: offer tabs, keep the call playing out loud, never offer this tab itself.
        preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include',
      } as DisplayMediaStreamOptions);
      // Only the sound is wanted. The picture track is stopped at once; the audio carries on.
      shared.getVideoTracks().forEach((t) => t.stop());
      const audio = shared.getAudioTracks();
      if (audio.length) call = new MediaStream(audio);
      else warning = 'call-no-audio';
    } catch {
      warning = 'call-ended';
    }
  }
  try {
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return { mic, call, warning };
  } catch (e) {
    call?.getTracks().forEach((t) => t.stop());
    throw e;
  }
}

export class MeetingRecorder {
  private ctx: AudioContext | null = null;
  private mixed: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private meter: AudioWorkletNode | null = null;
  private readonly mime: string;

  /** Readings for the whole recording, per channel. The recording clock IS their length. */
  private me: number[] = [];
  private them: number[] = [];
  private pieceStart = 0;
  private pieceSpoke = false;
  private silent = 0;
  private paused = false;
  private stopped = false;
  private micHeard = false;
  private hasCall: boolean;
  private finishing: Promise<void>[] = [];

  constructor(private sources: { mic: MediaStream; call: MediaStream | null }, private events: RecorderEvents) {
    const mime = recordingMime();
    if (!mime) throw new Error('This browser cannot record audio.');
    this.mime = mime;
    this.hasCall = Boolean(sources.call);
  }

  /** Seconds recorded so far, pauses excluded. */
  get elapsed(): number {
    return (this.me.length * ENERGY_STEP_MS) / 1000;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  async start(): Promise<void> {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const url = URL.createObjectURL(new Blob([METER], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    const destination = ctx.createMediaStreamDestination();
    const meter = new AudioWorkletNode(ctx, 'zb-level-meter', { numberOfInputs: 2, numberOfOutputs: 1 });
    this.meter = meter;

    const mic = ctx.createMediaStreamSource(this.sources.mic);
    mic.connect(destination);
    mic.connect(meter, 0, 0);
    if (this.sources.call) {
      const call = ctx.createMediaStreamSource(this.sources.call);
      call.connect(destination);
      call.connect(meter, 0, 1);
      this.sources.call.getAudioTracks()[0]?.addEventListener('ended', () => {
        this.hasCall = false;
        this.events.onWarning?.('call-ended');
      });
    }
    // The meter must be pulled by the graph to run; a silent gain to the speakers does that without
    // playing anything back (playing the call back into the room would be heard by the microphone).
    const hush = ctx.createGain();
    hush.gain.value = 0;
    meter.connect(hush).connect(ctx.destination);

    this.sources.mic.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (!this.stopped) void this.stop().then(() => this.events.onEnded?.());
    });

    this.mixed = destination.stream;
    meter.port.onmessage = (e: MessageEvent<[number, number]>) => this.tick(e.data[0], e.data[1]);
    if (ctx.state === 'suspended') await ctx.resume();
    this.beginPiece();
  }

  pause(): void {
    if (this.paused || this.stopped) return;
    this.cut(false);
    this.paused = true;
  }

  resume(): void {
    if (!this.paused || this.stopped) return;
    this.paused = false;
    this.beginPiece();
  }

  /** Stop recording, hand over the last piece, and let go of the microphone and the call. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    if (!this.paused) this.cut(false);
    this.stopped = true;
    await Promise.all(this.finishing);
    this.meter?.port.close();
    this.sources.mic.getTracks().forEach((t) => t.stop());
    this.sources.call?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => {});
  }

  private beginPiece(): void {
    if (!this.mixed) return;
    const rec = new MediaRecorder(this.mixed, { mimeType: this.mime, audioBitsPerSecond: 32_000 });
    rec.start();
    this.recorder = rec;
    this.pieceStart = this.me.length;
    this.pieceSpoke = false;
    this.silent = 0;
  }

  private tick(me: number, them: number): void {
    if (this.paused || this.stopped) return;
    this.me.push(me);
    this.them.push(this.hasCall ? them : 0);

    const speaking = me > SPEECH_RMS || (this.hasCall && them > SPEECH_RMS);
    if (speaking) {
      this.pieceSpoke = true;
      this.silent = 0;
    } else {
      this.silent += ENERGY_STEP_MS / 1000;
    }
    if (me > SPEECH_RMS) this.micHeard = true;
    // Eight seconds in and the microphone has heard nothing at all: say so once, while there is
    // still a meeting left to save.
    if (!this.micHeard && this.me.length === Math.round(8000 / ENERGY_STEP_MS)) this.events.onWarning?.('silent-mic');

    this.events.onLevels?.(me, this.hasCall ? them : null, this.elapsed);

    const pieceSeconds = ((this.me.length - this.pieceStart) * ENERGY_STEP_MS) / 1000;
    if (shouldCut(pieceSeconds, this.silent)) this.cut(true);
  }

  /** End the current piece; start the next one unless the recording is pausing or stopping. */
  private cut(next: boolean): void {
    const rec = this.recorder;
    if (!rec) return;
    const from = this.pieceStart;
    const to = this.me.length;
    const spoke = this.pieceSpoke;
    const me = this.me.slice(from, to);
    const them = this.sources.call ? this.them.slice(from, to) : null;
    const levels = { me: speakingLevelOf(this.me), them: this.sources.call ? speakingLevelOf(this.them) : SPEECH_RMS };

    const parts: Blob[] = [];
    const done = new Promise<void>((resolve) => {
      rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      rec.onstop = () => {
        const seconds = ((to - from) * ENERGY_STEP_MS) / 1000;
        if (spoke && seconds >= 0.5 && parts.length) {
          this.events.onChunk({
            blob: new Blob(parts, { type: this.mime.split(';')[0] }),
            mime: this.mime,
            start: (from * ENERGY_STEP_MS) / 1000,
            end: (to * ENERGY_STEP_MS) / 1000,
            me, them, levels,
          });
        }
        resolve();
      };
    });
    this.finishing.push(done);
    void done.then(() => { this.finishing = this.finishing.filter((p) => p !== done); });

    this.recorder = null;
    if (next) this.beginPiece();
    if (rec.state !== 'inactive') rec.stop();
  }
}

/** The speaking level of a channel so far — the same rule the transcript uses, on the live readings. */
function speakingLevelOf(values: number[]): number {
  const loud = values.filter((v) => v > SPEECH_RMS);
  if (loud.length === 0) return SPEECH_RMS;
  loud.sort((a, b) => a - b);
  return loud[Math.min(loud.length - 1, Math.floor(loud.length * 0.9))];
}
