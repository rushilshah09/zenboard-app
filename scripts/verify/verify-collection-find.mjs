// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN K8 — finding and ordering a Collection (COLLECTION_VIEW_BRIEF §29, §31–32), on the
// documents harness, which has no session: every server action is answered in React's flight format and
// `/api/unfurl` is scripted. Clicks, keys, typing and drags are trusted input.
//   A  the bar of a Collection with items: how much it holds, Search · Filter · Sort, Grid | Canvas, Add
//   B  search narrows to every word, anywhere an item says something; the count says "N of M"; Escape restores
//   C  Filter → Type → Note: only the note; the button reads as set; Clear filters puts everything back
//   D  Filter → Source → Instagram: only what came from there
//   E  Filter → Collected → Last 30 days: the talk collected six weeks ago is gone
//   F  Sort → Name reorders and is REMEMBERED through Canvas and back; ⌘Z never undoes a way of looking
//   G  a card carried across the grid: a line shows where it lands, the drop moves it, ⌘Z takes it back
//   H  ⌥→ on a focused card moves it one place; the card's menu carries the same two moves
//   I  with a sort on, a carry does nothing and the menu offers no move — only the manual order is arrangeable
//   L  something collected while narrowed is seen: the paste puts down the search
//   J  the canvas has no Search, Filter or Sort: it shows everything, where it was put
//   K  phone width, and dark
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-find.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9381;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-find-'));
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
}
/** A card carried from one point to another, sampled halfway — what the grid draws mid-carry. */
async function carry(from, to, sample) {
  if (!from || !to) throw new Error('nothing to carry');
  const [x, y] = from; const [tx, ty] = to;
  await mouse('mouseMoved', x, y); await sleep(40);
  await mouse('mousePressed', x, y, 1);
  const steps = 12;
  let seen = null;
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', x + ((tx - x) * i) / steps, y + ((ty - y) * i) / steps, 1);
    await sleep(20);
    if (i === Math.round(steps * 0.8) && sample) seen = await sample();
  }
  await mouse('mouseReleased', tx, ty);
  await sleep(500);
  return seen;
}
const key = async (k, code, vk, { text, modifiers = 0 } = {}) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
};
const escape = () => key('Escape', 'Escape', 27);
// 2 = Ctrl, 4 = Shift, 8 = Alt, 1 = Alt on mac builds — CDP's mask: alt=1, ctrl=2, meta=4, shift=8.
const ALT = 1, META = 4;
const undo = () => key('z', 'KeyZ', 90, { modifiers: META });
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** A paste of `text` on whatever has focus, else the page. Returns whether it was taken. */
const paste = (text) => ev(`(() => {
  const data = new DataTransfer();
  data.setData('text/plain', ${JSON.stringify(text)});
  const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body;
  const e = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e.defaultPrevented;
})()`);
/** The centre of the first element matching `selector` that passes `test`. */
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const cards = () => ev(`[...document.querySelectorAll('[data-collection-item] > [aria-label]')].map((e) => e.getAttribute('aria-label'))`);
const barText = () => ev(`(() => { const p = document.querySelector('[data-collection-page]'); return p ? p.firstElementChild.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const controls = () => ev(`[...document.querySelectorAll('[data-collection-page] button[aria-label]')].map((b) => b.getAttribute('aria-label'))`);
const control = (label) => at('[data-collection-page] button', `e.getAttribute('aria-label') === ${JSON.stringify(label)}`);
const isSet = (label) => ev(`(() => { const b = [...document.querySelectorAll('[data-collection-page] button')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(label)}); return b ? b.getAttribute('data-selected') ?? b.getAttribute('aria-pressed') ?? String(b.className).includes('bg-surface-active') : null; })()`);
// A filter's rows are checkboxes (many at once) and radios (one window); Sort is a real menu's radio group.
const row = (label) => at('[data-radix-popper-content-wrapper] [role=checkbox],[data-radix-popper-content-wrapper] [role=radio]', `e.textContent.trim() === ${JSON.stringify(label)}`);
const sortRow = (label) => at('[role=menuitemradio]', `e.textContent.trim() === ${JSON.stringify(label)}`);
const rowsOn = () => ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] [role=checkbox][aria-checked=true],[data-radix-popper-content-wrapper] [role=radio][aria-checked=true]')].map((e) => e.textContent.trim())`);
const sortOn = () => ev(`[...document.querySelectorAll('[role=menuitemradio][aria-checked=true]')].map((e) => e.textContent.trim())`);
const panel = () => ev(`(() => { const p = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].pop(); return p ? p.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
/** The centre of a card, and a point on its left or right half. */
const cardPoint = (title, side = 'center') => ev(`(() => {
  const e = [...document.querySelectorAll('[data-collection-item] > [aria-label]')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(title)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  const x = ${JSON.stringify(side)} === 'left' ? r.x + 12 : ${JSON.stringify(side)} === 'right' ? r.right - 12 : r.x + r.width / 2;
  return [x, r.y + Math.min(60, r.height / 2)];
})()`);
const menuFor = (title) => ev(`(() => {
  const cell = [...document.querySelectorAll('[data-collection-item]')].find((x) => x.querySelector('[aria-label]')?.getAttribute('aria-label') === ${JSON.stringify(title)});
  const b = cell?.querySelector('button[aria-label="Item actions"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const menuItems = () => ev(`[...document.querySelectorAll('[role=menuitem]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);

async function freshHarness() {
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('.doc-card')].some((b) => b.textContent.includes('Brand inspiration'))`).catch(() => false)) break; }
  await sleep(600);
}
async function openBrand() {
  await clickAt(await at('button,[role=button],.doc-card', `e.textContent.includes('Brand inspiration') && e.textContent.length < 80`));
  for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`document.querySelectorAll('[data-collection-item]').length >= 8`)) break; }
  await sleep(1200);
}
/** Open the Filter panel, pick a row, and close it. */
async function filterBy(label) {
  await clickAt(await control('Filter')); await sleep(400);
  const seen = await panel();
  await clickAt(await row(label)); await sleep(400);
  const on = await rowsOn();
  await escape(); await sleep(300);
  return { seen, on };
}
async function clearFilters() {
  await clickAt(await control('Filter')); await sleep(400);
  await clickAt(await at('[data-radix-popper-content-wrapper] button', `e.textContent.trim() === 'Clear filters'`)); await sleep(500);
}
async function sortBy(label) {
  await clickAt(await control('Sort')); await sleep(400);
  const on = await sortOn();
  await clickAt(await sortRow(label)); await sleep(600);
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

  // A — the bar
  log.A_bar = await barText();
  log.A_controls = await controls();
  const manualOrder = await cards();
  log.A_cards = manualOrder;
  await shot('collection-find-bar.png');

  // B — search
  await clickAt(await control('Search')); await sleep(300);
  log.B_focused = await ev(`document.activeElement?.getAttribute('aria-label')`);
  await send('Input.insertText', { text: 'typography' });
  await sleep(500);
  log.B_found = await cards();
  log.B_bar = await barText();
  await escape(); await sleep(500);
  log.B_restored = (await cards()).length;

  // C — Type
  log.C = await filterBy('Note');
  log.C_cards = await cards();
  log.C_bar = await barText();
  log.C_filterSet = await isSet('Filter');
  await clearFilters();
  log.C_cleared = (await cards()).length;

  // D — Source
  const d = await filterBy('Instagram');
  log.D_on = d.on;
  log.D_cards = await cards();
  await clearFilters();

  // E — Collected
  const e = await filterBy('Last 30 days');
  log.E_on = e.on;
  log.E_bar = await barText();
  log.E_talkGone = !(await cards()).includes('Typography and tone — a talk');
  await clearFilters();

  // F — Sort, remembered, and never undone
  log.F_wasManual = await sortBy('Name');
  log.F_first = (await cards())[0];
  log.F_sortSet = await isSet('Sort');
  await clickAt(await at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === 'Canvas'`)); await sleep(800);
  await clickAt(await at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === 'Grid'`)); await sleep(800);
  log.F_keptThroughCanvas = (await cards())[0];
  await ev(`document.querySelector('[data-collection-page]')?.focus?.(), true`);
  await undo(); await sleep(500);
  log.F_undoLeavesSort = (await cards())[0];

  // I — a sorted Collection cannot be arranged by hand (checked here, while it is sorted)
  await clickAt(await menuFor(log.F_first)); await sleep(400);
  log.I_menu = await menuItems();
  await escape(); await sleep(300);
  const sortedBefore = await cards();
  await carry(await cardPoint(sortedBefore[2]), await cardPoint(sortedBefore[0], 'left'));
  log.I_carryDidNothing = JSON.stringify(await cards()) === JSON.stringify(sortedBefore);
  await sortBy('Manual order');
  log.I_backToManual = JSON.stringify(await cards()) === JSON.stringify(manualOrder);

  // G — a carry
  const from = manualOrder[2], onto = manualOrder[0];
  log.G_line = await carry(await cardPoint(from), await cardPoint(onto, 'left'), async () =>
    ev(`(() => {
      const l = document.querySelector('[data-drop-line]');
      const g = document.querySelector('.cursor-grabbing');
      return { line: l ? l.getAttribute('data-drop-line') : null, ghost: g ? g.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) : null };
    })()`));
  log.G_order = await cards();
  log.G_moved = (await cards())[0] === from;
  await undo(); await sleep(600);
  log.G_undone = JSON.stringify(await cards()) === JSON.stringify(manualOrder);

  // H — the keys and the menu twins
  await ev(`[...document.querySelectorAll('[data-collection-item] > [aria-label]')][0].focus(), true`);
  await key('ArrowRight', 'ArrowRight', 39, { modifiers: ALT }); await sleep(500);
  log.H_afterAltRight = (await cards()).slice(0, 2);
  await key('ArrowLeft', 'ArrowLeft', 37, { modifiers: ALT }); await sleep(500);
  log.H_afterAltLeft = JSON.stringify(await cards()) === JSON.stringify(manualOrder);
  await clickAt(await menuFor(manualOrder[1])); await sleep(500);
  log.H_menu = await menuItems();
  await clickAt(await at('[role=menuitem]', `e.textContent.includes('Move left')`)); await sleep(600);
  log.H_menuMoved = (await cards())[0] === manualOrder[1];
  await undo(); await sleep(500);

  // L — something collected is always seen: a paste puts down whatever was being looked for
  await clickAt(await control('Search')); await sleep(300);
  await send('Input.insertText', { text: 'typography' }); await sleep(600);
  log.L_narrowed = (await cards()).length;
  await ev(`(document.activeElement?.blur(), true)`);
  log.L_taken = await paste('https://example.com/collected-while-searching');
  await sleep(900);
  log.L_bar = await barText();
  log.L_cards = (await cards()).length;
  await undo(); await sleep(600);

  // J — the canvas shows everything
  await clickAt(await at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === 'Canvas'`)); await sleep(900);
  log.J_controls = await controls();
  log.J_items = await ev(`document.querySelectorAll('[data-canvas-item]').length`);
  await clickAt(await at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === 'Grid'`)); await sleep(700);

  // K — dark, then phone
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(600);
  await clickAt(await control('Filter')); await sleep(500);
  log.K_darkPanel = await ev(`(() => { const p = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].pop(); const c = p?.firstElementChild; if (!c) return null; const s = getComputedStyle(c); return { bg: s.backgroundColor, color: s.color }; })()`);
  await shot('collection-find-dark.png');
  await escape(); await sleep(300);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1200);
  log.K_phoneControls = await controls();
  log.K_phoneBarHeight = await ev(`Math.round(document.querySelector('[data-collection-page]').firstElementChild.getBoundingClientRect().height)`);
  log.K_noOverflow = await ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`);
  await shot('collection-find-phone.png');

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
