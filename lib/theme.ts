// Appearance preferences — theme / density. These are per-device choices (no
// account row), so they live in localStorage and are applied to <html> as data-*
// attributes, which globals.css already understands (html[data-theme="dark"],
// html[data-density="compact"]). The same logic runs twice: once as a blocking
// inline boot script (no flash of the wrong theme) and once live from the
// settings panel — keep them in sync.

import { ALL_SITE_PAGES } from './site-pages';

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

// LIGHT, by user directive (2026-09-25: "i want light mode is default"). This
// followed the OS from 2026-09-12 — the Notion/Linear behaviour — and the reason
// that is reversible without losing anything is that the OS is a GUESS at a
// preference, while the reference this product is being designed against is a
// light one: someone whose laptop is in dark mode would otherwise meet Zenboard
// for the first time in a theme it was not drawn in. Dark is one switch away and
// is still measured in every state (PROGRESS 2026-09-12/14), and an explicit
// choice — including 'system' — is still the only thing ever stored
// (commitAppearance), so nobody who has chosen is overridden. Held by
// lib/theme.test.ts, which runs the boot script itself.
export const DEFAULT_THEME: Theme = 'light';
export const DEFAULT_DENSITY: Density = 'comfortable';
export const DEFAULT_SKIN: Skin = 'default';
// Berry is the brand accent — the sole hue that means "you, here, now". It is
// the stylesheet's default, so the switcher pins --accent only for a NON-berry pick.
export const DEFAULT_ACCENT: Accent = 'berry';

/**
 * THE BRAND'S OWN BERRY — the colour of the logo ARTWORK (illustration/logo.svg,
 * the exported lockup in lib/brand.ts, the website's illustration board). It is
 * not the UI accent: a neon magenta on every primary button and checked box is
 * the loudest thing on a calm screen. The UI berry below keeps this hue and
 * gives up about a fifth of its chroma (user directive 2026-10-02: "the subtle,
 * calm quality of Claude's interface").
 */
export const BRAND_BERRY = '#C41C72';

// ── THE SELECTABLE ACCENTS ───────────────────────────────────────────────────
// The hex feeds --accent; every other accent token (-soft, -border, -deep,
// -text) derives from it in CSS.
//
// ONE LIGHTNESS PER THEME. All six sit at oklch L 0.525 in light, so swapping
// accents changes the HUE and never the loudness — the old set ran from a neon
// berry (0.544/0.207) to a dusty sage, and each one was a different weight on
// the page. Chroma is each hue's calm ceiling (berry 0.165, sage 0.08).
//
// TWO VALUES PER ACCENT, because one hex cannot serve both themes: a fill dark
// enough to carry white text on a light card disappears on a dark one (the old
// brand berry measured 2.91:1 on a dark card). The dark values are lifted until
// they clear 3:1 on the dark card while still carrying the same near-white text
// at ≥ 4.5:1 — measured, every pairing, by lib/accent-contrast.test.ts.
//
// ONE FOREGROUND. --on-accent carries text as well as glyphs (the date in the
// calendar's today pill), so 4.5:1 applies, and every fill is chosen to meet it
// with the same near-white — a dark mark on a mid-tone fill reads as disabled.
const ON_ACCENT = '#FDFEFB';
export const ACCENTS: { id: Accent; label: string; hex: string; dark: string }[] = [
  //                                   light: card / text           dark: card / text
  { id: 'berry', label: 'Berry', hex: '#AF356C', dark: '#C2477C' }, // 5.92 / 5.84   3.47 / 4.63
  { id: 'plum', label: 'Plum', hex: '#9C428C', dark: '#AD529C' },   // 5.86 / 5.79   3.47 / 4.63
  { id: 'amber', label: 'Amber', hex: '#9A5805', dark: '#AA6311' }, // 5.58 / 5.52   3.48 / 4.62
  { id: 'sage', label: 'Sage', hex: '#5D733F', dark: '#657B47' },   // 5.25 / 5.19   3.48 / 4.62
  { id: 'green', label: 'Green', hex: '#1F7E3F', dark: '#278445' }, // 5.08 / 5.02   3.48 / 4.61
  { id: 'blue', label: 'Blue', hex: '#206ABE', dark: '#2D74CA' },   // 5.45 / 5.38   3.47 / 4.63
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

// ── THE WEBSITE HAS ONE APPEARANCE ──────────────────────────────────────────
// User, 2026-09-29: "right now we only keep light mode, we're removing dark mode" — of the website.
// The landing page, its legal pages and the product demo it frames are drawn and measured in the
// light theme, the default skin and the brand's berry, and nowhere else. The APP keeps every choice.
//
// So a website page resolves to this appearance the way Paper resolves to light: in the boot script
// before first paint, and in every later `applyAppearance`, whatever is stored. The stored choice is
// never touched, so someone who chose dark for the app still gets dark the moment they sign in. The
// addresses are the site's own list (lib/site-pages.ts), plus the demo, which is never indexed.
export const SITE_APPEARANCE = { theme: 'light', density: DEFAULT_DENSITY, accent: 'berry', skin: 'default' } as const satisfies {
  theme: Theme; density: Density; accent: Accent; skin: Skin;
};
export const SITE_PATHS: readonly string[] = [...ALL_SITE_PAGES.map((p) => p.path), '/demo'];
/** Is this address a page of the website (and so drawn in `SITE_APPEARANCE`)? */
export function isSitePath(pathname: string): boolean {
  return SITE_PATHS.includes(pathname.replace(/\/+$/, '') || '/');
}
const onSite = () => typeof window !== 'undefined' && !!window.location && isSitePath(window.location.pathname);

// Apply the appearance to <html>. Called live when the user changes a control.
export function applyAppearance(theme: Theme, density: Density, accent: Accent = DEFAULT_ACCENT, skin?: Skin) {
  if (typeof document === 'undefined') return;
  if (onSite()) ({ theme, density, accent, skin } = SITE_APPEARANCE);
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
  // …unless the skin prints in ONE INK. Paper is a two-colour material (user, 2026-09-24:
  // "only 2 colours and textures"), and an INLINE style beats any stylesheet — so a skin cannot
  // take the accent back in CSS, however late its file is imported. That is exactly what happened:
  // every status ramp in the skin was already ink while a berry star sat on the page, because
  // this line kept overruling it. The skin owns its palette, so here JS gets out of the way and
  // lets `app/theme-paper.css` supply `--accent`/`--on-accent` from its own ink and stock.
  if (nextSkin === 'paper') {
    el.style.removeProperty('--accent');
    el.style.removeProperty('--on-accent');
  } else {
    el.style.setProperty('--accent', accentHex(accent, next));
    el.style.setProperty('--on-accent', accentOn());
  }
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
// A website page is drawn in one appearance, whatever is stored (SITE_APPEARANCE above).
var L=window.location,P=L&&L.pathname?(L.pathname.replace(/\\/+$/,'')||'/'):'';
if(${JSON.stringify(SITE_PATHS)}.indexOf(P)>=0){t='${SITE_APPEARANCE.theme}';den='${SITE_APPEARANCE.density}';acc='${SITE_APPEARANCE.accent}';skin='${SITE_APPEARANCE.skin}';}
var H={${ACCENTS.map((a) => `${a.id}:'${a.hex}'`).join(',')}};
var HD={${ACCENTS.map((a) => `${a.id}:'${a.dark}'`).join(',')}};
var resolved=skin==='paper'?'light':(t==='system'?((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'):t);
d.setAttribute('data-theme',resolved);
d.setAttribute('data-skin',skin);
d.setAttribute('data-density',den);
if(skin!=='paper'){d.style.setProperty('--accent',(resolved==='dark'?(HD[acc]||HD.${DEFAULT_ACCENT}):(H[acc]||H.${DEFAULT_ACCENT})));
d.style.setProperty('--on-accent','${ON_ACCENT}');}
}catch(e){}})();`;
