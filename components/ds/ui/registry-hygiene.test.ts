import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
// `npx shadcn@latest add <x>` writes straight into components/ds/ui (the `ui`
// alias in components.json), and it pulls DEPENDENCIES IN SILENTLY — `button`
// arrived three times without being asked for. Every component it writes needs
// the same four corrections, and every one of them fails INVISIBLY:
//
//   1. `from "cn"` — the CLI writes the alias as a bare module. Build error, at
//      least, so this one announces itself.
//   2. `lucide-react` — not a dependency here. Also a build error.
//   3. `animate-in` / `zoom-in-95` / `slide-in-from-*` need `tw-animate-css`,
//      which this project does not have. These are NO-OPS: the component works,
//      looks right in a screenshot, and simply never animates.
//   4. `bg-accent` — shadcn's `--accent` is a neutral hover surface. Zenboard's
//      `--accent` is the BRAND HUE, read by ~40 files. A registry menu would
//      highlight every hovered row in berry.
//
// 3 and 4 are the dangerous ones, because nothing fails. Hence a test.
const DIR = 'components/ds/ui';
const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

/** Strip comments — these names are DISCUSSED in the guidance above each fix. */
const code = (f: string) =>
  read(f).split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

describe('registry hygiene', () => {
  it('no component imports the bare "cn" module', () => {
    const bad = files.filter((f) => /from ["']cn["']/.test(code(f)));
    expect(bad, `rewrite to @/lib/cn in: ${bad.join(', ')}`).toEqual([]);
  });

  it('no component imports lucide-react', () => {
    // One icon seam (components/ds/icons.ts → @/lib/icons) is what makes
    // switching icon sets a one-file change.
    const bad = files.filter((f) => /from ["']lucide-react["']/.test(code(f)));
    expect(bad, `import from @/lib/icons in: ${bad.join(', ')}`).toEqual([]);
  });

  it('no component relies on tw-animate-css classes that do not exist here', () => {
    // The silent one. A menu with these classes and no `tw-animate-css` simply
    // appears — no emerge, no exit — and looks fine in a still screenshot.
    const DEAD = /\b(animate-in|animate-out|fade-in-0|fade-out-0|zoom-in-9[05]|zoom-out-9[05]|slide-in-from-\w+)\b/;
    const bad = files.filter((f) => DEAD.test(code(f)));
    expect(bad, `use animate-emerge / animate-exit in: ${bad.join(', ')}`).toEqual([]);
  });

  it('no component paints a surface with `accent`, which is the brand hue here', () => {
    // The other silent one, and the loudest on screen: every hovered menu row
    // would go berry.
    const bad = files.filter((f) => /\b(bg-accent|text-accent-foreground)\b(?!-)/.test(code(f)));
    expect(bad, `use bg-surface-hover in: ${bad.join(', ')}`).toEqual([]);
  });
});

describe('the default border colour is defined', () => {
  // Tailwind v4 makes a bare `border` paint `currentColor`, and every registry
  // component uses bare `border`. shadcn answers that with a base rule; this
  // project had neither the rule NOR the token it names, so the sign-in card
  // drew its edge in near-black ink — measured #0a0a0a, 19.8:1 against the card,
  // beside an input at 1.33:1. That is the "harsh line" the user reported.
  it('globals.css sets a default border-color', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toMatch(/\*,?[\s\S]{0,80}\{\s*border-color:\s*var\(--color-border\)/);
  });

  it('--color-border is actually mapped, or the rule above resolves to nothing', () => {
    const theme = readFileSync('app/theme-shadcn.css', 'utf8');
    expect(theme).toMatch(/--color-border:\s*var\(--border\)/);
  });
});

describe('a focus ring rings, it does not reshape', () => {
  // The global `:focus-visible` rule used to set `border-radius: var(--radius-sm)`
  // alongside its outline. Radix moves focus INTO a menu panel when it opens, so
  // an open dropdown — 12px by its own class — rendered at 6px for exactly as
  // long as it was open. Measured on the account menu. Any focused card or
  // dialog had the same problem.
  it('the global focus-visible rule sets no border-radius', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const rule = css.split('\n').find((l) => l.startsWith(':focus-visible:not(input)'))!;
    expect(rule, 'no global focus rule found').toBeDefined();
    expect(rule).toContain('outline:');
    expect(rule, 'a focus ring must not change geometry').not.toContain('border-radius');
  });
});

describe('floating surfaces share one radius', () => {
  // menu 8 · popover 12 · dialog 12 · card 16 was the state after the registry
  // landed: peers that can appear in the same breath, each a different shape.
  // One rule now — surface 12 (rounded-lg), 4px padding, inset child 8
  // (rounded-md) — which is concentric by construction and is what the
  // segmented control already did.
  const FLOATING = ['dropdown-menu', 'context-menu', 'command', 'popover', 'dialog', 'alert-dialog'];

  it.each(FLOATING)('%s uses rounded-lg for its surface', (name) => {
    const src = read(`${name}.tsx`);
    expect(src, `${name} should not carry a smaller panel radius`).not.toMatch(/rounded-md border bg-(popover|background)/);
  });
});
