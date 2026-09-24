// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over CDP.
// Here: a database's values, type by type (plan T10, after Notion) — a table cell
// shows its focus inside its edges; a page's property list washes on hover and
// says "Empty" where there is nothing; a link opens from beside it; a checkbox is
// the DS box.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-properties.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9355;
const profile = mkdtempSync(join(tmpdir(), 'zb-props-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return [r.x + Math.min(r.width / 2, 60), r.y + r.height / 2];
})()`);
const click = async (sel, test, wait = 450) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at); await sleep(wait); };

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

  // ── A table cell being edited says so inside its edges ──
  const hours = await centre('[data-db-surface] input[aria-label="Hours"]', 'true');
  await clickAt(...hours); await sleep(250);
  log.tableFocus = await ev(`(() => { const s = document.activeElement.closest('.group'); return { focused: document.activeElement.getAttribute('aria-label'), ring: getComputedStyle(s).boxShadow }; })()`);
  // ── A link opens from beside it, and only on hover ──
  log.linkAction = await ev(`(() => { const a = [...document.querySelectorAll('[data-db-surface] a[aria-label="Open link"]')][0]; return a ? { href: a.getAttribute('href'), target: a.getAttribute('target'), restingOpacity: getComputedStyle(a).opacity } : null; })()`);
  log.checkbox = await ev(`(() => { const c = document.querySelector('[data-db-surface] [data-slot=checkbox]'); return c ? { role: c.getAttribute('role'), state: c.getAttribute('data-state') } : null; })()`);
  await shot(`props-${theme}-table.png`);

  // ── A page's property list: "Empty", a hover wash, the DS box ──
  await click('[data-db-surface] button[aria-label="Open row"]', `!!e.closest('.zb-db-row')?.textContent.includes('Twitter redesign') || e.closest('.zb-db-row')?.querySelector('input')?.value === 'Twitter redesign'`, 900);
  log.sheet = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].pop();
    const rows = [...d.querySelectorAll('[data-page-document] .flex.flex-col > div')].filter((r) => r.querySelector('.group'));
    return rows.map((r) => {
      const name = r.firstElementChild.textContent.trim();
      const cell = r.querySelector('.group');
      const input = cell.querySelector('input');
      return { name, shows: input ? (input.value || 'placeholder:' + input.placeholder) : cell.textContent.trim() || '(blank)' };
    });
  })()`);
  const tagsValue = await centre('[role=dialog] [data-page-document] .group button', `e.getAttribute('aria-label')?.startsWith('Tags')`);
  await mouse('mouseMoved', tagsValue[0], tagsValue[1]); await sleep(300);
  log.hoverWash = await ev(`getComputedStyle([...document.querySelectorAll('[role=dialog] [data-page-document] .group')].find((g) => g.querySelector('button[aria-label^="Tags"]'))).backgroundColor`);
  await shot(`props-${theme}-sheet.png`);
  await click('[role=dialog] [data-slot=checkbox]', 'true', 300);
  log.checked = await ev(`[...document.querySelectorAll('[role=dialog]')].pop().querySelector('[data-slot=checkbox]').getAttribute('data-state')`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
