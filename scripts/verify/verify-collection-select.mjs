// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN K10 — hover and selection (COLLECTION_VIEW_BRIEF §15–16): "keep these hidden until
// needed", and "do not permanently show selection controls on every card". On the documents harness.
//   A  nothing shows at rest; a pointer over a card reveals its box and its menu; a picked card keeps its box
//   B  the box picks the item with NO modifier held, and does not open it
//   C  Shift on a second box takes the run between them
//   D  Select all takes everything on screen; the ✕ clears it
//   E  Copy links takes the addresses of what is picked — and says so when none of it has one
//   F  the card's menu carries Open · Open website · Rename · Tags · Copy link · Move · Delete
//   G  Rename turns the card's name into a field with its text selected; Enter renames the card
//   H  Tags opens the Collection's own words on the card, and picking one puts the chip on it
//   J  on a coarse pointer the box is there without hovering
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-select.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9385;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-select-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0, modifiers = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, modifiers, clickCount: type === 'mouseMoved' ? 0 : 1 });
const hover = async (p) => { if (!p) throw new Error('nothing to hover'); await mouse('mouseMoved', p[0], p[1]); await sleep(250); };
async function clickAt(p, modifiers = 0) {
  if (!p) throw new Error('nothing to click');
  const [x, y] = p;
  await mouse('mouseMoved', x, y, 0, modifiers); await sleep(80);
  await mouse('mousePressed', x, y, 1, modifiers); await mouse('mouseReleased', x, y, 0, modifiers);
  await sleep(300);
}
const key = async (k, code, vk, { text, modifiers = 0 } = {}) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
};
const escape = () => key('Escape', 'Escape', 27);
const enter = () => key('Enter', 'Enter', 13, { text: '\r' });
const SHIFT = 8;
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const cards = () => ev(`[...document.querySelectorAll('[data-collection-item] > [aria-label]')].map((e) => e.getAttribute('aria-label'))`);
const cell = (title) => `[...document.querySelectorAll('[data-collection-item]')].find((c) => c.querySelector('[aria-label]')?.getAttribute('aria-label') === ${JSON.stringify(title)})`;
const cardPoint = (title) => ev(`(() => {
  const c = ${cell(title)};
  if (!c) return null;
  c.scrollIntoView({ block: 'center' });
  const r = c.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + Math.min(60, r.height / 2)];
})()`);
/** The card's selection box: where it is, and whether it is showing. */
const boxOf = (title) => ev(`(() => {
  const c = ${cell(title)};
  const b = c?.querySelector('[role=checkbox]');
  if (!b) return null;
  const holder = b.parentElement;
  const r = b.getBoundingClientRect();
  return { opacity: getComputedStyle(holder).opacity, checked: b.getAttribute('aria-checked'), at: [r.x + r.width / 2, r.y + r.height / 2] };
})()`);
const menuOpacity = (title) => ev(`(() => {
  const c = ${cell(title)};
  const m = c?.querySelector('button[aria-label="Item actions"]')?.parentElement;
  return m ? getComputedStyle(m).opacity : null;
})()`);
const menuFor = (title) => ev(`(() => {
  const c = ${cell(title)};
  const b = c?.querySelector('button[aria-label="Item actions"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const menuItems = () => ev(`[...document.querySelectorAll('[role=menuitem]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
const barText = () => ev(`(() => { const p = document.querySelector('[data-collection-page]'); return p ? p.firstElementChild.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const chipsOf = (title) => ev(`(() => {
  const c = ${cell(title)};
  return c ? [...c.querySelectorAll('[data-card-tags] > *')].map((e) => e.textContent.trim()) : null;
})()`);
const toasts = () => ev(`[...document.querySelectorAll('[data-sonner-toast], li[role=status], [role=status]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean)`);
const dialogOpen = () => ev(`!!document.querySelector('[role=dialog][data-state=open]')`);

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
  // So "Copy links" can be read back rather than believed.
  await send('Browser.grantPermissions', { origin: base, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  await freshHarness();
  await openBrand();
  const order = await cards();
  const [first, second, third] = order;

  // A — hidden until wanted
  await hover([720, 12]);
  log.A_atRest = { box: (await boxOf(first))?.opacity, menu: await menuOpacity(first) };
  await hover(await cardPoint(first));
  log.A_hovered = { box: (await boxOf(first))?.opacity, menu: await menuOpacity(first) };
  await shot('collection-select-hover.png');

  // B — the box picks with no modifier, and does not open anything
  await clickAt((await boxOf(first)).at);
  log.B_bar = await barText();
  log.B_checked = (await boxOf(first))?.checked;
  log.B_openedNothing = !(await dialogOpen());
  await hover([720, 12]);
  log.B_staysShowing = (await boxOf(first))?.opacity;

  // C — Shift takes the run
  await clickAt((await boxOf(third)).at, SHIFT);
  log.C_bar = await barText();
  log.C_checked = [first, second, third].map((title) => title);
  log.C_allThree = (await Promise.all([first, second, third].map((x) => boxOf(x)))).map((b) => b?.checked);

  // D — Select all, then clear
  await clickAt(await at('[data-collection-page] button', `e.textContent.trim() === 'Select all'`));
  log.D_bar = await barText();
  log.D_noSelectAll = !(await ev(`[...document.querySelectorAll('[data-collection-page] button')].some((b) => b.textContent.trim() === 'Select all')`));

  // E — Copy links
  await clickAt(await at('[data-collection-page] button', `e.textContent.trim() === 'Copy links'`));
  await sleep(500);
  log.E_toast = (await toasts()).find((x) => x.includes('copied')) ?? (await toasts())[0] ?? null;
  log.E_clipboard = await ev(`navigator.clipboard.readText().then((t) => t.split('\\n').length).catch((e) => String(e).slice(0, 60))`);
  await clickAt(await at('[data-collection-page] button', `e.getAttribute('aria-label') === 'Clear selection'`));
  log.E_cleared = await barText();

  // E2 — nothing with a link
  await clickAt((await boxOf('Idea: a quieter onboarding')).at);
  await clickAt(await at('[data-collection-page] button', `e.textContent.trim() === 'Copy link'`));
  await sleep(400);
  log.E2_toast = (await toasts()).slice(-1)[0] ?? null;
  await clickAt(await at('[data-collection-page] button', `e.getAttribute('aria-label') === 'Clear selection'`));

  // F — the card's menu
  await clickAt(await menuFor(second));
  log.F_menu = await menuItems();
  await escape(); await sleep(300);

  // G — Rename on the card
  await clickAt(await menuFor(second)); await sleep(300);
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Rename'`));
  await sleep(400);
  log.G_field = await ev(`(() => {
    const input = document.querySelector('[data-collection-grid] input[aria-label="Name"]');
    const a = document.activeElement;
    return {
      exists: !!input,
      active: a ? (a.getAttribute('aria-label') || a.tagName.toLowerCase()) : null,
      value: input ? input.value : null,
      selected: input ? input.selectionStart === 0 && input.selectionEnd === input.value.length : null,
    };
  })()`);
  await send('Input.insertText', { text: 'React mark — renamed here' });
  await enter(); await sleep(800);
  const after = await cards();
  log.G_renamed = after[1];
  const renamed = after.includes('React mark — renamed here') ? 'React mark — renamed here' : second;

  // H — Tags on the card: a submenu of the Collection's own words
  await clickAt(await menuFor(renamed)); await sleep(300);
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Tags'`));
  await sleep(600);
  log.H_words = await ev(`[...document.querySelectorAll('[role=menuitemcheckbox]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  log.H_on = await ev(`[...document.querySelectorAll('[role=menuitemcheckbox][aria-checked=true]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  await clickAt(await at('[role=menuitemcheckbox]', `e.textContent.trim() === 'Motion'`));
  await sleep(500);
  log.H_staysOpen = await ev(`document.querySelectorAll('[role=menuitemcheckbox]').length > 0`);
  log.H_nowOn = await ev(`[...document.querySelectorAll('[role=menuitemcheckbox][aria-checked=true]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  await escape(); await sleep(200);
  await escape(); await sleep(400);
  log.H_chips = await chipsOf(renamed);

  // J — a coarse pointer keeps the box there
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(500);
  log.J_coarse = await ev(`matchMedia('(pointer: coarse)').matches`);
  await hover([720, 12]);
  log.J_boxAtRest = (await boxOf(first))?.opacity;
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });

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
