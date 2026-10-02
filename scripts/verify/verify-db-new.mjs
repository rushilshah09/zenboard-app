// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// DATABASE_EXPERIENCE_PLAN T7 (toolbar and New), 2026-09-15, with trusted input:
//   A  an inline database's New is secondary — the document owns the primary action
//   B  toolbar New opens the new row the way the view says, caret in its name, and the
//      row starts in "Not started"
//   C  the table's foot "+ New" opens nothing and puts the caret in the new row's Name
//   D  a board column's "+ New" keeps that column — "No Status" included
//   E  a database PAGE's New is its primary button
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-db-new.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9363;
const profile = mkdtempSync(join(tmpdir(), 'zb-dbnew-'));
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
const escape = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
};
const type = (text) => send('Input.insertText', { text });
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

const mode = () => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open');
  if (!d) return 'closed';
  const c = String(d.className);
  if (d.querySelector('[aria-label="Resize panel"]') || /(^|\\s)end-1(\\s|$)/.test(c)) return 'side-peek';
  if (c.includes('left-1/2')) return 'center-peek';
  if (c.includes('inset-0')) return 'full-page';
  return 'unknown';
})()`);
/** Where the caret is: a name field? inside an open page? inside a table row? */
const focus = () => ev(`(() => {
  const a = document.activeElement;
  return { name: a?.classList.contains('zb-db-title') ?? false, inPage: !!a?.closest('[role=dialog]'), inRow: !!a?.closest('.zb-db-row') };
})()`);
/** Centre of the database's toolbar New (the view bar is the surface's first child). */
const toolbarNew = () => ev(`(() => {
  const s = document.querySelector('[data-db-surface]');
  const b = [...s.firstElementChild.querySelectorAll('button')].find((x) => x.textContent.trim() === 'New');
  if (!b) return null;
  b.scrollIntoView({ block: 'center' });
  const r = b.getBoundingClientRect();
  return { at: [r.x + r.width / 2, r.y + r.height / 2], primary: b.className.includes('bg-ink-900') };
})()`);
const boardCol = (heading) => `[...document.querySelector('[data-db-surface] .bleed-x.flex').children].find((c) => (c.firstElementChild?.textContent ?? '').replace(/\\d+\\s*$/, '').trim() === ${JSON.stringify(heading)})`;
const columnNew = (heading) => ev(`(() => {
  const col = ${boardCol(heading)};
  const b = col && [...col.querySelectorAll('button')].find((x) => x.textContent.trim() === 'New');
  if (!b) return null;
  b.scrollIntoView({ block: 'center', inline: 'center' });
  const r = b.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const countIn = (heading) => ev(`(() => { const col = ${boardCol(heading)}; return col ? col.querySelectorAll('[aria-roledescription="draggable"]').length : null; })()`);
const columnOf = (title) => ev(`(() => {
  const board = document.querySelector('[data-db-surface] .bleed-x.flex');
  for (const col of board.children) {
    if ([...col.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(title)})) {
      return col.firstElementChild?.textContent.replace(/\\d+\\s*$/, '').trim() ?? '?';
    }
  }
  return 'none';
})()`);
async function openDoc(title) {
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => b.textContent.includes(${JSON.stringify(title)}) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(600);
  const card = await ev(`(() => { const el = [...document.querySelectorAll('button,[role=button],.doc-card')].find((b) => b.textContent.includes(${JSON.stringify(title)}) && b.textContent.length < 80); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await clickAt(card);
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('[data-db-surface]')`)) break; }
  await sleep(700);
}

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await openDoc('Launch plan');

  // A
  const inlineNew = await toolbarNew();
  log.A_inlineNewIsPrimary = inlineNew?.primary ?? null;

  // B
  const rowsBefore = await ev(`document.querySelector('[data-db-surface]').querySelectorAll('.zb-db-row').length`);
  await clickAt(inlineNew.at); await sleep(700);
  log.B_mode = await mode();
  log.B_focus = await focus();
  await type('Brief the team'); await sleep(500);
  await shot('dbnew-toolbar-new.png');
  await escape(); await sleep(600);
  log.B_rows = [rowsBefore, await ev(`document.querySelector('[data-db-surface]').querySelectorAll('.zb-db-row').length`)];
  log.B_newRow = await ev(`(() => {
    const r = [...document.querySelector('[data-db-surface]').querySelectorAll('.zb-db-row')].find((x) => x.querySelector('.zb-db-title')?.value === 'Brief the team');
    return r ? r.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) : null;
  })()`);

  // C
  const foot = await ev(`(() => {
    const s = document.querySelector('[data-db-surface]');
    const b = [...s.querySelectorAll('button')].filter((x) => !s.firstElementChild.contains(x)).find((x) => x.textContent.trim() === 'New');
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  })()`);
  await clickAt(foot); await sleep(600);
  log.C_mode = await mode();
  log.C_focus = await focus();
  await type('Typed in place'); await sleep(400);
  log.C_rowNamed = await ev(`[...document.querySelector('[data-db-surface]').querySelectorAll('.zb-db-title')].some((i) => i.value === 'Typed in place')`);

  // D
  const boardTab = await ev(`(() => { const r = [...document.querySelector('[data-db-surface]').querySelectorAll('[role=radiogroup][aria-label="Database views"] [role=radio]')].find((e) => e.textContent.trim() === 'Board'); r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  await clickAt(boardTab); await sleep(700);
  log.D_before = { notStarted: await countIn('Not started'), noStatus: await countIn('No Status') };
  await clickAt(await columnNew('No Status')); await sleep(700);
  log.D_noStatusNewOpens = await mode();
  log.D_noStatusFocus = await focus();
  await type('Unsorted idea'); await sleep(400);
  await escape(); await sleep(600);
  await clickAt(await columnNew('Not started')); await sleep(700);
  await type('Queued idea'); await sleep(400);
  await escape(); await sleep(600);
  log.D_after = { notStarted: await countIn('Not started'), noStatus: await countIn('No Status') };
  log.D_unsortedLandsIn = await columnOf('Unsorted idea');
  log.D_queuedLandsIn = await columnOf('Queued idea');

  // E
  await openDoc('Projects tracker');
  log.E_pageNewIsPrimary = (await toolbarNew())?.primary ?? null;
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
