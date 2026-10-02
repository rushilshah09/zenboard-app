/**
 * The final film's edit (v3 structure plus the scenes added in review: the
 * pill flow in Noise, the feature arc after the Reveal, the mosaic morph as the
 * Flow, and the construction-sheet outro). 120 BPM, 60fps: 1 beat = 30 frames.
 * The voice-over (scripts/make-voiceover-v3.py) is placed line by line here,
 * so picture and voice stay locked.
 */
import { sec } from "./beats";

export const FILM = {
  noise: { from: 0, to: 10 },
  collapse: { from: 10, to: 16 },
  reveal: { from: 16, to: 24 },
  arc: { from: 24, to: 30 },
  graph: { from: 30, to: 46 },
  orbit: { from: 46, to: 54 },
  flow: { from: 54, to: 61 },
  one: { from: 61, to: 65.5 },
  outro: { from: 65.5, to: 75.5 },
} as const;
export type FilmScene = keyof typeof FILM;
export const FILM_FRAMES = sec(75.5);
export const at = (s: FilmScene) => sec(FILM[s].from);
export const len = (s: FilmScene) => sec(FILM[s].to) - sec(FILM[s].from);

/** Voice-over cues: clip id (public/audio/vo/<id>.wav) and its start in seconds. */
export const VO: [string, number][] = [
  ["noise", 4.4],
  ["meet", 14.7],
  ["whole", 20.0],
  ["one", 22.6],
  ["arc-tasks", 24.9],
  ["arc-calendar", 25.9],
  ["arc-docs", 26.9],
  ["arc-clients", 27.9],
  ["arc-money", 28.9],
  ["g-task", 30.9],
  ["g-project", 33.0],
  ["g-calendar", 35.2],
  ["g-doc", 37.4],
  ["g-client", 39.6],
  ["g-paid", 41.8],
  ["connects", 44.4],
  ["work", 48.4],
  ["life", 49.6],
  ["business", 50.8],
  ["zenboard", 69.4],
  ["tagline", 70.5],
  ["today", 74.0],
];
/** Scene-local frame at which a VO line starts. */
export const voAt = (id: string, scene: FilmScene) => sec(VO.find((v) => v[0] === id)![1]) - at(scene);
