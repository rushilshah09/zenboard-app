import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The website's rules, held in source. Each one is a decision the site made on purpose; a later edit
// that breaks it should have to say so here.

const home = readFileSync('components/site/site-home.tsx', 'utf8');
const stills = readFileSync('components/site/stills.tsx', 'utf8');
const root = readFileSync('app/page.tsx', 'utf8');

describe('the root', () => {
  it('is the website for visitors, and the app for anyone signed in', () => {
    expect(root).toMatch(/<SiteHome \/>/);
    // Someone with a session came to open the app — no database round trip to decide it.
    expect(root).toMatch(/sb-\.\+-auth-token/);
    expect(root).toMatch(/redirect\('\/today'\)/);
    expect(root).not.toMatch(/createClient|requireUser|getUser/);
  });
});

describe('the product pictures', () => {
  it('are drawn with the product’s own components, never an image of them', () => {
    expect(stills).not.toMatch(/<img|\.png|\.jpe?g|\.webp/);
    for (const part of ['Panel', 'Checkbox', 'DataTable', 'Badge', 'Progress']) expect(stills).toMatch(new RegExp(`<${part}\\b`));
  });

  it('are inert: part of the page’s picture, none of its controls', () => {
    expect(stills).toMatch(/aria-hidden inert className=\{cn\('pointer-events-none select-none'/);
    const bodies = stills.split(/export function /).slice(1);
    expect(bodies.length).toBe(5);
    for (const b of bodies) expect(b, b.slice(0, 20)).toMatch(/<Inert /);
  });

  it('show the sample studio, never a real client', () => {
    expect(stills).toMatch(/Ridgeline/);
    expect(stills).toMatch(/Alex/);
  });
});

describe('the page', () => {
  it('has one filled button per screen: the hero’s and the closing’s, never the nav’s', () => {
    expect(home.match(/variant: 'primary'/g)).toHaveLength(2);
    const nav = home.slice(home.indexOf('function Nav'), home.indexOf('function Hero'));
    expect(nav).not.toMatch(/variant: 'primary'/);
  });

  it('speaks in the editorial serif for headlines, and in the app’s face for the rest', () => {
    expect(home).toMatch(/<h1 id="hero-title" className="[^"]*font-editorial[^"]*text-hero/);
    expect(home.match(/<h2[^>]*font-editorial/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('uses tokens only — no raw colour and no palette class', () => {
    for (const src of [home, stills]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])/);
      expect(src).not.toMatch(/\b(bg|text|border)-(gray|slate|zinc|neutral|red|pink|blue|green)-\d{2,3}\b/);
    }
  });

  it('arrives in order once, and not at all for a keyboard arrival', () => {
    expect(home.match(/site-rise zb-enter/g)?.length).toBe(5);
    expect(readFileSync('app/globals.css', 'utf8')).toMatch(/\.site-rise \{ animation: fade-rise var\(--duration-slow\) var\(--ease-out-quiet\) both; animation-delay: calc\(var\(--rise-step, 0\) \* var\(--duration-fast\)\); \}/);
  });
});
