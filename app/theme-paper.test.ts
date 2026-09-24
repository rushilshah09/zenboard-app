import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── THE PAPER SKIN ─────────────────────────────────────────────────────────
//
// A second skin is a second chance to ship an unmeasured palette. These are the four things that
// would make paper a downgrade rather than a theme: a token it forgets to override (a screen-grey
// card on a paper page), ink it cannot carry, an elevation that contradicts the material, and a
// texture that costs a network request. Each is checked here against the file itself.

const css = readFileSync('app/theme-paper.css', 'utf8');
const block = css.slice(css.indexOf("html[data-skin='paper'] {"), css.indexOf('/* The desk.'));
const value = (name: string) => new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(block)?.[1].trim();

// ── The ruler, self-tested ────────────────────────────────────────────────
// WCAG relative luminance. Checked against the two pairs whose answers are known before it is
// pointed at anything (contrast-audit-instrument: verify the instrument first).
const lum = (hex: string) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('the contrast ruler', () => {
  it('reads the two pairs whose answers are known', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(ratio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});

describe('the paper skin', () => {
  const STOCKS = ['--background', '--card', '--popover', '--muted'];

  it('overrides every semantic token a screen palette would otherwise supply', () => {
    // If paper forgets one, that surface keeps the DEFAULT skin's value — a grey-blue card on a
    // sheet of paper, which is exactly the "five spellings" failure one layer up.
    const REQUIRED = [
      '--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground',
      '--primary', '--primary-foreground', '--primary-solid', '--primary-solid-foreground',
      '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
      '--accent-surface', '--accent-surface-foreground', '--border', '--border-control', '--input', '--ring',
      '--destructive', '--sidebar', '--sidebar-foreground', '--sidebar-border', '--sidebar-accent',
    ];
    expect(REQUIRED.filter((t) => value(t) === undefined)).toEqual([]);
  });

  it('carries its ink on every stock', () => {
    const ink = value('--foreground')!;
    const quiet = value('--muted-foreground')!;
    for (const stock of STOCKS) {
      expect(ratio(ink, value(stock)!), `${ink} on ${stock}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(quiet, value(stock)!), `secondary ink on ${stock}`).toBeGreaterThanOrEqual(4.5);
    }
    // A control's edge IS the control (edge tiers: 3:1, no exception).
    for (const stock of STOCKS) {
      expect(ratio(value('--border-control')!, value(stock)!), `control edge on ${stock}`).toBeGreaterThanOrEqual(3);
    }
    // And the structural rule is DRAWN, not implied — the whole reason the skin reads as print.
    expect(ratio(value('--border')!, value('--card')!)).toBeGreaterThanOrEqual(1.5);
  });

  it('lies ON something: a sheet has thickness, and its shadow is ink', () => {
    // REVISED 2026-09-24. The first model was a SCAN — flat, shadowless, because a scanner
    // presses the depth out of paper. The user asked for the other thing ("authentic analog
    // paper"), which is a sheet on a desk: it has a cut edge that catches light, light that falls
    // off towards its border, and a short contact shadow. What must NEVER come back is the web
    // drop shadow — a big soft black cloud that makes paper look like a floating div.
    const shadows = [...block.matchAll(/^\s*(--shadow-[a-z0-9-]+):\s*([^;]+);/gm)];
    expect(shadows.length).toBeGreaterThanOrEqual(8);
    for (const [, name, v] of shadows) {
      const ok = v === 'none' || /^0 0 0 1px var\(--border(-control)?\)$/.test(v) || /var\(--paper-(sheet|contact)\)/.test(v);
      expect(ok, `${name}: ${v}`).toBe(true);
    }
    // The contact shadow is INK at a few pixels — the colour of the light that made it, and the
    // distance a sheet actually sits above a desk. Never black, never a 24px cloud.
    const contact = value('--paper-contact')!;
    // DERIVED from the ink, not pinned to a triple: this used to spell `rgb(36 34 28 …)` and so
    // it failed the next time the palette was retuned — a test that guards a hex rather than the
    // rule it stands for. The rule is that a shadow on paper is the colour of the light that made
    // it, which is the ink, so the ink is where the expectation comes from.
    const inkRgb = [1, 3, 5].map((i) => parseInt(value('--foreground')!.slice(i, i + 2), 16)).join(' ');
    expect(contact).toContain(`rgb(${inkRgb} /`);
    expect(contact).not.toMatch(/rgba?\(0[ ,]/);
    for (const blur of contact.matchAll(/(\d+)px/g)) expect(Number(blur[1]), `blur ${blur[1]}px`).toBeLessThanOrEqual(6);
    // And the cut edge is light, not another rule.
    expect(value('--paper-cut-edge')).toMatch(/^inset 0 1px 0 0 rgb\(255 255 255 \/ 0\.\d+\)$/);
  });

  it('separates the sheet from the desk enough to be an OBJECT', () => {
    // The measurement that made this skin stop looking like a beige app: the desk was 1.17:1
    // against the sheet, so nothing was lying on anything. Paper on a desk sits at ~1.4–1.6:1.
    const desk = value('--background')!;
    const sheet = value('--card')!;
    expect(ratio(sheet, desk), `sheet ${sheet} on desk ${desk}`).toBeGreaterThanOrEqual(1.35);
    // …without the desk becoming so dark that the few things sitting directly on it suffer.
    expect(ratio(value('--foreground')!, desk)).toBeGreaterThanOrEqual(4.5);
  });

  it('rules the desk and lays the sheet', () => {
    // Engineering paper under the work (the references), and the mould's laid lines in the stock.
    expect(css).toMatch(/repeating-linear-gradient\(to right, var\(--paper-rule\)/);
    expect(css).toMatch(/repeating-linear-gradient\(to bottom, var\(--paper-rule\)/);
    expect(value('--paper-laid')).toBeTruthy();
    // The ruling is the DESK's: a grid running under text is a spreadsheet, not a sheet.
    const sheetRule = css.slice(css.indexOf('html[data-skin=\'paper\'] :where('), css.indexOf('/* A wash (hover'));
    expect(sheetRule).not.toMatch(/--paper-rule/);
  });

  it('changes materials, never layout', () => {
    // A skin decides what things are MADE OF; the shell decides where they are. A block here once
    // made the content pane a sheet with a desk margin around it, and on a wide screen it left the
    // work stranded inside its own reading column — "I don't want this much gap … keep app shell
    // same" (user, 2026-09-24). The app shell is identical in both skins.
    expect(css).not.toMatch(/data-view-shell/);
    const layout = /(^|[^-])\b(padding|margin|max-width|width|height|gap|grid-template|flex-basis)\s*:/gm;
    const offenders = [...css.matchAll(layout)]
      .map((m) => m[2])
      // The two that are not layout: a stamp's inline padding, and the laid-line geometry.
      .filter((prop) => !['padding-inline'].includes(prop));
    expect(offenders, `the skin sets layout: ${offenders.join(', ')}`).toEqual([]);
  });

  it('speaks in print: a book serif for words, a typewriter for data', () => {
    // Geist is a screen grotesk — drawn for pixels. Paper has two voices and neither is that.
    // Source Serif 4 is already loaded by the app, so the voice costs nothing to ship.
    // (The voice lives in its own skin block, further down the file than the token block.)
    expect(css).toMatch(/--font-sans: var\(--font-serif\);/);
    expect(css).toMatch(/--font-ui: var\(--font-serif\);/);
    // Two references, both honoured: the FORM sets its furniture on a typewriter's grid, the
    // BOOK sets its running text in a serif you read for an hour. Mono everywhere would have
    // been faithful to the invoice and unreadable as Kindle.
    expect(css).toMatch(/--font-body: var\(--font-serif\);/);
    expect(css).toMatch(/th \{[^}]*font-family: var\(--font-mono\)/);
    expect(css).toMatch(/th \{[^}]*text-transform: uppercase/);
    expect(css).toMatch(/\[data-slot='button'\] \{[^}]*font-family: var\(--font-mono\)/);
    // …and the figures, labels and IDs stay on the grid.
    expect(css).toMatch(/\.text-overline \{[^}]*font-family: var\(--font-mono\)/);
    expect(css).toMatch(/:where\(\.tabular-nums, \[data-numeric\]\) \{[^}]*font-family: var\(--font-mono\)/);
  });

  it('squares its corners but keeps the pill', () => {
    for (const r of ['--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-panel']) {
      expect(parseFloat(value(r)!), r).toBeLessThanOrEqual(4);
    }
    expect(block).not.toMatch(/--radius-pill/);
  });

  it('draws its grain inline — a theme never waits on a network request', () => {
    for (const layer of ['--paper-tooth', '--paper-fibre']) {
      expect(value(layer), layer).toMatch(/^url\("data:image\/svg\+xml,/);
      expect(value(layer), layer).toContain('feTurbulence');
      expect(value(layer), layer).toContain('stitchTiles');
    }
    // Multiplied into the stock, not laid over it: a wash on top only greys the page. The list
    // names every layer now (ruling and laid lines print NORMALLY over stock that is multiplied),
    // so what is asserted is that the stock's own blend is still the last word.
    expect(css).toMatch(/background-blend-mode:[^;]*var\(--paper-blend\);/);
    // And a hover wash never blinks the material off: it stacks ABOVE the laid lines and the
    // stock, which are still underneath it.
    const wash = css.slice(css.indexOf('html[data-skin=\'paper\'] .hover\\:wash-over:hover'));
    expect(wash.slice(0, 400)).toMatch(/linear-gradient\(var\(--color-surface-hover\), var\(--color-surface-hover\)\)/);
    expect(wash.slice(0, 400)).toMatch(/var\(--paper-laid\)/);
    expect(wash.slice(0, 400)).toMatch(/var\(--paper-stock\)/);
  });

  it('prints its controls instead of drawing web ones', () => {
    // The last tell was the controls: a checkbox that fills solid with the accent, a pill badge,
    // a segmented control with a sliding thumb. None of those exist on paper.
    const printed = css.slice(css.indexOf('── PRINTED OBJECTS'));
    // The box is printed and the tick is ink — never a filled block.
    expect(printed).toMatch(/\[data-slot='checkbox'\]\[data-state='checked'\] \{[^}]*background: transparent;/);
    expect(printed).toMatch(/\[data-slot='checkbox'\]\[data-state='checked'\] \{[^}]*color: var\(--foreground\);/);
    // A stamp: boxed in its own ink, set in capitals, no fill.
    expect(printed).toMatch(/\[data-slot='badge'\] \{[^}]*background: transparent;/);
    expect(printed).toMatch(/\[data-slot='badge'\] \{[^}]*border-color: currentColor;/);
    expect(printed).toMatch(/\[data-slot='badge'\] \{[^}]*text-transform: uppercase;/);
    // Ruled cells with the chosen one inked; the thumb has nothing to do on a form.
    expect(printed).toMatch(/\[data-slot='segmented-thumb'\] \{ display: none; \}/);
    expect(printed).toMatch(/\[data-slot='segmented-item'\]\[data-state='checked'\] \{[^}]*background: var\(--foreground\);/);
  });

  it('reaches every control through the design system’s own slots', () => {
    // No component may branch on the skin (CLAUDE.md): the skin aims at `data-slot`, and the two
    // components that had none were given one rather than taught about paper.
    for (const slot of ['checkbox', 'badge', 'segmented', 'segmented-item', 'segmented-thumb']) {
      expect(css, slot).toContain(`data-slot='${slot}'`);
    }
    expect(readFileSync('components/ds/ui/badge.tsx', 'utf8')).toContain('data-slot="badge"');
    expect(readFileSync('components/ds/ui/segmented.tsx', 'utf8')).toContain('data-slot="segmented-item"');
  });

  it('prints in two colours: one ink, one stock, and the steps between', () => {
    // User, 2026-09-24, with a letterpress invoice: "same to same … only 2 colours and textures".
    // A one-ink press cannot say "paid" in green, so the status ramps resolve to ink and stock
    // here and the difference is carried by FORM — the stamp and the hatch.
    //
    // "Two colours" is measurable, and this is the measurement: every value in the skin sits on
    // ONE hue, sampled at many lightnesses. A stray blue-grey or a stamp red widens the band and
    // fails here, which is the only way this rule survives the next person adding a token.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');   // the history in the comments is not paint
    const hexes = [...new Set(bare.match(/#[0-9A-Fa-f]{6}/g) ?? [])];
    expect(hexes.length, 'the skin declares its colours as hex').toBeGreaterThan(6);
    const hues: number[] = [];
    for (const h of hexes) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      // 0.12 is not a taste: the widest step in this skin measures 0.106 (the decorative rule),
      // and the stamp red that USED to live here measures 0.48. Anything with an actual hue in it
      // lands four times above this line, so the cap separates "a step between ink and stock"
      // from "a second colour" without pretending the steps are perfectly neutral.
      expect(max - min, `${h} carries chroma`).toBeLessThanOrEqual(0.12);
      // Hue of a near-neutral is still well defined; a red stamp lands at ~15, a blue at ~220.
      const d = max - min;
      const hue = d === 0 ? 45
        : max === r ? ((g - b) / d + 6) % 6 * 60
        : max === g ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
      hues.push(hue);
    }
    expect(Math.max(...hues) - Math.min(...hues), `hues: ${hues.map((h) => h.toFixed(0)).join(', ')}`)
      .toBeLessThanOrEqual(12);
    // And the ramps that carry hue in the default skin are ink here, not a paper-tinted green.
    for (const ramp of ['success', 'warning', 'info', 'danger']) {
      expect(block, ramp).toMatch(new RegExp(`--color-${ramp}-600: var\\(--foreground\\);`));
    }
    expect(value('--destructive')).toBe('var(--foreground)');
    // Which leaves danger with no hue — so it must be told apart by FORM, or not at all.
    expect(css).toMatch(/\[data-variant='danger'\] \{[^}]*background-image: var\(--paper-hatch\)/);
  });

  it('presses the ink into the sheet, not just the stock under it', () => {
    // The tell that survived every palette pass: the STOCK had tooth and the INK did not. Grain
    // drawn as a background sits UNDER the type, so glyphs and rules stayed digitally perfect on
    // a textured sheet — laser-printed, not pressed. One multiplied overlay puts every letter,
    // rule and stamp under the same tooth.
    const press = css.slice(css.indexOf('html[data-skin=\'paper\'] body::after'));
    expect(press).toMatch(/mix-blend-mode: multiply;/);       // ink can only darken
    expect(press).toMatch(/position: fixed;/);                // texture is the sheet's, not the content's
    expect(press).toMatch(/pointer-events: none;/);           // it must never eat a click
    expect(press).toMatch(/z-index: var\(--z-focus-edge\);/); // from the registry, never a number
    expect(value('--paper-press'), 'the press is inline, like the rest of the grain')
      .toMatch(/^url\("data:image\/svg\+xml,/);
    // Shallow on purpose: the deepest speckle takes about a tenth of a stop, so 13px type stays
    // 13px type. A slope over ~0.2 here is a dirty page, not a printed one.
    expect(parseFloat(/slope='([\d.]+)'/.exec(value('--paper-press')!)![1])).toBeLessThanOrEqual(0.2);
  });

  it('leaves a blank where the web sweeps', () => {
    // User, 2026-09-24: "those loaders look more modern … I want a book experience like Kindle".
    // A shimmer is a gradient sweeping across a surface: it depicts no physical event, it exists
    // only in web software, and it played on every navigation. Paper's answer is much older and
    // the reference is covered in it — a blank ruled cell.
    const loader = css.slice(css.indexOf('── A LOADER IS A BLANK'));
    expect(loader).toMatch(/\[data-slot='skeleton-sweep'\] \{ display: none; \}/);
    expect(loader).toMatch(/\[data-shape='line'\] \{[^}]*box-shadow: inset 0 -1px 0 0 var\(--border-control\)/);
    expect(loader).toMatch(/\[data-slot='skeleton'\] \{[^}]*background-color: transparent;/);
    // Nothing sweeps AND nothing pulses: the arrival of the real content is the feedback, which
    // is also the frequency rule — a thing seen on every navigation earns no animation.
    expect(loader).not.toMatch(/animation:/);

    // The skin reaches it through the design system's own marks, and the component was given
    // them rather than taught about paper.
    const skeleton = readFileSync('components/ds/ui/skeleton.tsx', 'utf8');
    expect(skeleton).toContain('data-slot="skeleton"');
    expect(skeleton).toContain('data-shape={shape}');
    expect(skeleton).toContain('data-slot="skeleton-sweep"');
    expect(readFileSync('components/ds/ui/button.tsx', 'utf8')).toContain('data-slot="button"');
  });

  it('touches nothing outside itself', () => {
    // Every rule in this file is scoped to the skin; the default skin cannot be changed from here.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...bare.matchAll(/(^|\})\s*([^{}]+?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(4);
    for (const sel of selectors) {
      // A `:where(...)` list carries its own commas — flatten it before splitting the group.
      for (const one of sel.replace(/:where\([^)]*\)/g, ':where()').split(',')) {
        expect(one.trim(), one).toMatch(/^html\[data-skin='paper'\]/);
      }
    }
  });
});

describe('the skin axis', () => {
  const theme = readFileSync('lib/theme.ts', 'utf8');

  it('is separate from light and dark, and paper resolves light', () => {
    expect(theme).toMatch(/export type Skin = 'default' \| 'paper';/);
    expect(theme).toMatch(/const next = nextSkin === 'paper' \? 'light' : resolveTheme\(theme\);/);
    // The boot script stamps it before first paint, or the app flashes the wrong material.
    expect(theme).toMatch(/d\.setAttribute\('data-skin',skin\)/);
    expect(theme).toMatch(/var resolved=skin==='paper'\?'light':/);
  });

  it('never switches paper off behind a caller’s back', () => {
    // Three callers predate the axis and pass three arguments; defaulting the fourth would
    // silently reset the skin every time the OS flipped.
    expect(theme).toMatch(/const nextSkin = skin \?\? readAppearance\(\)\.skin;/);
  });

  it('holds transitions across a skin flip, as it does for light/dark', () => {
    expect(theme).toMatch(/\(wasSkin !== null && wasSkin !== nextSkin\)/);
  });
});
