// ── THE WEBSITE, USED ───────────────────────────────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol rather than the in-app browser.
//
// Every interactive part of the home page, driven with real mouse and keyboard
// input (Radix activates a tab on pointer DOWN, so a synthetic .click() proves
// nothing), and every motion rule read back off the running page: the lists turn
// their own pages and stop when the reader takes over, the halftone moves only
// when motion is welcome, and nothing advances by itself when it is not.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-site.mjs http://localhost:3000
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base = 'http://localhost:3000'] = process.argv.slice(2);
const W = 1440;
const H = 900;
const PORT = 9395;
const profile = mkdtempSync(join(tmpdir(), 'zb-site-verify-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const fail = (m) => { errors.push(m); console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const check = (cond, m, got) => (cond ? ok(m) : fail(`${m}${got === undefined ? '' : ` (got ${JSON.stringify(got)})`}`));

/** Scrolls the element into the middle of the window and returns its centre, in viewport pixels. */
const centre = async (js) => ev(`(() => { const el = ${js}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const click = async (p) => {
  await move(p.x, p.y);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
};
const key = async (k, code = k) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: k === 'Enter' ? 13 : 0 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: k === 'Enter' ? 13 : 0 });
};
/** The index of the selected tab in a tab list, found by its accessible name. */
const tab = (label) => `(() => { const l = [...document.querySelectorAll('[role=tablist]')].find((t) => t.getAttribute('aria-label') === ${JSON.stringify(label)}); return l ? [...l.querySelectorAll('[role=tab]')].findIndex((t) => t.getAttribute('aria-selected') === 'true') : -1; })()`;
const tabAt = (label, i) => `[...document.querySelectorAll('[role=tablist]')].find((t) => t.getAttribute('aria-label') === ${JSON.stringify(label)})?.querySelectorAll('[role=tab]')[${i}]`;
/** A hash of what a canvas has drawn, to tell whether it has changed. */
const canvasPrint = (sel) => `(() => { const c = document.querySelector(${JSON.stringify(sel)}); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, ink = 0; for (let i = 3; i < d.length; i += 4) { if (d[i]) { ink++; h = (h * 31 + i * d[i]) % 1000000007; } } return { h, ink }; })()`;

async function open(motion) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }] });
  await send('Page.navigate', { url: base + '/' }); await sleep(3500);
  await ev(`document.documentElement.style.scrollBehavior = 'auto'`);
  await move(5, 5);
}

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (msg.params.exceptionDetails?.exception?.description ?? '').slice(0, 200));
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  // ── Motion welcome ──────────────────────────────────────────────────────
  await open('no-preference');
  console.log('\n── the dashboard ──');
  const live = `document.querySelector('[aria-label="A working preview of Zenboard’s Home"]')`;
  const said = () => ev(`${live}.querySelector('[aria-live]').textContent`);
  check(/3 tasks/.test(await said()), 'Home opens with three tasks to go', await said());
  await click(await centre(`${live}.querySelector('[aria-label="Complete “Send the Ridgeline invoice”"]')`));
  await sleep(300);
  check(/2 tasks/.test(await said()), 'ticking a task counts it down', await said());
  const row = await centre(`[...${live}.querySelectorAll('[aria-label="Highlight this task"]')][0]?.closest('.group')`);
  await move(row.x, row.y); await sleep(200);
  await click(await centre(`[...${live}.querySelectorAll('[aria-label="Highlight this task"]')][0]`));
  await sleep(400);
  check(/Highlight: Finish the logo presentation/.test(await said()), 'the mark beside a task makes it the highlight', await said());

  console.log('\n── the halftone ──');
  const heroCanvas = 'main section canvas';
  await ev('window.scrollTo(0, 0)'); await sleep(600);
  const a1 = await ev(canvasPrint(heroCanvas)); await sleep(1200);
  const a2 = await ev(canvasPrint(heroCanvas));
  check(a1 && a1.ink > 500, 'the hero prints the mark', a1);
  check(a1 && a2 && a1.h !== a2.h, 'and it moves while it is on screen', [a1?.h, a2?.h]);

  console.log('\n── one request, from ask to paid ──');
  const steps = 'One request, step by step';
  await centre(`document.querySelector('#how [role=tabpanel][data-state=active]')`); await move(5, 5);
  check(await ev(tab(steps)) === 0, 'the loop starts at its first step', await ev(tab(steps)));
  const chip = await ev(`(() => { const c = document.querySelector('#how .site-hop'); return c ? getComputedStyle(c).animationName : null; })()`);
  check(/site-hop-x/.test(chip ?? ''), 'a hop travels across on a wide screen', chip);
  await sleep(6800);
  check(await ev(tab(steps)) === 1, 'and turns to the next step by itself', await ev(tab(steps)));
  await click(await centre(tabAt(steps, 2)));
  await move(5, 5); await sleep(2800);
  check(await ev(tab(steps)) === 2, 'choosing a step goes straight to it', await ev(tab(steps)));
  // Radix leaves the inactive panels in place, empty: the one that is showing is the active one.
  const portalSays = await ev(`document.querySelector('#how [role=tabpanel][data-state=active]').textContent`);
  check(/Approved/.test(portalSays) && /INV-022/.test(portalSays), 'and what the step reaches has arrived', portalSays.slice(0, 160));
  check(await ev(`!document.querySelector('#how .site-dwell')`), 'and it stops turning once chosen');
  await sleep(6500);
  check(await ev(tab(steps)) === 2, 'for good', await ev(tab(steps)));

  console.log('\n── a product area ──');
  const day = 'Your day: what it does';
  await centre(`document.querySelector('#day h2')`); await move(5, 5);
  await sleep(6800);
  check(await ev(tab(day)) === 1, 'Your day turns its own page while it is read from afar', await ev(tab(day)));
  const dayPanel = await centre(`document.querySelector('#day [role=tabpanel][data-state=active]')`);
  await move(dayPanel.x, dayPanel.y); await sleep(7000);
  check(await ev(tab(day)) === 1, 'and holds while the pointer is over it', await ev(tab(day)));
  await click(await centre(tabAt(day, 3)));
  await sleep(300);
  check(await ev(tab(day)) === 3, 'choosing a feature shows it', await ev(tab(day)));

  console.log('\n── the demos ──');
  const approve = await centre(`[...document.querySelectorAll('#portal [role=tabpanel][data-state=active] button')].find((b) => b.textContent.trim() === 'Approve')`);
  if (approve) { await click(approve); await sleep(400); }
  check(await ev(`/Approved/.test(document.querySelector('#portal [role=tabpanel][data-state=active]').textContent)`), 'approving as the client marks it approved');
  const create = await centre(`[...document.querySelectorAll('#money [role=tabpanel][data-state=active] button')].find((b) => b.textContent.trim() === 'Create invoice')`);
  if (create) { await click(create); await sleep(400); }
  check(await ev(`/INV-022 · 6h 30m · \\$975\\.00/.test(document.querySelector('#money [role=tabpanel][data-state=active]').textContent)`), 'tracked time becomes an invoice');

  console.log('\n── the details and questions ──');
  await click(await centre(`document.querySelector('#details input[aria-label="Command"]')`));
  await send('Input.insertText', { text: 'fin' }); await sleep(250);
  await key('Enter');
  await sleep(400);
  check(await ev(`/Finance is open/.test(document.querySelector('#details').textContent)`), 'the command palette runs what was typed');
  await click(await centre(`[...document.querySelectorAll('#faq button')].find((b) => /pay invoices online/.test(b.textContent))`));
  await sleep(500);
  check(await ev(`/Not yet/.test(document.querySelector('#faq').textContent)`), 'a question opens to its answer');

  console.log('\n── navigation ──');
  await ev('window.scrollTo(0, 0)'); await sleep(300);
  const trigger = await ev(`(() => { const b = [...document.querySelectorAll('header button')].find((x) => x.textContent.trim() === 'Product'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await move(trigger.x, trigger.y); await sleep(700);
  check(await ev(`!![...document.querySelectorAll('header a')].find((a) => a.textContent.includes('How it fits together') && a.getBoundingClientRect().height > 0)`), 'hovering Product opens its menu');

  // ── Less motion ─────────────────────────────────────────────────────────
  await open('reduce');
  console.log('\n── less motion ──');
  const r1 = await ev(canvasPrint(heroCanvas)); await sleep(1200);
  const r2 = await ev(canvasPrint(heroCanvas));
  check(r1 && r1.ink > 500 && r2 && r1.h === r2.h, 'the halftone is printed once and holds still', [r1?.h, r2?.h]);
  await centre(`document.querySelector('#day h2')`); await move(5, 5);
  await sleep(7000);
  check(await ev(tab(day)) === 0, 'no list turns its own page', await ev(tab(day)));
  const orbit = await ev(`getComputedStyle(document.querySelector('#how .site-orbit')).animationName`);
  check(orbit === 'site-orbit', 'the orbit keeps its (still) twin', orbit);

  console.log(errors.length ? `\n${errors.length} problem(s)` : '\n✓ every part works, and every motion rule holds');
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.exit(errors.length ? 1 : 0);
