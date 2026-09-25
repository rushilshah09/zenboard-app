/**
 * v4 sound design: every appearance gets its own cue (D1). [file in public/audio/sfx, time in seconds, volume].
 * Music: the 120 BPM v3 score sits under at a low level as a temp track until the v4 score is written.
 */
const r = (a: number, n: number, step: number) => Array.from({ length: n }, (_, i) => a + i * step);
export const SFX: [string, number, number][] = [
  // 1 Juggling
  ["whoosh-soft", 0.05, 0.35], ["ui-click", 0.22, 0.5],
  ...r(1.5, 6, 0.5).map((t, i): [string, number, number] => [`tick-tuned-${i}`, t, 0.55]),
  ...r(4.4, 8, 0.38).map((t, i): [string, number, number] => [`notify-${i % 8}`, t, 0.32]),
  ["paper-slide", 5, 0.35], ["paper-slide", 5.4, 0.3], ["paper-slide", 5.8, 0.3], ["paper-slide", 6.2, 0.3],
  ...r(7.6, 6, 0.28).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.25]),
  // 1→2 Opening continues: tiles streak into arcs, the line strikes, the mark forms, the lockup writes itself
  ["whoosh-soft", 9.25, 0.45], ["breath", 10.5, 0.4],
  ["whoosh-soft", 11.3, 0.6], ["click-1", 11.8, 0.6], ["thread", 11.82, 0.4], ["whoosh-soft", 12.0, 0.45],
  ["chime-single", 13.45, 0.6],
  ...r(13.8, 10, 0.05).map((t, i): [string, number, number] => [`tick-tuned-${i % 8}`, t, 0.3]),
  ["whoosh-soft", 15.05, 0.4], ["snap", 15.42, 0.45], ["chime", 15.7, 0.7],
  ...r(15.8, 8, 0.07).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.14]), ["paper-slide", 16.4, 0.3],
  // 3 All in one
  ...r(18, 6, 0.12).map((t, i): [string, number, number] => [`tick-tuned-${(i + 2) % 8}`, t, 0.35]),
  ["thread", 18.7, 0.55], ["snap", 20.25, 0.45], ["whoosh-soft", 21.2, 0.6], ["paper-slide", 22.5, 0.5], ["whoosh-soft", 24.2, 0.7],
  // 4 Dashboard
  ["lift", 24.65, 0.6], ["ui-click", 25.7, 0.35], ["click-1", 29.3, 0.7], ["paper-slide", 29.8, 0.4],
  // 5 Features: a tick on each step, a soft pop for each white card
  ...r(30.5, 8, 1.5).map((t, i): [string, number, number] => [`tick-tuned-${i}`, t, 0.5]),
  ...r(30.65, 8, 1.5).map((t): [string, number, number] => ["snap", t, 0.28]),
  // 6 Automation
  ["snap", 42.85, 0.5], ["key-1", 43.5, 0.2], ["key-2", 43.75, 0.2], ["key-3", 44, 0.2], ["whoosh-soft", 44.45, 0.7],
  ["click-2", 45.37, 0.85], ["whoosh-soft", 45.8, 0.4],
  ["tick-tuned-3", 46.37, 0.5], ["tick-tuned-5", 46.87, 0.5], ["tick-tuned-7", 47.37, 0.5], ["notify-2", 47.47, 0.45],
  // 7 Pills
  ["whoosh-soft", 48.5, 0.55], ...r(48.7, 16, 0.25).map((t, i): [string, number, number] => [`tick-tuned-${i % 8}`, t, 0.22]), ["whoosh-soft", 52.4, 0.6],
  // 8 Carousel
  ["lift", 53.6, 0.4], ["snap", 54.83, 0.55], ["snap", 56.33, 0.55], ["snap", 57.83, 0.55], ["breath", 59.6, 0.5],
  // 9 The one
  ...r(60.6, 9, 0.07).map((): [string, number, number] => ["paper-slide", 1, 0]).map((x, i) => [x[0], 60.6 + i * 0.07, 0.18] as [string, number, number]),
  ["whoosh-soft", 65.4, 0.55], ["whoosh-soft", 66.3, 0.7],
  ...r(66.7, 6, 0.18).map((t): [string, number, number] => ["pen-tap", t, 0.3]),
  ["snap", 68.4, 0.5], ["chime-single", 68.6, 0.7], ...r(68.85, 8, 0.035).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.12]),
  ["chime-resolved", 69.9, 0.7], ["click-0", 72.6, 0.45],
];
