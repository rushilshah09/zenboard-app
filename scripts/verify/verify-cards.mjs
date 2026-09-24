// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over CDP.
// Here: cards and lists (plan T11, after Notion) — a gallery card is a preview of
// its page over the board's own card face, with its menu on hover; a list line is
// the page's glyph, name and values; a view filtered to nothing says so once, with
// the way back.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-cards.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9357;
const profile = mkdtempSync(join(tmpdir(), 'zb-cards-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); }
async function typeText(text) { for (const ch of text) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); } }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const click = async (sel, test, wait = 450) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at); await sleep(wait); };
const view = (name) => click('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === ${JSON.stringify(name)}`, 700);

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
  log.theme = theme;
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 900);

  // ── Gallery ──
  await view('Gallery');
  await ev(`document.querySelector('[data-db-surface]').scrollIntoView({ block: 'start' }), document.querySelector('[data-bleed-root]').scrollBy(0, -140), true`);
  log.gallery = await ev(`(() => {
    const cards = [...document.querySelectorAll('[data-gallery-card]')];
    const first = cards.find((c) => c.querySelector('[aria-label="Portfolio site"]'));
    const face = first.querySelector('[role=button]');
    const preview = face.firstElementChild;
    return {
      cards: cards.length,
      previewHeight: Math.round(preview.getBoundingClientRect().height),
      previewText: preview.innerText.replace(/\\s+/g, ' ').trim(),
      body: face.lastElementChild.innerText.replace(/\\s+/g, ' ').trim().slice(0, 80),
      radius: getComputedStyle(face).borderRadius,
      newTile: [...document.querySelectorAll('[data-db-surface] button')].some((b) => b.textContent.trim() === 'New page'),
    };
  })()`);
  const card = await centre('[data-gallery-card] [role=button]', `e.getAttribute('aria-label') === 'Portfolio site'`);
  await mouse('mouseMoved', ...card); await sleep(300);
  log.galleryHoverMenu = await ev(`getComputedStyle([...document.querySelectorAll('[data-gallery-card]')].find((c) => c.querySelector('[aria-label="Portfolio site"]')).querySelector('.reveal-on-hover')).opacity`);
  await shot(`cards-${theme}-gallery.png`);

  // ── List (added as a view) ──
  await addView('List');
  log.list = await ev(`[...document.querySelectorAll('[data-list-row]')].slice(0, 3).map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
  await shot(`cards-${theme}-list.png`);

  // ── Filtered to nothing, and back ──
  await click('button[aria-label="Search"]', 'true', 300);
  await typeText('zzzz'); await sleep(400);
  log.filtered = await ev(`[...document.querySelectorAll('[data-db-surface] p')].map((p) => p.textContent.trim()).find((t) => /No pages match/.test(t)) ?? null`);
  await shot(`cards-${theme}-filtered.png`);
  await click('[data-db-surface] button', `e.textContent.trim() === 'Clear filters'`, 400);
  log.cleared = await ev(`document.querySelectorAll('[data-list-row]').length`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
