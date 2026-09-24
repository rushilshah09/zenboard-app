// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// Goals on the house card (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 5), on /dev-preview/horizon:
//   A  every goal is the house card (surface-raised, a hairline, radius lg) with ONE progress mark (a 16px glyph —
//      no 52px ring, no bar); a card's text is never faded with opacity
//   B  pressing a goal opens it: Target date, Project (the DS menu select), steps with square boxes, an add line
//   C  a step's box saves; a new step lands in the list and saves
//   D  the ••• is the DS menu; Drop marks the goal Dropped — struck through in ink, the card NOT faded — and saves
//   E  a save the server refuses puts the old state back and says so (Reopen, refused → still Dropped, a toast)
//   F  Project › None unlinks it and saves
//
// Nothing reaches a database: /rest/v1 and /auth/v1 are answered with nothing; every server action is answered in
// React's flight format — `{ ok: true }`, an id for an add, or `{ error }` when refused — its arguments recorded.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-goals.mjs http://localhost:3000 <out-dir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9398;
const profile = mkdtempSync(join(tmpdir(), 'zb-goals-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const saves = [];
let refuseNext = false;
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function clickAt(p) {
  if (!p) throw new Error('nothing to click');
  await mouse('mouseMoved', p[0], p[1]); await sleep(80);
  await mouse('mousePressed', p[0], p[1], 1); await mouse('mouseReleased', p[0], p[1]);
  await sleep(450);
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
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const cardOf = (title) => `[...document.querySelectorAll('article')].find((a) => a.querySelector('.text-h4')?.textContent.trim() === ${JSON.stringify(title)})`;

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
      const refused = refuseNext; refuseNext = false;
      saves.push({ args: args.slice(0, 160), refused });
      // addMilestone(goalId, title) is two strings; everything else here is an update.
      const isAdd = /^\["g\d+","[^"]+"\]$/.test(args);
      const result = refused ? { error: 'The server refused it.' } : isAdd ? { id: `m-new-${++n}` } : { ok: true };
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
  await send('Page.navigate', { url: `${base}/dev-preview/horizon` });
  for (let i = 0; i < 90; i++) { await sleep(300); if (await ev(`document.body.innerText.includes('Ship the rebrand')`).catch(() => false)) break; }
  await sleep(1000);

  // A — the house card, one progress mark
  log.A_cards = await ev(`(() => {
    const probe = (v) => { const s = document.createElement('span'); s.style.background = v; document.body.append(s); const c = getComputedStyle(s).backgroundColor; s.remove(); return c; };
    const raised = probe('var(--color-surface-raised)');
    return [...document.querySelectorAll('article')].map((a) => {
      const cs = getComputedStyle(a);
      return {
        title: a.querySelector('.text-h4')?.textContent.trim(),
        houseCard: cs.backgroundColor === raised && cs.borderTopWidth === '1px' && cs.borderTopLeftRadius === getComputedStyle(document.documentElement).getPropertyValue('--radius-lg').trim(),
        radius: cs.borderTopLeftRadius,
        marks: a.querySelectorAll('[role=progressbar]').length,
        markSize: Math.round(a.querySelector('[role=progressbar]')?.getBoundingClientRect().width ?? 0),
        opacity: cs.opacity,
      };
    });
  })()`);

  // B — open a goal
  await clickAt(await ev(`(() => { const b = ${cardOf('Grow the newsletter to 1,000')}.querySelector('button[aria-expanded]'); const r = b.getBoundingClientRect(); return [r.x + 40, r.y + r.height / 2]; })()`));
  await sleep(400);
  log.B_open = await ev(`(() => { const a = ${cardOf('Grow the newsletter to 1,000')}; return {
    labels: [...a.querySelectorAll('label')].map((l) => l.textContent.trim()).filter((t) => /^(Target date|Project)/.test(t)).map((t) => t.split(/\\s/)[0] === 'Target' ? 'Target date' : 'Project'),
    projectSelect: !!a.querySelector('button[aria-label="Project"][aria-haspopup]'),
    boxes: [...a.querySelectorAll('[role=checkbox]')].map((c) => getComputedStyle(c).borderRadius),
    addStep: !!a.querySelector('input[aria-label="Add a step"]'),
  }; })()`);
  await shot('goals-open.png');

  // C — a step box, and a new step
  let s0 = saves.length;
  await clickAt(await at('[role=checkbox]', `e.getAttribute('aria-label') === 'Mark Write the welcome sequence done'`));
  await sleep(500);
  await clickAt(await at('input[aria-label="Add a step"]'));
  await send('Input.insertText', { text: 'Pick a name' });
  await key('Enter', 'Enter', 13); await sleep(700);
  log.C_steps = { saved: saves.slice(s0).map((x) => x.args), listed: await ev(`[...${cardOf('Grow the newsletter to 1,000')}.querySelectorAll('label span')].map((s) => s.textContent.trim()).filter(Boolean)`) };

  // D — Drop, from the DS menu
  const menuOf = async (title) => { await clickAt(await ev(`(() => { const b = ${cardOf(title)}.querySelector('button[aria-label="Goal actions"]'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`)); await sleep(300); };
  await menuOf('Ship the rebrand');
  log.D_menu = await ev(`[...document.querySelectorAll('[role=menu] [role=menuitem]')].map((e) => e.textContent.trim())`);
  s0 = saves.length;
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Drop'`));
  await sleep(600);
  log.D_dropped = await ev(`(() => { const a = ${cardOf('Ship the rebrand')}; const t = a.querySelector('.text-h4'); return { badge: [...a.querySelectorAll('span')].some((s) => s.textContent.trim() === 'Dropped'), struck: getComputedStyle(t).textDecorationLine, cardOpacity: getComputedStyle(a).opacity }; })()`);
  log.D_saved = saves.slice(s0).map((x) => x.args);

  // E — Reopen, refused: it stays dropped and says so
  await menuOf('Ship the rebrand');
  refuseNext = true;
  await clickAt(await at('[role=menuitem]', `e.textContent.trim() === 'Reopen'`));
  await sleep(900);
  log.E_refused = {
    stillDropped: await ev(`[...${cardOf('Ship the rebrand')}.querySelectorAll('span')].some((s) => s.textContent.trim() === 'Dropped')`),
    toast: await ev(`[...document.querySelectorAll('[data-toaster] > *')].map((t) => t.textContent.replace(/\\s+/g, ' ').trim()).pop() ?? null`),
    saved: saves.slice(-1),
  };

  // F — Project › None
  await clickAt(await ev(`(() => { const b = ${cardOf('Ship the rebrand')}.querySelector('button[aria-expanded]'); const r = b.getBoundingClientRect(); return [r.x + 40, r.y + r.height / 2]; })()`));
  await sleep(400);
  await clickAt(await ev(`(() => { const b = ${cardOf('Ship the rebrand')}.querySelector('button[aria-label="Project"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`));
  await sleep(300);
  s0 = saves.length;
  await clickAt(await at('[role=menuitem],[role=menuitemradio]', `e.textContent.trim() === 'None'`));
  await sleep(600);
  log.F_project = { saved: saves.slice(s0).map((x) => x.args), meta: await ev(`${cardOf('Ship the rebrand')}.querySelector('button[aria-expanded] > span:nth-child(2)')?.textContent.trim() ?? null`) };
  await shot('goals-after.png');

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
