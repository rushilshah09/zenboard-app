/**
 * Every scene's length in beats (§5 / §9). At 90 BPM and 60fps one beat is
 * exactly 40 frames, so every cut lands on the music by construction.
 * Change BPM once if the final track has a different tempo.
 */
export const FPS = 60;
export const BPM = 90;
export const BEAT = (FPS * 60) / BPM; // 40 frames
export const BAR = BEAT * 4; // 160 frames
export const beat = (n: number) => Math.round(n * BEAT);

export type Act = 1 | 2 | 3 | 4 | 5 | 6;

/** `vo` is the optional voice-over line: the on-screen copy (§6). Act 3 has none. */
export const SCENES = [
  { id: "S01", act: 1, beats: 5, vo: "Every business starts with one person." },
  { id: "S02", act: 1, beats: 3, vo: "And one big idea." },
  { id: "S03", act: 2, beats: 9, vo: null },
  { id: "S04", act: 2, beats: 8, vo: "Eight apps. Eight logins. Eight bills." },
  { id: "S05", act: 3, beats: 8, vo: null },
  { id: "S06", act: 3, beats: 6, vo: null },
  { id: "S07", act: 3, beats: 6, vo: null },
  { id: "S08", act: 4, beats: 6, vo: "What if it all lived in one place?" },
  { id: "S09", act: 4, beats: 6, vo: "Zenboard. The single platform to manage work, life, and business." },
  { id: "S10", act: 5, beats: 5, vo: null },
  { id: "S11", act: 5, beats: 6, vo: "Plan your day in seconds." },
  { id: "S12", act: 5, beats: 6, vo: "Write right next to the work." },
  { id: "S13", act: 5, beats: 6, vo: "Every client in one view." },
  { id: "S14", act: 5, beats: 6, vo: "Invoice in one click." },
  { id: "S15", act: 5, beats: 6, vo: "And room for the rest of your life." },
  { id: "S16", act: 5, beats: 4, vo: "All connected. Nothing to switch." },
  { id: "S17", act: 6, beats: 7, vo: "One workspace. One subscription. One focus." },
  { id: "S18", act: 6, beats: 9, vo: "Zenboard. Available today." },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

export const frames = (id: SceneId) => beat(SCENES.find((s) => s.id === id)!.beats);

export const sceneStart = (id: SceneId) => {
  let at = 0;
  for (const s of SCENES) {
    if (s.id === id) return at;
    at += beat(s.beats);
  }
  throw new Error(`Unknown scene ${id}`);
};

export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + beat(s.beats), 0);

/** Global frame range of an act, for camera moves that span several scenes. */
export const actRange = (act: Act): [number, number] => {
  const ids = SCENES.filter((s) => s.act === act).map((s) => s.id);
  const start = sceneStart(ids[0]);
  const end = sceneStart(ids[ids.length - 1]) + frames(ids[ids.length - 1]);
  return [start, end];
};
