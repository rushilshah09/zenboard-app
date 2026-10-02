// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// A record opened "full page" must fill the app's CONTENT PANE — like a Docs page
// — not the window: the sidebar and top bar stay visible and usable, it leaves by
// a back arrow, and its breadcrumbs say where the record lives.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-page-in-pane.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9339;
const profile = mkdtempSync(join(tmpdir(), 'zb-pane-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 240)); return r.result.value; };
async function tapAt(x, y) { for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', buttons: t === 'mousePressed' ? 1 : 0, clickCount: 1 }); }
async function tap(sel) {
  const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
  if (!c) throw new Error('no element ' + sel);
  await tapAt(c[0], c[1]);
}
async function key(k, code, vk) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk }); }

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/dev-preview/content?shell=1` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('[data-view-shell] section[aria-label]')`).catch(() => false)) break; }
  await sleep(900);

  // Open a card with a real click.
  await ev(`[...document.querySelectorAll('[role=button][aria-label]')].find((b) => (b.getAttribute('aria-label')||'').includes('3-question')).setAttribute('data-probe-card','1'), true`);
  await tap('[data-probe-card]');
  await sleep(900);

  log.opened = await ev(`(() => {
    const pane = document.querySelector('[data-view-shell]');
    const page = pane.querySelector('[role=dialog]');
    if (!page) return { error: 'no page inside the pane', dialogs: document.querySelectorAll('[role=dialog]').length };
    const pr = pane.getBoundingClientRect(), gr = page.getBoundingClientRect();
    const nav = [...document.querySelectorAll('a, button')].find((e) => e.textContent.trim() === 'Tasks');
    const nr = nav?.getBoundingClientRect();
    const hit = nr ? document.elementFromPoint(nr.x + nr.width / 2, nr.y + nr.height / 2) : null;
    return {
      pageInsidePane: pane.contains(page),
      pageRect: [Math.round(gr.x), Math.round(gr.y), Math.round(gr.width), Math.round(gr.height)],
      paneRect: [Math.round(pr.x), Math.round(pr.y), Math.round(pr.width), Math.round(pr.height)],
      window: [innerWidth, innerHeight],
      position: getComputedStyle(page).position,
      zIndex: getComputedStyle(page).zIndex,
      sidebarNavHitTestable: !!(hit && nav && (nav === hit || nav.contains(hit))),
      backButton: !!page.querySelector('button[aria-label="Back"]'),
      closeButton: !!page.querySelector('button[aria-label="Close"]'),
      crumbs: [...page.querySelectorAll('nav[aria-label] li, nav li')].map((li) => li.textContent.trim()).filter(Boolean),
      focusInsidePage: page.contains(document.activeElement),
      focusedIsBackButton: document.activeElement?.getAttribute('aria-label') === 'Back',
      tooltipsOpen: document.querySelectorAll('[role=tooltip]').length,
    };
  })()`);
  writeFileSync(join(out, 'page-in-pane.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

  // Move the piece from the stage crumb's menu.
  await ev(`(() => { const page = document.querySelector('[data-view-shell] [role=dialog]'); const caret = [...page.querySelectorAll('button')].find((b) => /move to another stage/i.test(b.getAttribute('aria-label')||'')); caret?.setAttribute('data-probe-caret','1'); return !!caret; })()`);
  await tap('[data-probe-caret]');
  await sleep(500);
  log.stageMenu = await ev(`[...document.querySelectorAll('[role=menuitem], [role=option]')].map((e) => e.textContent.trim()).slice(0, 10)`);
  await ev(`[...document.querySelectorAll('[role=menuitem], [role=option]')].find((e) => e.textContent.trim() === 'Shoot')?.setAttribute('data-probe-stage','1'), true`);
  await tap('[data-probe-stage]');
  await sleep(700);
  log.afterMove = await ev(`(() => { const page = document.querySelector('[data-view-shell] [role=dialog]'); return { crumbs: page ? [...page.querySelectorAll('nav li')].map((li) => li.textContent.trim()).filter(Boolean) : null, stageSelect: page?.querySelector('[aria-label="Stage"]')?.textContent.trim() }; })()`);

  // Leave with Esc.
  await key('Escape', 'Escape', 27);
  await sleep(600);
  log.afterEsc = await ev(`({ pageOpen: !!document.querySelector('[data-view-shell] [role=dialog]'), boardVisible: !!document.querySelector('section[aria-label="Idea"]'), url: location.search })`);
} catch (e) {
  log.error = String(e?.message || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL'); await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
