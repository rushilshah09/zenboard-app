import { describe, expect, it } from 'vitest';
import { BRAND_COLOURS, logoSvg, wordmarkSvg } from './brand';

// The logo a visitor copies is the page's own artwork as a file: every reference only a page can
// resolve is gone, and the brand's colours are in its place.

const RENDERED = '<svg data-slot="logo" height="24" viewBox="0 0 152 32" fill="none" class="block shrink-0" style="color: red"><path fill="var(--accent)" d="M1 1L31 31Z"></path><g fill="currentColor" style="opacity: 1"><path d="M40 1H50V10Z"></path></g></svg>';

describe('copying the logo', () => {
  it('copies the lockup as a file: its own size, the brand\'s colours, nothing of the page', () => {
    const svg = wordmarkSvg(RENDERED);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="152" height="32" viewBox="0 0 152 32" fill="none">')).toBe(true);
    expect(svg).toContain(`<path fill="${BRAND_COLOURS.mark}" d="M1 1L31 31Z"/>`);
    expect(svg).toContain(`<g fill="${BRAND_COLOURS.ink}"><path d="M40 1H50V10Z"/></g>`);
    expect(svg).not.toMatch(/var\(|currentColor|class=|style=|data-/);
  });

  it('paints the mark in berry however the page drew it', () => {
    const inkLockup = RENDERED.replace('fill="var(--accent)"', 'fill="currentColor"');
    expect(wordmarkSvg(inkLockup)).toContain(`<path fill="${BRAND_COLOURS.mark}" d="M1 1L31 31Z"/>`);
    expect(wordmarkSvg(inkLockup)).toContain(`<g fill="${BRAND_COLOURS.ink}">`);
  });

  it('copies the mark alone on its own square', () => {
    expect(logoSvg(RENDERED)).toBe(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"><path fill="${BRAND_COLOURS.mark}" d="M1 1L31 31Z"/></svg>`);
  });

  it('paints the mark in berry and the letters in the palette\'s ink', () => {
    expect(BRAND_COLOURS).toEqual({ mark: '#C41C72', ink: '#191919' });
  });
});
