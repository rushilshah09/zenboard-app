// An answer as it is DRAWN: paragraphs, and runs of list lines as one list.
//
// Its own module, with no imports, because the thing that draws answers (components/ask/ask-answer.tsx)
// is mounted in the shell on every page — and the engine that checks answers (lib/meeting-ask.ts) is
// a verifier with a schema, which no page needs in its JavaScript to draw a bullet.

/** A list line as a model writes one: "- ", "* ", "• " or "1. " before the item. */
export const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

export type AnswerBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

/**
 * The model is asked for "- " lines when the question wants a list ("what are my action items?");
 * drawing its dashes as text would leave a list looking like a paste. A dash INSIDE a sentence is
 * not a list — only a marker that opens the line is.
 */
export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (LIST_MARKER.test(line)) {
      const item = line.replace(LIST_MARKER, '');
      const last = blocks.at(-1);
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
}
