// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol. Here: pages inside pages (the user, 2026-09-15: "all database
// is just bunch of pages like Notion … nested into nested infinite page … user can
// enter page").
//
//   - a Page block in a doc opens its page in Documents;
//   - a board card opens its row as a page; a Page block inside it steps DEEPER in
//     the same peek, with a trail and Back;
//   - `/page` makes a page at once and takes you into it; its name is written in
//     place and the block it left behind says that name;
//   - a database on a page inside a page opens ITS rows deeper still.
//
// The harness has no session, so every server action is answered here with
// `{ ok: true, id }` in React's flight format — the page never waits on the network,
// and a create gets the server id it would have had.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-nested-pages.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9349;
const profile = mkdtempSync(join(tmpdir(), 'zb-nested-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map(); const handlers = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
async function clickAt(x, y) { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }); }
async function key(k, code, vk, text) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); }
async function type(text) { for (const ch of text) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); } }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return [r.x + Math.min(r.width / 2, 120), r.y + r.height / 2];
})()`);
const click = async (sel, test, wait = 450) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at); await sleep(wait); };
/** What the open peek shows: its trail, its page's name, the page lines in its body. */
const readPeek = () => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].pop();
  if (!d) return null;
  const crumbs = [...d.querySelectorAll('nav[aria-label=Breadcrumb] ol > li')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim());
  const title = d.querySelector('textarea[aria-label="Page name"]')?.value ?? null;
  const pageLines = [...d.querySelectorAll('[data-block-id] button')].filter((b) => b.querySelector('.border-b')).map((b) => b.textContent.trim());
  const back = d.querySelector('button[aria-label^="Back"]');
  return { crumbs, title, pageLines, backEnabled: back ? !back.disabled : null, focused: document.activeElement?.getAttribute('aria-label') ?? null };
})()`);

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    else if (msg.method && handlers.has(msg.method)) handlers.get(msg.method)(msg.params);
  };
  await send('Page.enable'); await send('Runtime.enable');
  // Every server action answers `{ ok: true }`; everything else goes through.
  const actions = [];
  handlers.set('Fetch.requestPaused', async (p) => {
    const isAction = p.request.method === 'POST' && Object.keys(p.request.headers).some((h) => h.toLowerCase() === 'next-action');
    if (!isAction) { await send('Fetch.continueRequest', { requestId: p.requestId }); return; }
    actions.push(Object.entries(p.request.headers).find(([h]) => h.toLowerCase() === 'next-action')[1]);
    // `id` too: an action that creates a row answers with the row's server id, and
    // a reply without one is — correctly — treated as a failed create and rolled back.
    const body = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:{"ok":true,"id":"${crypto.randomUUID()}"}\n`;
    await send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(body).toString('base64') });
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Launch plan/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  log.theme = theme;

  // ── 1. A Page block in a doc opens its page in Documents ──
  await click('button,[role=button],.doc-card', `/Launch plan/.test(e.textContent) && e.textContent.length < 80`, 900);
  log.docPageLine = await ev(`(() => { const b = [...document.querySelectorAll('[data-block-id] button')].find((x) => /Launch checklist/.test(x.textContent)); return b ? { text: b.textContent.trim(), underline: getComputedStyle(b.querySelector('.border-b')).borderBottomStyle, height: Math.round(b.getBoundingClientRect().height) } : null; })()`);
  await shot(`nested-${theme}-doc-page-line.png`);
  await click('[data-block-id] button', `/Launch checklist/.test(e.textContent)`, 900);
  log.docOpened = await ev(`({ title: document.querySelector('textarea.doc-title-input')?.value, trail: [...document.querySelectorAll('nav[aria-label=Breadcrumb] ol > li')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim()) })`);

  // ── 1b. `/page` in a doc makes a child page and opens it in Documents; the Page
  //        block it leaves behind survives the switch and says the new name ──
  await click('nav[aria-label=Breadcrumb] a, nav[aria-label=Breadcrumb] button', `/Launch plan/.test(e.textContent)`, 900);
  const firstPara = await ev(`(() => { const r = [...document.querySelectorAll('[data-block-id]')].find((b) => /Everything that has to ship/.test(b.textContent)).getBoundingClientRect(); return [r.x + r.width - 30, r.y + r.height / 2]; })()`);
  await clickAt(...firstPara); await sleep(300);
  await key('End', 'End', 35);
  await key('Enter', 'Enter', 13, '\r'); await sleep(250);
  await type('/page'); await sleep(500);
  await key('Enter', 'Enter', 13, '\r'); await sleep(1200);
  log.docMade = await ev(`({ title: document.querySelector('textarea.doc-title-input')?.value, focus: document.activeElement?.className?.toString().includes('doc-title-input') ? 'title' : document.activeElement?.tagName, trail: [...document.querySelectorAll('nav[aria-label=Breadcrumb] ol > li')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim()) })`);
  await type('Vendor list'); await sleep(900);
  await click('nav[aria-label=Breadcrumb] a, nav[aria-label=Breadcrumb] button', `/Launch plan/.test(e.textContent)`, 1200);
  log.docBack = await ev(`[...document.querySelectorAll('[data-block-id] button')].filter((b) => b.querySelector('.border-b')).map((b) => b.textContent.trim())`);
  await shot(`nested-${theme}-doc-made.png`);

  // ── 2. A card opens its row as a page; a Page block inside steps deeper ──
  await click('button, a', `e.textContent.trim() === 'Draft' && !e.closest('nav[aria-label=Breadcrumb]')`, 900);
  await click('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`, 900);
  await click('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === 'Board'`, 600);
  await click('[data-card] > [role=button]', `e.getAttribute('aria-label') === 'Portfolio site'`, 900);
  log.rowPage = await readPeek();
  await shot(`nested-${theme}-row-page.png`);
  await click('[role=dialog] [data-block-id] button', `/Case studies/.test(e.textContent)`, 700);
  log.level2 = await readPeek();
  await click('[role=dialog] [data-block-id] button', `/TechSpark rebrand/.test(e.textContent)`, 700);
  log.level3 = await readPeek();
  await shot(`nested-${theme}-level3.png`);
  await click('[role=dialog] button[aria-label^="Back"]', 'true', 500);
  log.afterBack = await readPeek();
  await click('[role=dialog] nav[aria-label=Breadcrumb] a, [role=dialog] nav[aria-label=Breadcrumb] button', `e.textContent.trim() === 'Portfolio site'`, 600);
  log.afterCrumb = await readPeek();

  // ── 3. `/page` in the row's body makes a page and steps into it ──
  const lastBlock = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const rows = [...d.querySelectorAll('[data-block-id]')]; const text = rows.filter((r) => !r.querySelector('button .border-b')).pop(); const r = text.getBoundingClientRect(); return [r.x + 80, r.y + r.height / 2]; })()`);
  await clickAt(...lastBlock); await sleep(300);
  await key('End', 'End', 35);
  await key('Enter', 'Enter', 13, '\r'); await sleep(250);
  await type('/page'); await sleep(500);
  log.slashTop = await ev(`[...document.querySelectorAll('[role=listbox][aria-label="Insert a block"] [role=option]')].slice(0, 3).map((o) => o.textContent.replace(/\\s+/g, ' ').trim())`);
  await key('Enter', 'Enter', 13, '\r'); await sleep(900);
  log.madePage = await readPeek();
  await type('Research notes'); await sleep(700);
  log.namedPage = await readPeek();
  await click('[role=dialog] button[aria-label^="Back"]', 'true', 700);
  log.backToRow = await readPeek();
  await shot(`nested-${theme}-made-page.png`);

  // ── 4. A database on a page inside a page opens its own rows deeper still ──
  await click('[role=dialog] [data-block-id] button', `/Research notes/.test(e.textContent)`, 700);
  const body = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const rows = [...d.querySelectorAll('[data-block-id]')]; const r = rows[rows.length - 1].getBoundingClientRect(); return [r.x + 80, r.y + r.height / 2]; })()`);
  await clickAt(...body); await sleep(300);
  await type('/board'); await sleep(500);
  await key('Enter', 'Enter', 13, '\r'); await sleep(1200);
  log.nestedBoard = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); return [...d.querySelectorAll('[data-board-body]')].map((b) => b.closest('section').getAttribute('aria-label')); })()`);
  await click('[role=dialog] section button', `e.textContent.trim() === 'New page' && /^Not started/.test(e.closest('section').getAttribute('aria-label'))`, 400);
  log.newCardFocus = await ev(`document.activeElement?.getAttribute('aria-label')`);
  await type('Interview Ana'); await sleep(200);
  log.newCardValue = await ev(`({ value: document.querySelector('input[aria-label="New page name"]')?.value ?? null, focus: document.activeElement?.getAttribute('aria-label'), tag: document.activeElement?.tagName })`);
  await key('Enter', 'Enter', 13, '\r'); await sleep(300);
  log.afterNewCard = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); return d ? [...d.querySelectorAll('[data-board-body]')].map((b) => [b.closest('section').getAttribute('aria-label'), [...b.querySelectorAll('[data-card] > [role=button]')].map((c) => c.getAttribute('aria-label'))]) : 'no dialog'; })()`);
  await ev(`window.__esc = []; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push(['doc-capture', e.defaultPrevented, e.target.getAttribute && e.target.getAttribute('aria-label')]); }, true); window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push(['win-bubble', e.defaultPrevented]); });`);
  await key('Escape', 'Escape', 27); await sleep(50);
  log.escapeTrace = { events: await ev(`window.__esc`), dialogsNow: await ev(`document.querySelectorAll('[role=dialog]').length`) };
  await sleep(350);
  log.afterEscape = { dialogs: await ev(`document.querySelectorAll('[role=dialog]').length`), focus: await ev(`document.activeElement?.getAttribute('aria-label')`) };
  await click('[role=dialog] [data-card] > [role=button]', `e.getAttribute('aria-label') === 'Interview Ana'`, 900);
  log.level4 = await readPeek();
  await shot(`nested-${theme}-level4.png`);
  log.actionsAnswered = actions.length;
  log.peekCount = await ev(`document.querySelectorAll('[role=dialog]').length`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
