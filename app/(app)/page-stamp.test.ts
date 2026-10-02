import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── EVERY (app) PAGE STAMPS ITS OWN RENDER ──────────────────────────────────
//
// `RevalidateOnStale` tells a page the server just rendered from one served out
// of the Client Cache by the age of a stamp — and the stamp only tells the
// truth when it is part of the PAGE's payload (components/shell/page-stamp.tsx
// has the measured double render it caused from the (app) template). A page
// without <PageStamp/> is never corrected after a cached revisit; a stamp
// anywhere else brings the double render back. Both are silent, so both are
// guarded here.
const APP = __dirname;
const ROOT = join(APP, '..', '..');

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return e === 'page.tsx' ? [full] : [];
  });
}

/** Comment lines blanked, not dropped, so a guard cannot be satisfied by prose. */
const code = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l)).join('\n');

describe('page stamps', () => {
  const pages = pageFiles(APP);

  it('finds the (app) pages', () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it('every page that renders a view renders <PageStamp />', () => {
    const missing = pages.filter((f) => {
      const src = code(readFileSync(f, 'utf8'));
      const rendersJsx = /return\s*\(?\s*</.test(src);
      return rendersJsx && !/<PageStamp\s*\/>/.test(src);
    });
    expect(missing.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it('a page stamps once per branch, never twice in one tree', () => {
    for (const f of pages) {
      const src = code(readFileSync(f, 'utf8'));
      const returns = (src.match(/return\s*\(?\s*</g) ?? []).length;
      const stamps = (src.match(/<PageStamp\s*\/>/g) ?? []).length;
      expect(stamps, f.slice(ROOT.length + 1)).toBeLessThanOrEqual(returns);
    }
  });

  it('nothing above the pages stamps the render', () => {
    // The (app) template was where the double render came from.
    expect(existsSync(join(APP, 'template.tsx'))).toBe(false);
    const layout = code(readFileSync(join(APP, 'layout.tsx'), 'utf8'));
    expect(layout).not.toMatch(/RevalidateOnStale|PageStamp|serverRenderedAt/);
  });
});
