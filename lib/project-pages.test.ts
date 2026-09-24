import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── A CONTENT PIECE IS NOT A DOC ───────────────────────────────────────────
//
// `lib/projects-data.ts` fetches every `pages` row carrying a `project_id`, and
// a content piece carries one ON PURPOSE — the project close-out creates them
// that way so the case study knows which job it came from
// ([[zenboard-content-module]], Scenario D).
//
// `ProjectDocs` rendered all of them. Measured on the harness the moment a
// `type: 'content'` fixture existed: **"4 docs" for three docs and a case
// study**, with the piece sitting in the list, and clicking it would have
// handed a content piece to the DOCUMENT editor — where it has no stage, no
// dates, no brief and no client sign-off.
//
// The fixture had no content row, which is why it went unseen — the same shape
// of blind spot as the missing `reference` fixture in Content.
const SRC = 'components/projects/project-docs.tsx';

describe('a project separates what it wrote from what it made', () => {
  const src = readFileSync(SRC, 'utf8');
  // Comments first. The note in this file EXPLAINS not to write
  // `type !== 'content'`, and a scan that reads prose flagged the explanation
  // as the violation — the third time this session a guard matched its own
  // rationale. Assert against code.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('splits by the SHARED rule, not a hand-rolled type check', () => {
    // `lib/page-kinds.ts` is THE rule for which module owns a `pages` row, and
    // its own note says the next module adds a line THERE rather than
    // rediscovering this in another query file. A local `type !== 'content'`
    // works today and goes stale the moment a fifth type appears — which is
    // exactly how this list came to render content in the first place.
    expect(src).toMatch(/isDocumentPage/);
    expect(code, 'do not re-hand-roll the rule').not.toMatch(/type !== 'content'/);
    expect(code, 'do not re-hand-roll the rule').not.toMatch(/type === 'content'/);
    expect(src).toMatch(/const written = docs\.filter\(\(d\) => isDocumentPage\(d\.type\)\)/);
  });

  it('counts and lists only what was WRITTEN as docs', () => {
    // The count is the tell: it read "4 docs" for three. A list can be
    // mis-skimmed; a wrong number is a wrong claim.
    expect(src, 'the count must come from the written half').toMatch(/\{written\.length\} doc/);
    expect(src, 'the list must come from the written half').toMatch(/\{written\.map\(/);
    expect(code, 'nothing may render the unsplit list').not.toMatch(/\{docs\.map\(/);
    expect(code, 'nothing may count the unsplit list').not.toMatch(/\{docs\.length\} doc/);
  });

  it('links a piece to Content instead of opening it in the doc editor', () => {
    // A piece is worked on where its stage, dates, brief and sign-off live.
    // Opening it here in a document editor is the confusion this section ends.
    const section = src.slice(src.indexOf('madeContent.map'));
    expect(section).toMatch(/href=\{`\/content\?piece=\$\{d\.id\}`\}/);
    expect(section.slice(0, 700), 'a piece must not open the DocEditor').not.toMatch(/setEditId/);
  });

  it('says nothing when the project has made no content', () => {
    // An empty "Content from this project" heading on every project that never
    // made any is a reproach, and it is most projects.
    expect(src).toMatch(/\{madeContent\.length > 0 && \(/);
  });
});
