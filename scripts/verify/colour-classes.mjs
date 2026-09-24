// ── WHICH COLOUR CLASSES THE THEME CAN DRAW ────────────────────────────────
// Tailwind v4 generates a colour utility ONLY for a `--color-*` declared inside
// an `@theme` block. Any other name — a step a ramp never had (`danger-700`), a
// retired Paper-OS name (`berry-alpha-20`), a name the docs use but the theme
// never declared (`bg-surface`) — generates nothing at all, with no warning. The
// element keeps its inherited text colour, no fill, and the default border.
//
// One scanner, two readers, so they cannot disagree about what a colour class is:
//   · app/design-system.test.ts — the static guard, on every test run;
//   · scripts/verify/audit-colour-classes.mjs — the runtime audit, which also
//     asks a browser what each DECLARED class resolves to in both themes.
//
// Plain JS with JSDoc so node runs it directly and vitest/tsc read its types.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The names one namespace declares inside `@theme` blocks, across CSS sources —
 * `color` → `ink-900`, `text` → `label`. Declarations outside `@theme` (a plain
 * `:root`) make custom properties, not utilities, so they are not counted.
 * @param {string[]} cssSources
 * @param {string} namespace
 * @returns {Set<string>}
 */
export function themeNames(cssSources, namespace) {
  const names = new Set();
  const decl = new RegExp(`--${namespace}-([a-z0-9][a-z0-9-]*?)\\s*:`, 'g');
  for (const raw of cssSources) {
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const open of css.matchAll(/@theme\b[^{]*\{/g)) {
      let depth = 1, i = open.index + open[0].length;
      const start = i;
      for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
      for (const m of css.slice(start, i - 1).matchAll(decl)) {
        // `--text-body--line-height` is a property OF `body`, not a name of its own.
        if (!m[1].includes('--')) names.add(m[1]);
      }
    }
  }
  return names;
}

/**
 * The theme as the scanner needs it: declared colours, the other namespaces whose
 * values can look like colour names, and the colour FAMILIES (first segments).
 * @param {string} [appDir]
 */
export function readTheme(appDir = 'app') {
  const css = readdirSync(appDir).filter((n) => n.endsWith('.css')).map((n) => readFileSync(join(appDir, n), 'utf8'));
  const colours = themeNames(css, 'color');
  return {
    colours,
    // `text-label` is a type size and `shadow-popover` would be a shadow: a name
    // declared in the utility's OTHER namespace is not a colour at all.
    other: {
      text: themeNames(css, 'text'),
      shadow: themeNames(css, 'shadow'),
      'inset-shadow': themeNames(css, 'inset-shadow'),
    },
    families: new Set([...colours].map((n) => n.split('-')[0])),
  };
}

/** Longest alternatives first, so `border-t-line` reads as `border-t` + `line`. */
const PREFIX = /^(inset-shadow|inset-ring|ring-offset|border-[trblxyse]|border|text|bg|ring|outline|fill|stroke|divide|placeholder|caret|decoration|accent|from|via|to|shadow)-(.+)$/;

/**
 * Source with its comments blanked, line numbers kept. A comment that records
 * which class USED to be dead is documentation, not a class.
 * @param {string} source
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\s\/\/\s.*$/, '')))
    .join('\n');
}

/**
 * The utility a class token applies, without its variants, `!` or opacity.
 * Variants split on TOP-LEVEL colons only: `data-[state=open]:bg-x` → `bg-x`.
 * @param {string} token
 */
function utilityOf(token) {
  let depth = 0, cut = -1;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '[') depth++;
    else if (token[i] === ']') depth--;
    else if (token[i] === ':' && depth === 0) cut = i;
  }
  return token.slice(cut + 1).replace(/^!|!$/g, '');
}

/**
 * Every colour-prefixed class token in a source file, with its 1-based line.
 * Tokens split on whitespace and quotes only — the same bracket-safe split the
 * theme guards use — so `data-[state=open]:bg-surface-hover` stays whole.
 * @param {string} source
 * @returns {{ token: string, line: number, prefix: string, name: string }[]}
 */
export function colourClassTokens(source) {
  const out = [];
  withoutComments(source).split('\n').forEach((line, i) => {
    for (const token of line.split(/[\s"'`]+/)) {
      if (!token || token.includes('${')) continue;
      const m = PREFIX.exec(utilityOf(token));
      if (!m || m[2].startsWith('[')) continue;               // arbitrary values are not theme names
      const name = m[2].replace(/\/(?:\d+|\[[^\]]*\])$/, '');  // opacity modifier
      if (!/^[a-z][a-z0-9-]*$/.test(name)) continue;
      out.push({ token, line: i + 1, prefix: m[1], name });
    }
  });
  return out;
}

/**
 * The colour classes in `source` that name no colour the theme declares.
 * @param {string} source
 * @param {ReturnType<typeof readTheme>} theme
 */
export function undeclaredColourClasses(source, theme) {
  return colourClassTokens(source).filter(({ prefix, name }) => {
    if (!theme.families.has(name.split('-')[0])) return false; // not a colour name at all (`text-ui`, `ring-4`)
    if (theme.colours.has(name)) return false;
    const other = /** @type {Record<string, Set<string>>} */ (theme.other)[prefix];
    return !(other && other.has(name));
  }).map(({ token, line }) => ({ token, line }));
}

const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'out', 'build', 'dev-preview-spike']);

/**
 * Component and app source files under `dirs`, tests excluded.
 * @param {string[]} dirs
 * @returns {string[]}
 */
export function sourceFiles(dirs) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(path);
    }
  };
  dirs.forEach(walk);
  return out;
}
