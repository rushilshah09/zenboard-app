import { describe, it, expect } from 'vitest';
import { revertedMessage } from '@/components/ds/ui/toast';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { scopeFill } from '@/lib/entity-color';
import { join } from 'node:path';
import { readTheme, undeclaredColourClasses, sourceFiles } from '@/scripts/verify/colour-classes.mjs';

// ── THE SYSTEM, NOT THE SCREEN ─────────────────────────────────────────────
// User directive, 2026-09-08, after a full UI audit:
//
//   "Do not fix individual UI inconsistencies by adding one-off CSS. If a
//    visual problem appears in a component, fix the underlying token or shared
//    component so the correction propagates throughout Zenboard."
//
// These assertions are the enforceable half of that. Each one is a rule the app
// broke somewhere, found by measuring the running page rather than reading CSS.
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx$/.test(path)) out.push(path);
  }
  return out;
}
/**
 * Blank comments rather than dropping them, so line numbers stay honest.
 *
 * Block comments are tracked ACROSS lines, not just recognised by their first:
 * a JSX block comment usually spans several, and its middle lines start with
 * neither slash-slash nor a star. Every guard below reads this, so prose that
 * quotes a forbidden pattern — including these files' own explanations of what
 * they forbid — cannot be mistaken for the pattern itself.
 */
const code = (file: string) => {
  const OPEN = '/' + '*', CLOSE = '*' + '/';
  let inBlock = false;
  return readFileSync(file, 'utf8').split('\n').map((raw) => {
    let l = raw;
    if (inBlock) {
      const end = l.indexOf(CLOSE);
      if (end === -1) return '';
      inBlock = false;
      l = l.slice(end + 2);
    }
    l = l.replace(/\/\*[\s\S]*?\*\//g, '');
    // A line comment ends the line BEFORE an unclosed block comment is looked for.
    // It used to be checked after, so the `/` + `*` inside "documents/" + "*." on
    // components/ds/ui/menu.tsx:10 opened a block that never closed there, and the
    // next fifty lines (OVERLAY_CLASS and MENU_PANEL_CLASS included) were blank to
    // every guard in this file. Found 2026-09-17 by a must-fail control that passed.
    if (l.trim().startsWith('//')) return '';
    const trailing = l.search(/(^|\s)\/\//);
    if (trailing !== -1) l = l.slice(0, trailing);
    const open = l.indexOf(OPEN);
    if (open !== -1) { inBlock = true; l = l.slice(0, open); }
    return l.trim().startsWith('*') ? '' : l;
  });
};

const FILES = [...walk('components'), ...walk('app')].filter((f) => !f.includes('.test.'));

describe('casing: sentence case is the default', () => {
  // The user's own list of what already read correctly — Inbox, Today, Views,
  // Projects, Lists, Content creation, Triage 1, Unfiled, Add task, Completed,
  // Filter — is all sentence case. `SIDEBAR CONTROL` was the outlier, and it
  // came from a rule (CLAUDE.md's uppercase SectionLabel) rather than a slip.
  // Fixing the popup alone would have left the rule that produced it.
  it('no component shouts a section label', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      code(file).forEach((line, i) => {
        if (!/\btext-(overline|micro|caption)[^"'`]*\buppercase\b/.test(line)) return;
        // A calendar's weekday initials (M T W T F S S) are single capitals by
        // convention, aria-hidden, and label a grid rather than a section. That
        // is a real exception, not a slip — it carries `aria-hidden`.
        if (/aria-hidden/.test(line)) return;
        offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `use the \`text-overline\` role (sentence case):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no inline style shouts, and no markup uppercases a label for display', () => {
    // The className rule above only saw `text-overline … uppercase`. The same
    // shout arrived three other ways, and a 2026-09-11 sweep found all three:
    // an inline `textTransform: 'uppercase'` (the client portal's labels, the
    // focus timer, rituals, the week board, a database menu), a bare
    // `uppercase` class beside an off-scale size (the new-project template
    // preview), and `{name.toUpperCase()}` in JSX (the month grid's weekdays,
    // the command palette's groups). Initials and hex codes uppercase into a
    // VARIABLE, never inline in markup, which is what keeps them out of this net.
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.(tsx|ts)$/.test(f))) {
      code(file).forEach((line, i) => {
        const shouts =
          /textTransform:\s*['"]uppercase['"]/.test(line) ||
          (/(^|["'`\s])uppercase(["'`\s]|$)/.test(line) && !/aria-hidden/.test(line)) ||
          /\{[\w.]+\.toUpperCase\(\)\}/.test(line);
        if (shouts) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `sentence case — use the text-overline role:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the shared label type role is sentence case', () => {
    // lib/typography.ts is where the rule has to live: `TYPE.label` still
    // carried `textTransform: 'uppercase'`, so every new caller would shout.
    const label = readFileSync('lib/typography.ts', 'utf8').split('\n').find((l) => /^\s*label:/.test(l));
    expect(label, 'the label role exists').toBeTruthy();
    expect(label).not.toMatch(/uppercase/);
  });

  it('a disabled control can still be READ', () => {
    // Measured on the real DS Button (2026-09-12): the disabled label sat at
    // 1.54:1 in light and 1.34:1 in dark on its own wash, where enabled buttons
    // on the same page read ~7:1. WCAG exempts disabled controls from contrast,
    // so nothing flagged it — but a label nobody can read does not tell you what
    // the button would do, and the portal's client actions were hiding behind
    // exactly this. ink-400 still fails (2.13 / 1.99); ink-500 is the lowest step
    // that clears the house 3:1 control tier (4.95 / 4.66), and the quiet wash
    // plus the not-allowed cursor still say "inactive".
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => {
        if (/[a-zA-Z\[\]_-]*disabled[a-zA-Z\[\]_-]*:text-ink-(100|200|300|400)\b/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `a disabled label must clear 3:1 — use ink-500:\n${offenders.join('\n')}`).toEqual([]);
    expect(readFileSync('components/ds/ui/button.tsx', 'utf8'), 'the foundation control states the rule')
      .toMatch(/disabled:text-ink-500/);
  });

  it('no capitals typed into the markup', () => {
    // The four guards above catch capitals MADE by CSS or by toUpperCase(). They could not see capitals TYPED in:
    // the Week board's "TODAY" and "MOVE TO", the database row's "OPEN" pill, the Rituals eyebrow's
    // "DAILY PLANNING" (audit, 2026-09-22). Acronyms and IDs are capitals by nature and pass.
    const ACRONYMS = new Set(['PDF', 'CSV', 'URL', 'API', 'MCP', 'ICS', 'GMT', 'UTC', 'OK', 'AM', 'PM', 'ID', 'SMS', 'HTML',
      'JSON', 'DB', 'INV', 'AI', 'PNG', 'JPG', 'SVG', 'CSS', 'RSS', 'FAQ', 'USD', 'EUR', 'GBP', 'INR', 'VAT', 'GST', 'PO', 'UI', 'UX']);
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => {
        if (/aria-hidden/.test(line)) return;
        // Text after a tag closes: a run of capitalised words before the next tag, brace or line end.
        for (const m of line.matchAll(/(?:>|\/>)\s*([A-Z]{2,}(?:[ -][A-Z]{2,})*)\s*(?=<|\{|$)/g)) {
          if (!m[1].split(/[ -]/).every((w) => ACRONYMS.has(w))) offenders.push(`${file}:${i + 1}  ${m[1]}`);
        }
        // A string of two or more capitalised words — an eyebrow tag like 'DAILY PLANNING'.
        for (const m of line.matchAll(/['"`]([A-Z]{2,}(?: [A-Z]{2,})+)['"`]/g)) {
          if (!m[1].split(' ').every((w) => ACRONYMS.has(w))) offenders.push(`${file}:${i + 1}  ${m[1]}`);
        }
      });
    }
    expect(offenders, `sentence case — write the words as they are read:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('sentence-case words carry no capital-era tracking', () => {
    // Tracking existed to keep capitals legible (CLAUDE.md, reversed 2026-09-08). On sentence-case words it only
    // loosens them — and seven files still spelled a section label as `text-caption font-medium tracking-[0.02em]`,
    // an 11px private copy of the 12px `text-overline` role; three more set `tracking-wide` or 0.04–0.12em. Negative
    // tracking tightens display type — a different job, and it passes. What may still be tracked: initials drawn
    // `aria-hidden`, a monospaced ID, and the DS menus' shortcut glyphs (⌘K is not a word).
    const GLYPH_HINTS = ['components/ds/ui/command.tsx', 'components/ds/ui/dropdown-menu.tsx', 'components/ds/ui/context-menu.tsx'];
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f) && !GLYPH_HINTS.includes(f))) {
      code(file).forEach((line, i) => {
        if (!/tracking-\[0\.(?:0[2-9]|[1-9])|tracking-(?:wide|wider|widest)\b|letterSpacing:\s*['"]0\.(?:0[2-9]|[1-9])/.test(line)) return;
        if (/aria-hidden/.test(line) || /font-mono/.test(line)) return;
        offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `drop the tracking — use the type role as it is:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('a section label is the text-overline role, never a private copy', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => {
        if (/text-caption font-medium tracking-\[0\.02em\]/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the overline role itself is not built for capitals', () => {
    // 0.06em tracking exists to stop SHOUTED text jamming together. Its presence
    // is the tell that a token still expects uppercase.
    const css = readFileSync('app/ds-theme.css', 'utf8');
    const track = css.match(/--text-overline--letter-spacing:\s*([\d.]+)em/);
    expect(track, '--text-overline--letter-spacing not found').not.toBeNull();
    expect(Number(track![1]), 'tracking this wide means the token still expects caps').toBeLessThan(0.02);
  });
});

describe('one component per question', () => {
  // "Is this coloured pile showing?" had two answers: the calendar rail
  // hand-rolled a coloured swatch, and the tasks rail used the TASK checkbox
  // with a `tint` that was null for an uncoloured project — so it rendered a
  // black ticked box, identical to the "Mark done" boxes on the same screen.
  // One glyph, two opposite meanings.
  it('no rail draws a layer toggle with the task Checkbox', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /rail|sidebar/i.test(f))) {
      const src = code(file).join('\n');
      if (/<Checkbox[\s\S]{0,240}aria-label=\{`\$\{[^}]*\}\s*(Hide|Show)/.test(src)) offenders.push(file);
      if (/<Checkbox[\s\S]{0,160}\btint=/.test(src)) offenders.push(file);
    }
    expect(offenders, `use <LayerToggle> instead:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('LayerToggle can never render black, whatever the entity', () => {
    // The bug was a NULL colour falling through to --primary, which rendered a
    // BLACK TICKED BOX identical to the "mark done" checkboxes on the same
    // screen. The component must resolve a colour itself rather than trusting
    // its caller.
    //
    // This asserted the exact source line and broke when the line got BETTER
    // (a stored hex now resolves to a per-theme token first). Assert the
    // property instead: whatever comes in, something comes out, and the last
    // resort is the palette — which is derived from the id and so is never
    // empty. Run the real resolver rather than reading the file.
    const src = readFileSync('components/ds/ui/layer-toggle.tsx', 'utf8');
    expect(src, 'the fallback chain must end at paletteFor, which cannot be null')
      .toMatch(/paletteFor\(id\)/);
    expect(src, 'a nullish colour must never reach the style prop unguarded')
      .not.toMatch(/background:\s*color\b/);
    for (const input of [null, undefined, '', '   ', 'not-a-colour', '#9A1B6F', 'plum']) {
      const resolved = scopeFill(input as string | null);
      expect(resolved, `scopeFill(${JSON.stringify(input)}) resolved to nothing`).toBeTruthy();
      expect(resolved, 'a scope fill must never be the primary solid').not.toMatch(/--primary\b/);
    }
  });
});

describe('galleries are fluid, not fixed', () => {
  // Reference: Craft's document index, shared by the user as a RESPONSIVENESS
  // reference. Its grid answers to the container — cards grow to fill the row
  // and the column count follows the space available, rather than the viewport
  // crossing a breakpoint.
  //
  // Zenboard's Documents gallery was the opposite: a `flex-wrap` of cards fixed
  // at 220x280, which cannot grow. Measured in a 616px pane it used 460px and
  // left 156px of dead space on EVERY row, and it needed an `!important` media
  // query to survive narrow widths — a layout fighting itself. Worse, the rail
  // was a hard 230px with no narrow branch, so at a 420px viewport it kept all
  // 230px and left the gallery 142px: narrower than a single card.
  it('the Documents gallery uses the shared grid rule', () => {
    const src = readFileSync('components/documents/documents-view.tsx', 'utf8');
    expect(src, 'the grid rule belongs to the DS, not the screen').toMatch(/cardGridClass\(/);
    expect(src, 'a flex-wrap of fixed cards cannot fill a row')
      .not.toMatch(/flexWrap: 'wrap'[^}]*\}\s*\n?\s*:/);
  });

  it('no gallery card carries a fixed pixel size', () => {
    const src = readFileSync('components/documents/documents-view.tsx', 'utf8');
    expect(src, 'the grid column decides the width; aspect-ratio decides the height')
      .not.toMatch(/width: 220, height: 280/);
  });

  it('the rail rule is shared, so every hub answers narrow the same way', () => {
    const hub = readFileSync('components/ui/hub-layout.tsx', 'utf8');
    expect(hub).toMatch(/export const HUB_RAIL_CLASS/);
    // Below `md` a rail stops being a column — full width, stacked, capped.
    expect(hub).toMatch(/md:w-\[var\(--rail-w\)\]/);
    const docs = readFileSync('components/documents/documents-view.tsx', 'utf8');
    expect(docs, 'Documents must not re-invent the rail width').toMatch(/HUB_RAIL_CLASS/);
    expect(docs).not.toMatch(/width: 'var\(--rail-w\)'/);
  });
});

describe('the palette is Notion\'s — a whisper of tint on surfaces, never a cast', () => {
  // User, 2026-09-08, in order, all three on the same day:
  //   1. "a little bit of warmness and paper, not too harsh yellow"  -> we warmed it
  //   2. "totally fucked up ... not 100% black and white ... remove warmth paper"
  //   3. "all color inspiration from notion directly copy this colors"
  //
  // Reading only #2 gives pure grey; reading only #1 gives the beige they
  // rejected. Notion resolves both, and MEASURING Notion says why:
  //
  //            surface chroma        ink chroma
  //   ours     0.0070 page           0.004
  //   (beige)  0.0104 border         <- 3-4x Notion on the BIGGEST areas
  //   Notion   0.0026 page           0.0107
  //            0.0027 border
  //
  // The tint was never the problem — the AREA it was spread across was. A
  // 0.007 chroma over a full canvas is a visible khaki cast; the same warmth
  // in text is just ink that is not clinically blue-black. So the rule is not
  // "no colour", it is: LARGE SURFACES STAY AT A WHISPER, ink may carry more.
  //
  // These caps are the guard. Surfaces at Notion's 0.0027 pass; the 0.0070
  // page and 0.0104 border that caused the complaint do not.
  const themeCss = readFileSync('app/theme-shadcn.css', 'utf8');
  const light = themeCss.split(/\n\s*html\[data-theme='dark'\]\s*\{/)[0];
  const SURFACE_MAX = 0.004;   // Notion's surfaces measure 0.0026-0.0027
  const INK_MAX = 0.012;       // Notion's #37352F measures 0.0107
  const SURFACES = ['--background', '--card', '--popover', '--muted', '--secondary', '--border', '--input'];
  const INK = ['--foreground', '--card-foreground', '--muted-foreground', '--popover-foreground'];
  // ASSERT THE PROPERTY, NOT THE SPELLING. This used to require the token to
  // be written as `oklch(L C H)`, and it broke the moment --input stopped being
  // a literal and became `var(--border-control)` — a correct change (--input is
  // shadcn's CONTROL edge, and it had been a copy of --border, so every
  // registry checkbox measured 1.07:1). The cap is about the colour, not the
  // syntax, so resolve whichever form the token takes and follow one var hop.
  const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const hexToOklch = (hex: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => srgbToLin(parseInt(hex.slice(1 + i, 3 + i), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m2 = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.7936177850 * m2 - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.4285922050 * m2 + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m2 - 0.8086757660 * s;
    return { L, c: Math.hypot(A, B) };
  };
  // Comments first: `[^;]+` happily matches PROSE — the file explains the
  // palette in sentences that contain "--border" and a number, so the first
  // three runs of this read a comment and reported a token as malformed.
  const lightCode = light.replace(/\/\*[\s\S]*?\*\//g, '');
  const chromaOf = (token: string, depth = 0): { L: number; c: number } => {
    const raw = lightCode.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
    expect(raw, `${token} is not declared in light`).toBeTruthy();
    const ok = raw!.match(/oklch\(([\d.]+)\s+([\d.]+)/);
    if (ok) return { L: Number(ok[1]), c: Number(ok[2]) };
    const hex = raw!.match(/^#([0-9a-fA-F]{6})$/);
    if (hex) return hexToOklch(raw!);
    const ref = raw!.match(/^var\((--[\w-]+)\)$/);
    expect(depth, `${token} chases vars too deep: ${raw}`).toBeLessThan(3);
    expect(ref, `${token} is neither oklch, hex, nor a var: ${raw}`).not.toBeNull();
    return chromaOf(ref![1], depth + 1);
  };

  it.each(SURFACES)('%s is at most a whisper of tint', (token) => {
    expect(chromaOf(token).c, `${token} tints the whole surface — that is the beige`)
      .toBeLessThanOrEqual(SURFACE_MAX);
  });

  it.each(INK)('%s stays within Notion\'s ink warmth', (token) => {
    expect(chromaOf(token).c, `${token} is more tinted than Notion's ink`)
      .toBeLessThanOrEqual(INK_MAX);
  });

  it('the elevation ladder is strictly ordered in both themes', () => {
    // The user rejected a FLAT light theme twice, so these must stay distinct.
    // Notion's own canvas is white with grey chrome; Zenboard is card-heavy, so
    // it takes Notion's SIDEBAR grey (#F7F7F5) as the page and keeps cards white.
    expect(chromaOf('--card').L, 'the card is the white the page steps down from').toBe(1);
    expect(chromaOf('--background').L).toBeLessThan(chromaOf('--card').L);
    expect(chromaOf('--muted').L).toBeLessThan(chromaOf('--card').L);
    expect(chromaOf('--border').L).toBeLessThan(chromaOf('--muted').L);

    const dark = themeCss.slice(themeCss.search(/html\[data-theme='dark'\]\s*\{/));
    const dl = (t: string) => Number(dark.match(new RegExp(`${t}:\\s*oklch\\(([\\d.]+)`))![1]);
    // Dark lifts as it rises: page -> card -> band -> popover. The popover is the
    // MOST raised surface and shipped BELOW the band once, when the two were
    // tuned independently.
    expect(dl('--background')).toBeLessThan(dl('--card'));
    expect(dl('--card')).toBeLessThan(dl('--muted'));
    expect(dl('--muted')).toBeLessThan(dl('--popover'));
  });
});

describe('a count is one primitive', () => {
  // Named in the user's UI audit: "counts styled ad-hoc (needs one Count
  // primitive)". Measured across eight pages: 33 counts, FIVE distinct styles.
  //
  // The drift that mattered was not size — it was `tabular-nums`. Seven counts
  // in the board column headers rendered proportional, and on a board the number
  // changes every time a card moves, so the header shifted as it did. That is
  // exactly the failure CLAUDE.md's "numbers in stats and tables: tabular-nums"
  // rule exists to prevent, and it is why this is a component rather than a
  // documented class string: a class string gets copied without the part that
  // matters.
  const count = readFileSync('components/ds/ui/count.tsx', 'utf8');
  // Strip comments: this file DESCRIBES the literal it replaced, and a naive
  // scan would flag the explanation as the offence.
  const countCode = count.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('the primitive guarantees tabular figures and the type role', () => {
    expect(countCode).toMatch(/tabular-nums/);
    // `text-caption` is the 12px/400 role; a literal `text-[12px]` has the same
    // value but is invisible to a change in the type scale.
    expect(countCode).toMatch(/text-caption/);
    expect(countCode, 'a count must not hardcode a pixel size').not.toMatch(/text-\[\d+px\]/);
  });

  it('the shared surfaces that render counts use it', () => {
    // These three are where counts actually appear; a fourth written by hand is
    // how the app got five styles in the first place.
    for (const f of ['components/ds/ui/panel.tsx', 'components/ds/ui/board.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} should render its count through <Count>`).toMatch(/<Count\b/);
    }
  });

  it('a count and a prose summary are different props', () => {
    // `count` was typed ReactNode and TWO callers passed a sentence through it
    // ("3 things, 1 overdue"). One prop doing two jobs, and they want opposite
    // typography — tabular figures inside a sentence read as mechanical.
    const panel = readFileSync('components/ds/ui/panel.tsx', 'utf8');
    expect(panel, 'count must be a number, not arbitrary content').toMatch(/count\?:\s*number \| string/);
    expect(panel, 'prose needs its own slot').toMatch(/summary\?:\s*string \| null/);
    for (const f of ['components/today/waiting-section.tsx', 'components/today/content-today.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} passes prose — it belongs in summary=`).toMatch(/summary=\{/);
      expect(src, `${f} still routes a sentence through count=`).not.toMatch(/count=\{\w+Summary\(/);
    }
  });
});

describe('row heights are a token, not eight opinions', () => {
  // CLAUDE.md has stated this scale in prose for a long time — "nav 32px · task
  // rows 36px · table rows 44px · menu items 32px" — but it lived NOWHERE in
  // code, so nothing could reference it. Measured in the browser across eight
  // pages: 97 controls, 13 distinct heights, and the biggest off-spec value was
  // **34px, used 16 times**, spelled three different ways (`h-[34px]`,
  // `height: 34`, `min-h-[34px]`) across EIGHT files.
  //
  // Nobody chose 34. It is what a rule with no home in the code produces: each
  // rail was built beside a different neighbour and split the difference. A
  // number repeated in eight files is drift, not a decision.
  const css = readFileSync('app/globals.css', 'utf8');
  const COMPONENT_DIRS = ['components'];

  function walkTsx(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out.push(...walkTsx(p));
      else if (p.endsWith('.tsx')) out.push(p);
    }
    return out;
  }
  const files = COMPONENT_DIRS.flatMap(walkTsx);

  it('the scale is declared once, in the tokens', () => {
    expect(css).toMatch(/--row-nav:\s*32px/);
    expect(css).toMatch(/--row-task:\s*36px/);
    expect(css).toMatch(/--row-table:\s*44px/);
  });

  it('no component hardcodes 34px — the value that had no token', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/h-\[34px\]|min-h-\[34px\]|height:\s*34\b|width:\s*34\b/.test(line)) {
          offenders.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(offenders, `34px is off the 32/36/44 scale — use var(--row-nav): ${offenders.join(', ')}`).toEqual([]);
  });

  it('rails consume the token rather than restating the number', () => {
    // The four rails are the reason the token exists; if one drifts back to a
    // literal the others still look right, which is how this started.
    const RAILS = [
      'components/tasks/tasks-rail.tsx',
      'components/projects/projects-workspace.tsx',
      'components/documents/documents-view.tsx',
    ];
    for (const f of RAILS) {
      expect(readFileSync(f, 'utf8'), `${f} should size its rail row from --row-nav`)
        .toMatch(/h-\[var\(--row-nav\)\]/);
    }
  });
});

describe('every hub rail can be reclaimed', () => {
  // Documents had a hide/show toggle and Projects did not — the same hub shape,
  // one with a way to reclaim the width and one without. It belongs to the
  // layout that draws the rail, so a hub cannot forget it.
  it('HubLayout renders the toggle itself', () => {
    const src = readFileSync('components/ui/hub-layout.tsx', 'utf8');
    expect(src).toMatch(/<RailToggle/);
    expect(src, 'collapsible by default, not opt-in').toMatch(/collapsibleRail = true/);
  });

  it('the toggle lives in the header, never inside the rail', () => {
    // A control that vanishes with the thing it controls cannot bring it back.
    const src = readFileSync('components/ui/hub-layout.tsx', 'utf8');
    const railStart = src.indexOf('<nav\n');
    const railEnd = src.indexOf('</nav>');
    expect(railStart, '<nav element not found').toBeGreaterThan(-1);
    expect(railEnd).toBeGreaterThan(railStart);
    expect(src.slice(railStart, railEnd), 'the toggle must not sit inside the rail')
      .not.toMatch(/RailToggle/);
  });
});

describe('a card is the raised surface, not the recessed one', () => {
  // The Documents gallery read as "gray background + gray cards + gray borders".
  // Measured, the hierarchy was INVERTED: the card's own surface was `--paper-2`
  // (grey) and its header painted `--paper-3` (white) ON TOP, so the card's grey
  // showed only in the gaps and the body sat at the same tone as the canvas
  // behind it — canvas→card was 1.074, effectively no separation.
  //
  // ── AND THE FIRST FIX WAS ONLY HALF OF IT (2026-09-11) ────────────────────
  // That pass left the card white and moved the grey to the PREVIEW BODY, on
  // the reasoning that a step down from the card is what distinguishes header
  // from content. It checked preview→card (1.128) and never checked
  // preview→CANVAS. Measured on the real page:
  //
  //   canvas #EFEFEC · card #FFFFFF · preview #F1F1EF · border #E9E9E7
  //   preview vs canvas  1.02      ← the same colour as the page
  //   border  vs canvas  1.06      ← cannot rescue it
  //
  // So the bottom two-thirds of every card was the page showing through, and
  // the user's report was "this section contrast is so off". A step measured
  // against the wrong neighbour is not a step.
  //
  // The rule is CLAUDE.md's, unchanged and now actually enforced: one fill per
  // card, header and body separated by a hairline. The list row had the same
  // fill and the same result, and is fixed with it. Full guards live in
  // components/documents/doc-surface.test.ts.
  const raw = readFileSync('components/documents/documents-view.tsx', 'utf8');
  // COMMENTS STRIPPED before any colour scan. The rule is "no raw hex in a
  // COMPONENT" — a comment recording a measured value is documentation, and a
  // guard that reads it as code punishes exactly the notes this codebase wants
  // written. (This test failed on the paragraph above it.)
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // Anchored on CODE, not on a comment banner — the banner is stripped above,
  // and a guard whose region marker vanishes silently measures an empty string
  // and passes. `aspectRatio` is the grid card's first distinctive style.
  const cardRegion = () => {
    const i = src.indexOf("aspectRatio: '220 / 280'");
    expect(i, 'the grid card moved; re-anchor this region').toBeGreaterThan(-1);
    return src.slice(i, src.indexOf('function DocMenu'));
  };

  it('the grid card sits on the card surface', () => {
    expect(cardRegion(), 'a card painted --paper-2 disappears into the canvas')
      .toMatch(/background: 'var\(--paper\)'/);
  });

  it('nothing INSIDE the card paints a second fill', () => {
    // Replaces a test that required `--paper-2` to be present. It passed for
    // the wrong reason — the card-menu chip also uses it — while the fill it
    // was actually guarding made the card edgeless.
    const body = cardRegion();
    const preview = body.slice(body.indexOf('flex: 1, minHeight: 0'));
    expect(preview.slice(0, 200), 'the preview rides the card surface').not.toMatch(/background:/);
  });

  it('header and body are separated by a hairline, not by a fill', () => {
    expect(cardRegion()).toMatch(/borderBottom: '1px solid var\(--color-line-soft\)'/);
  });

  it('the card region introduces no raw colour', () => {
    // §12: every changed colour must come from the token system.
    const card = cardRegion();
    expect(card.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [], 'raw hex in the card').toEqual([]);
    expect(card.match(/\brgba?\(/g) ?? [], 'raw rgb in the card').toEqual([]);
  });
});

describe('one surface, one ink — the light bridge stays on the theme axis', () => {
  // User: "some place warmth colours and some place black and white."
  // Two causes, both systemic:
  //
  //   1. The data palette's NEUTRAL rung came from Tailwind's neutral scale
  //      (#F5F5F5 / #404040 / #737373 — chroma 0), so a "gray" tag rendered as
  //      a grey patch on warm paper. Neutral has to mean neutral FOR THIS PAGE.
  //   2. The washes were pure black. A black wash over warm paper DESATURATES
  //      it: the secondary button measured #f0f0ee against its own #e3dfd8
  //      border — the fill less warm than the edge around it. Mixed from the
  //      theme's own `--foreground` they deepen the paper instead.
  const bridge = readFileSync('app/tokens-light.css', 'utf8');
  // The standalone light rule, anchored on the end of the previous one — the
  // file opens with a SHARED `light, dark` selector, so a plain split lands there.
  const lightBlock = (() => {
    const bare = bridge.replace(/\/\*[\s\S]*?\*\//g, '');
    const m = bare.match(/\}\s*html\[data-theme='light'\]\s*\{/);
    if (!m) return '';
    const open = bare.indexOf('{', m.index! + m[0].length - 1);
    return bare.slice(open, bare.indexOf('\n}', open));
  })();

  it('the palette\'s NEUTRAL rungs are truly neutral, in both themes', () => {
    // Superseded assertion: this used to REJECT dead-neutral hex, because on
    // warm paper a chroma-0 grey was the visible mismatch. The theme is neutral
    // now, so that guard is exactly backwards — a grey is correct, and a TINT
    // is the bug. (It cannot simply ban raw hex either: the ten-colour data
    // palette is categorical and must be literal values.)
    //
    // So it guards the rungs that are supposed to carry no colour at all. These
    // were #F4F2EC / #767471 / #A8A39A etc. — warmed to sit on paper — and a
    // beige chip on a white card is the "some places warm, some places black
    // and white" mismatch the user reported.
    const NEUTRAL_RUNGS = [
      '--default-dot', '--default-bg', '--default-text',
      '--gray-dot', '--gray-bg', '--gray-text',
      '--color-label-stone', '--color-label-stone-fill', '--color-label-stone-text',
    ];
    const bare = bridge.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const token of NEUTRAL_RUNGS) {
      // Every declaration of it — light AND dark both live in this file.
      const found = [...bare.matchAll(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`, 'g'))];
      expect(found.length, `${token} is not declared in the light bridge`).toBeGreaterThan(0);
      for (const [, hex] of found) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect(`${token}=${hex} r${r} g${g} b${b}`, `${token} carries a tint`)
          .toBe(`${token}=${hex} r${r} g${r} b${r}`);
      }
    }
  });

  it('washes are derived from the theme ink in BOTH themes, at the same strengths', () => {
    // Light was already derived. DARK was six raw `rgb(255 255 255 / …)`
    // literals at 7/11/9/4/12/16% — pure white, and close to double light's
    // 5/9/7/2.5/6/10%. A wash lightens the ground beneath it and text is then
    // read against THAT, so at 12% over the popover the fill composited to
    // #4B4B4B, where no ink step below 900 clears AA. Deriving both halves off
    // the shared anchor at one set of percentages is what keeps a filled chip
    // legible in either theme — and #FFF was never this theme's ink anyway
    // (--foreground is #D4D4D4).
    const WASHES: Record<string, number> = {
      '--wash-1': 5, '--wash-2': 9, '--wash-3': 7,
      '--wash-row': 2.5, '--wash-fill': 6, '--wash-fill-hover': 10,
    };
    const darkBlock = (() => {
      const bare = bridge.replace(/\/\*[\s\S]*?\*\//g, '');
      const m = bare.match(/\}\s*html\[data-theme='dark'\]\s*\{/);
      if (!m) return '';
      const open = bare.indexOf('{', m.index! + m[0].length - 1);
      return bare.slice(open);
    })();
    for (const [theme, body] of [['light', lightBlock], ['dark', darkBlock]] as const) {
      for (const [w, pct] of Object.entries(WASHES)) {
        const line = body.split('\n').find((l) => l.trim().startsWith(`${w}:`));
        expect(line, `${w} missing from the ${theme} theme`).toBeDefined();
        expect(line, `${theme} ${w} is a raw wash — derive it from --foreground`)
          .toMatch(/color-mix\(in oklab, var\(--foreground\)/);
        expect(
          Number(line!.match(/var\(--foreground\)\s*([\d.]+)%/)![1]),
          `${theme} ${w} is not at the shared strength — the two themes must wash equally`,
        ).toBe(pct);
      }
    }
  });
});

describe('the header row is a system, not four numbers', () => {
  // The TopBar carried `height: 44`, `borderRadius: 12` and a raw
  // `0 1px 2px rgba(0,0,0,0.04)` shadow — repeated FOUR times across the shell.
  // In dark that shadow is black on near-black: it does nothing. `--shadow-xs`
  // is defined per theme and measures 0.24 alpha there.
  const shell = readFileSync('components/shell/app-shell.tsx', 'utf8');

  it('the panel shadow is a token', () => {
    expect(shell.match(/rgba\(0,0,0,0\.0\d\)/g) ?? [], 'raw panel shadow').toEqual([]);
    expect(shell).toMatch(/var\(--shadow-xs\)/);
  });

  it('the header height and radius come from the scale', () => {
    expect(shell, 'a header height is a system decision').toMatch(/var\(--app-header-h/);
    expect(shell, 'radius 12 is --r-lg').not.toMatch(/borderRadius: 12,/);
  });

  it('both ends of a header row carry the same inset', () => {
    // The lead was inset by --app-header-lead-px and the trailing cluster was
    // not, so content began 16px from the left and ended 12px from the right —
    // on every screen in the app.
    const header = readFileSync('components/ui/page-header.tsx', 'utf8');
    const leadUses = (header.match(/--app-header-lead-px/g) ?? []).length;
    expect(leadUses, 'lead and actions must both use the inset').toBeGreaterThanOrEqual(2);
  });
});

describe('the icon scale is five steps, not eleven', () => {
  // `size` on <Icon> was a free `number`, so nothing ever said no: the app
  // accumulated ELEVEN sizes across ~800 call sites — 10, 11, 12, 13, 14, 15,
  // 16, 18, 20, 22, 24, 28 — most differing by ONE pixel from a neighbour.
  // A one-pixel difference is not a decision anyone can see; it is drift.
  //
  // The type still accepts a number on purpose (a few glyphs are optically
  // sized against a specific neighbour, and a union would force a lie), so the
  // scale is a test rather than a compiler error.
  const LEGAL = new Set([12, 14, 16, 20, 24]);
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out.push(...walk(path));
      else if (/\.tsx$/.test(path)) out.push(path);
    }
    return out;
  };

  it('every <Icon> size is on the scale', () => {
    const offenders: string[] = [];
    for (const file of [...walk('components'), ...walk('app')]) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        // Every NUMBER inside the size expression, not just a bare literal:
        // `size={compact ? 9 : 11}` slipped past the old `size=\{(\d+)\}` for
        // months and put 9px and 11px glyphs in the calendar's milestone chips,
        // which the browser audit (scripts/verify/audit-surfaces.mjs) then found
        // by measuring the rendered SVG.
        for (const m of line.matchAll(/<Icon\b[^>]*?\bsize=\{([^}]*)\}/g)) {
          // A size DERIVED from a scale factor is the optical exception the
          // seam's type deliberately allows (a play glyph at 0.44 of its well).
          // A literal - or a ternary of literals - is a choice, and choices go
          // on the scale.
          if (/[*/+%]|Math\./.test(m[1])) continue;
          for (const n of m[1].match(/(?<![\d.])\d+(?![\d.])/g) ?? []) {
            if (!LEGAL.has(Number(n))) offenders.push(`${file}:${i + 1} size={${m[1].trim()}}`);
          }
        }
      });
    }
    expect(offenders, `use ICON_SIZE (12/14/16/20/24):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('catches a size hidden in an expression (control)', () => {
    const LEGAL_LOCAL = new Set([12, 14, 16, 20, 24]);
    const read = (line: string) => {
      const out: string[] = [];
      for (const m of line.matchAll(/<Icon\b[^>]*?\bsize=\{([^}]*)\}/g)) {
        if (/[*/+%]|Math\./.test(m[1])) continue;
        for (const n of m[1].match(/(?<![\d.])\d+(?![\d.])/g) ?? []) if (!LEGAL_LOCAL.has(Number(n))) out.push(n);
      }
      return out;
    };
    expect(read('<Icon icon={Flag} size={compact ? 9 : 11} />')).toEqual(['9', '11']);
    expect(read('<Icon icon={Flag} size={ICON_SIZE.xs} />')).toEqual([]);
    expect(read('<Icon icon={Flag} size={16} />')).toEqual([]);
    // derived from a scale factor: an optical exception, not a choice
    expect(read('<Icon icon={Play} size={Math.round(S.play * 0.44)} />')).toEqual([]);
  });

  it('the scale is stated once, in the seam', () => {
    const src = readFileSync('components/ds/ui/icon.tsx', 'utf8');
    expect(src).toMatch(/export const ICON_SIZE = \{ xs: 12, sm: 14, md: 16, lg: 20, xl: 24 \}/);
  });
});

describe('the radius scale has no sixth value', () => {
  // `--radius-tag: 5px` was a Figma measurement that "sits between --radius-xs
  // and -sm" — a sixth step on a five-step scale, for a difference no one can
  // see. A chip is `--radius-xs`, which also keeps curvature proportional: an
  // ~18px chip at 4px matches a 28px button at 6px.
  it('every radius token resolves to the scale', () => {
    const css = readFileSync('app/ds-theme.css', 'utf8');
    const tag = css.match(/--radius-tag:\s*([^;]+);/);
    expect(tag, '--radius-tag not found').not.toBeNull();
    expect(tag![1].trim(), 'a raw px value is a new step on the scale').toMatch(/^var\(--radius-/);
  });

  it('the panel shadow is a token, not a raw black', () => {
    const css = readFileSync('app/ds-theme.css', 'utf8');
    const panel = css.match(/--shadow-panel:\s*([^;]+);/);
    expect(panel![1], 'a raw black shadow does nothing on a dark panel').not.toMatch(/rgba?\(\s*0\s+0\s+0/);
  });
});

describe('a page header never puts its actions off screen', () => {
  // The actions cluster is `shrink-0` on purpose — a page's verbs must not be
  // squeezed into unreadable stubs. But the row was `overflow: visible`, so a
  // cluster wider than the viewport simply LEFT the screen: measured on
  // Documents at 420px, the row wanted 442px in a 402px box and "New doc" sat
  // 40px past the right edge, unreachable at any scroll position.
  //
  // Wrapping gives the actions their own line on a phone. Above `sm` nothing
  // changes — `flex-wrap` costs nothing when everything already fits.
  const src = readFileSync('components/ui/page-header.tsx', 'utf8');

  it('the row wraps below sm and not above it', () => {
    expect(src).toMatch(/flex-wrap[^"]*sm:flex-nowrap/);
  });

  it('the actions stay right-aligned once wrapped', () => {
    expect(src, 'a wrapped cluster must not drift to the left edge').toMatch(/ms-auto flex shrink-0 items-center/);
  });
});

describe('a header row is square on all four sides', () => {
  // User: "the right side padding needs to be the same amount you give top and
  // bottom — and the same in the page header."
  //
  // Measured before: the TopBar sat 8px from top and bottom but 18px from the
  // right; the PageHeader 6/6 against 12 left and 16 right. The cause is that a
  // row's VERTICAL gap is derived — (row height − control height) / 2 — while
  // its horizontal gap is declared, so the two were never the same number.
  //
  // One token now, and the geometry is chosen to meet it: both rows are 44px,
  // every control in them is 28px, so (44−28)/2 = 8 — the same 8 the padding
  // declares. Square by construction rather than by tuning.
  const css = readFileSync('app/globals.css', 'utf8');

  it('one inset token drives both axes', () => {
    expect(css).toMatch(/--app-header-inset:\s*8px/);
    expect(css).toMatch(/--app-header-px:\s*var\(--app-header-inset\)/);
    // The old 4px lead pad existed to reach a total the inset now states.
    expect(css).toMatch(/--app-header-lead-px:\s*0px/);
  });

  it('both header rows share one height', () => {
    expect(css, 'a second height means a second vertical inset')
      .toMatch(/--page-header-h:\s*var\(--app-header-h/);
  });

  it('the TopBar declares its inset rather than deriving it', () => {
    // It carries a 1px border, so a FIXED height gave 7px of content-box gap
    // vertically against 8px horizontally — the last pixel of the asymmetry.
    const shell = readFileSync('components/shell/app-shell.tsx', 'utf8');
    expect(shell).toMatch(/padding: 'var\(--app-header-inset/);
    expect(shell, 'a fixed height re-derives the vertical gap').not.toMatch(/height: 'var\(--app-header-h, 44px\)'/);
  });
});

describe('a rail divider is not cut short by the scrollbar gutter', () => {
  // `scrollbar-gutter: stable` reserves space on ONE side, so a full-bleed child
  // inside a rail was flush left and stopped 7px short of the right — measured:
  // 223px dividers in a 230px rail, leaving a notch where the horizontal rule
  // should meet the rail's vertical border. `both-edges` makes it symmetric.
  it('the rail reserves its gutter on both edges', () => {
    const hub = readFileSync('components/ui/hub-layout.tsx', 'utf8');
    expect(hub).toMatch(/\[scrollbar-gutter:stable_both-edges\]/);
  });
});

// ── THE FOURTH EDGE TIER: no boundary, DECLARED ────────────────────────────
//
// A doc title, a form heading, a composer row: the text is the content, so a
// box around it would misdescribe what you are editing. Notion's page title is
// the reference and it has no field either.
//
// The problem was never the pattern — it was that the pattern had no name.
// 21 inputs across 16 files each hand-spelled `border-0 bg-transparent …
// outline-none`, so nothing distinguished "deliberately chromeless" from "a
// field that lost its border": not a reviewer, and not the contrast sweep,
// which reported all of them as failures with no way to rank them. On five
// separate pages that ambiguity is what stopped the sweep reaching zero.
//
// `data-chromeless` is the declaration. It costs nothing at runtime and it is
// the difference between an audit you can act on and one you learn to ignore.
describe('a chromeless editor declares itself', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) return files(full);
      return full.endsWith('.tsx') && !full.includes('.test.') ? [full] : [];
    });

  it('every borderless, fill-less input carries data-chromeless', () => {
    const offenders: string[] = [];
    for (const f of [...files('components'), ...files('app')]) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/border-(?:0|none)\s+bg-transparent/g)) {
        // Walk back to the opening tag: these JSX elements span many lines and
        // contain `>` inside arrow functions, so a tag regex cannot bound them.
        let start = src.lastIndexOf('<', m.index!);
        let tag: RegExpMatchArray | null = null;
        while (start !== -1) {
          tag = src.slice(start).match(/^<(\w+)/);
          if (tag) break;
          start = src.lastIndexOf('<', start - 1);
        }
        if (!tag || !['input', 'textarea', 'select'].includes(tag[1])) continue;
        if (src.slice(start, m.index!).includes('data-chromeless')) continue;
        offenders.push(`${f}:${src.slice(0, start).split('\n').length}`);
      }
    }
    expect(
      offenders,
      'A chromeless editor is a design decision, so say so: add `data-chromeless` ' +
        '(or use `inlineEdit` from components/ds/ui/input). Without it, a contrast ' +
        'sweep cannot tell your deliberate choice from a field that lost its border.',
    ).toEqual([]);
  });
});

// ── THE TASK PANEL'S QUIET PARTS ARE THE SYSTEM'S (2026-09-21) ─────────────
//
// The guard above reads CLASS strings. The task panel's seven fields wore their chrome in style objects
// (`border: 'none', background: 'transparent'`), so they slipped past it — and with no placeholder rule they wore
// the browser's own: the text colour at 50% alpha, a faded ink the colour rules forbid, measured at L 0.51 in dark
// against the house ink-500's 0.70. The same panel drew every menu row's check at 15% opacity, which read as "all
// of these are ticked", and spelled its two add lines by hand four pixels and a type size apart.
describe("the task panel's quiet parts are the system's", () => {
  const PANEL = [
    ...readdirSync('components/task-detail').filter((f) => f.endsWith('.tsx')).map((f) => `components/task-detail/${f}`),
    'components/reminders/reminder-chip.tsx',
    'components/attachments/attachments-panel.tsx',
  ];

  it('every field is a DS field — inlineEdit on the page, MenuField in a panel', () => {
    const offenders: string[] = [];
    for (const f of PANEL) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<(input|textarea)\b/g)) {
        const tag = src.slice(m.index!, src.indexOf('/>', m.index!));
        if (/type="file"/.test(tag)) continue;   // the hidden picker behind Add file is not an editor
        if (!/inlineEditProps|data-chromeless/.test(tag)) offenders.push(`${f}:${src.slice(0, m.index!).split('\n').length}`);
      }
    }
    expect(offenders, 'Use inlineEdit + inlineEditProps (components/ds/ui/input) or MenuField (components/ds/ui/menu).').toEqual([]);
  });

  it('a selection mark is drawn or not — never a faded ghost', () => {
    const offenders = FILES.filter((f) => /\.tsx$/.test(f)).flatMap((f) =>
      code(f).map((l, i) => (/icon=\{Check\}[^\n]*opacity:[^,}]*\?/.test(l) ? `${f}:${i + 1}` : null)),
    ).filter(Boolean);
    expect(offenders, 'Use SelectMark (components/task-detail/chip-ui) or a DS menu item: the slot stays, the mark is drawn only when chosen.').toEqual([]);
  });

  it('its two add lines are the one DS add line', () => {
    const drawer = code('components/task-detail/task-detail-drawer.tsx').join('\n');
    const files = code('components/attachments/attachments-panel.tsx').join('\n');
    expect(drawer, 'Add a subtask… is the add line\'s field shape').toMatch(/addLine\(\{ as: 'field' \}\)/);
    expect(files, 'the quiet Add file is the add line\'s button shape').toMatch(/<AddLine\b/);
  });
});

// ── A PANEL HAS ONE INSET ──────────────────────────────────────────────────
//
// `PanelBody` used to say, in its own comment, "consumers own the content
// padding" — a shared container delegating the one decision it exists to make.
// Measured on Home: headers at 16px above rows at 12 and 14, so a header and
// its own rows sat 2 and 4px apart INSIDE THE SAME CARD. Nobody can name that
// when they see it; they read the card as slightly wrong.
//
// The container still does not pad itself — a row needs full-bleed hover and
// selection, so the padding belongs to the row. It just says what the number
// is: `--panel-px`, via `PANEL_PX`.
describe('a panel has one inset', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) return files(full);
      return full.endsWith('.tsx') && !full.includes('.test.') ? [full] : [];
    });

  it('the header declares the token, not a literal', () => {
    const src = readFileSync('components/ds/ui/panel.tsx', 'utf8');
    expect(src).toMatch(/PanelHeader[\s\S]*?px-\[var\(--panel-px\)\]/);
    expect(src, 'PANEL_PX is what a row consumes').toMatch(/export const PANEL_PX/);
  });

  it('--panel-px is declared once, as a real value', () => {
    const g = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const decls = [...g.matchAll(/--panel-px:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(decls, '--panel-px must be declared exactly once').toHaveLength(1);
    expect(decls[0]).toMatch(/^\d+px$/);
  });

  it('no row inside a Today panel hardcodes its own leading inset', () => {
    // Scoped to the panels that were measured wrong rather than the whole app:
    // a row elsewhere may legitimately sit in a different container. What must
    // not happen again is a row inside a PanelBody picking its own number.
    const offenders: string[] = [];
    for (const f of files('components/today')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(?:px|ps)-(3|3\.5|4)\b/g)) {
        const line = src.slice(0, m.index!).split('\n').length;
        offenders.push(`${f}:${line} ${m[0]}`);
      }
    }
    expect(
      offenders,
      'Use px-[var(--panel-px)] so a row lines up with the header above it.',
    ).toEqual([]);
  });
});

// ── Touch targets ────────────────────────────────────────────────────────────
// Measured at 375px with a coarse pointer on 2026-09-12, by probing outward from
// each control's centre until it stopped responding: the task checkbox was
// 16×16, row menus 20×24, a date chip 46×17 — 4 failures on Tasks, 19 on the
// project page, 1 in the client portal, against WCAG 2.5.8's 24×24 floor.
describe('a target a finger can hit', () => {
  it('has a 24px floor, and only on a coarse pointer', () => {
    const css = readFileSync('app/ds-theme.css', 'utf8');
    const at = css.indexOf('@utility touch-min');
    expect(at, 'the floor utility exists').toBeGreaterThan(-1);
    const util = css.slice(at, at + 800);
    expect(util).toMatch(/pointer: coarse/);
    expect(util).toMatch(/min-width: 24px/);
    expect(util).toMatch(/min-height: 24px/);
  });

  it('gives the bare checkbox and the share pill that floor', () => {
    // A labelled checkbox already gets a 44px row; a BARE one in a task row is
    // 16px, and it is the most-tapped control in the product.
    expect(code('components/ds/ui/checkbox.tsx').join('\n')).toMatch(/"touch-min"/);
    expect(code('components/sharing/share-toggle.tsx').join('\n')).toMatch(/touch-min/);
  });

  it('gives a TRUNCATING title a min-height instead of an expander', () => {
    // `truncate` is overflow:hidden, so an ::after expander inside it is clipped
    // — measured 61×20 on a phone even with the utility applied.
    expect(code('components/tasks/task-row.tsx').join('\n')).toMatch(/truncate[^']*\[@media\(pointer:coarse\)\]:min-h-6/);
  });

  it('gives EVERY truncating target the coarse min-height, not just the task row', () => {
    // The task-row fix above was one copy of a recipe that existed six more
    // times: task rail, two in projects, habits, content and meetings. Found by
    // measuring on a coarse pointer (scripts/verify/audit-surfaces.mjs
    // --pointer coarse): habit names at 262x20, milestone chips at 276x22. A
    // class that both focuses and truncates is a target whose ::after would be
    // clipped, so the floor has to be a min-height on the element itself.
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => {
        for (const m of line.matchAll(/(["'`])((?:(?!\1).)*)\1/g)) {
          const cls = m[2];
          if (!/\bfocus-ring\b/.test(cls) || !/\btruncate\b/.test(cls)) continue;
          if (!/pointer:coarse\)\]:min-h-6/.test(cls)) offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('catches a truncating target without the floor (control)', () => {
    const cls = 'focus-ring min-w-0 flex-1 truncate rounded-xs text-left';
    expect(/\bfocus-ring\b/.test(cls) && /\btruncate\b/.test(cls) && !/pointer:coarse\)\]:min-h-6/.test(cls)).toBe(true);
  });

  it('caps a 44px expander back to the floor inside a dense cluster', () => {
    // 44 belongs to an ISOLATED icon control. Six pixels from its neighbour, the
    // star's expander was stealing the share pill's edge: 20 measured of 24.
    expect(code('components/tasks/task-row.tsx').join('\n')).toMatch(/\[@media\(pointer:coarse\)\]:after:w-6/);
    expect(readFileSync('components/ds/ui/icon-button.tsx', 'utf8'), 'an isolated icon control keeps 44')
      .toMatch(/after:w-11/);
  });
});

// ── Silent failures ──────────────────────────────────────────────────────────
// The portal's reply had FOUR ways to fail without a word, and a sweep found the
// same shape elsewhere: a client's approval, five of the owner's request
// actions, a refetch after restoring a document version, and a failed undo of a
// deletion. A press that does nothing and explains nothing is indistinguishable
// from one that worked.
describe('no action fails in silence', () => {
  // Reading one line past the `if` was the first version of this guard, and it
  // reported 68 offenders of which 36 were fine — a five-line branch that ends
  // in `toast(...)` looked identical to one that ends in nothing. The unit has
  // to be the BRANCH, so take it whole.
  function failureBranch(lines: string[], i: number): string {
    const head = lines[i];
    let body = head.slice(head.indexOf(')', head.indexOf("if ('error' in")) + 1);
    // Braced branches end when the brace closes; a bare one ends at its `;`.
    const complete = () => {
      let depth = 0, braced = false;
      for (const ch of body) {
        if (ch === '{') { depth++; braced = true; } else if (ch === '}') depth--;
      }
      return braced ? depth <= 0 : body.includes(';');
    };
    for (let j = i + 1; !complete() && j < Math.min(lines.length, i + 25); j++) body += `\n${lines[j]}`;
    return body;
  }

  it('every swallowed error is shown, propagated, or justified', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      // Two readings of the same file, deliberately. Detection runs on `code`,
      // because this guard's own header explains the pattern it forbids and
      // quoting it was the first false hit. The justification runs on the RAW
      // lines, because `// silent:` IS a comment — reading it from the stripped
      // copy blanked every exemption in the codebase, which is how this was
      // caught.
      const lines = code(file);
      const raw = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/if \('error' in \w+\)/.test(line)) return;
        const branch = failureBranch(lines, i);
        // Every channel a surface actually uses to tell someone. `fail`, `flash`
        // and `note` are three local names for the same act, which is its own
        // small finding — but they all reach the person.
        // `failed: true` is chat's channel: it turns the message itself into an inline `role="alert"`
        // "Not sent · Retry" — Slack's pattern, attached to the words that failed rather than floated
        // off in a toast. `lib/chat-ui.test.ts` proves that alert really renders, so this entry
        // cannot become a way to mark an error handled while showing nothing.
        const speaks = /toastReverted\(|toast\(|flash\(|fail\(|note\(|setHint\(|setErr\(|setError\(|setFormError\(|setNote\(|setMsg\(|setState\('error'\)|setDocState\('error'\)|throw new Error\(|failed: true/.test(branch);
        // Handing the error back to a caller that renders it counts too.
        const propagates = /return (res|r|checked)(\.error)?;|return \{ error/.test(branch);
        const justified = /\/\/ silent:/.test([raw[i - 1], raw[i - 2], raw[i - 3]].join(' '));
        if (!speaks && !propagates && !justified) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `these swallow a failure — show it, return it, or mark it \`// silent:\` with a reason:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// A revert has to say TWO things, and the second is the one that was missing
// everywhere: not just why it failed, but that the thing you are watching move
// back is the app agreeing with you. Tested rather than eyeballed because the
// failure mode is a seam — a capital letter mid-sentence, or two stops in a row
// — and a seam is exactly what nobody notices in a toast that shows for 4s.
describe('a revert says two things', () => {
  it('joins the reason to the consequence as two clean sentences', () => {
    expect(revertedMessage('Could not reach the server.'))
      .toBe('Could not reach the server. Your change was undone.');
  });

  it('supplies the stop the server left off', () => {
    expect(revertedMessage('That task is gone'))
      .toBe('That task is gone. Your change was undone.');
    // …and never doubles one that is already there.
    expect(revertedMessage('Is that task gone?'))
      .toBe('Is that task gone? Your change was undone.');
  });

  it('still says what happened when there is no reason at all', () => {
    for (const empty of [undefined, null, '', '   ']) {
      expect(revertedMessage(empty)).toBe('Something went wrong. Your change was undone.');
    }
  });
});

// A kanban column is ONE object, and the app drew it three ways: 300px `paper-2`
// wells on the content pipeline, 288px unfilled lanes divided by hairlines on
// Tasks (and Projects, which reuses it), 264px `paper-3` wells with 10px gutters
// on the database board. Seven differences between two of them. `BOARD_COLUMN`
// in components/ds/ui/board.tsx is the spec now, and this keeps the fourth board
// from inventing a fourth column.
describe('one kanban column', () => {
  // The week board is deliberately absent: its seven day columns FLEX to fit a
  // week on screen rather than taking the fixed width of a pile, which is the
  // finding behind zenboard-week-board-fit and a real difference in kind.
  const BOARDS = [
    'components/ds/ui/board.tsx',
    'components/tasks/tasks-board.tsx',
    'components/documents/database-board.tsx',
  ];

  it('every board draws its columns from the shared spec', () => {
    for (const file of BOARDS.filter((f) => f !== 'components/ds/ui/board.tsx')) {
      expect(readFileSync(file, 'utf8'), `${file} should use BOARD_COLUMN`).toMatch(/BOARD_COLUMN\./);
    }
  });

  // What you hold during a drag must be the width of the slot it drops into.
  // Derived from the spec's own classes rather than restated, so changing the
  // column, the well padding or the body padding without the card width fails.
  it('the held card is exactly as wide as a card in the column', async () => {
    const { BOARD_COLUMN } = await import('@/components/ds/ui/board');
    const px = (cls: string, re: RegExp) => { const m = cls.match(re); if (!m) throw new Error(`no ${re} in ${cls}`); return Number(m[1]); };
    const spacing = (cls: string, prefix: string) => px(cls, new RegExp(`(?:^|\\s)${prefix}-(\\d+(?:\\.\\d+)?)(?:\\s|$)`)) * 4;
    const column = px(BOARD_COLUMN.widthClass, /w-\[(\d+)px\]/);
    const well = spacing(BOARD_COLUMN.well, 'p');
    const body = spacing(BOARD_COLUMN.body, 'p');
    expect(px(BOARD_COLUMN.cardWidthClass, /w-\[(\d+)px\]/)).toBe(column - 2 * well - 2 * body);
  });

  it("a database board's held card is exactly as wide as a card in its column", async () => {
    const { BOARD_COLUMN } = await import('@/components/ds/ui/board');
    const db = BOARD_COLUMN.database;
    const column = Number(db.widthClass.match(/w-\[(\d+)px\]/)![1]);
    const inset = Number(db.column.match(/(?:^|\s)px-(\d+(?:\.\d+)?)(?:\s|$)/)![1]) * 4;
    expect(Number(db.cardWidthClass.match(/w-\[(\d+)px\]/)![1])).toBe(column - 2 * inset);
  });

  // A column body is NOT a scroll box. Columns are content-height, so overflow
  // there scrolls nothing — it only clips, and CSS makes a box that clips one
  // axis clip both. Found in a user's screen recording (2026-09-14): swiping or
  // dragging near a column scrolled THE COLUMN sideways, leaving cards cut at a
  // hard edge, and cards dropped between columns were clipped mid-flight.
  it('a column body never clips its cards', async () => {
    const { BOARD_COLUMN } = await import('@/components/ds/ui/board');
    expect(BOARD_COLUMN.body).not.toMatch(/overflow/);
    const board = readFileSync('components/ds/ui/board.tsx', 'utf8');
    const bodyLine = board.split('\n').find((l) => l.includes('BOARD_COLUMN.body') && l.includes('className'));
    expect(bodyLine, 'the DS board must not add overflow to the column body').not.toMatch(/overflow/);
  });

  it('no board hard-codes a column width of its own', () => {
    const offenders: string[] = [];
    for (const file of BOARDS) {
      code(file).forEach((line, i) => {
        // The spec's own declaration is the one place the number may appear.
        if (/widthClass:/.test(line)) return;
        if (/cardWidthClass:/.test(line)) return;
        if (/w-\[(2[4-9][0-9]|3[0-9][0-9])px\]|width:\s*(2[4-9][0-9]|3[0-9][0-9])\b/.test(line)) {
          offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders, `use BOARD_COLUMN.widthClass:\n${offenders.join('\n')}`).toEqual([]);
  });

});

describe('a colour class names a colour the theme declares', () => {
  // THE BUG CLASS (2026-09-14). Tailwind v4 generates a colour utility only for
  // a `--color-*` declared inside `@theme`. Any other name generates NOTHING and
  // says nothing: the danger button's pressed state was a ramp step that never
  // existed (`active:bg-danger-700`), so pressing looked exactly like hovering;
  // the current step's halo (`ring-berry-alpha-20`) drew the label colour on its
  // own page; the Content editor's "Changes requested" box had no fill. 17 uses
  // across 10 classes, each measured in the browser before and after
  // (scripts/verify/verify-colour-fixes.mjs). The scanner is shared with the
  // runtime audit, so the two can never disagree about what a colour class is.
  const theme = readTheme('app');
  const tokens = (src: string) => undeclaredColourClasses(src, theme).map((o) => o.token);

  it('reads the theme it guards', () => {
    // A parser that found no theme would call every class undeclared — or, with
    // no families, call none of them colour classes and pass everything.
    expect(theme.colours.has('ink-900')).toBe(true);
    expect(theme.colours.has('danger-600')).toBe(true);
    expect(theme.colours.has('danger-700')).toBe(false);
    expect(theme.families.has('danger')).toBe(true);
    expect(theme.other.text.has('label'), 'type sizes are read too').toBe(true);
  });

  it('catches every shape a dead colour class takes (control)', () => {
    const src = [
      `<div className="bg-danger-50 active:bg-danger-700 border-t-danger-200" />`,      // a step the ramp lacks
      `cn('data-[state=open]:ring-berry-alpha-20', "text-success-700/80")`,              // variant brackets, opacity
      "const card = `rounded-lg border bg-surface bg-paper-1`;",                         // a family's undeclared base
    ].join('\n');
    expect(tokens(src)).toEqual([
      'bg-danger-50', 'active:bg-danger-700', 'border-t-danger-200',
      'data-[state=open]:ring-berry-alpha-20', 'text-success-700/80',
      'bg-surface', 'bg-paper-1',
    ]);
  });

  it('passes what the theme can draw, and what is not a colour at all', () => {
    const src = [
      `cn("bg-ink-900 text-danger border-line-soft ring-4 ring-surface-active hover:wash-over bg-paper/60")`,
      `<p className="text-label text-ui shadow-lift-2 border-s bg-[var(--accent)] text-balance" />`,
      "const dynamic = `bg-${tone}-100`;",
    ].join('\n');
    expect(tokens(src)).toEqual([]);
  });

  it('a class named inside a comment is documentation, not a class', () => {
    const src = [
      '{/* this asked for `bg-surface`,',
      '    and `danger-50` never existed */}',
      '// active:bg-danger-700 drew nothing',
      "const url = 'https://example.com/a'; // text-success-700",
    ].join('\n');
    expect(tokens(src)).toEqual([]);
  });

  it('no colour class in the app names a colour the theme never declared', () => {
    const offenders = sourceFiles(['components', 'app', 'lib']).flatMap((file) =>
      undeclaredColourClasses(readFileSync(file, 'utf8'), theme).map((o) => `${file}:${o.line}  ${o.token}`));
    expect(offenders, `these classes generate no CSS — use a declared token (a ramp step that exists, or the semantic name):\n${offenders.join('\n')}`).toEqual([]);
  });
});


// ── One overlay chrome ──────────────────────────────────────────────────────
// The user, 2026-09-15, beside the "New ▾" menu: "database uses old styling with
// outline — we have to use new styling". The app's menus drew the decorative edge
// and a soft shadow; popovers, selects, comboboxes, hover cards, the toolbar, a
// database's panels, the property and composer panels drew a 28% ink outline and a
// heavy lift. OVERLAY_CLASS (components/ds/ui/menu.tsx) is the one chrome now; this
// keeps a floating surface from growing its own again.
describe('one overlay chrome', () => {
  const OLD = /border-line-strong[^"'`]*shadow-lift-2|shadow-lift-2[^"'`]*border-line-strong|border:\s*'1px solid var\(--line-pop\)'/;
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
  });

  it('no floating surface paints the old outline and lift', () => {
    const offenders: string[] = [];
    for (const file of walk('components')) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        if (OLD.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `use OVERLAY_CLASS (components/ds/ui/menu.tsx):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every DS floating surface takes its chrome from OVERLAY_CLASS', () => {
    const offenders: string[] = [];
    for (const name of readdirSync('components/ds/ui').filter((n) => n.endsWith('.tsx'))) {
      const lines = readFileSync(join('components/ds/ui', name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        // A Radix content surface, or a panel on the dropdown layer.
        if (!/\bz-dropdown\b|origin-\(--radix-(?:dropdown-menu|context-menu)-content-transform-origin\)/.test(line)) return;
        const ctx = lines.slice(i, i + 4).join(' ');
        if (!/\b(?:OVERLAY_CLASS|MENU_PANEL_CLASS)\b/.test(ctx)) offenders.push(`components/ds/ui/${name}:${i + 1}`);
      });
    }
    expect(offenders, `a floating surface with a chrome of its own — use OVERLAY_CLASS:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('an exit starts fast', () => {
  // Both motion skills the project works from say an entrance and an exit take
  // the same curve FAMILY - one that moves in its first frames - and that the
  // difference between them is duration. The app had every overlay exit on an
  // ease-in, which holds nearly still exactly when the reader is watching, so a
  // closing menu read as sticky. This asserts the PROPERTY (does the curve move
  // early) rather than the token's name, because a hand-written cubic-bezier
  // would slip past a spelling check.
  const ds = readFileSync('app/ds-theme.css', 'utf8');
  const curves = new Map<string, number[]>();
  for (const src of [readFileSync('app/tokens.css', 'utf8'), ds]) {
    for (const m of src.matchAll(/(--ease-[a-z-]+):\s*cubic-bezier\(([^)]+)\)/g)) {
      curves.set(m[1], m[2].split(',').map((n) => parseFloat(n)));
    }
  }
  // The first control point above the diagonal (y1 > x1) is what "starts fast"
  // means: the element has covered ground by the time the eye arrives.
  const startsFast = (pts: number[]) => pts[1] > pts[0];
  const isExit = (name: string) => /(^|-)(exit|out)(-|$)/.test(name);

  it('reads the curves it guards, and rejects the one this replaced (control)', () => {
    expect(curves.get('--ease-out-quiet')).toEqual([0.23, 1, 0.32, 1]);
    expect(startsFast(curves.get('--ease-out-quiet')!)).toBe(true);
    expect(startsFast([0.4, 0, 1, 1]), 'the ease-in this sprint removed must fail the check').toBe(false);
  });

  it('every named exit animation takes a curve that starts fast', () => {
    const offenders: string[] = [];
    for (const line of ds.split('\n').filter((l) => /^\s*--animate-/.test(l))) {
      const name = line.match(/--animate-([a-z-]+):/)?.[1] ?? '';
      if (!isExit(name)) continue;
      const ease = line.match(/var\((--ease-[a-z-]+)\)/)?.[1];
      const pts = ease ? curves.get(ease) : undefined;
      if (!pts || !startsFast(pts)) offenders.push(line.trim());
    }
    expect(offenders).toEqual([]);
  });

  it('no component hand-rolls a closing animation on a slow-starting curve', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => {
        for (const m of line.matchAll(/data-\[state=closed\]:animate-\[[^\]]*var\((--ease-[a-z-]+)\)/g)) {
          const pts = curves.get(m[1]);
          if (!pts || !startsFast(pts)) offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('a drop lands where the drag said it would', () => {
  // dnd-kit draws two objects — the overlay you hold and the card that moves —
  // and with no drop animation they never meet: the held one vanishes at the
  // cursor while the card is already elsewhere. Measured before the fix on the
  // content board (scripts/verify/verify-drop-settle.mjs): a 138px jump with
  // nothing in between. `dropSettle()` flies the overlay to the card's own rect;
  // `NO_SETTLE` is the declared exception, for an overlay that is a LABEL for
  // the thing rather than the thing itself.
  const overlays: Array<{ file: string; line: number; text: string }> = [];
  for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
    code(file).forEach((line, i) => {
      if (/<DragOverlay/.test(line)) overlays.push({ file, line: i + 1, text: line });
    });
  }

  it('finds the overlays it is meant to guard (control)', () => {
    expect(overlays.length, 'no <DragOverlay> found - the scan is broken, not the app').toBeGreaterThanOrEqual(4);
  });

  it('every lifted overlay either settles or declares that it does not', () => {
    const offenders = overlays
      .filter((o) => !/dropSettle\(\)|NO_SETTLE/.test(o.text))
      .map((o) => `${o.file}:${o.line}`);
    expect(offenders).toEqual([]);
  });

  it('nobody spells the bare null that used to hide the decision', () => {
    const offenders = overlays
      .filter((o) => /dropAnimation=\{null\}/.test(o.text))
      .map((o) => `${o.file}:${o.line}`);
    expect(offenders).toEqual([]);
  });
});

describe('one duration ladder', () => {
  // There used to be two, with the same words on different numbers: --dur-* in
  // the app layer (80/120/180/240/320) beside --duration-* in the DS layer
  // (20/100/150/200), so "fast" meant 120ms or 100ms depending on which file a
  // component had grown up in, and "instant" differed by 4x. The 76 app-layer
  // uses folded into the ladder the other 178 already spoke.
  const dsRaw = readFileSync('app/ds-theme.css', 'utf8');
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rungs = [...strip(dsRaw).matchAll(/--duration-([a-z]+):\s*(\d+)ms/g)].map((m) => ({ name: m[1], ms: Number(m[2]) }));

  it('reads the ladder it guards (control)', () => {
    expect(rungs.map((r) => r.name)).toEqual(['instant', 'fast', 'base', 'slow']);
  });

  it('gives every rung a different number', () => {
    const byMs = new Map<number, string[]>();
    for (const r of rungs) byMs.set(r.ms, [...(byMs.get(r.ms) ?? []), r.name]);
    const twins = [...byMs.entries()].filter(([, names]) => names.length > 1);
    expect(twins, 'two names for one wait is how a scale drifts back into two').toEqual([]);
  });

  it('keeps no rung nobody asks for', () => {
    const files = [...FILES, 'app/globals.css', 'app/tokens.css'].filter((f) => /\.(tsx|css)$/.test(f));
    const corpus = files.map((f) => strip(readFileSync(f, 'utf8'))).join('\n');
    const unused = rungs.filter((r) => !corpus.includes(`var(--duration-${r.name})`) && !new RegExp(`\\bduration-${r.name}\\b`).test(corpus));
    expect(unused.map((r) => r.name)).toEqual([]);
  });

  it('nobody asks for the retired ladder', () => {
    const offenders: string[] = [];
    for (const file of [...FILES, 'app/globals.css', 'app/tokens.css', 'app/ds-theme.css'].filter((f) => /\.(tsx|css)$/.test(f))) {
      const body = /\.css$/.test(file) ? strip(readFileSync(file, 'utf8')) : code(file).join('\n');
      if (/var\(--dur-[a-z]+\)/.test(body)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('one easing vocabulary', () => {
  // Three names for two curves, until 2026-09-16: --ease-out and --ease-out-quiet
  // were byte-identical, and globals.css kept a third (--ease, .2/.8/.2/1) on 61
  // hover and colour transitions. What survives says what it is FOR:
  //   --ease-out-quiet — arrivals, departures, colour. The app's curve.
  //   --ease-standard  — movement ON screen, which accelerates out of rest.
  //   --ease-drawer    — sheets and drawers sliding in from an edge (the iOS curve).
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ds = readFileSync('app/ds-theme.css', 'utf8');
  const curves = new Map<string, number[]>();
  for (const src of [readFileSync('app/tokens.css', 'utf8'), ds]) {
    for (const m of strip(src).matchAll(/(--ease-[a-z-]+):\s*cubic-bezier\(([^)]+)\)/g)) {
      curves.set(m[1], m[2].split(',').map((n) => parseFloat(n)));
    }
  }
  const startsFast = (pts: number[]) => pts[1] > pts[0];
  // The one animation that is neither an arrival nor a departure: a highlight
  // sweeping across a block already in front of the reader.
  const ON_SCREEN = new Set(['--animate-flash-highlight']);

  it('reads the vocabulary it guards (control)', () => {
    expect([...curves.keys()].sort()).toEqual(['--ease-drawer', '--ease-hover', '--ease-out-quiet', '--ease-standard']);
  });

  it('every arrival and departure starts fast', () => {
    const offenders: string[] = [];
    for (const line of strip(ds).split('\n').filter((l) => /^\s*--animate-/.test(l))) {
      const name = line.match(/(--animate-[a-z-]+):/)?.[1] ?? '';
      if (ON_SCREEN.has(name)) continue;
      const ease = line.match(/var\((--ease-[a-z-]+)\)/)?.[1];
      const pts = ease ? curves.get(ease) : undefined;
      if (!pts || !startsFast(pts)) offenders.push(line.trim());
    }
    expect(offenders, 'an entrance that holds still for its first frames reads as sluggish').toEqual([]);
  });

  it('spells a curve in the token files and the motion seam, nowhere else', () => {
    const allowed = new Set(['app/tokens.css', 'app/ds-theme.css', 'components/ds/ui/motion.tsx', 'lib/drop-settle.ts', 'app/design-system.test.ts']);
    const offenders: string[] = [];
    for (const file of [...FILES, 'app/globals.css', 'app/tokens.css', 'app/ds-theme.css'].filter((f) => /\.(tsx|css)$/.test(f))) {
      if (allowed.has(file)) continue;
      const body = /\.css$/.test(file) ? strip(readFileSync(file, 'utf8')) : code(file).join('\n');
      if (/cubic-bezier\(/.test(body)) offenders.push(file);
    }
    expect(offenders, 'a hand-written curve is a fourth vocabulary nobody can search for').toEqual([]);
  });

  it('nobody asks for a retired easing name', () => {
    const offenders: string[] = [];
    for (const file of [...FILES, 'app/globals.css', 'app/tokens.css', 'app/ds-theme.css'].filter((f) => /\.(tsx|css)$/.test(f))) {
      const body = /\.css$/.test(file) ? strip(readFileSync(file, 'utf8')) : code(file).join('\n');
      if (/var\(--ease\)|var\(--ease-out\)|var\(--ease-in-quiet\)|var\(--ease-inout\)/.test(body)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('the global press does not eat the hover', () => {
  // `transition` is a SHORTHAND. The rule that presses every button
  // (`button:not(.zb-nopress)`, specificity 0,1,1, and late in the file)
  // outranks `.zb-press` and `.zb-nav-item` (0,1,0) and therefore REPLACED
  // their transition lists. Measured on /dev-preview/shell before the fix: an
  // `a.zb-nav-item` transitioned `background, color` while the BUTTON beside it
  // reported `transition-property: transform` — every hover wash in the app was
  // landing instantly on buttons, including the ones `.zb-press` exists for.
  const css = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.split(/(?=button:not\(\.zb-nopress\))/).find((chunk) => /^button:not\(\.zb-nopress\)[^{]*\{[^}]*transition:/.test(chunk));

  it('finds the rule it guards (control)', () => {
    expect(rule, 'the global press rule moved or changed shape - re-point this guard').toBeTruthy();
  });

  it('carries the colour properties it would otherwise erase', () => {
    const body = (rule ?? '').slice(0, (rule ?? '').indexOf('}'));
    for (const prop of ['transform', 'background-color', 'color', 'border-color', 'box-shadow', 'opacity', 'filter']) {
      expect(body, `the press rule drops ${prop}, so every button loses it`).toContain(prop);
    }
  });

  it('presses on the quiet curve with no bounce, and washes on the hover curve', () => {
    const body = (rule ?? '').slice(0, (rule ?? '').indexOf('}'));
    expect(body).toMatch(/transform var\(--duration-fast\) var\(--ease-out-quiet\)/);
    expect(body).toMatch(/background-color var\(--duration-fast\) var\(--ease-hover\)/);
  });
});

describe('an animation takes its numbers from the ladder', () => {
  // Components used to spell their own: fadein at 120, 140, 160, 180, 200, 220,
  // 240, 260ms and blurin at 320 and 360 — ten durations for two effects, none
  // of them a rung. A looping animation is exempt: a spinner is not a UI
  // transition, and its seconds belong to the loop rather than to the ladder.
  const raw = /[0-9]+\s*m?s\b/;

  it('catches the shape it guards (control)', () => {
    expect(raw.test("animation: 'fadein 240ms'")).toBe(true);
    expect(raw.test("animation: 'fadein var(--duration-base) var(--ease-out-quiet)'")).toBe(false);
  });

  it('no component spells a one-shot duration', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => {
        if (!/animation:|animate-\[/.test(line)) return;
        if (/infinite/.test(line)) return;
        const frag = line.match(/animation:[^;'"`]*|animate-\[[^\]]*\]/)?.[0] ?? '';
        if (raw.test(frag)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('a hand-rolled layer hands focus back', () => {
  // Radix restores focus for every overlay it owns, which is why the DS menus
  // and dialogs behave. The layers this app rolls itself did not: measured on
  // /dev-preview/shell, ⌘K opened the palette from the Search button and Escape
  // left `document.activeElement` on <body>, so the next Tab began again at the
  // top of the page and a keyboard reader lost their place for opening a
  // palette they then closed. `lib/use-focus-return.ts` is the one rule.
  const PAINTS_A_LAYER = /z-modal|z-dropdown|z-overlay|OVERLAY_CLASS|position: 'fixed'|fixed inset-0/;
  const OWNS_ESCAPE = /=== ['"]Escape['"]/;
  // Declared exceptions, each for a reason that is not "we forgot":
  const DECLARED: Record<string, string> = {
    'components/documents/block-editor.tsx': 'the editor puts focus back in the text itself on every close',
    'components/documents/rich-text.tsx': 'same - a caret is the thing being returned to',
    'components/documents/database-view.tsx': 'cell editing returns focus to the cell it left',
    'components/focus/focus-timer.tsx': 'its Escape closes a picture-in-picture WINDOW, not a focus layer',
    'components/task-detail/chip-ui.tsx': 'restores its own way, and more precisely - it separates Escape from click-away, which is where the shared hook got that nuance',
  };

  const layers = FILES.filter((f) => /\.tsx$/.test(f)).filter((f) => {
    const src = code(f).join('\n');
    return PAINTS_A_LAYER.test(src) && OWNS_ESCAPE.test(src);
  });

  it('finds the layers it guards (control)', () => {
    expect(layers.length, 'the scan found no hand-rolled layers - it is broken, not the app').toBeGreaterThanOrEqual(10);
  });

  it('every one either returns focus or says why it does not', () => {
    const offenders = layers.filter((f) => !DECLARED[f] && !/useFocusReturn/.test(code(f).join('\n')));
    expect(offenders).toEqual([]);
  });

  it('keeps no stale exception', () => {
    const stale = Object.keys(DECLARED).filter((f) => !layers.includes(f));
    expect(stale, 'an exception for something that is no longer a layer is a note nobody will delete').toEqual([]);
  });
});

describe('a curve in JavaScript is the seam\'s curve', () => {
  // The CSS side was already one vocabulary; the JS side still spelled its own.
  // Motion's EXIT_ROW left on [0.4, 0, 1, 1] - an ease-in - and the board and the
  // content calendar each hand-wrote a near-copy of the house curve with its own
  // duration. Emil Kowalski's rule is the same in both languages: a strong
  // ease-out for anything arriving or leaving, from one place.
  it('no component outside the motion seam writes a curve literal', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f) && !/components\/ds\/ui\/motion\.tsx$/.test(f))) {
      code(file).forEach((line, i) => { if (/\bease:\s*\[\s*[\d.]+\s*,/.test(line)) offenders.push(`${file}:${i + 1}`); });
    }
    expect(offenders).toEqual([]);
  });

  it('every curve the seam declares starts fast', () => {
    const seam = readFileSync('components/ds/ui/motion.tsx', 'utf8');
    const literals = [...seam.matchAll(/\bease:\s*\[([\d.\s,]+)\]/g)].map((m) => m[1].split(',').map(Number));
    expect(literals.length, 'the seam declares its curve').toBeGreaterThan(0);
    for (const [x1, y1] of literals) expect(y1, `a seam curve starts slow: x1=${x1} y1=${y1}`).toBeGreaterThan(x1);
  });
});

describe('reduced motion keeps the fade and takes the movement', () => {
  // Emil Kowalski: "Reduced motion means fewer and gentler animations, not
  // zero." The app used to collapse every animation and transition to 0.01ms,
  // so a reduced-motion reader lost the fade that says a menu opened along with
  // the slide that could have hurt. Now every keyframe that moves has an
  // opacity-only twin of the same name inside the reduced-motion block.
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const MOVES = /transform|translate|scale|rotate|height|filter/;
  const EXEMPT = new Set(['spin', 'shimmer']);   // a spinner's turn is its status; shimmer is motion-safe gated

  // Pull out the bodies of every `@media (prefers-reduced-motion: reduce) { ... }`.
  const reducedBlocks = (css: string) => {
    const out: string[] = [];
    for (const m of css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)) {
      let depth = 1, i = m.index! + m[0].length;
      const start = i;
      for (; i < css.length && depth > 0; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
      out.push(css.slice(start, i - 1));
    }
    return out;
  };
  const keyframes = (css: string) =>
    [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => ({ name: m[1], body: m[2] }));

  const globals = strip(readFileSync('app/globals.css', 'utf8'));
  const ds = strip(readFileSync('app/ds-theme.css', 'utf8'));
  const reduced = reducedBlocks(globals).join('\n');
  const outside = (css: string) => { let o = css; for (const b of reducedBlocks(css)) o = o.replace(b, ''); return o; };
  const moving = [...keyframes(outside(ds)), ...keyframes(outside(globals))].filter((k) => MOVES.test(k.body) && !EXEMPT.has(k.name));
  const twins = new Map(keyframes(reduced).map((k) => [k.name, k.body]));

  it('finds the moving keyframes it guards (control)', () => {
    expect(moving.length).toBeGreaterThanOrEqual(15);
    expect(MOVES.test('from { opacity: 0; transform: translateY(8px); }')).toBe(true);
  });

  it('gives every moving keyframe a twin of the same name', () => {
    expect(moving.filter((k) => !twins.has(k.name)).map((k) => k.name)).toEqual([]);
  });

  it('lets no twin move', () => {
    expect([...twins].filter(([, body]) => MOVES.test(body)).map(([name]) => name)).toEqual([]);
  });

  it('keeps transitions for colour and opacity instead of killing them all', () => {
    expect(reduced, 'the old kill-switch is back').not.toMatch(/animation-duration:\s*0\.01ms/);
    expect(reduced).toMatch(/transition-property:[^;]*opacity[^;]*!important/);
    expect(reduced).not.toMatch(/transition-property:[^;]*transform/);
  });

  it('strips movement from Motion targets in the seam as well', () => {
    const seam = readFileSync('components/ds/ui/motion.tsx', 'utf8');
    expect(seam).toMatch(/initial=\{still \? onlyFades\(initial\)/);
    expect(seam).toMatch(/MOVES = new Set\(\[[^\]]*'transform'[^\]]*'height'/);
  });
});

describe('a toast animates with transitions, not keyframes', () => {
  // Emil Kowalski, from building Sonner: rapidly-triggered UI uses transitions,
  // because a keyframe restarts from zero when interrupted and a transition
  // retargets from where the element already is. Toasts are the canonical case.
  const card = readFileSync('components/ds/ui/toast.tsx', 'utf8');
  it('enters from @starting-style and leaves on a transition', () => {
    expect(card).toMatch(/starting:opacity-0/);
    expect(card).toMatch(/transition-\[opacity,translate,scale\]/);
    expect(card).toMatch(/onTransitionEnd=/);
  });
  it('runs no keyframe animation on the card', () => {
    const cls = card.match(/className=\{`flex w-\[360px\][^`]*`\}/)?.[0] ?? '';
    expect(cls, 'the toast card class was not found - re-point this guard').not.toBe('');
    expect(cls).not.toMatch(/\banimate-/);
  });
});

describe('an animation class draws something, and a keyframe has one name', () => {
  // Three silent failures, all found on 2026-09-16:
  //   · `animate-fadein` was used by six overlays with no --animate-fadein token,
  //     so Tailwind compiled NOTHING and every one of them cut in;
  //   · `animate-pop-in` on the centre peek was dead the same way;
  //   · `fadein` was defined in ds-theme.css (opacity) AND globals.css (with a 4px
  //     lift), and the later one won, so every scrim quietly lifted.
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cssFiles = ['app/tokens.css', 'app/ds-theme.css', 'app/globals.css'];
  const outsideReduced = (css: string) => {
    let out = '', i = 0;
    for (const m of css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)) {
      out += css.slice(i, m.index!);
      let depth = 1, j = m.index! + m[0].length;
      for (; j < css.length && depth > 0; j++) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; }
      i = j;
    }
    return out + css.slice(i);
  };
  const tokens = new Set(cssFiles.flatMap((f) => [...strip(readFileSync(f, 'utf8')).matchAll(/--animate-([a-z0-9-]+)\s*:/g)].map((m) => m[1])));
  const TAILWIND_DEFAULTS = new Set(['spin', 'ping', 'pulse', 'bounce', 'none']);
  const deadIn = (text: string) => [...text.matchAll(/(?<![\w[-])animate-([a-z][a-z0-9-]*)\b/g)].map((m) => m[1]).filter((n) => !tokens.has(n) && !TAILWIND_DEFAULTS.has(n));

  it('catches a class with no token behind it (control)', () => {
    expect(deadIn('data-[state=open]:animate-pop-in')).toEqual(['pop-in']);
    expect(deadIn('data-[state=open]:animate-fadein animate-spin animate-[fadein_1s]')).toEqual([]);
  });

  it('every animate-* class in the app has a token or is a Tailwind default', () => {
    const offenders: string[] = [];
    for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
      code(file).forEach((line, i) => { for (const n of deadIn(line)) offenders.push(`${file}:${i + 1} animate-${n}`); });
    }
    expect(offenders).toEqual([]);
  });

  it('no keyframe name is defined twice (reduced-motion twins aside)', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const f of cssFiles) {
      for (const m of outsideReduced(strip(readFileSync(f, 'utf8'))).matchAll(/@keyframes\s+([\w-]+)/g)) {
        if (seen.has(m[1])) dupes.push(`${m[1]} (${seen.get(m[1])} and ${f})`); else seen.set(m[1], f);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('only the motion seam imports the animation library', () => {
    const offenders = [...FILES, ...walk('lib')].filter((f) => /\.(tsx|ts)$/.test(f) && !/components\/ds\/ui\/motion\.tsx$/.test(f) && !/\.test\./.test(f))
      .filter((f) => /from ['"](motion\/react|framer-motion)['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('an element that animates in does not position itself with transform', () => {
  // A running animation outranks an inline style, so a keyframe that animates
  // `transform` REPLACES an inline `transform: translate(...)` for as long as it
  // runs. Measured 2026-09-17 at 10% playback: the selection toolbar faded in
  // 146px right and 46px low of where it lives, over the words just selected, and
  // jumped when the entrance ended. Position with the `translate` property, which
  // composes with `transform` instead of losing to it.
  const ANIMATES = /animation:|\[animation:|animate-\[|\banimate-(?:emerge|rise|exit|fadein|tick|pop-in|slide-(?:in|out)-[a-z]+)\b/;
  const POSITIONS_WITH_TRANSFORM = /\btransform:\s*[^,}]*\btranslate\(/;
  const offendersIn = (lines: string[], file: string) => {
    const out: string[] = [];
    lines.forEach((line, i) => {
      if (!ANIMATES.test(line)) return;
      // The style object can sit several lines below the className, past comments,
      // so read to the end of the element's opening tag (a line ending in `>` that
      // is not an arrow), capped at 30 lines. A fixed window let the reverted
      // toolbar through: its comment pushed `transform` out of reach.
      let end = i;
      while (end < Math.min(lines.length - 1, i + 30) && !/(^|[^=])>\s*$/.test(lines[end])) end++;
      if (POSITIONS_WITH_TRANSFORM.test(lines.slice(Math.max(0, i - 3), end + 1).join('\n'))) out.push(`${file}:${i + 1}`);
    });
    return out;
  };

  it('catches the shape it guards: the toolbar as it was (control)', () => {
    const before = [
      '<Toolbar',
      '  className="fixed z-dropdown [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]"',
      ...Array(8).fill('  '),   // eight blanked comment lines, as code() leaves them
      '  style={{',
      '    left: tb.x,',
      "    transform: tb.below ? 'translate(-50%, 8px)' : 'translate(-50%, calc(-100% - 8px))',",
      '  }}',
      '>',
    ];
    expect(offendersIn(before, 'before.tsx')).toEqual(['before.tsx:2']);
    const after = before.map((l) => l.replace(/transform: .*$/, "translate: tb.below ? '-50% 8px' : '-50% calc(-100% - 8px)',"));
    expect(offendersIn(after, 'after.tsx')).toEqual([]);
  });

  it('no animated element carries a positioning transform', () => {
    const offenders = FILES.filter((f) => /\.tsx$/.test(f)).flatMap((f) => offendersIn(code(f), f));
    expect(offenders).toEqual([]);
  });
});

describe('an anchored surface grows from its trigger', () => {
  // Emil Kowalski: popovers scale in from their trigger, never from centre (modals
  // exempt). Measured 2026-09-17 at 10% playback: the dropdown's own Radix origin
  // (`0% 0px`) lost to `data-[side=bottom]:origin-top`, the Select used a fixed
  // `origin-top`, so both grew from their top CENTRE and their anchored corner slid
  // 5.8px and 5.1px across the trigger; and `emerge`'s 4px rise lifted every menu
  // below its trigger UP toward it.
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const frames = (css: string, name: string) =>
    strip(css).match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`))?.[1] ?? '';
  const RADIX: Record<string, string> = {
    'components/ds/ui/dropdown-menu.tsx': '--radix-dropdown-menu-content-transform-origin',
    'components/ds/ui/popover.tsx': '--radix-popover-content-transform-origin',
    'components/ds/ui/hover-card.tsx': '--radix-hover-card-content-transform-origin',
    'components/ds/ui/tooltip.tsx': '--radix-tooltip-content-transform-origin',
    'components/ds/ui/select.tsx': '--radix-select-content-transform-origin',
    'components/ds/ui/combobox.tsx': '--radix-popover-content-transform-origin',
    'components/ds/ui/filter.tsx': '--radix-popover-content-transform-origin',
  };
  const FIXED_ORIGIN = /data-\[side=[a-z]+\]:origin-|\borigin-(?:top|bottom|left|right|center)(?:-(?:left|right))?(?![\w-])/;

  it('reads what it guards (control)', () => {
    expect(frames('@keyframes emerge { from { opacity: 0; transform: translateY(4px) scale(0.96); } }', 'emerge')).toMatch(/translate/);
    expect(FIXED_ORIGIN.test('data-[state=open]:animate-emerge origin-top"')).toBe(true);
    expect(FIXED_ORIGIN.test('data-[side=bottom]:origin-top')).toBe(true);
    expect(FIXED_ORIGIN.test('origin-(--radix-select-content-transform-origin)')).toBe(false);
  });

  it('the anchored entrances scale and fade, and never travel', () => {
    for (const [file, name] of [['app/ds-theme.css', 'emerge'], ['app/globals.css', 'zb-pop-in']] as const) {
      const body = frames(readFileSync(file, 'utf8'), name);
      expect(body, `@keyframes ${name} not found`).not.toBe('');
      expect(body, `${name} travels`).not.toMatch(/translate/);
      expect(body, `${name} lost its scale`).toMatch(/scale\(0\.9\d\)/);
    }
  });

  it('a hand-placed panel grows from the point that opened it (the event composer)', () => {
    // Not Radix, so nothing computed an origin and it grew from its own centre, beside the click (2026-09-21).
    const src = code('components/calendar/event-composer.tsx').join('\n');
    expect(src).toMatch(/transformOrigin:\s*pos\?\.origin/);
    expect(FIXED_ORIGIN.test(src)).toBe(false);
  });

  it('every Radix surface grows from the point Radix computes, and nothing overrides it', () => {
    const offenders: string[] = [];
    for (const [file, v] of Object.entries(RADIX)) {
      const src = code(file).join('\n');
      if (!src.includes(`origin-(${v})`)) offenders.push(`${file}: no origin-(${v})`);
      if (FIXED_ORIGIN.test(src)) offenders.push(`${file}: a fixed or side-based origin`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('a scrim leaves with its panel', () => {
  // Every DS overlay faded in and declared nothing for out, so Radix unmounted the
  // scrim at once while the panel played its 100ms exit. Measured 2026-09-17 at 10%
  // playback: a quarter of the way through closing "New project", the overlay was
  // already gone and the dialog was a ghost over a fully bright page. And the other
  // way round: PageView's centre peek had no exit, so a fading scrim would outlive it.
  const OVERLAY = /<RDlg\.Overlay\b[^>]*className="([^"]*)"/;
  const offendersIn = (lines: string[], file: string) => {
    const out: string[] = [];
    lines.forEach((line, i) => {
      const cls = OVERLAY.exec(line)?.[1];
      if (!cls || !/data-\[state=open\]:animate-/.test(cls)) return;
      if (!/data-\[state=closed\]:animate-fadeout\b/.test(cls)) out.push(`${file}:${i + 1} scrim has no exit`);
      // …and the panel it dims leaves too (the Content that follows the overlay).
      const panel = lines.slice(i + 1, i + 16).join('\n');
      if (/<RDlg\.Content\b/.test(panel) && /data-\[state=open\]:animate-/.test(panel) && !/data-\[state=closed\]:animate-/.test(panel)) out.push(`${file}:${i + 1} panel has no exit`);
    });
    return out;
  };

  it('catches both halves (control)', () => {
    expect(offendersIn(['<RDlg.Overlay className="fixed inset-0 data-[state=open]:animate-fadein" />'], 'a.tsx')).toEqual(['a.tsx:1 scrim has no exit']);
    expect(offendersIn([
      '<RDlg.Overlay className="fixed inset-0 data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout" />',
      '<RDlg.Content className={cn("fixed", "data-[state=open]:animate-rise")}>',
    ], 'b.tsx')).toEqual(['b.tsx:1 panel has no exit']);
  });

  it('every DS overlay fades out, and the panel it dims leaves with it', () => {
    const offenders = FILES.filter((f) => /^components\/ds\/ui\/.*\.tsx$/.test(f)).flatMap((f) => offendersIn(code(f), f));
    expect(offenders).toEqual([]);
  });
});

describe('nothing a keyboard opens animates', () => {
  // Emil Kowalski: "Never animate keyboard-initiated actions." Measured 2026-09-17 at
  // 10% playback: `s` on a task opened the Schedule menu on a 100ms zb-pop-in, `/` in a
  // document opened the slash menu on the same, and every g-chord page and triage
  // decision replayed an entrance. One rule in globals.css now turns off anything
  // wearing `zb-enter` (or `.zb-page-in`) while <html data-input="keyboard">, which
  // lib/input-modality.ts stamps.
  const ENTRANCE = /\banimate-(?:emerge|rise|exit|fadein|fadeout|tick|pop-in|slide-(?:in|out)-[a-z]+)\b|animate-\[(?:fadein|zb-pop-in|zb-modal-in|fade-rise|blurin|reveal-(?:down|up))_|\[animation:(?:zb-pop-in|fade-rise|fadein|blurin|reveal-(?:down|up))_|animation:\s*['"`](?:zb-pop-in|zb-modal-in|fade-rise|fadein|blurin|slideIn|emerge|rise)\b/;
  // Each for a reason that is not "a key could open it":
  const DECLARED: { file: string; has: string; why: string }[] = [
    { file: 'app/login/page.tsx', has: 'blurin', why: 'plays once on page load; nothing was pressed' },
    { file: 'components/tasks/triage.tsx', has: 'text-center', why: 'the "Inbox is clear" reward, once per sitting' },
  ];
  const css = readFileSync('app/globals.css', 'utf8');
  const unmarked = (file: string, lines: string[]) => {
    // Counted per file rather than per element: an inline `style` animation can sit
    // many lines below the className that carries the marker (chip-ui.tsx).
    const entrances = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => ENTRANCE.test(line))
      .filter(({ line }) => !DECLARED.some((d) => d.file === file && line.includes(d.has)));
    const markers = (lines.join('\n').match(/\bzb-enter\b/g) ?? []).length;
    return entrances.length > markers ? `${file} (entrances at ${entrances.map((e) => e.n).join(', ')}; ${markers} zb-enter)` : null;
  };

  it('catches the shape it guards (control)', () => {
    expect(unmarked('a.tsx', ["className={cn(MENU, '[animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]')}"])).not.toBeNull();
    expect(unmarked('b.tsx', ["style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}"])).not.toBeNull();
    expect(unmarked('c.tsx', ["className=\"zb-enter\" style={{ animation: 'slideIn var(--duration-slow)' }}"])).toBeNull();
    expect(ENTRANCE.test('className="animate-spin"')).toBe(false);
  });

  it('the stylesheet turns them off while the keyboard drives', () => {
    expect(css).toMatch(/html\[data-input="keyboard"\] \.zb-enter,\s*html\[data-input="keyboard"\] \.zb-page-in \{ animation: none !important; \}/);
  });

  it('every keyboard-reachable entrance wears zb-enter or says why not', () => {
    const files = [...new Set([...FILES.filter((f) => /\.tsx$/.test(f) && !f.startsWith('app/dev-preview/')), 'app/login/page.tsx'])];
    const offenders = files.map((f) => unmarked(f, code(f))).filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it('keeps no stale exception', () => {
    const stale = DECLARED.filter((d) => !code(d.file).some((l) => ENTRANCE.test(l) && l.includes(d.has)));
    expect(stale.map((d) => d.file)).toEqual([]);
  });

  it('a command menu never animates', () => {
    expect(code('components/ds/ui/command-menu.tsx').join('\n')).not.toMatch(/animate-(?:fadein|fadeout|rise|exit|emerge)/);
  });

  it('the motion seam lets what a key created simply be there', () => {
    // Appear, Move and IconSwap: each reads the hand before it animates.
    const seam = readFileSync('components/ds/ui/motion.tsx', 'utf8');
    expect(seam.match(/lastInput\(\) === 'keyboard'/g)?.length).toBe(3);
  });
});

describe('a drawer enters from the edge it lives on', () => {
  // The phone navigation drawer sits on the LEFT edge and entered from the right, across
  // the page, on the arrivals curve (measured 2026-09-17: its left edge at 238px on frame
  // 0, 8px at the end), and it vanished in one frame when closed.
  const shell = code('components/shell/app-shell.tsx').join('\n');
  const ds = readFileSync('app/ds-theme.css', 'utf8');

  it('reads what it guards (control)', () => {
    expect(ds).toMatch(/@keyframes slide-in-right \{ from \{ transform: translateX\(100%\); \} \}/);
  });

  it('the left drawer takes the left-edge keyframes, both ways', () => {
    expect(shell).toMatch(/animate-slide-in-left/);
    expect(shell).toMatch(/animate-slide-out-left/);
    expect(shell).not.toMatch(/\bslideIn\b/);
  });

  it('every edge keyframe starts off its own edge, arrives on the drawer curve and leaves faster', () => {
    expect(ds).toMatch(/@keyframes slide-in-left \{ from \{ transform: translateX\(calc\(-100% - 8px\)\); \} \}/);
    expect(ds).toMatch(/@keyframes slide-out-left \{ to \{ transform: translateX\(calc\(-100% - 8px\)\); \} \}/);
    for (const side of ['left', 'right', 'bottom']) {
      expect(ds).toMatch(new RegExp(`--animate-slide-in-${side}: slide-in-${side} var\\(--duration-slow\\) var\\(--ease-drawer\\);`));
      expect(ds).toMatch(new RegExp(`--animate-slide-out-${side}: slide-out-${side} var\\(--duration-fast\\) var\\(--ease-drawer\\);`));
    }
  });
});

describe("transitions take Emil's curves and the ladder's numbers", () => {
  // Emil Kowalski's decision tree: entering or leaving → ease-out, moving on screen →
  // ease-in-out, hover or colour → ease. Measured 2026-09-17, colour ran on THREE
  // curves: the strong ease-out (97% of a 100ms wash in its first 50ms), Tailwind's
  // own default (12 of 52 transitioning elements on the tasks page), and the in-out
  // movement curve on the DS Button and Switch. Eleven `transition:` strings spelled
  // raw milliseconds past a ladder guard that only read `animation:`.
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const COLOUR_ON_WRONG_CURVE = /\b(?:color|background(?:-color)?|border-color|outline-color|box-shadow|fill|stroke|filter|opacity) var\(--duration-[a-z]+\) var\(--ease-(?:out-quiet|standard|drawer)\)/;
  const TW_COLOUR_ON_WRONG_CURVE = /\btransition-(?:colors|shadow|opacity)\b.*\bease-(?:out-quiet|standard|drawer)\b|\bease-(?:out-quiet|standard|drawer)\b.*\btransition-(?:colors|shadow|opacity)\b/;
  const RAW_MS = /\btransition(?:-duration)?:\s*['"`]?[^;'"`}]*\b\d+(?:\.\d+)?m?s\b/;
  const TW_RAW_MS = /\bduration-(?:\d|\[\d)/;
  const MOVES = /\btransition-transform\b|\btransition-\[[^\]]*\b(?:transform|translate|scale|rotate|left|width)\b[^\]]*\]/;
  const tsx = FILES.filter((f) => /\.tsx$/.test(f) && !f.startsWith('app/dev-preview/'));
  const css = ['app/globals.css', 'app/ds-theme.css', 'app/tokens.css'].map((f) => [f, strip(readFileSync(f, 'utf8'))] as const);

  it('reads the shapes it guards (control)', () => {
    expect(COLOUR_ON_WRONG_CURVE.test('background var(--duration-fast) var(--ease-out-quiet)')).toBe(true);
    expect(COLOUR_ON_WRONG_CURVE.test('transform var(--duration-fast) var(--ease-out-quiet)')).toBe(false);
    expect(TW_COLOUR_ON_WRONG_CURVE.test('"transition-colors duration-fast ease-standard cursor-pointer "')).toBe(true);
    expect(RAW_MS.test("transition: 'background 120ms, color 120ms'")).toBe(true);
    expect(RAW_MS.test("transition: 'color var(--duration-fast) var(--ease-hover)'")).toBe(false);
    expect(MOVES.test("cn('transition-transform duration-fast', open && 'rotate-90')")).toBe(true);
  });

  it('a colour change takes the hover curve', () => {
    const offenders = [
      ...css.flatMap(([f, body]) => body.split('\n').map((l, i) => (COLOUR_ON_WRONG_CURVE.test(l) ? `${f}:${i + 1}` : null))),
      ...tsx.flatMap((f) => code(f).map((l, i) => (COLOUR_ON_WRONG_CURVE.test(l) || TW_COLOUR_ON_WRONG_CURVE.test(l) ? `${f}:${i + 1}` : null))),
    ].filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it("Tailwind's own transition defaults are the house's", () => {
    const ds = readFileSync('app/ds-theme.css', 'utf8');
    expect(ds).toMatch(/--default-transition-duration: var\(--duration-fast\);/);
    expect(ds).toMatch(/--default-transition-timing-function: var\(--ease-hover\);/);
  });

  it('no transition spells raw milliseconds', () => {
    const offenders = [
      ...css.flatMap(([f, body]) => body.split('\n').map((l, i) => (RAW_MS.test(l) ? `${f}:${i + 1}` : null))),
      ...tsx.flatMap((f) => code(f).map((l, i) => (RAW_MS.test(l) || TW_RAW_MS.test(l) ? `${f}:${i + 1}` : null))),
    ].filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it('movement names its curve', () => {
    const offenders = tsx.flatMap((f) => code(f).map((l, i) => (MOVES.test(l) && !/\bease-[a-z-]+\b/.test(l) ? `${f}:${i + 1}` : null))).filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it('an inline transition on a button keeps the press, and none says `all`', () => {
    const offenders: string[] = [];
    for (const f of tsx) {
      code(f).forEach((l, i) => {
        const inline = l.match(/transition:\s*['"`]([^'"`]*)['"`]/)?.[1];
        if (!inline) return;
        if (/^all\b|,\s*all\b/.test(inline)) offenders.push(`${f}:${i + 1} transition: all`);
        if (/<button\b/.test(l) && !/\btransform\b/.test(inline)) offenders.push(`${f}:${i + 1} a button's inline transition drops the press`);
      });
    }
    // Style helpers spread into <button>s, which a line cannot see.
    for (const [f, helper] of [['components/rituals/ritual-flow.tsx', 'function pickRow'], ['components/focus/focus-timer.tsx', 'function Chip']] as const) {
      const src = code(f).join('\n');
      const body = src.slice(src.indexOf(helper), src.indexOf(helper) + 900);
      if (!/transition:[^\n]*\btransform var\(--duration-fast\) var\(--ease-out-quiet\)/.test(body)) offenders.push(`${f} ${helper} drops the press`);
    }
    // A CLASS helper keeps the press by leaving it alone: the global button rule is unlayered, so it outranks any
    // transition utility — only an inline transition or an opt-out could take the press away. The task panel's
    // chips became classes (2026-09-21) so an empty chip could take a hover wash a style object cannot give.
    const chips = code('components/task-detail/chip-ui.tsx').join('\n');
    const at = chips.indexOf('export const chipClass');
    const chipHelper = at < 0 ? '' : chips.slice(at, chips.indexOf(');', at));
    if (!chipHelper || /transition|zb-nopress/.test(chipHelper)) offenders.push('components/task-detail/chip-ui.tsx chipClass drops the press');
    expect(offenders).toEqual([]);
  });
});

describe('a fill or a thumb moves with transform', () => {
  // Emil Kowalski: animate transform and opacity only. Progress fills transitioned
  // `width` and the shell's switch thumbs `left`, re-running layout on every frame of
  // every change. Two declared exceptions, each because the layout itself must move.
  // `${` too: a transition built from a shared constant (`padding-left ${RAIL_MOTION}`)
  // is still a layout transition, and this read straight past it.
  const LAYOUT = /\btransition-\[[^\]]*\b(?:width|height|left|top|right|bottom|margin[a-z-]*|padding[a-z-]*|grid-template-[a-z]+)\b[^\]]*\]|transition:\s*['"`][^'"`]*\b(?:width|min-width|height|left|top|margin[a-z-]*|padding[a-z-]*|grid-template-[a-z]+) (?:var|\d|\$\{)/;
  const DECLARED: Record<string, string> = {
    'components/shell/app-shell.tsx': 'the desktop sidebar collapse: the content beside it has to reflow',
    // Inside that same collapse, which already lays the rail out on every frame: the
    // pinned indent glides and its heading folds, rather than jumping on frame 0.
    'components/shell/pinned-rail.tsx': 'the pinned indent and heading fold with the sidebar collapse',
    'components/ds/ui/drawer.tsx': "the bottom sheet's detent height",
    // Out-of-flow indicators whose width follows the item under them. `scaleX` would
    // distort their rounded ends, and an absolutely positioned, childless element lays
    // out only itself. Documented decisions: design-system.md §4.19 and §4.30.
    'components/ds/ui/segmented.tsx': 'the sliding thumb takes the width of the item it sits under',
    'components/ds/ui/tabs.tsx': 'the sliding underline takes the width of the tab it sits under',
  };

  it('reads the shapes it guards (control)', () => {
    expect(LAYOUT.test('"block h-full rounded-full transition-[width] duration-base"')).toBe(true);
    expect(LAYOUT.test("transition: 'width 300ms'")).toBe(true);
    expect(LAYOUT.test("'absolute top-0.5 transition-[left] duration-fast'")).toBe(true);
    expect(LAYOUT.test("transition: 'transform var(--duration-base) var(--ease-standard)'")).toBe(false);
  });

  it('nothing but the declared exceptions animates a layout property', () => {
    const offenders = FILES.filter((f) => /\.tsx$/.test(f) && !f.startsWith('app/dev-preview/') && !DECLARED[f])
      .flatMap((f) => code(f).map((l, i) => (LAYOUT.test(l) ? `${f}:${i + 1}` : null))).filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it('keeps no stale exception', () => {
    expect(Object.keys(DECLARED).filter((f) => !code(f).some((l) => LAYOUT.test(l)))).toEqual([]);
  });
});

describe('an icon that changes with state cross-fades', () => {
  // Copy → Check and Play ↔ Pause swapped in one frame, a flicker rather than a change
  // of state. IconSwap (the motion seam) takes better-ui's contextual-icon values, and
  // Emil Kowalski's blur-masked crossfade; a key still swaps it instantly.
  const SWAP = /icon=\{(?:copied|st\.running|running) \? /;
  const seam = readFileSync('components/ds/ui/motion.tsx', 'utf8');

  it('reads what it guards (control)', () => {
    expect(SWAP.test('<Icon icon={copied ? Check : Copy} size={16} />')).toBe(true);
  });

  it('takes the exact values, with no bounce', () => {
    expect(seam).toMatch(/swap: \{ type: 'spring', duration: 0\.3, bounce: 0 \}/);
    expect(seam).toMatch(/opacity: 0, transform: 'scale\(0\.25\)', filter: 'blur\(4px\)'/);
    expect(seam).toMatch(/opacity: 1, transform: 'scale\(1\)', filter: 'blur\(0px\)'/);
  });

  it('every state icon swap goes through IconSwap', () => {
    const offenders = FILES.filter((f) => /\.tsx$/.test(f) && !f.startsWith('app/dev-preview/'))
      .flatMap((f) => code(f).map((l, i) => (SWAP.test(l) && !/<IconSwap\b/.test(l) ? `${f}:${i + 1}` : null))).filter(Boolean);
    expect(offenders).toEqual([]);
  });
});

describe('the sidebar collapses in place', () => {
  // Emil Kowalski's slow-motion check, on the most visible chrome in the app. Measured
  // 2026-09-17 at 10% playback: on the collapse's first frame every label had
  // unmounted and every row had re-centred while the panel was still 230px wide, so
  // the icons slid ~90px left as it narrowed; the pinned icons, losing a 12px indent
  // too, travelled further, and the "Pinned" heading's unmount jumped the list up.
  const shell = code('components/shell/app-shell.tsx').join('\n');
  const pinned = code('components/shell/pinned-rail.tsx').join('\n');
  const RECENTRES = /(?:justifyContent|alignItems): collapsed \? 'center'/;
  const UNMOUNTS_A_LABEL = /\{!collapsed && \(?\s*<span\b/;

  it('reads the shapes it guards (control)', () => {
    expect(RECENTRES.test("padding: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start'")).toBe(true);
    expect(UNMOUNTS_A_LABEL.test("{!collapsed && <span style={{ overflow: 'hidden' }}>{def.label}</span>}")).toBe(true);
    expect(UNMOUNTS_A_LABEL.test('{!collapsed && (\n        <span style={{ flex: 1 }}>')).toBe(true);
  });

  it('nothing re-centres and no label unmounts when the rail collapses', () => {
    for (const [file, src] of [['app-shell.tsx', shell], ['pinned-rail.tsx', pinned]] as const) {
      expect(src, `${file} re-centres on collapse`).not.toMatch(RECENTRES);
      expect(src, `${file} unmounts a label on collapse`).not.toMatch(UNMOUNTS_A_LABEL);
    }
    expect(shell, 'the collapsed header swaps in a second brand element').not.toMatch(/<Mark\b/);
    expect(pinned, 'the Pinned heading folds rather than unmounting').toMatch(/gridTemplateRows: collapsed \? '0fr' : '1fr'/);
  });

  it('everything the collapse moves shares one duration and curve', () => {
    const motion = readFileSync('components/shell/rail-motion.ts', 'utf8');
    expect(motion).toMatch(/export const RAIL_MOTION = 'var\(--duration-slow\) var\(--ease-standard\)';/);
    expect(shell).toMatch(/width \$\{RAIL_MOTION\}, min-width \$\{RAIL_MOTION\}/);
    expect(shell).toMatch(/padding \$\{RAIL_MOTION\}/);
    expect(shell).toMatch(/margin-left \$\{RAIL_MOTION\}/);
    expect(pinned).toMatch(/padding-left \$\{RAIL_MOTION\}/);
    expect(pinned).toMatch(/grid-template-rows \$\{RAIL_MOTION\}/);
  });
});

describe('a resize drag moves the element and commits once', () => {
  // Emil Kowalski: during a drag, write the element directly. PageView's side peek and
  // the DS Drawer each carried their own copy of one handle, and both committed the
  // width on every pointermove — PageView into localStorage, re-rendering the whole
  // open page per move. Measured on /dev-preview/page-view over 40 moves: 40 storage
  // writes, 3.7ms median / 14.8ms worst per move before; 1 write, 0.9ms / 1.4ms after.
  const handle = code('components/ds/ui/panel-resize.tsx').join('\n');
  const moveBody = handle.slice(handle.indexOf('onPointerMove='), handle.indexOf('onPointerUp='));

  it('finds the move handler it guards (control)', () => {
    expect(moveBody, 'onPointerMove not found in panel-resize.tsx').toMatch(/onPointerMove=/);
  });

  it('writes the width to the element during the drag and commits only on release', () => {
    expect(moveBody).toMatch(/\.style\.width = /);
    expect(moveBody, 'a commit per pointermove is back').not.toMatch(/onWidth\(|setWidth\(/);
  });

  it('is the one handle both panels use', () => {
    for (const file of ['components/ds/ui/page-view.tsx', 'components/ds/ui/drawer.tsx']) {
      const src = code(file).join('\n');
      expect(src, `${file} uses the shared handle`).toMatch(/<PanelResizeHandle\b/);
      expect(src, `${file} carries its own separator again`).not.toMatch(/role="separator"/);
    }
  });
});
