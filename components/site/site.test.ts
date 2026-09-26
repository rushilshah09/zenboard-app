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
    expect(home).toMatch(/function Resting[\s\S]*?<div aria-hidden inert className=\{cn\('site-rise-lift zb-enter pointer-events-none absolute z-\[1\]/);
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
    expect(spot).toMatch(/<h2 id=\{`\$\{id\}-title`\}[^>]*className="[^"]*font-editorial/);
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
  it('tilts the product only where the browser ties it to scroll, and only when motion is welcome', () => {
    expect(globals).toMatch(/@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{\s*\.site-tilt/);
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
    expect(visual).toMatch(/className=\{cn\('relative grid grid-cols-12 gap-px bg-line p-px', className\)\}/);
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
    // Each picture names THREE fields, top, bottom and side, and the brand's berry is the fourth colour
    // in every one (user, 2026-09-26, "like Calendly's gradient": theirs are six or seven colours,
    // blurred together, with their brand blue in each). This replaced the palette's "at most two
    // fields" rule, which made every picture a two-stop ramp. Sand and mist are neutrals, not hues.
    for (const tone of ['hero', 'how', 'day', 'projects', 'portal', 'money']) {
      const rule = globals.match(new RegExp(`\n\\.site-field-${tone} \\{([^}]*)\\}`))?.[1] ?? '';
      const fields = new Set([...rule.matchAll(/var\(--f-([a-z]+)\)/g)].map((m) => m[1]).filter((f) => f !== 'sand' && f !== 'mist'));
      expect(fields.size, `${tone}: ${[...fields]}`).toBe(3);
      expect(rule, `${tone} sets a top, a bottom and a side`).toMatch(/--f-top:[\s\S]*--f-bottom:[\s\S]*--f-side:/);
    }
    expect(globals).toMatch(/\.site-field \{ --f-deep: color-mix\(in oklab, var\(--accent\) \d+%, var\(--f-light\)\); \}/);
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

describe('the page arrives as it is read', () => {
  // The user, 2026-09-26: "the entire website looks basic, no interaction and animation … add subtle
  // animation as the page appears in view, like Linear and Calendly and Notion and Miro". The rules
  // that keep that from costing the page anything are held here; the controller's behaviour is in
  // site-motion.test.ts.
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const css = strip(globals);

  it('hides nothing until the script says so: every waiting state is `data-shown="false"`', () => {
    // A rule that hid `[data-reveal]` by itself would leave a page whose script never ran blank.
    const rules = [...css.matchAll(/([^{}]*\[data-reveal[^{}]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(5);
    for (const [, selector, body] of rules) {
      if (!/opacity:\s*0|scaleX\(0\)|translateY|blur\(/.test(body)) continue;
      // One selector at a time: split on the commas that are not inside an `:is(…)`.
      const list: string[] = [];
      let depth = 0, from = 0;
      [...selector].forEach((ch, i) => {
        if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0) { list.push(selector.slice(from, i)); from = i + 1; }
      });
      list.push(selector.slice(from));
      for (const one of list) expect(one.trim(), `${one.trim()} hides without the script`).toMatch(/\[data-shown='false'\]/);
    }
    // ...and a printed page shows every word.
    expect(css).toMatch(/@media print \{\s*\[data-shown='false'\], \[data-shown='false'\] \.site-word, \[data-shown='false'\] > \.site-joint \{ opacity: 1 !important;/);
  });

  it('moves only where motion is welcome: less motion keeps the fade', () => {
    const still = css.match(/@media \(prefers-reduced-motion: no-preference\) \{\s*\[data-shown='false'\]\[data-reveal='rise'\] \{ transform: translateY\(12px\); filter: blur\(4px\); \}[\s\S]*?\n\}/)?.[0] ?? '';
    expect(still, 'the movement lives in one no-preference block').not.toBe('');
    for (const m of ['translateY(28px) scale(0.98)', 'translateY(0.3em)', 'scaleX(0)']) expect(still).toContain(m);
    // Outside it, waiting is opacity and nothing else.
    expect(css).toMatch(/\[data-shown='false'\]:is\(\[data-reveal='rise'\], \[data-reveal='lift'\]\),\s*\[data-shown='false'\]\[data-reveal='words'\] \.site-word \{ opacity: 0; \}/);
  });

  it('times every arrival from the ladder and the house curve', () => {
    expect(css).toMatch(/--site-reveal: calc\(var\(--duration-slow\) \* 3\);/);
    expect(css).toMatch(/--site-stagger: calc\(var\(--duration-fast\) \* 0\.8\);/);
    expect(css).toMatch(/--site-word-step: calc\(var\(--duration-fast\) \* 0\.6\);/);
    expect(css).toMatch(/transition-timing-function: var\(--ease-out-quiet\);\s*transition-delay: calc\(var\(--reveal-i, 0\) \* var\(--site-stagger\)\);/);
  });

  it('brings the first screen in on CSS alone, the heading a word at a time', () => {
    expect(home).toMatch(/<h1 id="hero-title" className="site-rise-words zb-enter /);
    expect(home).toMatch(/<Words>Open Zenboard\.<\/Words>[\s\S]*<Words from=\{2\}>Know what matters\.<\/Words>[\s\S]*<Words from=\{5\}>Do the work\.<\/Words>/);
    expect(home).toMatch(/className="site-rise-lift zb-enter relative mx-auto w-full max-w-\[1180px\]"/);
    // Nothing on the first screen waits for the script.
    const hero = home.slice(home.indexOf('function Hero'), home.indexOf('function Resting'));
    expect(hero).not.toMatch(/data-reveal/);
  });

  it('brings every section heading in a word at a time', () => {
    for (const f of ['site-home.tsx', 'spotlight.tsx', 'loop.tsx', 'people.tsx']) {
      const src = read(`components/site/${f}`);
      const headings = [...src.matchAll(/<h2 [^>]*>/g)].map((m) => m[0]);
      expect(headings.length, f).toBeGreaterThan(0);
      for (const h of headings) expect(h, f).toMatch(/data-reveal="words"/);
    }
  });

  it('never fades a cell: a cell fading in shows the grid behind it as a grey block', () => {
    for (const [f, src] of all) expect(src, f).not.toMatch(/<Cell\b[^>]*\sdata-reveal="/);
    // The loop's steps ARE cells: their words arrive, and their hover is a wash over their own ground.
    const loop = read('components/site/loop.tsx');
    const step = loop.slice(loop.indexOf('<RT.Trigger', loop.indexOf('One request, step by step')), loop.indexOf('>', loop.indexOf('className="focus-ring group relative col-span-full')));
    expect(step).not.toMatch(/data-reveal=/);
    // ...and it takes no fill on hover: the words darken (user: "only the text and content highlight").
    expect(step).not.toMatch(/hover:(?:bg-|wash-over)/);
  });

  it('keeps a heading one sentence: real words, real spaces', () => {
    const words = read('components/site/words.tsx');
    expect(words.trimStart().startsWith("'use client'"), 'a server component can render it').toBe(false);
    expect(words).toMatch(/\{i > 0 && ' '\}\s*<span className="site-word"/);
    expect(words).not.toMatch(/aria-hidden|aria-label/);
  });
});

describe('the lines stay quiet', () => {
  it('draws no light along the grid: the user found the pink glow on the hairline did not look good', () => {
    expect(read('components/site/visual.tsx')).not.toMatch(/site-glow/);
    expect(globals).not.toMatch(/\.site-glow/);
    expect(read('components/site/site-motion.tsx')).not.toMatch(/function light\(/);
  });
});

describe('the logo answers the hand', () => {
  // The user, 2026-09-26, with Attio's menu: "right-click on the logo, instead of brand guidelines I
  // want start focus session", and earlier: "on hover it's like a magnet, and they can spin it round
  // with the mouse".
  const logo = read('components/site/site-logo.tsx');
  const chrome = read('components/site/site-chrome.tsx');

  it('is the logo everywhere the site shows it', () => {
    expect(chrome).toMatch(/<SiteLogo height=\{24\}/);
    // In the footer it leads the closing statement (user, 2026-09-26), and the studio signs the foot.
    expect(chrome).toMatch(/<SiteLogo height=\{26\} className="text-site-ink-fg" \/>\s*<p data-reveal="words"/);
    expect(chrome).toMatch(/A product by\s*<LifestudioLogo /);
    expect(chrome).not.toMatch(/<Logo\b/);
  });

  it('offers the wordmark, the logo, and a focus session, in that order', () => {
    const items = [...logo.matchAll(/<ContextMenuItem onSelect=\{[^}]*\}>([^<]+)<\/ContextMenuItem>|<ContextMenuSeparator \/>/g)].map((m) => m[1] ?? '—');
    expect(items).toEqual(['Copy wordmark as SVG', 'Copy logo as SVG', '—', 'Start focus session']);
    expect(logo).toMatch(/onSelect=\{\(\) => openGuestFocus\(\)\}/);
    // The files are the page's own artwork, made standalone in lib/brand.ts (no colour lives here).
    expect(logo).toMatch(/wordmarkSvg\(svg\.outerHTML\) : logoSvg\(svg\.outerHTML\)/);
  });

  it('turns only its mark, with the cursor, and draws it whole', () => {
    // "Only the logo mark rotating"; "not by itself on hover: with the mouse cursor"; "the logo is
    // cutting while rotating".
    expect(logo).toMatch(/const mark = link\?\.querySelector<SVGPathElement>\('svg > path'\);/);
    expect(logo).toMatch(/mark\.style\.transformBox = 'fill-box';/);
    expect(logo).not.toMatch(/style\.translate|link\.style\.transform|--site-spin/);
    // It turns by as much as the pointer turned round it, and nothing turns it on a timer.
    expect(logo).toMatch(/toTurn \+= d;/);
    expect(logo).not.toMatch(/360 \/ perTurn/);
    // A square turned inside a square box loses its corners, so the lockup may draw outside its box.
    expect(logo).toMatch(/svg\.style\.overflow = 'visible';/);
    // At rest, a quarter turn, which is how a four-petal mark looks.
    expect(logo).toMatch(/toTurn = Math\.round\(toTurn \/ 90\) \* 90;/);
    expect(logo).toMatch(/if \(e\.pointerType !== 'mouse' \|\| !fine\.matches \|\| still\.matches\) return;/);
  });
});

describe('a focus session without an account', () => {
  const focus = read('components/site/guest-focus.tsx');
  const warp = read('components/site/warp.tsx');

  it('is a real modal, and leaving it keeps what was done', () => {
    expect(focus).toMatch(/import \{ Dialog as RD \} from 'radix-ui';/);
    expect(focus).toMatch(/onOpenChange=\{\(o\) => \{ if \(!o\) close\(\); \}\}/);
    expect(focus).toMatch(/const close = \(\) => \{\s*\/\/ Leaving mid-session keeps what was done, and says so\.\s*if \(phase === 'focus' && clock\) \{\s*const session = finish\(clock, Date\.now\(\), true\);/);
  });

  it('keeps sessions by the shared rules, under the shared key', () => {
    expect(focus).toMatch(/readGuestSessions\(localStorage\.getItem\(GUEST_FOCUS_KEY\), new Date\(\)\)/);
    expect(focus).toMatch(/addGuestSession\(kept\(\), session, new Date\(\)\)/);
  });

  it('enters through the warp in the brand\'s colours, once, and never for someone who asked for less motion', () => {
    expect(warp).toMatch(/const INKS = \['--accent', '--color-field-petal', '--color-field-periwinkle', '--color-field-apricot', '--color-illustration-light'\];/);
    expect(warp).toMatch(/window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) \{\s*done\.current\(\);/);
    expect(warp).toMatch(/getPropertyValue\('--site-warp'\)/);
    expect(globals).toMatch(/:root \{ --site-warp: [\d.]+s; \}/);
    expect(warp).toMatch(/<div ref=\{ref\} data-warp aria-hidden className="zb-enter [^"]*animate-fadein" \/>/);
    // A fresh canvas every run: a canvas whose GPU context was let go hands the dead one back.
    expect(warp).toMatch(/const canvas = document\.createElement\('canvas'\);/);
    expect(warp).toMatch(/painter\?\.release\(\);\s*canvas\.remove\(\);/);
    // A frame can be stamped a hair before the start: progress is held at 0, never negative (a
    // negative progress made the speed NaN and drawing threw, ending the loop mid-warp).
    expect(warp).toMatch(/const p = Math\.min\(1, Math\.max\(0, \(t - start\) \/ total\)\);/);
    // The session starts when the warp ends, so it ends on the clock even if no frame comes.
    expect(warp).toMatch(/const backstop = window\.setTimeout\(finish, total \+ 250\);/);
  });

  it('moves into the account the first time Zenboard opens signed in', () => {
    const shell = read('components/shell/app-shell.tsx');
    expect(shell).toMatch(/<Toaster \/>\s*\{\/\*[^*]*\*\/\}\s*<GuestFocusImport \/>/);
    const importer = read('components/shell/guest-focus-import.tsx');
    // One offer per page load, however often the effect runs.
    expect(importer).toMatch(/offered \?\?= importGuestFocus\(sessions\);/);
    expect(importer).toMatch(/localStorage\.removeItem\(GUEST_FOCUS_KEY\)/);
  });
});

describe('the page offers a way back up, and a light or a dark page', () => {
  // The user, 2026-09-26: "give the website a back to top option, and a dark mode and light mode option".
  it('switches the theme through the app\'s own appearance, so the two can never disagree', () => {
    const sw = read('components/site/theme-switch.tsx');
    expect(sw).toMatch(/commitAppearance\(\{ theme: next \}\)/);
    expect(sw).toMatch(/useResolvedTheme\(\)/);
    expect(sw).toMatch(/<IconSwap swapKey=\{theme\}>/);
    expect(read('components/site/site-chrome.tsx')).toMatch(/<ThemeSwitch \/>/);
  });

  it('brings the reader back to the top, and the keyboard with them', () => {
    const top = read('components/site/back-to-top.tsx');
    expect(top).toMatch(/window\.scrollY > window\.innerHeight \* 2/);
    expect(top).toMatch(/behavior: still \? 'auto' : 'smooth'/);
    expect(top).toMatch(/document\.querySelector<HTMLElement>\('header a\[href\]'\)\?\.focus\(\{ preventScroll: true \}\)/);
    // Hidden, it is out of the tab order and takes no pointer.
    expect(top).toMatch(/tabIndex=\{shown \? 0 : -1\}/);
    expect(globals).toMatch(/\.site-top \{\s*opacity: 0; transform: translateY\(8px\) scale\(0\.96\); pointer-events: none;/);
    // At the foot it rises above the footer's last row, never onto the studio's credit.
    expect(globals).toMatch(/\.site-top\[data-lifted\] \{ translate: 0 -64px; \}/);
    expect(top).toMatch(/document\.querySelector\('\[data-site-foot\]'\)/);
    for (const f of ['site-home.tsx', 'legal.tsx']) expect(read(`components/site/${f}`), f).toMatch(/<BackToTop \/>/);
  });
});

describe('the pictures are painted, not ramped', () => {
  // The user, 2026-09-26: "the gradient execution looks so basic, I want it like Calendly's". Measured on
  // calendly.com: blurred organic shapes over a pale ground, and a fine grain. Every picture has them.
  const visual = read('components/site/visual.tsx');

  it('paints every picture with the same five shapes and a grain', () => {
    expect(visual).toMatch(/\(\['top', 'bottom', 'side', 'deep', 'light'\] as const\)\.map/);
    expect(visual).toMatch(/<span className="site-grain" \/>/);
    expect(visual).toMatch(/export function Stage[\s\S]*?<Mesh flip=\{flip\} \/>/);
    expect(read('components/site/loop.tsx')).toMatch(/site-field-how[^\n]*\n\s*<Mesh \/>/);
    expect(home).toMatch(/site-field-hero[^\n]*\n\s*<Mesh \/>/);
  });

  it('takes every colour from the area\'s own fields, the berry and the light', () => {
    for (const b of ['top', 'bottom', 'side', 'deep', 'light']) {
      expect(globals).toMatch(new RegExp(`\\.site-blob\\[data-b='${b}'\\] \\{[^}]*background: var\\(--f-${b}\\);`));
    }
    // Soft shapes, blurred into one another, and a grain laid into the colour.
    expect(globals).toMatch(/\.site-blob \{[^}]*border-radius: [^;]*\/[^;]*;[^}]*filter: blur\(/);
    expect(globals).toMatch(/\.site-grain \{[^}]*mix-blend-mode: soft-light;[^}]*feTurbulence/);
    // Nothing in it moves: painted once, cached.
    expect(globals).not.toMatch(/\.site-blob[^{]*\{[^}]*animation/);
  });
});

describe('a hover darkens the words, it never lays a patch', () => {
  // The user, 2026-09-26, of a feature list's grey hover: "this grey patch looks so bad, I want only the
  // text and content to highlight". The site's lists take no fill on hover anywhere.
  it('gives no list on the site a hover fill', () => {
    for (const f of ['spotlight.tsx', 'loop.tsx', 'bento.tsx', 'legal.tsx', 'site-chrome.tsx']) {
      const src = read(`components/site/${f}`);
      const lists = src.split('\n').filter((l) => /RT\.Trigger|<li |<a href=\{`#|<Cell className="site-pad col-span-full/.test(l) || /className="focus-ring group relative/.test(l));
      for (const l of lists) expect(l, f).not.toMatch(/hover:bg-surface-hover|hover:wash-over|has-\[[^\]]*:hover\]:wash-over/);
    }
    expect(read('components/site/spotlight.tsx')).toMatch(/group-hover:text-ink-800/);
    expect(globals).toMatch(/\[data-state='inactive'\]:hover \.site-feature-tile \{ color: var\(--color-ink-700\); \}/);
  });
});

describe('the questions: the heading on the left, a card each on the right', () => {
  it('spans the heading over exactly as many rows as there are questions', async () => {
    const { FAQ_COUNT } = await import('./site-chrome');
    expect(home).toMatch(new RegExp(`lg:col-span-4 lg:row-span-${FAQ_COUNT} `));
  });

  it('draws the grid\'s star at both ends of every card\'s top line, and keeps the mark close to its words', () => {
    const chrome = read('components/site/site-chrome.tsx');
    const q = chrome.slice(chrome.indexOf('export function Questions'), chrome.indexOf('export function SiteFooter'));
    expect(q).toMatch(/<Cell className="site-pad col-span-full lg:col-span-8">\s*<span aria-hidden className="site-joint" data-at="start" \/>\s*<span aria-hidden className="site-joint" data-at="end" \/>/);
    expect(q).toMatch(/className="h-auto min-h-16 gap-2\.5 /);
    expect(q).toMatch(/ps-7\.5/);
  });
});
