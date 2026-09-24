// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol: a bar is dragged with real, multi-step pointer events.
//
// The Timeline view (database plan T9, after Notion): each page a bar from Start
// to Due; drag a bar to move it in time, drag its edge to change one date, click
// it to open the page, arrows to nudge it, zoom from Week to Year, Today to come
// home, and the pages with no dates one click away.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-timeline.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9353;
const profile = mkdtempSync(join(tmpdir(), 'zb-timeline-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); }
async function key(k, code, vk) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const click = async (sel, test, wait = 450) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at); await sleep(wait); };
/** Every bar: its label (name and dates), left and width in px. */
const bars = () => ev(`[...document.querySelectorAll('[data-timeline-bar]')].map((b) => ({ label: b.getAttribute('aria-label'), left: Math.round(parseFloat(b.style.left)), width: Math.round(b.getBoundingClientRect().width) }))`);
const barRect = (name) => ev(`(() => { const b = [...document.querySelectorAll('[data-timeline-bar]')].find((x) => x.getAttribute('aria-label').startsWith(${JSON.stringify(name)})); b.scrollIntoView({ block: 'center', inline: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);

async function drag(from, to) {
  await mouse('mouseMoved', from[0], from[1]);
  await mouse('mousePressed', from[0], from[1], 1);
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', from[0] + (to[0] - from[0]) * i / 10, from[1] + (to[1] - from[1]) * i / 10, 1); await sleep(25); }
  await mouse('mouseReleased', to[0], to[1]);
  await sleep(400);
}

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Projects tracker/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  log.theme = theme;
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 900);
  // Past three views the rest fold under "N more…" (the view bar, 2026-09-15).
  if (await centre('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === 'Timeline'`)) {
    await click('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === 'Timeline'`, 900);
  } else {
    await click('button', `/^\\d+ more…$/.test(e.textContent.trim())`, 600);
    await click('.group > button.flex-1', `e.textContent.trim() === 'Timeline'`, 900);
  }

  log.rest = await ev(`(() => {
    const t = document.querySelector('[data-timeline]');
    const bar = t.closest('.bleed-x').previousElementSibling;
    return {
      bar: bar.innerText.replace(/\\s+/g, ' ').trim(),
      months: [...t.firstElementChild.children].filter((c) => c.classList.contains('top-0')).map((c) => c.textContent).slice(0, 6),
      todayLine: !!t.querySelector('.bg-accent'),
    };
  })()`);
  log.barsMonth = await bars();
  await shot(`timeline-${theme}-month.png`);

  // Drag "Portfolio site" three days later (16px a day at Month).
  const p = await barRect('Portfolio site');
  await drag([p.x + p.w / 2, p.y + p.h / 2], [p.x + p.w / 2 + 48, p.y + p.h / 2]);
  log.afterMove = (await bars()).find((b) => b.label.startsWith('Portfolio site'));
  // Stretch "Client onboarding kit" by its right edge, two days.
  const c = await barRect('Client onboarding kit');
  await drag([c.x + c.w - 3, c.y + c.h / 2], [c.x + c.w - 3 + 32, c.y + c.h / 2]);
  log.afterStretch = (await bars()).find((b) => b.label.startsWith('Client onboarding kit'));
  // Arrow keys nudge the focused bar.
  await ev(`[...document.querySelectorAll('[data-timeline-bar]')].find((x) => x.getAttribute('aria-label').startsWith('Invoice automation')).focus(), true`);
  const before = (await bars()).find((b) => b.label.startsWith('Invoice automation'));
  await key('ArrowRight', 'ArrowRight', 39); await sleep(250);
  log.nudge = { before: before.label, after: (await bars()).find((b) => b.label.startsWith('Invoice automation')).label };
  // Click opens the page.
  const m = await barRect('Mastership branding');
  await clickAt(m.x + m.w / 2, m.y + m.h / 2); await sleep(800);
  log.open = await ev(`[...document.querySelectorAll('[role=dialog]')].pop()?.querySelector('textarea[aria-label="Page name"]')?.value ?? null`);
  await key('Escape', 'Escape', 27); await sleep(500);

  // Pages with no dates, one click away.
  await click('button', `/without dates/.test(e.textContent)`, 400);
  log.undated = await ev(`[...document.querySelectorAll('[role=menu] [role=menuitem]')].map((i) => i.textContent.trim())`);
  await key('Escape', 'Escape', 27); await sleep(300);

  // Zoom to Week: the same bars, three times as wide per day.
  await click('button', `/^Zoom:/.test(e.getAttribute('aria-label') || '')`, 400);
  await click('[role=menuitem]', `e.textContent.trim() === 'Week'`, 700);
  log.barsWeek = (await bars()).find((b) => b.label.startsWith('Portfolio site'));
  await shot(`timeline-${theme}-week.png`);

  // Today brings the day back into view.
  await ev(`document.querySelector('[data-timeline]').closest('.bleed-x').scrollLeft = 0, true`); await sleep(200);
  await click('button', `e.textContent.trim() === 'Today'`, 900);
  log.today = await ev(`(() => { const t = document.querySelector('[data-timeline]'); const s = t.closest('.bleed-x'); const line = t.querySelector('span.bg-accent'); const r = line.getBoundingClientRect(); const sr = s.getBoundingClientRect(); return { lineInView: r.left >= sr.left && r.left <= sr.right, month: t.closest('.bleed-x').previousElementSibling.firstElementChild.textContent }; })()`);

  // New page is dated today and opens.
  await click('button', `e.textContent.trim() === 'New page' && !!e.closest('[data-timeline]')`, 900);
  log.newPage = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); return d ? { focus: document.activeElement?.getAttribute('aria-label'), text: d.innerText.replace(/\\s+/g, ' ').slice(0, 120) } : null; })()`);
  await key('Escape', 'Escape', 27); await sleep(400);

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(1000);
  log.phone = await ev(`(() => { const r = document.querySelector('[data-bleed-root]'); return { pageScrollsSideways: r.scrollWidth > r.clientWidth, bars: document.querySelectorAll('[data-timeline-bar]').length }; })()`);
  await shot(`timeline-${theme}-375.png`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
