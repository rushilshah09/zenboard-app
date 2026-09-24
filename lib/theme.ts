// Appearance preferences — theme / density. These are per-device choices (no
// account row), so they live in localStorage and are applied to <html> as data-*
// attributes, which globals.css already understands (html[data-theme="dark"],
// html[data-density="compact"]). The same logic runs twice: once as a blocking
// inline boot script (no flash of the wrong theme) and once live from the
// settings panel — keep them in sync.

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
export type Accent = 'berry' | 'plum' | 'amber' | 'sage' | 'green' | 'blue';
/**
 * The SKIN — what the app is made of. Two of them:
 *
 *   · `default` — the Notion-derived screen palette, light and dark.
 *   · `paper`   — the whole product as a printed sheet: stock paper ground with a real fibre
 *                 grain, ink rules instead of soft hairlines, square corners, no elevation, and
 *                 monospaced labels the way a spec sheet or an order form sets them.
 *
 * It is a SEPARATE AXIS from light/dark on purpose. `data-theme` keeps its meaning (and every
 * contrast measurement made against it); paper layers over the semantic tokens in
 * `app/theme-paper.css`, so every one of Zenboard's derived tokens follows without a second
 * palette to maintain. Paper resolves to the LIGHT surfaces — paper is a light material, and a
 * "dark paper" is a different material (kraft, newsprint) rather than the same one at night.
 * The stored light/dark choice is untouched while paper is on, and comes back when it is off.
 */
export type Skin = 'default' | 'paper';

export const THEME_KEY = 'zb-theme';
export const DENSITY_KEY = 'zb-density';
export const ACCENT_KEY = 'zb-accent';
export const SKIN_KEY = 'zb-skin';

// A first visit follows the reader's OS, as Notion and Linear do. This was 'light'
// while dark was unverified; both themes are now measured in every state, overlays
// open included (PROGRESS 2026-09-12/14). Only an EXPLICIT choice is ever stored
// (commitAppearance), so anyone who never picked follows their OS too. Held by
// lib/theme.test.ts, which runs the boot script itself.
export const DEFAULT_THEME: Theme = 'system';
export const DEFAULT_DENSITY: Density = 'comfortable';
export const DEFAULT_SKIN: Skin = 'default';
// Berry (#C41C72) is the brand accent (design-system.md §2.1.3) — the sole hue
// that means "you, here, now". It is the stylesheet default (tokens.css ships
// light + dark berry), so the switcher pins --accent only for a NON-berry pick.
export const DEFAULT_ACCENT: Accent = 'berry';

// The selectable accents. The hex feeds --accent; every other accent token
// (-soft, -border, -deep, -text) derives from it via color-mix in globals.css.
//
// ── WHY EACH ACCENT HAS TWO VALUES ──────────────────────────────────────────
// A single hex cannot serve both themes, and this was failing measurably:
//
//   Berry #C41C72 — 5.59:1 on a light card, but **2.91:1 on a dark one**.
//   Plum  #9A1B6F — 7.61:1 light, **2.14:1 dark**.
//
// The BRAND accent was below the 3:1 floor WCAG 1.4.11 sets for a graphical
// object, on every dark screen in the app. That is the same failure this
// codebase has hit repeatedly: one value declared once that both themes read.
// So the dark end of the palette gets a lighter variant, and only where the
// measurement demands one — berry and plum. The rest are one value that clears
// both.
//
// ── AND WHY THERE IS STILL ONE FOREGROUND ───────────────────────────────────
// `on` used to be a single hardcoded near-white with the claim "every swatch is
// saturated enough that a near-white glyph reads best". False for four of six:
// white on the old Amber measured **2.90:1**. Rather than give some accents a
// dark glyph — a dark mark on a mid-tone fill reads as disabled, and
// --on-accent carries TEXT too (the date in the calendar's today pill, the time
// on the now-marker, so 4.5:1 applies) — the four light swatches were deepened
// until near-white works on all of them. One rule, kept by choosing the fills to
// meet it. **Berry in light is untouched**: it is the brand.
//
// Every number below is measured; app/../lib/accent-contrast.test.ts recomputes
// them so a seventh accent cannot be added that fails.
const ON_ACCENT = '#FDFEFB';
export const ACCENTS: { id: Accent; label: string; hex: string; dark: string }[] = [
  //                                   light fill / white text      dark fill / white text
  { id: 'berry', label: 'Berry', hex: '#C41C72', dark: '#C82175' }, // 5.59/5.52   3.05/5.28
  { id: 'plum', label: 'Plum', hex: '#9A1B6F', dark: '#B53987' },   // 7.61/7.52   3.03/5.32
  { id: 'amber', label: 'Amber', hex: '#A4690C', dark: '#A4690C' }, // 4.56/4.51   3.57/4.51
  { id: 'sage', label: 'Sage', hex: '#6B7B4F', dark: '#6B7B4F' },   // 4.59/4.54   3.55/4.54
  { id: 'green', label: 'Green', hex: '#438438', dark: '#438438' }, // 4.57/4.51   3.57/4.51
  { id: 'blue', label: 'Blue', hex: '#1671E8', dark: '#1671E8' },   // 4.60/4.55   3.54/4.55
];
const ACCENT_HEX: Record<Accent, { hex: string; dark: string }> =
  Object.fromEntries(ACCENTS.map((a) => [a.id, { hex: a.hex, dark: a.dark }])) as Record<Accent, { hex: string; dark: string }>;
/** The accent fill for a RESOLVED theme — see the note on ACCENTS for why dark differs. */
export const accentHex = (a: Accent, mode: 'light' | 'dark' = 'light'): string => {
  const row = ACCENT_HEX[a] ?? ACCENT_HEX.berry;
  return mode === 'dark' ? row.dark : row.hex;
};
/** The text/glyph colour on an accent fill. One value — the fills are chosen to carry it. */
export const accentOn = (_a?: Accent): string => ON_ACCENT;

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

// A theme flip repaints colour, background, border and shadow on nearly every
// element at once, and this app carries 160 colour transitions. Left alone they
// all run together, so the switch SMEARS over their duration instead of
// landing. So: kill transitions for the swap, let the new values commit while
// the kill-switch is still in the document, and restore on the next frame. It
// is what next-themes ships as `disableTransitionOnChange`, and it belongs
// HERE because applyAppearance is the one place the theme is stamped - the
// settings panel, the sidebar toggle and the OS watcher all arrive through it.
//
// Returns the RELEASE step rather than taking a callback, so the caller stamps
// the theme in between and this stays a two-line change at the call site.
function holdTransitions(): () => void {
  if (typeof document === 'undefined') return () => {};
  const style = document.createElement('style');
  style.textContent = '*,*::before,*::after{transition:none !important}';
  document.head.appendChild(style);
  return () => {
    // Reading a layout property is the point, not the value: it forces a
    // synchronous style flush, so the new theme resolves while the override
    // still applies. Without it both changes can land in the same frame and
    // animate anyway.
    const body = document.body as HTMLElement | null;
    if (body) void body.offsetHeight;
    let done = false;
    const restore = () => { if (done) return; done = true; style.remove(); };
    // Two frames, not one - the first still belongs to the paint that just
    // committed.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(restore));
    // And a timer underneath it, because a HIDDEN tab never runs rAF at all.
    // That is not a corner: watchSystemTheme flips a BACKGROUND tab when the OS
    // goes dark at sunset. Measured in the browser - with the tab hidden, the
    // rAF pair never ran and `transition:none !important` stayed in <head>, so
    // the whole app sat with motion disabled. Whichever arrives first wins;
    // `restore` is idempotent so the loser is a no-op.
    if (typeof setTimeout === 'function') setTimeout(restore, 150);
    else restore();
  };
}

// Apply the appearance to <html>. Called live when the user changes a control.
export function applyAppearance(theme: Theme, density: Density, accent: Accent = DEFAULT_ACCENT, skin?: Skin) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  // `skin` is optional because three callers predate it (the OS watcher, the sidebar toggle, the
  // settings panel's own re-apply) and pass three arguments. Defaulting it to `'default'` would
  // have those callers silently switch paper OFF; reading the stored value keeps them honest.
  const nextSkin = skin ?? readAppearance().skin;
  // Paper is a light material (see Skin) — it resolves to the light surfaces whatever the OS says.
  const next = nextSkin === 'paper' ? 'light' : resolveTheme(theme);
  // Only a REAL flip is held. Boot stamps the value the init script already
  // wrote, and a density or accent change repaints a fraction of the surface -
  // both keep their transitions.
  const was = el.getAttribute('data-theme');
  const wasSkin = el.getAttribute('data-skin');
  const flipped = (was !== null && was !== next) || (wasSkin !== null && wasSkin !== nextSkin);
  const release = flipped ? holdTransitions() : null;
  el.setAttribute('data-theme', next);
  el.setAttribute('data-skin', nextSkin);
  el.setAttribute('data-density', density);
  // Accent is the ONE hue in the product — the semantic signal for "active,
  // selected, important" states (checked boxes, selection tint, focus ring, links,
  // on-toggles). Chrome stays monochrome; accent is ~1% of the surface. Pin the
  // chosen swatch to --accent; globals.css derives every -soft/-border/-ring/-deep
  // from it. --on-accent is the foreground ON an accent fill, and it is chosen
  // PER ACCENT — the lighter half of the palette cannot carry white. See ACCENTS.
  el.style.setProperty('--accent', accentHex(accent, next));
  el.style.setProperty('--on-accent', accentOn());
  release?.();
}

// 'system' is a LIVE preference, not a one-time read. `applyAppearance` resolves
// it once and stamps the answer on <html>, so without this the OS flipping to
// dark at sunset leaves a "System" user sitting in light until they reload.
// Subscribe once at the root; it re-resolves and re-broadcasts, and does nothing
// unless the stored choice is actually 'system'.
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const a = readAppearance();
    if (a.theme !== 'system') return;
    applyAppearance(a.theme, a.density, a.accent);
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

// Fired after any control commits a change, so every appearance surface
// (settings panel, sidebar quick-toggle) can re-sync from the source of truth.
export const APPEARANCE_EVENT = 'zb:appearance';

// localStorage is the source of truth. Read it (with defaults) — never trust
// React closure snapshots, which can be stale when two controls fire fast.
export function readAppearance(): { theme: Theme; density: Density; accent: Accent; skin: Skin } {
  if (typeof localStorage === 'undefined') {
    return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY, accent: DEFAULT_ACCENT, skin: DEFAULT_SKIN };
  }
  return {
    theme: (localStorage.getItem(THEME_KEY) as Theme) || DEFAULT_THEME,
    density: (localStorage.getItem(DENSITY_KEY) as Density) || DEFAULT_DENSITY,
    accent: (localStorage.getItem(ACCENT_KEY) as Accent) || DEFAULT_ACCENT,
    skin: (localStorage.getItem(SKIN_KEY) as Skin) || DEFAULT_SKIN,
  };
}

// The single mutation path: merge a patch onto the stored values, persist,
// apply to <html>, and broadcast. Returns the resolved next values.
export function commitAppearance(patch: Partial<{ theme: Theme; density: Density; accent: Accent; skin: Skin }>) {
  const next = { ...readAppearance(), ...patch };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_KEY, next.theme);
    localStorage.setItem(DENSITY_KEY, next.density);
    localStorage.setItem(ACCENT_KEY, next.accent);
    localStorage.setItem(SKIN_KEY, next.skin);
  }
  applyAppearance(next.theme, next.density, next.accent, next.skin);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APPEARANCE_EVENT));
  return next;
}

// Blocking boot script (stringified) — runs in <head>-time before first paint so
// the chosen theme is in place before any styled content renders. Self-contained,
// defensive, and mirrors applyAppearance().
export const themeInitScript = `(function(){try{
var d=document.documentElement;
// The boot splash plays ONCE PER SESSION. Stamped here, before first paint, because a React
// effect would flash the splash on every route change of the session (components/shell/boot-splash.tsx).
try{if(sessionStorage.getItem('zb-booted'))d.setAttribute('data-booted','')}catch(e){}
var t=localStorage.getItem('${THEME_KEY}')||'${DEFAULT_THEME}';
var den=localStorage.getItem('${DENSITY_KEY}')||'${DEFAULT_DENSITY}';
var acc=localStorage.getItem('${ACCENT_KEY}')||'${DEFAULT_ACCENT}';
var skin=localStorage.getItem('${SKIN_KEY}')||'${DEFAULT_SKIN}';
var H={${ACCENTS.map((a) => `${a.id}:'${a.hex}'`).join(',')}};
var HD={${ACCENTS.map((a) => `${a.id}:'${a.dark}'`).join(',')}};
var resolved=skin==='paper'?'light':(t==='system'?((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'):t);
d.setAttribute('data-theme',resolved);
d.setAttribute('data-skin',skin);
d.setAttribute('data-density',den);
d.style.setProperty('--accent',(resolved==='dark'?(HD[acc]||HD.${DEFAULT_ACCENT}):(H[acc]||H.${DEFAULT_ACCENT})));
d.style.setProperty('--on-accent','${ON_ACCENT}');
}catch(e){}})();`;
