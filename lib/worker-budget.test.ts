import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── THE 3 MiB WORKER CEILING ───────────────────────────────────────────────
//
// Cloudflare refuses a Worker over 3 MiB gzipped on the free plan. Measured
// 2026-09-10, the first time a real deploy was attempted: **3,185 KiB — 113 KiB
// over**, and the upload would have been rejected.
//
// The cause was one import shape. `BlockEditor` is ProseMirror, and it was
// STATICALLY imported at three call sites, so the whole editor was compiled
// into the server bundle. Loading it with `next/dynamic` + `ssr: false` took
// the worker to **2,788 KiB — 284 KiB under**, a 398 KiB saving.
//
// That is not a size hack. A ProseMirror view needs a real DOM to build
// itself, so it can never produce meaningful server HTML: every one of those
// bytes was work thrown away on first paint, and the editor only ever appears
// in a panel that opens on interaction. `database-view.tsx` already loaded it
// this way; the other three had drifted.
//
// This test cannot run `wrangler`, so it guards the IMPORT SHAPE rather than
// the number — which is the thing that regresses.
const ROOT = join(__dirname, '..');
const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'out', 'build', 'dev-preview']);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    if (SKIP.has(e)) return [];
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

describe('the editor never lands in the worker bundle', () => {
  it('BlockEditor is only ever imported dynamically, with ssr disabled', () => {
    const offenders: string[] = [];
    for (const f of [...tsxFiles(join(ROOT, 'components')), ...tsxFiles(join(ROOT, 'app'))]) {
      const src = readFileSync(f, 'utf8');
      // A STATIC import of the editor: `import { BlockEditor } from '…'`.
      if (/^import\s*\{[^}]*\bBlockEditor\b[^}]*\}\s*from/m.test(src)) {
        offenders.push(f.slice(ROOT.length + 1));
      }
    }
    expect(
      offenders,
      'A static import compiles ProseMirror into the Cloudflare worker, which has a ' +
        '3 MiB gzipped ceiling. Use `dynamic(() => import(...), { ssr: false })` — the ' +
        'editor cannot render on the server anyway.',
    ).toEqual([]);
  });

  it('every dynamic load of it disables ssr', () => {
    // `dynamic()` without `ssr: false` still server-renders, so it saves
    // nothing — the failure mode looks fixed and is not.
    for (const f of [...tsxFiles(join(ROOT, 'components')), ...tsxFiles(join(ROOT, 'app'))]) {
      const src = readFileSync(f, 'utf8');
      // Match the whole `dynamic(...)` call by BALANCING its parentheses —
      // a fixed-width window kept cutting off before the options object and
      // reported correct code as a violation.
      const start = src.search(/dynamic\(\s*\(\)\s*=>\s*import\([^)]*block-editor/);
      if (start === -1) continue;
      let depth = 0, end = start;
      for (let i = src.indexOf('(', start); i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      const m = [src.slice(start, end)];
      if (!m) continue;
      expect(m[0], `${f.slice(ROOT.length + 1)} loads the editor without ssr: false`).toMatch(/ssr:\s*false/);
    }
  });

  it('the deploy keeps --keep-vars', () => {
    // Unrelated to size, and the other way this deploy can go wrong:
    // `wrangler.jsonc` declares ZERO `vars`, so a deploy without --keep-vars
    // DELETES every dashboard-set secret.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.deploy).toContain('--keep-vars');
    expect(pkg.scripts.deploy, 'the gate must run before a deploy').toContain('npm run check');
  });
});
