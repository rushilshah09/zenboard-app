import type React from "react";
import { Easing, interpolate } from "remotion";

/**
 * Motion language "Everything settles" — creative direction §4.
 * No spring(), no bounce, no overshoot. Every value is clamped.
 */
export const EASE = {
  /** Entrances and moves from the reveal onward. */
  settle: Easing.bezier(0.22, 1, 0.36, 1),
  /** Entrances and switches in acts 2–3. */
  snap: Easing.bezier(0.33, 1, 0.68, 1),
  /** All exits, ~40% faster than entrances. */
  leave: Easing.bezier(0.55, 0, 1, 0.45),
  /** Camera drift, aura pulse, the collapse in act 4. */
  breathe: Easing.bezier(0.37, 0, 0.63, 1),
} as const;

/** Durations in frames at 60fps. */
export const DUR = {
  settle: 42, // 700ms
  snap: 16, // ~270ms
  leave: 18, // 300ms
  breathe: 150, // 2.5s
  wordStagger: 2.7, // 45ms
  colourDelay: 12, // 200ms after a line lands
  colourShift: 24, // 400ms
} as const;

export const clamp = (
  frame: number,
  input: [number, number],
  output: [number, number],
  easing: (t: number) => number = EASE.settle,
) => interpolate(frame, input, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/**
 * Entrance: travels `dist` px upward (24 text, 48 cards) with opacity riding
 * the first 60% of the move; optional 0.96 → 1 scale (never from 0).
 */
export const rise = (
  frame: number,
  at: number,
  { dist = 48, dur = DUR.settle, easing = EASE.settle, scale = false }: { dist?: number; dur?: number; easing?: (t: number) => number; scale?: boolean } = {},
): React.CSSProperties => {
  const p = clamp(frame, [at, at + dur], [0, 1], easing);
  const o = clamp(frame, [at, at + dur * 0.6], [0, 1], easing);
  return {
    opacity: o,
    translate: `0 ${(1 - p) * dist}px`,
    ...(scale ? { scale: String(0.96 + p * 0.04) } : null),
  };
};

/** Exit: short, soft, upward, on the Leave curve. */
export const leave = (frame: number, at: number, { dist = 12, dur = DUR.leave }: { dist?: number; dur?: number } = {}) => {
  const p = clamp(frame, [at, at + dur], [0, 1], EASE.leave);
  return { opacity: 1 - p, translate: `0 ${-p * dist}px` } satisfies React.CSSProperties;
};

/** Combine an entrance and an optional exit on one element. */
export const riseAndLeave = (frame: number, at: number, exitAt: number | undefined, opts?: Parameters<typeof rise>[2]): React.CSSProperties => {
  const r = rise(frame, at, opts);
  if (exitAt === undefined || frame < exitAt) return r;
  const l = leave(frame, exitAt);
  return { ...r, opacity: (r.opacity as number) * l.opacity, translate: l.translate };
};
