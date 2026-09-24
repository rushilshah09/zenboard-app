// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN K9 — notes on a collected item (COLLECTION_VIEW_BRIEF §18, §38): a collected thing is
// written ABOUT, in the Zenboard editor, which is what a Collection has that a board of pictures does not.
// On the documents harness, whose Collections keep everything in the browser.
//   A  a card says it has been written about; its page opens on those words, under "Notes"
//   B  typing notes on a card that had none: closed and reopened, the words are there, and the card says so
//   C  the search reads them — "sidebar" finds the one written about
//   D  a note item's words ARE its body: the editor holds them, and writing renames its card
//   E  the editor's own commands work in here: "/" opens the menu inside the item's page
//   F  dark, and phone width
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-notes.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9383;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-notes-'));
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
const key = async (k, code, vk, { text, modifiers = 0 } = {}) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
};
const escape = () => key('Escape', 'Escape', 27);
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** The centre of the first element matching `selector` that passes `test`. */
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const cards = () => ev(`[...document.querySelectorAll('[data-collection-item] > [aria-label]')].map((e) => e.getAttribute('aria-label'))`);
/** Which cards say they have been written about. */
const noted = () => ev(`[...document.querySelectorAll('[data-collection-item]')].filter((c) => c.querySelector('[data-item-noted]'))
  .map((c) => c.querySelector('[aria-label]')?.getAttribute('aria-label'))`);
const cardPoint = (title) => ev(`(() => {
  const e = [...document.querySelectorAll('[data-collection-item] > [aria-label]')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(title)});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + Math.min(60, r.height / 2)];
})()`);
/** What a card reads, so a note's own words can be checked from the grid. */
const cardText = (title) => ev(`(() => {
  const e = [...document.querySelectorAll('[data-collection-item] > [aria-label]')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(title)});
  return e ? e.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140) : null;
})()`);
/** The item page's notes: the label above them, and the words in them. */
const notes = () => ev(`(() => {
  const box = document.querySelector('[data-item-notes]');
  if (!box) return null;
  return {
    label: box.previousElementSibling?.textContent ?? null,
    text: box.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140),
    blocks: box.querySelectorAll('[data-block-id]').length,
  };
})()`);
/** Put the caret at the end of the notes' last line — a real click, then End. */
async function caretToEnd() {
  const p = await ev(`(() => {
    const blocks = [...document.querySelectorAll('[data-item-notes] [data-block-id]')];
    const last = blocks[blocks.length - 1];
    if (!last) return null;
    const r = last.getBoundingClientRect();
    return [r.right - 8, r.y + r.height / 2];
  })()`);
  if (!p) return null;
  await clickAt(p); await sleep(500);
  await key('End', 'End', 35); await sleep(150);
  return ev(`(() => { const a = document.activeElement; return a ? (a.getAttribute('contenteditable') ? 'rich' : a.tagName.toLowerCase()) : null; })()`);
}
const itemTitle = () => ev(`document.querySelector('[role=dialog][data-state=open] input[aria-label="Name"]')?.value ?? null`);

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
async function openItem(title) {
  await clickAt(await cardPoint(title));
  for (let i = 0; i < 30; i++) { await sleep(200); if (await ev(`!!document.querySelector('[data-item-notes]')`)) break; }
  await sleep(900);
}
async function closeItem() {
  await escape(); await sleep(400);
  for (let i = 0; i < 20; i++) { await sleep(200); if (!(await ev(`!!document.querySelector('[role=dialog][data-state=open]')`))) break; }
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

  // A — a card that has been written about, and its page
  log.A_noted = await noted();
  await openItem('Linear — product design');
  log.A_notes = await notes();
  await shot('collection-notes-light.png');
  await closeItem();

  // B — writing notes on one that had none
  await openItem('Brand guidelines');
  log.B_before = await notes();
  log.B_caret = await caretToEnd();
  await send('Input.insertText', { text: 'Why I saved this: the colour section.' });
  await sleep(900);
  await closeItem();
  log.B_cardNoted = (await noted()).includes('Brand guidelines');
  await openItem('Brand guidelines');
  log.B_kept = (await notes())?.text;
  await closeItem();

  // C — the search reads what was written
  await clickAt(await at('[data-collection-page] button', `e.getAttribute('aria-label') === 'Search'`)); await sleep(300);
  await send('Input.insertText', { text: 'sidebar' }); await sleep(600);
  log.C_found = await cards();
  await escape(); await sleep(500);
  await send('Input.insertText', { text: '' });
  log.C_restored = (await cards()).length;

  // D — a note item's words are its body
  await openItem('Idea: a quieter onboarding');
  log.D_notes = await notes();
  log.D_title = await itemTitle();
  await caretToEnd();
  await send('Input.insertText', { text: ' Start with one.' });
  await sleep(900);
  await closeItem();
  log.D_card = (await cards()).find((c) => c.startsWith('Idea:')) ?? null;
  log.D_cardText = await cardText('Idea: a quieter onboarding');
  log.D_noteNotDoubled = !(await noted()).some((c) => c && c.startsWith('Idea:'));

  // E — the editor's own commands work inside an item's page
  await openItem('Brand guidelines');
  await caretToEnd();
  await key('Enter', 'Enter', 13, { text: '\r' }); await sleep(300);
  await send('Input.insertText', { text: '/' }); await sleep(700);
  log.E_slashMenu = await ev(`(() => {
    const menu = [...document.querySelectorAll('[role=listbox],[role=menu],[data-slash-menu]')].find((m) => m.textContent.includes('Heading') || m.textContent.includes('To-do'));
    return menu ? menu.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80) : null;
  })()`);
  await escape(); await sleep(300);
  await closeItem();

  // F — dark, and a phone
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(500);
  await openItem('Linear — product design');
  log.F_dark = await ev(`(() => { const b = document.querySelector('[data-item-notes]'); if (!b) return null; const s = getComputedStyle(b); return { color: s.color }; })()`);
  await shot('collection-notes-dark.png');
  await closeItem();
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1000);
  await openItem('Linear — product design');
  log.F_phone = await ev(`(() => {
    const b = document.querySelector('[data-item-notes]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { width: Math.round(r.width), inside: r.left >= 0 && r.right <= window.innerWidth + 1 };
  })()`);
  await shot('collection-notes-phone.png');

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
