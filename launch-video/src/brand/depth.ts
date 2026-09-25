/**
 * v2 depth system (DIRECTION_V2.md §3): every shot uses the same z-layers, so
 * depth reads consistently across the film. Blur is px of depth-of-field at rest.
 */
export const DEPTH = {
  foreground: { z: 200, blur: 0 },
  interaction: { z: 40, blur: 0 },
  primary: { z: 0, blur: 0 },
  secondary: { z: -300, blur: 2 },
  background: { z: -1200, blur: 8 },
  atmosphere: { z: -3000, blur: 0 },
} as const;
export type DepthLayer = keyof typeof DEPTH;

/** CSS depth of field for DOM scenes (E9): blur grows with distance from the focus plane. */
export const dofBlur = (z: number, focusZ = 0, strength = 1 / 120) => Math.min(14, Math.abs(z - focusZ) * strength);
