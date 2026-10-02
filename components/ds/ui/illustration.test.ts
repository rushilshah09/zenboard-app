import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { ILLUSTRATIONS } from './illustration';

// The style's rules, held where the art ships (brand/illustrations/style.json): ink, paper and ONE
// berry mark on a flat field. A generated drawing that drifted — a second accent, an off-palette
// cream, an embedded photo — fails here instead of in front of a client.

const PALETTE = new Set(['#191919', '#FBFAF6', '#C41C72']);
const globals = readFileSync('app/globals.css', 'utf8');

describe('every illustration the app ships', () => {
  const entries = Object.entries(ILLUSTRATIONS);

  it('has at least one (control)', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [name, art] of entries) {
    const file = `public${art.src}`;
    describe(`${name} (${art.id})`, () => {
      it('exists where the app loads it from', () => {
        expect(existsSync(file), file).toBe(true);
      });

      const svg = existsSync(file) ? readFileSync(file, 'utf8') : '';
      const fills = [...svg.matchAll(/fill="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1].toUpperCase());

      it('uses only ink, paper and berry — the field is painted by the app', () => {
        expect(fills.length).toBeGreaterThan(0);
        expect(fills.filter((f) => !PALETTE.has(f))).toEqual([]);
      });

      it('carries the berry mark exactly once', () => {
        expect(fills.filter((f) => f === '#C41C72')).toHaveLength(1);
      });

      it('is a drawing, not a picture of one', () => {
        // No embedded bitmap, no text to go stale or untranslated.
        expect(svg).not.toMatch(/<image|<text|base64/);
      });

      it('sits on a field the theme defines', () => {
        expect(globals).toMatch(new RegExp(`--color-field-${art.field}: #[0-9A-F]{6};`));
      });
    });
  }
});

describe('the illustration frame', () => {
  const src = readFileSync('components/ds/ui/illustration.tsx', 'utf8');

  it('is decorative — the words beside it carry the meaning', () => {
    expect(src).toMatch(/aria-hidden/);
    expect(src).toMatch(/alt=""/);
  });

  it('edges a picture with the picture token, never a tinted neutral', () => {
    expect(src).toMatch(/outline-edge-image/);
    expect(readFileSync('app/theme-shadcn.css', 'utf8')).toMatch(/--edge-image: oklch\(0 0 0 \/ 0\.1\);[\s\S]*--edge-image: oklch\(1 0 0 \/ 0\.1\);/);
  });
});
