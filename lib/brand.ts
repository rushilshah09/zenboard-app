// ── THE LOGO, AS A FILE SOMEONE CAN USE ─────────────────────────────────────
//
// The website's logo answers a right-click the way Attio's does (user, 2026-09-26): "Copy wordmark
// as SVG" and "Copy logo as SVG". What is copied is the artwork itself: the paths the `Logo`
// component draws (components/ds/ui/icon.tsx, from illustration/logo.svg), read from the page rather
// than kept here a second time, so the file and the page can never be two different logos.
//
// A page's colours are references (`var(--accent)` for the mark, `currentColor` for the lettering)
// that only its stylesheet can resolve. A file pasted into Figma, a slide or an email has no
// stylesheet, so they become the brand's own colours: berry for the mark, the palette's ink for the
// letters.

import { BRAND_BERRY } from './theme';

/** The brand's own berry (the artwork's colour, not the calmer UI accent — lib/theme.ts), and the
 *  marketing palette's ink, for the lettering. */
export const BRAND_COLOURS = {
  mark: BRAND_BERRY,
  ink: '#191919',
} as const;

const XMLNS = 'http://www.w3.org/2000/svg';

/** The page's markup with everything only a page understands taken out: its classes, inline
 *  styles and data attributes, and its colour references, which become the palette's ink. */
function clean(markup: string): string {
  return markup
    .replace(/\s(?:class|style|data-[\w-]+|aria-[\w-]+|role)="[^"]*"/g, '')
    .replace(/fill="(?:var\([^)]*\)|currentColor)"/g, `fill="${BRAND_COLOURS.ink}"`)
    .replace(/><\/path>/g, '/>');
}

/** The lockup's first shape is the mark, and it wears the brand's colour, whatever the page painted
 *  it: berry where the page follows the accent, ink where an older lockup drew it in `currentColor`. */
const brandTheMark = (markup: string) =>
  markup.replace(/<path\b[^>]*?\sfill="[^"]*"/, (tag) => tag.replace(/\sfill="[^"]*"/, ` fill="${BRAND_COLOURS.mark}"`));

/** The lockup, mark and lettering, as a standalone SVG file. `rendered` is the `Logo` element's
 *  own markup (`outerHTML`). */
export function wordmarkSvg(rendered: string): string {
  const viewBox = rendered.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 152 32';
  const [, , w, h] = viewBox.split(/\s+/);
  const inner = rendered.slice(rendered.indexOf('>') + 1, rendered.lastIndexOf('</svg>'));
  return `<svg xmlns="${XMLNS}" width="${w}" height="${h}" viewBox="${viewBox}" fill="none">${brandTheMark(clean(inner))}</svg>`;
}

/** The mark alone, from the same artwork: the lockup's first shape, on its own square. */
export function logoSvg(rendered: string): string {
  const d = rendered.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? '';
  const [, , , h] = (rendered.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 152 32').split(/\s+/);
  return `<svg xmlns="${XMLNS}" width="${h}" height="${h}" viewBox="0 0 ${h} ${h}" fill="none"><path fill="${BRAND_COLOURS.mark}" d="${d}"/></svg>`;
}
