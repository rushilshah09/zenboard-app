import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── A ROW CARRIES ONLY WHAT IS TRUE ABOUT IT ───────────────────────────────
//
// Found by the user, in a screenshot. Every task row rendered:
//
//   Stakeholder interviews   Medium  [Internal]  🕐 —   ☆
//
// Two of those five are noise on EVERY row of EVERY list:
//
//   🕐 —  an absence, announced. And not even an affordance — a <span>, so it
//         could never set the estimate it kept reminding you was missing.
//   ☆     an empty star, which CLAUDE.md already forbids: "star/flag glyphs
//         render only when meaningful; reveal on row hover otherwise".
//
// And on the highlighted row, a "Highlight" chip sat beside a FILLED star —
// one fact with two homes, the thing this codebase keeps catching itself doing.
const SRC = 'components/tasks/task-row.tsx';

describe('a task row is quiet unless it has something to say', () => {
  const src = readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('never renders a dash where an estimate would be', () => {
    // The em-dash placeholder. A dash meaning "none" is a reproach, the same
    // rule as `sparkSummary` and `repurposeSummary` returning null at zero.
    // The facts moved into TaskMeta (2026-09-22), so the rule is read there;
    // task-meta.test.ts renders it and proves a bare task draws nothing.
    const meta = readFileSync('components/tasks/task-meta.tsx', 'utf8');
    expect(code, 'an em-dash placeholder is back').not.toMatch(/:\s*'—'/);
    expect(meta, 'an em-dash placeholder is back').not.toMatch(/:\s*'—'/);
    expect(meta, 'the estimate must draw only when there is one')
      .toMatch(/\(estimate != null \|\| timed\) &&/);
  });

  it('shows an empty star only on hover, and a filled one always', () => {
    // `reveal-on-hover`, never a hand-rolled opacity pair: the house utility
    // also turns the control on for a COARSE POINTER, and a phone has no
    // hover — an `opacity-0 group-hover` star is unreachable there.
    expect(code).toMatch(/task\.highlight \? '[^']*' : 'reveal-on-hover'/);
    // And ON, the filled glyph is the state: the toggle wash behind it drew a grey tile on the one highlighted
    // row, heavier than anything else in the list (2026-09-22).
    expect(code).toMatch(/task\.highlight \? '[^']*bg-transparent[^']*' : 'reveal-on-hover'/);
    expect(code, 'do not hand-roll the reveal').not.toMatch(/opacity-0 group-hover/);
  });

  it('never shows the badge and the toggle at once', () => {
    expect(code).toMatch(/showHighlightBadge && !showHighlightToggle && task\.highlight/);
  });

  it('names the ACTION, not the mechanism', () => {
    // "Toggle highlight" tells a screen-reader user what the control is, not
    // what pressing it will do — and the two states do opposite things.
    expect(code).toMatch(/task\.highlight \? 'Remove highlight' : 'Highlight this task'/);
    expect(code, 'the old label named the mechanism').not.toMatch(/label="Toggle highlight"/);
  });
});
