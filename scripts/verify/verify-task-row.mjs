// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// One task, drawn one way (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 1). Measured on the harnesses:
//   A  Tasks: every row is one height (--row-task), and the Completed disclosure is NOT (control: the ruler can
//      tell two heights apart)
//   B  Tasks: the add line's + sits on the checkboxes' centre line and its word starts where the titles start
//      (control: the word is NOT on the checkboxes' line — the ruler can see a miss)
//   C  Tasks: j moves the keyboard cursor, and the cursor row wears the selected wash
//   D  Tasks: a row's facts read in the one order (project/list/labels · priority · estimate)
//   E  Tasks at 390px: the facts give up their words and keep their glyphs; the title keeps the row
//   F  Focus: the up-next box completes (the row moves to done, checked), a done box reopens it, a subtask box
//      toggles — all square boxes, no circles
//   G  Focus: the add lines' + sit on the checkboxes' centre line
//   H  Home: the plan's rows are one height; the highlight card and the plan row say the same facts
//   I  a project's Tasks tab: the row's ••• carries Open and Highlight, and Move to
//
// Nothing reaches a database: every /rest/v1 and /auth/v1 request is answered here with nothing, and every server
// action is answered `{ ok: true }` in React's flight format (its arguments recorded).
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-task-row.mjs http://localhost:3000 <out-dir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9395;
const profile = mkdtempSync(join(tmpdir(), 'zb-task-row-'));
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
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  e.scrollIntoView({ block: 'nearest' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
async function load(path, text) {
  await send('Page.navigate', { url: `${base}${path}` });
  for (let i = 0; i < 90; i++) { await sleep(300); if (await ev(`document.body.innerText.includes(${JSON.stringify(text)})`).catch(() => false)) break; }
  await sleep(1000);
}
/** The shared task rows on the page: their outer box, checkbox, title and facts, measured. */
const rows = () => ev(`[...document.querySelectorAll('[role=checkbox]')].filter((c) => c.getClientRects().length && !c.closest('[aria-label="Task views"]')).map((c) => {
  const wash = c.parentElement; const outer = wash.parentElement;
  const title = [...wash.children].find((x) => x.tagName === 'BUTTON' && !x.getAttribute('role'));
  const meta = title?.nextElementSibling?.tagName === 'SPAN' ? title.nextElementSibling : null;
  const cb = c.getBoundingClientRect(); const o = outer.getBoundingClientRect(); const t = title?.getBoundingClientRect();
  return {
    title: title?.textContent.trim() ?? null, height: Math.round(o.height), box: { x: cb.x, cx: cb.x + cb.width / 2, w: cb.width, radius: getComputedStyle(c).borderRadius },
    titleX: t ? t.x : null, titleW: t ? Math.round(t.width) : null, rowW: Math.round(o.width),
    facts: meta ? [...meta.children].map((f) => {
      const gone = (e) => getComputedStyle(e).position === 'absolute' && e.getBoundingClientRect().width <= 1;
      return { text: f.textContent.trim(), glyph: !!f.querySelector('svg') || f.tagName === 'svg', factGone: gone(f), wordGone: !![...f.querySelectorAll('span')].find(gone) };
    }) : [],
    wash: getComputedStyle(wash).backgroundColor,
  };
})`);
const addLine = (label) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)} && x.getClientRects().length);
  if (!b) return null;
  const g = b.querySelector('svg').getBoundingClientRect(); const r = b.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(b); const words = [...range.getClientRects()].pop();
  const textNode = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  const tr = document.createRange(); tr.selectNodeContents(textNode); const wx = tr.getBoundingClientRect().x;
  return { glyphCx: g.x + g.width / 2, wordX: wx, height: Math.round(r.height) };
})()`);

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const origin = new URL(base).origin;
  const cors = [{ name: 'access-control-allow-origin', value: origin }, { name: 'access-control-allow-credentials', value: 'true' }, { name: 'access-control-allow-headers', value: '*' }];
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
      saves.push(request.postData ?? '?');
      const reply = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:{"ok":true}\n`;
      void send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(reply).toString('base64') });
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  // The Next.js dev badge sits over the bottom corner in dev only (see verify-task-edit.mjs); hide it.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.append(s); });` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // ── Tasks ──
  await load('/dev-preview/tasks', 'Review the launch checklist');
  const list = await rows();
  const heights = [...new Set(list.map((r) => r.height))];
  const disclosure = await ev(`Math.round([...document.querySelectorAll('button')].find((b) => /^Completed/.test(b.textContent.trim()))?.getBoundingClientRect().height ?? 0)`);
  log.A_heights = { rows: heights, disclosure, pass: heights.length === 1 && heights[0] === 36, controlDiffers: disclosure > 0 && disclosure !== heights[0] };

  const add = await addLine('Add task');
  const box0 = list[0].box; const title0 = list[0].titleX;
  log.B_addLine = {
    glyphOnBoxes: Math.abs(add.glyphCx - box0.cx), wordOnTitles: Math.abs(add.wordX - title0), height: add.height,
    pass: Math.abs(add.glyphCx - box0.cx) <= 0.5 && Math.abs(add.wordX - title0) <= 0.5,
    control_wordNotOnBoxes: Math.abs(add.wordX - box0.x) > 10,
  };
  await shot('row-tasks.png');

  const washBefore = (await rows())[1].wash;
  await ev(`document.activeElement?.blur?.(), document.body.focus?.(), true`);
  await key('j', 'KeyJ', 74); await sleep(250);
  await key('j', 'KeyJ', 74); await sleep(300);
  const afterJ = await rows();
  log.C_cursor = { washes: afterJ.slice(0, 4).map((r) => r.wash), movedTo: afterJ.findIndex((r) => r.wash !== washBefore && r.wash !== 'rgba(0, 0, 0, 0)') };

  log.D_facts = (await rows()).slice(0, 4).map((r) => ({ title: r.title, facts: r.facts.map((f) => f.text) }));

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await load('/dev-preview/tasks', 'Send the deposit invoice');
  const narrow = (await rows()).find((r) => r.title === 'Send the deposit invoice');
  log.E_phone = narrow ? { facts: narrow.facts.map((f) => `${f.text}:${f.factGone ? 'gone' : f.wordGone ? 'glyph' : 'whole'}`), titleShare: +(narrow.titleW / narrow.rowW).toFixed(2) } : null;
  await shot('row-tasks-phone.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // ── Focus ──
  await load('/dev-preview/focus', 'Finish the pricing page copy');
  const boxes = await ev(`[...document.querySelectorAll('[role=checkbox]')].map((c) => ({ name: c.getAttribute('aria-label'), checked: c.getAttribute('aria-checked'), radius: getComputedStyle(c).borderRadius }))`);
  const circles = await ev(`[...document.querySelectorAll('span')].filter((s) => s.getClientRects().length && getComputedStyle(s).borderRadius === '9999px' && Math.round(s.getBoundingClientRect().width) === 15).length`);
  log.F_boxes = { boxes, circles };
  await clickAt(await at('[role=checkbox]', `e.getAttribute('aria-label') === 'Complete Send Balluji the revised timeline'`));
  await sleep(600);
  log.F_completed = await ev(`[...document.querySelectorAll('[role=checkbox]')].filter((c) => /Send Balluji the revised timeline/.test(c.getAttribute('aria-label') ?? '')).map((c) => c.getAttribute('aria-label') + ':' + c.getAttribute('aria-checked'))`);
  await clickAt(await at('[role=checkbox]', `e.getAttribute('aria-label') === 'Mark Reply to the tax email not done'`));
  await sleep(600);
  log.F_reopened = await ev(`[...document.querySelectorAll('[role=checkbox]')].filter((c) => /Reply to the tax email/.test(c.getAttribute('aria-label') ?? '')).map((c) => c.getAttribute('aria-label') + ':' + c.getAttribute('aria-checked'))`);
  await clickAt(await at('[role=checkbox]', `e.getAttribute('aria-label') === 'Mark subtask done'`));
  await sleep(500);
  log.F_subtask = await ev(`[...document.querySelectorAll('[role=checkbox]')].filter((c) => /subtask/.test(c.getAttribute('aria-label') ?? '')).map((c) => c.getAttribute('aria-checked'))`);
  const subBox = await ev(`(() => { const c = [...document.querySelectorAll('[role=checkbox]')].find((c) => /subtask/.test(c.getAttribute('aria-label') ?? '')); const r = c.getBoundingClientRect(); return r.x + r.width / 2; })()`);
  const addSub = await addLine('Add subtask');
  const addTask = await addLine('Add task');
  const upBox = await ev(`(() => { const c = [...document.querySelectorAll('[role=checkbox]')].find((c) => /^Complete /.test(c.getAttribute('aria-label') ?? '') && c.getAttribute('aria-label') !== 'Complete task'); const r = c.getBoundingClientRect(); return r.x + r.width / 2; })()`);
  log.G_focusAddLines = { subtask: Math.abs(addSub.glyphCx - subBox), task: Math.abs(addTask.glyphCx - upBox), pass: Math.abs(addSub.glyphCx - subBox) <= 0.5 && Math.abs(addTask.glyphCx - upBox) <= 0.5 };
  await shot('row-focus.png');

  // ── Home ──
  await load('/dev-preview/home', 'Prepare weekly report');
  const plan = (await rows()).filter((r) => r.title && r.facts);
  log.H_home = {
    heights: [...new Set(plan.map((r) => r.height))],
    planFacts: plan.find((r) => r.title === 'Send invoice for July to TechSpark')?.facts.map((f) => f.text) ?? null,
    highlightFacts: await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Send invoice for July to TechSpark' && !x.closest('[class*=h-\\\\[var\\\\(--row-task\\\\)\\\\]]')); const m = b?.parentElement?.nextElementSibling; return m ? [...m.children].map((c) => c.textContent.trim()) : null; })()`),
  };
  await shot('row-home.png');

  // ── A project's Tasks tab ──
  await load('/dev-preview/projects', 'Balluji rebrand');
  await clickAt(await at('[role=tab]', `e.textContent.trim() === 'Tasks'`));
  await sleep(800);
  const first = (await rows())[0];
  if (first?.title) {
    await hover(await at('button', `e.textContent.trim() === ${JSON.stringify(first.title)}`));
    await clickAt(await at('button[aria-label="Task actions"]', `e.closest('.group')?.textContent.includes(${JSON.stringify(first.title)})`));
    await sleep(400);
    log.I_projectMenu = await ev(`[...document.querySelectorAll('[role=menu] [role=menuitem], [role=menu] [role=group] > *, [role=menu] > div')].map((e) => e.textContent.trim()).filter(Boolean)`);
    await shot('row-project-menu.png');
  } else log.I_projectMenu = null;

  log.consoleErrors = errors.slice(0, 6);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 6);
} finally {
  log.saves = saves.slice(0, 8);
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
