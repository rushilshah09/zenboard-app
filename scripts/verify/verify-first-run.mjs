// ── THE FIRST-RUN LOOK, MEASURED ───────────────────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol rather than the in-app browser.
//
// The user's reference for the sign-up and onboarding screens (2026-09-25) is a
// SHEET lying on a darker ground, with the brand's own hue on the mark, the
// heading's product name and the one filled action. This reads all of that back
// off the rendered page: the desk, the sheet, the separation between them, the
// field at rest and focused, the brand button, and the accent's contrast where
// it carries text — in both themes, at desk and phone widths.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-first-run.mjs http://localhost:3000 /tmp [light|dark] [width]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light', width = '1440'] = process.argv.slice(2);
const W = Number(width);
const H = W < 700 ? 812 : 900;
const PORT = 9387;
const profile = mkdtempSync(join(tmpdir(), 'zb-first-run-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const go = async (path) => { await send('Page.navigate', { url: base + path }); await sleep(2200); };

// ── Colour, as the page actually paints it ─────────────────────────────────
// WHAT THE EYE GOT. The tokens are authored in oklch and computed as `lab(...)`,
// so reading numbers out of the string gives the wrong three values (it reported
// the white sheet as #640000), and `fillStyle` does NOT normalise a CSS Color 4
// value — Chrome hands the lab() string straight back. So: paint the colour onto
// white and onto black, and solve. Two composites give both the true colour and
// its alpha, in any colour space, with no conversion of our own:
//   overWhite = c·a + 255(1−a) · overBlack = c·a
const PAINT = `(v) => {
  const over = (back) => {
    const x = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    x.canvas.width = x.canvas.height = 1;
    x.fillStyle = back; x.fillRect(0, 0, 1, 1);
    x.fillStyle = '#000'; x.fillStyle = v;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const w = over('#FFF'), b = over('#000');
  const a = Math.min(1, Math.max(0, 1 - (w.reduce((s, v, i) => s + v - b[i], 0) / 3) / 255));
  return { rgb: a < 0.004 ? [0, 0, 0] : b.map((v) => Math.min(255, Math.round(v / a))), a: Math.round(a * 1000) / 1000 };
}`;
const RGB = `(v) => (${PAINT})(v).rgb`;
const LUM = `(c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }`;
const RATIO = `(a, b) => { const L = [(${LUM})(a), (${LUM})(b)].sort((x, y) => y - x); return Math.round(((L[0] + 0.05) / (L[1] + 0.05)) * 100) / 100; }`;
const HEX = `(c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()`;
/** The painted background of an element, walking up through transparency. */
const GROUND = `(el) => {
  const layers = [];
  for (let n = el; n; n = n.parentElement) {
    const p = (${PAINT})(getComputedStyle(n).backgroundColor);
    if (p.a === 0) continue;
    layers.push(p);
    if (p.a === 1) break;
  }
  let out = [255, 255, 255];
  for (const l of layers.reverse()) out = l.rgb.map((v, i) => Math.round(v * l.a + out[i] * (1 - l.a)));
  return out;
}`;

const read = (sel, extra = '{}') => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const s = getComputedStyle(el), r = el.getBoundingClientRect();
  return {
    bg: (${HEX})((${GROUND})(el)), fg: (${HEX})((${RGB})(s.color)),
    contrast: (${RATIO})((${RGB})(s.color), (${GROUND})(el)),
    radius: s.borderTopLeftRadius, border: s.borderTopWidth + ' ' + s.borderTopColor,
    shadow: s.boxShadow.slice(0, 120), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    ...(${extra}),
  };
})()`);

const log = { theme, width: W, screens: {} };
const fail = (m) => { errors.push(m); console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') { const d = msg.params.exceptionDetails?.exception?.description ?? ''; if (!/Hydration failed/.test(d)) errors.push('console: ' + d.slice(0, 200)); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  // Without this, a headless page is never "focused" and NO `:focus` rule paints.
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  // The theme is a stored choice; the boot script reads it before first paint.
  await go('/login');
  await ev(`localStorage.setItem('zb-theme', ${JSON.stringify(theme)})`);
  await go('/login');

  // ── The sign-up screen ───────────────────────────────────────────────────
  console.log(`\n── /login · ${theme} · ${W}px ──`);
  // The page is ONE ground, and the product's own cards are what sit on it.
  const page = await read('.bg-canvas');
  const card = await read('aside[aria-hidden] [data-slot="panel"], aside[aria-hidden] section > div');
  const pageRGB = await ev(`(${GROUND})(document.querySelector('.bg-canvas'))`);
  const cardRGB = await ev(`(${GROUND})(document.querySelector('aside[aria-hidden] section > div'))`);
  const sep = await ev(`(${RATIO})(${JSON.stringify(pageRGB)}, ${JSON.stringify(cardRGB)})`);
  log.screens.login = { page, card, separation: sep };
  console.log(`  page ${page?.bg} · the product's cards ${card?.bg} · separation ${sep}:1`);
  if (!page) fail('the page has no ground of its own');
  else if (sep < 1.03) fail(`the product's cards are ${sep}:1 against the page — they do not read as surfaces`);
  else ok(`the product's cards read on the page (${sep}:1)`);

  const leftLift = await ev(`(() => {
    const col = document.querySelector('.bg-canvas > div');
    if (!col) return null;
    return [...col.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return s.boxShadow !== 'none' && !el.closest('button') && !el.matches(':focus-visible');
    }).length;
  })()`);
  if (leftLift) fail(`${leftLift} raised element(s) in the form column — the left side is the page, not a card`);
  else ok('the form column is flat: nothing on the left is lifted');

  // The brand: the mark, the product's name in the heading, one filled action.
  // The lockup is the real artwork: a drawn mark in the brand hue and drawn lettering, never the
  // name typed in whatever font is loaded.
  const mark = await ev(`(() => {
    const logo = document.querySelector('[data-slot="wordmark"] [data-slot="logo"]');
    if (!logo) return null;
    const paths = logo.querySelectorAll('path');
    const probe = document.createElement('span');
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).color; probe.remove();
    const markPath = paths[0];
    const fill = getComputedStyle(markPath).fill;
    return { paths: paths.length, fill, accent, letters: logo.querySelectorAll('g path').length, text: logo.textContent.trim() };
  })()`);
  if (!mark) fail('the header has no lockup');
  else if (mark.fill !== mark.accent) fail(`the lockup’s mark is ${mark.fill}, not the brand ${mark.accent}`);
  else if (mark.letters < 8) fail(`the lettering is ${mark.letters} paths — a wordmark is drawn, not typed`);
  else ok(`the real lockup: mark ${mark.fill}, ${mark.letters} drawn letterforms`);

  const brandBtn = await read('button[type="submit"]', `{ disabled: el.disabled }`);
  log.screens.login.cta = brandBtn;
  console.log(`  CTA ${brandBtn.bg} · label ${brandBtn.fg} · ${brandBtn.contrast}:1 · ${brandBtn.disabled ? 'disabled' : 'enabled'} · ${brandBtn.box[3]}px tall`);

  // Filled accent appears ONCE (the house rule), counted by painted pixels' fill.
  const accentFills = await ev(`(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const norm = (v) => v.replace(/\\s/g, '').toLowerCase();
    const px = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
    const probe = document.createElement('span'); probe.style.color = accent; document.body.appendChild(probe);
    const target = norm(getComputedStyle(probe).color); probe.remove();
    return [...document.querySelectorAll('body *')].filter((el) => norm(getComputedStyle(el).backgroundColor) === target && px(el) > 600).map((el) => el.tagName + '.' + (el.className.toString().slice(0, 40)));
  })()`);
  log.screens.login.accentFills = accentFills;
  if (accentFills.length > 1) fail(`${accentFills.length} filled-accent elements: ${accentFills.join(' | ')}`);
  else ok(`one filled accent (${accentFills[0] ?? 'none — the CTA is disabled until the form is ready'})`);

  // The field: a wash at rest, the card's fill with an accent edge when touched.
  const rest = await read('input[type="email"]');
  await ev(`document.querySelector('input[type="email"]').focus()`);
  await sleep(180);
  const focused = await read('input[type="email"]');
  log.screens.login.field = { rest, focused };
  console.log(`  field rest ${rest.bg} edge "${rest.border}" · focused ${focused.bg} edge "${focused.border}"`);
  if (rest.border.startsWith('1px') && !/rgba\(0, 0, 0, 0\)|transparent/.test(rest.border)) fail('the resting field still draws a border');
  if (focused.border === rest.border) fail('the field does not answer focus with its edge');
  else ok('the field lifts and takes an accent edge on focus');
  await ev(`document.activeElement.blur()`);

  // The product beside the form: a PAGE, inert, and gone on a phone.
  const still = await ev(`(() => {
    const a = document.querySelector('aside[aria-hidden]');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    const inner = a.querySelector('[tabindex="-1"]')?.getBoundingClientRect();

    return {
      shown: r.width > 0 && getComputedStyle(a).display !== 'none',
      panels: a.querySelectorAll('[data-slot="panel"], .surface-panel, section').length,
      rows: a.querySelectorAll('button[role="checkbox"], [data-slot="checkbox"]').length,
      clipped: inner ? Math.round(inner.width) > Math.round(r.width) : false,
      shown_fraction: inner ? Math.round((r.width / inner.width) * 100) : 0,
      focusable: a.querySelectorAll('a[href], button:not([tabindex="-1"]), input, [tabindex]:not([tabindex="-1"])').length,
    };
  })()`);
  log.screens.login.still = still;
  if (W >= 1024) {
    if (!still?.shown) fail('the product still is not shown at desk width');
    else {
      console.log(`  still: ${still.panels} sections · ${still.rows} checkboxes · ${still.clipped ? 'runs off its sheet' : 'fits inside its sheet'}`);
      if (!still.clipped) fail('the still fits its column — it reads as a card, not as part of a screen');
      else ok(`the product runs off the edge (${still.shown_fraction}% of it visible)`);
      const panel = await read('aside[aria-hidden] .sheet');
      if (!panel) fail('the product is not raised — the uplift belongs on the right');
      else ok(`raised on the desk (radius ${panel.radius}, shadow ${panel.shadow ? 'yes' : 'none'})`);
      if (still.shown_fraction > 75) fail(`${still.shown_fraction}% visible — too much of it fits, so nothing continues`);
    }
  } else if (still?.shown) fail('the still is still on screen at phone width');
  else ok('the still is gone on a phone');
  if (still && still.focusable > 0) fail(`${still.focusable} focusable elements inside a picture`);

  await shot(`first-run-login-${theme}-${W}.png`);

  // ── Onboarding ───────────────────────────────────────────────────────────
  await go('/dev-preview/onboarding');
  console.log(`\n── /dev-preview/onboarding · ${theme} · ${W}px ──`);
  const onGround = await read('.bg-canvas');
  const onPanel = await read('aside[aria-hidden] [class*="rounded-lg"]');
  const grounds = await ev(`(() => new Set([...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().width > 300 && el.getBoundingClientRect().height > 300 && !el.closest('aside'))
    .map((el) => getComputedStyle(el).backgroundColor)
    .filter((b) => b && b !== 'transparent' && !b.endsWith(', 0)'))).size)()`);
  log.screens.onboarding = { ground: onGround, panel: onPanel, grounds };
  if (!onGround) fail('the questions are not on the page ground');
  else if (grounds > 1) fail(`${grounds} different page grounds — the background is one colour`);
  else ok(`one ground (${onGround.bg}) · the preview raised on it (${onPanel?.bg ?? 'none'})`);
  const dots = await ev(`(() => {
    const g = document.querySelector('[aria-label^="Step "]');
    if (!g) return null;
    const dashes = [...g.querySelectorAll('span[aria-hidden] > span')];
    return { label: g.getAttribute('aria-label'), dashes: dashes.length, filled: dashes.filter((d) => getComputedStyle(d).backgroundColor !== getComputedStyle(dashes.at(-1)).backgroundColor).length + 1 };
  })()`);
  log.screens.onboarding.progress = dots;
  if (!dots) fail('no step progress');
  else ok(`progress: "${dots.label}" · ${dots.dashes} dashes`);
  await shot(`first-run-onboarding-${theme}-${W}.png`);

  writeFileSync(join(out, `first-run-${theme}-${W}.json`), JSON.stringify(log, null, 2));
  console.log(`\n${errors.length ? `✗ ${errors.length} problem(s)` : '✓ all checks passed'}`);
  if (errors.length) { console.log(errors.map((e) => '  - ' + e).join('\n')); process.exitCode = 1; }
} catch (e) {
  console.error('FAILED', e);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome still holding a lock */ }
}
