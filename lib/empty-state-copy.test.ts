import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The design rule for empty states is "≤180px tall, 1 title line + ≤1 sentence".
// Height is CSS and there is no DOM in this suite — but the thing that actually
// decides the height IS statically checkable: a description that fits one line
// renders at exactly the 180px budget, and one that wraps costs 20px per extra
// line. So the rule is enforced here on the copy rather than trusted to memory.
//
// Measured 2026-08-05 in the browser, `size="page"`:
//   24 pad + 20 icon + 12 + 24 title + 12 + 20 text + 12 + 32 action + 24 = 180
// Every extra wrapped line of description adds 20px on top of that.
//
// This caught five real violations when it was written, including a 159-char
// two-sentence forms description that rendered as a three-line billboard on the
// emptiest page in the app.

const ROOT = join(__dirname, '..');
const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'out', 'build']);

// A one-line description at `text-body` in a centred column. `max-w-[52ch]` is
// the component's measure, so this is that measure, not a taste.
const ONE_LINE_CH = 52;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

export interface EmptyStateCall {
  file: string;
  line: number;
  size: 'page' | 'inline';
  description: string | null;
  /** Template holes stand in as a typical word — `${active}` is "quarter". */
  measured: number;
  sentences: number;
}

/** Find every `<EmptyState …>` in the app and read its copy back out. */
function findCalls(): EmptyStateCall[] {
  const calls: EmptyStateCall[] = [];
  for (const file of walk(ROOT)) {
    // The component's own definition is not a call site.
    if (file.endsWith(join('components', 'ds', 'ui', 'states.tsx'))) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<EmptyState\b/g)) {
      // Walk to the `>` that closes this opening tag, ignoring any inside a
      // JSX expression — `primary={<Button …>}` contains plenty of them.
      let i = m.index! + m[0].length;
      let depth = 0;
      let end = -1;
      while (i < src.length) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) { end = i; break; }
        i++;
      }
      const tag = src.slice(m.index!, end === -1 ? m.index! + 500 : end + 1);
      const dm = /description=(?:\{[`"']([^`"']*)[`"']\}|"([^"]*)")/.exec(tag);
      const description = dm ? (dm[1] ?? dm[2]) : null;
      const filled = (description ?? '').replace(/\$\{[^}]*\}/g, 'quarter');
      calls.push({
        file: file.slice(ROOT.length + 1),
        line: src.slice(0, m.index!).split('\n').length,
        size: /size=["']inline["']/.test(tag) ? 'inline' : 'page',
        description,
        measured: filled.length,
        sentences: filled.trim() ? filled.trim().split(/(?<=[.!?])\s+/).filter(Boolean).length : 0,
      });
    }
  }
  return calls;
}

const CALLS = findCalls();
const at = (c: EmptyStateCall) => `${c.file}:${c.line}`;

describe('every empty state in the app', () => {
  it('is actually found by the scan (guards the scan itself)', () => {
    // If the regex ever stops matching, every other test in here passes
    // vacuously — which is how a lint-by-test quietly stops linting.
    expect(CALLS.length).toBeGreaterThan(15);
    expect(CALLS.some((c) => c.size === 'inline')).toBe(true);
    expect(CALLS.some((c) => c.size === 'page')).toBe(true);
  });

  it('says at most one sentence', () => {
    const over = CALLS.filter((c) => c.sentences > 1);
    expect(over.map((c) => `${at(c)} — ${c.sentences} sentences: ${c.description}`)).toEqual([]);
  });

  it('keeps a page-size description on one line, so the state stays at 180px', () => {
    const over = CALLS.filter((c) => c.size === 'page' && c.measured > ONE_LINE_CH);
    expect(over.map((c) => `${at(c)} — ${c.measured}ch > ${ONE_LINE_CH}ch: ${c.description}`)).toEqual([]);
  });

  it('never writes a description that is only the button again', () => {
    // "Add an event when you need one." under a button that says "Add an event"
    // spends a line of the budget to repeat itself.
    const echoes = CALLS.filter((c) => {
      if (!c.description) return false;
      const d = c.description.toLowerCase().replace(/[^a-z ]/g, '').trim();
      return d.length > 0 && d.length < 34 && /^(add|create|new) /.test(d);
    });
    expect(echoes.map(at)).toEqual([]);
  });
});
