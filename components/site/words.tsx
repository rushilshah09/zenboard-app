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

export function Words({ children, from = 0 }: { children: string; from?: number }) {
  const words = children.split(/\s+/).filter(Boolean);
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
