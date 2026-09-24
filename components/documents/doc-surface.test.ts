import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── A CARD IS ONE SURFACE ──────────────────────────────────────────────────
// CLAUDE.md, hard layout rule 1: "Cards = bg-surface border border-border
// rounded-lg. NEVER a darker fill on the canvas. NEVER nest two fills — one
// level max, separated by a border."
//
// The Documents gallery broke it in the way that is hardest to notice while
// writing the code and impossible to miss on screen. The card was white; its
// PREVIEW BODY painted `--paper-2` "one step down, so the header reads as the
// card's own surface". Measured on the real page:
//
//   gallery canvas   #EFEFEC
//   card             #FFFFFF
//   card body        #F1F1EF     ← 1.02:1 against the canvas
//   card border      #E9E9E7     ← 1.06:1 against the canvas
//
// So the bottom two-thirds of every card was the same colour as the page, and
// the border could not rescue it. A card read as a floating white strip with a
// hole under it. The list row had the identical fill and the identical result.
//
// The hairline under the header was already making the header/body
// distinction. The fill was never carrying it.
const src = readFileSync('components/documents/documents-view.tsx', 'utf8');

/** The JSX for one component, from its marker to the end of its return. */
function region(marker: string, chars = 1400): string {
  const i = src.indexOf(marker);
  expect(i, `marker moved: ${marker}`).toBeGreaterThan(-1);
  return src.slice(i, i + chars);
}

describe('the grid card', () => {
  const card = region('// ── Grid card ──', 3200);

  it('paints ONE surface', () => {
    expect(card, 'the card itself is the surface').toMatch(/background: 'var\(--paper\)'/);
    expect(card, 'and nothing inside it paints a second one')
      .not.toMatch(/background: 'var\(--paper-2\)'[^}]*\}\}>\s*\{lines\.length/);
  });

  it('separates header from body with a hairline, not a fill', () => {
    expect(card).toMatch(/borderBottom: '1px solid var\(--color-line-soft\)'/);
  });

  it('has an edge against the canvas', () => {
    expect(card).toMatch(/border: '1px solid var\(--line\)'/);
  });
});

describe('the list row', () => {
  const row = region('// ── List row ──', 1600);

  it('is the same surface as the card — a doc looks like a doc in both layouts', () => {
    expect(row).toMatch(/background: 'var\(--paper\)'/);
    expect(row, '`--paper-2` measured 1.02:1 on the gallery canvas').not.toMatch(/background: 'var\(--paper-2\)'/);
  });

  it('carries the same hairline', () => {
    expect(row).toMatch(/border: '1px solid var\(--line\)'/);
  });
});

describe('the hover edge applies to both layouts', () => {
  it('is no longer excluded from list rows', () => {
    // The rule was `:not(.doc-listrow)` because a list row had no border to
    // change. Now it has one, so the exclusion would be an inconsistency
    // nobody would think to look for.
    expect(src).not.toMatch(/\.doc-card:not\(\.doc-listrow\):hover\{border-color/);
    expect(src).toMatch(/\.doc-card:hover\{border-color:var\(--line-3\)\}/);
  });
});

describe('the writing surface is paper', () => {
  // The gallery and the editor are two different jobs and want two different
  // grounds. The gallery is a place you BROWSE: a recessed canvas is what lets
  // the cards read as objects on it. The editor is a place you WRITE, and a
  // tinted writing space reads as a PREVIEW of a document rather than the
  // document itself.
  //
  // The scroller's own comment had said "the redesign's white sheet" since the
  // redesign while the code under it painted `--paper-2`. Intent and
  // implementation had disagreed for months and the comment kept it hidden —
  // reading the file, you saw the word "white".

  it('the doc scroller matches its pane instead of stepping off it', () => {
    const i = src.indexOf('ref={scrollRef}');
    expect(i, 'the doc scroller moved').toBeGreaterThan(-1);
    const scroller = src.slice(i, i + 220);
    expect(scroller).toMatch(/background: 'var\(--paper\)'/);
    expect(scroller, 'a writing space with a tint is not a writing space')
      .not.toMatch(/background: 'var\(--paper-2\)'/);
  });

  it('leaves the raised controls alone', () => {
    // `--paper-2` is still right for things that sit ON the content — image
    // handles, the embed toolbar. Those are affordances, not surfaces, and a
    // sweep that removed them all would have flattened them into the page.
    const editor = readFileSync('components/documents/block-editor.tsx', 'utf8');
    expect(editor).toMatch(/bg-paper-2/);
  });
});
