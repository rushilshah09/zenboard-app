// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol. Here: the settings each layout has of its own (database plan
// T8, after Notion's Layout page) — a table's vertical lines, a gallery's card
// size, a calendar's weekends — each changes what the layout draws, and a layout
// never offers another's setting.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-layout-options.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9347;
const profile = mkdtempSync(join(tmpdir(), 'zb-layoutopts-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
async function clickAt(x, y) { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const click = async (sel, test) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at); await sleep(350); };
const PANEL = `[...document.querySelectorAll('[style*="position: fixed"]')].find((x) => x.querySelector('button[aria-label="Close"]'))`;
const panelRows = () => ev(`(() => { const p = ${PANEL}; return p ? [...p.querySelectorAll('button, label')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()).filter(Boolean) : null; })()`);
const openLayout = async () => {
  await click('button[aria-label="View settings"]', 'true');
  await click('button', `/^Layout/.test(e.textContent.trim()) && !!e.closest('[style*="position: fixed"]')`);
};
const closePanel = async () => { await click('button[aria-label="Close"]', 'true'); };
// Only a tab that is not already chosen: a click on the chosen one opens its menu (Notion).
const view = async (name) => {
  if (await ev(`[...document.querySelectorAll('[role=radiogroup][aria-label="Database views"] [role=radio]')].some((r) => r.textContent.trim() === ${JSON.stringify(name)} && r.getAttribute('aria-checked') === 'true')`)) return;
  await click('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === ${JSON.stringify(name)}`);
};

/** A new view of `kind`: from the + beside the tabs, or — past three views — "New view" under "N more…". */
async function addView(kind) {
  const plus = await centre('button[aria-label="Add view"]', 'true');
  if (plus) { await clickAt(...plus); await sleep(400); }
  else {
    await click('button', `/^\\d+ more…$/.test(e.textContent.trim())`, 500);
    await click('button', `e.textContent.trim() === 'New view'`, 500);
  }
  await click('[role=menuitem]', `e.textContent.trim() === ${JSON.stringify(kind)}`, 700);
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
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`);
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('[data-db-surface]')`)) break; }
  await sleep(400);

  // ── The bar: views as tabs; Sort opens the Sort page on its own ──
  log.bar = await ev(`(() => { const g = document.querySelector('[role=radiogroup][aria-label="Database views"]'); const chosen = g.querySelector('[data-state=checked]'); return { tabs: [...g.querySelectorAll('[role=radio]')].map((r) => r.textContent.trim()), chosenBg: getComputedStyle(chosen).backgroundColor, tools: [...document.querySelector('[data-db-surface]').firstElementChild.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')) }; })()`);
  await click('button[aria-label="Sort"]', 'true');
  log.sortPanel = await panelRows();
  await click('button', `/^Add sort/.test(e.textContent.trim())`);
  log.sortSelected = await ev(`document.querySelector('button[aria-label="Sort"]').getAttribute('aria-pressed')`);
  await closePanel();

  // ── Table: vertical lines ──
  await view('Table');
  await openLayout();
  log.tableOffers = await panelRows();
  const lines = () => ev(`getComputedStyle(document.querySelector('[data-db-surface] .bleed-x-handles > div > div > div')).borderRightStyle`);
  log.tableLinesBefore = await lines();
  await click('label', `e.textContent.trim() === 'Show vertical lines'`);
  log.tableLinesAfter = await lines();
  await closePanel();
  await shot(`layout-${theme}-table-no-lines.png`);

  // ── Gallery: card size ──
  await view('Gallery');
  await openLayout();
  log.galleryOffers = await panelRows();
  const cols = () => ev(`getComputedStyle(document.querySelector('[data-db-surface] [style*="minmax"]')).gridTemplateColumns.split(' ').length`);
  log.galleryColumnsMedium = await cols();
  await click('button', `/^Card size/.test(e.textContent.trim())`);
  await click('button', `e.textContent.trim() === 'Large'`);
  log.galleryColumnsLarge = await cols();
  await click('button', `e.textContent.trim() === 'Small'`);
  log.galleryColumnsSmall = await cols();
  await closePanel();

  // ── Calendar: weekends ──
  await addView('Calendar');
  const heads = () => ev(`(() => { const g = [...document.querySelectorAll('[data-db-surface] div')].find((d) => getComputedStyle(d).display === 'grid' && /Mon/.test(d.textContent)); return g ? [...g.children].slice(0, 7).map((c) => c.textContent.trim()).filter((x) => /^[A-Z][a-z]{2}$/.test(x)) : null; })()`);
  log.calendarHeadsBefore = await heads();
  await openLayout();
  log.calendarOffers = await panelRows();
  await click('label', `e.textContent.trim() === 'Show weekends'`);
  log.calendarHeadsAfter = await heads();
  await closePanel();
  await shot(`layout-${theme}-calendar-weekdays.png`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
