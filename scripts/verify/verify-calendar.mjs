// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// The Calendar's visual pass (2026-09-21), on /dev-preview/calendar's staged week. Any database request is answered
// here with nothing; the harness moves events in local state, so nothing is written anywhere.
//   S  the grid is the bright surface: a neutral event card stands off it in light AND dark (on paper-2 the card and
//      the grid were the same grey, and in dark the card was the darker of the two)
//   Z  the gutter names the zone the times are in (it said "GMT" in India)
//   O  overlaps stack: Design review keeps its whole column and title, the 15-minute Standup sits on it stepped in
//   T  no time wraps onto a second line, and a short block's name is not traded for its time in a narrow column
//   D  grabbing a coloured event keeps its colour and name under the pointer (user report: an ochre event turned the
//      default magenta and became "New event"), and letting go lands it an hour later
//   M  the month names its columns from its own days (Monday the 21st sat under "Sun"), the neighbouring months
//      recede, and every chip time is a full clock time ("07:00", never "07")
//   C  the composer grows from the point that opened it, and its Delete is not a second filled button
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-calendar.mjs http://localhost:3000 <out-dir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9394;
const profile = mkdtempSync(join(tmpdir(), 'zb-cal-verify-'));
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
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const scheme = (value) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const scrollGridTo = (hour) => ev(`(() => {
  const card = document.querySelector('[title="Design review"]');
  let s = card?.parentElement;
  while (s && !(s.scrollHeight > s.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  if (!s) return false;
  s.scrollTop = Math.max(0, ${hour} * (s.scrollHeight / 24) - 8);
  return true;
})()`);
// In the page: any CSS colour → sRGB bytes (the canvas reads lab()/oklab()/color-mix() as the browser paints them),
// and WCAG relative luminance, so two surfaces can be compared as they appear.
const PAINT = `const paint = (c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1, 1); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const opaque = (c) => { const m = c.match(/\\/\\s*([\\d.]+)\\s*\\)$|rgba\\([^)]*,\\s*([\\d.]+)\\)$/); return !m || Number(m[1] ?? m[2]) >= 1; };
  const surfaceOf = (el) => { let e = el; while (e && !opaque(getComputedStyle(e).backgroundColor)) e = e.parentElement; return e ? getComputedStyle(e).backgroundColor : 'rgb(255,255,255)'; };`;
const cardVsGrid = () => ev(`(() => { ${PAINT}
  // Tuesday's: today's column wears a translucent wash, which is not the surface being judged.
  const card = document.querySelector('[title="Client call — Life Studio"]');
  if (!card) return null;
  const c = paint(getComputedStyle(card).backgroundColor), g = paint(surfaceOf(card.parentElement));
  return { card: c, grid: g, ratio: Math.round(ratio(c, g) * 1000) / 1000, cardLighter: lum(c) > lum(g) };
})()`);
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
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('[title="Design review"]')`).catch(() => false)) break; }
  await sleep(1000);
  await scrollGridTo(8); await sleep(300);

  // S — the card stands off the grid, in both themes.
  log.S_light = await cardVsGrid();
  await scheme('dark'); await sleep(500);
  log.S_dark = await cardVsGrid();
  await scheme('light'); await sleep(300);

  // Z — the zone.
  log.Z = await ev(`(() => {
    const off = -new Date().getTimezoneOffset();
    const a = Math.abs(off), h = Math.floor(a / 60), m = a % 60;
    const expected = off ? 'GMT' + (off > 0 ? '+' : '−') + h + (m ? ':' + String(m).padStart(2, '0') : '') : 'GMT';
    const shown = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^GMT/.test(d.textContent.trim()))?.textContent.trim() ?? null;
    return { shown, expected, ok: shown === expected };
  })()`);

  // O — overlaps stack.
  log.O = await ev(`(() => {
    const dr = document.querySelector('[title="Design review"]'), su = document.querySelector('[title="Standup"]');
    const col = dr.parentElement.getBoundingClientRect(), a = dr.getBoundingClientRect(), b = su.getBoundingClientRect();
    const titleOf = (card) => [...card.querySelectorAll('div')].find((d) => d.textContent === card.getAttribute('title') && d.children.length === 0);
    const whole = (el) => el && el.scrollWidth <= el.clientWidth;
    return {
      reviewSpansColumn: Math.round(col.width - a.width) <= 4,
      standupSteppedIn: Math.round(b.left - a.left),
      standupAbove: Number(getComputedStyle(su).zIndex) > Number(getComputedStyle(dr).zIndex),
      reviewTitleWhole: whole(titleOf(dr)),
    };
  })()`);

  // T — no time wraps, and a short block keeps its name in a narrow column.
  log.T = await ev(`(() => {
    const cards = [...document.querySelectorAll('[title]')].filter((c) => c.className.includes('@container'));
    const wrapped = cards.flatMap((c) => [...c.querySelectorAll('div.text-caption')].filter((d) => d.getClientRects().length && d.getBoundingClientRect().height > 20).map(() => c.getAttribute('title')));
    const name = (t) => { const c = document.querySelector('[title="' + t + '"]'); const n = c && [...c.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent === t); return n ? n.scrollWidth <= n.clientWidth : null; };
    return { cards: cards.length, wrapped, standupWhole: name('Standup'), invoiceWhole: name('Invoice sweep'), weeklyWhole: name('Weekly review') };
  })()`);
  await shot('verify-week.png');

  // D — grab the ochre event, carry it an hour down, read the ghost mid-drag, let go.
  const barOf = (sel) => ev(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); const bar = c && c.querySelector('span[aria-hidden]'); return bar ? getComputedStyle(bar).backgroundColor : null; })()`);
  log.D_cardBar = await barOf('[title="Portfolio pass"]');
  const from = await at('[title="Portfolio pass"]');
  if (from) {
    await mouse('mouseMoved', from[0], from[1] - 20); await sleep(60);
    await mouse('mousePressed', from[0], from[1] - 20, 1); await sleep(60);
    for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', from[0], from[1] - 20 + i * 10, 1); await sleep(40); }
    await sleep(150);
    log.D_ghost = await ev(`(() => { const g = document.querySelector('[data-ghost]'); if (!g) return null; const bar = g.querySelector('span[aria-hidden]'); const name = [...g.querySelectorAll('div')].find((d) => d.children.length === 0 && d.className.includes('text-ui')); return { bar: getComputedStyle(bar).backgroundColor, name: name?.textContent ?? null, timeWraps: [...g.querySelectorAll('div.text-caption')].some((d) => d.getClientRects().length && d.getBoundingClientRect().height > 20) }; })()`);
    await shot('verify-drag.png');
    await mouse('mouseReleased', from[0], from[1] - 20 + 80);
    await sleep(500);
    log.D_landed = await ev(`[...document.querySelector('[title="Portfolio pass"]').querySelectorAll('div.text-caption')].map((d) => d.textContent).join(' ')`);
  }

  // C — the composer: grows from the click, and Delete is not filled.
  const target = await at('[title="Deep work — portal polish"]');
  await clickAt(target);
  await sleep(400);
  log.C = await ev(`(() => {
    const d = document.querySelector('[role=dialog][aria-label="Event"]');
    if (!d) return null;
    const r = d.getBoundingClientRect(), o = getComputedStyle(d).transformOrigin.split(' ').map(parseFloat);
    const del = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete');
    const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max));
    const expected = [clamp(${target?.[0] ?? 0} - r.left, r.width), clamp(${target?.[1] ?? 0} - r.top, r.height)];
    const got = o.map(Math.round);
    return { origin: getComputedStyle(d).transformOrigin, expected, fromClick: Math.abs(got[0] - expected[0]) <= 2 && Math.abs(got[1] - expected[1]) <= 2, deleteFill: del ? getComputedStyle(del).backgroundColor : null };
  })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);

  // M — the month.
  await clickAt(await at('button, [role=radio], [role=tab]', `e.textContent.trim() === 'Month'`));
  await sleep(700);
  log.M = await ev(`(() => { ${PAINT}
    const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heads = [...document.querySelectorAll('div')].filter((d) => d.children.length === 0 && WD.includes(d.textContent.trim()) && d.className.includes('text-overline'));
    const today = new Date();
    const CELLS = '[class*="min-h-[104px]"]';
    const pill = [...document.querySelectorAll(CELLS + ' span')].find((s) => s.textContent.trim() === String(today.getDate()) && getComputedStyle(s).backgroundColor !== 'rgba(0, 0, 0, 0)');
    const px = pill.getBoundingClientRect().left + pill.getBoundingClientRect().width / 2;
    const over = heads.find((h) => { const r = h.getBoundingClientRect(); return px >= r.left && px <= r.right; });
    const cell = (n, inMonth) => [...document.querySelectorAll(CELLS + ' span')].filter((s) => s.textContent.trim() === String(n)).map((s) => s.closest(CELLS)).find((c) => c && (inMonth ? !c.className.includes('bg-background') : c.className.includes('bg-background')));
    const outCell = cell(31, false) ?? cell(1, false), inCell = cell(15, true);
    const chipTimes = [...document.querySelectorAll(CELLS + ' button span.tabular-nums')].map((s) => s.textContent.trim()).filter(Boolean);
    return {
      header: heads.map((h) => h.textContent.trim()),
      todayUnder: over?.textContent.trim() ?? null, todayIs: WD[today.getDay()],
      outRecedes: outCell && inCell ? lum(paint(surfaceOf(outCell))) < lum(paint(surfaceOf(inCell))) : null,
      chipTimes, allFullClock: chipTimes.length > 0 && chipTimes.every((t) => /^\\d\\d:\\d\\d$/.test(t)),
    };
  })()`);
  await shot('verify-month.png');
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
