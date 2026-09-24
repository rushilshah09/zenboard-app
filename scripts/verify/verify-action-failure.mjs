// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// Drives the Chrome already installed on this Mac over the DevTools protocol:
// headless, in a throwaway profile (no access to your browsing data), with real
// trusted mouse events. Needs Node 20+ and `--experimental-websocket`.
//
// Why this exists: the in-app browser's `left_click_drag` fires press, move and
// release as ONE atomic step, which never satisfies dnd-kit's 4px activation
// constraint — so a working drag looked broken. It also cannot cut the network
// or answer a request as a different deployment would. This can do all three.
//
// Run against a `next dev` server (dev-preview harnesses only exist there).
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-action-failure.mjs http://localhost:3000 /tmp

// Real clicks against /dev-preview/action-failure over the DevTools protocol.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, outDir] = process.argv.slice(2);
const PORT = 9334;
const profile = mkdtempSync(join(tmpdir(), 'zb-fail-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1200,800', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 240)); return r.result.value; };
async function click(selector) {
  const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
  if (!c) throw new Error('no element ' + selector);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  }
}
const state = () => ev(`({
  row1: document.querySelector('[data-row=r1]')?.getAttribute('data-state'),
  row2: document.querySelector('[data-row=r2]')?.getAttribute('data-state'),
  row3: document.querySelector('[data-row=r3]')?.getAttribute('data-state'),
  resyncs: Number(document.querySelector('[data-resyncs]')?.getAttribute('data-resyncs') ?? -1),
  toasts: [...document.querySelectorAll('[role=status]')].map(e => e.textContent.trim()).filter(t => !/^$/.test(t) && !/Draggable/.test(t)),
})`);
async function load(url) {
  await send('Page.navigate', { url });
  for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('[data-row=r1]')`).catch(() => false)) break; }
  await sleep(600);
}

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');

  // Known starting state.
  await load(`${base}/dev-preview/action-failure`);
  await click('[data-reset]');
  await sleep(2500);
  await load(`${base}/dev-preview/action-failure`);
  log.start = await state();

  // 1 — THE FAILURE. Arm, tick, sample immediately, sample after the round trip.
  await click('[data-arm]');
  await sleep(600);
  await click('[data-row=r1]');
  await sleep(120);
  log.failure_immediately = await state();          // optimistic: should be checked
  await sleep(3000);
  log.failure_after = await state();                // net + refresh: should be unchecked, toast shown
  writeFileSync(join(outDir, 'failure-after.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

  // 3 — UNREACHABLE. Cut the network for real, tick, and restore it: the tick
  // cannot reach the server, the net must say so, and when the connection comes
  // back the refresh must put the row back.
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await click('[data-row=r3]');
  await sleep(120);
  log.offline_immediately = await state();          // optimistic: row3 checked
  await sleep(1400);
  log.offline_during = await state();               // toast: couldn't reach; row3 still shows the optimistic tick
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ev(`window.dispatchEvent(new Event('online')), true`);   // headless emulation does not always fire it
  await sleep(3500);
  log.offline_back_online = await state();          // refreshed: row3 unchecked again

  // 2 — THE CONTROL. A save that succeeds must NOT be reverted, and must survive a reload.
  await click('[data-row=r2]');
  await sleep(3000);
  log.success_after = await state();                // should stay checked
  await load(`${base}/dev-preview/action-failure`);
  log.success_after_reload = await state();         // server truth: r2 checked, r1 not
} catch (e) {
  log.error = String(e?.message || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL'); await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
