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
      // Also the names the user has ruled out as samples; the site's sample studio is Northlight.
      for (const name of ['Balluji', 'TechSpark', 'Acme', 'Darshil', 'Meridian', 'Fernwood']) expect(src, `${f}: ${name} is a real client`).not.toContain(name);
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
    for (const part of ['Checkbox', 'Badge', 'SegmentedControl', 'Avatar', 'AvatarGroup', 'Stat', 'Kbd', 'Switch']) expect(parts).toMatch(new RegExp(`<${part}\\b`));
    // Photographs are of PEOPLE (who it is for), never of the product: only this section shows any.
      // TWO files may carry a photograph, and neither is a picture OF the product: the people
      // section's portraits, and the launch film's poster frame, which is a still from a film we
      // made rather than a screenshot of a screen.
      const PHOTOGRAPHS = new Set(['components/site/people.tsx', 'components/site/nav-menu.tsx']);
      for (const [f, src] of all) if (!PHOTOGRAPHS.has(f)) expect(src, f).not.toMatch(/<img\b/);
  });

  it('draws no pill: a chip is square-cornered like every control in Zenboard', () => {
    // "why is the login button rounded?" (2026-09-25). A dot or a disc is a circle (a square box, fully
    // rounded); a chip or a label is not.
    // The one exception is the user's illustration board, which is drawn EXACTLY as they made it
    // (2026-09-27: "do not change anything in the illustrations"): its chips are its own.
    const DRAWN_AS_GIVEN = new Set(['components/site/board-scenes.tsx']);
    for (const [f, src] of all) {
      if (DRAWN_AS_GIVEN.has(f)) continue;
      for (const m of src.matchAll(/className=["'`{][^"'`]*\brounded-full\b[^"'`]*/g)) {
        // A DISC (a square box, fully rounded), a TRACK (a bar no taller than 12px, which has no
        // other honest shape) or a track's FILL (`h-full`, which takes the track's height and
        // whose rounded leading edge is the point of it) is not a pill. A chip, a label or a
        // button is: those set their own height, which is why the height is what separates them.
        expect(m[0], `${f}: a pill`).toMatch(/\bsize-(?:[\d.]+\b|\[[\d.]+px\])|\bh-(?:0\.5|1|1\.5|2|2\.5|3|full)\b/);
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

  it('paints every picture in the one recipe the user chose: one arc, a picture’s strength, edge to edge', () => {
    // User, 2026-09-29, of the Ramp pass's pictures (stock with one glow in a corner): "I like the
    // previous gradient version; this looks faded, looks more empty". The recipe they chose on
    // 2026-09-26 is back, and it is ONE recipe: a picture's own rule names only its three stops.
    for (const tone of ['hero', 'how', 'day', 'projects', 'portal', 'money']) {
      const rule = globals.match(new RegExp(`\n\.site-field-${tone} \{([^}]*)\}`))?.[1] ?? '';
      expect(rule, tone).toMatch(/^ --f-a: [^;]+; --f-b: [^;]+; --f-c: [^;]+; $/);
      expect(rule, `${tone}: every stop is a picture-strength ink`).not.toMatch(/--color-field-/);
    }
    // A PICTURE'S STRENGTH: the palette's own hue at l − 0.16, c × 3.0, derived and never written down.
    for (const f of ['petal', 'apricot', 'butter', 'sage', 'sky', 'periwinkle']) {
      expect(globals).toMatch(new RegExp(`--f-ink-${f}: oklch\\(from var\\(--color-field-${f}\\) calc\\(l - 0\\.16\\) calc\\(c \\* 3\\.0\\) h\\);`));
    }
    // Edge to edge: a bloom and four radials placed as fractions of the box, all in oklab, on a base
    // of the arc's middle, never on bare stock.
    const paint = globals.match(/\.site-field-projects, \.site-field-portal, \.site-field-money \{([^}]*)\}/)?.[1] ?? '';
    expect(paint).toMatch(/linear-gradient\(108deg in oklab,/);
    expect((paint.match(/radial-gradient\([^,]* in oklab,/g) ?? []).length, 'four radial stops').toBe(4);
    expect(paint).toMatch(/color-mix\(in oklab, var\(--f-b\) 34%, var\(--f-light\)\);/);
    expect(globals, 'the stock the pale pictures stood on is gone with them').not.toMatch(/--site-stock/);
    // The print covers the whole picture, through the blend, with no mask cutting it to a corner.
    expect(globals).toMatch(/\.site-screen \{ mix-blend-mode: overlay; \}/);
    expect(globals).not.toMatch(/--f-mask/);
    for (const f of ['visual.tsx', 'site-home.tsx', 'loop.tsx', 'people.tsx']) {
      expect(read(`components/site/${f}`), f).toMatch(/<Halftone [^>]*className="site-screen"/);
    }
    // LIGHT ONLY: the website has one appearance, so no picture carries a dark branch.
    expect(globals).not.toMatch(/data-theme='dark'\] \.site-field/);
  });
});

describe('motion', () => {
  it('tilts the product only where the browser ties it to scroll, and only when motion is welcome', () => {
    expect(globals).toMatch(/@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{\s*\.site-tilt/);
  });

  it('plays nothing before it is seen: a section below the window waits at its first frame', () => {
    // User, 2026-09-28: "all animation start when they appear in viewport, in the entire place". The
    // section's own reveal mark is the one signal (site-motion.tsx sets it only below the fold).
    expect(globals).toMatch(/\[data-reveal='rule'\]\[data-shown='false'\] \*,\s*\[data-reveal='rule'\]\[data-shown='false'\] \*::before,\s*\[data-reveal='rule'\]\[data-shown='false'\] \*::after \{ animation-play-state: paused !important; \}/);
    expect(read('components/site/site-motion.tsx')).toMatch(/if \(trigger\.getBoundingClientRect\(\)\.top < fold\) continue;/);
    // The print's shimmer starts its clock when it is first seen, not when the page loads.
    expect(read('components/site/halftone.tsx')).toMatch(/if \(onScreen && !firstSeen\) \{ firstSeen = true; t0 = performance\.now\(\); \}/);
  });

  it('never advances a list on its own when less motion is asked for', () => {
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.site-dwell \{ animation: none;/);
    // …and the dwell is what advances it: no timer anywhere that turns pages.
    const hook = read('components/site/use-auto-advance.tsx');
    // The bar is the AREA'S hue now (Calendly's rule, 2026-09-26), with the accent as the
    // fallback where no area owns it — but it is still the animation's end that turns the page.
    // A DOTTED ROUNDED BOX round the item's own marker (user, 2026-09-26: "don't make it full
    // round, make a rounded box, and dotted initially, and make the loading a full line with
    // colour filling from dotted, converting"). The dots are the point: a faint track is
    // decoration the eye skips, where dots are visibly unfinished, so joining them up reads as
    // completion. It went bar → segmented track → ring → this, each step moving it into the thing
    // it times rather than beside it.
    //
    // TWO ANIMATIONS, NOT ONE (user, 2026-09-28): "Default → dots draw themselves around the icon
    // → accent stroke travels around the perimeter → active state. Not: Default → instantly show a
    // complete dotted circle." They were collapsed into each other before — the timer WAS the
    // reveal, so the dots crept in over the whole six seconds. The dots arriving is an ENTRANCE
    // and the line running round them is the timer, and the timer's end is what turns the page.
    expect(hook, 'the timer turns the page, not the entrance').toMatch(/className="site-dwell-line"[^>]*onAnimationEnd=\{phase === 'in' \? onEnd : undefined\}/);
    expect(hook, 'the marker is the app’s corner, not a circle').toMatch(/rx: radius/);
    expect(hook, 'one dash rule at any size').toMatch(/pathLength: DOTS/);
    expect(hook, 'an integer count, so the ring closes').toMatch(/const DOTS = 18;/);
    expect(globals, 'CSS counts the same dots').toMatch(/--site-dwell-dots: 18;/);
    // A marker's whole cycle is still ONE dwell, which is what keeps it in step with a feature
    // row's rule filling: the entrance takes `--site-dwell-draw` off the front of the timer.
    expect(globals, 'entrance + timer = one dwell').toMatch(/animation: site-dwell-draw calc\(var\(--site-dwell\) - var\(--site-dwell-draw\)\) linear var\(--site-dwell-draw\) both;/);
    expect(globals, 'the dots arrive on the arrival curve').toMatch(/\.site-dwell-ring \{[^}]*animation: site-dwell-draw var\(--site-dwell-draw\) var\(--ease-out-quiet\) both;/);
    expect(globals, 'leaving is quicker than arriving').toMatch(/--site-dwell-draw: 0\.6s;\s*\n\s*--site-dwell-erase: 0\.3s;/);
    // At rest there is NOTHING round a marker (user, 2026-09-28: "remove the dotted circle
    // completely … no permanent dotted circle in the inactive state") — not a hidden SVG either.
    expect(hook, 'nothing drawn at rest').toMatch(/\{phase !== 'rest' && \(\s*\n\s*<svg/);
    expect(hook + globals, 'no waiting track anywhere').not.toMatch(/site-dwell-track/);
    // The line that draws the dots on is a MASK, so it is never seen itself, and the one that
    // takes them off draws over it in BLACK along the same path: an item deselected mid-entrance
    // keeps drawing underneath while the erase catches it up, rather than snapping to a complete
    // ring in order to leave from one.
    expect(hook, 'the drawn line is a mask over the dots and the accent line').toMatch(/<mask id=\{mask\}[\s\S]*className="site-dwell-ring"[\s\S]*className="site-dwell-erase"[\s\S]*<\/mask>[\s\S]*<g mask=\{`url\(#\$\{mask\}\)`\}>[\s\S]*className="site-dwell-dots"[\s\S]*className="site-dwell-line"/);
    expect(globals, 'the head is white, the eraser black').toMatch(/\.site-dwell-ring \{\s*\n\s*stroke: white;/);
    expect(globals, 'the head is white, the eraser black').toMatch(/\.site-dwell-erase \{\s*\n\s*stroke: black;/);
    expect(hook, 'and the erase only exists while it is leaving').toMatch(/\{phase === 'out' && \(/);
    // THE MARKER TAKES ITS AREA'S HUE, like the rule under a feature row: a berry ring round a
    // butter tile is two colours doing one job. The dots are held back from the line so the loop
    // reads as the unfinished thing and the line as the finished one.
    // ONE INK: the area's hue, or `--accent-text` where no area owns it — NOT the raw accent,
    // which measures 2.91:1 on a dark card, where the step number inside this very marker is
    // already set in `text-accent-text`.
    expect(globals, 'one ink for the marker').toMatch(/\.site-dwell-edge \{ --site-dwell-ink: var\(--site-hue-ink, var\(--accent-text\)\); \}/);
    // 80% and not less: the marker's ink is only 4.1–4.6:1 in light, so there is about a stop of
    // room under it before a graphic stops clearing 3:1 (measured across every hue, both themes).
    expect(globals, 'dots are that ink held back').toMatch(/\.site-dwell-edge \.site-dwell-dots \{ stroke: color-mix\(in oklab, var\(--site-dwell-ink\) 80%, transparent\); stroke-dasharray: [\d.]+ [\d.]+; \}/);
    expect(globals, 'the line at full strength').toMatch(/\.site-dwell-line \{\s*\n\s*stroke: var\(--site-dwell-ink\);/);
    expect(read('components/site/people.tsx'), 'so the hue is in scope for it').toMatch(/<Dwell active=\{on\} size=\{36\} radius=\{11\} onEnd=\{next\} className=\{HUE\[hue\]\}>/);
    // ONE COMPONENT, FOUR STATES. `DwellMark` was the rest state as a second component, which is
    // why there was no exit: the marker was unmounted the instant it stopped being the active one.
    expect(hook, 'rest is a phase, not a second component').not.toMatch(/DwellMark/);
    expect(read('components/site/loop.tsx') + read('components/site/people.tsx')).not.toMatch(/DwellMark/);
    // TWO FORMS, ONE RULE: the timer is part of the thing it times. Where an item's marker is a
    // tile or a number on a card, that is the dotted box; where the ROW is drawn with a bottom
    // rule already, it is that rule filling (user, 2026-09-26: "here use the normal line fill
    // animation"), because a box beside it would be a second mark.
    expect(hook).toMatch(/export function DwellLine\(/);
    expect(read('components/site/spotlight.tsx'), 'a list of ruled rows fills its rule').toMatch(/<DwellLine onEnd=\{next\} \/>/);
    expect(read('components/site/loop.tsx'), 'a card’s number takes the box, in the colour of its place').toMatch(/<Dwell active=\{i === active\} onEnd=\{next\} size=\{36\} radius=\{11\} className=\{HUE\[CHAPTER\[s\.place\]\]\}>/);
    expect(hook).toMatch(/const next = \(\) => setActive\(\(a\) => \(a \+ 1\) % count\);/);
    // NOTHING TURNS A PAGE ON A TIMER: the dwell's own `onAnimationEnd` does, which is why a
    // paused dwell simply stops rather than falling behind a clock it cannot see.
    for (const f of ['spotlight.tsx', 'loop.tsx', 'halftone.tsx']) {
      expect(read(`components/site/${f}`), f).not.toMatch(/setInterval|setTimeout/);
    }
    expect(hook, 'the hook turns no pages either').not.toMatch(/setInterval/);
    // Its ONE timer ends a HOLD, and holds nothing else: after a press the list carries on.
    expect(hook).toMatch(/const id = window\.setTimeout\(\(\) => setUsedAt\(0\), DWELL_MS\);/);
    expect((hook.match(/setTimeout/g) ?? []).length, 'exactly one timer').toBe(1);
  });

  it('pauses for an interaction and carries on from where it was, never freezing', () => {
    // Twice, 2026-09-26: "once I interact it stops at the same place, not auto running, and this
    // happens on all the screens", then "when I click any interaction the entire flow is frozen —
    // I don't want that, it should still continue from where I clicked automatically."
    //
    // So nothing is permanent any more. Choosing turns to that item and carries on; pressing
    // inside a picture buys one dwell of quiet and then carries on; and NOTHING IS UNMOUNTED to
    // pause it, which is the other half — unmounting the dwell restarted it from zero, where
    // `[data-running='false']` holds the fill exactly where it had got to.
    const hook = read('components/site/use-auto-advance.tsx');
    expect(hook).toMatch(/const choose = \(i: number\) => setActive\(i\);/);
    expect(hook).toMatch(/const stop = \(\) => setUsedAt\(Date\.now\(\)\);/);
    expect(hook, 'no permanent off switch').not.toMatch(/setAuto\(false\)/);
    expect(hook).toMatch(/const running = !held && seen && !usedAt;/);
    // And no list may gate the dwell on anything but which item is active.
    for (const f of ['spotlight.tsx', 'loop.tsx', 'people.tsx']) {
      expect(read(`components/site/${f}`), `${f} must not unmount the dwell`).not.toMatch(/&& auto &&|&& auto\n/);
    }
    expect(hook).toMatch(/const running = !held && seen && !usedAt;/);
    expect(read('components/site/spotlight.tsx')).toMatch(/onPointerDown=\{stop\}/);
    // Two switches: the list may turn (`data-running`), the picture may move (`data-playing`). A step the
    // reader chose still plays out, so the loop's choreography answers only to being on screen.
    // The entrance and the timer both hold; the EXIT is not a timer and always finishes, so a
    // marker never freezes half-erased under a resting pointer.
    expect(globals).toMatch(/\[data-running='false'\] :is\(\.site-dwell, \.site-dwell-ring, \.site-dwell-line\) \{ animation-play-state: paused; \}/);
    expect(globals, 'the exit is exempt').not.toMatch(/\[data-running='false'\][^\n]*site-dwell-erase/);
    // …and less motion does not switch the exit off either: its `animationend` is what unmounts
    // the marker, so a dead exit leaks a mounted SVG onto every item ever chosen.
    const reduced = globals.slice(globals.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced, 'the exit still runs').not.toMatch(/\.site-dwell-erase \{ animation: none/);
    expect(read('components/site/use-auto-advance.tsx'), 'because it is what ends the exit').toMatch(/className="site-dwell-erase"[^>]*onAnimationEnd=\{\(\) => setPhase\('rest'\)\}/);
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
    // a first visit landed 5,773px down, on the command palette. That used to be held off with a
    // "nothing is selected until the visitor arrives" guard on the live component.
    //
    // The palette is DRAWN now (2026-09-27, "exactly same to same"), so cmdk is not on this page at
    // all and the bug cannot happen rather than being worked around. This asserts the stronger
    // thing: nothing in the details row mounts a component that scrolls the window to itself.
    const bento = read('components/site/bento.tsx');
    expect(bento, 'no cmdk in the details row').not.toMatch(/from '@\/components\/ds\/ui\/command'/);
    expect(bento, 'and nothing else reaches for scrollIntoView').not.toMatch(/scrollIntoView/);
    // The board's drawn palette is plain markup (board-scenes.tsx): no command widget, nothing that
    // reaches for scrollIntoView.
    const scenes = read('components/site/board-scenes.tsx');
    expect(scenes, 'the drawn palette imports no command widget').not.toMatch(/from '[^']*command'/);
    expect(scenes, 'and never scrolls anything into view').not.toMatch(/scrollIntoView/);
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
    // The FRAME holds the measure now, not each page: site-shell.tsx applies it to the guides and to
    // <main>, and every page stands in that shell, so no page can set a width of its own.
    expect(read('components/site/site-shell.tsx')).toMatch(/import \{ MEASURE \} from '\.\/measure';/);
    for (const f of ['site-home.tsx', 'legal.tsx']) expect(read(`components/site/${f}`), f).toMatch(/<SiteShell/);
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
    // THE COLOUR SYSTEM (user, 2026-09-27: "build our own stronger colour system … a clear
    // hierarchy, where each colour is used, consistent in light and dark"): the HUE is always the
    // marketing palette's own field, and the system only normalises its STRENGTH, so every tint
    // sits at one lightness and chroma and no hue outshouts another.
    for (const f of ['petal', 'apricot', 'butter', 'sage', 'sky', 'periwinkle']) {
      expect(globals).toMatch(new RegExp(`\\.site-hue-${f} \\{ --site-hue-src: var\\(--color-field-${f}\\); \\}`));
    }
    expect(globals).toMatch(/--site-hue: oklch\(from var\(--site-hue-src\) 0\.885 0\.058 h\);/);
    expect(globals).toMatch(/--site-hue-ink: oklch\(from var\(--site-hue-src\) 0\.56 0\.12 h\);/);
    expect(globals, 'and a browser without relative colour still gets the palette').toMatch(/--site-hue: var\(--site-hue-src\); --site-hue-fg: var\(--color-ink-900\);/);
    // ONE MAP decides a place's colour, and a section that is not one place wears ink.
    const visual = read('components/site/visual.tsx');
    expect(visual).toMatch(/export const CHAPTER = \{ day: 'butter', projects: 'sky', portal: 'periwinkle', money: 'sage' \}/);
    for (const [f, place] of [['areas.tsx', 'day'], ['areas.tsx', 'projects'], ['areas.tsx', 'money'], ['nav-menu.tsx', 'portal']] as const) {
      expect(read(`components/site/${f}`), `${f} reads ${place} from CHAPTER`).toMatch(new RegExp(`CHAPTER\\.${place}`));
    }
    // Who it's for: each person's card is the colour of the place their chip comes from, read from
    // the same map by that place, and no card names a hue of its own.
    const people = read('components/site/people.tsx');
    expect(people).toMatch(/const hue = CHAPTER\[p\.place\];/);
    expect(people).not.toMatch(/hue: '[a-z]+'/);
    expect(read('components/site/nav-menu.tsx'), 'no place in the menu picks its own colour').not.toMatch(/hue: '[a-z]+'/);
    // A section that is not one PLACE is neutral — with one exception, and it is the rule rather
    // than a hole in it: the Details section belongs to no chapter (these are the parts you use in
    // every chapter), so under "one section, one colour" it takes the BRAND's own family, and its
    // eyebrow wears the same hue its six tiles do. The user asked for it by name: "the details tag
    // is also in brand need."
    const BRAND_SECTION = 'petal';
    for (const f of ['loop.tsx', 'hub-section.tsx', 'legal.tsx', 'people.tsx']) {
      for (const m of read(`components/site/${f}`).matchAll(/<Eyebrow hue="([a-z]+)"/g)) expect(m[1], `${f}: a section that is not one place is neutral`).toBe('neutral');
    }
    for (const m of read('components/site/site-home.tsx').matchAll(/<Eyebrow hue="([a-z]+)"[^>]*>([^<]*)</g)) {
      const expected = m[2] === 'The details' ? BRAND_SECTION : 'neutral';
      expect(m[1], `site-home.tsx "${m[2]}"`).toBe(expected);
    }
    // …and the eyebrow must not drift from the tiles it sits above.
    expect(new Set([...read('components/site/bento.tsx').matchAll(/hue: '([a-z]+)'/g)].map((m) => m[1])))
      .toEqual(new Set([BRAND_SECTION]));
    // Always coloured (an area's name) vs coloured only while showing (a feature in a list).
    expect(globals).toMatch(/\.site-tile \{ background: var\(--site-hue\); color: var\(--site-hue-fg\); \}/);
    // A BOX AT REST TOO (user, 2026-09-28: "I want all icons with box background, and active icons
    // with colour and the others default grey"). It used to be `transparent`, so a quiet item had a
    // bare glyph while the showing one had a filled tile — the list changed SHAPE as it advanced,
    // not just colour. The resting fill is the field wash, a step down from every ground it sits on.
    expect(globals).toMatch(/\.site-feature-tile \{[\s\S]*?background: var\(--color-surface-fill\);\s*color: var\(--color-ink-500\);/);
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
    expect(own.length).toBeGreaterThanOrEqual(9);
    for (const [, name, hex] of own) expect(PALETTE.has(hex.toUpperCase()), `--color-${name}: ${hex}`).toBe(true);
    // THE NEUTRALS ARE THE PRODUCT'S (2026-09-28): the band, its greys and the pictures' stock sit
    // on the warm axis every surface moved to (theme-shadcn.css, hue 68) inside its chroma cap, so
    // the website's darks and papers are the app's rather than a second, neutral family.
    const neutrals = [...globals.matchAll(/--site-(band[a-z-]*): oklch\(([\d.]+) ([\d.]+) (\d+)\);/g)];
    expect(neutrals.length, 'the band and its greys').toBeGreaterThanOrEqual(5);
    for (const [, name, , c, h] of neutrals) {
      expect(Number(h), `--site-${name}: on the warm axis`).toBe(68);
      expect(Number(c), `--site-${name}: inside the cap`).toBeLessThanOrEqual(0.004);
    }
    expect(globals).toMatch(/--color-site-ink: var\(--site-band\);/);
    // ONE ARC PER PICTURE, from the palette only (2026-09-26, restored 2026-09-29). A picture's stops
    // are palette hues, never far apart on the wheel, so where they meet they make light and not grey.
    const HUE_AT: Record<string, number> = { petal: 354, apricot: 60, butter: 95, sage: 135, sky: 221, periwinkle: 280 };
    for (const tone of ['hero', 'how', 'day', 'projects', 'portal', 'money']) {
      const rule = globals.match(new RegExp(`\n\.site-field-${tone} \{([^}]*)\}`))?.[1] ?? '';
      const hues = [...new Set([...rule.matchAll(/--f-ink-([a-z]+)/g)].map((m) => m[1]))];
      expect(hues.length, `${tone}: one or two palette hues`).toBeGreaterThanOrEqual(1);
      for (const a of hues) for (const b of hues) {
        const d = Math.abs(HUE_AT[a] - HUE_AT[b]);
        expect(Math.min(d, 360 - d), `${tone}: ${a} and ${b} are not neighbours`).toBeLessThanOrEqual(110);
      }
    }
    // Each chapter's picture is painted in its chapter's hue (visual.tsx `CHAPTER`).
    expect(globals).toMatch(/\n\.site-field-day \{ --f-a: var\(--f-ink-apricot\);[^}]*--f-c: var\(--f-ink-butter\); \}/);
    expect(globals).toMatch(/\n\.site-field-projects \{[^}]*--f-b: var\(--f-ink-sky\);/);
    expect(globals).toMatch(/\n\.site-field-portal \{[^}]*--f-b: var\(--f-ink-periwinkle\);/);
    expect(globals).toMatch(/\n\.site-field-money \{[^}]*--f-b: var\(--f-ink-sage\);/);
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
    // The positioning's one line (the website and SEO plan, 2026-09-27), counted on across its two
    // lines: the second starts at word four because the first holds three.
    expect(home).toMatch(/<Words>One calm workspace<\/Words>[\s\S]*<Words from=\{3\}>to run your business\.<\/Words>/);
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

describe('the page offers a way back up, and one appearance', () => {
  // The user, 2026-09-26: "give the website a back to top option". And 2026-09-29: "right now we
  // only keep light mode, we're removing dark mode" — of the website; the app keeps both.
  it('is drawn in ONE appearance, whatever the visitor chose for the app', () => {
    expect(existsSync('components/site/theme-switch.tsx'), 'the site has no light-or-dark switch').toBe(false);
    for (const [f, src] of all) expect(src, f).not.toMatch(/ThemeSwitch|commitAppearance/);
    const theme = read('lib/theme.ts');
    // Before first paint (the boot script) and in every later apply, a site address resolves to it…
    expect(theme).toMatch(/export const SITE_APPEARANCE = \{ theme: 'light', density: DEFAULT_DENSITY, accent: 'berry', skin: 'default' \}/);
    expect(theme).toMatch(/export const SITE_PATHS: readonly string\[\] = \[\.\.\.ALL_SITE_PAGES\.map\(\(p\) => p\.path\), '\/demo'\];/);
    expect(theme).toMatch(/if \(onSite\(\)\) \(\{ theme, density, accent, skin \} = SITE_APPEARANCE\);/);
    // …and a soft navigation between the site and the app re-applies, because the layout stays mounted.
    expect(read('components/shell/appearance-boot.tsx')).toMatch(/\}, \[pathname\]\);/);
    // The demo inside the page stores the same appearance rather than the visitor's.
    expect(read('components/demo/sandbox.ts')).toMatch(/\[THEME_KEY\]: SITE_APPEARANCE\.theme,/);
    // And no website rule is drawn for a dark page.
    const site = globals.slice(globals.indexOf("/* ── THE WEBSITE ARRIVES AS IT IS READ"), globals.indexOf('/* ── REDUCED MOTION: fewer and gentler'));
    expect(site).not.toMatch(/data-theme='dark'/);
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
    // In the one frame every page of the site stands in, so no page can lose it.
    expect(read('components/site/site-shell.tsx')).toMatch(/<BackToTop \/>/);
    for (const f of ['site-home.tsx', 'legal.tsx']) expect(read(`components/site/${f}`), f).toMatch(/<SiteShell /);
  });
});

describe('the pictures are painted, not ramped', () => {
  // The user, 2026-09-26: "the gradient execution looks so basic, I want it like Calendly's". Measured on
  // calendly.com: blurred organic shapes over a pale ground, and a fine grain. Every picture has them.
  const visual = read('components/site/visual.tsx');

  it('screens a picture, it does not paint blobs on it', () => {
    // The blobs are gone (2026-09-26). Five blurred pastels averaged to grey, which is what the
    // user was looking at when they said the gradients "look so bad in black and white". The
    // colour is the field's own background now; this layer is only the grain.
    expect(visual).not.toMatch(/site-blob|'side'|'deep'/);
    expect(globals).not.toMatch(/\.site-blob/);
    expect(visual).toMatch(/<span className="site-grain" \/>/);
    expect(visual).toMatch(/export function Stage[\s\S]*?<Mesh flip=\{flip\} \/>/);
    expect(read('components/site/loop.tsx')).toMatch(/site-field-how[^\n]*\n\s*<Mesh \/>/);
    expect(home).toMatch(/site-field-hero[^\n]*\n\s*<Mesh \/>/);
  });

  it('grains every picture at two pitches, and never animates it', () => {
    // Not decoration: in every reference the user sent, the grain is the loudest thing after the
    // colour, and a wash this wide bands on an 8-bit screen without it. Two pitches so it reads
    // as paper rather than as television static.
    const grain = globals.match(/\.site-grain \{([^}]*)\}/)?.[1] ?? '';
    expect(grain).toMatch(/mix-blend-mode: soft-light/);
    expect((grain.match(/feTurbulence/g) ?? []).length, 'a fine pitch and a coarse one').toBe(2);
    expect(Number(grain.match(/opacity: ([\d.]+)/)?.[1]), 'loud enough to read').toBeGreaterThan(0.25);
    expect(globals).not.toMatch(/\.site-grain[^{]*\{[^}]*animation/);
  });
});

describe('the hub, from the design canvas', () => {
  // claude.ai/artifact/Eepb17AWMWrLSfzwMerT1a: twelve features fanning into the mark. It is the
  // product's own thesis as a picture — every other section argues a PART, and this one argues the
  // whole. Its canvas ships a handoff board stating how it adapts; those four rules are below.
  const hub = read('components/site/hub-section.tsx');

  it('draws twelve features and twenty-six lines, from one table', () => {
    expect((hub.match(/\{ label: '/g) ?? []).length).toBe(12);
    // Generated, not listed: twenty-six hand-written cubics is a table nobody can check.
    expect(hub).toMatch(/function fan\(side: 'left' \| 'right'\)/);
    expect(hub).toMatch(/const SPREAD = \[-150, -54\.2,/);
    expect(hub).toMatch(/const LINES = \{ left: fan\('left'\), right: fan\('right'\) \};/);
  });

  it('colours each tile by its PLACE, from the one map', () => {
    // User, 2026-09-29: "colours feel like we use them randomly". A tile wears the colour of the place
    // it belongs to (visual.tsx `CHAPTER`), the same hue as that place's section, tag and menu card.
    expect(hub).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])/);
    expect(hub).toMatch(/const hueOf = \(f: \{ place: Place \}\) => HUE\[CHAPTER\[f\.place\]\];/);
    for (const m of hub.matchAll(/\{ label: '[^']+', icon: \w+, place: '([a-z]+)'/g)) expect(['day', 'projects', 'portal', 'money']).toContain(m[1]);
    expect((hub.match(/place: '/g) ?? []).length).toBe(12);
  });

  it('adapts the four ways its handoff states', () => {
    // 900+: full fan with labels · 760–899: fan without labels, chips below · under 760: the fan
    // stops shrinking and crops to its centre · over 1600: the band caps and the lines fade.
    // Measured live at 1440 / 860 / 390: labels shown/hidden/hidden, chips hidden/shown/shown,
    // field 1288 / 760 / 760.
    expect(globals).toMatch(/@container \(max-width: 56\.25rem\) \{ \.hub-tile-label \{ display: none; \} \}/);
    expect(globals).toMatch(/@container \(max-width: 47\.5rem\) \{\s*\n\s*\.hub-field \{ width: 760px;/);
    expect(globals).toMatch(/\.hub-stage \{ container-type: inline-size; width: 100%; max-width: 1600px; \}/);
    expect(globals).toMatch(/\.hub-field \{ width: 100%; aspect-ratio: 1440 \/ 640; \}/);
  });

  it('paints its centre as the brand’s own picture: the pictures’ recipe, in the mark’s arc', () => {
    // User, 2026-09-29: "fix this animation gradient, make it in brand, make it look properly
    // designed" and "use our original gradient, in the current brand, and make it more cohesive". The
    // six-hue centre was a rainbow; the centre is now painted exactly as every picture is, in the
    // mark's own arc (berry, rose, apricot), and its glow and ripple are the same arc.
    const centre = globals.slice(globals.indexOf('/* ── THE CENTRE:'), globals.indexOf('/* ── THE FOUR RULES'));
    expect(centre).toMatch(/--hub-deep: var\(--accent\);/);
    expect(centre).toMatch(/--hub-rose: oklch\(from var\(--color-field-petal\) calc\(l - 0\.16\) calc\(c \* 3\.0\) h\);/);
    expect(centre).toMatch(/--hub-warm: oklch\(from var\(--color-field-apricot\) calc\(l - 0\.16\) calc\(c \* 3\.0\) h\);/);
    expect(centre).toMatch(/\.hub-mark \{[\s\S]*?radial-gradient\(86% 128% at 2% 98% in oklab,\s*var\(--hub-deep\)/);
    // One arc: no hue from the rest of the wheel, and no conic wheel of them.
    expect(centre, 'a rainbow is not one brand').not.toMatch(/field-(sky|sage|butter|periwinkle)|conic-gradient/);
    // The mark takes its ink as a STYLE: `Mark` paints itself with an inline colour, which beats a class.
    expect(centre).toMatch(/--hub-mark-ink: var\(--color-illustration-light\);/);
    expect(hub).toMatch(/<Mark size=\{48\}[^>]*style=\{\{ color: 'var\(--hub-mark-ink\)' \}\}/);
    // It moves by its light, never by turning: two layers rotate under a mark that stays still.
    expect(globals).toMatch(/@keyframes hub-swirl \{ to \{ rotate: 360deg; \} \}/);
    expect(hub).toMatch(/<span aria-hidden className="hub-paint hub-paint-a" \/>/);
    expect(hub).toMatch(/<span aria-hidden className="site-grain" \/>/);
  });

  it('feeds the hub from every tile, in that tile\'s own colour, about four at a time', () => {
    // This used to assert FOUR neutral dots on four arbitrary fan lines. The fan is generated to
    // even heights at the field's edge and has nothing to do with where the tiles sit, so a dot
    // came from nowhere and wore the lattice's colour (user, 2026-09-27: "the dots go random — I
    // want specific colours, starting behind each icon"). Now every feature feeds the hub down a
    // line of its own, carrying the same token its records wear inside the product.
    //
    // The ORIGINAL point still holds and is still guarded: a swarm says "busy" where four says
    // "connected". Twelve feeds are only ever ~4 in flight because each travels for 34% of its
    // cycle and rests the rest — so the duty cycle is the assertion, not the count.
    expect(hub).toMatch(/const FEEDS = FEATURES\.map\(/);
    expect(hub, 'one feed per feature, never a hand-written list').not.toMatch(/\{ side: '/);
    // Its colour is its PLACE's ink, set by the place's class, never a value.
    expect(hub).toMatch(/className=\{cn\('hub-feed', hueOf\(f\)\)\}/);
    expect(globals).toMatch(/\.hub-feed-halo, \.hub-feed-dot \{ fill: var\(--site-hue-ink\); \}/);
    // It starts where its TILE sits on the line and ends at the mark — everything comes IN. The
    // fan's curves are drawn from the mark outward, so the hub is 0% and `--hub-from` is the tile.
    expect(globals).toMatch(/@keyframes hub-feed \{\s*\n\s*0%\s*\{ offset-distance: var\(--hub-from\); opacity: 0; \}/);
    expect(globals).toMatch(/34%\s*\{ offset-distance: 0%; opacity: 0; \}/);
    // NOTHING IS DRAWN FOR THE DOTS. A previous pass gave each tile its own curve so a dot had a
    // path under it, and twelve new lines crossing the fan's twenty-six read as noise ("so noisy,
    // overlapping lines"). The dots ride lines the drawing already had; `feed()` matches a tile to
    // the nearest one rather than inventing a path.
    expect(globals, 'no per-tile line to light').not.toMatch(/hub-feed-line/);
    expect(hub, 'no per-tile path element').not.toMatch(/hub-feed-line/);
    expect(hub).toMatch(/const WALKED = \{ left: LINES\.left\.map\(walk\), right: LINES\.right\.map\(walk\) \}/);
    const cycle = globals.match(/34%\s*\{ offset-distance: 0%/) ? 0.34 : 1;
    expect(12 * cycle, 'about four in flight at once').toBeLessThanOrEqual(4.5);
    const still = globals.slice(globals.indexOf('.hub-stage'));
    expect(still).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,240}\.hub-feed \{ animation: none; display: none; \}/);
    // The glow breathes, and it is token-timed. It is not switched OFF for reduced motion — it
    // gets a same-name twin that keeps the opacity and drops the scale. Fewer and gentler, not
    // zero (app/design-system.test.ts enforces both halves of that).
    expect(globals).toMatch(/animation: hub-breathe calc\(var\(--duration-slow\) \* 60\)/);
    expect(globals).toMatch(/@keyframes hub-breathe \{ 50% \{ opacity: 0\.78; \} \}/);

    // ── THE RIPPLE HAS NO EDGE TO TRACE, AND CANNOT REACH THE WORDS ──────────
    // User, 2026-09-28: "rethink this animation from scratch … no hard cuts or abrupt edges …
    // it should never overlap the text". Every concentric thing here used to be a 1px BORDER,
    // and a border has a hard cut by definition — which is the one quality the reference does
    // not have. A ripple is a soft-edged band now, painted rather than outlined.
    expect(globals, 'a ripple must not be an outline').toMatch(
      /\.hub-ripple \{[^}]*mask-image: radial-gradient\(closest-side, transparent \d+%, #000 \d+%, transparent \d+%\);/);
    expect(globals.slice(globals.indexOf('.hub-ripple {')), 'no border on the band').not.toMatch(/^\s*border: 1px/m);
    // THE CENTRE'S OWN COLOUR LEAVING IT (user, 2026-09-29: "make it in brand … more cohesive"), along
    // the tile's own light: deep at the lower left, warm at the upper right.
    expect(globals).toMatch(/\.hub-ripple \{[^}]*background: linear-gradient\(45deg in oklab,\s*color-mix\(in oklab, var\(--hub-deep\)/);
    // AND IT ANSWERS AN ARRIVAL rather than running on its own clock (user: "ripple active when
    // dots touch the Zenboard icon"). A dot crosses in the first 34% of its cycle, so each ripple
    // takes a real feed's duration and starts at that same 34%: it breaks as its dot lands.
    expect(hub).toMatch(/const RIPPLES = \[0, 4, 8\]\.map\(\(i\) => \(\{ seconds: FEEDS\[i\]\.seconds, delay: FEEDS\[i\]\.delay \+ FEEDS\[i\]\.seconds \* 0\.34 \}\)\);/);
    expect(hub).toMatch(/animationDuration: `\$\{r\.seconds\}s`/);
    // SMOOTH (user: "the ripple is not smooth"). It spiked to full at 4% and cut out at 26% — an
    // opacity step that fast IS the hard edge, whatever the gradient underneath does.
    expect(globals).toMatch(/@keyframes hub-ripple \{[\s\S]*?12%\s*\{ opacity: 0\.55; \}[\s\S]*?34%\s*\{ opacity: 0\.5; \}/);
    // A ripple is constant motion outward, so the scale runs linear (Emil's tree); an ease-out
    // makes it lurch and then crawl.
    expect(globals).toMatch(/animation: hub-ripple var\(--hub-ripple-cycle\) linear infinite both;/);
    // FENCED BY CONSTRUCTION, not by numbers that happen to miss. The stage is pulled up under
    // the lede, so the layer is masked rather than trusted.
    expect(globals).toMatch(/\.hub-ripples \{[\s\S]*?mask-composite: intersect;/);
    expect(hub).toMatch(/<span aria-hidden className="hub-ripples">/);
    // …and the two standing rings are GONE rather than restyled: three concentric ideas in one
    // picture is the "unnecessary visual complexity" the brief names.
    expect(globals + hub, 'the standing rings').not.toMatch(/hub-ring\b|hub-ring-|hub-turn|hub-halo/);
  });

  it('hides the drawing from assistive technology and says the twelve in words', () => {
    expect(hub).toMatch(/<div aria-hidden className="hub-stage/);
    expect(hub).toMatch(/<ul className="hub-chips/);
  });

  it('sits right after the hero, as its handoff asks', () => {
    expect(home).toMatch(/<Showcase \/>\s*\n\s*<HubSection \/>/);
  });
});

describe('the product menu, from the design canvas', () => {
  // The canvas's "Site navigation · micro illustrations": six places in two columns with a
  // drawing each, and an aside holding everything else plus the launch film. It replaced a menu
  // of FOUR places explained at length — a menu is a list of where you can go, not a place to
  // read, and anything that needs explaining is a section one click away.
  const menu = read('components/site/nav-menu.tsx');
  const art = read('components/site/nav-art.tsx');

  it('shows six places, each with its own drawing', () => {
    expect((menu.match(/Scene: \w+Scene/g) ?? []).length).toBe(6);
    for (const scene of ['Home', 'Inbox', 'Projects', 'Portal', 'Docs', 'Finance']) {
      expect(art, `${scene}Scene`).toMatch(new RegExp(`export function ${scene}Scene\\(`));
    }
    // Drawn in one box the card crops, so nothing in a scene reflows.
    expect(art).toMatch(/export const NAV_SCENE = \{ width: 190, height: 128 \} as const;/);
  });

  it('offers ONE affordance, and teaches no shortcut', () => {
    // This used to assert the opposite: at rest an item showed its KEYS, and under the pointer
    // they crossfaded into an arrow. The user removed the chips on 2026-09-27 ("remove this
    // shortcut, I don't like it") — a website cannot keep that promise anyway, because G T means
    // nothing until you are signed in, and the chip put a second label beside every title.
    // What is guarded now is what replaced it: no keyboard hint anywhere in the menu, and one
    // chevron — the same affordance the cookie card uses — rather than an arrow.
    expect(menu, 'no shortcut chips in the product menu').not.toMatch(/<Kbd/);
    expect(menu, 'and no key data feeding them').not.toMatch(/keys:/);
    expect(menu).toMatch(/<Icon icon=\{ChevronRight\}/);
    expect(menu, 'the arrow was the chip\'s partner and went with it').not.toMatch(/ArrowRight/);
  });

  it('washes on hover, and never lifts', () => {
    // The canvas draws the hovered card white with a ring; white is an ELEVATION, and a state
    // here is a wash (app/theme-bridge.test.ts). The ring is what the canvas is really saying.
    // WHICH wash is a question of area. `surface-hover` (ink at 5%) is sized for a 32px row; on a
    // card this large it read heavy, and it COMPOUNDED with the drawing's own `surface-fill` (6%)
    // into the fill-on-fill the house forbids (user, 2026-09-27: "this hover grey is so dark").
    // `surface-row` is the same ladder's quietest step, 2.5%. The assertion that matters is
    // unchanged: a state here is a WASH, and never the elevation the canvas drew.
    expect(menu).toMatch(/hover:bg-surface-row hover:shadow-\[inset_0_0_0_1px_var\(--color-border-panel\)\]/);
    expect(menu).not.toMatch(/hover:bg-surface-raised/);
  });

  it('gives every drawing the classes it asks for', () => {
    // These four were referenced by nav-art.tsx and never written, so every pointer in the menu
    // rendered BLACK: `fill: var(--art-pointer)` with no such property is an invalid paint, and
    // SVG's fallback for that is black. A missing custom property is valid CSS, so no test could
    // have caught it — it was found by looking at the menu.
    expect(globals).toMatch(/\.site-art \{ --art-pointer: var\(--site-hue-ink, var\(--accent\)\); \}/);
    for (const c of ['site-art-guide', 'site-art-tag', 'site-art-you']) expect(globals, c).toContain(`.${c}`);
  });

  it('carries the launch film without making anyone download it', () => {
    // 23 MB. A menu nobody opened must not have fetched it, so the card shows a poster frame and
    // the film itself loads only when the dialog opens. Verified in a browser: opening the menu
    // requests the .jpg and never the .mp4.
    expect(menu).toMatch(/preload="none"/);
    expect(menu).toMatch(/length: '1:13'/);            // read off the file: 73.557s
    expect(menu).not.toMatch(/autoPlay|autoplay/);
    expect(existsSync('public/film/zenboard-launch.mp4'), 'the film ships').toBe(true);
    expect(existsSync('public/film/zenboard-launch.jpg'), 'and its poster').toBe(true);
  });

  it('is one list, so the phone and the desktop cannot drift apart', () => {
    expect(menu).toMatch(/export function ProductMenuMobile\(/);
    expect(read('components/site/site-chrome.tsx')).toMatch(/<ProductMenuMobile \/>/);
  });
});

describe('the client portal section, from the design canvas', () => {
  // Built from the user's canvas (claude.ai/artifact/3HAMhbe4fYnVCyP4nkHYnz). The canvas is drawn
  // in absolute pixels and literal hexes because that is what a canvas is for; what this guards is
  // the TRANSLATION — that none of those pixels or hexes survived into the page.
  const portal = read('components/site/portal-section.tsx');

  it('replaced the spotlight, and says why', () => {
    // The portal is five separate promises, and a list that shows one at a time makes a reader
    // wait to find out whether the one they care about is in it.
    expect(home).toMatch(/<PortalSection \/>/);
    expect(home).not.toMatch(/<PortalArea \/>/);
    expect((portal.match(/<Card\s/g) ?? []).length, 'five cards').toBe(5);
  });

  it('sits on the page’s own lattice, at the canvas’s own proportions', () => {
    // 764 and 545 of 1309 are 7 and 5 of twelve; three 436s are three fours. Measured in the
    // browser at 1440: 807 / 576, then 461 / 461 / 461.
    expect(portal).toMatch(/<Row id="portal"/);
    expect(portal).toMatch(/lg:col-span-7/);
    expect(portal).toMatch(/lg:col-span-5/);
    expect((portal.match(/lg:col-span-4/g) ?? []).length).toBe(3);
  });

  it('carries no pixel colour across: every hue is a token', () => {
    expect(portal).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])/);
    // The canvas's lilac IS the site's periwinkle field, and its deep lilac that hue at ink
    // strength — so the section reads its colour from the same place every other one does.
    expect(portal).toMatch(/site-hue-periwinkle/);
    expect(portal).toMatch(/var\(--site-hue-ink\)/);
  });

  it('gives a card the room its picture needs', () => {
    // A card's illustration is absolutely positioned, so it adds NOTHING to the card's height:
    // without a floor the card collapses onto its words and the picture spills into the row
    // below, which is exactly what the first render did.
    expect(portal).toMatch(/tall \? 'min-h-\[\d+px\] sm:min-h-\[600px\]' : 'min-h-\[\d+px\] sm:min-h-\[560px\]'/);
  });

  it('uses the product’s own controls, never a drawing of one', () => {
    // The canvas draws a 28×16 switch; the real one brings its keyboard, its ARIA and the house's
    // motion, and a reader who tabs into the card gets the switch the product actually has.
    expect(portal).toMatch(/<Switch\s/);
    expect(portal).toMatch(/cardClass\(/);
    // A LOOPED picture draws the product's buttons with the product's own classes (`button()`),
    // because the pointer is given nothing to do in it: a picture is looped or interactive.
    expect(portal).toMatch(/className=\{cn\(button\(\{ size: 'sm', variant: 'primary' \}\), 'plot-press pointer-events-none flex-1'\)\}/);
  });

  it('makes the claim it argues with: the reader chooses what the client sees', () => {
    // "You decide what they see" is the section's promise, so the reader decides, and the
    // client's view changes under their hand. Verified live: 4 of 5 on, toggled to 3 of 5.
    expect(portal).toMatch(/aria-live="polite"[\s\S]{0,120}\{shared\} of \{SHARE\.length\} on/);
    expect(portal).toMatch(/onCheckedChange=\{\(v\) => setOn\(/);
    // …and the other verb a card owns: copying the link. Answering the approval is the looped
    // story's to tell now (user, 2026-09-29: "proper animation … on loop").
    expect(portal).toMatch(/navigator\.clipboard\?\.writeText/);
    expect(portal, 'a looped picture with a live button in it').not.toMatch(/setApproved/);
  });
});

describe('a card knows where your hand is', () => {
  // The user, 2026-09-26: "all your animation is clean but not rich and premium." The audit that
  // day measured 124 of this page's 180 moving elements changing COLOUR and nothing else, which is
  // tidy and flat. A surface that responds to the pointer is the difference.
  const sheen = read('components/site/sheen.tsx');

  it('moves a LEAF with a transform, never a variable on the card', () => {
    // A custom property set on an ancestor invalidates style for every descendant, and these cards
    // hold a hundred (Emil, on Vaul: update the element's transform, not a variable on the
    // container). So the light is its own element and the move is one composited transform.
    expect(sheen).toMatch(/el\.style\.transform = `translate3d\(\$\{x\}px, \$\{y\}px, 0\)`/);
    expect(sheen, 'no variable on the host').not.toMatch(/setProperty\(/);
    expect(sheen, 'one write per frame').toMatch(/if \(!raf\) raf = requestAnimationFrame\(paint\);/);
  });

  it('measures the card once per hover, not once per move', () => {
    // getBoundingClientRect in a pointermove handler is a forced synchronous layout on every
    // event; the card's box cannot change between two moves of the same pass.
    const move = sheen.slice(sheen.indexOf('const move ='), sheen.indexOf('const enter ='));
    expect(move, 'the move handler must not measure').not.toMatch(/getBoundingClientRect/);
    expect(sheen).toMatch(/const enter = \(e: PointerEvent\) => \{\s*\n[\s\S]*?box = host\.getBoundingClientRect\(\);/);
  });

  it('runs nothing while nobody is pointing, and never on a touch screen', () => {
    expect(sheen).toMatch(/host\.addEventListener\('pointermove', move, \{ passive: true \}\);/);
    expect(sheen).toMatch(/host\.removeEventListener\('pointermove', move\);/);
    expect(sheen).toMatch(/\(hover: hover\) and \(pointer: fine\)/);
  });

  it('paints above the card’s background and below its content, so nothing needs wrapping', () => {
    const rule = globals.match(/\.zb-sheen, \.zb-sheen-rim \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/z-index: -1;/);
    expect(globals).toMatch(/\.zb-sheen-host \{\s*\n\s*position: relative;\s*\n\s*isolation: isolate;/);
    // On paper a light can barely be seen, so the LIFT is the honest half: 1px and a shadow, which
    // is a card noticing you rather than jumping at you.
    expect(globals).toMatch(/\.zb-sheen-host:hover \{ transform: translateY\(-1px\); box-shadow: var\(--shadow-lift-2\); \}/);
    // And the light is WHITE on paper. A brand-tinted light on a near-white card reads as the card
    // changing STATE, not as a lamp (user, 2026-09-26: "this looks so bad", of a card gone pink).
    expect(globals).toMatch(/--color-sheen: color-mix\(in oklab, var\(--color-paper\) \d+%, transparent\);/);
    expect(globals, 'the rim is ink, never the brand: a berry outline round every card reads as selected')
      .not.toMatch(/--color-sheen-rim: color-mix\(in oklab, var\(--accent\)/);
    // A highlight has to be smaller than the thing it is on.
    expect(globals).toMatch(/width: 18rem; height: 18rem;/);
    expect(rule).toMatch(/opacity: 0;/);
    expect(rule, 'the fade is on the hover budget').toMatch(/transition: opacity var\(--duration-slow\) var\(--ease-hover\)/);
  });

  it('keeps the rim and drops the travelling light when less motion is asked for', () => {
    const still = globals.slice(globals.indexOf('.zb-sheen-host'));
    expect(still).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\n[^}]*\.zb-sheen \{ display: none; \}/);
  });

  it('is on the cards a reader CHOOSES between, and nowhere else', () => {
    // Not every surface: a light that follows the pointer everywhere is a gimmick. The details
    // grid and the chooser are the two places on this page where a reader weighs one card
    // against another.
    expect(read('components/site/bento.tsx')).toMatch(/<Cell sheen data-reveal-group/);
    // People is one strip now, so its cards are its panels; the sheen went with the cells.
    expect(read('components/site/visual.tsx')).toMatch(/sheen && 'zb-sheen-host overflow-hidden'/);
  });
});

describe('every illustration stands on the same stage', () => {
  // User, 2026-09-28: "the Client Portal section and the Details section have completely different
  // visual treatments. I really like the treatment used in the Client Portal section. Keep that
  // treatment consistent across all illustrations … every illustration should feel like it belongs
  // to the same Zenboard brand and visual system, rather than each section having its own
  // unrelated style."
  //
  // So the stage is ONE component in the shared file, and its classes no longer carry the name of
  // the section it was born in — `plot-*`, not `portal-*`. A name that says where a thing came
  // from is how the second copy gets written.
  const visual = read('components/site/visual.tsx');

  it('the stage lives in visual.tsx, not in the section that invented it', () => {
    expect(visual).toMatch(/export function Plot\(/);
    expect(visual).toMatch(/className="plot-ground absolute inset-0"/);
    for (const f of ['components/site/portal-section.tsx', 'components/site/bento.tsx']) {
      expect(read(f), `${f} must use the shared stage`).toMatch(/<Plot\b/);
      expect(read(f), `${f} must not declare its own`).not.toMatch(/function Plot\(/);
    }
  });

  it('an illustration is LOOPED or INTERACTIVE, never both', () => {
    // User, 2026-09-28: "some animated and some interactive — animated is continuously on loop, on
    // hover nothing is happening; and interactive is interactive." The Details drawings already run
    // their own clock (`ib-*`, site-board.css), and the tile ALSO rotated 6° and scaled on card
    // hover — a second, unrelated motion laid over one already moving, which is what they saw as
    // "the entire illustration is dancing".
    const bento = read('components/site/bento.tsx');
    expect(bento, 'a looped illustration must not also answer the pointer').not.toMatch(/group-hover\/card:(-?rotate|scale)/);
    // …and a picture that tells a story (`data-story`) is a LOOPED one, so its cards do not fan;
    // the ones that hold still are the interactive ones.
    expect(globals).toMatch(/\.plot-life:not\(\[data-story\]\):hover \.plot-panel/);
    expect(read('components/site/visual.tsx')).toMatch(/data-story=\{story \|\| undefined\}/);
  });

  it('the accordion opens on the drawer curve, and closes quicker than it opens', () => {
    // User: "make this open close smooth". `--ease-out-quiet` is the ARRIVAL curve — it front-loads
    // its travel, which is right for something appearing in place and wrong for a box changing
    // SIZE: the answer snapped to nearly full height and then crawled the last few pixels.
    const acc = read('components/ds/ui/accordion.tsx');
    expect(acc).toMatch(/data-\[state=open\]:animate-\[reveal-down_calc\(var\(--duration-slow\)\*1\.25\)_var\(--ease-drawer\)\]/);
    expect(acc).toMatch(/data-\[state=closed\]:animate-\[reveal-up_var\(--duration-slow\)_var\(--ease-drawer\)\]/);
    // And the words arrive behind the box rather than stretching with it.
    expect(read('app/ds-theme.css')).toMatch(/@keyframes reveal-down \{ from \{ height: 0; opacity: 0; \} 60% \{ opacity: 1; \}/);
  });

  it('every area picture is a screen of the product, one width, and says only what the product does', () => {
    // User, 2026-09-29: "too basic … bugs and inconsistencies, especially the bubble layers, duplicate
    // file layers, spacing, alignment … I want proper UI snippets and interface elements integrated".
    const snip = read('components/site/snippets.tsx');
    const areas = read('components/site/areas.tsx');
    // THE DUPLICATE LAYERS are gone: no stack of ghost cards behind a picture.
    expect(snip, 'ghost cards behind the screen').not.toMatch(/\{stack && \(|plot-panel pointer-events-none absolute inset-x/);
    // Every picture is framed as the app frames a page, at ONE width, so the frame never jumps.
    expect(snip).toMatch(/export const SCREEN_WIDTH = 'max-w-\[34rem\]';/);
    expect(snip).toMatch(/<div className=\{cn\('relative w-full', SCREEN_WIDTH, className\)\}>/);
    const shown = [...areas.matchAll(/visual: \(\) => (?:\(\s*)?<(\w+)/g)].map((m) => m[1]);
    expect(shown.length, 'twelve pictures').toBe(12);
    for (const c of shown) expect(c === 'Screen' || /Screen$/.test(c), `${c} is a screen`).toBe(true);
    // THE BUBBLES: at most one piece of context, drawn as the product's toast, on the bottom edge.
    expect(snip, 'the old floating chips').not.toMatch(/export function Float\(|floats=\{/);
    expect(snip).toMatch(/'plot-panel absolute -bottom-6 z-10 flex h-10/);
    for (const m of snip.matchAll(/export function (\w+Screen)\(\)[\s\S]*?\n\}\n/g)) {
      expect((m[0].match(/<SceneToast/g) ?? []).length, `${m[1]}: one toast at most`).toBeLessThanOrEqual(1);
    }
    // ONLY WHAT THE PRODUCT DOES: invoice reminders are planned, not live, and there is no nudge.
    // (In what the pictures SAY: a comment explaining the rule may name it.)
    const said = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
    expect(said(snip + areas), 'a feature the product does not have').not.toMatch(/Reminder sent|Nudge sent|nudge/i);
    // The avatar stack is the product's own, never hand-drawn initials.
    expect(read('components/site/demos.tsx')).toMatch(/<AvatarGroup people=\{\[/);
    expect(read('components/site/demos.tsx'), 'hand-drawn initials').not.toMatch(/\['AL', 'PR', 'SM'\]/);
  });

  it('draws the calendar on its hours: a label and its line share one centre, a half hour holds its line', () => {
    const demos = read('components/site/demos.tsx');
    expect(demos).toMatch(/className="absolute inset-x-0 flex h-0 items-center"/);
    expect(demos, 'the half-pixel nudge that set each label 8px above its line').not.toMatch(/h-px flex-1 -translate-y-1\/2/);
    expect(Number(demos.match(/const PX_PER_MIN = ([\d.]+);/)?.[1]) * 30, 'a half-hour event is tall enough for its line').toBeGreaterThanOrEqual(22);
  });

  it('the portal pictures tell their story on a loop, in one vocabulary', () => {
    // User, 2026-09-29: "make them proper animation, delightful animation, on loop". Each picture
    // tells its card's sentence in STEPS: a clock in script (use-story.ts), and every part saying
    // from which step it shows, moved by CSS transitions.
    const portal = read('components/site/portal-section.tsx');
    const story = read('components/site/use-story.ts');
    expect((portal.match(/useStory\(/g) ?? []).length, 'three stories').toBe(3);
    expect((portal.match(/<Plot ref=\{ref\} story /g) ?? []).length, 'each a LOOPED picture').toBe(3);
    expect((portal.match(/data-on=\{on\(/g) ?? []).length, 'parts that say when they show').toBeGreaterThanOrEqual(20);
    // It runs only while seen, from the start the first time, and holds the told step when less
    // motion is asked for.
    expect(story).toMatch(/new IntersectionObserver/);
    expect(story).toMatch(/const now = still \? told : step;/);
    expect(story).toMatch(/if \(still \|\| !seen\) return;/);
    // One vocabulary of transitions: arriving over the site's cross-fade, leaving quicker.
    expect(globals).toMatch(/\.plot-in\[data-on\] \{ opacity: 1; transform: none; transition-duration: var\(--site-swap\); \}/);
    expect(globals).toMatch(/\.plot-in \{\s*opacity: 0; transform: translateY\(6px\) scale\(0\.97\);\s*transition: opacity var\(--site-hover\)/);
    // The hand travels on the in-out curve and presses as the house presses.
    expect(globals).toMatch(/\.plot-cursor \{[^}]*transition: transform var\(--plot-travel\) var\(--ease-standard\)/);
    expect(globals).toMatch(/\.plot-press\[data-press\] \{ scale: 0\.97; \}/);
    // The old flicker is gone, and the one moving keyframe keeps a still twin.
    expect(globals + portal).not.toMatch(/plot-beat|plot-reach/);
    const reduced = globals.slice(globals.indexOf('@keyframes plot-ping'));
    expect(reduced).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*@keyframes plot-ping \{ from \{ opacity: 0\.6; \} to \{ opacity: 0; \} \}/);
    // A task's box in these pictures is square, as it is everywhere in Zenboard.
    expect(portal, 'a task drawn with a round box').not.toMatch(/size-3\.5 shrink-0 rounded-full border/);
  });

  it('the brand has ONE gradient, and the mark and the sweep state it identically', () => {
    // User, 2026-09-28, pointing at the loader: "I want gradients like this." It already existed —
    // `DrawnMark` paints the mark petal → berry → apricot — while `--brand-sweep` ran the OTHER way,
    // deriving berry → violet. Two brand gradients in opposite directions is not one brand, and the
    // whole reason that token exists is that one gradient reused is what makes a page read as one
    // family. The SVG cannot consume a CSS gradient, so the two STATE the same three stops and this
    // is what stops them drifting apart again.
    const STOPS = ['--color-field-petal', '--accent', '--color-field-apricot'];
    const mark = read('components/ds/ui/drawn-mark.tsx');
    for (const stop of STOPS) expect(mark, `the mark lost ${stop}`).toContain(stop);
    const sweep = globals.match(/--brand-sweep: linear-gradient\(100deg in oklab,[\s\S]*?\);/)?.[0] ?? '';
    expect(sweep, 'the derived violet sweep is gone').toBeTruthy();
    for (const stop of STOPS) expect(sweep, `the sweep lost ${stop}`).toContain(stop);
    expect(sweep, 'the sweep must not derive a hue of its own any more').not.toMatch(/oklch\(from/);
    // …and the hub's centre is painted in the same three (user, 2026-09-29: "make it in brand").
    const centre = globals.slice(globals.indexOf('/* ── THE CENTRE:'), globals.indexOf('/* ── THE FOUR RULES'));
    for (const stop of STOPS) expect(centre, `the centre lost ${stop}`).toContain(stop);
  });

  it('the CARDS react, not the whole picture', () => {
    // User, 2026-09-28: "on hover the entire illustration is dancing … on hover cards slide moving,
    // I want interaction." A hover parallax that leaned the whole drawing against the ground
    // shipped for about an hour and was exactly that. It fails the second question of Emil's
    // framework — what is the PURPOSE? Moving every plane together is a slide, not depth, and it
    // drags the words along with the picture.
    //
    // So the picture holds still and the cards inside it fan, which has something to say: there
    // are more of them than you can see. CSS, so it runs off the main thread and is interruptible.
    // (A picture that tells a story, `data-story`, is a looped one, and does not fan.)
    expect(globals).toMatch(/\.plot-life:not\(\[data-story\]\):hover \.plot-panel \{ transform: translateY\(-\d+px\); \}/);
    // The ones behind peek further out, staggered, so the fan opens away from the reader.
    expect(globals).toMatch(/\.plot-life:not\(\[data-story\]\):hover \.plot-panel ~ \.plot-panel \{ transform: translate\([^)]*\); transition-delay: \d+ms; \}/);
    // A hover takes the hover curve (Emil's tree), never the arrival curve.
    expect(globals).toMatch(/\.plot-life:not\(\[data-story\]\) \.plot-panel \{ transition: transform var\(--duration-base\) var\(--ease-hover\); \}/);
    // Gated behind a real pointer: a touch device fires hover on tap and would leave it fanned.
    expect(globals.slice(globals.indexOf('A STACK OF CARDS FANS'))).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    // And the JS that used to do this is GONE, not left dark.
    expect(() => read('components/site/plot-life.tsx')).toThrow();
    expect(globals + visual, 'the parallax planes').not.toMatch(/plot-plane|PlotLife/);
  });

  it('no picture is still wearing the old section-named treatment', () => {
    const src = ['app/globals.css', 'components/site/visual.tsx', 'components/site/bento.tsx',
                 'components/site/portal-section.tsx'].map(read).join('\n');
    expect(src, 'renamed so the stage belongs to no one section').not.toMatch(/portal-dots|portal-glow/);
  });

  it('the stage carries data attributes through, so a section keeps its choreography', () => {
    // A stage that swallowed `data-reveal` would break the reveal with no error at all.
    expect(visual).toMatch(/\{\.\.\.rest\}/);
  });
});

describe('the details are the board’s drawings, exactly', () => {
  // The user, 2026-09-27, of their illustration board: "use these exact same illustrations … in the
  // Details section … arrange them in a 3 × 2 grid … all 6 should always have animation … do not
  // change anything". The row used to be six small demos, each of which changed its drawing to show
  // itself off; that is precisely what the brief rules out. Verified at the time against the board
  // itself: every element of all six scenes matched in position, size, colour, type and shadow, light
  // and dark, and the light renders were pixel-identical.
  const bento = read('components/site/bento.tsx');
  const scenes = read('components/site/board-scenes.tsx');
  const css = read('app/site-board.css');

  it('draws all six from the board’s own markup, not from a redrawn copy', () => {
    expect(bento).toMatch(/from '\.\/board-scenes'/);
    expect(bento, 'the redrawn copies are not used here').not.toMatch(/from '\.\/illustrations'/);
    for (const name of ['BoardPalette', 'BoardShortcuts', 'BoardFocus', 'BoardCalendar', 'BoardDigest', 'BoardIntegrations']) {
      expect(scenes).toMatch(new RegExp(`export function ${name}\\(\\)`));
      expect(bento).toMatch(new RegExp(`Scene: ${name}`));
    }
    // A drawing is a picture: nothing in it can be pressed, and nothing in it changes with state.
    expect(scenes).not.toMatch(/\bon[A-Z]\w+=\{/);
    expect(scenes).not.toMatch(/useState/);
  });

  it('lays the six out three by two, every stage in the board’s own proportion', () => {
    expect(bento).toMatch(/className="md:col-span-6 lg:col-span-4"/);
    expect((bento.match(/Scene: Board\w+/g) ?? []).length).toBe(6);
    // The stage keeps the board's 4:3 — and since 2026-09-28 it IS the shared stage every picture
    // on the site stands on (`Plot`, visual.tsx), with the card's own hue on it so the bloom behind
    // a drawing matches its tile. The user: "keep that treatment consistent across all
    // illustrations … every illustration should feel like it belongs to the same Zenboard brand."
    expect(bento).toMatch(/<Plot glow data-reveal="rise" className=\{cn\('mt-auto aspect-\[4\/3\] w-full', HUE\[hue\]\)\}>/);
  });

  it('fits a scene the way the board does: contained and centred, never stretched', () => {
    expect(scenes).toMatch(/const s = Math\.min\(cw \/ w, ch \/ h\);/);
    expect(scenes).toMatch(/translate\(\$\{\(cw - w \* s\) \/ 2\}px, \$\{\(ch - h \* s\) \/ 2\}px\) scale\(\$\{s\}\)/);
  });

  it('moves every one of the six, always, on the board’s own loops', () => {
    const chunks = scenes.split(/export function Board/).slice(1);
    expect(chunks).toHaveLength(6);
    for (const c of chunks) expect(c, c.slice(0, 20)).toMatch(/ib-anim/);
    // The board plays them only under the pointer; the brief is "always".
    const anim = css.slice(css.indexOf('.ib-anim {'));
    expect(anim.slice(0, anim.indexOf('}'))).not.toMatch(/animation-play-state: paused/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.ib-anim \{ animation: none !important; \} \}/);
  });

  it('keeps the board’s own values, light and dark, and keeps them to the stage', () => {
    expect(css).toMatch(/^\.ib-scope \{/m);
    expect(css).toMatch(/--ib-accent: #c41c72;/);
    expect(css).toMatch(/html\[data-theme='dark'\] \.ib-scope \{[^}]*--ib-accent: #d55391;/);
    // Every rule is the stage's own: a class name or keyframe from the board cannot reach the page.
    expect(scenes, 'the board\u2019s ill- names are ib- here').not.toMatch(/className="[^"]*\bill-/);
    // In a cell the board draws no aura and no dot screen behind a scene; neither exists here.
    expect(css, 'no pseudo-element draws anything').not.toMatch(/content:/);
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
    // ONE SECTION, ONE COLOUR (user, same day): the Details row walked all six palette hues for
    // about an hour and read as a fairground. No chapter owns these — they are the parts you use in
    // every chapter — so they take the brand's own family, once.
    const bentoHues = [...read('components/site/bento.tsx').matchAll(/hue: '([a-z]+)'/g)].map((m) => m[1]);
    expect(new Set(bentoHues).size, 'one section, one icon colour').toBe(1);
  });
});

describe('the questions: the heading on the left, a card each on the right', () => {
  it('spans the heading over exactly as many rows as there are questions', async () => {
    const { FAQ_COUNT } = await import('./site-chrome');
    expect(home).toMatch(new RegExp(`lg:col-span-4 lg:row-span-${FAQ_COUNT}\\b`));
  });

  it('draws the grid\'s star at both ends of every card\'s top line, and keeps the mark close to its words', () => {
    const chrome = read('components/site/site-chrome.tsx');
    const q = chrome.slice(chrome.indexOf('export function Questions'), chrome.indexOf('export function SiteFooter'));
    expect(q).toMatch(/<Cell className="site-pad col-span-full lg:col-span-8">\s*<span aria-hidden className="site-joint" data-at="start" \/>\s*<span aria-hidden className="site-joint" data-at="end" \/>/);
    expect(q).toMatch(/className="h-auto min-h-16 gap-2\.5 /);
    expect(q).toMatch(/ps-7\.5/);
  });
});

describe('the colour and type system, after Ramp', () => {
  // The user, 2026-09-28: "take strong inspiration from Ramp's colour usage and section design …
  // the goal is not to make the website less colourful, it is to make the colours feel designed as
  // one system", then, of the canvas that proposed it: "implement the colours". Measured on Ramp's
  // stack page; every number below is one of theirs or derived from one.
  it('sets titles at Ramp’s sizes, at the face’s regular weight, with a phone step each', () => {
    expect(globals).toMatch(/--text-hero-size: 64px;\s+--text-hero-lh: 1;\s+--text-hero-weight: 400;/);
    expect(globals).toMatch(/--text-headline-size: 48px;\s+--text-headline-lh: 1\.0417;\s+--text-headline-weight: 400;/);
    expect(globals).toMatch(/--text-hero-sm-size: 40px;/);
    expect(globals).toMatch(/--text-headline-sm-size: 32px;/);
    // Every section title steps down on a phone the same way; none still uses the app's 28px h1.
    for (const [f, src] of all) expect(src, f).not.toMatch(/text-h1 [^"]*sm:text-headline/);
    expect(home).toMatch(/text-hero-sm text-ink-900 sm:text-hero/);
  });

  it('keeps the second tone to large type, where 3:1 is the bar', () => {
    // `--site-second` clears 3:1 and no more, so it may only colour a title of 24px and up. A
    // card's second tone is `ink-500` (CardLine), which clears 4.5:1.
    expect(globals).toMatch(/--site-second: color-mix\(in oklab, var\(--color-ink-900\) 60%, var\(--color-background\)\);/);
    for (const [f, src] of all) {
      // Only the two-tone `Title` (words.tsx); a file may have a component of its own by that name.
      if (f.endsWith('words.tsx')) continue;
      const pattern = /import \{[^}]*\bTitle\b[^}]*\} from '\.\/words'/.test(src) ? /<Title\b|text-site-second/g : /text-site-second/g;
      for (const m of src.matchAll(pattern)) {
        const before = src.slice(Math.max(0, m.index! - 320), m.index);
        const heading = before.lastIndexOf('text-headline') >= 0 ? before.lastIndexOf('text-headline') : before.lastIndexOf('text-hero');
        expect(heading, `${f}: a second tone outside a title`).toBeGreaterThanOrEqual(0);
        expect(before.slice(heading), `${f}: the title closed before the second tone`).not.toMatch(/<\/(h1|h2|p)>/);
      }
    }
    expect(read('components/site/visual.tsx')).toMatch(/<p className="inline text-ink-500">\{body\}<\/p>/);
  });

  it('opens every section the same way', () => {
    expect(globals).toMatch(/\.site-head \{ padding-block: 64px 40px; \}/);
    expect(globals).toMatch(/@media \(min-width: 64rem\) \{ \.site-head \{ padding-block: 112px 64px; \} \}/);
    for (const f of ['site-home.tsx', 'spotlight.tsx', 'people.tsx', 'portal-section.tsx']) {
      expect(read(`components/site/${f}`), f).toMatch(/site-head/);
    }
  });

  it('has one dark band, and closes in the same ink', () => {
    const loop = read('components/site/loop.tsx');
    expect(loop).toMatch(/<Cell pad className="site-band /);
    expect(read('components/site/site-chrome.tsx')).toMatch(/<Cell className="site-band site-ink /);
    const bands = all.filter(([, src]) => /className="site-band /.test(src)).map(([f]) => f).sort();
    expect(bands).toEqual(['components/site/loop.tsx', 'components/site/site-chrome.tsx']);
    // The band holds a LIGHT picture, as Ramp's does, and a hue on it keeps its light tile.
    expect(loop).toMatch(/className="site-field site-field-how relative mt-12/);
    expect(globals).toMatch(/:root \.site-band :is\(\.site-hue-petal,[^)]*\) \{\s*--site-hue: var\(--site-hue-src\);\s*--site-hue-fg: var\(--site-band\);/);
  });

  it('spends berry on three jobs only: the logo, the one filled button, focus', () => {
    // A step, an open question and a section never wear it; each place wears its own hue.
    const loop = read('components/site/loop.tsx');
    const steps = loop.slice(loop.indexOf('<RT.List'), loop.indexOf('</RT.List>'));
    expect(steps).not.toMatch(/accent/);
    expect(steps).toMatch(/HUE\[CHAPTER\[s\.place\]\]/);
    const chrome = read('components/site/site-chrome.tsx');
    const questions = chrome.slice(chrome.indexOf('export function Questions'), chrome.indexOf('export function SiteFooter'));
    expect(questions).not.toMatch(/text-accent/);
    // The one filled berry button on the page is the navigation's.
    expect((chrome.match(/variant: 'brand'/g) ?? []).length).toBe(1);
    expect(home).not.toMatch(/variant: 'brand'/);
  });
});
