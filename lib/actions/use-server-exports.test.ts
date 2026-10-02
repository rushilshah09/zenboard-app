import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ── A 'use server' FILE EXPORTS ASYNC FUNCTIONS AND NOTHING ELSE ────────────
//
// On 2026-09-29 the Tasks page rendered a red overlay and nothing else:
//
//   A "use server" file can only export async functions, found object.
//
// The object was `FILE_MESSAGES`, seven strings of failure copy, `export const` at the top of
// `lib/actions/inbox-file.ts`. Nothing outside that file even imported it. But
// `app/(app)/tasks/page.tsx` imports `suggestFiling` from it, Next validates a server module's
// exports when the module EVALUATES, and the whole route went down with it — an entire screen of
// the product, taken out by a lookup table that could have lived anywhere.
//
// WHY A TEST AND NOT A NOTE. The failure has three properties that together make it worth a guard:
//   · it is INVISIBLE in review — `export const MESSAGES = {…}` is unremarkable in every other file;
//   · it is LOUD at runtime but only on the route that imports it, so the file's own tests pass;
//   · and it is the same law as "a `'use server'` file cannot re-export", which this codebase
//     already learned once on milestones and wrote down. Learning it twice is the signal.
//
// Types are exempt because they are erased before the module exists: `export type FileFailure`
// survives, `export const FILE_MESSAGES` does not. The repair is always the same — the value was
// not an action, so it moves to the pure module beside it and the action imports it back.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/** `'use server'` has to be the module's first statement, so only a leading comment may precede it. */
const DIRECTIVE = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*['"]use server['"]/;

const ALLOWED = [
  /^export\s+async\s+function\s/,          // the only kind of value a server module may export
  /^export\s+default\s+async\s+function\s/,
  /^export\s+(type|interface)\s/,           // erased before the module evaluates
  /^export\s+\{\s*type\s/,
];

/** Every exported line in a server module, with its file and line, minus the legal shapes. */
export function offendingExports(files: { path: string; source: string }[]): string[] {
  const out: string[] = [];
  for (const { path, source } of files) {
    if (!DIRECTIVE.test(source.slice(0, 400))) continue;
    source.split('\n').forEach((line, i) => {
      const t = line.trim();
      if (!t.startsWith('export')) return;
      if (ALLOWED.some((re) => re.test(t))) return;
      out.push(`${path}:${i + 1}  ${t.slice(0, 120)}`);
    });
  }
  return out;
}

describe("a 'use server' module exports async functions and nothing else", () => {
  const files = [...walk('lib'), ...walk('app'), ...walk('components')]
    .filter((f) => !f.includes('.test.'))
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }));

  it('reads the shapes it guards (control)', () => {
    const at = (source: string) => offendingExports([{ path: 'x.ts', source }]);
    // The real bug, reduced. Each of these took a route down or would have.
    expect(at("'use server';\nexport const FILE_MESSAGES = { empty: 'a' };")).toHaveLength(1);
    expect(at("'use server';\nexport const LIMIT = 800;")).toHaveLength(1);
    expect(at("'use server';\nexport { proposeAll } from '@/lib/inbox-file';")).toHaveLength(1);
    expect(at("'use server';\nexport function notAsync() {}")).toHaveLength(1);
    // And the legal ones, which it must not flag.
    expect(at("'use server';\nexport async function suggestFiling() {}")).toEqual([]);
    expect(at("'use server';\nexport type FileFailure = 'empty';")).toEqual([]);
    expect(at("'use server';\nexport interface Answer { a: string }")).toEqual([]);
    // A module WITHOUT the directive is none of this test's business, whatever it exports.
    expect(at("export const FILE_MESSAGES = { empty: 'a' };")).toEqual([]);
    // A leading comment does not stop the directive being the first statement.
    expect(at("// a note\n'use server';\nexport const X = 1;")).toHaveLength(1);
  });

  it('finds the server modules to guard at all (control)', () => {
    const servers = files.filter((f) => DIRECTIVE.test(f.source.slice(0, 400)));
    expect(servers.length, 'the directive regex stopped matching — this test is measuring nothing')
      .toBeGreaterThan(20);
    expect(servers.map((f) => f.path)).toContain(join('lib', 'actions', 'inbox-file.ts'));
  });

  it('no server module exports a value that is not an async function', () => {
    expect(
      offendingExports(files),
      'move the value to the pure module beside it and import it back — a server module may not even re-export',
    ).toEqual([]);
  });
});
