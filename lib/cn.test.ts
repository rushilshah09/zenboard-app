import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cn } from './cn';

// ── A SIZE AND A COLOUR NEVER COLLIDE ─────────────────────────────────────
//
// tailwind-merge does not know the theme's named font sizes, so it filed an unknown `text-<name>` in the COLOUR group
// and kept only the last of a size and a colour. lib/cn registered thirteen names in July; the theme declares
// twenty-six. Found 2026-09-22 when a goal's title — `cn('text-h4', 'text-ink-900')` — rendered at body size: the
// merge had thrown the size away. Every `text-small`, `text-label`, `text-h1…h4`, `text-body-lg`, `text-micro` passed
// through cn() beside a colour was at risk the same way.

/** Every font size the theme declares (`--text-<name>:` with a length, in any @theme block). */
function themeSizes(): string[] {
  const names = new Set<string>();
  for (const f of ['app/ds-theme.css', 'app/globals.css', 'app/tokens.css', 'app/tokens-light.css']) {
    let css = '';
    try { css = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of css.matchAll(/--text-([a-z0-9-]+):\s*([^;]+);/g)) {
      const [name, value] = [m[1], m[2].trim()];
      // Companion variables (`--text-h4-lh`, `-weight`, `-tracking`, `-size`, `--text-x--line-height`) are not sizes.
      if (/-(lh|weight|tracking|size|line-height|letter-spacing|font-weight)$/.test(name)) continue;
      // A SIZE is a length — px, rem or em, a clamp()/calc() of them, or the `--text-<name>-size` variable the
      // globals.css @theme maps each role to — never a colour or a unitless number.
      if (/^[\d.]+(px|rem|em)$/.test(value) || /^(clamp|calc)\(/.test(value) || /^var\(--text-[a-z0-9-]+-size\)$/.test(value)) names.add(name);
    }
  }
  return [...names].sort();
}

describe('cn keeps a font size beside a colour', () => {
  it('reads the theme (control: it finds the sizes)', () => {
    const sizes = themeSizes();
    expect(sizes).toContain('h4');
    expect(sizes).toContain('ui');
    expect(sizes.length).toBeGreaterThan(15);
  });

  it.each(themeSizes())('text-%s survives beside text-ink-900', (name) => {
    expect(cn(`text-${name}`, 'text-ink-900').split(' ')).toEqual([`text-${name}`, 'text-ink-900']);
  });

  it('still lets a later size win over an earlier one — they are one group', () => {
    expect(cn('text-small', 'text-h4')).toBe('text-h4');
  });
});
