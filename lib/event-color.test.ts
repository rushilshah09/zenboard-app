import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { eventTokens, DEFAULT_EVENT_COLOR } from './event-color';
import { ACCENTS } from './theme';

// "Why does the default colour look so bad when the other colours look good?" (user, 2026-09-21, two screenshots:
// an ochre event and a default one). Every palette hue is a trio — dot · fill · text, all one family — while the
// default was the accent bar on a NEUTRAL card with neutral text: a stripe pasted onto grey. The default is now the
// accent dressed as a palette colour. These tests hold the three things that must stay true.

describe('the default event is a palette colour, not a stripe on grey', () => {
  it('the default is the accent, and it tints the whole card like every other colour', () => {
    expect(DEFAULT_EVENT_COLOR).toBe('accent');
    const t = eventTokens(null);
    expect(t.bar).toBe('var(--accent)');
    expect(t.bg).toBe('var(--event-accent-bg)');
    expect(t.text).toBe('var(--event-accent-text)');
    // …and a picked colour is still its own palette trio.
    expect(eventTokens('yellow')).toEqual({ bar: 'var(--pal-yellow-dot)', bg: 'var(--pal-yellow-bg)', text: 'var(--pal-yellow-text)' });
  });
});

// ── The trio is computed from the accent in CSS, so check it the way CSS computes it ──────────────────────────
// `color-mix(in srgb, A p%, B)` interpolates the ENCODED sRGB channels. The percentages are read from the CSS itself,
// so the test cannot drift from what ships; the surfaces are the measured values of --color-paper / --color-ink-900.
const css = readFileSync('app/globals.css', 'utf8');
const tokens = readFileSync('app/tokens-light.css', 'utf8');
const block = (selector: string) => tokens.slice(tokens.lastIndexOf(selector)).split(/\n\}/)[0];
const tint = (mode: 'light' | 'dark') => Number(block(`html[data-theme='${mode}'] {`).match(/--event-tint:\s*([\d.]+)%/)?.[1]);
const textMix = Number(css.match(/--event-accent-text:\s*color-mix\(in srgb, var\(--accent\) ([\d.]+)%, var\(--color-ink-900\)\)/)?.[1]);
const SURFACE = { light: { paper: '#FFFFFF', ink: '#37352F' }, dark: { paper: '#202020', ink: '#D4D4D4' } } as const;

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
const mix = (a: number[], b: number[], p: number) => a.map((x, i) => Math.round(x * p + b[i] * (1 - p)));
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe('the default event card, for every accent in both themes', () => {
  it('reads its own tokens (control)', () => {
    expect(tint('light')).toBeGreaterThan(0);
    expect(tint('dark')).toBeGreaterThan(0);
    expect(textMix).toBeGreaterThan(0);
  });

  const cases = ACCENTS.flatMap((a) => (['light', 'dark'] as const).map((mode) => [a.id, mode, mode === 'dark' ? a.dark : a.hex] as const));

  it.each(cases)('%s / %s — its text clears 4.5:1 on its own fill', (_id, mode, accent) => {
    const s = SURFACE[mode];
    const fill = mix(rgb(accent), rgb(s.paper), tint(mode) / 100);
    const text = mix(rgb(accent), rgb(s.ink), textMix / 100);
    expect(Number(contrast(text, fill).toFixed(2))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases)('%s / %s — its fill is a whisper, as calm as the palette’s own', (_id, mode, accent) => {
    // The palette's fills sit 1.03–1.15 off the card. Below 1.03 the card is back to reading as nothing; far above
    // the palette's own it is the loud accent wash rejected on 2026-09-07.
    const s = SURFACE[mode];
    const fill = mix(rgb(accent), rgb(s.paper), tint(mode) / 100);
    const off = contrast(fill, rgb(s.paper));
    expect(off).toBeGreaterThanOrEqual(1.03);
    expect(off).toBeLessThanOrEqual(1.16);
  });
});
