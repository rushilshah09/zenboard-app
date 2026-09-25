/**
 * v4 voice-over cues: clip id (public/audio/vo4/<id>.wav, made by scripts/make-voiceover-v4.py) and its start
 * in seconds on the film timeline. Each line lands with its on-screen text; the score ducks under the voice.
 */
import LINES from "../../public/audio/vo4/lines.json";

export const VO4: [keyof typeof LINES, number][] = [
  ["apps", 2.15], ["all", 6.4],
  ["meet", 14.25],
  ["juggle", 16.9], ["place", 20.65],
  ["day", 23.65],
  ["tasks", 28.2], ["projects", 29.65], ["docs", 31.15], ["calendar", 32.65], ["clients", 34.15], ["money", 35.65], ["habits", 37.15], ["focus", 38.65],
  ["auto", 40.8], ["work", 43.75],
  ["need", 46.7],
  ["made", 52.2],
  ["one", 58.55],
  ["zenboard", 66.2], ["tagline", 67.35], ["today", 70.75],
];
export const voDur = (id: keyof typeof LINES) => LINES[id];
