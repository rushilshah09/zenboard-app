// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN K11 — how a Collection shows itself (COLLECTION_VIEW_BRIEF §28): card size, preview and
// whether titles are shown at all. Settings of the COLLECTION, so everyone who opens it sees the same board.
//   A  the bar carries View settings; the panel reads Card size · Preview · Show titles, at the ordinary
//   B  Large widens the cards and drops columns; Small does the opposite
//   C  Cover makes every card one shape — the tidy grid; Original ratio gives the masonry back
//   D  Fit keeps the one shape and shows the whole picture (object-contain)
//   E  Show titles off leaves the pictures alone — but a note keeps its words, which are all it is
//   F  the setting is remembered through Canvas and back, and ⌘Z never undoes a way of looking
//   G  dark, and phone width
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-look.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9387;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-look-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0, modifiers = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, modifiers, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function clickAt(p, modifiers = 0) {
  if (!p) throw new Error('nothing to click');
  const [x, y] = p;
  await mouse('mouseMoved', x, y, 0, modifiers); await sleep(60);
  await mouse('mousePressed', x, y, 1, modifiers); await mouse('mouseReleased', x, y, 0, modifiers);
  await sleep(350);
}
const key = async (k, code, vk, { text, modifiers = 0 } = {}) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
};
const escape = () => key('Escape', 'Escape', 27);
const META = 4;
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const control = (label) => at('[data-collection-page] button', `e.getAttribute('aria-label') === ${JSON.stringify(label)}`);
const isSet = (label) => ev(`(() => {
  const b = [...document.querySelectorAll('[data-collection-page] button')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(label)});
  return b ? b.getAttribute('data-selected') ?? b.getAttribute('aria-pressed') ?? String(b.className).includes('bg-surface-active') : null;
})()`);
const panel = () => ev(`(() => { const p = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].pop(); return p ? p.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const rowsOn = () => ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] [role=radio][aria-checked=true]')].map((e) => e.textContent.trim())`);
const row = (label) => at('[data-radix-popper-content-wrapper] [role=radio]', `e.textContent.trim() === ${JSON.stringify(label)}`);
/** What the grid looks like: how many columns, how wide a card is, and whether every card is one shape. */
const shapeOf = () => ev(`(() => {
  const cells = [...document.querySelectorAll('[data-collection-grid] > div')].filter((d) => d.querySelector('[data-collection-item]'));
  const boxes = cells.map((c) => c.getBoundingClientRect());
  const heights = boxes.map((b) => Math.round(b.height));
  const shown = [...document.querySelectorAll('[data-card-picture]')];
  const pictures = shown.map((i) => Math.round(i.getBoundingClientRect().height));
  return {
    columns: new Set(boxes.map((b) => Math.round(b.x))).size,
    width: Math.round(boxes[0]?.width ?? 0),
    oneShape: pictures.length > 1 && new Set(pictures).size === 1,
    heights: heights.slice(0, 4),
    everyCardOneHeight: heights.length > 1 && new Set(heights).size === 1,
    fit: shown.length ? getComputedStyle(shown[0]).objectFit : null,
    titles: document.querySelectorAll('[data-card-title]').length,
  };
})()`);
const titlesShown = () => ev(`document.querySelectorAll('[data-card-title]').length`);
const noteText = () => ev(`(() => {
  const c = [...document.querySelectorAll('[data-collection-item] > [aria-label]')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Idea:'));
  return c ? c.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) : null;
})()`);
const layout = (name) => at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === ${JSON.stringify(name)}`);

async function freshHarness() {
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('.doc-card')].some((b) => b.textContent.includes('Brand inspiration'))`).catch(() => false)) break; }
  await sleep(600);
}
async function openBrand() {
  await clickAt(await at('button,[role=button],.doc-card', `e.textContent.includes('Brand inspiration') && e.textContent.length < 80`));
  for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`document.querySelectorAll('[data-collection-item]').length >= 8`)) break; }
  await sleep(1400);
}
async function pick(label) {
  await clickAt(await control('View settings')); await sleep(400);
  await clickAt(await row(label)); await sleep(700);
  const on = await rowsOn();
  await escape(); await sleep(400);
  return on;
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
  await openBrand();

  // A — the panel, at the ordinary
  log.A_ordinary = await shapeOf();
  log.A_notSet = await isSet('View settings');
  await clickAt(await control('View settings')); await sleep(500);
  log.A_panel = await panel();
  log.A_on = await rowsOn();
  await escape(); await sleep(300);

  // B — card size
  await pick('Large');
  log.B_large = await shapeOf();
  log.B_set = await isSet('View settings');
  await pick('Small');
  log.B_small = await shapeOf();
  await pick('Medium');

  // C — one shape for every card
  log.C_on = await pick('Cover');
  log.C_cover = await shapeOf();
  await shot('collection-look-cover.png');

  // D — the whole picture, still one shape
  log.D_on = await pick('Fit');
  log.D_fit = await shapeOf();

  // E — pictures only
  await clickAt(await control('View settings')); await sleep(400);
  await clickAt(await at('[data-radix-popper-content-wrapper] button[role=switch]'));
  await sleep(700);
  await escape(); await sleep(400);
  log.E_titles = await titlesShown();
  log.E_note = await noteText();
  await shot('collection-look-pictures.png');

  // F — remembered, and never undone
  await clickAt(await layout('Canvas')); await sleep(800);
  await clickAt(await layout('Grid')); await sleep(800);
  log.F_kept = await shapeOf();
  log.F_titlesKept = await titlesShown();
  await ev(`document.querySelector('[data-collection-page]')?.focus?.(), true`);
  await key('z', 'KeyZ', 90, { modifiers: META }); await sleep(600);
  log.F_undoLeavesIt = (await shapeOf()).oneShape;

  // Back to the ordinary, then G
  await clickAt(await control('View settings')); await sleep(400);
  await clickAt(await at('[data-radix-popper-content-wrapper] button[role=switch]')); await sleep(500);
  await clickAt(await row('Original ratio')); await sleep(700);
  await escape(); await sleep(400);
  log.F_back = await shapeOf();
  log.F_backNotSet = await isSet('View settings');

  // G — dark, and a phone
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(500);
  await clickAt(await control('View settings')); await sleep(500);
  log.G_dark = await ev(`(() => { const p = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].pop(); const c = p?.firstElementChild; if (!c) return null; const s = getComputedStyle(c); return { bg: s.backgroundColor, color: s.color }; })()`);
  await shot('collection-look-dark.png');
  await escape(); await sleep(300);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1200);
  log.G_phoneOrdinary = await shapeOf();
  await pick('Small');
  log.G_phoneSmall = await shapeOf();
  log.G_noOverflow = await ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`);
  await shot('collection-look-phone.png');

  log.consoleErrors = errors;
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors;
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
