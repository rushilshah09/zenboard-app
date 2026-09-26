import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// The website's rules, held in source. Each is a decision the site made on purpose; an edit that
// breaks one should have to say so here.

const read = (f: string) => readFileSync(f, 'utf8');
const SITE = readdirSync('components/site').filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts')).map((f) => `components/site/${f}`);
const all = SITE.map((f) => [f, read(f)] as const);
const home = read('components/site/site-home.tsx');
const root = read('app/page.tsx');
const globals = read('app/globals.css');

describe('the root', () => {
  it('is the website for visitors, and the app for anyone signed in', () => {
    expect(root).toMatch(/<SiteHome \/>/);
    // Someone with a session came to open the app — no database round trip to decide it.
    expect(root).toMatch(/sb-\.\+-auth-token/);
    expect(root).toMatch(/redirect\('\/today'\)/);
    expect(root).not.toMatch(/createClient|requireUser|getUser/);
  });
});

describe('honesty', () => {
  it('shows no testimonials, customer logos or invented numbers', () => {
    // In what the page RENDERS — a comment explaining the rule is allowed to name it.
    for (const [f, raw] of all) {
      const src = raw.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
      expect(src, f).not.toMatch(/trusted by|testimonial|customers love|\b\d+(k|,000)\+?\s+(teams|users|customers|studios)\b/i);
    }
  });

  it('writes copy a person would say aloud: no em dashes, and no real client as sample data', () => {
    // The user, 2026-09-25: "remove em dash", and "dont use my client name we focus usa clients" —
    // the same two rules the sign-up screen holds (app/login/auth-screen.test.ts).
    for (const [f, raw] of all) {
      const src = raw.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
      const strings = [...src.matchAll(/'([^'\n]*)'|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2]);
      for (const line of strings) expect(line, `${f}: em dash in "${line}"`).not.toMatch(/—/);
      for (const name of ['Balluji', 'TechSpark', 'Acme']) expect(src, `${f}: ${name} is a real client`).not.toContain(name);
    }
  });

  it('keeps photographs as pictures of who it is for, never as quotes', () => {
    const people = read('components/site/people.tsx');
    expect(people).not.toMatch(/<blockquote|“[^”]{20,}”\s*—/);
    expect(people).toMatch(/alt=""/);
  });

  it('ships every photograph it references, pre-sized', () => {
    for (const [f, src] of all) {
      for (const m of src.matchAll(/['"](\/site\/[a-z0-9-]+\.webp)['"]/g)) expect(existsSync(`public${m[1]}`), `${f}: ${m[1]}`).toBe(true);
    }
  });
});

describe('the product pictures', () => {
  it('are made of the product’s own parts, not images of them', () => {
    const parts = all.map(([, s]) => s).join('\n');
    for (const part of ['Panel', 'Checkbox', 'Badge', 'Progress', 'SegmentedControl', 'Avatar', 'Stat']) expect(parts).toMatch(new RegExp(`<${part}\\b`));
    // Photographs are of PEOPLE (who it is for), never of the product: only this section shows any.
    for (const [f, src] of all) if (f !== 'components/site/people.tsx') expect(src, f).not.toMatch(/<img\b/);
  });

  it('draws no pill: a chip is square-cornered like every control in Zenboard', () => {
    // "why is the login button rounded?" (2026-09-25). A dot or a disc is a circle (a square box, fully
    // rounded); a chip or a label is not.
    for (const [f, src] of all) {
      for (const m of src.matchAll(/className=["'`{][^"'`]*\brounded-full\b[^"'`]*/g)) {
        // A disc (a square box, fully rounded) or a hairline bar is not a pill.
        expect(m[0], `${f}: a pill`).toMatch(/\bsize-[\d.]+\b|\bh-(?:3|0\.5)\b/);
      }
    }
  });

  it('keep decoration out of the way: every lifted piece is inert and hidden from assistive tech', () => {
    expect(home).toMatch(/function Resting[\s\S]*?<div aria-hidden inert className=\{cn\('site-reveal pointer-events-none absolute z-\[1\]/);
    // The explanatory drawing is a picture of the step list beside it: each panel says its step in words.
    const loop = read('components/site/loop.tsx');
    expect(loop).toMatch(/<div aria-hidden inert className="mx-auto grid/);
    expect(loop).toMatch(/<p className="sr-only">Step \{i \+ 1\} of \{STEPS\.length\}/);
  });
});

describe('the page', () => {
  it('has one ink-filled button (the hero\'s) and one accent-filled button (the navigation\'s)', () => {
    // The user, 2026-09-26, of the navigation's "Start free": "make accent button". The house rule is
    // one ACCENT fill per view; the hero's is the ink fill, so the first screen holds one of each.
    expect(home.match(/variant: 'primary'/g)).toHaveLength(1);
    expect(home).not.toMatch(/variant: 'brand'/);
    const nav = read('components/site/site-chrome.tsx');
    const bar = nav.slice(nav.indexOf('export function SiteNav'), nav.indexOf('const FAQ'));
    expect(bar.match(/variant: 'brand'/g)).toHaveLength(1);
    expect(bar).not.toMatch(/variant: 'primary'/);
  });

  it('sets headlines in the product’s title face, and everything else in the app’s face', () => {
    // `font-editorial` is the ROLE; since 2026-09-25 it points at Rubik (app/layout.tsx), the face every
    // title in the product speaks in. The site asks for the role, so it follows the product.
    expect(home).toMatch(/<h1 id="hero-title" className="[^"]*font-editorial[^"]*text-hero/);
    const spot = read('components/site/spotlight.tsx');
    expect(spot).toMatch(/<h2 id=\{`\$\{id\}-title`\} className="[^"]*font-editorial/);
  });

  it('uses tokens only — no raw colour and no palette class', () => {
    for (const [f, src] of all) {
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])/);
      expect(src, f).not.toMatch(/\b(bg|text|border)-(gray|slate|zinc|neutral|red|pink|blue|green)-\d{2,3}\b/);
    }
  });

  it('keeps colour inside the pictures: fields come from the illustration palette, in both themes', () => {
    for (const tone of ['hero', 'how', 'day', 'projects', 'portal', 'money']) {
      const rule = globals.match(new RegExp(`\\.site-field-${tone} \\{([^}]*)\\}`))?.[1] ?? '';
      expect(rule, tone).toMatch(/var\(--f-/);
      expect(rule, `${tone}: a colour of its own`).not.toMatch(/#[0-9a-f]{3}|rgb\(|oklch\(|var\(--color-/i);
    }
    // Light: the palette itself. Dark: the same hue mixed into the page's ground, never a new colour.
    const light = globals.match(/\n\.site-field \{([^}]*)\}/)?.[1] ?? '';
    const dark = globals.match(/html\[data-theme='dark'\] \.site-field \{([^}]*)\}/)?.[1] ?? '';
    for (const f of ['petal', 'apricot', 'butter', 'sage', 'sky', 'periwinkle', 'sand', 'mist']) {
      expect(light).toMatch(new RegExp(`--f-${f}: var\\(--color-field-${f}\\);`));
      expect(dark).toMatch(new RegExp(`--f-${f}: color-mix\\(in oklch, var\\(--color-field-${f}\\) \\d+%, var\\(--color-background\\)\\);`));
    }
  });
});

describe('motion', () => {
  it('reveals and tilts only where the browser ties it to scroll, and only when motion is welcome', () => {
    expect(globals).toMatch(/@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{\s*\.site-reveal/);
  });

  it('never advances a list on its own when less motion is asked for', () => {
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.site-dwell \{ animation: none;/);
    // …and the dwell is what advances it: no timer anywhere that turns pages.
    const hook = read('components/site/use-auto-advance.tsx');
    // The bar is the AREA'S hue now (Calendly's rule, 2026-09-26), with the accent as the
    // fallback where no area owns it — but it is still the animation's end that turns the page.
    expect(hook).toMatch(/className="site-dwell block h-full bg-\[var\(--site-hue-ink,var\(--accent\)\)\]" onAnimationEnd=\{onEnd\}/);
    expect(hook).toMatch(/const next = \(\) => setActive\(\(a\) => \(a \+ 1\) % count\);/);
    for (const f of ['use-auto-advance.tsx', 'spotlight.tsx', 'loop.tsx', 'halftone.tsx']) {
      expect(read(`components/site/${f}`), f).not.toMatch(/setInterval|setTimeout/);
    }
  });

  it('stops for good once the reader takes over, and pauses while they read', () => {
    const hook = read('components/site/use-auto-advance.tsx');
    expect(hook).toMatch(/const choose = \(i: number\) => \{ setActive\(i\); setAuto\(false\); \};/);
    expect(hook).toMatch(/const running = auto && !held && seen;/);
    expect(read('components/site/spotlight.tsx')).toMatch(/onPointerDown=\{stop\}/);
    // Two switches: the list may turn (`data-running`), the picture may move (`data-playing`). A step the
    // reader chose still plays out, so the loop's choreography answers only to being on screen.
    expect(globals).toMatch(/\[data-running='false'\] \.site-dwell \{ animation-play-state: paused; \}/);
    expect(read('components/site/loop.tsx')).toMatch(/data-playing=\{seen\}/);
  });

  it('prints the halftone only where it is seen, and prints it once when less motion is asked for', () => {
    const ht = read('components/site/halftone.tsx');
    expect(ht).toMatch(/const moving = \(\) => onScreen && !document\.hidden && !still\.matches;/);
    expect(ht).toMatch(/if \(still\.matches\) draw\(null\);/);
    // Its pace is a token, not a number in the component.
    expect(ht).toMatch(/getPropertyValue\('--site-shimmer'\)/);
    expect(globals).toMatch(/--site-shimmer: \d+s;/);
    // A picture, not content.
    expect(ht).toMatch(/<canvas ref=\{ref\} aria-hidden className=\{cn\('pointer-events-none absolute inset-0/);
  });
});

describe('the first screen', () => {
  it('is where a visit starts: no demo further down pulls the page to itself', () => {
    // cmdk calls scrollIntoView on its selected item when it mounts, and that scrolls the WINDOW:
    // a first visit landed 5,773px down, on the command palette. The demo stays unselected until the
    // visitor reaches it.
    const bento = read('components/site/bento.tsx');
    expect(bento).toMatch(/value=\{value\}\s*onValueChange=\{\(v\) => \{ if \(here\.current\) setValue\(v\); \}\}/);
    expect(bento).toMatch(/onPointerEnter=\{arrive\} onFocusCapture=\{arrive\}/);
  });
});

describe('the identity', () => {
  it('lays the page on one grid: the line between cells, whose corners leave the heart of the mark', () => {
    const visual = read('components/site/visual.tsx');
    expect(visual).toMatch(/className=\{cn\('grid grid-cols-12 gap-px bg-line p-px', className\)\}/);
    // Rows take the grid's own columns, so a line in one section runs on through the next.
    expect(visual).toMatch(/col-span-full grid scroll-mt-20 grid-cols-subgrid gap-px/);
    expect(visual).toMatch(/relative col-span-full min-w-0 rounded-lg bg-background/);
  });

  it('keeps its sections in the frame and runs its LINES to the window, crossing in the grid\'s own star', () => {
    // The user, 2026-09-26: "max width is 1440px container"; then, of a pass that took the frame off
    // every section, "I told it to extend the line, it extended the section size, fix this"; and of
    // thin rules crossed by a plus, "I don't want this plus and line, I want like this" (the joint
    // four rounded cells make, repeated outside the frame).
    const measure = read('components/site/measure.ts');
    expect(measure).toMatch(/export const MEASURE = 'mx-auto w-full max-w-\[1440px\] px-3 sm:px-6';/);
    // A plain module, not the client chrome: a server component computing with a client export gets a
    // reference, and cn() dropped it (the guides were drawn at the window's edges that way).
    expect(measure.trimStart().startsWith("'use client'"), 'measure.ts is not a client module').toBe(false);
    for (const f of ['site-home.tsx', 'legal.tsx']) expect(read(`components/site/${f}`), f).toMatch(/import \{ MEASURE \} from '\.\/measure';/);
    // The lines run on: every section's top rule to both edges, the grid's outer rules the page's height.
    expect(globals).toMatch(/\.site-row::before, \.site-foot::before \{[^}]*inset-inline-start: calc\(50% - 50vw\); width: 100vw;/);
    expect(globals).toMatch(/\.site-guides \{ position: absolute; inset: 0; z-index: -1;/);
    // ...and cross in the star, drawn from the cell's own corner radius; the plus is gone.
    expect(globals).toMatch(/\.site-joint \{\s*--r: var\(--radius-lg\);/);
    expect(globals).not.toMatch(/\.site-row::after|\.site-cross/);
    expect(read('components/site/visual.tsx')).toMatch(/export function Row[\s\S]*?<Joints \/>/);
    for (const f of ['spotlight.tsx', 'loop.tsx', 'site-chrome.tsx']) expect(read(`components/site/${f}`), f).toMatch(/<Joints/);
  });

  it('prints its gradients in its own glyphs: the stars are the mark\'s own heart', () => {
    const ht = read('components/site/halftone.tsx');
    expect(ht).toMatch(/import \{ MARK_PATH \} from '@\/components\/ds\/icons';/);
    expect(ht).toMatch(/const HEART = `M\$\{MARK_PATH\.split\('M'\)\.pop\(\)\}`;/);
  });

  it('gives each area ONE hue, and lets only the thing being shown wear it', () => {
    // Calendly's rule, asked for by the user (2026-09-26): colour marks the one item on screen.
    // The hue is three variables per area — the field colour, the ink that reads on it, and the
    // same hue at ink strength for the 2px rule that times the item — so the tile, the eyebrow and
    // the dwell cannot drift apart.
    for (const f of ['petal', 'apricot', 'butter', 'sage', 'sky', 'periwinkle']) {
      expect(globals).toMatch(new RegExp(`\\.site-hue-${f} \\{ --site-hue: var\\(--color-field-${f}\\); --site-hue-fg: var\\(--color-ink-900\\);`));
      expect(globals, `${f} needs an ink-strength step for the rule`).toMatch(new RegExp(`\\.site-hue-${f} \\{[^}]*--site-hue-ink: color-mix\\(in oklab, var\\(--color-field-${f}\\)`));
    }
    // Always coloured (an area's name) vs coloured only while showing (a feature in a list).
    expect(globals).toMatch(/\.site-tile \{ background: var\(--site-hue\); color: var\(--site-hue-fg\); \}/);
    expect(globals).toMatch(/\.site-feature-tile \{\s*background: transparent;\s*color: var\(--color-ink-400\);/);
    expect(globals).toMatch(/\[data-state='active'\] \.site-feature-tile \{ background: var\(--site-hue\); color: var\(--site-hue-fg\); \}/);
    // The glyph lights up rather than being swapped: both weights, cross-faded.
    expect(globals).toMatch(/\[data-state='active'\] \.site-glyph-fill \{ opacity: 1; \}/);
    expect(globals).toMatch(/\[data-state='active'\] \.site-glyph-line \{ opacity: 0; \}/);
  });

  it('uses the marketing palette and nothing else (claude.ai/artifact/MvbDxDM8WPbd9aJFCpqcjt)', () => {
    // The user, 2026-09-26: "this is marketing colors we have to use". Core, berry, the eight fields, the
    // illustration paper, and the palette page's own dark section.
    const PALETTE = new Set([
      '#191919', '#37352F', '#6A6966', '#FFFFFF', '#F7F7F5', '#E9E9E7',
      '#C41C72', '#C82175', '#FAEDF4',
      '#EAB9CB', '#ECBF9B', '#E5D494', '#B7CEAB', '#A6D1E0', '#B8BDEE', '#EEE7D9', '#E7EAEC',
      '#FBFAF6', '#202020', '#EDEDEC', '#D4D4D4', '#9B9B9B', '#2F2F2F',
    ]);
    const own = [...globals.matchAll(/--color-(field-[a-z]+|illustration-light|site-ink[a-z-]*): (#[0-9A-Fa-f]{6});/g)];
    expect(own.length).toBeGreaterThanOrEqual(13);
    for (const [, name, hex] of own) expect(PALETTE.has(hex.toUpperCase()), `--color-${name}: ${hex}`).toBe(true);
    // At most two fields in any one picture (the palette's rule). Since 2026-09-26 a field is a
    // vertical ramp — colour at the top and the bottom, the illustration's light between them,
    // where the card sits — so each area names exactly its two hues and the shared recipe does
    // the rest. (The `\n` in the pattern is what keeps this off the shared rule, whose selector
    // list ends with `.site-field-money`.)
    for (const tone of ['hero', 'how', 'day', 'projects', 'portal', 'money']) {
      const rule = globals.match(new RegExp(`\n\\.site-field-${tone} \\{([^}]*)\\}`))?.[1] ?? '';
      const fields = new Set([...rule.matchAll(/var\(--f-([a-z]+)\)/g)].map((m) => m[1]).filter((f) => f !== 'sand' && f !== 'mist'));
      expect(fields.size, `${tone}: ${[...fields]}`).toBe(2);
      expect(rule, `${tone} sets a top and a bottom`).toMatch(/--f-top:[\s\S]*--f-bottom:/);
    }
    // One recipe for every field: the light opens through the middle, which is what backlights the
    // card standing on it.
    expect(globals).toMatch(/linear-gradient\(180deg, var\(--f-top\)[^;]*linear-gradient\(0deg, var\(--f-bottom\)[^;]*var\(--f-light\);/);
  });

  it('names no section by a number: a section is its name beside its colour', () => {
    // The user, 2026-09-26, of "07 / 07 · The details": "remove this, this looks so identical".
    for (const [f, src] of all) expect(src, f).not.toMatch(/site-tick|function Index\b|<Index\b/);
    expect(globals).not.toMatch(/\.site-tick/);
  });
});
