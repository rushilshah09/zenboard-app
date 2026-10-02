import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── THE PRODUCT'S VOICE ────────────────────────────────────────────────────
//
// User directive, 2026-09-25: "remove em dash". It is a small rule with a large reason — an em
// dash between two clauses is the single most reliable tell of copy that was written to be
// *generated* rather than read aloud, and this product is being built not to read that way
// (PROGRESS, "the product polish program").
//
// So: no em dash in anything a person sees. A clause that explains takes a colon, a clause that
// stands alone takes a full stop, a list takes a comma, and two things joined in a label take the
// house's middle dot. 169 lines were rewritten to get here; this keeps them there.
//
// WHAT IS NOT COPY, and is therefore exempt:
// · comments and JSDoc (this file's own prose included) — nobody reads them in the product;
// · test names, for the same reason;
// · the "no value" glyph in a stat or a table cell, which is an EN dash (–), a different
//   character and the typographic convention for "none";
// · `components/site/*`, which is the marketing site another sprint owns.

const SKIP = /dev-preview|node_modules|\.next|components\/site/;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$|\.dev\./.test(p)) out.push(p);
  }
  return out;
}

/**
 * Comments are not copy, and a line-by-line guess at what a comment is gets the CONTINUATION
 * lines of a block comment wrong — which is most of this codebase's prose. So the comments are
 * blanked out of the whole file first (keeping the newlines, so line numbers still point at the
 * offender), and whatever em dash is left is in code a person reads.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));
}

function offenders(): string[] {
  const found: string[] = [];
  for (const file of sources('.').map((f) => (f.startsWith('./') ? f.slice(2) : f))) {
    stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
      if (!line.includes('—')) return;
      found.push(`${file}:${i + 1}  ${line.trim().slice(0, 120)}`);
    });
  }
  return found;
}

describe('the product says nothing with an em dash', () => {
  it('has none in any string or JSX text a person can read', () => {
    const bad = offenders();
    expect(bad, `an em dash in copy — use ": " to explain, ". " to stop, ", " to continue, or " · " to join:\n${bad.join('\n')}`).toEqual([]);
  });

  it('still has the en dash where "no value" is the meaning', () => {
    // The rule is about the em dash in sentences, not about the glyph that stands for an empty
    // cell. Keeping this asserted stops a future sweep from deleting the convention by accident.
    expect(readFileSync('components/ds/ui/stat.tsx', 'utf8')).toMatch(/>–<\/span>/);
    expect(readFileSync('components/forms/responses-view.tsx', 'utf8')).toMatch(/>–<\/span>/);
  });

  it('never talks to the user about its own plumbing', () => {
    // User, 2026-09-30, on a screenshot of Habits reading "Apply migration 0025 for repeat
    // schedules, goal counting…": the page looked amateur. It was a DEVELOPER instruction shown to
    // every user — nobody who reads it can act on it. Memory said "Run migration 0029" the same way.
    // A capability probe degrades quietly for the user and tells the developer in the console, so a
    // `console.*` line is exempt; anything else naming a numbered migration is copy, and is a bug.
    const found: string[] = [];
    for (const file of sources('.').map((f) => (f.startsWith('./') ? f.slice(2) : f))) {
      stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
        if (!/migration\s+0*\d{2,4}/i.test(line) || /console\.(warn|error|info|log)\(/.test(line)) return;
        found.push(`${file}:${i + 1}  ${line.trim().slice(0, 120)}`);
      });
    }
    expect(found, `a migration named in user-facing copy:\n${found.join('\n')}`).toEqual([]);
  });

  it('does not name a real client in sample or placeholder copy', () => {
    // User, 2026-09-25: "don't use my client name". The first screens are the ones a stranger
    // sees, so they are the ones this is checked on; the dev-preview fixtures are internal.
    const screens = ['app/login/page.tsx', 'components/onboarding/onboarding-flow.tsx', 'components/onboarding/onboarding-preview.tsx'];
    for (const file of screens) {
      const src = readFileSync(file, 'utf8');
      for (const name of ['Balluji', 'TechSpark']) {
        expect(src, `${file} names a real client`).not.toContain(name);
      }
    }
  });
});
