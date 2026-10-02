// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser (a drag there is one atomic
// step, and the pane is too narrow for a side peek to survive the viewport veto).
//
// DATABASE_EXPERIENCE_PLAN T6, 2026-09-15, with trusted input only:
//   A  a table row opens the way a table does — side peek
//   B  a board card opens on a click (it could only be dragged before)
//   C  a real drag still moves a card between columns, and opens nothing
//   D  the keyboard reaches the same page (Enter on the card's title)
//   E  the view's own "Open pages in" wins: Center peek → the next card opens centred
//   F  the peek's mode menu offers ONE default, for this view
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-open-pages-in.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9353;
const profile = mkdtempSync(join(tmpdir(), 'zb-openin-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function clickAt(p) {
  if (!p) throw new Error('nothing to click');
  const [x, y] = p;
  await mouse('mouseMoved', x, y); await sleep(60);
  await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y);
}
async function dragFromTo([x0, y0], [x1, y1]) {
  await mouse('mouseMoved', x0, y0); await mouse('mousePressed', x0, y0, 1);
  for (let i = 1; i <= 14; i++) { await mouse('mouseMoved', x0 + ((x1 - x0) * i) / 14, y0 + ((y1 - y0) * i) / 14, 1); await sleep(16); }
  await mouse('mouseReleased', x1, y1);
}
// `text` makes Chrome generate the keypress a real key sends — without it Enter
// never activates a focused button, and the check would fail for the wrong reason.
const key = async (k, code, vk, text) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const escape = () => key('Escape', 'Escape', 27);
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** Which of PageView's three shapes is open (components/ds/ui/page-view.tsx). */
const mode = () => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open');
  if (!d) return 'closed';
  const c = String(d.className);
  if (d.querySelector('[aria-label="Resize panel"]') || /(^|\\s)end-1(\\s|$)/.test(c)) return 'side-peek';
  if (c.includes('left-1/2')) return 'center-peek';
  if (c.includes('inset-0')) return 'full-page';
  return 'unknown';
})()`);

/** Centre of the first match inside `scope` ('surface' = the first database, 'page' = anywhere). */
const centre = (scope, sel, test) => ev(`(() => {
  const root = ${scope === 'surface' ? `document.querySelector('[data-db-surface]')` : 'document'};
  const el = [...root.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const text = `e.textContent.replace(/\\s+/g, ' ').trim()`;

/** The board column a card sits in, by the column's heading. */
const columnOf = (title) => ev(`(() => {
  const board = document.querySelector('[data-db-surface] .bleed-x.flex');
  if (!board) return null;
  for (const col of board.children) {
    if ([...col.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(title)})) {
      return col.firstElementChild?.textContent.replace(/\\d+\\s*$/, '').trim() ?? '?';
    }
  }
  return 'none';
})()`);

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Launch plan/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(600);
  await clickAt(await centre('page', 'button,[role=button],.doc-card', `/Launch plan/.test(e.textContent) && e.textContent.length < 80`));
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`document.querySelectorAll('[data-db-surface]').length >= 2`)) break; }
  await sleep(700);

  // A
  await clickAt(await centre('surface', '[aria-label="Open row"]', 'true')); await sleep(700);
  log.A_tableRow = await mode();
  await escape(); await sleep(500);
  log.A_closedByEscape = await mode();

  // B
  await clickAt(await centre('surface', '[role=radiogroup][aria-label="Database views"] [role=radio]', `${text} === 'Board'`)); await sleep(600);
  await clickAt(await centre('surface', 'button', `${text} === 'Design homepage'`)); await sleep(700);
  log.B_boardCardClick = await mode();
  await shot('openin-board-sidepeek.png');
  await escape(); await sleep(500);

  // C
  log.C_before = await columnOf('Write launch post');
  const from = await centre('surface', 'button', `${text} === 'Write launch post'`);
  const to = await ev(`(() => {
    const board = document.querySelector('[data-db-surface] .bleed-x.flex');
    const done = [...board.children].find((c) => /^Done/.test(c.firstElementChild?.textContent.trim() ?? ''));
    const r = done.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + Math.min(r.height - 16, 70)];
  })()`);
  await dragFromTo(from, to); await sleep(800);
  log.C_after = await columnOf('Write launch post');
  log.C_dragOpenedAPage = await mode();

  // D
  await ev(`[...document.querySelector('[data-db-surface]').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Fix billing bug').focus(), true`);
  await key('Enter', 'Enter', 13, '\r'); await sleep(700);
  log.D_keyboardEnter = await mode();
  await escape(); await sleep(500);

  // E
  await clickAt(await centre('surface', '[aria-label="View settings"]', 'true')); await sleep(400);
  await clickAt(await centre('page', 'button', `/^Layout/.test(${text})`)); await sleep(350);
  log.E_layoutRow = await ev(`[...document.querySelectorAll('button')].map((e) => ${text}).find((s) => /^Open pages in/.test(s)) ?? null`);
  await clickAt(await centre('page', 'button', `/^Open pages in/.test(${text})`)); await sleep(400);
  log.E_options = await ev(`[...document.querySelectorAll('button[aria-pressed]')].map((e) => [${text}, e.getAttribute('aria-pressed')]).filter(([s]) => /peek|page/i.test(s))`);
  await shot('openin-options-light.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await sleep(500);
  await shot('openin-options-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }); await sleep(300);
  await clickAt(await centre('page', 'button[aria-pressed]', `/^Center peek/.test(${text})`)); await sleep(450);
  log.E_pressedAfterPick = await ev(`[...document.querySelectorAll('button[aria-pressed="true"]')].map((e) => ${text}).filter((s) => /peek|page/i.test(s))`);
  await clickAt(await centre('surface', '[aria-label="View settings"]', 'true')); await sleep(400);
  await clickAt(await centre('surface', 'button', `${text} === 'Ship onboarding'`)); await sleep(700);
  log.E_cardAfterCenter = await mode();
  await shot('openin-board-centerpeek.png');

  // F
  await clickAt(await centre('page', '[role=dialog] [aria-label="View mode"]', 'true')); await sleep(450);
  log.F_menu = await ev(`[...document.querySelectorAll('[role=menu] [role=menuitem]')].map((e) => ${text})`);
  const layers = () => ev(`({
    menu: !!document.querySelector('[role=menu]'),
    tooltip: [...document.querySelectorAll('[role=tooltip]')].map((t) => t.textContent.trim()),
    focus: (document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '').slice(0, 30),
  })`);
  await escape(); await sleep(700);
  log.F_afterFirstEscape = [await mode(), await layers()]; // the menu closes; the page stays
  await escape(); await sleep(700);
  log.F_afterSecondEscape = [await mode(), await layers()]; // then the page should close
  await escape(); await sleep(700);
  log.F_afterThirdEscape = [await mode(), await layers()];
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
