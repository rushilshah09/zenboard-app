import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A SOURCE-SCANNING guard, the same shape as the ones for ViewContainer and
// EmptyState — because none of this is checkable by types. Any screen can
// re-compose a page out of a header and a container by hand, and thirteen of
// them had, each answering the parts that are not a page's to answer:
//
//   top padding      0 · 24 · 28 · 32px         (four answers)
//   bottom padding   0 · 24 · 40 · 64 · 80px    (five answers)
//   entrance         none · fadein 180ms · fadein 220ms · animate-ds-fadein
//   width preference honoured on 4 pages, silently ignored on 9
//
// Nothing failed while that was true, which is exactly why it lasted. This fails.
//
// ── WHY THE CHECKS ARE NARROW ───────────────────────────────────────────────
// These match the fingerprint of a page ARCHETYPE being rebuilt, not any use of
// the parts. A pane inside a hub, a modal body, or the portal's separate chrome
// may legitimately use <ViewContainer> or set its own padding; the offence is
// re-deriving the page shape that <PageLayout>/<HubLayout> already own. A guard
// that cries wolf gets deleted.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/**
 * Comments describe the offence; only code commits it — so comment lines are
 * BLANKED, not dropped. Dropping them renumbers the file, and a guard that
 * reports the wrong line sends the next reader to an innocent function.
 */
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => (l.trim().startsWith('//') || l.trim().startsWith('*') ? '' : l))
    .join('\n');

const LAYOUTS = ['components/ui/page-layout.tsx', 'components/ui/hub-layout.tsx'];
const files = walk('components').filter((f) => !f.endsWith('.test.tsx'));

describe('every page comes through one of the layout archetypes', () => {
  it('nobody pairs a PageHeader with its own ViewContainer', () => {
    // That pair IS <PageLayout>. A file holding both is a page that rebuilt the
    // archetype — which is how the vertical rhythm got four different answers.
    const offenders = files
      .filter((f) => !LAYOUTS.includes(f))
      .filter((f) => {
        const src = code(f);
        return /<PageHeader\b/.test(src) && /<ViewContainer\b/.test(src);
      });
    expect(offenders).toEqual([]);
  });

  it('nobody sets page vertical rhythm on a content container', () => {
    // `--view-pt` / `--view-pb` are the page's rhythm and belong to the layout.
    // A view spelling them out is a view that can drift away from them.
    const offenders: string[] = [];
    for (const file of files) {
      if (LAYOUTS.includes(file)) continue;
      code(file).split('\n').forEach((line, i) => {
        // The rhythm is the `page-rhythm` utility. Spelling out the tokens (or
        // a literal `pt-8`) on a content container is a page answering a
        // question the layout already answered.
        if (/<ViewContainer[^>]*\b(pt-|pb-|py-)/.test(line) && !/page-rhythm/.test(line)) {
          offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('there is exactly one page entrance animation', () => {
    // Four screens ran `fadein` at two durations and a fifth used
    // `animate-ds-fadein`, so the app faded in at three speeds depending on
    // where you landed. `zb-page-in` is the one answer, and it lives in the
    // layouts — a page naming a page-level entrance for itself is the drift.
    const offenders: string[] = [];
    for (const file of files) {
      if (LAYOUTS.includes(file)) continue;
      code(file).split('\n').forEach((line, i) => {
        const pageEntrance =
          /animation:\s*['"]fadein/.test(line) && /(ViewContainer|h-full)/.test(line);
        if (pageEntrance) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('nobody re-derives the full-width preference', () => {
    // `full ? 'full' : …` was written in four files and forgotten in nine.
    // The layouts apply the preference, so a page never asks.
    const offenders: string[] = [];
    for (const file of files) {
      if (LAYOUTS.includes(file)) continue;
      code(file).split('\n').forEach((line, i) => {
        if (/\bfull\s*\?\s*'full'/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the entity-detail header is not re-implemented', () => {
    // Projects and Clients each carried a private, identical `PropRow`. The one
    // in ds/ui/record-header.tsx is the survivor.
    const offenders = files.filter((f) => /function PropRow\b/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('nobody hand-rolls the page container in inline styles', () => {
    // The Tailwind-class checks above could not see Goals, which centred its own
    // column with `{ padding: 'var(--view-pt) …', maxWidth: 1000, margin: '0 auto' }`
    // — a FIFTH page width, invisible to every guard the app had. A style object
    // that centres a fixed max-width AND pays the page's own padding token is a
    // page container by any other name.
    const offenders: string[] = [];
    for (const file of files) {
      if (LAYOUTS.includes(file)) continue;
      code(file).split('\n').forEach((line, i) => {
        const rebuilt =
          /margin:\s*'0 auto'/.test(line) &&
          /maxWidth:/.test(line) &&
          /var\(--view-p[btx]\)/.test(line);
        if (rebuilt) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('no page names its own entrance in an inline style', () => {
    // Week and Goals both ran `animation: 'fadein 220ms'` inline and Calendar ran
    // `animate-ds-fadein`, so the app faded in at three speeds. The archetypes
    // own the entrance; a page-level root naming one is drift by definition.
    const offenders: string[] = [];
    for (const file of files) {
      if (LAYOUTS.includes(file)) continue;
      code(file).split('\n').forEach((line, i) => {
        const isRoot = /height:\s*'100%'|h-full|flex-col/.test(line);
        const names = /animation:\s*'fadein|animate-ds-fadein/.test(line);
        if (isRoot && names) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('scanned a believable number of files', () => {
    // A must-fail control for the scan itself: a walk that quietly matched
    // nothing would make every check above pass forever.
    expect(files.length).toBeGreaterThan(50);
  });
});
