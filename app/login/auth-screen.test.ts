import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── THE FIRST SCREEN SHOWS THE PRODUCT ─────────────────────────────────────
//
// "This also looks so boring" (user, 2026-09-23, on the dark sign-up screen): a 400px card in the
// middle of an otherwise empty page, carrying two slogans and nothing about Zenboard. The screen
// became a split — the form, and the product at rest beside it, drawn with the app's own parts.
//
// Then, 2026-09-25, three more notes, each of which this file pins so it cannot quietly come
// undone:
//   · "i want show product not just components there" — a column of panels is a gallery.
//   · "remove left side of uplist and right side of screen make overflow … half visible and
//     continues" — a screen says "there is more of me" by running off the edge.
//   · "dont use my client name we focus usa clients" — the sample week is a generic US studio's.
//
// and the look those notes are part of: a SHEET lying on a darker ground, the brand's own hue on
// the mark, the product's name in the heading and the one filled action.

const src = readFileSync('app/login/page.tsx', 'utf8');
const markup = src.replace(/^\s*\/\/.*$/gm, '').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');
/** Everything the eye reads: JSX text, plus the strings the sample content is made of. */
const copy = [
  ...[...markup.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ...[...markup.matchAll(/(?:title|where|what|name|meta|placeholder|label|summary):?\s*[:=]\s*'([^']+)'/g)].map((m) => m[1]),
].map((s) => s.trim()).filter(Boolean);

describe('the auth screen', () => {
  it('is one page with ONE thing raised on it', () => {
    // "left side of ui on background, no uplifted" and then "background canvas colour is only
    // same … ui dashboard uplifted" (user, 2026-09-25). So: ONE ground from edge to edge, the
    // form lying directly on it, and the product the only object that comes off it.
    expect(markup).toMatch(/absolute inset-0 grid grid-cols-1 bg-canvas/);
    expect(markup.match(/className="sheet /g)?.length, 'exactly one raised sheet').toBe(1);
    expect(markup).not.toMatch(/bg-surface-desk/);   // a second ground reads as two pages
    expect(markup).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.05fr\)\]/);
    expect(markup).toMatch(/function ProductStill/);
  });

  it('wears the brand: the mark, the name in the heading, one filled accent', () => {
    expect(markup).toMatch(/<Wordmark \/>/);
    expect(markup).toMatch(/<span className="text-accent-text">Zenboard<\/span>/);
    // ONE filled accent on the page (CLAUDE.md). The second action is the same hue as an edge.
    expect(markup.match(/variant="brand"/g)?.length, 'one filled brand button').toBe(1);
    expect(markup.match(/variant="brandOutline"/g)?.length, 'the log-in pill is an edge').toBe(1);
    expect(markup).not.toMatch(/variant="primary"/);
  });

  it('draws the still with the app’s own components — never a picture of them', () => {
    for (const part of ['<Panel frame="shadow">', '<PanelHeader', '<PanelBody>', '<Checkbox']) {
      expect(markup, part).toContain(part);
    }
    // A still is furniture: no tab stop, no pointer, nothing read aloud over the form.
    expect(markup).toMatch(/<aside[\s\S]{0,40}aria-hidden/);
    expect(markup).toMatch(/pointer-events-none/);
    expect(markup).toMatch(/tabIndex=\{-1\}/);
    // And it is gone on a phone, where the form is the only thing worth the screen.
    expect(markup).toMatch(/hidden[^"]*lg:block/);
  });

  it('runs off the edge of the window, because that is what a screen does', () => {
    // The panel keeps the corners the window has not eaten, and drops the two it has.
    expect(markup).toMatch(/rounded-e-none rounded-b-none/);
    // The page inside is wider than the sheet it sits in, so the window CUTS it.
    const width = markup.match(/absolute inset-y-0 start-0 w-\[(\d+)px\]/);
    expect(width, 'the still has a fixed measure').not.toBeNull();
    expect(Number(width![1]), 'wider than half of a 1440 window').toBeGreaterThan(720);
    // No nav rail beside it: the reference has none, and it is the least readable half of a
    // half-width picture.
    expect(markup).not.toMatch(/<nav/);
  });

  it('says nothing it cannot mean — no slogans, no em dashes, no real client', () => {
    // The two slogans that were there, and the shapes they came in.
    expect(markup).not.toMatch(/calmer day|quiet workspace/i);
    const sentences = [...markup.matchAll(/>([A-Z][^<>{}]{12,})</g)].map((m) => m[1].trim());
    for (const s of sentences) {
      expect(s, `sentence, not a slogan: "${s}"`).not.toMatch(/^(Two minutes|Your day|Everything you|Work that|A calmer)/);
    }
    // The user's own clients are not sample data (2026-09-25). Nor is anyone else's.
    for (const name of ['Balluji', 'TechSpark', 'Acme']) {
      expect(copy.join(' '), `${name} is a real client, not a sample`).not.toContain(name);
    }
    // "remove em dash": the copy on this screen uses a colon or a middle dot instead.
    for (const line of copy) expect(line, `em dash in "${line}"`).not.toMatch(/—/);
  });

  it('keeps the form outside a card, and the field a wash rather than a box', () => {
    // The form is the sheet here; wrapping it in a Card is what made it read as a dialog.
    expect(src).not.toMatch(/from ['"]@\/components\/ds\/ui\/card['"]/);
    expect(markup).not.toMatch(/<Card\b/);
    expect(markup).toMatch(/<h1 className=/);
    // `tone` is left to the DS default, which is `soft` — stated here so a change to that
    // default is a decision about this screen too.
    expect(markup).not.toMatch(/tone="outline"/);
  });

  it('never ships a second password field or an autofilled credential', () => {
    // A sanity line for the screen that handles credentials: two inputs, no value baked in.
    expect(markup.match(/<TextInput/g)?.length).toBe(2);
    expect(markup).not.toMatch(/defaultValue=["'][^"']+["']/);
  });

  it('tells you the password rule while you are typing it', () => {
    expect(markup).toMatch(/MIN_PASSWORD/);
    expect(markup).toMatch(/longEnough \? 'text-success-600' : 'text-ink-500'/);
    // Only on sign-up: on sign-in the password exists and its rules are not yours to satisfy.
    expect(markup).toMatch(/\{isSignup && \(pwFocused \|\| pw\.length > 0\) && \(/);
  });
});
