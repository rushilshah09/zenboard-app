// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol.
//
// One overlay chrome (the user, 2026-09-15, beside the "New ▾" menu: "database uses
// old styling with outline — we have to use new styling"). Opens every kind of panel
// a database has — the views list, a view's menu, view settings, the sort page and
// its menu select, a filter's condition, a column header's menu, a select cell's
// options — and reads each surface's edge, fill, corner and shadow. Every one must
// equal the app's DropdownMenu, and no field inside one may draw the page field's
// double focus ring.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-overlays.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'dark'] = process.argv.slice(2);
const PORT = 9383;
const profile = mkdtempSync(join(tmpdir(), 'zb-overlays-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0, button = 'left') => send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1 });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); }
async function rightClickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, 2, 'right'); await mouse('mouseReleased', x, y, 0, 'right'); }
async function key(k, code, vk) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk }); }
const shot = async (name, clip) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).data, 'base64'));
const centre = (sel, test) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
const click = async (sel, test, wait = 550) => { const at = await centre(sel, test); if (!at) throw new Error('nothing: ' + sel + ' ' + test); await clickAt(...at); await sleep(wait); };

// The chrome of a surface: edge, fill, corner, shadow — and the focus ring of the field in it.
const CHROME = `(el) => { if (!el) return null; const s = getComputedStyle(el); return { border: s.borderTopWidth + ' ' + s.borderTopColor, bg: s.backgroundColor, radius: s.borderTopLeftRadius, shadow: s.boxShadow }; }`;
const chromeOf = (expr) => ev(`(${CHROME})(${expr})`);
/** The newest open floating surface: a Radix popper's content. */
const TOP = `[...document.querySelectorAll('[data-radix-popper-content-wrapper] > *')].pop()`;
const boxOf = (expr) => ev(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: r.width + 32, height: r.height + 32 }; })()`);
const fieldRing = (sel) => ev(`(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return null; f.focus(); const s = getComputedStyle(f); return { shadow: s.boxShadow, outline: s.outlineStyle + ' ' + s.outlineWidth }; })()`);

const log = { theme, surfaces: {} };
const take = async (name, expr = TOP) => {
  log.surfaces[name] = await chromeOf(expr);
  const b = await boxOf(expr);
  if (b) await shot(`overlays-${theme}-${name}.png`, b);
};

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Projects tracker/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 1000);

  // The reference: the app's DropdownMenu (a view tab's menu is one).
  // The tab already chosen: a right-click on another would switch the view away from the table.
  const tab = await centre('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.getAttribute('aria-checked') === 'true'`);
  await rightClickAt(...tab); await sleep(600);
  await take('dropdown', `[...document.querySelectorAll('[data-slot="dropdown-menu-content"]')].pop()`);
  await key('Escape', 'Escape', 27); await sleep(400);

  // The views list, and its search field's focus.
  await click('button', `/^\\d+ more…$/.test(e.textContent.trim())`, 700);
  await take('views-list');
  log.searchFocus = await fieldRing('input[aria-label="Search for a view"]');
  await key('Escape', 'Escape', 27); await sleep(400);

  // View settings.
  await click('button[aria-label="View settings"]', 'true', 700);
  await take('settings');
  log.viewNameFocus = await fieldRing('input[aria-label="View name"]');
  // Its sort page, with a sort, and the property menu select open.
  await click('button', `e.textContent.trim().startsWith('Sort') && !!e.closest('[data-radix-popper-content-wrapper]')`, 500);
  await click('button', `e.textContent.trim() === 'Add sort'`, 500);
  await take('sort-page');
  await click('button[aria-label="Sort property"]', 'true', 600);
  await take('menu-select', `[...document.querySelectorAll('[data-slot="dropdown-menu-content"]')].pop()`);
  log.menuSelectItems = await ev(`[...[...document.querySelectorAll('[data-slot="dropdown-menu-content"]')].pop().querySelectorAll('[role=menuitemradio]')].map((i) => i.textContent.trim() + (i.getAttribute('aria-checked') === 'true' ? ' ✓' : ''))`);
  await key('Escape', 'Escape', 27); await sleep(300);
  log.settingsStillOpen = await ev(`!!document.querySelector('button[aria-label="Sort property"]')`);
  await key('Escape', 'Escape', 27); await sleep(400);
  log.settingsClosed = !(await ev(`!!document.querySelector('button[aria-label="Sort property"]')`));

  // A select cell's options (before a filter hides the rows).
  await click('[data-table-drag] button[aria-label^="Status:"]', 'true', 700);
  await take('select-options');
  await key('Escape', 'Escape', 27); await sleep(300);

  // A filter's condition.
  await click('button[aria-label="Filter"]', 'true', 600);
  await take('filter-picker');
  await click('button', `e.textContent.trim() === 'Status' && !!e.closest('[data-radix-popper-content-wrapper]')`, 700);
  await take('filter-condition');
  log.filterCondition = await ev(`(() => { const p = ${TOP}; return p ? { selects: [...p.querySelectorAll('button[aria-label="Condition"]')].map((b) => b.textContent.trim()), nativeSelects: p.querySelectorAll('select').length } : null; })()`);
  await key('Escape', 'Escape', 27); await sleep(400);

  // A column header's menu.
  await click('[data-column-cell] button', `e.textContent.trim() === 'Tags'`, 700);
  await take('header-menu');
  log.propertyNameFocus = await fieldRing('input[aria-label="Property name"]');
  await key('Escape', 'Escape', 27); await sleep(400);


  const ref = log.surfaces.dropdown;
  log.sameChrome = Object.fromEntries(Object.entries(log.surfaces).map(([k, v]) => [k, !!v && v.border === ref.border && v.bg === ref.bg && v.radius === ref.radius && v.shadow === ref.shadow]));
  log.errors = errors;
} catch (e) {
  log.error = String(e?.stack || e);
  log.errors = errors;
} finally {
  console.log(JSON.stringify(log, null, 1));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL'); await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
