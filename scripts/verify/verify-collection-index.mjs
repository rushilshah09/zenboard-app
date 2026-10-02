// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN X1–X4 — the Collection Index and an unbounded Collection workspace (COLLECTION_INDEX_BRIEF),
// 2026-09-16, on the documents harness. Server actions are answered in React's flight format; clicks, hovers,
// keys and typing are trusted input.
//   A  the rail's Collections row opens the Index: "New collection" first, then a card per Collection — a preview
//      made of its own items, its name, "N items", "Shared" — the most recently edited first, in several columns
//   B  `?view=collections` lands on the Index
//   C  "New collection" opens a Collection with its name selected; once named, it is on the Index at once
//   D  a card's pencil renames the Collection in place
//   E  a card's menu duplicates it: the copy opens with every item, and is on the Index
//   F  a card's menu deletes it to Trash, and the toast's Undo brings it back
//   G  the rail's search narrows the Index by name
//   H  Sort: by name, and by most items
//   I  an empty Collection's + opens it with Add open
//   J  the workspace: a Collection page is as wide as the pane; its canvas has no frame and meets the pane's sides
//      and the window's bottom; "Full width" is not offered for a Collection
//   K  a Collection's breadcrumb names Collections, and opens the Index
//   dark: the Index · phone: the Index in one column
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-index.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9396;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-index-'));
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
const enter = () => key('Enter', 'Enter', 13, { text: '\r' });
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** The centre of the first element matching `selector` that passes `test`, scrolled into view. */
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
/** A row of the Documents rail, by its words (below the header, at the left). */
const railRow = (label) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)} && x.getBoundingClientRect().x < 280 && x.getBoundingClientRect().y > 60);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const CARD = (name) => `[...document.querySelectorAll('[data-collection-card]')].find((c) => c.querySelector('button[title]')?.getAttribute('title') === ${JSON.stringify(name)})`;
/** Every card on the Index, in order: its name, its meta line, and what its preview drew. */
const cards = () => ev(`[...document.querySelectorAll('[data-collection-card]')].map((c) => {
  const preview = c.firstElementChild;
  return {
    name: c.querySelector('button[title]')?.getAttribute('title') ?? c.querySelector('input')?.value ?? null,
    meta: c.querySelector('.text-meta')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    pictures: [...preview.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 0).length,
    tiles: preview.querySelectorAll('div.bg-surface-fill').length,
    plus: !!preview.querySelector('[aria-label="Add to this collection"]'),
  };
})`);
const names = async () => (await cards()).map((c) => c.name);
/** Hover a card (its controls show on hover), then find one of its controls. */
async function cardControl(name, label) {
  const centre = await ev(`(() => { const c = ${CARD(name)}; if (!c) return null; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 3]; })()`);
  if (!centre) return null;
  await mouse('mouseMoved', centre[0], centre[1]); await sleep(300);
  return ev(`(() => { const b = ${CARD(name)}?.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
}
const menuItem = (text) => at('[role=menuitem]', `e.textContent.trim() === ${JSON.stringify(text)}`);
const titleValue = () => ev(`document.querySelector('textarea.doc-title-input')?.value ?? null`);
const titleSelected = () => ev(`(() => { const t = document.querySelector('textarea.doc-title-input'); return !!t && document.activeElement === t && t.value.length > 0 && t.selectionStart === 0 && t.selectionEnd === t.value.length; })()`);
const onIndex = () => ev(`document.querySelectorAll('[data-collection-card]').length > 0 && !document.querySelector('textarea.doc-title-input')`);
const until = async (test, tries = 40, ms = 200) => { for (let i = 0; i < tries; i++) { if (await ev(test).catch(() => false)) return true; await sleep(ms); } return false; };

async function harness(query = '') {
  await send('Page.navigate', { url: `${base}/dev-preview/documents${query}` });
  await until(`document.querySelectorAll('.doc-card').length > 0`, 90, 400);
  await sleep(800);
}
async function toIndex() {
  await clickAt(await railRow('Collections'));
  await until(`document.querySelectorAll('[data-collection-card]').length > 0`);
  await sleep(1500);
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
  const actions = [];
  async function answer(p) {
    const { request, requestId } = p;
    if (request.url.includes('/api/unfurl')) {
      await send('Fetch.fulfillRequest', { requestId, responseCode: 404, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'Not found' })).toString('base64') });
      return;
    }
    const isAction = request.method === 'POST' && Object.keys(request.headers).some((h) => h.toLowerCase() === 'next-action');
    if (!isAction) { await send('Fetch.continueRequest', { requestId }); return; }
    actions.push(Object.entries(request.headers).find(([h]) => h.toLowerCase() === 'next-action')[1]);
    const body = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:{"ok":true,"id":"${crypto.randomUUID()}"}\n`;
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(body).toString('base64') });
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // A
  await harness();
  await toIndex();
  log.A_url = await ev(`location.search`);
  log.A_railCurrent = await ev(`[...document.querySelectorAll('button[aria-current="true"]')].map((b) => b.textContent.trim())`);
  log.A_newFirst = await ev(`(() => { const first = document.querySelector('[data-new-collection]'); const card = document.querySelector('[data-collection-card]'); return !!first && !!card && !!(first.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING); })()`);
  log.A_cards = await cards();
  log.A_columns = await ev(`new Set([...document.querySelectorAll('[data-new-collection], [data-collection-card]')].map((e) => Math.round(e.getBoundingClientRect().x))).size`);
  log.A_header = await ev(`[...document.querySelectorAll('header button, [role=banner] button')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()).filter(Boolean)`);
  await shot('index-light.png');

  // B
  await harness('?view=collections');
  log.B_landsOnIndex = await until(`document.querySelectorAll('[data-collection-card]').length === 3`, 30);

  // C
  await clickAt(await at('[data-new-collection]')); await sleep(1500);
  log.C_titleSelected = await titleSelected();
  await send('Input.insertText', { text: 'Studio references' }); await sleep(200);
  await enter(); await sleep(300);
  log.C_named = await titleValue();
  await toIndex();
  log.C_onIndex = (await cards()).find((c) => c.name === 'Studio references') ?? null;
  log.C_firstByEdit = (await names())[0];

  // D — a card's controls show while one of them has focus (a keyboard user tabs onto them); the pencil renames.
  await mouse('mouseMoved', 5, 5); await sleep(250);
  const pillOpacity = () => ev(`getComputedStyle(${CARD('UI references')}.querySelector('.doc-cardmenu')).opacity`);
  const atRest = await pillOpacity();
  await ev(`(${CARD('UI references')}.querySelector('[aria-label="Rename"]').focus(), true)`); await sleep(350);
  log.D_controlsOnFocus = { atRest, focused: await pillOpacity() };
  await clickAt(await cardControl('UI references', 'Rename')); await sleep(300);
  log.D_field = await ev(`(() => { const i = document.querySelector('[data-collection-card] input[aria-label="Collection name"]'); return i ? { focused: document.activeElement === i, selected: i.selectionStart === 0 && i.selectionEnd === i.value.length } : null; })()`);
  await send('Input.insertText', { text: 'Interface references' }); await sleep(150);
  await enter(); await sleep(500);
  log.D_renamed = (await names()).includes('Interface references') && !(await names()).includes('UI references');

  // E
  await clickAt(await cardControl('Brand inspiration', 'Page menu')); await sleep(400);
  log.E_menu = await ev(`[...document.querySelectorAll('[role=menuitem]')].map((m) => m.textContent.trim())`);
  await clickAt(await menuItem('Duplicate'));
  await until(`document.querySelector('textarea.doc-title-input')?.value === 'Brand inspiration copy'`, 30);
  await sleep(1200);
  log.E_copyOpened = { title: await titleValue(), items: await ev(`document.querySelectorAll('[data-collection-item]').length`) };
  await toIndex();
  log.E_copyOnIndex = (await cards()).find((c) => c.name === 'Brand inspiration copy') ?? null;

  // F — Delete from a card's menu moves the Collection to Trash and does nothing else: the card under the menu does
  // not open. (The menu is portalled, and a click in it still bubbles through React to the card.)
  await clickAt(await cardControl('Moodboard', 'Page menu')); await sleep(400);
  await clickAt(await menuItem('Delete')); await sleep(700);
  log.F_afterDelete = await ev(`({ openTitle: document.querySelector('textarea.doc-title-input')?.value ?? null, onIndex: document.querySelectorAll('[data-collection-card]').length > 0 })`);
  log.F_gone = log.F_afterDelete.onIndex && !(await names()).includes('Moodboard');
  // The toast's Undo where it IS — measured without scrolling anything, and checked to be what a click there hits.
  const undo = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Undo' && /Trash/.test((x.closest('li,[role=status],[role=alert]') ?? x.parentElement?.parentElement)?.textContent ?? ''));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const c = [r.x + r.width / 2, r.y + r.height / 2];
    return { at: c, hits: document.elementFromPoint(c[0], c[1]) === b, text: (b.closest('li,[role=status],[role=alert]') ?? b.parentElement?.parentElement)?.textContent.replace(/\\s+/g, ' ').trim() };
  })()`);
  log.F_toast = undo && { text: undo.text, hits: undo.hits, at: undo.at.map(Math.round) };
  if (undo) await clickAt(undo.at);
  await sleep(700);
  log.F_afterUndo = await ev(`({ onIndex: document.querySelectorAll('[data-collection-card]').length > 0, openTitle: document.querySelector('textarea.doc-title-input')?.value ?? null, search: location.search })`);
  await shot('F-after-undo.png');
  log.F_back = (await names()).includes('Moodboard');

  // F2 — a doc card carries the same controls: Star from its menu stars the doc, and opens nothing.
  await clickAt(await railRow('Draft'));
  await until(`document.querySelectorAll('.doc-card:not([data-collection-card]) button[title]').length > 0`);
  await sleep(600);
  const docTitle = await ev(`[...document.querySelectorAll('.doc-card:not([data-collection-card])')].map((c) => c.querySelector('button[title]')?.getAttribute('title')).find(Boolean) ?? null`);
  const docControl = async (label) => {
    const find = `[...document.querySelectorAll('.doc-card:not([data-collection-card])')].find((x) => x.querySelector('button[title]')?.getAttribute('title') === ${JSON.stringify(docTitle)})`;
    const centre = await ev(`(() => { const c = ${find}; if (!c) return null; const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (!centre) return null;
    await mouse('mouseMoved', centre[0], centre[1]); await sleep(300);
    return ev(`(() => { const b = (${find})?.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  };
  await clickAt(await docControl('Page menu')); await sleep(400);
  await clickAt(await menuItem('Star')); await sleep(700);
  log.F2_docCard = { title: docTitle, opened: await ev(`document.querySelector('textarea.doc-title-input')?.value ?? null`) };
  await toIndex();

  // G
  await clickAt(await at('input[aria-label="Search collections"]'));
  await send('Input.insertText', { text: 'refer' }); await sleep(500);
  log.G_found = await names();
  await ev(`(() => { const i = document.querySelector('input[aria-label="Search collections"]'); i.select(); return true; })()`);
  await key('Backspace', 'Backspace', 8); await sleep(500);
  log.G_cleared = (await names()).length;

  // H
  await clickAt(await at('button', `(e.getAttribute('aria-label') ?? '').startsWith('Sort collections')`)); await sleep(400);
  log.H_options = await ev(`[...document.querySelectorAll('[role=menuitem]')].map((m) => m.textContent.trim())`);
  await clickAt(await menuItem('Name')); await sleep(500);
  log.H_byName = await names();
  await clickAt(await at('button', `(e.getAttribute('aria-label') ?? '').startsWith('Sort collections')`)); await sleep(400);
  await clickAt(await menuItem('Most items')); await sleep(500);
  const byItems = await cards();
  log.H_byItems = byItems.map((c) => `${c.name} · ${c.meta}`);
  const counts = byItems.map((c) => Number.parseInt(c.meta, 10) || 0);
  log.H_fullestFirst = counts.every((n, i) => i === 0 || counts[i - 1] >= n);

  // I
  await clickAt(await cardControl('Moodboard', 'Add to this collection') ?? await at(`[data-collection-card] [aria-label="Add to this collection"]`)); await sleep(1500);
  log.I_opened = await titleValue();
  log.I_addOpen = await ev(`!!document.querySelector('[aria-label="Link or note"]')`);

  // J
  await toIndex();
  await clickAt(await at('[data-collection-card] button[title]', `e.getAttribute('title') === 'Brand inspiration'`)); await sleep(1800);
  log.J_page = await ev(`(() => {
    const page = document.querySelector('[data-collection-page]').getBoundingClientRect();
    const pane = document.querySelector('[data-collection-page]').closest('.scroll-region').getBoundingClientRect();
    return { pageWidth: Math.round(page.width), paneWidth: Math.round(pane.width), columns: new Set([...document.querySelectorAll('[data-collection-grid] > div')].map((e) => Math.round(e.getBoundingClientRect().x))).size };
  })()`);
  await shot('workspace-grid.png');
  await clickAt(await at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === 'Canvas'`)); await sleep(1500);
  log.J_canvas = await ev(`(() => {
    const f = document.querySelector('[data-collection-canvas]');
    const pane = f.closest('.scroll-region');
    const r = f.getBoundingClientRect(); const p = pane.getBoundingClientRect(); const s = getComputedStyle(f);
    return { left: Math.round(r.left - p.left), right: Math.round(p.left + pane.clientWidth - r.right), bottom: Math.round(p.bottom - r.bottom), radius: s.borderTopLeftRadius, sideBorder: s.borderLeftWidth, scrolled: pane.scrollTop };
  })()`);
  await shot('workspace-canvas.png');
  await clickAt(await at('button', `e.getAttribute('aria-label') === 'More actions'`)); await sleep(400);
  log.J_menu = await ev(`[...document.querySelectorAll('[role^=menuitem]')].map((m) => m.textContent.trim())`);
  log.J_noFullWidth = !log.J_menu.some((t) => /full width/i.test(t));
  await key('Escape', 'Escape', 27); await sleep(300);

  // K
  log.K_crumbs = await ev(`[...document.querySelectorAll('button, a')].filter((b) => b.getBoundingClientRect().y < 60 && b.textContent.trim()).map((b) => b.textContent.trim()).slice(0, 8)`);
  await clickAt(await ev(`(() => { const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === 'Collections' && x.getBoundingClientRect().y < 60); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`));
  await sleep(600);
  // A crumb opens its siblings (interactive breadcrumbs): the Collections row there opens the Index.
  if (!(await onIndex())) {
    const row = await at('[role=menuitem], [role=option], button', `e.textContent.trim() === 'Collections' && e.getBoundingClientRect().y > 40`);
    if (row) await clickAt(row);
    await sleep(1000);
  }
  log.K_onIndex = await onIndex();

  // dark
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await sleep(500);
  await shot('index-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // phone
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await harness('?view=collections');
  await until(`document.querySelectorAll('[data-collection-card]').length > 0`, 30);
  await sleep(1200);
  log.phoneColumns = await ev(`new Set([...document.querySelectorAll('[data-new-collection], [data-collection-card]')].map((e) => Math.round(e.getBoundingClientRect().x))).size`);
  // In one column nothing lines up with "New collection", so it need not be a card's height: it is a row.
  log.phoneNewCard = await ev(`(() => { const r = document.querySelector('[data-new-collection]')?.getBoundingClientRect(); return r ? { width: Math.round(r.width), height: Math.round(r.height) } : null; })()`);
  await shot('index-phone.png');

  log.serverActions = actions.length;
  log.consoleErrors = errors;
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
