// Appearance preferences — theme / density. These are per-device choices (no
// account row), so they live in localStorage and are applied to <html> as data-*
// attributes, which globals.css already understands (html[data-theme="dark"],
// html[data-density="compact"]). The same logic runs twice: once as a blocking
// inline boot script (no flash of the wrong theme) and once live from the
// settings panel — keep them in sync.

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
export type Accent = 'berry' | 'plum' | 'amber' | 'sage' | 'green' | 'blue';

export const THEME_KEY = 'zb-theme';
export const DENSITY_KEY = 'zb-density';
export const ACCENT_KEY = 'zb-accent';

export const DEFAULT_THEME: Theme = 'light';
export const DEFAULT_DENSITY: Density = 'comfortable';
// Berry (#C41C72) is the brand accent (design-system.md §2.1.3) — the sole hue
// that means "you, here, now". It is the stylesheet default (tokens.css ships
// light + dark berry), so the switcher pins --accent only for a NON-berry pick.
export const DEFAULT_ACCENT: Accent = 'berry';

// The selectable accents. The hex feeds --accent; every other accent token
// (-soft, -border, -deep, -text) derives from it via color-mix in globals.css.
export const ACCENTS: { id: Accent; label: string; hex: string }[] = [
  { id: 'berry', label: 'Berry', hex: '#C41C72' },
  { id: 'plum', label: 'Plum', hex: '#9A1B6F' },
  { id: 'amber', label: 'Amber', hex: '#C88A3B' },
  { id: 'sage', label: 'Sage', hex: '#7B8B5F' },
  { id: 'green', label: 'Green', hex: '#55964A' },
  { id: 'blue', label: 'Blue', hex: '#3086FF' },
];
const ACCENT_HEX: Record<Accent, string> = Object.fromEntries(ACCENTS.map((a) => [a.id, a.hex])) as Record<Accent, string>;
export const accentHex = (a: Accent): string => ACCENT_HEX[a] ?? ACCENT_HEX.berry;

// 'system' resolves to light/dark against the OS; everything else is itself.
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

// Apply the appearance to <html>. Called live when the user changes a control.
export function applyAppearance(theme: Theme, density: Density, accent: Accent = DEFAULT_ACCENT) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('data-theme', resolveTheme(theme));
  el.setAttribute('data-density', density);
  // Accent is the ONE hue in the product — the semantic signal for "active,
  // selected, important" states (checked boxes, selection tint, focus ring, links,
  // on-toggles). Chrome stays monochrome; accent is ~1% of the surface. Pin the
  // chosen swatch to --accent; globals.css derives every -soft/-border/-ring/-deep
  // from it. --on-accent is the foreground ON an accent fill — every swatch is
  // saturated enough that a near-white glyph reads best.
  el.style.setProperty('--accent', accentHex(accent));
  el.style.setProperty('--on-accent', '#FDFEFB');
}

// Fired after any control commits a change, so every appearance surface
// (settings panel, sidebar quick-toggle) can re-sync from the source of truth.
export const APPEARANCE_EVENT = 'zb:appearance';

// localStorage is the source of truth. Read it (with defaults) — never trust
// React closure snapshots, which can be stale when two controls fire fast.
export function readAppearance(): { theme: Theme; density: Density; accent: Accent } {
  if (typeof localStorage === 'undefined') {
    return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY, accent: DEFAULT_ACCENT };
  }
  return {
    theme: (localStorage.getItem(THEME_KEY) as Theme) || DEFAULT_THEME,
    density: (localStorage.getItem(DENSITY_KEY) as Density) || DEFAULT_DENSITY,
    accent: (localStorage.getItem(ACCENT_KEY) as Accent) || DEFAULT_ACCENT,
  };
}

// The single mutation path: merge a patch onto the stored values, persist,
// apply to <html>, and broadcast. Returns the resolved next values.
export function commitAppearance(patch: Partial<{ theme: Theme; density: Density; accent: Accent }>) {
  const next = { ...readAppearance(), ...patch };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_KEY, next.theme);
    localStorage.setItem(DENSITY_KEY, next.density);
    localStorage.setItem(ACCENT_KEY, next.accent);
  }
  applyAppearance(next.theme, next.density, next.accent);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APPEARANCE_EVENT));
  return next;
}

// Blocking boot script (stringified) — runs in <head>-time before first paint so
// the chosen theme is in place before any styled content renders. Self-contained,
// defensive, and mirrors applyAppearance().
export const themeInitScript = `(function(){try{
var d=document.documentElement;
var t=localStorage.getItem('${THEME_KEY}')||'${DEFAULT_THEME}';
var den=localStorage.getItem('${DENSITY_KEY}')||'${DEFAULT_DENSITY}';
var acc=localStorage.getItem('${ACCENT_KEY}')||'${DEFAULT_ACCENT}';
var H={${ACCENTS.map((a) => `${a.id}:'${a.hex}'`).join(',')}};
var resolved=t==='system'?((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'):t;
d.setAttribute('data-theme',resolved);
d.setAttribute('data-density',den);
d.style.setProperty('--accent',H[acc]||H.${DEFAULT_ACCENT});
d.style.setProperty('--on-accent','#FDFEFB');
}catch(e){}})();`;
