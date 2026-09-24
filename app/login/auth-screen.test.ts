import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── THE FIRST SCREEN SHOWS THE PRODUCT ─────────────────────────────────────
//
// "This also looks so boring" (user, 2026-09-23, on the dark sign-up screen): a 400px card in the
// middle of an otherwise empty page, carrying two slogans and nothing about Zenboard. The screen is
// a split now — the form, and the product at rest beside it, drawn with the app's own Panel, rows,
// checkbox and accent chip. This pins the three things that made it boring, so they cannot return.

const src = readFileSync('app/login/page.tsx', 'utf8');
const markup = src.replace(/^\s*\/\/.*$/gm, '').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');

describe('the auth screen', () => {
  it('shows the product beside the form, not a lone box', () => {
    expect(markup).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.05fr\)\]/);
    expect(markup).toMatch(/function ProductStill/);
    // Both halves of the day — what is planned, and when it happens.
    expect(markup).toMatch(/title="Today"/);
    expect(markup).toMatch(/title="Schedule"/);
  });

  it('draws the still with the app’s own components — never a picture of them', () => {
    for (const part of ['<Panel frame="shadow">', '<PanelHeader', '<PanelBody>', '<Checkbox']) {
      expect(markup, part).toContain(part);
    }
    // A still is furniture: no tab stop, no pointer, nothing read aloud over the form.
    expect(markup).toMatch(/<aside aria-hidden/);
    expect(markup).toMatch(/pointer-events-none/);
    expect(markup).toMatch(/tabIndex=\{-1\}/);
    // And it is gone on a phone, where the form is the only thing worth the screen.
    expect(markup).toMatch(/hidden[^"]*lg:flex/);
  });

  it('says nothing it cannot mean — no slogans', () => {
    // The two that were there, and the shapes they came in.
    expect(markup).not.toMatch(/calmer day|quiet workspace/i);
    const strings = [...markup.matchAll(/>([A-Z][^<>{}]{12,})</g)].map((m) => m[1].trim());
    for (const s of strings) {
      expect(s, `sentence, not a slogan: "${s}"`).not.toMatch(/^(Two minutes|Your day|Everything you|Work that|A calmer)/);
    }
  });

  it('keeps one filled button, and the form outside a card', () => {
    expect(markup.match(/variant="primary"/g)?.length).toBe(1);
    // The form is the page here; wrapping it in a Card is what made it read as a dialog.
    expect(src).not.toMatch(/from ['"]@\/components\/ds\/ui\/card['"]/);
    expect(markup).not.toMatch(/<Card\b/);
    expect(markup).toMatch(/<h1 className=/);
  });

  it('never ships a second password field or an autofilled credential', () => {
    // A sanity line for the screen that handles credentials: two inputs, no value baked in.
    expect(markup.match(/<TextInput/g)?.length).toBe(2);
    expect(markup).not.toMatch(/defaultValue=["'][^"']+["']/);
  });
});
