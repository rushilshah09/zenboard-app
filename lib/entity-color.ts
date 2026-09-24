// ── ENTITY COLOUR — the one place a project's or list's hue is decided ─────
//
// A project picks one of five colours. That choice used to be stored, and
// painted, as a RAW HEX — `#9A1B6F` in the row, `#9A1B6F` in the style prop.
// A hex cannot know what theme it is in, so on a dark rail the deep ones
// measured 1.66–2.53:1 against their own background: a coloured dot you could
// not see, and a checked LayerToggle whose box disappeared.
//
// The event/tag palette (lib/palette.ts) had already solved exactly this by
// resolving through per-theme CSS variables. Scopes were the last entity family
// still on literals — and the array was declared twice, in `lib/task-scopes.ts`
// and `lib/actions/projects.ts`, so "the five colours" had two homes.
//
// Values and the contrast measurements live in app/theme-shadcn.css.
//
// ── WHY NOT JUST REUSE `--pal-*` ───────────────────────────────────────────
// Because they are different jobs. `--pal-*` is nine saturated hues for events
// and tags, where variety is the point and colours must stay apart from each
// other. These five are the muted set a project picks from, chosen to sit
// quietly beside text. Folding them together would make every project chip
// louder — a visual decision, not a technical one, so it is not one to make by
// accident while fixing contrast.

export const SCOPE_COLOR_NAMES = ['plum', 'sage', 'amber', 'blue', 'indigo'] as const;
export type ScopeColorName = (typeof SCOPE_COLOR_NAMES)[number];

/** Stored values from before this file existed. A row keeps its hex; this is
 *  how the hex is read back as a name, so nothing needed a migration.
 *  `amber` is the one whose LIGHT value changed (#C88A3B measured 2.94:1 on a
 *  white card — it was too light for light mode), so the legacy hex maps to the
 *  name and the name resolves to the corrected value. */
const LEGACY_HEX: Record<string, ScopeColorName> = {
  '#9a1b6f': 'plum',
  '#7b8b5f': 'sage',
  '#c88a3b': 'amber',
  '#2b5cb0': 'blue',
  '#5c4fb8': 'indigo',
};

/** The five, in OKLab, for nearest-match. Taken from the LIGHT values, which
 *  are the ones a stored hex would ever have been chosen against. */
const ANCHORS: Record<ScopeColorName, [number, number, number]> = {
  plum: oklab(0x9a, 0x1b, 0x6f),
  sage: oklab(0x7b, 0x8b, 0x5f),
  amber: oklab(0xc8, 0x8a, 0x3b),
  blue: oklab(0x2b, 0x5c, 0xb0),
  indigo: oklab(0x5c, 0x4f, 0xb8),
};

function oklab(R: number, G: number, B: number): [number, number, number] {
  const f = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [f(R), f(G), f(B)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** Read a stored colour back as a name.
 *
 *  Accepts a name (new rows), one of the five legacy hexes (existing rows), or
 *  ANY other hex — an import, a fixture, a row from before the picker was
 *  constrained. That last case is why this does a nearest match rather than
 *  giving up: a hex it does not recognise would otherwise be painted literally,
 *  which is precisely the theme-blindness this file exists to remove. (Measured:
 *  a stored `#3B6E8F` sat at 2.96:1 on the week board's dark ground.)
 *
 *  An arbitrary hex CANNOT be made theme-aware without changing it, so the only
 *  question is which change surprises least. Nearest-in-OKLab keeps the hue the
 *  person was reaching for — a blue stays the blue — and is deterministic, so
 *  the same row always looks the same. */
export function scopeColorName(stored?: string | null): ScopeColorName | null {
  if (!stored) return null;
  const v = stored.trim().toLowerCase();
  if ((SCOPE_COLOR_NAMES as readonly string[]).includes(v)) return v as ScopeColorName;
  const exact = LEGACY_HEX[v];
  if (exact) return exact;

  const m = /^#([0-9a-f]{6})$/.exec(v) ?? /^#([0-9a-f]{3})$/.exec(v);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const t = oklab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  // Match on HUE ANGLE, not Euclidean distance in a/b. Distance conflates hue
  // with chroma — both are measured from the same origin — so a pale sky blue
  // (#7DD3FC) came out nearer muted olive `sage` than `blue`, because low
  // chroma put it close to the axis regardless of which way it pointed. Hue is
  // what a person means by "the blue one"; chroma and lightness are what the
  // theme is allowed to move.
  const chroma = Math.hypot(t[1], t[2]);
  if (chroma < 0.02) return DEFAULT_SCOPE_COLOR;   // a grey has no hue to match
  const hue = Math.atan2(t[2], t[1]);
  let best: ScopeColorName = DEFAULT_SCOPE_COLOR;
  let bestD = Infinity;
  for (const name of SCOPE_COLOR_NAMES) {
    const a = ANCHORS[name];
    let dh = Math.abs(hue - Math.atan2(a[2], a[1]));
    if (dh > Math.PI) dh = 2 * Math.PI - dh;       // hue is circular
    // Chroma breaks ties between two anchors at a similar angle (plum and
    // indigo sit only ~40 degrees apart), at about a tenth of hue's weight.
    const dc = Math.abs(chroma - Math.hypot(a[1], a[2]));
    const d = dh + dc * 0.1;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

/** The fill for an entity, as a theme-aware CSS value.
 *
 *  `fallback` is what an entity with no colour gets. It is a real token rather
 *  than an optional argument on purpose: the LayerToggle bug that started all
 *  of this was a nullable colour falling through to `--primary` and rendering a
 *  BLACK TICKED BOX, pixel-identical to the "mark done" checkboxes below it. */
export function scopeFill(stored?: string | null, fallback = 'var(--color-ink-400)'): string {
  const name = scopeColorName(stored);
  return name ? `var(--scope-${name})` : fallback;
}

/** The glyph colour ON that fill — a tick, a small icon.
 *
 *  It is a token per colour, not a constant, because the right answer FLIPS:
 *  white reads best on light plum (7.61:1) and near-black wins on light amber
 *  (5.16:1 vs white's 2.94:1). A hardcoded `text-white` was correct for three
 *  of five in light and for NONE of five in dark, where every fill is light. */
export function scopeOn(stored?: string | null, fallback = 'var(--color-text-onsolid)'): string {
  const name = scopeColorName(stored);
  return name ? `var(--scope-${name}-on)` : fallback;
}

/** The palette a picker offers. Names, not hexes — a picker that hands back a
 *  hex is how the theme-blind values got into the database in the first place. */
export const SCOPE_COLORS = SCOPE_COLOR_NAMES;

/** The default for a new project or list. */
export const DEFAULT_SCOPE_COLOR: ScopeColorName = 'plum';
