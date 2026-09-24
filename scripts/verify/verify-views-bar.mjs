// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol: menus open on a real right-click, rows are dragged with real,
// multi-step pointer events, and the keyboard is real key events.
//
// A database's view bar, Notion's (the user, 2026-09-15): three tabs and "N more…";
// the more list searches, re-orders by drag and by keyboard, and opens any view's
// menu; right-click a tab (or click the one you are on) for Rename · Display as ·
// Edit view · Copy link to view · Open as full page · Show database title ·
// Duplicate view · Delete view.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-views-bar.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9361;
const profile = mkdtempSync(join(tmpdir(), 'zb-views-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const consoleErrors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, buttons = 0, button = 'left') => send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1 });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); }
async function rightClickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 2, 'right'); await mouse('mouseReleased', x, y, 0, 'right'); }
async function key(k, code, vk, modifiers = 0) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers }); }
async function type(text) { for (const ch of text) await send('Input.dispatchKeyEvent', { type: 'char', text: ch }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const click = async (sel, test, wait = 450) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at); await sleep(wait); };
const rightClick = async (sel, test, wait = 450) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to right-click: ${sel} ${test}`); await rightClickAt(...at); await sleep(wait); };

// The first database on screen whose tabs these are.
const TABS = `[role=radiogroup][aria-label="Database views"]`;
const tabs = (nth = 0) => ev(`[...document.querySelectorAll('${TABS}')][${nth}] ? [...[...document.querySelectorAll('${TABS}')][${nth}].querySelectorAll('[role=radio]')].map((t) => ({ name: t.textContent.trim(), checked: t.getAttribute('aria-checked') === 'true', iconOnly: !!t.querySelector('.sr-only') })) : null`);
const moreButton = () => ev(`[...document.querySelectorAll('button')].find((b) => /^\\d+ more…$/.test(b.textContent.trim()))?.textContent.trim() ?? null`);
const menuItems = () => ev(`[...document.querySelectorAll('[role=menu]')].pop() ? [...[...document.querySelectorAll('[role=menu]')].pop().querySelectorAll('[role=menuitem]')].map((i) => (i.getAttribute('aria-disabled') === 'true' || i.hasAttribute('data-disabled') ? '(disabled) ' : '') + i.textContent.trim()) : null`);
const moreRows = () => ev(`(() => { const d = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].find((w) => w.querySelector('input[aria-label="Search for a view"]')); return d ? [...d.querySelectorAll('button[aria-current], button[aria-current="true"], .group > button.flex-1')].map((b) => b.textContent.trim() + (b.getAttribute('aria-current') ? ' (current)' : '')) : null; })()`);
const toasts = () => ev(`[...document.querySelectorAll('[data-sonner-toast], [role=status], li[data-type]')].map((t) => t.textContent.trim()).filter(Boolean).slice(-3)`);

async function drag(from, to) {
  await mouse('mouseMoved', from[0], from[1]);
  await mouse('mousePressed', from[0], from[1], 1);
  for (let i = 1; i <= 12; i++) { await mouse('mouseMoved', from[0] + (to[0] - from[0]) * i / 12, from[1] + (to[1] - from[1]) * i / 12, 1); await sleep(30); }
  await mouse('mouseReleased', to[0], to[1]);
  await sleep(450);
}

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Browser.grantPermissions', { origin: new URL(base).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Projects tracker/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  log.theme = theme;
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 1000);

  // ── Three tabs, then "1 more…" ──
  log.rest = { tabs: await tabs(), more: await moreButton(), addView: await ev(`!!document.querySelector('button[aria-label="Add view"]')`) };
  await shot(`views-${theme}-bar.png`);

  // ── The more list ──
  await click('button', `/^\\d+ more…$/.test(e.textContent.trim())`, 600);
  log.moreOpen = { focus: await ev(`document.activeElement?.getAttribute('aria-label')`), rows: await moreRows(), handles: await ev(`[...document.querySelectorAll('button[aria-label^="Move "]')].map((b) => b.getAttribute('aria-label'))`) };
  await shot(`views-${theme}-more.png`);
  await type('time'); await sleep(300);
  log.search = { rows: await moreRows(), handles: await ev(`document.querySelectorAll('button[aria-label^="Move "]').length`) };
  for (let i = 0; i < 4; i++) await key('Backspace', 'Backspace', 8);
  await sleep(250);
  // Pick the folded-away view: it takes the last tab's place.
  await click('.group > button.flex-1', `e.textContent.trim() === 'Timeline'`, 700);
  log.pickFolded = { tabs: await tabs(), more: await moreButton() };

  // Drag Gallery to the top of the list by its handle.
  await click('button', `/^\\d+ more…$/.test(e.textContent.trim())`, 600);
  const g = await centre('button[aria-label^="Move "]', `e.getAttribute('aria-label') === 'Move Gallery'`);
  const tt = await centre('button[aria-label^="Move "]', `e.getAttribute('aria-label') === 'Move Table'`);
  await drag(g, [tt[0], tt[1] - 10]);
  log.dragged = await moreRows();
  // Keyboard: lift Board, one down, drop.
  await ev(`document.querySelector('button[aria-label="Move Board"]').focus(), true`);
  await key(' ', 'Space', 32); await sleep(250);
  await key('ArrowDown', 'ArrowDown', 40); await sleep(250);
  await key(' ', 'Space', 32); await sleep(450);
  log.keyboard = await moreRows();
  // A view's ⋯ in the list opens the same menu.
  const galleryRow = await centre('.group > button.flex-1', `e.textContent.trim() === 'Gallery'`);
  await mouse('mouseMoved', galleryRow[0], galleryRow[1]); await sleep(200);
  await click('button', `e.getAttribute('aria-label') === 'Gallery options'`, 500);
  log.rowMenu = await menuItems();
  await key('Escape', 'Escape', 27); await sleep(300);
  await key('Escape', 'Escape', 27); await sleep(400);
  log.afterReorder = await tabs();

  // ── Right-click a tab ──
  // After the re-order the tabs are Gallery · Table · Timeline; Board waits under "more".
  await rightClick(`${TABS} [role=radio]`, `e.textContent.trim() === 'Table'`, 600);
  log.tabMenu = await menuItems();
  await shot(`views-${theme}-menu.png`);
  // Display as → Icon only.
  await click('[role=menuitem]', `e.textContent.trim() === 'Display as'`, 500);
  log.displaySub = await ev(`[...document.querySelectorAll('[role=menu]')].pop().innerText.replace(/\\s+/g, ' ').trim()`);
  await click('[role=menuitem]', `e.textContent.trim() === 'Icon only'`, 500);
  log.iconOnly = { tabs: await tabs(), stored: await ev(`localStorage.getItem('zb-view-tab-display')`) };

  // Rename (Table is icon-only now: find it by its hidden name).
  await rightClick(`${TABS} [role=radio]`, `e.textContent.trim() === 'Table'`, 600);
  await click('[role=menuitem]', `e.textContent.trim() === 'Rename'`, 600);
  log.renameFocus = await ev(`({ label: document.activeElement?.getAttribute('aria-label'), value: document.activeElement?.value, selected: document.activeElement?.selectionEnd - document.activeElement?.selectionStart })`);
  await type('Pipeline'); await key('Enter', 'Enter', 13); await sleep(500);
  log.renamed = await tabs();

  // Duplicate — the copy sits beside it, and shows.
  await rightClick(`${TABS} [role=radio]`, `e.textContent.trim() === 'Pipeline'`, 600);
  await click('[role=menuitem]', `e.textContent.trim() === 'Duplicate view'`, 700);
  log.duplicated = { tabs: await tabs(), more: await moreButton() };

  // Delete — gone, then back with Undo.
  await rightClick(`${TABS} [role=radio]`, `e.getAttribute('aria-checked') === 'true'`, 600);
  await click('[role=menuitem]', `e.textContent.trim() === 'Delete view'`, 700);
  log.deleted = { tabs: await tabs(), more: await moreButton(), toast: await toasts() };
  await click('button', `e.textContent.trim() === 'Undo'`, 700);
  log.undone = { more: await moreButton() };

  // Click the tab you are on → its menu.
  await click(`${TABS} [role=radio]`, `e.getAttribute('aria-checked') === 'true'`, 600);
  log.clickSelected = (await menuItems())?.length ?? 0;
  // Edit view → the settings panel.
  await click('[role=menuitem]', `e.textContent.trim() === 'Edit view'`, 700);
  log.editView = await ev(`!!document.querySelector('input[aria-label="View name"]')`);
  await key('Escape', 'Escape', 27); await sleep(300);
  await clickAt(700, 860); await sleep(400);

  // Copy link → a link that opens this view.
  await rightClick(`${TABS} [role=radio]`, `e.textContent.trim() === 'Gallery'`, 600);
  await click('[role=menuitem]', `e.textContent.trim() === 'Copy link to view'`, 700);
  const link = await ev(`navigator.clipboard.readText().catch((e) => 'read failed: ' + e.message)`);
  log.copyLink = { link, toast: await toasts() };
  if (link.startsWith('http')) {
    // Pick another view, then follow the link: the link's view shows.
    await click(`${TABS} [role=radio]`, `e.getAttribute('aria-checked') !== 'true'`, 600);
    await ev(`location.hash = ${JSON.stringify(new URL(link).hash)}, true`); await sleep(700);
    log.followLink = (await tabs()).find((x) => x.checked)?.name;
  }

  // ── A database inside a document: Open as full page, and its title ──
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Launch plan/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(400);
  await click('button,[role=button],.doc-card', `/Launch plan/.test(e.textContent) && e.textContent.length < 80`, 1200);
  await rightClick(`${TABS} [role=radio]`, `true`, 600);
  log.inlineMenu = await menuItems();
  const titleBefore = await ev(`document.querySelectorAll('input[aria-label="Database name"]').length`);
  await click('[role=menuitem]', `/database title$/.test(e.textContent.trim())`, 600);
  log.inlineTitle = { before: titleBefore, after: await ev(`document.querySelectorAll('input[aria-label="Database name"]').length`) };
  await rightClick(`${TABS} [role=radio]`, `true`, 600);
  log.inlineMenuAfter = (await menuItems())?.find((x) => /database title$/.test(x));
  await click('[role=menuitem]', `/database title$/.test(e.textContent.trim())`, 600);
  await shot(`views-${theme}-inline.png`);

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(900);
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 1000).catch(() => {});
  log.phone = await ev(`(() => { const r = document.querySelector('[data-bleed-root]'); const bar = document.querySelector('${TABS}'); return { pageScrollsSideways: r ? r.scrollWidth > r.clientWidth : null, tabsWidth: bar ? Math.round(bar.getBoundingClientRect().width) : null }; })()`);
  await shot(`views-${theme}-375.png`);
  log.consoleErrors = consoleErrors;
} catch (e) {
  log.error = String(e?.stack || e);
  log.consoleErrors = consoleErrors;
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
