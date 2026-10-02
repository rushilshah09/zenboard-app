import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
// Zenboard's colour is layered: shadcn owns the SOLID values (theme-shadcn.css)
// and tokens-light.css BRIDGES them onto the ~30 legacy primitives the app has
// always read. A bridge has one characteristic failure — a token nobody
// remembered to carry across keeps whatever the legacy dark left it on, tsc
// stays green, every test passes, and the theme is simply wrong on screen.
//
// It has now happened twice, both times measured in the browser, not caught by
// review:
//
//   1. The state surfaces (hover/active/selected/fill/row/disabled) were pinned
//      to one SOLID tone. A solid cannot be right on three different grounds,
//      so hover came out darker than the popover it sat in — and because
//      `.zb-press::after` paints its wash over the row, an opaque value ERASED
//      the icon and the label. The user hit it on the account menu.
//   2. `--line` and `--border` were bridged; `--color-border-soft` / `-strong`
//      / `-panel` / `-focus` were not. They stayed warm white-alpha, which on a
//      white page measured 1.009:1 (212 usages — every divider), 1.017:1 (88
//      usages — every popover border) and 1.052:1 for the FOCUS RING. That was
//      the real reason light "looked flat", far more than the surfaces were.
//
// So these are not style assertions. Each one is a bug that shipped.

const bridge = readFileSync('app/tokens-light.css', 'utf8');
const shadcn = readFileSync('app/theme-shadcn.css', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');

/** The body of the rule whose selector list is EXACTLY `selector`.
 *
 * Matching on the bare string is not enough: the bridge opens with a SHARED
 * rule, `html[data-theme='light'], html[data-theme='dark'] {`, so a plain
 * indexOf for the dark selector lands on that list instead of the standalone
 * dark rule — and then every "is this declared in dark?" assertion is asking
 * the wrong block and passing or failing for the wrong reason. Anchor on the
 * end of the previous rule so a selector inside a comma list can't match. */
function block(css: string, selector: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp(`(?:^|\\})\\s*${selector.replace(/[[\]']/g, '\\$&')}\\s*\\{`);
  const m = bare.match(re);
  expect(m, `no standalone rule for ${selector}`).not.toBeNull();
  const open = bare.indexOf('{', m!.index! + m![0].length - 1);
  const close = bare.indexOf('\n}', open);
  return bare.slice(open, close);
}

const LIGHT = block(bridge, "html[data-theme='light']");
const DARK = block(bridge, "html[data-theme='dark']");

describe('theme bridge — every token crosses in BOTH directions', () => {
  // A token that only one theme declares is the bug, whichever theme it is:
  // the other one silently inherits the legacy dark.
  const PER_THEME = [
    '--color-border-soft',
    '--color-border-strong',
    '--color-border-panel',
    '--color-border-focus',
    '--wash-1',
    '--wash-2',
    '--wash-3',
    '--wash-row',
    '--wash-fill',
    '--wash-fill-hover',
    '--color-paper-4',
    '--color-paper-5',
  ];

  it.each(PER_THEME)('%s is declared in light AND dark', (token) => {
    expect(LIGHT, `${token} missing from the light theme`).toContain(`${token}:`);
    expect(DARK, `${token} missing from the dark theme`).toContain(`${token}:`);
  });

  it('no theme block carries the other one\'s ink', () => {
    // The legacy dark's ink is the warm 242 241 235; light's is black. Either
    // appearing in the wrong block is the exact shape of failure #2.
    expect(LIGHT).not.toMatch(/rgba?\(\s*2(4[0-9]|5[0-5])[\s,]/);
    expect(DARK).not.toMatch(/rgba?\(\s*0[\s,]+0[\s,]+0[\s,]/);
  });
});

describe('state is relative, elevation is solid', () => {
  // The distinction that failure #1 collapsed. A hover lands on the sidebar,
  // on a card header band and inside a floating menu — three grounds — so it
  // has to composite. An elevation is one specific tone and must not.
  const STATE = [
    '--color-surface-hover',
    '--color-surface-active',
    '--color-surface-selected',
    '--color-surface-disabled',
    '--color-surface-fill',
    '--color-surface-fill-hover',
    '--color-surface-row',
  ];

  it.each(STATE)('%s resolves to a wash, not a surface', (token) => {
    const line = bridge.split('\n').find((l) => l.trim().startsWith(`${token}:`));
    expect(line, `${token} is not mapped in the bridge`).toBeDefined();
    expect(line).toMatch(/var\(--wash-/);
  });

  it.each(['--wash-1', '--wash-2', '--wash-3', '--wash-row', '--wash-fill', '--wash-fill-hover'])(
    '%s is translucent in both themes',
    (token) => {
      for (const [name, body] of [['light', LIGHT], ['dark', DARK]] as const) {
        const line = body.split('\n').find((l) => l.trim().startsWith(`${token}:`))!;
        // A wash with no alpha is a solid wearing a wash's name — the failure.
        // TWO spellings are translucent and both are correct: an explicit alpha
        // (`rgb(255 255 255 / 0.07)`, which dark uses) and a mix toward
        // `transparent` (light mixes from `--foreground` so the wash carries the
        // paper's warmth rather than greying it). Assert the PROPERTY, not the
        // syntax — the first version of this test asserted the syntax and failed
        // the moment light moved to the better spelling.
        const hasAlpha = /\/\s*0?\.\d+\s*\)/.test(line);
        const mixesToTransparent = /color-mix\([^;]*\btransparent\b/.test(line);
        expect(hasAlpha || mixesToTransparent, `${token} is opaque in ${name}: ${line.trim()}`).toBe(true);
      }
    },
  );
});

describe('the press wash paints behind the label', () => {
  // `.zb-press::after` is a POSITIONED child, so with no z-index it paints over
  // the button's own inline content. That was survivable only while the wash
  // was translucent; the moment it went solid it wiped the row.
  it('.zb-press isolates and its overlay sits at z-index -1', () => {
    expect(globals).toMatch(/\.zb-press\s*\{[^}]*isolation:\s*isolate/);
    expect(globals).toMatch(/\.zb-press::after\s*\{[^}]*z-index:\s*-1/);
  });

  it('no press token is a bare white literal', () => {
    // `--hover-strong` was `rgba(255,255,255,0.11)` in :root — invisible on a
    // white page, and light had no way to override a literal it never saw.
    const line = globals.split('\n').find((l) => l.trim().startsWith('--hover-strong:'))!;
    expect(line).toMatch(/var\(--/);
  });
});

describe('the dark elevation ladder ascends', () => {
  // A popover is the MOST raised surface in the app. It shipped BELOW the card
  // header band because the two were tuned independently: popover 0.232 under
  // muted 0.262. Read the numbers back and make the ordering a rule.
  const darkBlock = block(shadcn, "html[data-theme='dark']");
  const L = (token: string) => {
    const m = darkBlock.match(new RegExp(`${token}:\\s*oklch\\(([0-9.]+)`));
    expect(m, `${token} is not a plain oklch lightness in dark`).not.toBeNull();
    return Number(m![1]);
  };

  it('page < card < band < popover', () => {
    const ladder = ['--background', '--card', '--muted', '--popover'].map((t) => [t, L(t)] as const);
    for (let i = 1; i < ladder.length; i++) {
      expect(
        ladder[i][1],
        `${ladder[i][0]} (${ladder[i][1]}) must sit above ${ladder[i - 1][0]} (${ladder[i - 1][1]})`,
      ).toBeGreaterThan(ladder[i - 1][1]);
    }
  });

  it('every step is big enough to see', () => {
    // The user's words were "all looks flat". Steps below ~0.04 in oklch L are
    // what that felt like; the shipped ladder steps 0.031 · 0.045 · 0.032.
    const steps = ['--background', '--card', '--muted', '--popover'].map(L);
    for (let i = 1; i < steps.length; i++) {
      // 0.030 is Notion's OWN page->card step (#191919 L=0.213 -> #202020 L=0.244),
      // measured. It was 0.04, an earlier in-house heuristic — but the user asked
      // for Notion's colours and Notion ships 0.030 without reading flat, because
      // dark separates with a border as well as with luminance. The page and card
      // are Notion's values exactly; the steps ABOVE the card are opened wider
      // (0.046, 0.032) because Zenboard stacks more layers than Notion does and
      // the user called dark "flat" twice when they collapsed.
      expect(steps[i] - steps[i - 1], `step ${i} is too tight`).toBeGreaterThanOrEqual(0.030);
    }
  });
});

describe('no surface token is a dark literal that light never sees', () => {
  // The general form of the bug, caught three times by SCREENSHOT and never by
  // a test: `--well: #0D0D0D`, `--gray-bg: #2A2825`, `--color-border-soft:
  // rgb(242 241 235 / 0.08)`. Each is a raw literal in a :root tuned for dark,
  // each is read by light, and each rendered a dark slab in a white app — the
  // Documents gallery came out BLACK behind white cards.
  //
  // The rule is not "no literals". A literal is fine as the dark half of a
  // pair; what is not fine is a literal with no light counterpart. So: any
  // token whose NAME says it is a surface, declared as a colour literal, must
  // also be declared in the bridge.
  const SURFACE = /^--(.*(bg|well|paper|canvas|surface|panel|fill|track)|well|well-2)$/;
  const LITERAL = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\()/;
  const SOURCES = ['app/globals.css', 'app/tokens.css', 'app/tokens.generated.css'];

  it.each(SOURCES)('%s declares no unbridged surface literal', (file) => {
    const unbridged: string[] = [];
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+?);/);
      if (!m) return;
      const [, name, value] = m;
      if (!SURFACE.test(name) || !LITERAL.test(value)) return;
      if (!bridge.includes(`${name}:`)) unbridged.push(`${file}:${i + 1} ${name}: ${value}`);
    });
    expect(unbridged, `bridge these in app/tokens-light.css:\n${unbridged.join('\n')}`).toEqual([]);
  });
});

describe('the ten-colour data palette crosses', () => {
  // 30 tokens (dot · chip fill · chip text) that lived in tokens.css for dark
  // only. In light they painted a near-black card onto a white calendar grid.
  const HUES = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

  it.each(HUES)('--%s-{dot,bg,text} is declared in both themes', (hue) => {
    for (const part of ['dot', 'bg', 'text']) {
      const token = `--${hue}-${part}:`;
      expect(LIGHT, `${token} missing from light`).toContain(token);
      expect(DARK, `${token} missing from dark`).toContain(token);
    }
  });

  it('light chip text clears AA on its own chip fill', () => {
    // A pale fill with a mid-tone text is the classic way this family gets
    // shipped "looking fine" and failing to read.
    const hex = (block: string, token: string) => {
      const m = block.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m, `${token} is not a plain hex in light`).not.toBeNull();
      return m![1];
    };
    const lum = (h: string) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const hue of HUES) {
      const bg = lum(hex(LIGHT, `--${hue}-bg`)) + 0.05;
      const fg = lum(hex(LIGHT, `--${hue}-text`)) + 0.05;
      const ratio = Math.max(bg, fg) / Math.min(bg, fg);
      expect(ratio, `--${hue}-text on --${hue}-bg is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the ink ramp', () => {
  // Two bugs, one cause: the ramp mixed its top four steps from `--foreground`
  // and its bottom three from `--muted-foreground`. Those two anchors do not
  // sit at the same relative place in the two themes, so in DARK the ramp
  // INVERTED — ink-600 measured 5.85:1 against a card while ink-500 measured
  // 7.13:1, making the "stronger" token the fainter one. And ink-400, which 99
  // call sites were using via `text-ink-400`, measured 2.88:1 in light and
  // 3.51:1 in dark: below the 4.5:1 floor for body text in BOTH themes.
  const STEPS = ['900', '800', '700', '600', '500', '400', '300', '200'];

  // THREE TEXT LEVELS (2026-10-02). The ramp had five text steps inside 0.17 of lightness — #37352F,
  // #44423C, #52504A, #5B5953, #64625C — and they were used interchangeably, so one screen painted
  // six greys of text with no hierarchy anyone could name. Now: primary (900, with 800 as its
  // ALIAS — titles and body share an ink, size and weight separate them), secondary (700, with 600
  // as its alias), tertiary (500). Below that, tints that never carry a sentence.
  const ALIAS: Record<string, string> = { '800': '900', '600': '700' };
  const LEVELS = ['700', '500', '400', '300', '200'];
  const lineOf = (step: string) => bridge.split('\n').find((l) => l.trim().startsWith(`--color-ink-${step}:`))!;
  /** The percentage a step resolves to, following its alias (900 is the ink itself, 100%). */
  const pctOf = (step: string): number => {
    if (step === '900') return 100;
    if (ALIAS[step]) return pctOf(ALIAS[step]);
    return Number(lineOf(step).match(/var\(--foreground\) (\d+)%/)![1]);
  };

  it('is one derived family, so monotonicity is structural', () => {
    // Every LEVEL below primary mixes the SAME anchor. A second anchor is what let
    // the order invert without anything failing.
    for (const step of LEVELS) {
      expect(lineOf(step), `ink-${step} is not derived from --foreground`).toMatch(
        /color-mix\(in oklab, var\(--foreground\) \d+%, var\(--background\)\)/,
      );
    }
    // An alias says which level it IS — never a near-copy of it.
    for (const [step, level] of Object.entries(ALIAS)) {
      expect(lineOf(step), `ink-${step} is an alias of ink-${level}`).toMatch(new RegExp(`var\\(--color-ink-${level}\\)`));
    }
  });

  it('mixes descending percentages, with gaps a reader can see', () => {
    const pct = LEVELS.map(pctOf);
    for (let i = 1; i < pct.length; i++) {
      expect(pct[i], `ink-${LEVELS[i]} is not below ink-${LEVELS[i - 1]}`).toBeLessThan(pct[i - 1]);
    }
    // The three TEXT levels are evenly and visibly spaced (primary 100 → secondary → tertiary).
    expect(100 - pctOf('700'), 'secondary sits a visible step under primary').toBeGreaterThanOrEqual(10);
    expect(pctOf('700') - pctOf('500'), 'tertiary sits a visible step under secondary').toBeGreaterThanOrEqual(10);
  });

  it('every TEXT step actually clears AA, in both themes, on card AND band', () => {
    // THE GAP THIS CLOSES. The two tests above check the ramp's FORM — derived
    // from one anchor, descending percentages — and both stayed green while the
    // ramp silently stopped clearing AA. The percentages are RELATIVE, so when
    // the palette moved to Notion's softer ink (#37352F, oklch L 0.329, against
    // the #0A0A0A it replaced at L 0.145) every derived step rescaled with it:
    // ink-500 landed at 3.31:1 on a band, ink-600 at 3.86:1, and the comment in
    // tokens-light.css still asserted in prose that they cleared AA.
    //
    // A derived ramp's guarantees live in its ANCHORS, not in its formula. So
    // this resolves the mix for real — oklch anchors -> oklab -> sRGB -> WCAG —
    // instead of trusting the shape of the declaration.
    const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const linToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
    const oklchToOklab = (L: number, C: number, H: number) =>
      [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)] as const;
    const oklabToLinRgb = ([L, A, B]: readonly number[]) => {
      const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
      const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
      const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
      return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      ];
    };
    const relLum = (lin: number[]) =>
      0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    // Clamp through sRGB the way a browser does before compositing.
    const lumOfOklab = (lab: readonly number[]) =>
      relLum(oklabToLinRgb(lab).map((c) => srgbToLin(Math.min(1, Math.max(0, linToSrgb(c))))));
    const contrast = (a: number, b: number) =>
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    /** Read an oklch token out of a theme block as oklab. */
    const anchorOf = (body: string, token: string) => {
      const m = body.match(new RegExp(`${token}:\\s*oklch\\(([\\d.]+)(?:\\s+([\\d.]+))?(?:\\s+([\\d.]+))?`));
      expect(m, `${token} is not an oklch value`).not.toBeNull();
      return oklchToOklab(Number(m![1]), Number(m![2] ?? 0), Number(m![3] ?? 0));
    };

    const LIGHT_BLOCK = shadcn.split(/\n\s*html\[data-theme='dark'\]\s*\{/)[0];
    const DARK_BLOCK = shadcn.slice(shadcn.search(/html\[data-theme='dark'\]\s*\{/));
    const TEXT_STEPS = [900, 800, 700, 600, 500];

    for (const [themeName, body] of [['light', LIGHT_BLOCK], ['dark', DARK_BLOCK]] as const) {
      const fg = anchorOf(body, '--foreground');
      const bg = anchorOf(body, '--background');
      // EVERY ground text lands on — not just the common ones. The first
      // version of this test checked card+band only and went green while the
      // popover and the inner raised card were still failing (ink-600 measured
      // 2.53:1 on paper-4, 32 elements on Home). A ramp has to be solved
      // against the LIGHTEST ground it ever meets.
      // 400 and below are excluded on purpose — they are tints (rules,
      // disabled glyphs, toggle tracks) and never carry a sentence.
      const grounds: Record<string, readonly number[]> = {
        card: anchorOf(body, '--card'),
        band: anchorOf(body, '--muted'),
        popover: anchorOf(body, '--popover'),
      };
      // The inner raised card is a legacy primitive, so it is declared in the
      // bridge rather than here — and in dark it is a literal.
      const paper4 = (themeName === 'dark' ? bridge.slice(bridge.search(/html\[data-theme='dark'\]/)) : '')
        .match(/--color-paper-4:\s*oklch\(([\d.]+)(?:\s+([\d.]+))?(?:\s+([\d.]+))?/);
      if (paper4) {
        grounds['inner-raised'] = oklchToOklab(Number(paper4[1]), Number(paper4[2] ?? 0), Number(paper4[3] ?? 0));
      }
      for (const step of TEXT_STEPS) {
        const pct = pctOf(String(step));
        const p = pct / 100;
        const ink = fg.map((v, i) => v * p + bg[i] * (1 - p));
        const inkLum = lumOfOklab(ink);
        for (const [groundName, ground] of Object.entries(grounds)) {
          const ratio = contrast(inkLum, lumOfOklab(ground));
          expect(
            Number(ratio.toFixed(2)),
            `${themeName} ink-${step} (${pct}%) on the ${groundName} is ${ratio.toFixed(2)}:1 — text must clear 4.5:1`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('text on a translucent FILL uses a step that survives the fill', () => {
    // `bg-surface-fill` is a wash (white 12% in dark), and a wash LIGHTENS the
    // ground it sits on — so the ink that clears AA on a card does not
    // necessarily clear it on the same card once a chip is painted over it.
    // Measured in dark: the fill over the lightest surface composites to
    // #4B4B4B, where ink-500/600/700 land at 3.26 / 3.67 / 4.11:1 and only
    // ink-800 (4.95:1) and ink-900 clear.
    //
    // `Button` already used ink-800 and passed. Two tag chips used ink-600 and
    // did not — the SAME five-class string duplicated in two files, which is
    // why fixing one screen would have left the other wrong.
    const files = [
      'components/ui/panels.tsx',
      'components/ds/ui/priority.tsx',
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // Any line that paints on the fill must not carry a weak ink step.
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!/text-ink-(400|500|600|700)\b/.test(line)) return;
        // look back a few lines for the fill that this text sits inside
        const context = lines.slice(Math.max(0, i - 6), i + 1).join(' ');
        if (!/bg-surface-fill/.test(context)) return;
        expect(
          line.trim(),
          `${file}:${i + 1} paints text on bg-surface-fill with a step that fails AA over the wash — use text-ink-800`,
        ).not.toMatch(/text-ink-(400|500|600|700)\b/);
      });
    }
  });

  it('no component paints text with a tint token', () => {
    // ink-500 is the FAINTEST step that is text. 400 and below are tints —
    // rules, toggle tracks, disabled glyphs. `text-ink-300` survives here on
    // purpose: its remaining uses are `disabled:` states and `aria-hidden`
    // separators, both of which WCAG exempts. `text-ink-400` had no such
    // excuse — it was ordinary copy, 99 times.
    const offenders: string[] = [];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...walk(path));
        else if (/\.tsx$/.test(path)) out.push(path);
      }
      return out;
    };
    for (const file of [...walk('components'), ...walk('app')]) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        if (/\btext-ink-(400|200|100)\b/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `use text-ink-500 (the faintest AA-passing step):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no INLINE style paints text with a tint token either', () => {
    // The class guard above cannot see `style={{ color: 'var(--color-ink-300)' }}`
    // — and that is exactly how the sidebar's "Pinned" heading shipped: 1.75:1
    // on the dark rail, 1.90:1 on the light one, found by the two-theme sweep
    // (2026-09-11), not by this file. `--ink-5` is the legacy name for the same
    // 42% tint (measured 2.01–2.80 on every ground in both themes).
    const offenders: string[] = [];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...walk(path));
        else if (/\.tsx$/.test(path)) out.push(path);
      }
      return out;
    };
    for (const file of [...walk('components'), ...walk('app')]) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        // `color:` only — `backgroundColor` / `borderColor` are capitalised, and
        // a tint is exactly right for a rule or a track.
        if (/\bcolor:\s*['"`]var\(--(color-ink-(100|200|300|400)|ink-5)\)/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `text in a tint token — use var(--color-ink-500) or darker:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// ── THE EDGE TIERS ─────────────────────────────────────────────────────────
//
// Measured 2026-09-08, in the browser, on the real pages: an unchecked
// checkbox came out at 1.07:1 in light and 1.3:1 in dark, a text field's edge
// at 1.13:1, and a switch's off track at 1.1:1. Three different controls, one
// cause — a divider and a control boundary were drawn with the SAME token, and
// they are not the same job.
//
// Three tiers now, each with a bar:
//   decorative  --border / -soft      cards, dividers. Subtle on purpose.
//   field       --color-border-strong an input, a select, a popover edge. The
//                                     control also has a label and a value, so
//                                     the edge is an affordance, not the sole
//                                     identifier; every reference product ships
//                                     these under 3:1. Bar: 1.6:1.
//   control     --color-border-control a checkbox, radio, switch track, slider
//                                     thumb. No text inside the shape, so an
//                                     invisible edge IS an invisible control.
//                                     Bar: 3:1 (WCAG 1.4.11).
//
// A fourth tier is declared in code rather than CSS: `data-chromeless` on an
// editor that deliberately has no box (a doc title, a composer row). See
// `inlineEdit` in components/ds/ui/input.tsx.
describe('the edge tiers', () => {
  const SH_LIGHT = block(shadcn, ':root');
  const SH_DARK = block(shadcn, "html[data-theme='dark']");

  const decl = (b: string, name: string) => {
    const m = b.match(new RegExp(`--${name}:\\s*([^;]+);`));
    return m ? m[1].trim() : null;
  };

  // oklch -> sRGB -> WCAG relative luminance. Same chain the ink-ramp test
  // uses; a bar you assert in prose is a bar nobody is keeping.
  const linToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const oklchToRgb = (L: number, C: number, H: number) => {
    const A = C * Math.cos((H * Math.PI) / 180);
    const B = C * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ].map((v) => Math.min(1, Math.max(0, linToSrgb(v))));
  };
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map(srgbToLin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const hexRgb = (h: string) => {
    const v = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  };
  const surface = (b: string, name: string): number[] => {
    const raw = decl(b, name)!;
    // One var hop, inside the same block: dark declares `--tint: var(--foreground)`
    // because its washes are made of its own ink, and that is a value, not a typo.
    const ref = raw.match(/^var\(--([\w-]+)\)$/);
    if (ref) return surface(b, ref[1]);
    const m = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    expect(m, `${name} is not a plain oklch: ${raw}`).not.toBeNull();
    return oklchToRgb(+m![1], +m![2], +m![3]);
  };
  const ratio = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  it('the control token is declared as a VALUE in both themes', () => {
    // It lives in theme-shadcn (the values layer), not the bridge, so that the
    // no-attribute case — :root === light, before the boot script stamps
    // data-theme — resolves it too. If it lived only in html[data-theme=…],
    // --input would be invalid until JS ran.
    expect(decl(SH_LIGHT, 'border-control')).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(decl(SH_DARK, 'border-control')).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(decl(SH_LIGHT, 'border-control')).not.toBe(decl(SH_DARK, 'border-control'));
  });

  it("shadcn's --input IS the control edge, not a copy of --border", () => {
    // The bug: --input had simply been copied from --border, so every registry
    // component that draws `border-input` drew a DIVIDER around a control.
    for (const b of [SH_LIGHT, SH_DARK]) {
      expect(decl(b, 'input')).toBe('var(--border-control)');
      expect(decl(b, 'input')).not.toBe(decl(b, 'border'));
    }
  });

  it('the control edge clears 3:1 on every surface it can sit on', () => {
    // THE POINT OF THE TIER. Solved against ALL of them, because the hardest
    // ground is the one nearest the border's own luminance — the darkest
    // surface in light, the lightest in dark — and solving against one ground
    // is exactly how the accent fills ended up failing on the band.
    for (const [name, b] of [['light', SH_LIGHT], ['dark', SH_DARK]] as const) {
      const edge = hexRgb(decl(b, 'border-control')!);
      for (const s of ['background', 'card', 'muted', 'popover']) {
        const r = ratio(edge, surface(b, s));
        expect(r, `${name}: control edge on --${s} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('destructive ink clears 4.5:1 on every surface, a hovered menu row included', () => {
    // Found by the two-theme OVERLAY sweep (2026-09-11), which opens menus
    // before measuring — the at-rest sweep never saw them. "Delete workstream"
    // was 4.37:1 on the dark popover and 3.33 once focused, because the focus
    // state washed RED under red text: a same-hue wash lowers contrast however
    // the ink is tuned. The row now takes the neutral hover every other item
    // takes (--wash-1, ink at 5%), and this holds the ink to that ground too.
    for (const [name, b] of [['light', SH_LIGHT], ['dark', SH_DARK]] as const) {
      const ink = surface(b, 'destructive');
      const fg = surface(b, 'foreground');
      for (const s of ['background', 'card', 'muted', 'popover']) {
        const ground = surface(b, s);
        const hovered = ground.map((c, i) => fg[i] * 0.05 + c * 0.95);
        expect(ratio(ink, ground), `${name}: destructive on --${s}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ink, hovered), `${name}: destructive on a hovered --${s} row`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('a destructive menu row is never washed in its own hue', () => {
    for (const f of ['components/ds/ui/dropdown-menu.tsx', 'components/ds/ui/context-menu.tsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/variant=destructive\]:focus:bg-destructive/);
    }
  });

  it('the tiers are ordered — a control edge is firmer than a field edge is firmer than a divider', () => {
    // Three tokens that are not ordered are three arbitrary greys. Each theme
    // block states soft and strong as ONE percentage of the theme ink.
    for (const [name, b] of [['light', LIGHT], ['dark', DARK]] as const) {
      const pct = (t: string) => {
        const m = decl(b, `color-border-${t}`)!.match(/var\(--tint(?:-line)?\)\s+([\d.]+)%/);
        expect(m, `${name}: --color-border-${t} is not the theme tint at a percentage`).not.toBeNull();
        return +m![1];
      };
      expect(pct('soft'), `${name}: soft < strong`).toBeLessThan(pct('strong'));
      expect(pct('strong'), `${name}: strong is the field tier`).toBeGreaterThanOrEqual(24);
    }
  });

  it('the edge family speaks ONE dialect — dark derives from the theme ink, not raw white', () => {
    // This was the last family in the bridge still written as
    // `rgb(255 255 255 / …)`. Two problems: pure #FFF is not this theme's ink
    // (--foreground is #D4D4D4), and dark's -strong was 18% against light's
    // 16% — a divergence nothing recorded, so neither could be changed with
    // confidence. The washes were unified for the same reasons; the edges were
    // missed.
    //
    // ONE DECLARED EXCEPTION, added 2026-09-26: `panel`. It is not a slip and it is not a second
    // dialect — both themes still write the ink at a percentage, which is what this guard is
    // really for. They write DIFFERENT percentages because the two themes do not separate
    // surfaces the same way, and that is measurable rather than a matter of taste:
    //
    //   light  panel shell L .945 → sidebar .968 → sheet 1.000, every step a visible FILL
    //   dark   .125 → .169 → .184 → .200, the whole ladder inside a quarter of light's room,
    //          with the panel body sitting 1.07:1 above its own shell
    //
    // A fill that faint cannot carry a raised surface, so in dark the EDGE has to (which is what
    // Linear and Calendly both do). 5% of the dark ink over a panel composites to 1.12:1 — nothing
    // — and 9% to 1.19:1. Light keeps 5%: there the fills already separate, and a heavier edge
    // reads as a box drawn round a card.
    const SPLIT: Record<string, string> = {
      panel: 'dark separates raised surfaces with the edge, because its fill steps cannot',
    };
    for (const t of ['soft', 'strong', 'panel', 'focus']) {
      const l = decl(LIGHT, `color-border-${t}`)!;
      const d = decl(DARK, `color-border-${t}`)!;
      expect(d, `dark --color-border-${t} is a raw literal`).not.toMatch(/rgba?\(|#[0-9a-f]{3,8}/i);
      // Whatever the percentage, both themes say it the same WAY: the theme's own
      // TINT, mixed. (Was "the theme's ink" until 2026-09-30. Light's edges and
      // washes are made of a warm tint now — the ink at 6% composites to chroma
      // ZERO on a white card, which was the second, grey tone the user saw — and
      // each theme declares what its tint is: light the warm source, dark its own
      // ink, Paper its own ink. Same dialect everywhere; the colour is the theme's.)
      for (const [theme, v] of [['light', l], ['dark', d]] as const) {
        expect(v, `${theme} --color-border-${t} is not the theme tint at a percentage`).toMatch(/color-mix\(in oklab, var\(--tint(?:-line)?\) [\d.]+%, transparent\)/);
      }
      if (SPLIT[t]) {
        expect(d, `--color-border-${t} is a declared split, so it must NOT match light`).not.toBe(l);
        continue;
      }
      expect(d, `--color-border-${t} differs between themes`).toBe(l);
    }
  });

  // Each theme's OWN block in the bridge. The shared mapping block opens with
  // `html[data-theme='light'],\nhtml[data-theme='dark'] {`, so the first match
  // for dark is the SHARED block — dark's own block is the last one.
  const themeBlock = (theme: 'light' | 'dark') => {
    const at = theme === 'dark'
      ? bridge.lastIndexOf("html[data-theme='dark'] {")
      : bridge.search(/^html\[data-theme='light'\]\s*\{/m);
    expect(at, `the ${theme} block in tokens-light.css`).toBeGreaterThan(-1);
    return bridge.slice(at);
  };
  const pctOf = (b: string, token: string) => {
    // An ink STEP mixes the ink into the ground; a WASH is the theme's tint at
    // alpha. Either way the number this returns is the percentage.
    const m = decl(b, token)?.match(/var\(--(?:foreground|tint|tint-line)\)\s+([\d.]+)%/);
    expect(m, `--${token} is not the theme ink/tint at a percentage`).toBeTruthy();
    return +m![1] / 100;
  };
  // An ink STEP is an OKLAB mix of two opaque anchors; a WASH is the ink at
  // alpha, composited in sRGB by the browser. Different operations, so the
  // test does each one the way the page does.
  const inkStep = (b: string, pct: number) => {
    const lab = (token: string) => {
      const m = decl(b, token)!.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)!;
      const [L, C, H] = [+m[1], +m[2], +m[3]];
      return [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
    };
    const fg = lab('foreground');
    const bg = lab('background');
    const [L, A, B] = fg.map((v, i) => v * pct + bg[i] * (1 - pct));
    return oklchToRgb(L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI);
  };

  it('secondary text on a WASHED row uses a step that survives the wash', () => {
    // Found by the two-theme OVERLAY sweep (2026-09-12): the New project
    // dialog's selected card read "Start from scratch" at 3.78:1 in dark. The
    // popover is dark's LIGHTEST surface and a state wash lightens it again —
    // 9% ink composites #333333 to #414141. Nothing else can move:
    //   · the ground is held up by the ladder the user asked for ("all looks
    //     flat"), and the lowest popover that ladder allows still fails;
    //   · the ramp would have to take ink-500 to ~83%, which IS ink-700 —
    //     three steps collapsed into one;
    //   · #333333 has three sRGB units of headroom, so any wash you can SEE
    //     fails.
    // What can move is the text. A row that takes a wash brings its secondary
    // line forward to ink-700 while the wash shows. This holds that step on
    // every surface under every wash, in both themes.
    const forward = pctOf(bridge, 'color-ink-700');
    for (const [name, sh] of [['light', SH_LIGHT], ['dark', SH_DARK]] as const) {
      // The wash is composited from the theme's TINT — what it is actually made
      // of — not from --foreground. In light those differ (warm source vs ink),
      // and a guard that washed with the ink would be checking a colour the page
      // never paints. Same lightness, so the ratio moves by hundredths; it is
      // still the honest number.
      const fg = surface(sh, 'tint');
      const ink = inkStep(sh, forward);
      for (const s of ['background', 'card', 'muted', 'popover']) {
        const ground = surface(sh, s);
        for (const [wash, state] of [['wash-1', 'hovered'], ['wash-3', 'selected'], ['wash-2', 'pressed']] as const) {
          const a = pctOf(themeBlock(name), wash);
          const washed = ground.map((c, i) => fg[i] * a + c * (1 - a));
          const r = ratio(ink, washed);
          expect(r, `${name}: ink-700 on a ${state} --${s} row is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }

    // THE CONTROL, and the reason the rule exists. If this ever stops failing
    // the forward step is no longer needed and the rows can go back to ink-500
    // — until then it is why they cannot.
    const darkFg = surface(SH_DARK, 'tint');
    const pop = surface(SH_DARK, 'popover');
    const pressed = pctOf(themeBlock('dark'), 'wash-2');
    const faint = inkStep(SH_DARK, pctOf(bridge, 'color-ink-500'));
    const r = ratio(faint, pop.map((c, i) => darkFg[i] * pressed + c * (1 - pressed)));
    expect(r, `dark ink-500 on a pressed popover row now clears AA (${r.toFixed(2)}:1) — revisit the forward step`).toBeLessThan(4.5);
  });

  it('every row that takes a wash brings its secondary text forward', () => {
    // The step above is a guarantee only if the rows USE it. Each of these
    // paints faint text inside a row that washes on highlight, hover or
    // selection, on the raised tier where that wash fails ink-500.
    const src = (f: string) => readFileSync(f, 'utf8');
    const classStrings = (s: string, marker: string) =>
      (s.match(/"[^"]*"/g) ?? []).filter((c) => c.includes(marker));

    // A shortcut or description can only come forward if its row is a group.
    for (const f of ['components/ds/ui/dropdown-menu.tsx', 'components/ds/ui/context-menu.tsx']) {
      const rows = classStrings(src(f), 'focus:bg-surface-hover');
      expect(rows.length, `${f}: no highlightable rows found`).toBeGreaterThan(0);
      for (const row of rows) expect(row, `${f}: a highlightable row is not group/item`).toMatch(/\bgroup\/item\b/);
    }
    for (const row of classStrings(src('components/ds/ui/command.tsx'), 'data-[selected=true]:bg-surface-hover')) {
      expect(row, 'command.tsx: CommandItem is not group/item').toMatch(/\bgroup\/item\b/);
    }

    const shortcut = (f: string, slot: string) =>
      src(f).match(new RegExp(`data-slot="${slot}"[\\s\\S]*?className=\\{cn\\(\\s*"([^"]*)"`))?.[1] ?? '';
    expect(shortcut('components/ds/ui/dropdown-menu.tsx', 'dropdown-menu-shortcut')).toContain('group-data-[highlighted]/item:text-ink-700');
    expect(shortcut('components/ds/ui/context-menu.tsx', 'context-menu-shortcut')).toContain('group-data-[highlighted]/item:text-ink-700');
    expect(shortcut('components/ds/ui/command.tsx', 'command-shortcut')).toContain('group-data-[selected=true]/item:text-ink-700');
    expect(src('components/ds/ui/dropdown-menu.tsx').match(/\{description && <span className="([^"]*)"/)?.[1] ?? '')
      .toContain('group-data-[highlighted]/item:text-ink-700');

    const modal = src('components/projects/new-project-modal.tsx');
    // NAMED groups: a bare `group-hover:` fires for ANY hovered `.group`
    // ancestor, so a dialog that happened to be a group would light every card.
    expect(modal, 'the New project card is not a named group').toMatch(/const cardCls = \(selected: boolean\) =>\s*cn\('group\/card /);
    expect((modal.match(/group-aria-pressed\/card:text-ink-700/g) ?? []).length, 'both card subtitles come forward when chosen').toBeGreaterThanOrEqual(2);
    expect((modal.match(/group-hover\/card:text-ink-700/g) ?? []).length, 'both card subtitles come forward on hover').toBeGreaterThanOrEqual(2);

    expect((src('components/ds/ui/notifications.tsx').match(/group-hover\/row:text-ink-700/g) ?? []).length,
      'a DS notification row brings its context and time forward').toBeGreaterThanOrEqual(2);
    // The LIVE bell — the DS component above is only the portal's. Its rows
    // are `zb-press`, which already layers the hover wash through `::after`;
    // the extra `hover:bg-surface-hover` washed every row TWICE.
    const bell = src('components/shell/notifications-bell.tsx');
    expect((bell.match(/group-hover\/note:text-ink-700/g) ?? []).length, 'a bell row brings its title, body and time forward').toBeGreaterThanOrEqual(3);
    expect(bell, 'a bell row is washed twice').not.toMatch(/zb-press[^"]*hover:bg-surface-hover/);
    expect(src('components/shell/command-palette.tsx')).toMatch(/color: active \? 'var\(--color-ink-700\)' : 'var\(--text-muted\)'/);
  });
});

describe('state is a wash, never an elevation', () => {
  // THE BUG CLASS. `--color-paper-3` IS the popover tone, so a state painted
  // with it inside a raised container paints the container's own colour: the ⌘K
  // palette's selected row was invisible in BOTH themes. And paper-3 is white in
  // light, so the Select's highlighted option, the Combobox's active option and
  // every `hover:bg-paper-3` on a white card showed nothing there. Found chasing
  // the two-theme overlay sweep (2026-09-12). tokens-light.css says it in words
  // — "Elevation stays solid; state stays a wash" — and nothing held a single
  // call site to it.
  const ELEVATION = /^bg-(?:paper(?:-[2-5])?|surface-(?:raised|sunken|panel|well)|popover|card|muted|secondary|background|accent-surface)(?:\/\d+)?$/;
  // The one allowance. On INVERTED chrome (the selection bar is `bg-ink-900
  // text-paper`, in both themes) the surface's own ink is paper, so paper at an
  // alpha IS that surface's wash — `--color-surface-hover` there would be ink
  // over ink and vanish. A SOLID paper, or any other surface at an alpha, is not.
  const INVERSE_WASH = /^bg-paper\/\d+$/;
  // …and the same tones written as an ARBITRARY property. The client portal's nav
  // hovered with `hover:[background:var(--paper)]`, which a `bg-*` scan cannot see.
  const ARBITRARY_SURFACE = /^(.*):\[(?:background|background-color):var\(--(?:color-)?(?:paper(?:-[2-5])?|canvas|card|popover|background|muted|surface-(?:raised|sunken|panel|well))\)\]$/;
  // Variants that mean "this is a STATE". Breakpoints, `dark:`, `print:` and
  // container queries choose a LAYOUT, and are allowed to pick a surface. An
  // arbitrary variant is a state when it selects one (`[&_button:hover]`).
  const isState = (v: string) =>
    /^(?:hover|focus|focus-visible|focus-within|active|open|checked|selected|disabled|enabled|visited|target|group-.+|peer-.+|has-.+|aria-.+|data-.+|\*.*)$/.test(v) ||
    /^\[.*(?::hover|:focus|:active|:checked|\[data-|\[aria-).*\]$/.test(v);
  // Split a variant chain on the colons that SEPARATE variants — not the ones
  // inside an arbitrary variant like `[&_button:hover]`.
  const variantsOf = (chain: string) => {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of chain) {
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      if (ch === ':' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out.push(...walk(path));
      else if (/\.tsx$/.test(path) && !/\.test\.tsx$/.test(path)) out.push(path);
    }
    return out;
  };
  const files = [...walk('components'), ...walk('app')];

  it('no state variant paints an elevation token', () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        for (const token of line.split(/[\s"'`]+/)) {
          const arbitrary = token.match(ARBITRARY_SURFACE);
          if (arbitrary && variantsOf(arbitrary[1]).some(isState)) {
            offenders.push(`${file}:${i + 1}  ${token}`);
            continue;
          }
          const at = token.lastIndexOf(':bg-');
          if (at < 0) continue;
          const bg = token.slice(at + 1);
          if (!ELEVATION.test(bg) || INVERSE_WASH.test(bg)) continue;
          if (variantsOf(token.slice(0, at)).some(isState)) offenders.push(`${file}:${i + 1}  ${token}`);
        }
      });
    }
    expect(offenders, `a state painted with an elevation — use bg-surface-hover / -selected / -active (a wash):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no inline style picks an elevation for a state either', () => {
    // The class scan cannot see `background: active ? 'var(--paper-3)' : …`,
    // which is exactly how the command palette's selected row went invisible.
    // `??` is a default, not a state, so it is not matched.
    const offenders: string[] = [];
    // Only a STATE condition counts: `level ? 'var(--paper)' : 'var(--paper-2)'`
    // picks a surface by nesting depth, which is structure, not state.
    const re = /background(?:Color)?:\s*[^,}]*?\b(?:active|hover(?:ed)?|sel(?:ected)?|is(?:Sel(?:ected)?|Active|Hover(?:ed)?|Open|Focused|Pressed|Current|Over)|pressed|open|focused|highlighted|checked|current|dragging|over)\s*\?\s*'var\(--(?:color-)?(?:paper(?:-[2-5])?|surface-(?:raised|sunken|panel)|popover|card|muted)\)'/;
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (!line.trim().startsWith('//') && re.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `inline state painted with an elevation — use var(--color-surface-hover):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('a pressable washes ONCE', () => {
    // `.zb-press` layers its hover wash through `::after` (globals.css). A
    // `hover:bg-*` on the same element paints a SECOND wash underneath it: the
    // live notification bell hovered at twice the house hover, and the faint
    // lines in its rows failed contrast on that doubled ground.
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        for (const cls of line.match(/["'`][^"'`]*["'`]/g) ?? []) {
          if (/\bzb-press\b/.test(cls) && /(?:^|[\s"'`])hover:bg-/.test(cls)) offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders, `zb-press already washes on hover — drop the hover:bg-*:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every floating list paints the RAISED tier', () => {
    // A menu, a select, a combobox and the filter wizard are one object — a
    // list that floats over the page. The popover, hover card, dropdown and
    // context menus sat on the raised tone; Select, Combobox and the filter
    // wizard painted the CARD tone, so in dark a select list opened DARKER than
    // the field that opened it (#202020 under a #333333 trigger), measured on
    // 2026-09-13. Light hid it: both tones are white there.
    const menu = readFileSync('components/ds/ui/menu.tsx', 'utf8');
    // The one overlay chrome, and the list panel built on it (menu.tsx).
    const overlay = menu.match(/export const OVERLAY_CLASS =\s*([\s\S]*?);/)?.[1] ?? '';
    expect(overlay, 'OVERLAY_CLASS was not found in menu.tsx').not.toBe('');
    const panel = (menu.match(/export const MENU_PANEL_CLASS =\s*([\s\S]*?);/)?.[1] ?? '').replace(/\bOVERLAY_CLASS\b/g, overlay);
    expect(panel, 'MENU_PANEL_CLASS was not found in menu.tsx').not.toBe('');
    const RAISED = /(?<![:\w-])bg-(?:surface-raised|popover)\b/;
    const offenders: string[] = [];
    for (const name of readdirSync('components/ds/ui').filter((n) => n.endsWith('.tsx'))) {
      const lines = readFileSync(join('components/ds/ui', name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/\bz-dropdown\b/.test(line)) return;
        // The fill sits on the same cn(...) — this line or the next few.
        const ctx = lines.slice(i, i + 4).join(' ').replace(/\bMENU_PANEL_CLASS\b/g, panel).replace(/\bOVERLAY_CLASS\b/g, overlay);
        if (RAISED.test(ctx)) return;
        const fills = ctx.match(/(?<![:\w-])bg-[a-z][a-z0-9-]*(?:\/\d+)?/g) ?? [];
        offenders.push(`components/ds/ui/${name}:${i + 1}  ${fills.join(' ') || '(no fill)'}`);
      });
    }
    expect(offenders, `a floating list off the raised tier — use bg-surface-raised:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('a DS component never picks a paper tone for a STATE branch', () => {
    // The class scan reads VARIANTS. A state chosen in code reads as a branch —
    // `p === page ? "bg-paper-4 …"` (the current page) and `isActive &&
    // "bg-paper-4"` (CommandMenu's active row). paper-4 IS the card in light, so
    // both were invisible on a card. A name cannot tell a state from a
    // structural choice (a segment thumb, an out-of-month day, a done chip), so
    // this is scoped to the DS layer, where a legacy paper-N tone should never
    // be chosen conditionally at all.
    const offenders: string[] = [];
    for (const name of readdirSync('components/ds/ui').filter((n) => n.endsWith('.tsx'))) {
      readFileSync(join('components/ds/ui', name), 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        if (/(?:\?|&&|\|\|)\s*["'`][^"'`]*(?<![:\w-])bg-paper-[2-5]\b/.test(line)) {
          offenders.push(`components/ds/ui/${name}:${i + 1}  ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders, `a state branch picks a paper tone — use bg-surface-hover / -active:\n${offenders.join('\n')}`).toEqual([]);
  });
});
