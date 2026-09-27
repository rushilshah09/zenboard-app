/**
 * v4 edit (storyboard/): nine scenes, 1:13.5 at 60fps, 120 BPM (1 beat = 30 frames).
 * Scene boundaries are designed as continuous transitions (morphs, zoom-throughs, light flashes).
 */
import { s } from "./kit";

export const V4 = {
  juggling: { from: 0, to: 16.5 }, // the opening: scenes 1 and 2 as one movement (S1Opening)
  resolve: { from: 10, to: 16.5 }, // inside the opening; kept for reference times
  allInOne: { from: 16.5, to: 23.5 },
  dashboard: { from: 23.5, to: 29.5 },
  features: { from: 29.5, to: 41.5 },
  automation: { from: 41.5, to: 47.5 },
  pills: { from: 47.5, to: 52.5 },
  carousel: { from: 52.5, to: 59.5 },
  one: { from: 59.5, to: 73.5 },
} as const;
export type V4Scene = keyof typeof V4;
export const V4_FRAMES = s(73.5);
export const v4At = (k: V4Scene) => s(V4[k].from);
export const v4Len = (k: V4Scene) => s(V4[k].to) - s(V4[k].from);
export const BEAT = 30;
