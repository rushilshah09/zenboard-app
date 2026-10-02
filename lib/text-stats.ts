// Text statistics — ONE place that counts words, sentences and reading time.
//
// The document footer and the selection readout must never disagree about what
// "24 sentences" means, so both call these. Counting rules are deliberately
// explicit rather than clever: a user who selects a paragraph and sees a number
// should be able to arrive at the same number by hand.

export type TextStats = {
  characters: number;   // excluding line breaks — "how long is this text"
  words: number;
  sentences: number;
  paragraphs: number;
};

/** Words per minute for silent reading — the standard adult prose rate. */
const READ_WPM = 200;
/** Words per minute read aloud — slower, and the reason it's a separate number. */
const SPEAK_WPM = 130;

/**
 * Count a run of text. `paragraphs` counts non-empty lines, so it matches what a
 * writer sees; a caller holding real block structure (the document footer) can
 * pass its own block count instead, which is more accurate than splitting text.
 */
export function textStats(text: string): TextStats {
  const flat = text.replace(/\r?\n/g, '');
  return {
    characters: flat.length,
    words: (text.match(/\S+/g) ?? []).length,
    // A sentence needs terminal punctuation. Trailing text with no full stop is
    // still counted, so typing a line and seeing "0 sentences" can't happen.
    sentences: (text.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? []).filter((s) => s.trim()).length,
    paragraphs: text.split(/\r?\n/).filter((l) => l.trim()).length,
  };
}

/** Seconds to read `words` silently. */
export const readingSeconds = (words: number) => Math.round((words / READ_WPM) * 60);
/** Seconds to read `words` aloud. */
export const speakingSeconds = (words: number) => Math.round((words / SPEAK_WPM) * 60);

/**
 * "23 sec" · "3 min" · "1 hr 5 min" — a duration a reader can act on, not a
 * precise one. Seconds only matter while they're small; past an hour, minutes
 * are the useful grain and seconds are noise.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(seconds, 1)} sec`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}
