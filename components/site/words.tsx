// ── A HEADING, A WORD AT A TIME ─────────────────────────────────────────────
//
// Display type split into one box per word, so a heading can arrive word by word (globals.css,
// "the website arrives as it is read": `.site-rise-words` on the first screen, `data-reveal="words"`
// below it). Each word is numbered (`--w`) and that number is its place in the queue.
//
// The words stay real text with a real space between each pair, never a list of labels: a screen
// reader, a search engine, find-in-page and a copy all get the sentence exactly as written. `from`
// carries the count on when one heading is set over several lines.
//
// A plain component with no state, so a server component can render it and ship no script for it.

import * as React from 'react';

const split = (text: string) => text.split(/\s+/).filter(Boolean);

export function Words({ children, from = 0 }: { children: string; from?: number }) {
  const words = split(children);
  return (
    <>
      {words.map((word, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' '}
          <span className="site-word" style={{ '--w': from + i } as React.CSSProperties}>{word}</span>
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * A TWO-TONE TITLE (the colour system after Ramp, 2026-09-28): the claim in ink, then its second
 * clause in the quieter solid grey, so a title says two things at two volumes instead of one thing
 * louder. It is one sentence either way, and the words are counted on across the change of tone, so
 * the heading still arrives as one queue.
 *
 * LARGE TYPE ONLY. The second tone (`--site-second`) clears 3:1, which is the bar for text of 24px
 * and up; a card title's second tone is `ink-500` instead (site.test.ts keeps them apart).
 */
export function Title({ children, then, from = 0 }: { children: string; then?: string; from?: number }) {
  return (
    <>
      <Words from={from}>{children}</Words>
      {then && (
        <>
          {' '}
          <span className="text-site-second"><Words from={from + split(children).length}>{then}</Words></span>
        </>
      )}
    </>
  );
}
