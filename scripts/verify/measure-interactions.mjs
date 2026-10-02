// ── INTERACTION LATENCY, NO DEPENDENCIES ──────────────────────────────────
// How long the most frequent things take to answer: ticking a task, opening one,
// switching a view, typing, the command palette. Measured with the Event Timing
// API — the same source INP is computed from — over REAL, trusted input sent
// through the DevTools protocol (a synthetic .click() is never reported by Event
// Timing, so a script that clicks from inside the page measures nothing).
//
// HOW, and why not Event Timing: the first version used the Event Timing API
// (INP's source). Its own self-test killed it in headless Chrome - an entry is
// only finalised at the next paint, headless frames are irregular, and the same
// 150ms click produced three entries on one run and ZERO on the next. So this
// times the dispatch directly: a capture listener on window runs before every
// handler the app has (React listens on its root), and a setTimeout(0) queued
// from it fires only after the whole dispatch - React's synchronous re-render and
// layout effects included - has finished. That gap is HANDLER time, and
// event.timeStamp to the capture listener is INPUT DELAY. Neither depends on a
// paint, so both are deterministic headless. Paint cost is not measured here.
//
// DEV-MODE NUMBERS ARE INFLATED: React's development build does extra work on
// every render. Read the SHAPE (which interaction is heavy relative to the
// others) and confirm anything that matters against a production build.
//
// Usage: node --experimental-websocket scripts/verify/measure-interactions.mjs [baseUrl] [--runs N]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9351;
const profile = mkdtempSync(join(tmpdir(), 'zb-inp-'));
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


const argv = process.argv.slice(2);
const base = argv.find((a) => a.startsWith('http')) || 'http://localhost:3000';
const RUNS = Number(argv[argv.indexOf('--runs') + 1] || 5) || 5;

const OBSERVE = `(() => {
  window.__ev = [];
  if (window.__timed) return true;
  window.__timed = true;
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'input']) {
    window.addEventListener(type, (e) => {
      const start = performance.now();
      const row = { name: type, t0: e.timeStamp, start, end: null };
      window.__ev.push(row);
      // Fires after the whole dispatch, React's synchronous work included.
      setTimeout(() => { row.end = performance.now(); }, 0);
    }, { capture: true });
  }
  return true;
})()`;

const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
const center = (selector) => evaluate(`(() => { const el = ${selector}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
async function click(selector) {
  const c = await center(selector);
  if (!c) return false;
  await mouse('mouseMoved', c[0], c[1]); await sleep(30);
  await mouse('mousePressed', c[0], c[1]); await sleep(40);
  await mouse('mouseReleased', c[0], c[1]);
  return true;
}
async function key(k, code, text, modifiers = 0) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text, modifiers, windowsVirtualKeyCode: text ? text.toUpperCase().charCodeAt(0) : 0 });
  await sleep(25);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers });
}

// The worst event of each interaction that began after `since`.
async function readSince(since) {
  await sleep(400);
  const rows = await evaluate(`window.__ev.filter((e) => e.start >= ${since} && e.end !== null).map((e) => ({ name: e.name, delay: e.start - e.t0, start: e.start, end: e.end, proc: e.end - e.start }))`);
  if (!rows.length) return [];
  // pointerup and click are dispatched in the SAME task, so both timers fire after
  // the click's handlers and each reads the full 150ms: summing counted the
  // self-test's handler twice (305ms). Merge overlapping intervals instead.
  const spans = rows.map((r) => [r.start, r.end]).sort((a, b) => a[0] - b[0]);
  let proc = 0, [cs, ce] = spans[0];
  for (const [s0, e0] of spans.slice(1)) {
    if (s0 <= ce) ce = Math.max(ce, e0);
    else { proc += ce - cs; [cs, ce] = [s0, e0]; }
  }
  proc += ce - cs;
  const heaviest = rows.reduce((a, r) => (r.proc > a.proc ? r : a), rows[0]);
  return [{ name: heaviest.name, dur: Math.round(proc), delay: Math.round(Math.max(0, rows[0].delay)), proc: Math.round(proc), pres: 0 }];
}
const now = () => evaluate('performance.now()');

async function load(path) {
  await send('Page.navigate', { url: `${base}${path}` });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await evaluate(`document.querySelectorAll('button').length > 3 && document.body.innerText.trim().length > 40`).catch(() => false)) break;
  }
  await sleep(1200);  // hydration and first effects settle before anything is timed
  await evaluate(OBSERVE);
}

const results = [];
async function measure(label, path, act, reset) {
  await load(path);
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const t = await now();
    const ok = await act();
    if (!ok) { results.push({ label, skipped: true }); return; }
    const ev = await readSince(t);
    const worst = ev.sort((a, b) => b.proc - a.proc)[0];
    samples.push(worst || { dur: 0, delay: 0, proc: 0, pres: 0, name: '(<16ms)' });
    if (reset) await reset();
    await sleep(300);
  }
  const sorted = [...samples].sort((a, b) => a.dur - b.dur);
  const med = sorted[Math.floor(sorted.length / 2)];
  // Rank runs by HANDLER time, the number this environment measures exactly.
  const byProc = [...samples].sort((a, b) => a.proc - b.proc);
  const mid = byProc[Math.floor(byProc.length / 2)];
  results.push({ label, median: mid.dur, breakdown: mid, procs: samples.map((x) => x.proc) });
}

try {
  await up();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // ── SELF-TEST: can this ruler see a slow interaction at all? ──────────────
  // A button whose click handler blocks the main thread for 150ms. If the probe
  // does not report roughly that, every "fast" below is meaningless.
  await load('/dev-preview/tasks');
  await evaluate(`(() => {
    const b = document.createElement('button');
    b.id = 'zb-slow-probe'; b.textContent = 'slow probe';
    b.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:99999;width:120px;height:40px';
    b.addEventListener('click', () => { window.__probeClicks = (window.__probeClicks || 0) + 1; const t = performance.now(); while (performance.now() - t < 150) {} });
    document.body.appendChild(b);
    return true;
  })()`);
  {
    const t = await now();
    await click(`document.getElementById('zb-slow-probe')`);
    const ev = await readSince(t);
    const worst = ev.sort((a, b) => b.proc - a.proc)[0];
    if (!worst || worst.proc < 140 || worst.proc > 220) {
      console.log(`  SELF-TEST FAILED - a 150ms handler read as ${worst ? worst.proc + 'ms of handlers' : 'nothing'}; refusing to report`);
      console.log('  debug:', JSON.stringify(await evaluate(`window.__ev.slice(-6).map((e) => e.name + ' start=' + Math.round(e.start) + ' end=' + Math.round(e.end))`)));
      process.exitCode = 2;
      throw new Error('self-test');
    }
    console.log(`  self-test: a 150ms handler reads as ${worst.proc}ms handlers / ${worst.dur}ms total (${worst.name})`);
  }

  const TICK = `document.querySelector('[aria-label="Mark done"]')`;
  const UNTICK = `document.querySelector('[aria-label="Mark not done"]')`;
  await measure('tick a task', '/dev-preview/tasks', () => click(TICK), () => click(UNTICK));

  {
    // Time from the press to the detail actually being on screen - the part INP
    // cannot see when the render lands after a transition.
    await load('/dev-preview/tasks');
    const seen = [];
    for (let i = 0; i < RUNS; i++) {
      await evaluate(`(() => { window.__opened = null; const start = location.search; const mo = new MutationObserver(() => { if (location.search !== start && window.__opened === null) { requestAnimationFrame(() => { window.__opened = performance.now(); }); mo.disconnect(); } }); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); return true; })()`);
      const t0 = await now();
      await click(`[...document.querySelectorAll('button,[role=button]')].find((b) => /Review the launch checklist/.test(b.textContent || ''))`);
      await sleep(900);
      const opened = await evaluate('window.__opened');
      seen.push(opened ? Math.round(opened - t0) : null);
      await send('Page.navigate', { url: `${base}/dev-preview/tasks` }); await sleep(2500);
    }
    // t0 is taken BEFORE the press is dispatched, so this includes the ~70ms the
    // harness itself spends moving and pressing; subtract nothing, report both.
    results.push({ label: 'open a task: press to visible', visible: seen });
  }

  await measure('open a task', '/dev-preview/tasks',
    () => click(`[...document.querySelectorAll('button,[role=button]')].find((b) => /Review the launch checklist/.test(b.textContent || ''))`),
    async () => { await send('Page.navigate', { url: `${base}/dev-preview/tasks` }); await sleep(2500); await evaluate(OBSERVE); });

  await measure('switch a view (segmented)', '/dev-preview/clients',
    () => click(`[...document.querySelectorAll('[role=radio]')].find((r) => r.getAttribute('aria-checked') !== 'true')`));

  await measure('type into the palette', '/dev-preview/shell',
    async () => {
      if (!(await evaluate(`!!document.querySelector('input[placeholder^="Search, navigate"]')`))) { await key('k', 'KeyK', '', 4); await sleep(500); }
      const ok = await evaluate(`(() => { const i = document.querySelector('input[placeholder^="Search, navigate"]'); if (!i) return false; i.focus(); return true; })()`);
      if (!ok) return false;
      await key('t', 'KeyT', 't');
      return true;
    });

  await measure('open the command palette', '/dev-preview/shell',
    async () => { await key('k', 'KeyK', '', 4 /* meta */); return true; },
    async () => { await key('Escape', 'Escape', ''); });

  console.log(`\n  interaction latency, ${RUNS} runs each (dev build - read the shape, not the absolute)\n`);
  for (const r of results) {
    if (r.skipped) { console.log(`  ${r.label.padEnd(28)} skipped (control not found)`); continue; }
    if (r.visible) { console.log(`  ${r.label.padEnd(28)} [${r.visible.join(', ')}]ms from before the press (includes ~70ms of harness press time)`); continue; }
    const b = r.breakdown;
    console.log(`  ${r.label.padEnd(28)} input delay ${String(b.delay).padStart(3)}ms · handlers ${String(b.proc).padStart(3)}ms   [handlers per run: ${r.procs.join(', ')}]  (${b.name})`);
  }
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
