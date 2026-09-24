// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser (a drag must be a real
// multi-step pointer gesture to clear dnd-kit's 4px activation distance).
//
// The Week board on the design system (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 3), on
// /dev-preview/week, trusted input:
//   A  structure: square boxes only; no ghost "Low · Project · Estimate"; no "Open." / "Rest."; no tracked capitals;
//      every column's heading the same height (so every column's cards start on one line); today's column wears the
//      Calendar's `surface-row` whisper and its date sits in the accent circle
//   B  a card OPENS its task (the title sets ?task=)
//   C  a real drag from Unscheduled onto Wednesday moves the card and saves Wednesday's date
//   D  the card's ••• is the house menu (Open · Highlight · Move to · Project · Delete); Move to › Friday moves it
//   E  Project › Balluji files it — the card then names Balluji
//   F  a column's add line speaks the one grammar: "Call Sam !high 30m" → chips, then a card with High and 30m, saved
//      to that column's day
//   G  Delete removes the card and sends the delete
//   H  Unscheduled collapses to its spine and comes back
//   I  at 1280px the days narrow to ~140px: a card's words go to screen readers, its glyphs stay, its ••• leaves the
//      flow
//
// Nothing reaches a database: /rest/v1 and /auth/v1 are answered with nothing; every server action `{ ok: true }` (an
// add, an id), its arguments recorded.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-week.mjs http://localhost:3000 <out-dir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9397;
const profile = mkdtempSync(join(tmpdir(), 'zb-week-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const saves = [];
const urls = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function clickAt(p) {
  if (!p) throw new Error('nothing to click');
  await mouse('mouseMoved', p[0], p[1]); await sleep(80);
  await mouse('mousePressed', p[0], p[1], 1); await mouse('mouseReleased', p[0], p[1]);
  await sleep(450);
}
const hover = async (p) => { if (!p) throw new Error('nothing to hover'); await mouse('mouseMoved', p[0], p[1]); await sleep(350); };
async function drag(from, to) {
  await mouse('mouseMoved', from[0], from[1]); await sleep(60);
  await mouse('mousePressed', from[0], from[1], 1); await sleep(80);
  for (let i = 1; i <= 16; i++) { await mouse('mouseMoved', from[0] + ((to[0] - from[0]) * i) / 16, from[1] + ((to[1] - from[1]) * i) / 16, 1); await sleep(30); }
  await sleep(200);
  await mouse('mouseReleased', to[0], to[1]); await sleep(900);
}
const key = async (k, code, vk) => {
  const text = k === 'Enter' ? '\r' : undefined;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text, unmodifiedText: text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
/** Which column (by its heading) holds the card titled `t`, or null. */
const columnOf = (t) => ev(`(() => {
  const title = [...document.querySelectorAll('[data-task-card-title]')].find((e) => e.textContent.trim() === ${JSON.stringify(t)});
  const list = title?.closest('[role=list]');
  return list ? list.getAttribute('aria-label') : null;
})()`);
const cardFacts = (t) => ev(`(() => {
  const title = [...document.querySelectorAll('[data-task-card-title]')].find((e) => e.textContent.trim() === ${JSON.stringify(t)});
  const meta = title?.nextElementSibling;
  return meta ? [...meta.children].map((c) => c.textContent.trim()) : (title ? [] : null);
})()`);
const menuItems = () => ev(`[...document.querySelectorAll('[role=menu]')].pop() ? [...[...document.querySelectorAll('[role=menu]')].pop().querySelectorAll('[role=menuitem],[role=menuitemradio]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()) : null`);
async function openMenuOf(t) {
  const p = await at('[data-task-card-title]', `e.textContent.trim() === ${JSON.stringify(t)}`);
  await hover(p);
  await clickAt(await at('button[aria-label="Task actions"]', `e.closest('[data-task-card]')?.querySelector('[data-task-card-title]')?.textContent.trim() === ${JSON.stringify(t)}`));
  await sleep(300);
}
async function load(width = 1440) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/dev-preview/week` });
  for (let i = 0; i < 90; i++) { await sleep(300); if (await ev(`document.body.innerText.includes('Book the Q3 tax call')`).catch(() => false)) break; }
  await sleep(1000);
}

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const origin = new URL(base).origin;
  const cors = [{ name: 'access-control-allow-origin', value: origin }, { name: 'access-control-allow-credentials', value: 'true' }, { name: 'access-control-allow-headers', value: '*' }];
  let n = 0;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      const url = request.url;
      if (url.includes('/rest/v1/') || url.includes('/auth/v1/') || url.includes('/storage/v1/')) {
        const r = request.method === 'OPTIONS' ? { responseCode: 204 } : { responseCode: url.includes('/auth/v1/') ? 401 : 200, body: Buffer.from('[]').toString('base64') };
        void send('Fetch.fulfillRequest', { requestId, ...r, responseHeaders: [...cors, { name: 'content-type', value: 'application/json' }] });
        return;
      }
      const isAction = request.method === 'POST' && Object.keys(request.headers).some((h) => h.toLowerCase() === 'next-action');
      if (!isAction) { void send('Fetch.continueRequest', { requestId }); return; }
      const args = request.postData ?? '?';
      saves.push(args);
      const result = /"title"/.test(args) ? { id: `new-${++n}` } : { ok: true };
      const reply = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify(result)}\n`;
      void send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(reply).toString('base64') });
      return;
    }
    if (msg.method === 'Page.navigatedWithinDocument') urls.push(msg.params.url.replace(/^https?:\/\/[^/]+/, ''));
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.append(s); });` });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // A — structure
  await load();
  log.A_structure = await ev(`(() => {
    const txt = document.body.innerText;
    const boxes = [...document.querySelectorAll('[data-task-card] [role=checkbox]')];
    const heads = [...document.querySelectorAll('.week-col')].map((c) => Math.round(c.firstElementChild.getBoundingClientRect().height));
    const probe = (v) => { const s = document.createElement('span'); s.style.background = v; document.body.append(s); const c = getComputedStyle(s).backgroundColor; s.remove(); return c; };
    const today = [...document.querySelectorAll('.week-col')].find((c) => c.querySelector('[aria-label="Today"]'));
    const pill = today?.querySelector('[aria-label="Today"]');
    return {
      cards: document.querySelectorAll('[data-task-card]').length,
      squareBoxes: boxes.every((b) => getComputedStyle(b).borderRadius !== '9999px' && getComputedStyle(b).borderRadius !== '50%'),
      ghosts: ['Estimate', 'Low'].filter((w) => [...document.querySelectorAll('[data-task-card] *')].some((e) => e.children.length === 0 && e.textContent.trim() === w)),
      poetry: /(^|\\n)(Open|Rest)\\.(\\n|$)/.test(txt),
      capitals: /TODAY|MOVE TO/.test(txt),
      headingHeights: [...new Set(heads)],
      todayWash: today ? getComputedStyle(today).backgroundColor === probe('var(--color-surface-row)') : null,
      todayPill: pill ? getComputedStyle(pill).backgroundColor === probe('var(--accent)') : null,
    };
  })()`);
  await shot('week-a.png');

  // B — a card opens its task
  await clickAt(await at('[data-task-card-title]', `e.textContent.trim() === 'Book the Q3 tax call'`));
  await sleep(500);
  log.B_open = await ev(`location.search`);
  await load();

  // C — a real drag, Unscheduled → Wednesday
  const src = await at('[data-task-card-title]', `e.textContent.trim() === 'Look into the font licensing question'`);
  const wed = await at('[role=list]', `e.getAttribute('aria-label') === 'Wednesday tasks'`);
  let s0 = saves.length;
  await drag(src, [wed[0], wed[1] + 60]);
  log.C_drag = { column: await columnOf('Look into the font licensing question'), saved: saves.slice(s0).map((x) => x.slice(0, 160)) };

  // D — the house menu, and Move to › Friday
  await openMenuOf('Draft the weekly update');
  log.D_menu = await menuItems();
  await hover(await at('[role=menuitem]', `e.textContent.trim().startsWith('Move to')`));
  await sleep(350);
  log.D_targets = await menuItems();
  s0 = saves.length;
  await clickAt(await at('[role=menuitem]', `/^Friday/.test(e.textContent.trim())`));
  await sleep(700);
  log.D_moved = { column: await columnOf('Draft the weekly update'), saved: saves.slice(s0).map((x) => x.slice(0, 160)) };

  // E — Project › Balluji
  await openMenuOf('Chase the contract signature');
  await hover(await at('[role=menuitem]', `e.textContent.trim().startsWith('Project')`));
  await sleep(350);
  s0 = saves.length;
  await clickAt(await at('[role=menuitemradio]', `e.textContent.trim() === 'Balluji'`));
  await sleep(700);
  log.E_project = { facts: await cardFacts('Chase the contract signature'), saved: saves.slice(s0).map((x) => x.slice(0, 160)) };

  // F — a column's add line, in the one grammar
  await clickAt(await ev(`(() => { const col = [...document.querySelectorAll('.week-col')].find((c) => c.querySelector('[role=list]')?.getAttribute('aria-label') === 'Thursday tasks'); const b = [...col.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Add task'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`));
  await send('Input.insertText', { text: 'Call Sam !high 30m' });
  await sleep(400);
  const chips = await ev(`[...document.querySelectorAll('.week-col input[aria-label="New task"]')][0]?.closest('div')?.parentElement?.innerText.replace(/\\s+/g, ' ').trim() ?? null`);
  s0 = saves.length;
  await key('Enter', 'Enter', 13); await sleep(900);
  log.F_add = { chips, column: await columnOf('Call Sam'), facts: await cardFacts('Call Sam'), saved: saves.slice(s0).map((x) => x.slice(0, 200)) };
  await key('Escape', 'Escape', 27); await sleep(300);

  // G — Delete
  await openMenuOf('Book the Q3 tax call');
  s0 = saves.length;
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Delete'`));
  await sleep(700);
  log.G_delete = { gone: (await columnOf('Book the Q3 tax call')) === null, saved: saves.slice(s0) };
  await shot('week-after.png');

  // H — collapse and expand Unscheduled
  await clickAt(await at('button[aria-label="Collapse unscheduled"]'));
  await sleep(400);
  const spine = await ev(`!!document.querySelector('button[aria-label="Expand unscheduled"]')`);
  await clickAt(await at('button[aria-label="Expand unscheduled"]'));
  await sleep(400);
  log.H_collapse = { spine, back: await ev(`!!document.querySelector('button[aria-label="Collapse unscheduled"]')`) };

  // I — narrow days: file a card into a project first, so it has a word to put away.
  await load(1280);
  await openMenuOf('Draft the weekly update');
  await hover(await at('[role=menuitem]', `e.textContent.trim().startsWith('Project')`));
  await sleep(350);
  await clickAt(await at('[role=menuitemradio]', `e.textContent.trim() === 'Balluji'`));
  await sleep(700);
  log.I_narrow = await ev(`(() => {
    const col = [...document.querySelectorAll('.week-col')].find((c) => c.querySelector('[role=list]')?.getAttribute('aria-label') === 'Wednesday tasks');
    const card = col?.querySelector('[data-task-card]');
    const words = [...(card?.querySelectorAll('[data-fact-word]') ?? [])].map((w) => getComputedStyle(w).position);
    const menu = card?.querySelector('[data-task-card-menu]');
    return { columnWidth: col ? Math.round(col.getBoundingClientRect().width) : null, wordsGone: words.length ? words.every((p) => p === 'absolute') : 'no words', glyphs: card ? card.querySelectorAll('svg').length : 0, menuOutOfFlow: menu ? getComputedStyle(menu).position : null };
  })()`);
  await shot('week-narrow.png');

  log.consoleErrors = errors.slice(0, 6);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 6);
} finally {
  log.urls = urls.slice(0, 6);
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
