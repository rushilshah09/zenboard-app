// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// The content calendar at phone and desktop widths: real key presses through the
// day grid, a real tap on an agenda entry, and the width at which the layout
// switches, read from the calendar's own container.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-content-calendar.mjs http://localhost:3000
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base] = process.argv.slice(2);
const PORT = 9336;
const profile = mkdtempSync(join(tmpdir(), 'zb-cal-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 240)); return r.result.value; };
const size = (width, height, mobile) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
async function key(k, code) {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[k] });
  await sleep(120);
}
async function tap(selector) {
  const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
  if (!c) throw new Error('no element ' + selector);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
}
const narrow = () => ev(`({
  selected: document.querySelector('[data-day][aria-pressed=true]')?.getAttribute('aria-label'),
  focused: document.activeElement?.getAttribute('data-day'),
  tabStops: [...document.querySelectorAll('[data-day]')].filter((b) => b.tabIndex === 0).length,
  cells: document.querySelector('[aria-label^="Days in"]')?.children.length,
  agenda: [...document.querySelectorAll('section ul li button')].map((b) => b.innerText.replace(/\\n/g, ' | ')),
})`);
const layout = () => ev(`(() => {
  const wide = document.querySelector('.grid-rows-6')?.parentElement?.parentElement;
  const root = wide?.parentElement;
  return { container: Math.round(root?.getBoundingClientRect().width ?? -1), wide: wide && getComputedStyle(wide).display };
})()`);

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');

  // ── PHONE ──
  await size(375, 812, true);
  await send('Page.navigate', { url: `${base}/dev-preview/content?view=calendar` });
  for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('[data-day]')`).catch(() => false)) break; }
  await sleep(700);
  log.phone_open = await narrow();

  // Real keys: from Sat 5, three left lands on Wed 2 — the late piece.
  await ev(`document.querySelector('[data-day][aria-pressed=true]').focus(), true`);
  for (let i = 0; i < 3; i++) await key('ArrowLeft', 'ArrowLeft');
  log.phone_after_3_left = await narrow();
  log.phone_late_badge = await ev(`[...document.querySelectorAll('section ul li [data-status], section ul li span')].some((e) => e.textContent.trim() === 'Late')`);
  await key('ArrowDown', 'ArrowDown');
  log.phone_after_down = await narrow();

  // A real tap on the first agenda entry of Wed 9 → back up to 2 and tap the publish.
  await key('ArrowUp', 'ArrowUp');
  await tap('section ul li button');
  await sleep(900);
  log.phone_tap_opens = await ev(`location.search`);

  // ── DESKTOP ──
  await send('Page.navigate', { url: `${base}/dev-preview/content?view=calendar` });
  await size(1440, 900, false);
  for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.grid-rows-6')`).catch(() => false)) break; }
  await sleep(700);
  log.desktop = await ev(`(() => {
    const chips = [...document.querySelectorAll('button[title]')].filter((b) => /^(Publish|Shoot day|Late):/.test(b.title));
    const late = chips.find((b) => b.title.startsWith('Late:'));
    return {
      chips: chips.length,
      titleFont: getComputedStyle(chips[0].querySelector('span')).fontSize,
      lateChip: late ? { title: late.title, colour: getComputedStyle(late.querySelector('span')).color } : null,
      normalColour: getComputedStyle(chips.find((b) => b !== late).querySelector('span')).color,
    };
  })()`);

  // ── THE SWITCH ── walk the viewport and read the calendar's own width.
  log.switch = [];
  for (const w of [1440, 1024, 900, 800, 760, 740, 720, 700, 680, 640, 375]) {
    await size(w, 900, w < 768);
    await sleep(350);
    log.switch.push({ viewport: w, ...(await layout()) });
  }
} catch (e) {
  log.error = String(e?.message || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL'); await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
