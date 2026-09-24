// ── CALENDAR CAPTURES, NO DEPENDENCIES ─────────────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// The design record for the Calendar: every view of /dev-preview/calendar at a real desktop size, light and dark,
// plus the composer and a phone — the same frames before and after a visual change, so a change is judged against
// its own before rather than from memory. The harness stages its own events (overlaps, all-day, timebox twins,
// milestones); any database request is answered here with nothing, so no real data is read.
//
// Usage:
//   node --experimental-websocket scripts/verify/capture-calendar.mjs http://localhost:3000 <out-dir> [prefix]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, prefix = ''] = process.argv.slice(2);
const PORT = 9393;
const profile = mkdtempSync(join(tmpdir(), 'zb-cal-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function clickAt(p) {
  if (!p) throw new Error('nothing to click');
  await mouse('mouseMoved', p[0], p[1]); await sleep(80);
  await mouse('mousePressed', p[0], p[1], 1); await mouse('mouseReleased', p[0], p[1]);
  await sleep(500);
}
const shot = async (name) => writeFileSync(join(out, `${prefix}${name}`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
/** Scroll the time grid so `hour` sits near the top — the working day, not midnight. */
const scrollGridTo = (hour) => ev(`(() => {
  const label = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Design review');
  let s = label?.parentElement;
  while (s && !(s.scrollHeight > s.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  if (!s) return false;
  const row = s.scrollHeight / 24;
  s.scrollTop = Math.max(0, ${hour} * row - 8);
  return true;
})()`);
const scheme = (value) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
const log = {};

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      const empty = request.method === 'OPTIONS' ? { responseCode: 204 } : { responseCode: request.url.includes('/auth/v1/') ? 401 : 200, body: Buffer.from('[]').toString('base64') };
      void send('Fetch.fulfillRequest', { requestId, ...empty, responseHeaders: [{ name: 'access-control-allow-origin', value: new URL(base).origin }, { name: 'access-control-allow-headers', value: '*' }, { name: 'content-type', value: 'application/json' }] });
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/rest/v1/*', requestStage: 'Request' }, { urlPattern: '*/auth/v1/*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await scheme('light');
  await send('Page.navigate', { url: `${base}/dev-preview/calendar` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`document.body.innerText.includes('Design review')`).catch(() => false)) break; }
  await sleep(1200);

  // Week — the default view, the working day in frame.
  log.scrolled = await scrollGridTo(8);
  await sleep(300);
  await shot('week-light.png');
  await scheme('dark'); await sleep(500);
  await shot('week-dark.png');
  await scheme('light'); await sleep(300);

  // The composer, opened on an event.
  await clickAt(await at('*', `e.children.length === 0 && e.textContent.trim() === 'Deep work — portal polish'`));
  await sleep(600);
  await shot('composer-light.png');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(500);

  // Day and Month.
  await clickAt(await at('button, [role=radio], [role=tab]', `e.textContent.trim() === 'Day'`));
  await sleep(600);
  await scrollGridTo(8); await sleep(300);
  await shot('day-light.png');
  await clickAt(await at('button, [role=radio], [role=tab]', `e.textContent.trim() === 'Month'`));
  await sleep(700);
  await shot('month-light.png');
  await scheme('dark'); await sleep(500);
  await shot('month-dark.png');
  await scheme('light'); await sleep(300);

  // A phone, which opens on the Day view.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.reload');
  for (let i = 0; i < 60; i++) { await sleep(400); if (await ev(`document.body.innerText.includes('Design review')`).catch(() => false)) break; }
  await sleep(1000);
  await scrollGridTo(8); await sleep(300);
  await shot('phone.png');
  log.phoneOverflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  log.consoleErrors = errors.slice(0, 6);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 6);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
