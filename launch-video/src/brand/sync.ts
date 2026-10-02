import { VO_WORDS } from "./vo-words.generated";
import { FPS } from "./timeline";

/**
 * Word-level sync between the voice-over and on-screen text.
 *
 * VO_WORDS holds when each word of each clip is spoken (scripts/vo-words.py).
 * `syncWords` aligns the words of an on-screen line to those spoken words
 * (tolerant of mis-hearings like "Write" → "Right", digits for numbers and
 * punctuation) and returns, per on-screen word, the frame it should appear.
 */

/** Text leads speech by a hair so a word is readable the moment it is heard. */
export const LEAD = 5;

const NUM: Record<string, string> = { "8": "eight", "1": "one" };
const norm = (w: string) => {
  const t = w.toLowerCase().replace(/[^a-z0-9]/g, "");
  return NUM[t] ?? t;
};

/** Global alignment (Needleman–Wunsch): match = 2, substitution = 0, gap = -1. */
const align = (screen: string[], spoken: string[]) => {
  const n = screen.length;
  const m = spoken.length;
  const S = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => -(i + j)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      S[i][j] = Math.max(S[i - 1][j - 1] + (screen[i - 1] === spoken[j - 1] ? 2 : 0), S[i - 1][j] - 1, S[i][j - 1] - 1);
  const map: (number | null)[] = Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (S[i][j] === S[i - 1][j - 1] + (screen[i - 1] === spoken[j - 1] ? 2 : 0)) {
      map[i - 1] = j - 1;
      i--;
      j--;
    } else if (S[i][j] === S[i - 1][j] - 1) i--;
    else j--;
  }
  return map;
};

/**
 * Frames (in the caller's timeline) at which each on-screen word of `text`
 * should start appearing. `clipAt` is where the clip starts in that timeline.
 * Markup ([word], |) is ignored for matching.
 */
export const syncWords = (text: string, clip: keyof typeof VO_WORDS | string, clipAt: number): number[] => {
  const screen = text.replace(/[[\]|]/g, " ").split(/\s+/).filter(Boolean).map(norm);
  const spoken = (VO_WORDS[clip] ?? []).map((w) => ({ n: norm(w.w), s: w.s }));
  const map = align(screen, spoken.map((w) => w.n));
  const at = map.map((j) => (j === null ? null : clipAt + spoken[j].s * FPS - LEAD));
  // Words the aligner could not place are spaced evenly between their neighbours.
  for (let k = 0; k < at.length; k++) {
    if (at[k] !== null) continue;
    let p = k - 1;
    while (p >= 0 && at[p] === null) p--;
    let q = k + 1;
    while (q < at.length && at[q] === null) q++;
    const a = p >= 0 ? (at[p] as number) : clipAt - LEAD;
    const b = q < at.length ? (at[q] as number) : a + 12 * (k - p + 1);
    at[k] = a + ((b - a) * (k - p)) / (q - p);
  }
  return at.map((v) => Math.round(v as number));
};

/** Frame (in the caller's timeline) when the clip's k-th spoken word starts. */
export const spokenAt = (clip: string, k: number, clipAt: number) => Math.round(clipAt + (VO_WORDS[clip]?.[k]?.s ?? 0) * FPS);

/** Several on-screen phrases, each voiced by its own clip, as one wordAt list. */
export const syncLine = (parts: [text: string, clip: string, clipAt: number][]) => parts.flatMap(([t, c, a]) => syncWords(t, c, a));

/** The `moving` window of a synced headline: from its first word until its last word has settled. */
export const syncedSpan = (wordAt: number[], settle = 30): [number, number] => [wordAt[0], wordAt[wordAt.length - 1] + settle];
