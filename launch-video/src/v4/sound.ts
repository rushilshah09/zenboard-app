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
  ["whoosh-soft", 8.5, 0.45], ["breath", 9.5, 0.4],
  ["whoosh-soft", 10.3, 0.6], ["click-1", 10.8, 0.6], ["thread", 10.82, 0.4], ["whoosh-soft", 11, 0.45],
  ["chime-single", 12.45, 0.6],
  ...r(12.8, 10, 0.05).map((t, i): [string, number, number] => [`tick-tuned-${i % 8}`, t, 0.3]),
  ["whoosh-soft", 14.05, 0.4], ["snap", 14.42, 0.45], ["chime", 14.7, 0.7],
  ...r(14.8, 8, 0.07).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.14]), ["paper-slide", 15.4, 0.3],
  // 3 All in one
  ...r(17, 6, 0.12).map((t, i): [string, number, number] => [`tick-tuned-${(i + 2) % 8}`, t, 0.35]),
  ["thread", 17.7, 0.55], ["snap", 19.25, 0.45], ["whoosh-soft", 20.2, 0.6], ["paper-slide", 21.5, 0.5], ["whoosh-soft", 23.2, 0.7],
  // 4 Dashboard
  ["lift", 23.65, 0.6], ["ui-click", 24.7, 0.35], ["click-1", 28.3, 0.7], ["paper-slide", 28.8, 0.4],
  // 5 Features: a tick on each step, a soft pop for each white card
  ...r(29.5, 8, 1.5).map((t, i): [string, number, number] => [`tick-tuned-${i}`, t, 0.5]),
  ...r(29.65, 8, 1.5).map((t): [string, number, number] => ["snap", t, 0.28]),
  // 6 Automation
  ["snap", 41.85, 0.5], ["key-1", 42.5, 0.2], ["key-2", 42.75, 0.2], ["key-3", 43, 0.2], ["whoosh-soft", 43.45, 0.7],
  ["click-2", 44.37, 0.85], ["whoosh-soft", 44.8, 0.4],
  ["tick-tuned-3", 45.37, 0.5], ["tick-tuned-5", 45.87, 0.5], ["tick-tuned-7", 46.37, 0.5], ["notify-2", 46.47, 0.45],
  // 7 Pills
  ["whoosh-soft", 47.5, 0.55], ...r(47.7, 16, 0.25).map((t, i): [string, number, number] => [`tick-tuned-${i % 8}`, t, 0.22]), ["whoosh-soft", 51.4, 0.6],
  // 8 Carousel
  ["lift", 52.6, 0.4], ["snap", 53.83, 0.55], ["snap", 55.33, 0.55], ["snap", 56.83, 0.55], ["breath", 58.6, 0.5],
  // 9 The one
  ...r(59.6, 9, 0.07).map((): [string, number, number] => ["paper-slide", 0, 0]).map((x, i) => [x[0], 59.6 + i * 0.07, 0.18] as [string, number, number]),
  ["whoosh-soft", 64.4, 0.55], ["whoosh-soft", 65.3, 0.7],
  ...r(65.7, 6, 0.18).map((t): [string, number, number] => ["pen-tap", t, 0.3]),
  ["snap", 67.4, 0.5], ["chime-single", 67.6, 0.7], ...r(67.85, 8, 0.035).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.12]),
  ["chime-resolved", 68.9, 0.7], ["click-0", 71.6, 0.45],
];
