// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN K12 — a Collection of hundreds (COLLECTION_VIEW_BRIEF §45: "design for this from the
// beginning"). 250 links are pasted into an empty Collection, and then the question is how much of it the
// browser is actually made to do. Every undrawn card is a card that does not sign a URL for its upload and
// does not ask its link what it is — which is why the count of `/api/unfurl` requests is the real measure.
//   A  250 pasted at once: the Collection says 250, the grid is as tall as 250, and a screenful is drawn
//   B  the grid holds a fraction of the elements 250 cards would be (links are asked what they are ONCE, when
//      they are collected — lib/collect.ts — and that is by design, so it is not what this measures)
//   C  scrolling draws what arrives and lets go of what left; the total height does not move
//   D  back at the top, the first card is there again
//   E  a search that finds one draws one
//   F  the canvas draws what the camera is looking at, not everything
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-many.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base] = process.argv.slice(2);
const PORT = 9389;
const COUNT = 250;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-many-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
let unfurls = 0;
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function clickAt(p) {
  if (!p) throw new Error('nothing to click');
  await mouse('mouseMoved', p[0], p[1]); await sleep(60);
  await mouse('mousePressed', p[0], p[1], 1); await mouse('mouseReleased', p[0], p[1]);
  await sleep(350);
}
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
/** How much of the Collection the browser is actually holding. */
const drawing = () => ev(`(() => {
  const grid = document.querySelector('[data-collection-grid]');
  const ids = [...document.querySelectorAll('[data-collection-item]')].map((c) => c.getAttribute('data-collection-item'));
  return {
    drawn: ids.length,
    elements: grid ? grid.querySelectorAll('*').length : 0,
    gridHeight: grid ? Math.round(grid.getBoundingClientRect().height) : null,
    first: ids[0] ?? null,
    last: ids[ids.length - 1] ?? null,
  };
})()`);
/** A control inside the canvas, measured where it is — a canvas frame is never scrolled (see verify-collection-item). */
const inCanvas = (label) => ev(`(() => {
  const b = document.querySelector('[data-canvas-controls] [aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const barText = () => ev(`(() => { const p = document.querySelector('[data-collection-page]'); return p ? p.firstElementChild.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const scrollTo = (y) => ev(`(() => {
  const region = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 200 && getComputedStyle(e).overflowY !== 'visible');
  if (region) { region.scrollTop = ${y}; return { how: 'region', top: region.scrollTop }; }
  window.scrollTo(0, ${y});
  return { how: 'window', top: window.scrollY };
})()`);
const layout = (name) => at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === ${JSON.stringify(name)}`);

async function freshHarness() {
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('.doc-card')].some((b) => b.textContent.includes('Moodboard'))`).catch(() => false)) break; }
  await sleep(600);
}

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Fetch.requestPaused') { void answer(msg.params); return; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  async function answer(p) {
    const { request, requestId } = p;
    if (request.url.includes('/api/unfurl')) {
      unfurls += 1;
      await send('Fetch.fulfillRequest', { requestId, responseCode: 404, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'Not found' })).toString('base64') });
      return;
    }
    const isAction = request.method === 'POST' && Object.keys(request.headers).some((h) => h.toLowerCase() === 'next-action');
    if (!isAction) { await send('Fetch.continueRequest', { requestId }); return; }
    const body = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:{"ok":true,"id":"${crypto.randomUUID()}"}\n`;
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(body).toString('base64') });
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await freshHarness();

  await clickAt(await at('button,[role=button],.doc-card', `e.textContent.includes('Moodboard') && e.textContent.length < 80`));
  for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!!document.querySelector('[data-collection-page]')`)) break; }
  await sleep(1200);

  // A — 250, in five pastes: one paste takes at most 50 links (COLLECT_LIMIT, lib/collect.ts), as anyone's would
  unfurls = 0;
  await ev(`(document.activeElement?.blur(), true)`);
  const taken = [];
  for (let batch = 0; batch < COUNT / 50; batch++) {
    const links = Array.from({ length: 50 }, (_, i) => `https://example.com/ref-${String(batch * 50 + i).padStart(3, '0')}`).join('\n');
    taken.push(await ev(`(() => {
      const data = new DataTransfer();
      data.setData('text/plain', ${JSON.stringify(links)});
      const e = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    })()`));
    await sleep(700);
  }
  log.A_taken = taken;
  await sleep(2500);
  log.A_bar = await barText();
  log.A_grid = await drawing();

  // B — how much the browser holds
  await sleep(1500);
  log.B_perCard = log.A_grid.drawn ? Math.round(log.A_grid.elements / log.A_grid.drawn) : null;
  log.B_heldVsAll = `${log.A_grid.elements} elements for ${log.A_grid.drawn} cards, where all ${COUNT} would be about ${log.B_perCard * COUNT}`;
  log.B_unfurlsAtCollect = unfurls;

  // C — scrolling
  const before = await drawing();
  log.C_scrolled = await scrollTo(4000);
  await sleep(900);
  const after = await drawing();
  log.C_after = after;
  log.C_movedOn = after.first !== before.first;
  // Cards measured as they arrive correct the guesses they were placed by; the whole grid should barely move.
  log.C_heightDrift = before.gridHeight ? Math.round((Math.abs(after.gridHeight - before.gridHeight) / before.gridHeight) * 1000) / 10 + '%' : null;
  log.C_stillAScreenful = after.drawn < COUNT / 2;

  // D — back to the top
  await scrollTo(0);
  await sleep(900);
  const top = await drawing();
  log.D_top = top;
  log.D_firstBack = top.first === before.first;

  // E — a search that finds one
  await clickAt(await at('[data-collection-page] button', `e.getAttribute('aria-label') === 'Search'`)); await sleep(300);
  await send('Input.insertText', { text: 'ref-137' }); await sleep(900);
  log.E_found = await drawing();
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(800);

  // F — the canvas
  await clickAt(await layout('Canvas')); await sleep(1500);
  log.F_canvasAtHome = await ev(`document.querySelectorAll('[data-canvas-item]').length`);
  log.F_fewer = (await ev(`document.querySelectorAll('[data-canvas-item]').length`)) < COUNT;
  await clickAt(await inCanvas('Fit everything'));
  await sleep(1200);
  log.F_fitted = await ev(`(() => ({ drawn: document.querySelectorAll('[data-canvas-item]').length, zoom: document.querySelector('[data-canvas-controls] [aria-label="Zoom to 100%"]')?.textContent.trim() }))()`);

  log.consoleErrors = errors.slice(0, 5);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 5);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
