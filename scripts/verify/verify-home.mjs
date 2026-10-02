// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// Home — the cards, improved from the inside (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 2, revised on the
// user's word: "I really like that card old Home screen … not remove all"). On /dev-preview/home, trusted input:
//   A  every section is a card whose title is a heading; every list row in every card is ONE height (control: the
//      Completed disclosure is not)
//   B  the highlight card holds the highlight, and the plan is the whole day — it lists that task too
//   C  `j` walks the plan
//   D  the highlight card's star puts the highlight down: the card falls back to its empty state, the task stays in
//      the plan, and the save is sent
//   E  Mark done on the highlight card completes it: Completed counts it, inside the plan's card
//   F  the add line: typing shows the page's one filled button; Enter adds the row and sends the save
//   G  Habits: a tick saves; a hovered row shows Rename/Delete; the card's Add opens the field, Escape puts it away
//   H  Schedule: the now marker is the accent and overlaps no entry; the card's Add opens the field, Escape puts it away
//   I  the day's prompt: the morning card at 09:00 dismisses; the evening card shows at 20:00
//
// Nothing reaches a database: /rest/v1 and /auth/v1 are answered with nothing, every server action `{ ok: true }` or,
// for addTask, an id (its arguments recorded).
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-home.mjs http://localhost:3000 <out-dir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9396;
const profile = mkdtempSync(join(tmpdir(), 'zb-home-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const saves = [];
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
const key = async (k, code, vk) => {
  const text = k === 'Enter' ? '\r' : k.length === 1 ? k : undefined;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text, unmodifiedText: text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
async function load(query = '') {
  await send('Page.navigate', { url: `${base}/dev-preview/home${query}` });
  for (let i = 0; i < 90; i++) { await sleep(300); if (await ev(`document.body.innerText.includes('Prepare weekly report')`).catch(() => false)) break; }
  await sleep(1000);
}
/** A card by its heading. */
const card = (title) => `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === ${JSON.stringify(title)})`;
/** The plan's rows, by title, in order. */
const planTitles = () => ev(`(() => {
  const plan = ${card('Today’s plan')};
  return plan ? [...plan.querySelectorAll('button')].filter((b) => b.closest('.group') && !b.getAttribute('role') && !b.getAttribute('aria-label') && b.parentElement.querySelector('[role=checkbox]') && !b.closest('[data-state=closed]')).map((b) => b.textContent.trim()) : null;
})()`);
/** What the highlight card holds: its task's title, or null when it shows its empty state. */
const highlightCard = () => ev(`(() => {
  const c = ${card('Today’s highlight')};
  if (!c) return 'no card';
  if (c.textContent.includes('No highlight yet')) return null;
  return [...c.querySelectorAll('button')].find((b) => !b.getAttribute('aria-label') && b.textContent.trim() && !/Start focus|Mark done|Details/.test(b.textContent))?.textContent.trim() ?? '?';
})()`);
/** Click a button in a card by its visible text. */
const cardButton = (title, text) => ev(`(() => { const b = [...${card(title)}.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);

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
      // An add answers with an id, as addTask does; every other save answers ok.
      const result = /"title"/.test(args) ? { id: `new-${++n}` } : { ok: true };
      const reply = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify(result)}\n`;
      void send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(reply).toString('base64') });
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.append(s); });` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // A — cards, and one row height inside them
  await load('?h=14');
  log.A_structure = await ev(`(() => {
    const rows = [...document.querySelectorAll('section .group.relative')].filter((r) => r.getClientRects().length).map((r) => Math.round(r.getBoundingClientRect().height));
    const disclosure = [...document.querySelectorAll('button')].find((b) => /^Completed/.test(b.textContent.trim()));
    return {
      cards: [...document.querySelectorAll('section')].map((s) => s.querySelector('h2')?.textContent.trim()).filter(Boolean),
      rowHeights: [...new Set(rows)], rowCount: rows.length,
      disclosure: disclosure ? Math.round(disclosure.getBoundingClientRect().height) : null,
    };
  })()`);
  await shot('home-a.png');

  // B — the highlight card, and the whole day in the plan
  log.B_highlight = { card: await highlightCard(), plan: await planTitles() };

  // C — the cursor walks the plan
  await ev(`document.activeElement?.blur?.(), true`);
  await key('j', 'KeyJ', 74); await sleep(300);
  log.C_cursor = await ev(`(() => { const r = [...document.querySelectorAll('section .group.relative > div')].find((d) => getComputedStyle(d).backgroundColor !== 'rgba(0, 0, 0, 0)' && d.querySelector('[role=checkbox]')); return r ? r.textContent.trim().slice(0, 34) : null; })()`);

  // D — the card's star puts the highlight down
  let s0 = saves.length;
  await clickAt(await ev(`(() => { const b = ${card('Today’s highlight')}.querySelector('button[aria-label="Remove highlight"]'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`));
  await sleep(600);
  log.D_starDown = { card: await highlightCard(), plan: await planTitles(), saved: saves.slice(s0) };

  // E — Mark done on the card
  await load('?h=14');
  s0 = saves.length;
  await clickAt(await cardButton('Today’s highlight', 'Mark done'));
  await sleep(4200);   // the settle beat (lib/use-settling) before a ticked task files into Completed
  log.E_done = {
    card: await highlightCard(),
    completedInPlanCard: await ev(`[...${card('Today’s plan')}.querySelectorAll('button')].find((b) => /^Completed/.test(b.textContent.trim()))?.textContent.replace(/\\s+/g, ' ').trim() ?? null`),
    saved: saves.slice(s0),
  };

  // F — the add line
  await load('?h=14');
  await clickAt(await at('input[aria-label="Add a task to today"]'));
  await send('Input.insertText', { text: 'Call Sam !high 30m' });
  await sleep(400);
  // Computed colours come back as lab()/oklab(), so "filled" is read as a non-transparent ground — the plan's Add
  // while you type — against the header Adds, which are ghost.
  log.F_primary = await ev(`[...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Add' && b.getClientRects().length).map((b) => ({ card: b.closest('section')?.querySelector('h2')?.textContent.trim(), filled: !['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(b).backgroundColor) }))`);
  s0 = saves.length;
  await key('Enter', 'Enter', 13); await sleep(900);
  log.F_added = { plan: await planTitles(), saved: saves.slice(s0).map((x) => x.slice(0, 120)) };

  // G — Habits
  s0 = saves.length;
  await clickAt(await at('[role=checkbox]', `e.getAttribute('aria-label') === 'Check Inbox to zero'`));
  await sleep(500);
  await hover(await at('span', `e.textContent.trim() === 'Read 20 minutes'`));
  log.G_habits = {
    ticked: await ev(`[...document.querySelectorAll('[role=checkbox]')].find((c) => /Inbox to zero/.test(c.getAttribute('aria-label')))?.getAttribute('aria-checked') ?? null`),
    saved: saves.slice(s0),
    hoverActions: await ev(`(() => { const s = [...document.querySelectorAll('span')].find((e) => e.textContent.trim() === 'Read 20 minutes'); const a = s?.parentElement.querySelector('.reveal-on-hover'); return a ? getComputedStyle(a).opacity : null; })()`),
  };
  await clickAt(await cardButton('Habits', 'Add'));
  await sleep(400);
  const habitField = await ev(`document.activeElement?.getAttribute('aria-label')`);
  await key('Escape', 'Escape', 27); await sleep(300);
  log.G_add = { focused: habitField, closedByEscape: !(await ev(`!!document.querySelector('input[aria-label="New habit"]')`)) };

  // H — Schedule
  log.H_now = await ev(`(() => {
    const chip = [...document.querySelectorAll('span')].find((s) => /^\\d\\d:\\d\\d$/.test(s.textContent.trim()) && getComputedStyle(s).borderRadius === '9999px');
    if (!chip) return null;
    const c = chip.getBoundingClientRect();
    const probe = document.createElement('span'); probe.style.background = 'var(--accent)'; document.body.append(probe);
    const accent = getComputedStyle(probe).backgroundColor; probe.remove();
    const texts = [...document.querySelectorAll('section span')].filter((s) => /^\\d\\d:\\d\\d – \\d\\d:\\d\\d$/.test(s.textContent.trim())).map((s) => s.getBoundingClientRect());
    const cardBottom = chip.closest('section').getBoundingClientRect().bottom;
    return { accent: getComputedStyle(chip).backgroundColor === accent, overlapsAnEntry: texts.some((t) => t.bottom > c.top + 1 && t.top < c.bottom - 1 && t.right > c.left && t.left < c.right), roomBelow: Math.round(cardBottom - c.bottom) };
  })()`);
  await clickAt(await cardButton('Schedule', 'Add'));
  await sleep(400);
  const eventField = await ev(`document.activeElement?.getAttribute('aria-label')`);
  await key('Escape', 'Escape', 27); await sleep(300);
  log.H_add = { focused: eventField, closedByEscape: !(await ev(`!!document.querySelector('input[aria-label="New event"]')`)) };
  await shot('home-h.png');

  // I — the day's prompt
  await load('?h=9');
  const morning = await ev(`${card('Plan your day')}?.textContent.trim() ?? null`);
  await clickAt(await ev(`(() => { const b = ${card('Plan your day')}.querySelector('button[aria-label="Dismiss"]'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`));
  await sleep(400);
  log.I_morning = { prompt: morning?.slice(0, 70) ?? null, dismissed: !(await ev(`!!${card('Plan your day')}`)) };
  await load('?h=20');
  log.I_evening = await ev(`${card('Wrap up your day')}?.textContent.trim().slice(0, 70) ?? null`);
  await shot('home-i.png');

  log.consoleErrors = errors.slice(0, 6);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 6);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
