import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── ZENBOARD'S VOICE ───────────────────────────────────────────────────────
//
// IDENTITY_BRIEF.md (user, 2026-09-25): Zenboard had no character of its own. The first identity
// move is TYPOGRAPHIC: content titles speak in Source Serif 4, everything you operate speaks in
// Geist. The line between the two is the whole idea, so it is what these guards hold — a serif that
// crept into a button, or a record title that fell back to the UI face, would blur it.

const globals = readFileSync('app/globals.css', 'utf8');
const tokens = readFileSync('app/tokens.css', 'utf8');
const read = (f: string) => readFileSync(f, 'utf8');

describe('the editorial voice', () => {
  it('is the serif, in one token', () => {
    expect(globals).toMatch(/--font-editorial: var\(--font-serif\);/);
    // …and it is still a single line to revert, which is part of the proposal.
    expect(globals.match(/--font-editorial: var\(--font-(serif|ui)\);/g)?.length).toBe(1);
  });

  it('is carried by the content-title role itself', () => {
    // Every text-h1 in the app is the title of the thing you are looking at, so a new page gets
    // the voice without remembering to ask. Zero specificity: an explicit family still wins.
    expect(globals).toMatch(/:where\(\.text-h1\)\s*\{\s*font-family: var\(--font-editorial\);/);
  });

  it('reaches the content titles that use other sizes', () => {
    const optIns: [string, RegExp][] = [
      ['components/today/today-view.tsx', /font-editorial text-title-2[^"]*">\{greeting\}/],
      ['components/onboarding/onboarding-flow.tsx', /font-editorial mb-5 text-title-1/],
      ['components/tasks/triage.tsx', /font-editorial text-title-1/],
      ['components/forms/form-renderer.tsx', /font-editorial text-h2/],
      ['components/focus/focus-view.tsx', /fontFamily: 'var\(--font-editorial\)'/],
      ['components/task-detail/task-detail-drawer.tsx', /fontFamily: 'var\(--font-editorial\)'/],
      // The one screen a CLIENT sees: its page and section titles. (Its stat figures stay Geist.)
      ['components/portal/portal-document.tsx', /<h1 style=\{\{ fontFamily: 'var\(--font-editorial\)'/],
    ];
    for (const [file, pattern] of optIns) expect(read(file), file).toMatch(pattern);
  });
});

describe('the UI keeps its own face', () => {
  it('leaves the chrome display face on the sans', () => {
    // The 48px header row's page name and dialog titles use --font-display, which is UI.
    expect(tokens).toMatch(/--font-display: var\(--font-sans\);/);
  });

  it('never gives a control the editorial face', () => {
    // These borrow a LARGE size for input or figures; they are things you operate or read at a
    // glance, and a serif there would read as decoration.
    for (const file of [
      'components/shell/command-palette.tsx',
      'components/shell/quick-capture.tsx',
      'components/ds/ui/stat.tsx',
      'components/ds/ui/button.tsx',
      'components/ui/page-header.tsx',
    ]) {
      expect(read(file), file).not.toMatch(/font-editorial/);
    }
  });
});

describe('the mark means your one thing today', () => {
  const seam = read('components/ds/icons.ts');

  it('is a glyph in the seam, drawn in the seam’s two weights', () => {
    expect(seam).toMatch(/export const Highlight = React\.forwardRef/);
    // Solid when highlighted, outline when not — the grammar every Phosphor glyph speaks.
    expect(seam).toMatch(/const solid = fill === "currentColor";/);
  });

  it('shares ONE geometry with the logo', () => {
    expect(seam).toMatch(/export const MARK_PATH = "M18\.4226/);
    const logo = read('components/ds/ui/icon.tsx');
    expect(logo).toMatch(/<path d=\{MARK_PATH\} \/>/);
    // …and no second copy of the path survives anywhere in the logo.
    expect(logo).not.toMatch(/d="M18\.4226/);
  });

  it('marks the highlight everywhere the highlight is shown', () => {
    for (const file of [
      'components/tasks/task-row.tsx', 'components/tasks/task-meta.tsx', 'components/tasks/task-card.tsx',
      'components/today/today-view.tsx', 'components/projects/projects-workspace.tsx', 'components/onboarding/onboarding-preview.tsx',
    ]) {
      expect(read(file), file).toMatch(/icon=\{Highlight\}/);
    }
  });

  it('leaves the star to the things it still means', () => {
    // The star meant THREE things; now it means two — a favourite doc and a pinned memory — and
    // the rating control keeps its stars. None of those became the mark.
    expect(read('components/documents/documents-view.tsx')).toMatch(/icon=\{Star\}/);
    expect(read('components/memory/memory-row.tsx')).toMatch(/icon=\{Star\}/);
    expect(read('components/documents/documents-view.tsx')).not.toMatch(/icon=\{Highlight\}/);
  });
});
