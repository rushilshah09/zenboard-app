// ── SURFACE AUDIT, NO DEPENDENCIES ─────────────────────────────────────────
// Walks the dev-preview surfaces in a real browser and measures the rules a
// source scan cannot see, because each one is about what a page COMPUTES:
//
//   · concentric radius — a nested SURFACE (one that fills its parent's inner
//     box) whose outer radius is not inner + padding. Small controls floating
//     inside a row are not nested surfaces; counting them was the first version
//     of this script reporting 13 misses that were not misses.
//   · `transition-property: all` — only where a duration actually runs.
//     `all` at `0s` is CSS's INITIAL value, i.e. the absence of a transition,
//     and counting it reported 97 violations on a clean page.
//   · durations off the ladder (20 · 100 · 150 · 200ms).
//   · curves: a colour change on anything but the hover curve (CSS \`ease\`, Emil
//     Kowalski's decision tree), and Tailwind's own default curve leaking through
//     a \`transition-*\` that names none. Read per PROPERTY, because one element's
//     list pairs the press (transform, ease-out) with its washes (colour, ease).
//   · icon sizes off the five-step scale.
//   · images with no outline, and stray `will-change`.
//
// Usage (needs `next dev` running):
//   node --experimental-websocket scripts/verify/audit-surfaces.mjs http://localhost:3000
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : args[i + 1]; };
const WIDTH = Number(opt('width', 1440));
const THEME = opt('theme', 'light');            // light | dark
const POINTER = opt('pointer', 'fine');         // fine | coarse
const base = args.find((a) => a.startsWith('http')) || 'http://localhost:3000';
// Routes are whatever is left once the base URL and every --flag VALUE pair are
// taken out (an earlier version dropped the flags but kept their values, and
// ran \`--out /tmp/x.json\` as a route).
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { i++; continue; }
  if (!args[i].startsWith('http')) rest.push(args[i]);
}
const ROUTES = rest.length ? rest : [
  'tasks', 'clients', 'money', 'documents', 'calendar', 'forms',
  'home', 'horizon', 'portal', 'settings', 'content', 'habits',
];
const PORT = 9347;
const profile = mkdtempSync(join(tmpdir(), 'zb-audit-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('chrome did not start');
}
let ws, seq = 0;
const pending = new Map();
const send = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200));
  return r.result.value;
};

// Per property: which curve each colour change runs on. An opacity that travels
// with a transform or translate on the same element is an ARRIVAL (a toast), not a
// wash, so it is left to the arrival curve.
const CURVES = `(cs) => {
  const split = (v) => v.split(/,(?![^(]*\\))/).map((x) => x.trim());
  const props = split(cs.transitionProperty), eases = split(cs.transitionTimingFunction), durs = split(cs.transitionDuration);
  const HOVER = new Set(['ease', 'cubic-bezier(0.25, 0.1, 0.25, 1)']);
  const COLOUR = /^(color|background-color|background|border-color|border-top-color|outline-color|text-decoration-color|box-shadow|fill|stroke|filter|opacity|--tw-gradient-(from|via|to))$/;
  const moves = props.some((p) => /^(transform|translate|scale|rotate)$/.test(p));
  const out = [];
  props.forEach((p, i) => {
    const e = eases[i % eases.length], d = durs[i % durs.length];
    if (d === '0s') return;
    if (e === 'cubic-bezier(0.4, 0, 0.2, 1)') { out.push('tw-default'); return; }
    if (!COLOUR.test(p) || (p === 'opacity' && moves)) return;
    if (!HOVER.has(e)) out.push(p + ' on ' + e);
  });
  return out;
}`;

const CURVE_SELF_TEST = `(() => {
  const read = ${CURVES};
  const probe = (t) => { const d = document.createElement('div'); d.style.transition = t; document.body.appendChild(d); const r = read(getComputedStyle(d)); d.remove(); return r; };
  return {
    catchesQuietWash: probe('background-color 100ms cubic-bezier(0.23, 1, 0.32, 1)').length === 1,
    catchesTailwindDefault: probe('color 150ms cubic-bezier(0.4, 0, 0.2, 1)')[0] === 'tw-default',
    allowsHoverWash: probe('background-color 100ms cubic-bezier(0.25, 0.1, 0.25, 1)').length === 0,
    allowsPressWithWash: probe('transform 100ms cubic-bezier(0.23, 1, 0.32, 1), background-color 100ms ease').length === 0,
  };
})()`;

const AUDIT = `(() => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const isSurface = (cs) => { const bg = cs.backgroundColor; return (bg && bg !== 'rgba(0, 0, 0, 0)') || px(cs.borderTopWidth) > 0; };
  const live = (cs) => cs.transitionDuration && cs.transitionDuration !== '0s';
  const LADDER = new Set(['0.02s', '0.1s', '0.15s', '0.2s']);
  const out = { url: location.pathname, radius: [], transitionAll: [], offLadder: [], willChange: [], iconSizes: {}, imagesNoOutline: 0, colourCurves: [], twDefault: 0 };
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width < 24 || r.height < 16) continue;
    const cs = getComputedStyle(el);
    if (live(cs)) {
      if (cs.transitionProperty === 'all') out.transitionAll.push((el.className || '').toString().slice(0, 40));
      for (const d of cs.transitionDuration.split(',').map((s) => s.trim())) if (!LADDER.has(d)) out.offLadder.push(d);
      for (const c of (${CURVES})(cs)) { if (c === 'tw-default') out.twDefault++; else out.colourCurves.push(c); }
    }
    if (cs.willChange && cs.willChange !== 'auto') out.willChange.push(cs.willChange);
    const cr = px(cs.borderTopLeftRadius); if (cr < 2 || !isSurface(cs)) continue;
    const p = el.parentElement; if (!p) continue;
    const pcs = getComputedStyle(p); const pr = px(pcs.borderTopLeftRadius);
    if (pr < 2 || !isSurface(pcs)) continue;
    const pad = px(pcs.paddingLeft); if (pad < 1 || pad > 24) continue;
    const pRect = p.getBoundingClientRect();
    if (Math.abs(r.width - (pRect.width - 2 * pad)) > 3) continue;
    if (Math.abs(pr - (cr + pad)) > 1) out.radius.push({ inner: cr, outer: pr, pad, shouldBe: cr + pad, cls: (el.className || '').toString().slice(0, 36) });
  }
  // An ICON is a glyph from the seam, which draws Phosphor's 256 grid. A ring,
  // a chart or a sparkline is a drawing with its own viewBox and has no business
  // on the icon scale - counting horizon's 52px progress ring as an icon was
  // this script's third false positive.
  for (const s of document.querySelectorAll('svg')) {
    if ((s.getAttribute('viewBox') || '') !== '0 0 256 256') continue;
    const w = Math.round(s.getBoundingClientRect().width); if (w) out.iconSizes[w] = (out.iconSizes[w] || 0) + 1;
  }
  for (const i of document.querySelectorAll('img')) { if (px(getComputedStyle(i).outlineWidth) === 0) out.imagesNoOutline++; }
  out.offLadder = [...new Set(out.offLadder)];
  out.willChange = [...new Set(out.willChange)];
  out.transitionAll = [...new Set(out.transitionAll)];
  out.colourCurves = [...new Set(out.colourCurves)];
  return out;
})()`;

// ── OVERFLOW, and why it is not `scrollWidth > clientWidth` on the document ──
// This app never scrolls the DOCUMENT: content lives in `scroll-region`
// containers (overflow-y auto, overflow-x hidden). The first version of this
// check only looked at the document, and a self-test showed it reporting
// "clean" with a 2400px element inside the page — the region clipped it, the
// document never widened, and a phone reader would simply have lost the
// content. So a region BUILT TO SCROLL DOWN is the thing measured: it must
// never be wider inside than out, whether it grows a sideways scrollbar or
// silently cuts content off. A scroller built to scroll SIDEWAYS (a table
// wrapper, a board) is doing its job, and single-line truncation is
// typography, not overflow.
const OVERFLOW = `() => {
  const de = document.documentElement;
  const found = [];
  if (de.scrollWidth > de.clientWidth + 1) found.push({ where: 'document', kind: 'page scrolls sideways', by: de.scrollWidth - de.clientWidth });
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const clips = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    // Tailwind's overflow-x-auto computes overflow-y as auto too (CSS turns a
    // visible axis into auto when the other one scrolls), so a one-row tab
    // strip looks exactly like a vertical region from computed style alone. The
    // first run of this rule flagged eight of them - tab strips, chip rows, the
    // settings nav at phone width, the content pipeline board - and every one was
    // deliberate. What separates them is geometry: a strip does not scroll DOWN.
    // Clipping gets no such pass; a layout region that cuts content off is wrong
    // at any height.
    if (!clips && el.scrollHeight <= el.clientHeight + 4) continue;
    // Why it is wide: the widest direct child, and whether this is a one-row strip.
    let widest = null;
    for (const c of el.children) { const w = c.getBoundingClientRect().width; if (!widest || w > widest.w) widest = { w: Math.round(w), cls: (c.className || '').toString().slice(0, 50), tag: c.tagName.toLowerCase() }; }
    found.push({
      where: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0].slice(0, 24),
      kind: clips ? 'clips content' : 'scrolls sideways',
      by: el.scrollWidth - el.clientWidth,
      cls: (el.className || '').toString().slice(0, 90),
      display: cs.display, dir: cs.flexDirection, wrap: cs.flexWrap,
      scrollsDown: el.scrollHeight > el.clientHeight + 1,
      height: el.clientHeight,
      widest,
    });
  }
  return found;
}`;

// The ruler tests itself before it measures anything: two shapes it must catch,
// two it must let through. If any control misbehaves the audit refuses to run,
// because a "clean" from a broken check is worse than no answer.
const SELF_TEST = `(() => {
  const check = ${OVERFLOW};
  const wide = () => { const d = document.createElement('div'); d.style.cssText = 'width:2400px;height:6px'; return d; };
  const region = document.querySelector('.scroll-region');
  if (!region) return { skipped: 'no scroll-region on this page' };
  const base = check().length;
  const a = wide(); document.body.appendChild(a); const A = check().length > base; a.remove();
  const b = wide(); region.appendChild(b); const B = check().length > base; b.remove();
  const w = document.createElement('div'); w.style.cssText = 'overflow-x:auto;overflow-y:hidden;width:200px'; w.appendChild(wide()); region.appendChild(w);
  const C = check().length === base; w.remove();
  const t = document.createElement('div'); t.style.cssText = 'width:120px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis'; t.textContent = 'x'.repeat(200); region.appendChild(t);
  const D = check().length === base; t.remove();
  // E - the idiom as real code writes it: overflow-x ONLY, a one-row flex strip
  const e = document.createElement('div'); e.style.cssText = 'overflow-x:auto;display:flex;width:200px';
  for (let i = 0; i < 8; i++) { const c = document.createElement('div'); c.style.cssText = 'flex:none;width:120px;height:20px'; e.appendChild(c); }
  region.appendChild(e); const E = check().length === base; e.remove();
  // F - a region that scrolls DOWN and has grown sideways too: the broken case
  const f = document.createElement('div'); f.style.cssText = 'overflow:auto;width:200px;height:80px';
  const tall = document.createElement('div'); tall.style.cssText = 'width:900px;height:400px'; f.appendChild(tall);
  region.appendChild(f); const F = check().length > base; f.remove();
  return { pageOverflowCaught: A, regionClipCaught: B, bothWaysRegionCaught: F, sidewaysScrollerAllowed: C, truncationAllowed: D, tailwindStripAllowed: E };
})()`;

// ── A TARGET A FINGER CAN HIT ─────────────────────────────────────────────
// Measured only with --pointer coarse, because the house rule is coarse-only:
// WCAG 2.5.8 asks 24x24, and Zenboard meets it with an INVISIBLE centred
// ::after (the \`touch-min\` utility gives 24, IconButton gives 44) so a mouse
// layout keeps its density. Measuring the visible box alone would report every
// one of those as a miss, so the effective target is the larger of the box and
// its ::after - clipped by the element itself when it is overflow-hidden, which
// is the trap ds-theme.css records (a truncating title clipped its own expander
// to 61x20 on a phone). Links inside running text are exempt, as WCAG exempts
// them.
const TARGETS = `() => {
  const SEL = 'button, a[href], [role=button], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], input:not([type=hidden]), select, textarea, summary';
  const px = (v) => parseFloat(v) || 0;
  const misses = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest('[aria-hidden="true"], [inert]') || el.disabled) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || px(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;                      // far off-page
    if (el.tagName === 'A' && el.parentElement && /^(P|LI|SPAN)$/.test(el.parentElement.tagName) && (el.parentElement.textContent || '').trim().length > (el.textContent || '').trim().length + 8) continue;
    let w = r.width, h = r.height;
    const after = getComputedStyle(el, '::after');
    if (after.content && after.content !== 'none' && after.position === 'absolute') {
      w = Math.max(w, px(after.width), px(after.minWidth));
      h = Math.max(h, px(after.height), px(after.minHeight));
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') { w = Math.min(w, r.width); h = Math.min(h, r.height); }
    }
    if (w < 24 - 0.5 || h < 24 - 0.5) misses.push({ label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 28), w: Math.round(w), h: Math.round(h), cls: (el.className || '').toString().slice(0, 60) });
  }
  return misses;
}`;

const TARGET_SELF_TEST = `(() => {
  const check = ${TARGETS};
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:40px;top:40px;display:flex;gap:40px;z-index:1';
  document.body.appendChild(host);
  const mk = (html) => { const w = document.createElement('div'); w.innerHTML = html; host.appendChild(w); return w; };
  const base = check().length;
  const count = () => check().length - base;
  // must CATCH: a bare 16px control
  const a = mk('<button aria-label="probe-bare" style="width:16px;height:16px;padding:0;border:0"></button>');
  const A = count() === 1; a.remove();
  // must CATCH: the house expander, clipped by its own overflow-hidden (the truncate trap)
  const b = mk('<button aria-label="probe-clipped" class="touch-min" style="width:16px;height:16px;padding:0;border:0;overflow:hidden"></button>');
  const B = count() === 1; b.remove();
  // must ALLOW: the house expander doing its job
  const c = mk('<button aria-label="probe-floor" class="touch-min" style="width:16px;height:16px;padding:0;border:0"></button>');
  const C = count() === 0; c.remove();
  // must ALLOW: a link inside running text
  const d = mk('<p style="width:300px">Read the <a href="#x">terms</a> before you sign the proposal today.</p>');
  const D = count() === 0; d.remove();
  host.remove();
  return { bareCaught: A, clippedExpanderCaught: B, touchMinAllowed: C, inlineLinkAllowed: D };
})()`;

const ICON_SCALE = new Set([12, 14, 16, 20, 24]);
const findings = [];
try {
  await up();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH < 768 });
  // The theme is a data attribute on <html> (lib/theme.ts), and the boot script
  // reads localStorage - so set the stored choice before the page loads rather
  // than flipping the attribute after, which would measure a half-applied theme.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(THEME)}); } catch {}` });
  if (POINTER === 'coarse') {
    // Flips (pointer: coarse) live, the way a phone reports it; set before the
    // first navigation so the page's media queries see it from first paint.
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  console.log(`  ${WIDTH}px · ${THEME} · ${POINTER} pointer`);

  for (const route of ROUTES) {
    await send('Page.navigate', { url: `${base}/dev-preview/${route}` });
    // Wait for real content, not a fixed sleep: a dev server compiles on first hit.
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await sleep(500);
      ready = await evaluate(`document.querySelectorAll('button, a').length > 3 && document.body.innerText.trim().length > 40`).catch(() => false);
    }
    if (!ready) { console.log(`  ${route.padEnd(11)} — did not render`); continue; }
    if (!globalThis.__selfTested) {
      const st = await evaluate(SELF_TEST);
      if (!st.skipped) {
        globalThis.__selfTested = true;
        const failed = Object.entries(st).filter(([, ok]) => !ok).map(([k]) => k);
        if (failed.length) { console.log(`  SELF-TEST FAILED (${failed.join(', ')}) - refusing to report`); process.exitCode = 2; break; }
        console.log('  self-test: overflow rule catches 3/3, allows 3/3');
        const ct = await evaluate(CURVE_SELF_TEST);
        const bad = Object.entries(ct).filter(([, ok]) => !ok).map(([k]) => k);
        if (bad.length) { console.log(`  SELF-TEST FAILED (${bad.join(', ')}) - refusing to report`); process.exitCode = 2; break; }
        console.log('  self-test: curve rule catches 2/2, allows 2/2');
      }
    }
    if (POINTER === 'coarse' && !globalThis.__targetsTested) {
      globalThis.__targetsTested = true;
      const media = await evaluate(`matchMedia('(pointer: coarse)').matches`);
      if (!media) { console.log('  SELF-TEST FAILED (pointer emulation did not apply) - refusing to report'); process.exitCode = 2; break; }
      const tt = await evaluate(TARGET_SELF_TEST);
      const bad = Object.entries(tt).filter(([, ok]) => !ok).map(([k]) => k);
      if (bad.length) { console.log(`  SELF-TEST FAILED (${bad.join(', ')}) - refusing to report`); process.exitCode = 2; break; }
      console.log('  self-test: target rule catches 2/2, allows 2/2');
    }
    const a = await evaluate(AUDIT);
    a.targets = POINTER === 'coarse' ? await evaluate(`(${TARGETS})()`) : [];
    // Horizontal overflow is a narrow-width failure and invisible at 1440.
    a.overflow = await evaluate(`(${OVERFLOW})()`);
    a.theme = await evaluate(`document.documentElement.getAttribute('data-theme')`);
    const offScaleIcons = Object.keys(a.iconSizes).map(Number).filter((n) => !ICON_SCALE.has(n));
    const line = [
      a.radius.length ? `radius:${a.radius.length}` : '',
      a.transitionAll.length ? `transition-all:${a.transitionAll.length}` : '',
      a.offLadder.length ? `off-ladder:${a.offLadder.join('/')}` : '',
      a.colourCurves.length ? `colour-curve:${a.colourCurves.join(' | ')}` : '',
      a.twDefault ? `tailwind-default-curve:${a.twDefault}` : '',
      offScaleIcons.length ? `icons:${offScaleIcons.join('/')}` : '',
      a.imagesNoOutline ? `unoutlined-images:${a.imagesNoOutline}` : '',
      a.willChange.length ? `will-change:${a.willChange.join('/')}` : '',
      a.overflow.length ? `overflow:${a.overflow.map((o) => `${o.kind}@${o.where}+${o.by}px`).join(' | ')}` : '',
      a.theme !== THEME ? `theme-not-applied:${a.theme}` : '',
      a.targets.length ? `small-targets:${a.targets.length}` : '',
    ].filter(Boolean);
    console.log(`  ${route.padEnd(11)} ${line.length ? line.join('  ') : 'clean'}`);
    if (line.length) findings.push({ route, ...a, offScaleIcons });
  }
  const OUT = opt('out', '');
  if (findings.length && OUT) { (await import('node:fs')).writeFileSync(OUT, JSON.stringify(findings, null, 2)); console.log(`\n  findings written to ${OUT}`); }
  else if (findings.length) console.log('\n' + JSON.stringify(findings, null, 2).slice(0, 4000));
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  // Chrome is still flushing its profile for a moment after SIGTERM: without the
  // retries this throws ENOTEMPTY and buries the audit's own output.
  await sleep(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(findings.length ? 1 : 0);
