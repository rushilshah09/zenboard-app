// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// COLLECTION_PLAN K3–K5 — a Collection is its own item, beside a Database (COLLECTION_ITEM_BRIEF),
// 2026-09-15, on the documents harness. The harness has no session: every server action is answered
// in React's flight format (as verify-nested-pages.mjs does), and `/api/unfurl` is scripted. Clicks,
// keys, typing, the wheel, drags and file picks are trusted input; a paste is a ClipboardEvent
// carrying the text (a trusted ⌘V would write this machine's real clipboard).
//   A  "Brand inspiration" opens as a Collection, not a database: its bar and a masonry of its items
//   B  a paste on the page: first at once as "Fetching preview…", then named; a toast with Undo
//   C  Add → a typed link and Enter
//   D  Add → Upload files: an image item drawn from the file
//   E  an item opens in the centre, and renaming it renames its card
//   F  ⌘-click two items, Delete, and the toast's Undo brings them back
//   G  Canvas opens as the grid's arrangement; a dragged card stays where it was put, through Grid and back
//   H  a marquee selects; ⌘/Ctrl-wheel zooms; Fit; the corner handle widens a card; ⌘Z takes it back
//   L  (run after H) on a coarse pointer the handle answers a finger past the corner; a touch drag widens the card
//   I  "Moodboard" is empty: its empty state, then a first paste
//   J  More to create → Collection makes "New collection" and opens it
//   K  "/collection" in a document makes a Collection and opens it
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-item.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9377;
const profile = mkdtempSync(join(tmpdir(), 'zb-collection-item-'));
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
async function dragBy(from, dx, dy, steps = 10) {
  const [x, y] = from;
  await mouse('mouseMoved', x, y); await sleep(40);
  await mouse('mousePressed', x, y, 1);
  for (let i = 1; i <= steps; i++) { await mouse('mouseMoved', x + (dx * i) / steps, y + (dy * i) / steps, 1); await sleep(16); }
  await mouse('mouseReleased', x + dx, y + dy);
}
const key = async (k, code, vk, { text, modifiers = 0 } = {}) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
};
const escape = () => key('Escape', 'Escape', 27);
const enter = () => key('Enter', 'Enter', 13, { text: '\r' });
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

// What each link says; `delay` holds the answer back.
const ANSWERS = {
  'https://example.com/typed-article': { delay: 1500, meta: { title: 'On quiet interfaces', author: 'Ann Example', siteName: 'Example' } },
  'https://vimeo.com/76979871': { meta: { title: 'A film from Vimeo', author: 'A maker', siteName: 'Vimeo' } },
  'https://example.com/first-in-empty': { meta: { title: 'First of many', siteName: 'Example' } },
};

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
/** The centre of an element inside the canvas, measured where it is — a canvas frame is never scrolled. */
const within = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${test});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const cards = () => ev(`[...document.querySelectorAll('[data-collection-item] > [aria-label]')].map((e) => e.getAttribute('aria-label'))`);
const card = (title) => ev(`(() => {
  const e = [...document.querySelectorAll('[data-collection-item] > [aria-label]')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(title)});
  if (!e) return null;
  const img = e.querySelector('img');
  return { text: e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 100), busy: e.getAttribute('aria-busy'), img: img ? img.getAttribute('src').slice(0, 60) : null };
})()`);
const cardCell = (title) => ev(`(() => {
  const e = [...document.querySelectorAll('[data-canvas-item]')].find((x) => x.querySelector('[aria-label]')?.getAttribute('aria-label') === ${JSON.stringify(title)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), center: [r.x + r.width / 2, r.y + Math.min(40, r.height / 2)] };
})()`);
const hits = (point, title) => ev(`document.elementFromPoint(${point[0]}, ${point[1]})?.closest('[data-canvas-item]')?.querySelector('[aria-label]')?.getAttribute('aria-label') === ${JSON.stringify(title)}`);
const barText = () => ev(`(() => { const p = document.querySelector('[data-collection-page]'); return p ? p.firstElementChild.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const layout = (name) => at('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === ${JSON.stringify(name)}`);
const mode = () => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open');
  if (!d) return 'closed';
  const c = String(d.className);
  if (d.querySelector('[aria-label="Resize panel"]') || /(^|\\s)end-1(\\s|$)/.test(c)) return 'side-peek';
  if (c.includes('left-1/2')) return 'center-peek';
  if (c.includes('inset-0')) return 'full-page';
  return 'unknown';
})()`);

async function freshHarness() {
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('.doc-card')].some((b) => b.textContent.includes('Brand inspiration'))`).catch(() => false)) break; }
  await sleep(600);
}
async function openDoc(title, ready) {
  await clickAt(await at('button,[role=button],.doc-card', `e.textContent.includes(${JSON.stringify(title)}) && e.textContent.length < 80`));
  for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(ready)) break; }
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
  const actions = [];
  async function answer(p) {
    const { request, requestId } = p;
    if (request.url.includes('/api/unfurl')) {
      const link = new URL(request.url).searchParams.get('url') ?? '';
      const a = ANSWERS[link];
      if (a?.delay) await sleep(a.delay);
      await send('Fetch.fulfillRequest', { requestId, responseCode: a ? 200 : 404, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify(a ? { url: link, ...a.meta } : { error: 'Not found' })).toString('base64') });
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
  await freshHarness();

  // A
  await openDoc('Brand inspiration', `document.querySelectorAll('[data-collection-item]').length >= 7`);
  log.A_title = await ev(`document.querySelector('textarea.doc-title-input')?.value`);
  log.A_isCollection = await ev(`!!document.querySelector('[data-collection-page]') && !document.querySelector('[data-db-surface]')`);
  log.A_bar = await barText();
  log.A_cards = await cards();
  log.A_youtube = await card('Me at the zoo');
  log.A_imageAddress = await card('React mark — logo reference');
  log.A_pdfTile = await card('Brand guidelines');
  log.A_note = await card('Idea: a quieter onboarding');
  await shot('collection-grid-light.png');

  // B
  await ev(`(document.activeElement?.blur(), true)`);
  log.B_taken = await paste('https://example.com/typed-article');
  await sleep(250);
  log.B_firstAtOnce = (await cards())[0];
  log.B_toast = await ev(`[...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Undo').map((b) => b.closest('li,[role=status]')?.textContent.replace(/\\s+/g, ' ').trim()).slice(-1)[0] ?? null`);
  await sleep(2000);
  log.B_named = (await cards())[0];
  log.B_bar = await barText();

  // C
  await clickAt(await at('[data-collection-page] button', `e.textContent.trim() === 'Add'`)); await sleep(400);
  log.C_fieldFocused = await ev(`document.activeElement?.getAttribute('aria-label') === 'Link or note'`);
  await send('Input.insertText', { text: 'https://vimeo.com/76979871' });
  await enter(); await sleep(1200);
  log.C_first = (await cards())[0];

  // D — a real (1×1) PNG, picked through the file input.
  const png = join(out, 'collection-upload.png');
  writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
  await clickAt(await at('[data-collection-page] button', `e.textContent.trim() === 'Add'`)); await sleep(400);
  const doc = await send('DOM.getDocument', { depth: -1 });
  const input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [png] });
  await sleep(1000);
  log.D_first = await card((await cards())[0]);

  // E
  await clickAt(await at('[data-collection-item] > [aria-label]', `e.getAttribute('aria-label') === 'Linear — product design'`)); await sleep(800);
  log.E_mode = await mode();
  log.E_name = await ev(`document.querySelector('[role=dialog] input[aria-label="Name"]')?.value`);
  await clickAt(await at('[role=dialog] input[aria-label="Name"]'));
  await ev(`(document.querySelector('[role=dialog] input[aria-label="Name"]').select(), true)`);
  await send('Input.insertText', { text: 'Linear — calm product reference' });
  await enter(); await sleep(300);
  await escape(); await sleep(700);
  log.E_renamed = (await cards()).includes('Linear — calm product reference');
  await shot('collection-renamed.png');

  // F
  await clickAt(await at('[data-collection-item] > [aria-label]', `e.getAttribute('aria-label') === 'Brand guidelines'`), 4);
  await clickAt(await at('[data-collection-item] > [aria-label]', `e.getAttribute('aria-label') === 'Packaging with one colour'`), 4);
  await sleep(300);
  log.F_bar = await barText();
  const beforeDelete = (await cards()).length;
  await clickAt(await at('[data-collection-page] [role=toolbar] button', `e.textContent.trim() === 'Delete'`)); await sleep(500);
  log.F_deleted = beforeDelete - (await cards()).length;
  await clickAt(await at('button', `e.textContent.trim() === 'Undo' && /deleted/.test((e.closest('li,[role=status],[role=alert]') ?? e.parentElement?.parentElement)?.textContent ?? '')`)); await sleep(600);
  log.F_restored = (await cards()).length === beforeDelete;

  // G
  const order = await cards();
  await clickAt(await layout('Canvas')); await sleep(1500);
  log.G_canvas = await ev(`!!document.querySelector('[data-collection-canvas]')`);
  const first = await cardCell(order[0]);
  const second = await cardCell(order[1]);
  log.G_firstRowAligned = !!first && !!second && first.y === second.y && second.x > first.x;
  await shot('collection-canvas-light.png');
  log.G_targetHit = await hits(first.center, order[0]);
  await dragBy(first.center, 260, 140);
  await sleep(500);
  const moved = await cardCell(order[0]);
  log.G_moved = { dx: moved.x - first.x, dy: moved.y - first.y };
  await clickAt(await layout('Grid')); await sleep(800);
  await clickAt(await layout('Canvas')); await sleep(1200);
  const back = await cardCell(order[0]);
  log.G_keptThroughGrid = Math.abs(back.x - moved.x) <= 1 && Math.abs(back.y - moved.y) <= 1;

  // H
  const frame = await ev(`(() => { const r = document.querySelector('[data-collection-canvas]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const inSecond = await cardCell(order[1]);
  await dragBy([inSecond.x - 16, inSecond.y - 16], inSecond.w / 2 + 16, 60);
  await sleep(300);
  log.H_marqueeBar = await barText();
  const zoomLabel = () => ev(`[...document.querySelectorAll('[data-canvas-controls] button')].map((b) => b.textContent.trim()).find((t) => /%$/.test(t))`);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: frame.x + frame.w / 2, y: frame.y + frame.h / 2, deltaX: 0, deltaY: -120, modifiers: 2 });
  await sleep(400);
  log.H_zoomedTo = await zoomLabel();
  await clickAt(await within('[data-canvas-controls] button', `e.getAttribute('aria-label') === 'Fit everything'`)); await sleep(400);
  log.H_fitTo = await zoomLabel();
  await clickAt(await within('[data-canvas-controls] button', `e.getAttribute('aria-label') === 'Zoom to 100%'`)); await sleep(400);
  log.H_reset = await zoomLabel();
  // A card in plain sight: its centre and its resize handle are both itself, nothing laid over them
  // and nothing out of the frame. Tried in the grid's order until one qualifies.
  const handleAt = () => ev(`(() => { const r = document.querySelector('[data-resize-handle]')?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
  let pick = null;
  for (const title of order) {
    const cell = await cardCell(title);
    if (!cell || !(await hits(cell.center, title))) continue;
    await clickAt(cell.center); await sleep(300);
    const handle = await handleAt();
    const onIt = await ev(`document.querySelector('[data-resize-handle]')?.closest('[data-canvas-item]')?.querySelector('[aria-label]')?.getAttribute('aria-label') === ${JSON.stringify(title)}`);
    const hit = handle && await ev(`!!document.elementFromPoint(${handle[0]}, ${handle[1]})?.closest('[data-resize-handle]')`);
    if (onIt && hit) { pick = { title, handle, w: cell.w }; break; }
  }
  log.H_resizeTarget = pick?.title ?? null;
  if (pick) {
    await dragBy(pick.handle, 120, 0); await sleep(500);
    log.H_resized = (await cardCell(pick.title)).w - pick.w;
    await key('z', 'KeyZ', 90, { modifiers: 4 }); await sleep(500);
    log.H_undoneWidth = (await cardCell(pick.title)).w === pick.w;
    // The keyboard twin: ] widens the selected card, and ⌘Z takes it back.
    await key(']', 'BracketRight', 221, { text: ']' }); await sleep(400);
    log.H_keyResized = (await cardCell(pick.title)).w - pick.w;
    await key('z', 'KeyZ', 90, { modifiers: 4 }); await sleep(400);
    log.H_keyUndone = (await cardCell(pick.title)).w === pick.w;
  }
  // Tab onto a card: the camera brings it into sight, and the frame itself never scrolls.
  await key('Tab', 'Tab', 9); await sleep(400);
  log.H_frameScroll = await ev(`(() => { const f = document.querySelector('[data-collection-canvas]'); return [f.scrollTop, f.scrollLeft]; })()`);
  await shot('collection-canvas-arranged.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await sleep(500);
  await shot('collection-canvas-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // L — a finger can take the corner handle. On a coarse pointer the handle answers well outside its drawn
  // square (and barely inside the card, whose corner still moves it), and a touch drag widens the card.
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await sleep(500);
  log.L_coarse = await ev(`matchMedia('(pointer: coarse)').matches`);
  const touch = (type, points = []) => send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y })) });
  const gripHit = (p) => ev(`!!document.elementFromPoint(${p[0]}, ${p[1]})?.closest('[data-resize-handle]')`);
  const onCanvas = () => ev(`[...document.querySelectorAll('[data-canvas-item]')].map((c) => c.querySelector('[aria-label]')?.getAttribute('aria-label')).filter(Boolean)`);
  // A card with open canvas beyond its corner: inside the frame, clear of the controls and of every other card.
  let grip = null;
  for (const title of await onCanvas()) {
    const cell = await cardCell(title);
    if (!cell || !(await hits(cell.center, title))) continue;
    const corner = [cell.x + cell.w, cell.y + cell.h];
    const outside = [corner[0] + 20, corner[1] + 20];
    const open = await ev(`(() => {
      const [x, y] = ${JSON.stringify(outside)};
      const has = (r, pad) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
      if (!has(document.querySelector('[data-collection-canvas]').getBoundingClientRect(), -8)) return false;
      if (has(document.querySelector('[data-canvas-controls]').getBoundingClientRect(), 8)) return false;
      return ![...document.querySelectorAll('[data-canvas-item]')]
        .filter((c) => c.querySelector('[aria-label]')?.getAttribute('aria-label') !== ${JSON.stringify(title)})
        .some((c) => has(c.getBoundingClientRect(), 4));
    })()`);
    if (open) { grip = { title, center: cell.center, corner, outside, w: cell.w }; break; }
  }
  log.L_target = grip?.title ?? null;
  if (grip) {
    await touch('touchStart', [grip.center]); await touch('touchEnd'); await sleep(400);
    log.L_selected = await ev(`document.querySelector('[data-resize-handle]')?.closest('[data-canvas-item]')?.querySelector('[aria-label]')?.getAttribute('aria-label') === ${JSON.stringify(grip.title)}`);
    log.L_gripOutside = await gripHit(grip.outside);
    const inside = [grip.corner[0] - 16, grip.corner[1] - 16];
    log.L_cardInside = (await hits(inside, grip.title)) && !(await gripHit(inside));
    await touch('touchStart', [grip.outside]);
    for (let i = 1; i <= 10; i++) { await touch('touchMove', [[grip.outside[0] + 10 * i, grip.outside[1]]]); await sleep(16); }
    await touch('touchEnd'); await sleep(500);
    log.L_touchResized = (await cardCell(grip.title)).w - grip.w;
    await key('z', 'KeyZ', 90, { modifiers: 4 }); await sleep(400);
    log.L_undone = (await cardCell(grip.title)).w === grip.w;
  }
  await send('Emulation.setTouchEmulationEnabled', { enabled: false }); await sleep(500);
  // The control: with a fine pointer again, the same point is not the handle.
  log.L_fineCoarse = await ev(`matchMedia('(pointer: coarse)').matches`);
  log.L_fineGrip = grip ? await gripHit(grip.outside) : null;

  // I
  await freshHarness();
  await openDoc('Moodboard', `/Collect anything/.test(document.querySelector('[data-collection-page]')?.textContent ?? '')`);
  log.I_empty = await ev(`/Collect anything/.test(document.querySelector('[data-collection-page]')?.textContent ?? '')`);
  await shot('collection-empty.png');
  await ev(`(document.activeElement?.blur(), true)`);
  log.I_taken = await paste('https://example.com/first-in-empty');
  await sleep(1200);
  log.I_cards = await cards();

  // J
  await freshHarness();
  await clickAt(await at('button', `e.getAttribute('aria-label') === 'More to create'`)); await sleep(400);
  log.J_menu = await ev(`[...document.querySelectorAll('[role=menuitem]')].map((m) => m.textContent.trim())`);
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Collection'`)); await sleep(1500);
  log.J_title = await ev(`document.querySelector('textarea.doc-title-input')?.value`);
  log.J_empty = await ev(`/Collect anything/.test(document.querySelector('[data-collection-page]')?.textContent ?? '')`);
  await shot('collection-new.png');
  // Its default name arrives selected, so typing names it; Enter hands the page back its paste.
  const titleSelected = () => ev(`(() => { const t = document.querySelector('textarea.doc-title-input'); return !!t && document.activeElement === t && t.value.length > 0 && t.selectionStart === 0 && t.selectionEnd === t.value.length; })()`);
  log.J_titleSelected = await titleSelected();
  await send('Input.insertText', { text: 'Mood references' }); await sleep(200);
  await enter(); await sleep(300);
  log.J_named = await ev(`document.querySelector('textarea.doc-title-input')?.value`);
  log.J_titleLeft = await ev(`document.activeElement !== document.querySelector('textarea.doc-title-input')`);
  log.J_pasteTaken = await paste('https://example.com/first-in-empty');
  await sleep(900);
  log.J_cards = await cards();

  // K
  await freshHarness();
  await openDoc('Launch plan', `[...document.querySelectorAll('[data-block-id]')].some((b) => /Everything that has to ship/.test(b.textContent))`);
  const para = await ev(`(() => { const r = [...document.querySelectorAll('[data-block-id]')].find((b) => /Everything that has to ship/.test(b.textContent)).getBoundingClientRect(); return [r.x + r.width - 20, r.y + r.height / 2]; })()`);
  await clickAt(para); await sleep(300);
  await key('End', 'End', 35); await enter(); await sleep(300);
  await send('Input.insertText', { text: '/collection' }); await sleep(600);
  log.K_menu = await ev(`[...document.querySelectorAll('[role=option]')].slice(0, 3).map((o) => o.textContent.replace(/\\s+/g, ' ').trim())`);
  await enter(); await sleep(1800);
  log.K_title = await ev(`document.querySelector('textarea.doc-title-input')?.value`);
  log.K_isCollection = await ev(`!!document.querySelector('[data-collection-page]')`);
  log.K_titleSelected = await titleSelected();

  // M — Duplicate copies what is on screen: an item collected a moment ago is in the copy, which opens
  // as a Collection. (The page list still holds the content the page was loaded with.)
  await freshHarness();
  await openDoc('Brand inspiration', `document.querySelectorAll('[data-collection-item]').length >= 7`);
  await ev(`(document.activeElement?.blur(), true)`);
  await paste('https://vimeo.com/76979871'); await sleep(900);
  const itemCount = () => ev(`document.querySelector('[data-collection-canvas]') ? document.querySelectorAll('[data-canvas-item]').length : document.querySelectorAll('[data-collection-item]').length`);
  log.M_source = await itemCount();
  await clickAt(await at('button', `e.getAttribute('aria-label') === 'More actions'`)); await sleep(400);
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Duplicate'`));
  for (let i = 0; i < 30; i++) { await sleep(200); if (await ev(`document.querySelector('textarea.doc-title-input')?.value === 'Brand inspiration copy'`)) break; }
  await sleep(1000);
  log.M_title = await ev(`document.querySelector('textarea.doc-title-input')?.value`);
  log.M_isCollection = await ev(`!!document.querySelector('[data-collection-page]')`);
  log.M_items = await itemCount();
  log.M_hasCollected = (await cards()).includes('A film from Vimeo');

  // Phone
  await freshHarness();
  await openDoc('Brand inspiration', `document.querySelectorAll('[data-collection-item]').length >= 7`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1500);
  log.phoneColumns = await ev(`new Set([...document.querySelectorAll('[data-collection-grid] > div')].map((e) => Math.round(e.getBoundingClientRect().x))).size`);
  await shot('collection-phone.png');

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
