import { describe, it, expect } from 'vitest';
import { ACCENTS, BRAND_BERRY, accentOn, accentHex } from './theme';

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
const CARD = { light: '#FFFFFF', dark: '#21201E' } as const;

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

  // ── THE UI BERRY IS THE BRAND'S HUE, CALMER (2026-10-02) ──────────────────
  // The brand artwork keeps #C41C72 (lib/brand.ts, the logo file, the website's illustrations);
  // the UI accent keeps that HUE and gives up the neon, because a 0.207-chroma magenta on every
  // primary button and checked box was the loudest thing on a calm screen. Asserted as a property:
  // the same hue within a few degrees, and visibly less saturated.
  const oklch = (hex: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => srgbToLin(parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2;
    return { C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
  };

  it('the brand artwork keeps its own berry', () => {
    expect(BRAND_BERRY).toBe('#C41C72');
  });

  it("the UI berry is the brand's hue, calmer", () => {
    const brand = oklch(BRAND_BERRY), ui = oklch(accentHex('berry', 'light'));
    const dh = Math.min(Math.abs(brand.H - ui.H), 360 - Math.abs(brand.H - ui.H));
    expect(dh, 'same hue as the brand').toBeLessThanOrEqual(4);
    expect(ui.C, 'calmer than the brand artwork').toBeLessThan(brand.C * 0.85);
  });

  it('every accent carries the same weight — one lightness per theme', () => {
    // Swapping accents changes the hue, never the loudness: all six sit within a narrow band of
    // relative luminance in each theme, so no choice makes the product louder than another.
    for (const mode of ['light', 'dark'] as const) {
      const lums = ACCENTS.map((a) => luminance(mode === 'dark' ? a.dark : a.hex));
      expect(Math.max(...lums) / Math.min(...lums), `${mode} accents differ in weight`).toBeLessThan(1.25);
    }
  });

  it('an unknown accent falls back to the brand, never to undefined', () => {
    expect(accentHex('nope' as never, 'light')).toBe(accentHex('berry', 'light'));
    expect(accentHex('nope' as never, 'dark')).toBe(accentHex('berry', 'dark'));
  });
});
