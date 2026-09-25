/**
 * v4 edit (storyboard/): nine scenes, 1:12 at 60fps, 120 BPM (1 beat = 30 frames).
 * Scene boundaries are designed as continuous transitions (morphs, zoom-throughs, light flashes).
 */
import { s } from "./kit";

export const V4 = {
  juggling: { from: 0, to: 10 },
  resolve: { from: 10, to: 15 },
  allInOne: { from: 15, to: 22 },
  dashboard: { from: 22, to: 28 },
  features: { from: 28, to: 40 },
  automation: { from: 40, to: 46 },
  pills: { from: 46, to: 51 },
  carousel: { from: 51, to: 58 },
  one: { from: 58, to: 72 },
} as const;
export type V4Scene = keyof typeof V4;
export const V4_FRAMES = s(72);
export const v4At = (k: V4Scene) => s(V4[k].from);
export const v4Len = (k: V4Scene) => s(V4[k].to) - s(V4[k].from);
export const BEAT = 30;
