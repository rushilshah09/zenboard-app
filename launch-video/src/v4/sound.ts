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
  ["paper-slide", 5.0, 0.35], ["paper-slide", 5.4, 0.3], ["paper-slide", 5.8, 0.3], ["paper-slide", 6.2, 0.3],
  ...r(7.6, 6, 0.28).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.25]),
  // 2 Resolve
  ["breath", 10.0, 0.5], ["whoosh-soft", 11.0, 0.7],
  ...r(12.5, 10, 0.067).map((t, i): [string, number, number] => [`tick-tuned-${i % 8}`, t, 0.35]),
  ["whoosh-soft", 13.4, 0.45], ["chime", 14.0, 0.8],
  // 3 All in one
  ...r(15.5, 6, 0.12).map((t, i): [string, number, number] => [`tick-tuned-${(i + 2) % 8}`, t, 0.35]),
  ["thread", 16.2, 0.55], ["snap", 17.75, 0.45], ["whoosh-soft", 18.7, 0.6], ["paper-slide", 20.0, 0.5], ["whoosh-soft", 21.7, 0.7],
  // 4 Dashboard
  ["lift", 22.15, 0.6], ["ui-click", 23.2, 0.35], ["click-1", 26.8, 0.7], ["paper-slide", 27.3, 0.4],
  // 5 Features: a tick on each step, a soft pop for each white card
  ...r(28, 8, 1.5).map((t, i): [string, number, number] => [`tick-tuned-${i}`, t, 0.5]),
  ...r(28.15, 8, 1.5).map((t): [string, number, number] => ["snap", t, 0.28]),
  // 6 Automation
  ["snap", 40.35, 0.5], ["key-1", 41.0, 0.2], ["key-2", 41.25, 0.2], ["key-3", 41.5, 0.2], ["whoosh-soft", 41.95, 0.7],
  ["click-2", 42.87, 0.85], ["whoosh-soft", 43.3, 0.4],
  ["tick-tuned-3", 43.87, 0.5], ["tick-tuned-5", 44.37, 0.5], ["tick-tuned-7", 44.87, 0.5], ["notify-2", 44.97, 0.45],
  // 7 Pills
  ["whoosh-soft", 46.0, 0.55], ...r(46.2, 16, 0.25).map((t, i): [string, number, number] => [`tick-tuned-${i % 8}`, t, 0.22]), ["whoosh-soft", 49.9, 0.6],
  // 8 Carousel
  ["lift", 51.1, 0.4], ["snap", 52.33, 0.55], ["snap", 53.83, 0.55], ["snap", 55.33, 0.55], ["breath", 57.1, 0.5],
  // 9 The one
  ...r(58.1, 9, 0.07).map((): [string, number, number] => ["paper-slide", 0, 0]).map((x, i) => [x[0], 58.1 + i * 0.07, 0.18] as [string, number, number]),
  ["whoosh-soft", 62.9, 0.55], ["whoosh-soft", 63.8, 0.7],
  ...r(64.2, 6, 0.18).map((t): [string, number, number] => ["pen-tap", t, 0.3]),
  ["snap", 65.9, 0.5], ["chime-single", 66.1, 0.7], ...r(66.35, 8, 0.035).map((t, i): [string, number, number] => [`key-${i % 4}`, t, 0.12]),
  ["chime-resolved", 67.4, 0.7], ["click-0", 70.1, 0.45],
];
