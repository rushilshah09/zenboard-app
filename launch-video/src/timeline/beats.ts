/**
 * v3 timeline (DIRECTION_V3.md §3): seven scenes, 1:04, 120 BPM.
 * At 60fps one beat is 30 frames and one bar is 2 seconds.
 */
export const FPS = 60;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 30 frames
export const BAR = BEAT * 4; // 120 frames
export const sec = (s: number) => Math.round(s * FPS);

export const V3_SCENES = [
  { id: "S1Noise", title: "The Noise", from: 0, to: 10 },
  { id: "S2Collapse", title: "The Collapse", from: 10, to: 16 },
  { id: "S3Reveal", title: "The Reveal", from: 16, to: 24 },
  { id: "S4Graph", title: "The Graph", from: 24, to: 40 },
  { id: "S5Orbit", title: "The Orbit", from: 40, to: 48 },
  { id: "S6Flow", title: "The Flow", from: 48, to: 54 },
  { id: "S7One", title: "The One", from: 54, to: 64 },
] as const;
export type V3SceneId = (typeof V3_SCENES)[number]["id"];
export const V3_TOTAL = sec(64);
export const sceneFrames = (id: V3SceneId) => {
  const s = V3_SCENES.find((x) => x.id === id)!;
  return sec(s.to - s.from);
};
