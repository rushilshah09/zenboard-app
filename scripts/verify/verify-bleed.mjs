// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser. Here it is WIDTH: the in-app
// pane is 763px, under the breakpoint where a doc has a text column narrower than
// its page — which is the only place a database's bleed can be seen at all.
//
// The bleed, 2026-09-14 (database brief §3): an inline database's name and
// toolbar stay on the text column; its table or board runs to the page's edges
// with the first column still on the text; nothing else on the page moves, and
// the page never scrolls sideways.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-bleed.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9343;
const profile = mkdtempSync(join(tmpdir(), 'zb-bleed-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
async function clickAt(x, y) { for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', buttons: t === 'mousePressed' ? 1 : 0, clickCount: 1 }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** Centre of the first element matching a predicate over `sel`, tagged for reuse. */
const centreOf = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);

/**
 * Every database surface on the page, measured against the page and the text:
 *   page   — the scroll region's content box (it stops at the scrollbar)
 *   text   — where a paragraph's text starts and ends
 *   name / toolbar — must sit on the text column (plus the block's indent)
 *   scroller — must span the page's content box
 *   first  — the first table column or board column; must start where the
 *            database itself starts
 */
const measure = () => ev(`(() => {
  const root = document.querySelector('[data-bleed-root]');
  if (!root) return { error: 'no bleed root' };
  const rr = root.getBoundingClientRect();
  const page = { left: Math.round(rr.left + root.clientLeft), right: Math.round(rr.left + root.clientLeft + root.clientWidth) };
  const innerOf = (row) => [...row.children].find((c) => c.style.flex.startsWith('1'));
  const para = [...document.querySelectorAll('.block-row')].find((b) => /Everything that has to ship/.test(b.textContent));
  const pin = para && innerOf(para);
  const pcs = pin && getComputedStyle(pin);
  const text = pin ? { left: Math.round(pin.getBoundingClientRect().left + parseFloat(pcs.paddingLeft)), right: Math.round(pin.getBoundingClientRect().right - parseFloat(pcs.paddingRight)) } : null;
  const surfaces = [...document.querySelectorAll('[data-db-surface]')].map((s) => {
    const sr = s.getBoundingClientRect();
    const scroller = s.querySelector(':scope > .bleed-x, :scope > .bleed-x-handles');
    const sc = scroller?.getBoundingClientRect();
    const table = scroller?.firstElementChild?.firstElementChild?.firstElementChild; // header → first cell
    const first = scroller?.classList.contains('flex') ? scroller.firstElementChild : table;
    const name = s.parentElement.querySelector('input[aria-label="Database name"]');
    const bar = s.firstElementChild;
    const cs = scroller && getComputedStyle(scroller);
    return {
      kind: scroller ? (scroller.classList.contains('flex') ? 'board' : 'table') : 'none',
      surface: { left: Math.round(sr.left), right: Math.round(sr.right) },
      name: name ? Math.round(name.getBoundingClientRect().left) : null,
      toolbar: bar ? { left: Math.round(bar.getBoundingClientRect().left), right: Math.round(bar.getBoundingClientRect().right) } : null,
      scroller: sc ? { left: Math.round(sc.left), right: Math.round(sc.right), vars: [cs.getPropertyValue('--bleed-start'), cs.getPropertyValue('--bleed-end')], scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth } : null,
      first: first ? Math.round(first.getBoundingClientRect().left) : null,
    };
  });
  return { viewport: innerWidth, page, text, pageScrollsSideways: root.scrollWidth > root.clientWidth, surfaces };
})()`);

/** The same checks as booleans, so a run reads pass/fail at a glance. */
function judge(m, indents) {
  if (!m?.surfaces) return m;
  return m.surfaces.map((s, i) => ({
    kind: s.kind,
    toolbarOnText: s.toolbar?.left === (m.text?.left ?? NaN) + (indents[i] ?? 0),
    nameOnText: s.name === null || s.name === (m.text?.left ?? NaN) + (indents[i] ?? 0),
    scrollerSpansPage: !s.scroller || (Math.abs(s.scroller.left - m.page.left) <= 1 && Math.abs(s.scroller.right - m.page.right) <= 1),
    firstColumnOnDatabase: s.first === null || s.first === s.surface.left,
  }));
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Launch plan/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(600);

  const card = await centreOf('button,[role=button],.doc-card', `/Launch plan/.test(e.textContent) && e.textContent.length < 80`);
  await clickAt(...card);
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`document.querySelectorAll('[data-db-surface]').length >= 2`)) break; }
  await sleep(700);
  log.theme = theme;
  const INDENT = [0, 22];

  log.desktopTable = await measure();
  log.desktopTableJudged = judge(log.desktopTable, INDENT);
  await ev(`document.querySelector('[data-db-surface]').scrollIntoView({ block: 'start' }), document.querySelector('[data-bleed-root]').scrollBy(0, -120), true`);
  await sleep(300);
  await shot(`bleed-${theme}-1440-table.png`);

  // The first database to Board, with a real click on its view switcher.
  const board = await centreOf('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === 'Board'`);
  await clickAt(...board); await sleep(600);
  log.desktopBoard = await measure();
  log.desktopBoardJudged = judge(log.desktopBoard, INDENT);
  await ev(`document.querySelector('[data-db-surface]').scrollIntoView({ block: 'start' }), document.querySelector('[data-bleed-root]').scrollBy(0, -120), true`);
  await sleep(300);
  await shot(`bleed-${theme}-1440-board.png`);

  // A narrower window: every distance is re-measured, nothing is cached.
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(900);
  log.laptop = await measure();
  log.laptopJudged = judge(log.laptop, INDENT);
  await shot(`bleed-${theme}-1024.png`);

  // A phone: the page still keeps its margin either side of the text (60px,
  // measured 2026-09-15), and the bleed reclaims it — the same rule, re-measured.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(1200);
  log.phone = await measure();
  log.phoneJudged = judge(log.phone, INDENT);
  await shot(`bleed-${theme}-375.png`);

  // The full-page database: the same surface, the same rule.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Projects tracker/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(600);
  const dbCard = await centreOf('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`);
  await clickAt(...dbCard);
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('[data-db-surface]')`)) break; }
  await sleep(700);
  log.fullPage = await ev(`(() => {
    const root = document.querySelector('[data-bleed-root]'); const rr = root.getBoundingClientRect();
    const s = document.querySelector('[data-db-surface]'); const sc = s.querySelector(':scope > .bleed-x, :scope > .bleed-x-handles');
    const first = sc?.firstElementChild?.firstElementChild?.firstElementChild;
    return { page: [Math.round(rr.left + root.clientLeft), Math.round(rr.left + root.clientLeft + root.clientWidth)], surface: [Math.round(s.getBoundingClientRect().left), Math.round(s.getBoundingClientRect().right)], scroller: sc && [Math.round(sc.getBoundingClientRect().left), Math.round(sc.getBoundingClientRect().right)], first: first && Math.round(first.getBoundingClientRect().left), pageScrollsSideways: root.scrollWidth > root.clientWidth };
  })()`);
  await shot(`bleed-${theme}-fullpage.png`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
