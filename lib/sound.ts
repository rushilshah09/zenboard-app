'use client';
// Sound — a small, self-contained audio system for Zenboard.
//
// Philosophy: sound is used sparingly, only to reinforce the rewarding moment of
// *completing a task* (à la Todoist). No sounds for clicks, navigation, menus,
// drag, or any other UI interaction — Zenboard stays calm and professional.
//
// The engine synthesises its cues with the Web Audio API (no asset to ship or
// preload), so playback is instant once the context is unlocked. It is written
// to be reusable: adding a future cue is a matter of one more `play(...)` recipe,
// but only the task complete / uncheck sounds are enabled today.

const PREF_KEY = 'zb:sound';
export const SOUND_EVENT = 'zb:sound-change';

let ctx: AudioContext | null = null;
let unlocked = false;
let lastPlay = 0; // performance.now() of the last cue — used to prevent overlap

// ── Preference (persisted, default ON) ───────────────────────────────────────
export function taskSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(PREF_KEY) !== 'off';
}

export function setTaskSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable — fall back to session default */
  }
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: on }));
}

// ── Context ──────────────────────────────────────────────────────────────────
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Create + resume the audio context on the first user gesture so the first real
// cue plays with zero latency and isn't blocked by the browser autoplay policy.
// Also runs a silent warm-up to spin up the DSP graph.
export function initTaskSound(): void {
  if (typeof window === 'undefined' || unlocked) return;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    const c = getCtx();
    if (c) {
      if (c.state === 'suspended') void c.resume();
      // Silent warm-up: schedule a zero-gain blip to initialise the pipeline.
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        g.gain.value = 0;
        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.03);
      } catch {
        /* ignore */
      }
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

// ── Synthesis ────────────────────────────────────────────────────────────────
// One voice: a pure sine with a fast attack + exponential decay (a soft, clean
// "tick"). Sine keeps it calm and premium rather than buzzy or playful.
function voice(
  c: AudioContext,
  master: AudioNode,
  t: number,
  opts: { freq: number; to?: number; gain: number; dur: number; delay?: number },
) {
  const start = t + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + opts.dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(opts.gain, start + 0.006); // ~6ms attack
  g.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur); // exp decay
  osc.connect(g);
  g.connect(master);
  osc.start(start);
  osc.stop(start + opts.dur + 0.02);
}

// Runs a cue, honouring the user preference and the anti-overlap throttle.
function play(recipe: (c: AudioContext, master: AudioNode, t: number) => void, minGap = 90): void {
  if (!taskSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = performance.now();
  if (now - lastPlay < minGap) return; // collapse rapid bursts into one cue
  lastPlay = now;
  if (c.state === 'suspended') void c.resume();
  // A shared soft low-pass keeps every cue mellow.
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000;
  lp.connect(c.destination);
  recipe(c, lp, c.currentTime);
}

// Completion — a crisp two-note rise (a confident perfect fifth) with a tiny
// high transient for "crispness". Clean and rewarding, not chirpy. ~200ms.
export function playTaskComplete(): void {
  play((c, master, t) => {
    voice(c, master, t, { freq: 2100, gain: 0.05, dur: 0.035 }); // crisp transient
    voice(c, master, t, { freq: 660, gain: 0.17, dur: 0.13 }); // E5
    voice(c, master, t, { freq: 990, gain: 0.15, dur: 0.16, delay: 0.072 }); // B5
  });
}

// Uncheck — a single soft, slightly falling tick. Noticeably quieter and less
// prominent than completion.
export function playTaskUncheck(): void {
  play((c, master, t) => {
    voice(c, master, t, { freq: 460, to: 380, gain: 0.05, dur: 0.11 });
  });
}

// Convenience for optimistic toggle handlers. Completion plays after the check
// animation settles (~150ms) so the sound lands on the finished mark; uncheck is
// immediate and soft.
export function signalTaskToggle(nowDone: boolean): void {
  if (typeof window === 'undefined') return;
  if (nowDone) window.setTimeout(playTaskComplete, 150);
  else playTaskUncheck();
}
