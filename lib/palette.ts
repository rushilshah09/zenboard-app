// Semantic event/tag palette — the design-system bridge to the CSS tokens
// (--pal-<name>-dot / -bg / -text) defined in globals.css. A stable hash maps any
// string key to one of the nine hues, so the same event title / tag / calendar
// always gets the same color (like a real multi-calendar app), and it adapts to
// light/dark automatically because it resolves through CSS variables.

export const PALETTE_NAMES = [
  'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
] as const;
export type PaletteName = (typeof PALETTE_NAMES)[number];

export type PaletteColor = { name: PaletteName; dot: string; bg: string; text: string };

function tokens(name: PaletteName): PaletteColor {
  return { name, dot: `var(--pal-${name}-dot)`, bg: `var(--pal-${name}-bg)`, text: `var(--pal-${name}-text)` };
}

/** Deterministic palette color for a string key (same key → same hue). */
export function paletteFor(key: string): PaletteColor {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return tokens(PALETTE_NAMES[h % PALETTE_NAMES.length]);
}

/** Explicit color by name (e.g. for a chosen category). */
export function palette(name: PaletteName): PaletteColor {
  return tokens(name);
}

/**
 * Color for a calendar event. Synced (Google) events read as blue — a clear
 * "external calendar" signal — while Zenboard-native events take a stable hue
 * from their title, giving the board calm, meaningful variety.
 */
export function eventColor(e: { title: string; source?: string | null }): PaletteColor {
  const synced = !!e.source && e.source !== 'manual';
  return synced ? tokens('blue') : paletteFor(e.title || 'untitled');
}
