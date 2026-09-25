/**
 * v4 edit (storyboard/): nine scenes, 1:13.5 at 60fps, 120 BPM (1 beat = 30 frames).
 * Scene boundaries are designed as continuous transitions (morphs, zoom-throughs, light flashes).
 */
import { s } from "./kit";

export const V4 = {
  juggling: { from: 0, to: 17.5 }, // the opening: scenes 1 and 2 as one movement (S1Opening)
  resolve: { from: 10, to: 17.5 }, // inside the opening; kept for reference times
  allInOne: { from: 17.5, to: 24.5 },
  dashboard: { from: 24.5, to: 30.5 },
  features: { from: 30.5, to: 42.5 },
  automation: { from: 42.5, to: 48.5 },
  pills: { from: 48.5, to: 53.5 },
  carousel: { from: 53.5, to: 60.5 },
  one: { from: 60.5, to: 74.5 },
} as const;
export type V4Scene = keyof typeof V4;
export const V4_FRAMES = s(74.5);
export const v4At = (k: V4Scene) => s(V4[k].from);
export const v4Len = (k: V4Scene) => s(V4[k].to) - s(V4[k].from);
export const BEAT = 30;
