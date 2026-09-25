import { Easing, spring } from "remotion";
import { FPS } from "./timeline";

/**
 * v2 motion system: "precise physics" (DIRECTION_V2.md §3). These five presets
 * are the only curves in the film. Everything is a pure function of the frame.
 */

/** Respond: the one spring. Stiffness 220, damping 28, mass 1: ζ ≈ 0.94, overshoot < 2%, settles in ~450ms. UI objects only. */
export const RESPOND = { stiffness: 220, damping: 28, mass: 1 } as const;
export const respond = (frame: number, at: number) => spring({ frame: frame - at, fps: FPS, config: RESPOND });

export const CURVE = {
  /** Heavy camera with inertia. All camera moves. */
  glide: Easing.bezier(0.65, 0, 0.35, 1),
  /** Decisive speed, 250–400ms, with motion blur. Fast camera snaps in Acts 1 and 4. */
  whip: Easing.bezier(0.16, 1, 0.3, 1),
  /** Accelerates away. Exits; always faster than the entrance. */
  depart: Easing.bezier(0.7, 0, 0.84, 0),
  /** Soft landing. Type, light changes, atmosphere. */
  settle: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

/** Hierarchy in time (§3): lead at 0, response +4f, consequence +8f, environment +16f. */
export const TIER = { lead: 0, response: 4, consequence: 8, environment: 16 } as const;

/** Durations in frames at 60fps. */
export const DUR2 = { whip: 20, rack: 16, glideShort: 24, glideLong: 60, departFast: 14 } as const;
