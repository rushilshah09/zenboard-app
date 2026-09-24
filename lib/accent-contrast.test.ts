import { describe, it, expect } from 'vitest';
import { ACCENTS, accentOn, accentHex } from './theme';

// The accent is the ONE hue in a monochrome product — the checked box, the
// calendar's "today" pill, the time on the now-marker. Two things were wrong,
// both invisible because a colour pairing has no runtime error:
//
//   1. ONE hex served both themes. Berry — the BRAND — measured 5.59:1 on a
//      light card and **2.91:1 on a dark one**, below the 3:1 floor WCAG 1.4.11
//      sets for a graphical object. Plum was 2.14:1.
//   2. ONE hardcoded near-white foreground, under the claim that "every swatch
//      is saturated enough that a near-white glyph reads best". White on the old
//      Amber measured **2.90:1**.
//
// This recomputes every pairing from the values themselves, so a seventh accent
// cannot be added that fails, and neither can a tweak to an existing one.
const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// The card each theme's accent actually sits on (theme-shadcn.css --card).
const CARD = { light: '#FFFFFF', dark: '#202020' } as const;

describe('the accent works in BOTH themes', () => {
  const cases = ACCENTS.flatMap((a) =>
    (['light', 'dark'] as const).map((mode) => [a.id, mode, mode === 'dark' ? a.dark : a.hex] as const),
  );

  it.each(cases)('%s / %s — the fill is visible on its card', (_id, mode, fill) => {
    // 3:1, the graphical-object minimum. An accent you cannot see against the
    // card is a signal that does not signal.
    expect(Number(contrast(fill, CARD[mode]).toFixed(2))).toBeGreaterThanOrEqual(3);
  });

  it.each(cases)('%s / %s — its text clears 4.5:1', (_id, _mode, fill) => {
    // 4.5, not the 3:1 graphical floor: --on-accent carries TEXT as well as
    // glyphs (the date in the today pill, the time on the now-marker).
    expect(Number(contrast(accentOn(), fill).toFixed(2))).toBeGreaterThanOrEqual(4.5);
  });

  it('accentHex returns the per-theme value', () => {
    const berry = ACCENTS.find((a) => a.id === 'berry')!;
    expect(accentHex('berry', 'light')).toBe(berry.hex);
    expect(accentHex('berry', 'dark')).toBe(berry.dark);
    // Defaulting to light is deliberate: SSR has no theme yet.
    expect(accentHex('berry')).toBe(berry.hex);
  });

  it('berry in light is the brand value and is not drifted by this system', () => {
    // Everything else may be tuned for contrast; the brand hue is fixed.
    expect(accentHex('berry', 'light')).toBe('#C41C72');
  });

  it('an unknown accent falls back to the brand, never to undefined', () => {
    expect(accentHex('nope' as never, 'light')).toBe(accentHex('berry', 'light'));
    expect(accentHex('nope' as never, 'dark')).toBe(accentHex('berry', 'dark'));
  });
});
