// ── SLOW MOTION, FRAME BY FRAME, NO DEPENDENCIES ───────────────────────────
// Emil Kowalski's review step as an instrument: "Play animations in slow motion
// or frame by frame to spot timing issues that are invisible at full speed."
// Slows every animation to 10% (CDP Animation.setPlaybackRate), triggers a real,
// trusted interaction, then PAUSES each animation it cares about and SEEKS it to
// fixed fractions, reading geometry and style at each one. Seeking a paused
// animation is deterministic: no frame timing, no paint dependence, so the same
// numbers come back on every run.
//
// What each scenario asks:
//   toolbar     does the selection toolbar enter where it lives, or somewhere else first?
//   dropdown    does a menu grow out of its trigger's corner?
//   select      same, for a Select
//   keyKey      does a menu opened by a KEY animate at all? (it must not)
//   keyPointer  the control: the same kind of menu opened by a pointer still animates
//   slash       does the slash menu animate when `/` opens it? (it must not)
//   dialogExit  does the scrim stay with the panel while a dialog leaves?
//   tooltip     does a tooltip grow out of the edge that faces its trigger?
//   escClose    does Escape close a pointer-opened menu with no exit? (it must)
//   pageIn      does the page entrance play for a pointer and not for a key?
//   navDrawer   does the phone drawer enter from, and leave to, the edge it lives on?
//   sidebar     does the desktop sidebar collapse and expand with nothing jumping or sliding away?
//
// Usage (needs `next dev` running):
//   node --experimental-websocket scripts/verify/slow-motion.mjs [baseUrl] [outDir] [scenario...]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) || 'http://localhost:3000';
const out = args.find((a) => a.startsWith('/')) || mkdtempSync(join(tmpdir(), 'zb-slowmo-out-'));
const only = args.filter((a) => !a.startsWith('http') && !a.startsWith('/'));
mkdirSync(out, { recursive: true });

const PORT = 9412;
const profile = mkdtempSync(join(tmpdir(), 'zb-slowmo-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map(); const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, buttons = 0, clickCount = 1) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount });
async function clickAt(x, y, count = 1) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1, count); await mouse('mouseReleased', x, y, 0, count); }
async function key(k, code, { text, modifiers = 0, vk } = {}) {
  const v = vk ?? (text ? text.toUpperCase().charCodeAt(0) : 0);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text, unmodifiedText: text, modifiers, windowsVirtualKeyCode: v });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers, windowsVirtualKeyCode: v });
}
const centre = (expr) => ev(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
const shot = async (name, clip) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).data, 'base64'));
const slow = () => send('Animation.setPlaybackRate', { playbackRate: 0.1 });

async function load(path, { width = 1440, height = 900, ready } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send('Animation.setPlaybackRate', { playbackRate: 1 });
  await send('Page.navigate', { url: `${base}${path}` });
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    if (await ev(ready || `document.readyState === 'complete' && document.querySelectorAll('button').length > 2`).catch(() => false)) break;
  }
  await sleep(1200);   // hydration and first effects settle before anything is triggered
}

/** Every one-shot animation running now: what, on what, how far through. */
const RUNNING = `document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.getComputedTiming().iterations !== Infinity).map((a) => {
  const t = a.effect.target;
  return { kind: a.constructor.name, name: a.animationName || a.transitionProperty, on: (t.tagName.toLowerCase() + (t.getAttribute('role') ? '[role=' + t.getAttribute('role') + ']' : '') + (t.dataset.slot ? '[slot=' + t.dataset.slot + ']' : '')), progress: +(a.effect.getComputedTiming().progress ?? 1).toFixed(3) };
})`;
const keyframesOnly = (list) => list.filter((a) => a.kind === 'CSSAnimation');

/** Pause every animation whose target passes `pick`, seek it to each fraction, read `read(target)`. */
async function scrub(pick, read, fractions, frames) {
  const rows = [];
  for (const f of fractions) {
    const row = await ev(`(() => {
      const pick = ${pick};
      const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && pick(a.effect.target));
      if (!anims.length) return null;
      for (const a of anims) { a.pause(); const d = a.effect.getComputedTiming().duration; a.currentTime = Math.min(${f} * d, d - 0.001); }
      return { f: ${f}, names: [...new Set(anims.map((a) => a.animationName || a.transitionProperty))], ...(${read})(anims[0].effect.target) };
    })()`);
    rows.push(row);
    if (frames && row) {
      const clip = await ev(`(() => { const pick = ${pick}; const a = document.getAnimations().find((a) => a.effect && a.effect.target && pick(a.effect.target)); if (!a) return null; const r = a.effect.target.getBoundingClientRect(); return { x: Math.max(0, r.x - 60), y: Math.max(0, r.y - 60), width: r.width + 120, height: r.height + 120 }; })()`);
      if (clip) await shot(`${frames}-${String(Math.round(f * 100)).padStart(3, '0')}.png`, clip);
    }
  }
  return rows;
}
const GEOM = `(el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { top: +r.top.toFixed(2), left: +r.left.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), opacity: +(+s.opacity).toFixed(3), transform: s.transform, origin: s.transformOrigin }; }`;

const scenarios = {
  async toolbar() {
    await load('/dev-preview/editor', { ready: `document.querySelectorAll('.block-row').length > 3` });
    const WORD = `(() => { const row = [...document.querySelectorAll('.block-row')].find((r) => /A paragraph with enough text/.test(r.textContent)); if (!row) return null; row.scrollIntoView({ block: 'center' }); const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (/paragraph/.test(n.data)) break; } if (!n) return null; const i = n.data.indexOf('paragraph'); const r = document.createRange(); r.setStart(n, i + 1); r.setEnd(n, i + 3); const b = r.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`;
    let at = await ev(WORD);
    if (!at) return { skipped: 'paragraph not found' };
    await clickAt(...at); await sleep(700);          // the first click turns the block editable
    at = await ev(WORD);
    await slow();
    await clickAt(at[0], at[1], 2); await sleep(300);  // a double-click selects the word
    const PICK = `(t) => t.matches('[role=toolbar]') && getComputedStyle(t).position === 'fixed'`;
    const frames = await scrub(PICK, GEOM, [0, 0.25, 0.5, 0.999], 'toolbar');
    if (!frames[0]) return { skipped: 'the toolbar did not animate', running: await ev(RUNNING) };
    const settled = await ev(`(() => { const a = document.getAnimations().find((a) => a.effect && a.effect.target && (${PICK})(a.effect.target)); const t = a.effect.target; a.finish(); const r = t.getBoundingClientRect(); return { top: +r.top.toFixed(2), left: +r.left.toFixed(2), w: +r.width.toFixed(2) }; })()`);
    // The scale is 0.98 about the origin, so a toolbar that enters where it lives drifts
    // by at most 2% of its size; one positioned by the keyframe instead of its own
    // translate drifts by half its width.
    const mid = frames[2];
    const drift = { left: +Math.abs(mid.left - settled.left).toFixed(2), top: +Math.abs(mid.top - settled.top).toFixed(2) };
    return { frames, settled, drift, pass: drift.left <= 3 && drift.top <= 3 };
  },

  async dropdown() {
    await load('/dev-preview/overlay-states');
    const TRIGGER = `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open menu')`;
    const at = await centre(TRIGGER);
    await slow();
    await clickAt(...at); await sleep(150);
    const radix = await ev(`(() => { const c = document.querySelector('[data-slot="dropdown-menu-content"]'); return c && { side: c.dataset.side, align: c.dataset.align, radixOrigin: getComputedStyle(c).getPropertyValue('--radix-dropdown-menu-content-transform-origin').trim() }; })()`);
    const frames = await scrub(`(t) => t.matches('[data-slot="dropdown-menu-content"]')`, GEOM, [0, 0.1, 0.25, 1], 'dropdown');
    if (!frames[0]) return { skipped: 'no menu animation', radix };
    // Anchored at its top-left corner: that corner must not travel.
    const first = frames[0], last = frames.at(-1);
    const corner = { left: +Math.abs(first.left - last.left).toFixed(2), top: +Math.abs(first.top - last.top).toFixed(2) };
    return { radix, frames, cornerTravel: corner, pass: corner.left <= 0.5 && corner.top <= 0.5 };
  },

  async select() {
    await load('/dev-preview/overlay-states');
    const at = await centre(`document.querySelector('button[role=combobox][aria-label="Status"]')`);
    await slow();
    await clickAt(...at); await sleep(150);
    const PICK = `(t) => !!(t.querySelector && t.querySelector('[data-radix-select-viewport]'))`;
    const radix = await ev(`(() => { const v = document.querySelector('[data-radix-select-viewport]'); const c = v && v.parentElement; return c && { side: c.dataset.side, radixOrigin: getComputedStyle(c).getPropertyValue('--radix-select-content-transform-origin').trim(), computed: getComputedStyle(c).transformOrigin }; })()`);
    const frames = await scrub(PICK, GEOM, [0, 0.25, 1]);
    if (!frames[0]) return { skipped: 'no select animation', radix };
    const corner = { left: +Math.abs(frames[0].left - frames.at(-1).left).toFixed(2), top: +Math.abs(frames[0].top - frames.at(-1).top).toFixed(2) };
    return { radix, frames, cornerTravel: corner, pass: corner.left <= 0.5 && corner.top <= 0.5 };
  },

  async tooltip() {
    await load('/dev-preview/tasks');
    // The first DS tooltip that answers a real hover.
    const labels = await ev(`[...document.querySelectorAll('button[aria-label]')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.getAttribute('aria-label')).slice(0, 25)`);
    for (const label of labels) {
      const at = await centre(`[...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)})`);
      if (!at) continue;
      await mouse('mouseMoved', 5, 5); await sleep(350);          // leave, so the next hover pays the delay
      await slow();
      await mouse('mouseMoved', ...at); await sleep(900);         // Radix's 400ms delay, at real speed
      const found = await ev(`!!document.querySelector('[data-radix-popper-content-wrapper] [data-side]')`);
      if (!found) { await send('Animation.setPlaybackRate', { playbackRate: 1 }); continue; }
      const PICK = `(t) => t.matches('[data-radix-popper-content-wrapper] > [data-side]') && t.getAnimations().some((a) => a.animationName === 'emerge')`;
      const radix = await ev(`(() => { const c = document.querySelector('[data-radix-popper-content-wrapper] > [data-side]'); const s = getComputedStyle(c); return { label: ${JSON.stringify(label)}, side: c.dataset.side, radixOrigin: s.getPropertyValue('--radix-tooltip-content-transform-origin').trim(), computed: s.transformOrigin }; })()`);
      const frames = await scrub(PICK, GEOM, [0, 0.5, 1]);
      if (!frames[0]) return { radix, skipped: 'the tooltip did not animate' };
      // Growing out of the edge that faces the trigger: that edge does not move.
      const edge = radix.side === 'bottom' ? 'top' : radix.side === 'top' ? 'bottom' : null;
      const travel = edge === 'top' ? Math.abs(frames[0].top - frames.at(-1).top) : edge === 'bottom' ? Math.abs((frames[0].top + frames[0].h) - (frames.at(-1).top + frames.at(-1).h)) : null;
      return { radix, frames, facingEdgeTravel: travel === null ? null : +travel.toFixed(2), pass: travel !== null && travel <= 0.5 };
    }
    return { skipped: 'no DS tooltip answered a hover', tried: labels.length };
  },

  async keyKey() {
    await load('/dev-preview/tasks');
    await slow();
    await key('j', 'KeyJ', { text: 'j' }); await sleep(150);
    await key('s', 'KeyS', { text: 's' }); await sleep(200);
    const menu = await ev(`!!document.querySelector('[role=menu]')`);
    const running = keyframesOnly(await ev(RUNNING));
    return { input: await ev(`document.documentElement.dataset.input || null`), menuOpen: menu, running, pass: menu && running.length === 0 };
  },

  async keyPointer() {
    await load('/dev-preview/overlay-states');
    await key('j', 'KeyJ', { text: 'j' }); await sleep(100);     // the keyboard drove last…
    const at = await centre(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open menu')`);
    await slow();
    await clickAt(...at); await sleep(150);                       // …and then a pointer opens the menu
    const running = keyframesOnly(await ev(RUNNING));
    return { input: await ev(`document.documentElement.dataset.input || null`), running, pass: running.some((a) => a.name === 'emerge') };
  },

  async escClose() {
    // Opened by a pointer, closed by Escape: the close is the keyboard's, so no exit plays.
    await load('/dev-preview/overlay-states');
    await clickAt(...(await centre(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open menu')`)));
    await sleep(600);
    await slow();
    await key('Escape', 'Escape', { vk: 27 }); await sleep(120);
    const still = await ev(`!!document.querySelector('[data-slot="dropdown-menu-content"]')`);
    const running = keyframesOnly(await ev(RUNNING));
    return { menuStillMounted: still, running, pass: !still && running.length === 0 };
  },

  async pageIn() {
    // The page entrance under each hand. (A g-chord navigates to an authed route, so the
    // rule is read off a mounted page rather than driven through the chord.)
    await load('/dev-preview/tasks');
    const read = await ev(`(() => { const el = document.querySelector('.zb-page-in'); if (!el) return null; const h = document.documentElement;
      h.setAttribute('data-input', 'pointer'); const pointer = getComputedStyle(el).animationName;
      h.setAttribute('data-input', 'keyboard'); const keyboard = getComputedStyle(el).animationName;
      h.removeAttribute('data-input'); return { pointer, keyboard }; })()`);
    if (!read) return { skipped: 'no .zb-page-in on the page' };
    return { ...read, pass: read.pointer === 'zb-page-in' && read.keyboard === 'none' };
  },

  async iconSwap() {
    // Start ↔ Pause on the focus view: a click cross-fades the icon, the button keeps its
    // width, and Space (the view's own shortcut) swaps it without animating.
    await load('/dev-preview/focus');
    const BTN = `[...document.querySelectorAll('button')].find((b) => /^(Start|Pause)$/.test(b.textContent.trim()) && b.getBoundingClientRect().width > 40)`;
    const at = await centre(BTN);
    if (!at) return { skipped: 'no Start button' };
    const width0 = await ev(`(${BTN}).getBoundingClientRect().width`);
    await slow();
    await clickAt(...at); await sleep(120);
    const SPANS = `(t) => t.tagName === 'SPAN' && !!t.closest('button') && /^(Start|Pause)$/.test(t.closest('button').textContent.trim())`;
    const mid = await ev(`(() => { const pick = ${SPANS}; const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && pick(a.effect.target)); for (const a of anims) { a.pause(); a.currentTime = a.effect.getComputedTiming().duration * 0.3; } const spans = [...new Set(anims.map((a) => a.effect.target))]; return { animating: anims.length, spans: spans.map((s) => { const cs = getComputedStyle(s); return { opacity: +(+cs.opacity).toFixed(2), transform: cs.transform, filter: cs.filter, position: cs.position }; }) }; })()`);
    const width1 = await ev(`(${BTN}).getBoundingClientRect().width`);
    await send('Animation.setPlaybackRate', { playbackRate: 1 });
    await ev(`document.getAnimations().forEach((a) => a.finish())`); await sleep(400);
    await slow();
    await key(' ', 'Space', { text: ' ', vk: 32 }); await sleep(150);
    const byKey = await ev(`(() => { const pick = ${SPANS}; return document.getAnimations().filter((a) => a.effect && a.effect.target && pick(a.effect.target) && a.playState === 'running').length; })()`);
    const blurred = mid.spans.some((s) => /blur/.test(s.filter));
    return { width0, width1, mid, animatingAfterSpace: byKey, pass: mid.animating > 0 && blurred && Math.abs(width0 - width1) < 0.5 && byKey === 0 };
  },

  async sidebar() {
    // Collapse, then expand, the desktop sidebar. Every transition inside the panel is
    // seeked to the same MOMENT (not the same fraction: the labels fade over 100ms, the
    // width moves over 200ms), and every glyph's x is read at each moment.
    await load('/dev-preview/shell');
    const PANEL = `[...document.querySelectorAll('div')].find((d) => /var\\(--sidebar-w/.test(d.getAttribute('style') || ''))`;
    const READ = `(() => {
      const p = ${PANEL};
      const x = (el) => +el.getBoundingClientRect().left.toFixed(2);
      const moduleIcons = [...p.querySelectorAll('nav > a svg')].map(x);
      const pinnedIcons = [...p.querySelectorAll('nav .scroll-region a svg')].map(x);
      const control = p.querySelector('button[aria-label="Sidebar control"] svg');
      const brand = p.querySelector('svg[viewBox="0 0 152 32"]');
      const labels = [...p.querySelectorAll('nav a span')].filter((s) => s.textContent.trim().length > 2).map((s) => +getComputedStyle(s).opacity);
      return { w: +p.getBoundingClientRect().width.toFixed(1), moduleIcons, pinnedIcons, control: control ? x(control) : null, brand: brand ? x(brand) : null, labels: labels.length ? +Math.max(...labels).toFixed(2) : null };
    })()`;
    const AT = (t) => `(() => { const p = ${PANEL}; const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && (a.effect.target === p || p.contains(a.effect.target))); for (const a of anims) { a.pause(); const c = a.effect.getComputedTiming(); a.currentTime = Math.min(${t}, (c.delay || 0) + c.duration - 0.001); } return anims.length; })()`;
    const run = async (label) => {
      const before = await ev(READ);
      const at = await centre(`document.querySelector('button[aria-label="${label}"]')`);
      if (!at) return { skipped: `no "${label}" button` };
      await slow();
      await clickAt(...at); await sleep(60);
      const frames = [];
      for (const t of [0, 50, 100, 150, 200]) { const n = await ev(AT(t)); frames.push({ t, animations: n, ...(await ev(READ)) }); }
      await send('Animation.setPlaybackRate', { playbackRate: 1 });
      await ev(`document.getAnimations().forEach((a) => a.finish())`); await sleep(300);
      return { before, frames, after: await ev(READ) };
    };
    const icons = (r) => [...r.moduleIcons, ...r.pinnedIcons, r.control, r.brand].filter((v) => v !== null);
    const judge = (r, labelsGoneBy, oneLine) => {
      if (r.skipped) return { pass: false, why: r.skipped };
      const f0 = r.frames[0];
      // 1. no jump: the first frame is where the pointer left everything
      const jump = Math.max(...icons(r.before).map((v, i) => Math.abs(v - icons(f0)[i])));
      // 2. the module glyphs, header mark and control glide at most their 2px
      const moduleDrift = Math.max(...r.frames.flatMap((f) => [...f.moduleIcons, f.control, f.brand].filter((v) => v !== null).map((v, i) => Math.abs(v - [...r.before.moduleIcons, r.before.control, r.before.brand].filter((w) => w !== null)[i]))));
      // 3. every glyph ends on one line
      const endLine = icons(r.after).filter((_, i) => i < r.after.moduleIcons.length + r.after.pinnedIcons.length);
      const spread = endLine.length ? Math.max(...endLine) - Math.min(...endLine) : 0;
      return { jump: +jump.toFixed(2), moduleDrift: +moduleDrift.toFixed(2), labelsAt100: r.frames[2].labels, endSpread: +spread.toFixed(2), pass: jump <= 0.5 && moduleDrift <= 2.5 && (!oneLine || spread <= 1.5) && labelsGoneBy(r) };
    };
    const collapse = await run('Collapse sidebar');
    const c = judge(collapse, (r) => r.frames[2].labels !== null && r.frames[2].labels <= 0.05, true);
    const expand = await run('Expand sidebar');
    const e = judge(expand, (r) => r.frames[2].labels !== null && r.frames[2].labels <= 0.05 && r.after.labels === 1, false);
    return { collapse: { ...c, frames: collapse.frames, before: collapse.before, after: collapse.after }, expand: { ...e, frames: expand.frames }, pass: c.pass && e.pass };
  },

  async slash() {
    await load('/dev-preview/editor', { ready: `document.querySelectorAll('.block-row').length > 3` });
    const END = `(() => { const row = [...document.querySelectorAll('.block-row')].find((r) => /A paragraph with enough text/.test(r.textContent)); if (!row) return null; const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); let n, last = null; while ((n = w.nextNode())) { if (n.data.trim()) last = n; } const r = document.createRange(); r.setStart(last, last.length - 1); r.setEnd(last, last.length); const b = r.getBoundingClientRect(); return [b.right - 1, b.y + b.height / 2]; })()`;
    let at = await ev(END); if (!at) return { skipped: 'paragraph not found' };
    await clickAt(...at); await sleep(700);
    at = await ev(END); await clickAt(...at); await sleep(300);
    await key('End', 'End', { vk: 35 }); await sleep(100);
    await key('Enter', 'Enter', { vk: 13, text: '\r' }); await sleep(600);
    await slow();
    await key('/', 'Slash', { text: '/', vk: 191 }); await sleep(300);
    const open = await ev(`/Type to search/.test(document.body.innerText)`);
    const running = keyframesOnly(await ev(RUNNING));
    return { menuOpen: open, running, pass: open && running.length === 0 };
  },

  async dialogExit() {
    await load('/dev-preview/overlay-states');
    await clickAt(...(await centre(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open new project')`))); await sleep(1200);
    const cancel = await centre(`[...document.querySelectorAll('[role=dialog] button')].find((b) => /^cancel$/i.test(b.textContent.trim()))`);
    if (!cancel) return { skipped: 'no cancel button' };
    await slow();
    await clickAt(...cancel); await sleep(250);
    const mid = await ev(`(() => { const o = [...document.querySelectorAll('div')].find((d) => /\\bfixed\\b/.test(d.className) && /inset-0/.test(d.className) && /scrim/.test(d.className)); const c = document.querySelector('[role=dialog]'); return { overlayMounted: !!o, overlayOpacity: o ? +(+getComputedStyle(o).opacity).toFixed(3) : null, dialogMounted: !!c, running: document.getAnimations().filter((a) => a.animationName).map((a) => a.animationName + '@' + (a.effect.getComputedTiming().progress ?? 1).toFixed(2)) }; })()`);
    if (mid.dialogMounted) await shot('dialog-exit-mid.png');
    return { ...mid, pass: !mid.dialogMounted || (mid.overlayMounted && mid.overlayOpacity < 1) };
  },

  async navDrawer() {
    await load('/dev-preview/shell', { width: 390, height: 844 });
    const at = await centre(`[...document.querySelectorAll('button')].find((b) => /menu|navigation/i.test(b.getAttribute('aria-label') || ''))`);
    if (!at) return { skipped: 'no navigation button' };
    await slow();
    await clickAt(...at); await sleep(200);
    const PICK = `(t) => ['absolute', 'fixed'].includes(getComputedStyle(t).position) && t.getBoundingClientRect().height > 600 && t.getBoundingClientRect().width < 360 && t.getAnimations().some((a) => a.animationName)`;
    // Effective opacity: an element's own opacity cannot see a parent that is fading it.
    // The scrim and the drawer are seeked TOGETHER (every fixed-position animation), and
    // the reading is always taken off the drawer.
    const SEEN = `() => { const d = document.getAnimations().map((a) => a.effect && a.effect.target).find((t) => t && (${PICK})(t)); if (!d) return {}; let o = 1; for (let n = d; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return { ...(${GEOM})(d), seen: +o.toFixed(3) }; }`;
    const frames = await scrub(`(t) => getComputedStyle(t).position === 'fixed' || (${PICK})(t)`, SEEN, [0, 0.25, 0.5, 1], 'nav-drawer');
    if (!frames[0]) return { skipped: 'the drawer did not animate' };
    // A drawer that lives on the left edge must start further LEFT than it ends…
    const enters = frames[0].left < frames.at(-1).left && frames.every((f) => f.seen === 1);
    // …and leave the same way when the scrim is tapped, rather than vanish.
    await send('Animation.setPlaybackRate', { playbackRate: 1 });
    await ev(`document.getAnimations().forEach((a) => a.finish())`);
    await sleep(300);
    await slow();
    await clickAt(370, 420); await sleep(150);        // the scrim, right of the drawer
    const exit = await scrub(PICK, GEOM, [0, 0.5, 0.999]);
    const leaves = !!exit[0] && exit.at(-1).left < exit[0].left && exit[0].names.some((n) => /slide-out-left/.test(n));
    // …and is gone once it has left, not stranded invisible over the page.
    await send('Animation.setPlaybackRate', { playbackRate: 1 });
    await ev(`document.getAnimations().forEach((a) => a.finish())`);
    await sleep(250);
    const DRAWER = `[...document.querySelectorAll('div')].find((d) => ['absolute', 'fixed'].includes(getComputedStyle(d).position) && d.getBoundingClientRect().height > 600 && d.getBoundingClientRect().width < 360 && getComputedStyle(d).left === '8px')`;
    const gone = await ev(`!(${DRAWER})`);
    // …and it is a dialog to a keyboard: Tab stays inside it, Escape closes it, and
    // focus goes back to the button that opened it.
    await load('/dev-preview/shell', { width: 390, height: 844 });
    const opener = `[...document.querySelectorAll('button')].find((b) => /open navigation/i.test(b.getAttribute('aria-label') || ''))`;
    await clickAt(...(await centre(opener))); await sleep(500);
    let tabStaysInside = true;
    for (let i = 0; i < 40; i++) {
      await key('Tab', 'Tab', { vk: 9 }); await sleep(20);
      if (!(await ev(`(() => { const d = ${DRAWER}; return !!d && d.contains(document.activeElement); })()`))) { tabStaysInside = false; break; }
    }
    await key('Escape', 'Escape', { vk: 27 }); await sleep(400);
    const escapeCloses = await ev(`!(${DRAWER})`);
    const focusReturns = await ev(`document.activeElement === (${opener})`);
    return { frames, exit, enters, leaves, gone, tabStaysInside, escapeCloses, focusReturns, pass: enters && leaves && gone && tabStaysInside && escapeCloses && focusReturns };
  },
};

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') { const d = msg.params.exceptionDetails?.exception?.description ?? ''; if (!/Hydration/.test(d)) errors.push(d.slice(0, 200)); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Animation.enable');

  // ── SELF-TEST: can this ruler read a frame it was told to? ────────────────
  // A box that travels 100px over one second, linearly. Seeked to 50% it must
  // sit 50px along; if not, every number below is meaningless.
  await load('/dev-preview/overlay-states');
  await ev(`(() => { const s = document.createElement('style'); s.textContent = '@keyframes zb-slowmo-probe { from { transform: translateX(100px); } to { transform: none; } }'; document.head.appendChild(s); const b = document.createElement('div'); b.id = 'zb-slowmo-probe'; b.style.cssText = 'position:fixed;left:0;top:0;width:10px;height:10px;animation:zb-slowmo-probe 1000ms linear'; document.body.appendChild(b); return true; })()`);
  const probe = await scrub(`(t) => t.id === 'zb-slowmo-probe'`, `(el) => ({ left: el.getBoundingClientRect().left })`, [0.5]);
  if (!probe[0] || Math.abs(probe[0].left - 50) > 0.5) {
    console.log(`  SELF-TEST FAILED - a box seeked to 50% of a 100px travel read ${probe[0] ? probe[0].left + 'px' : 'nothing'}; refusing to report`);
    process.exitCode = 2;
    throw new Error('self-test');
  }
  console.log(`  self-test: seeked to 50%, the probe sits at ${probe[0].left}px of 100px`);

  const report = {};
  for (const [name, run] of Object.entries(scenarios)) {
    if (only.length && !only.includes(name)) continue;
    try { report[name] = await run(); } catch (e) { report[name] = { error: String(e.message || e).slice(0, 300) }; }
    const r = report[name];
    console.log(`  ${name.padEnd(11)} ${r.error ? 'ERROR ' + r.error : r.skipped ? 'skipped: ' + r.skipped : r.pass ? 'pass' : 'FAIL'}`);
  }
  report.errors = errors.slice(0, 5);
  writeFileSync(join(out, 'slow-motion.json'), JSON.stringify(report, null, 2));
  console.log(`  details: ${join(out, 'slow-motion.json')}`);
  if (Object.values(report).some((r) => r && r.pass === false)) process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill(); await sleep(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
