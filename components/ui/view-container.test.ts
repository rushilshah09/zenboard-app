import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A SOURCE-SCANNING test, the same shape as the one guarding EmptyState.
//
// The rule cannot be checked by types: any page can re-derive the container by
// hand, and four of them had — Clients (×2), Projects and the invoice detail —
//
//     cn('px-[clamp(18px,3vw,40px)] pb-16 pt-8', !full && 'mx-auto max-w-[1200px]')
//
// hard-coding a width and a gutter that tokens already express, and
// re-implementing ViewContainer's own opt-out. Nothing failed, which is exactly
// why it survived. This fails.
//
// ── WHY THE CHECKS ARE NARROW ───────────────────────────────────────────────
// The first version of this test flagged `max-w-[36ch]` on a paragraph and the
// forms builder's 720px measure. Both are legitimate: a CONTENT measure inside a
// pane is not a PAGE container, and the client portal and the DS portal are
// separate chromes with their own layout. A guard that cries wolf gets deleted,
// so these match the fingerprint of the container being rebuilt, and nothing
// else.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** Comments describe the offence; only code commits it. */
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

const files = walk('components').filter((f) => !f.endsWith('.test.tsx'));

describe('page width comes from ViewContainer', () => {
  it('nobody re-types the responsive page gutter', () => {
    // `--view-px` is the token. This exact clamp appeared in FOUR files, all
    // copies of one another — two answers to a settled question drift the
    // moment either changes.
    const offenders = files.filter((f) => /px-\[clamp\(/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('nobody rebuilds the centered page column', () => {
    // The fingerprint: centering + a hard-coded pixel cap + one of the page's
    // OWN vertical padding tokens on the same element. A `max-w-[720px]` prose
    // measure has none of the third, which is what keeps this from firing on
    // the forms builder.
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith('view-container.tsx')) continue;
      code(file).split('\n').forEach((line, i) => {
        const rebuild =
          /mx-auto/.test(line) &&
          /max-w-\[\d+px\]/.test(line) &&
          /var\(--view-p[btx]\)/.test(line);
        if (rebuild) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('scanned a believable number of files', () => {
    // A must-fail control for the scan itself: a walk that quietly matched
    // nothing would make both checks above pass forever.
    expect(files.length).toBeGreaterThan(50);
  });
});
