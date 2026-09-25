/**
 * v4 voice-over cues: clip id (public/audio/vo4/<id>.wav, made by scripts/make-voiceover-v4.py) and its start
 * in seconds on the film timeline. Each line lands with its on-screen text; the score ducks under the voice.
 */
import LINES from "../../public/audio/vo4/lines.json";

export const VO4: [keyof typeof LINES, number][] = [
  ["apps", 2.15], ["all", 6.4],
  ["meet", 15.7],
  ["juggle", 19.4], ["place", 23.15],
  ["day", 26.15],
  ["tasks", 30.7], ["projects", 32.15], ["docs", 33.65], ["calendar", 35.15], ["clients", 36.65], ["money", 38.15], ["habits", 39.65], ["focus", 41.15],
  ["auto", 43.3], ["work", 46.25],
  ["need", 49.2],
  ["made", 54.7],
  ["one", 61.05],
  ["zenboard", 69.7], ["tagline", 70.3], ["today", 71.8],
];
export const voDur = (id: keyof typeof LINES) => LINES[id];
