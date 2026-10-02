import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// `useServerState` replaced twenty-one hand-written copies of
//
//     const [rows, setRows] = useState(initialRows);
//     useEffect(() => { setRows(initialRows); }, [initialRows]);
//
// which is not just duplication: an effect runs after paint, so every server
// refresh rendered the stale rows, committed them, then set state and rendered
// again — two passes and a frame of stale data. `react-hooks/set-state-in-effect`
// flags it, and this keeps it flagged even for anyone who does not run eslint.
//
// There is no DOM in this suite, so the hook's behaviour is verified in the
// browser (optimistic set paints immediately; no render loop) rather than here.
// What IS checkable without a DOM is that the pattern has not come back.

const ROOT = join(__dirname, '..');
const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'out', 'build', 'launch-video']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** `useEffect(() => setX(y), [y])` — the shape, whatever the spacing. */
const RECONCILE = /useEffect\(\s*\(\)\s*=>\s*\{?\s*(set\w+)\(\s*([\w.]+)\s*\)\s*;?\s*\}?\s*,\s*\[\s*\2\s*\]\s*\)/;

/**
 * Prose is not code. Both of this file's first failures were comments — one in
 * `projects-workspace.tsx` explaining the migration and one in the hook's own
 * docstring quoting the pattern it replaced. A scanner that cannot tell the
 * difference makes the codebase unable to describe its own history.
 */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');

describe('server props reconcile through useServerState, not an effect', () => {
  const files = walk(ROOT);

  it('finds source files at all (guards the scan)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no `useEffect(() => setX(prop), [prop])` left anywhere', () => {
    const offences: string[] = [];
    for (const file of files) {
      stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
        if (RECONCILE.test(line)) offences.push(`${file.slice(ROOT.length + 1)}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    expect(offences).toEqual([]);
  });

  it('the hook still sets state during render, which is the whole point', () => {
    // If someone "fixes" the lint warning inside the hook by reaching for an
    // effect, every call site silently goes back to two render passes and the
    // test above keeps passing. So assert the mechanism, not just the absence.
    const src = stripComments(readFileSync(join(ROOT, 'lib/use-server-state.ts'), 'utf8'));
    expect(src).not.toMatch(/useEffect\s*\(/);
    expect(src).toMatch(/Object\.is/);
  });
});

// ── The other two render-phase hooks ────────────────────────────────────────
// `useLatest` and `useChanged` exist for the same reason as `useServerState`:
// each replaced a shape that had been written out by hand in every component
// that needed it, and each was a real defect rather than a style preference.
describe('useLatest replaced the hand-written latest-ref', () => {
  const files = walk(ROOT);

  it('nobody writes a ref during render any more', () => {
    // `const xRef = useRef(v); xRef.current = v;` — the write happens even for a
    // render React throws away, so the ref can hold a value that never
    // committed. Seven copies existed.
    const offences: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        // Two spellings of the same thing: the assignment on its own line
        // directly in the component body, and the declare-and-sync one-liner
        // (`const xRef = useRef(x); xRef.current = x;`). Inside a function —
        // a handler, an effect, a callback — writing a ref is exactly what refs
        // are for, so only a body-level write counts.
        const bodyLevel = /^ {2}(\w+)\.current\s*=\s*[^=]/.test(line);
        const oneLiner = /useRef\(/.test(line) && /\w+\.current\s*=\s*[^=]/.test(line);
        if (!bodyLevel && !oneLiner) return;
        offences.push(`${file.slice(ROOT.length + 1)}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offences).toEqual([]);
  });

  it('the hook writes in an effect, which is the whole point', () => {
    const src = stripComments(readFileSync(join(ROOT, 'lib/use-latest.ts'), 'utf8'));
    expect(src).toMatch(/useEffect\s*\(/);
  });
});

describe('useChanged replaced the reset-on-open effect', () => {
  it('compares during render rather than after paint', () => {
    // An effect reset a dialog's state post-paint, so reopening ⌘K showed the
    // previous search for a frame.
    const src = stripComments(readFileSync(join(ROOT, 'lib/use-changed.ts'), 'utf8'));
    expect(src).not.toMatch(/useEffect/);
    expect(src).toMatch(/Object\.is/);
  });
});
