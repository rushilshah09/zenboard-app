import { random } from "remotion";

/** Seeded random in [a, b). Deterministic per seed (never Math.random). */
export const rnd = (seed: string | number, a = 0, b = 1) => a + (b - a) * random(`zb-${seed}`);

/** Simple pinhole projection used by DOM 3D layouts (swarm, collapse). */
export const project = (p: { x: number; y: number; z: number }, cam = { d: 1700, f: 1500, cx: 960, cy: 540 }) => {
  const s = cam.f / (cam.d + p.z);
  return { x: cam.cx + p.x * s, y: cam.cy + p.y * s, s };
};
