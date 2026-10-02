import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_CLASS, CARD_INTERACTIVE_CLASS } from './card';

// ── ONE CARD ───────────────────────────────────────────────────────────────
//
// A card was spelled five ways for one job. Two of them were wrong in dark, where nobody had
// looked: `bg-paper` is L12.3 on an L8.7 canvas (Documents' gallery and the Collection Index),
// while every other card is L21.2. In light all the names are pure white — which is why the
// difference survived every audit. The edge split too: `border-line-soft` (ink 7%) measures
// 1.01:1 against the light canvas, the failure that once made the gallery read as a white strip.
//
// `cardClass()` is the recipe; this test is the reason it stays one.

const ROOT = 'components';
const files: string[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) files.push(p);
  }
})(ROOT);

/** A card's identity: a large radius, a decorative edge, a raised fill. */
const HAND_SPELLED = /rounded-(?:lg|xl) border border-(?:line|line-soft|border)\b[^"'`]*? bg-(?:surface-raised|paper|paper-3|card)\b/;

// The big floating surfaces — modal, drawer, the command palette, the side panel — are the
// OVERLAY family, not cards: they float, so they carry a shadow, and their fill follows the
// menus' (`OVERLAY_CLASS`). They get their own recipe; until then they are named here rather
// than silently matching the card pattern.
const OVERLAYS = ['components/ds/ui/modal.tsx', 'components/ds/ui/drawer.tsx', 'components/ds/ui/command-menu.tsx', 'components/ds/ui/page-view.tsx', 'components/ds/ui/toast.tsx'];

describe('the card recipe', () => {
  it('is the one every card uses — nobody spells it by hand', () => {
    const offenders = files
      .filter((f) => f !== 'components/ds/ui/card.tsx' && !OVERLAYS.includes(f))
      .flatMap((f) => {
        const lines = readFileSync(f, 'utf8').split('\n');
        return lines.map((l, i) => (HAND_SPELLED.test(l) ? `${f}:${i + 1} ${l.trim().slice(0, 90)}` : null)).filter(Boolean);
      });
    expect(offenders, 'use cardClass()/cardInteractiveClass() from components/ds/ui').toEqual([]);
  });

  it('catches a hand-spelled card (the control)', () => {
    expect(HAND_SPELLED.test('<div className="rounded-lg border border-line bg-paper">')).toBe(true);
    expect(HAND_SPELLED.test('<div className="flex overflow-hidden rounded-lg border border-line-soft bg-surface-raised p-3">')).toBe(true);
    // Not a card: a row's edge, a nested divider, an overlay's popover fill.
    expect(HAND_SPELLED.test('<div className="rounded-md border border-line-strong bg-surface-sunken">')).toBe(false);
    expect(HAND_SPELLED.test('<div className="rounded-lg border border-border bg-popover shadow-md">')).toBe(false);
  });

  it('draws a card that SITS: bordered, raised, no resting shadow', () => {
    expect(CARD_CLASS).toBe('rounded-lg border border-line bg-surface-raised surface-edge');
    // No ELEVATION: a card sits. `surface-edge` is material, not lift — one pixel of light on
    // its top edge in dark, a transparent no-op in light.
    expect(CARD_CLASS).not.toMatch(/shadow-(xs|sm|md|lg|lift|card|panel)/);
    // One hover language for an openable card: a wash over its own fill.
    expect(CARD_INTERACTIVE_CLASS).toContain('hover:wash-over');
    expect(CARD_INTERACTIVE_CLASS).toContain('focus-ring');
    expect(CARD_INTERACTIVE_CLASS).not.toMatch(/hover:border|hover:shadow|hover:-translate/);
  });

  it('is not pointed back at `--paper`, which is a DIFFERENT colour in dark', () => {
    // The reason the recipe names `surface-raised`, asserted at its source rather than agreed
    // between two constants: in dark `--color-paper` is the panel fill (L12.3) and
    // `--color-surface-raised` is the card fill (L21.2). Light makes them both white.
    // Read at the source of the values (theme-shadcn.css): the bridge maps --color-paper onto
    // --card and --color-paper-3 onto --popover, and in dark those are two different tones.
    const theme = readFileSync('app/theme-shadcn.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const dark = theme.slice(theme.search(/html\[data-theme='dark'\]\s*\{/));
    const card = /--card:\s*(oklch\([^)]*\))/.exec(dark)?.[1];
    const popover = /--popover:\s*(oklch\([^)]*\))/.exec(dark)?.[1];
    expect(card, 'dark --card (= --color-paper)').toBeTruthy();
    expect(popover, 'dark --popover (= --color-paper-3 = surface-raised)').toBeTruthy();
    expect(card).not.toBe(popover);
    const bridge = readFileSync('app/tokens-light.css', 'utf8');
    expect(bridge).toMatch(/--color-paper:\s*var\(--card\)/);
    expect(bridge).toMatch(/--color-paper-3:\s*var\(--popover\)/);
    expect(readFileSync('app/tokens.generated.css', 'utf8')).toMatch(/--color-surface-raised:\s*var\(--color-paper-3\)/);
  });
});
