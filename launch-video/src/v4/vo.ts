/**
 * v4 voice-over cues: clip id (public/audio/vo4/<id>.wav, made by scripts/make-voiceover-v4.py) and its start
 * in seconds on the film timeline. Each line lands with its on-screen text; the score ducks under the voice.
 */
import LINES from "../../public/audio/vo4/lines.json";

export const VO4: [keyof typeof LINES, number][] = [
  ["apps", 2.15], ["all", 6.4],
  ["meet", 15.1],
  ["juggle", 18.4], ["place", 22.15],
  ["day", 25.15],
  ["tasks", 29.7], ["projects", 31.15], ["docs", 32.65], ["calendar", 34.15], ["clients", 35.65], ["money", 37.15], ["habits", 38.65], ["focus", 40.15],
  ["auto", 42.3], ["work", 45.25],
  ["need", 48.2],
  ["made", 53.7],
  ["one", 60.05],
  ["zenboard", 67.7], ["tagline", 68.85], ["today", 72.25],
];
export const voDur = (id: keyof typeof LINES) => LINES[id];
