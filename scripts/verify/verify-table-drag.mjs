// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol: rows and columns are dragged with real, multi-step pointer
// events, and the keyboard is real key events.
//
// Moving a table's rows and columns by hand (database plan T12, after Notion): a
// row by the ⋮⋮ in the margin (drag it, click it for its menu, ⌥↑/⌥↓), a column
// by its header; a line shows where it lands; one ⌘Z takes a drop back; a sorted
// view asks before its sort goes; a grouped table moves a row into another group.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-table-drag.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9363;
const profile = mkdtempSync(join(tmpdir(), 'zb-tabledrag-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); }
// modifiers: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift
async function key(k, code, vk, modifiers = 0) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const rect = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
})()`);
const click = async (sel, test, wait = 450) => {
  await ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test})?.scrollIntoView({ block: 'center', inline: 'nearest' })`);
  const r = await rect(sel, test); if (!r) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(r.cx, r.cy); await sleep(wait);
};
const titles = () => ev(`[...document.querySelectorAll('[data-table-drag] [data-row]')].map((r) => r.querySelector('input[aria-label="Name"]')?.value)`);
const headers = () => ev(`[...document.querySelectorAll('[data-table-drag] [data-column-cell]')].map((c) => c.textContent.trim())`);
const line = () => ev(`(() => { const l = document.querySelector('[data-drop-line]'); if (!l) return null; const r = l.getBoundingClientRect(); return { orientation: l.dataset.dropLine, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`);

/** Press at `from`, travel in steps, look at the line (and shoot it), release at `to`. */
async function drag(from, to, shotName) {
  await mouse('mouseMoved', from[0], from[1]);
  await mouse('mousePressed', from[0], from[1], 1);
  for (let i = 1; i <= 14; i++) { await mouse('mouseMoved', from[0] + (to[0] - from[0]) * i / 14, from[1] + (to[1] - from[1]) * i / 14, 1); await sleep(30); }
  await sleep(120);
  const seen = { line: await line(), ghost: await ev(`document.querySelector('[data-dnd-kit-drag-overlay], .cursor-grabbing')?.textContent?.trim() ?? null`) };
  if (shotName) await shot(shotName);
  await mouse('mouseReleased', to[0], to[1]);
  await sleep(500);
  return seen;
}
/** The handle of the row named `title`, revealed by hovering its row. */
async function handleOf(title) {
  const row = await rect('[data-table-drag] [data-row]', `e.querySelector('input[aria-label="Name"]')?.value === ${JSON.stringify(title)}`);
  await mouse('mouseMoved', row.x + 40, row.cy); await sleep(200);
  return rect('[data-table-drag] [data-row] [data-row-handle] button', `e.closest('[data-row]').querySelector('input[aria-label="Name"]')?.value === ${JSON.stringify(title)}`);
}
const menuItems = () => ev(`[...document.querySelectorAll('[role=menu]')].pop() ? [...[...document.querySelectorAll('[role=menu]')].pop().querySelectorAll('[role=menuitem]')].map((i) => (i.hasAttribute('data-disabled') ? '(disabled) ' : '') + i.textContent.trim()) : null`);

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') { const d = msg.params.exceptionDetails?.exception?.description ?? ''; if (!/Hydration failed/.test(d)) errors.push(d.slice(0, 300)); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') { const d = msg.params.args.map((a) => a.value ?? a.description).join(' '); if (!/script tag/.test(d)) errors.push(d.slice(0, 300)); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Projects tracker/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  log.theme = theme;
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 1000);
  log.rest = { titles: await titles(), headers: await headers() };

  // ── A row, by its handle ──
  const h = await handleOf('Twitter redesign');
  log.handleShown = await ev(`getComputedStyle([...document.querySelectorAll('[data-row-handle]')].find((x) => x.closest('[data-row]').querySelector('input[aria-label="Name"]').value === 'Twitter redesign')).opacity`);
  const first = await rect('[data-table-drag] [data-row]', `true`);
  log.rowDrag = await drag([h.cx, h.cy], [h.cx, first.y + 6], `table-drag-${theme}-row.png`);
  log.afterRowDrag = await titles();
  // One ⌘Z takes the drop back.
  await ev(`document.querySelector('[data-table-drag]').closest('[data-db-surface]').querySelector('input[aria-label="Name"]').focus(), true`);
  await key('z', 'KeyZ', 90, 4); await sleep(400);
  log.undo = await titles();
  await ev(`document.activeElement?.blur(), true`);

  // Click the handle: its menu.
  const h2 = await handleOf('Client onboarding kit');
  await clickAt(h2.cx, h2.cy); await sleep(500);
  log.rowMenu = await menuItems();
  await shot(`table-drag-${theme}-menu.png`);
  await click('[role=menuitem]', `e.textContent.trim().startsWith('Move down')`, 600);
  log.menuMoveDown = await titles();
  // ⌥↑ from the keyboard, and the focus stays on the handle.
  await ev(`[...document.querySelectorAll('[data-row-handle] button')].find((b) => b.closest('[data-row]').querySelector('input[aria-label="Name"]').value === 'Client onboarding kit').focus(), true`);
  await key('ArrowUp', 'ArrowUp', 38, 1); await sleep(500);
  log.altUp = { titles: await titles(), focus: await ev(`document.activeElement?.getAttribute('aria-label')`) };

  // ── A column, by its header ──
  const due = await rect('[data-column-cell]', `e.textContent.trim() === 'Due'`);
  const status = await rect('[data-column-cell]', `e.textContent.trim() === 'Status'`);
  log.columnDrag = await drag([due.cx, due.cy], [status.x + 8, status.cy], `table-drag-${theme}-column.png`);
  log.afterColumnDrag = await headers();
  // The header still opens its menu on a click.
  await click('[data-column-cell] button', `e.textContent.trim() === 'Due'`, 500);
  log.headerMenu = await ev(`!!document.querySelector('input[aria-label="Property name"]')`);
  await key('Escape', 'Escape', 27); await sleep(300);
  // The Properties page lists the same order; a keyboard move there moves the column.
  await click('button[aria-label="View settings"]', 'true', 500);
  await click('button', `e.textContent.trim().startsWith('Properties')`, 500);
  log.propertiesPage = await ev(`[...document.querySelectorAll('button[aria-label^="Move "]')].map((b) => b.getAttribute('aria-label').slice(5))`);
  await ev(`document.querySelector('button[aria-label="Move Tags"]').focus(), true`);
  await key(' ', 'Space', 32); await sleep(250);
  await key('ArrowUp', 'ArrowUp', 38); await sleep(250);
  await key(' ', 'Space', 32); await sleep(500);
  log.afterKeyboardProperty = await headers();
  await shot(`table-drag-${theme}-properties.png`);
  await key('Escape', 'Escape', 27); await sleep(300);

  // ── A sorted view asks before its sort goes ──
  await click('[data-column-cell] button', `e.textContent.trim() === 'Name'`, 500);
  await click('button', `e.textContent.trim() === 'Sort descending'`, 600);
  log.sorted = await titles();
  const hs = await handleOf(log.sorted[log.sorted.length - 1]);
  const top = await rect('[data-table-drag] [data-row]', `true`);
  await drag([hs.cx, hs.cy], [hs.cx, top.y + 6]);
  log.sortConfirm = await ev(`[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].pop()?.innerText.replace(/\\s+/g, ' ').trim() ?? null`);
  await click('button', `e.textContent.trim() === 'Remove sort'`, 700);
  log.afterRemoveSort = { titles: await titles(), sortArrow: await ev(`[...document.querySelectorAll('[data-column-cell]')].some((c) => c.querySelector('svg + span + span, span > svg') && /Name/.test(c.textContent) && c.querySelectorAll('svg').length > 1)`) };
  await ev(`document.querySelector('[data-table-drag]').closest('[data-db-surface]').querySelector('input[aria-label="Name"]').focus(), true`);
  await key('z', 'KeyZ', 90, 4); await sleep(500);
  log.undoRemoveSort = await titles();
  await key('z', 'KeyZ', 90, 4); await sleep(400); // and the sort itself
  await ev(`document.activeElement?.blur(), true`);

  // ── A grouped table: into another group ──
  const inPanel = `!!e.closest('div[style*="position: fixed"]')`;
  await click('button[aria-label="View settings"]', 'true', 500);
  await click('button', `${inPanel} && e.textContent.trim().startsWith('Group')`, 500);
  await click('button', `${inPanel} && e.textContent.trim() === 'Status'`, 600);
  await key('Escape', 'Escape', 27); await sleep(300);
  log.groups = await ev(`[...document.querySelectorAll('[data-section-head]')].map((h) => h.dataset.sectionHead + ':' + h.dataset.count)`);
  // Bring the groups to the middle of the screen, away from the page's scrolling edge.
  await ev(`[...document.querySelectorAll('[data-section-head]')].find((e) => e.textContent.includes('In progress')).scrollIntoView({ block: 'center' }), true`);
  await sleep(300);
  const hg = await handleOf('Twitter redesign');
  const doneHead = await rect('[data-section-head]', `e.textContent.includes('Done')`);
  const doneRows = await ev(`(() => { const head = [...document.querySelectorAll('[data-section-head]')].find((e) => e.textContent.includes('Done')); const rows = [...document.querySelectorAll('[data-row]')].filter((r) => r.dataset.section === head.dataset.sectionHead); const last = rows[rows.length - 1].getBoundingClientRect(); return { bottom: last.bottom }; })()`);
  log.groupDrag = await drag([hg.cx, hg.cy], [hg.cx, doneRows.bottom - 2], `table-drag-${theme}-group.png`);
  log.afterGroupDrag = await ev(`(() => {
    const row = [...document.querySelectorAll('[data-row]')].find((r) => r.querySelector('input[aria-label="Name"]')?.value === 'Twitter redesign');
    return {
      section: row?.dataset.section ?? null,
      status: row?.querySelector('button[aria-label^="Status"]')?.getAttribute('aria-label') ?? null,
      sections: [...document.querySelectorAll('[data-section-head]')].map((h) => h.dataset.sectionHead + ':' + h.dataset.count + (h.dataset.collapsed === 'true' ? ' (collapsed)' : '')),
      rows: [...document.querySelectorAll('[data-row]')].map((r) => r.dataset.section + ' / ' + r.querySelector('input[aria-label="Name"]')?.value),
    };
  })()`);
  log.doneHead = !!doneHead;

  // ── Phone: no handles, nothing scrolls sideways ──
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(900);
  log.phone = await ev(`(() => { const r = document.querySelector('[data-bleed-root]'); const h = document.querySelector('[data-row-handle]'); return { pageScrollsSideways: r ? r.scrollWidth > r.clientWidth : null, handleDisplay: h ? getComputedStyle(h).display : null }; })()`);
  await shot(`table-drag-${theme}-375.png`);
  log.errors = errors;
} catch (e) {
  log.error = String(e?.stack || e);
  log.errors = errors;
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
