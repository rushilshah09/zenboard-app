// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser. Here it is `:hover`: a crumb's
// only hover is a CSS wash, and only a real pointer produces one.
//
// The trail, 2026-09-14: one quiet pill per crumb (no underline, no caret button),
// the wash held while its menu is open, every menu a list of what is BESIDE the
// crumb under a heading, a place pressed to go and the open page pressed to see
// its siblings, ↓ to open from the keyboard — and a phone gets `… / Current`.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-breadcrumbs.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9341;
const profile = mkdtempSync(join(tmpdir(), 'zb-crumbs-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
async function clickAt(x, y) { for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', buttons: t === 'mousePressed' ? 1 : 0, clickCount: 1 }); }
async function key(k, code, vk) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** Centre of the crumb whose visible text is `label`, or of the "…". */
const crumbAt = (label) => ev(`(() => {
  const nav = document.querySelector('nav[aria-label=Breadcrumb]');
  const el = [...(nav?.querySelectorAll('a,button') ?? [])].find((e) => ${label === '…' ? `/more levels/.test(e.getAttribute('aria-label') || '')` : `e.textContent.replace(/\\s+/g, ' ').trim().endsWith(${JSON.stringify(label)})`});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);

/** What the trail looks like right now, crumb by crumb. */
const readTrail = () => ev(`(() => {
  const nav = document.querySelector('nav[aria-label=Breadcrumb]');
  if (!nav) return null;
  return [...nav.querySelectorAll('ol > li')].map((li) => {
    const el = li.firstElementChild, cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      text: el.textContent.replace(/\\s+/g, ' ').trim() || el.getAttribute('aria-label'),
      tag: el.tagName, current: el.getAttribute('aria-current'), state: el.getAttribute('data-state'),
      h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color, decoration: cs.textDecorationLine, weight: cs.fontWeight,
    };
  });
})()`);

/** The open crumb menu, row by row. */
const readMenu = () => ev(`(() => {
  const menu = document.querySelector('[role=menu][data-state=open]');
  if (!menu) return null;
  return [...menu.querySelectorAll('[data-slot=dropdown-menu-label], [role=menuitem], [role=separator]')].map((e) => {
    const role = e.getAttribute('role') || 'heading';
    if (role === 'separator') return '—';
    const checked = !!e.querySelector('svg[data-check], [data-slot=dropdown-menu-item-check]') || e.getAttribute('data-active') === 'true' || e.classList.contains('bg-surface-hover');
    const sub = e.getAttribute('aria-haspopup') === 'menu';
    return (role === 'heading' ? '# ' : '') + e.textContent.replace(/\\s+/g, ' ').trim() + (checked ? ' ✓' : '') + (sub ? ' >' : '');
  });
})()`);

/** Where the documents view is: the open page's title, or the view's heading. */
const whereAmI = () => ev(`(() => ({ href: location.href, trail: [...document.querySelectorAll('nav[aria-label=Breadcrumb] ol > li')].map((li) => li.firstElementChild.textContent.replace(/\\s+/g, ' ').trim() || li.firstElementChild.getAttribute('aria-label')), heading: document.querySelector('h1')?.textContent.trim() ?? null, header: (document.querySelector('header') ?? document.body).innerText.replace(/\\s+/g, ' ').trim().slice(0, 90) }))()`);

const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  // The theme runtime re-stamps from storage, so the choice is stored before load.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Motion')`).catch(() => false)) break; }
  await sleep(600);

  // Into Motion, then After Effects — with real clicks.
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Motion').setAttribute('data-probe', 'rail'), true`);
  const rail = await ev(`(() => { const r = document.querySelector('[data-probe=rail]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await clickAt(...rail); await sleep(700);
  await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].find((b) => /After Effects/.test(b.textContent) && b.textContent.length < 80).setAttribute('data-probe', 'card'), true`);
  const card = await ev(`(() => { const r = document.querySelector('[data-probe=card]').getBoundingClientRect(); return [r.x + 40, r.y + 20]; })()`);
  await clickAt(...card);
  for (let i = 0; i < 30; i++) { await sleep(200); if (await ev(`!!document.querySelector('nav[aria-label=Breadcrumb]')`)) break; }
  await move(700, 500); await sleep(400);

  log.theme = theme;
  log.pageGround = await ev(`getComputedStyle(document.querySelector('nav[aria-label=Breadcrumb]').closest('header') ?? document.body).backgroundColor`);
  log.atRest = await readTrail();
  log.tabStops = await ev(`document.querySelectorAll('nav[aria-label=Breadcrumb] a, nav[aria-label=Breadcrumb] button').length`);
  await shot(`crumbs-${theme}-rest.png`);

  // Hover a place: the wash before the menu, then the menu itself.
  const motion = await crumbAt('Motion');
  await move(...motion); await sleep(60);
  log.hoverBeforeMenu = { crumb: (await readTrail()).find((c) => c.text === 'Motion'), menuOpen: await ev(`!!document.querySelector('[role=menu]')`) };
  await sleep(450);
  log.hoverMenu = { crumb: (await readTrail()).find((c) => c.text === 'Motion'), rows: await readMenu() };
  await shot(`crumbs-${theme}-hover-menu.png`);

  // Along the trail to the open page: the menubar rule switches at once.
  const current = await crumbAt('After Effects');
  await move(current[0] - 20, current[1]); await sleep(40);
  log.switchedToCurrent = { rows: await readMenu(), motionState: (await readTrail()).find((c) => c.text === 'Motion')?.state };

  // Leaving the trail closes it.
  await move(900, 600); await sleep(500);
  log.afterLeave = { menuOpen: await ev(`!!document.querySelector('[role=menu]')`) };

  // Writing, then crossing the trail: does a hover take the caret away?
  await ev(`(() => { const p = [...document.querySelectorAll('.block-row')].find((b) => b.textContent.trim().length > 30); p?.setAttribute('data-probe', 'para'); return !!p; })()`);
  const para = await ev(`(() => { const r = document.querySelector('[data-probe=para]').getBoundingClientRect(); return [r.x + 60, r.y + r.height / 2]; })()`);
  await clickAt(...para); await sleep(400);
  const editing = () => ev(`(() => { const a = document.activeElement; return { tag: a?.tagName, editable: !!a?.closest('[contenteditable=true]'), inMenu: !!a?.closest('[role=menu]'), crumb: !!a?.closest('nav[aria-label=Breadcrumb]') }; })()`);
  log.focusWhileWriting = await editing();
  await move(...motion); await sleep(500);
  log.focusWithMenuOpenByHover = await editing();
  await move(900, 600); await sleep(500);
  log.focusAfterHoverMenuClosed = await editing();

  // Keyboard: focus a place, ↓ opens, Esc returns, Enter goes.
  await ev(`[...document.querySelectorAll('nav[aria-label=Breadcrumb] a')].find((e) => e.textContent.trim() === 'Learning sources').focus(), true`);
  await key('ArrowDown', 'ArrowDown', 40); await sleep(300);
  log.keyboardOpen = { menuOpen: await ev(`!!document.querySelector('[role=menu]')`), focusInMenu: await ev(`!!document.activeElement?.closest('[role=menu]')`), rows: await readMenu() };
  await key('Escape', 'Escape', 27); await sleep(300);
  log.keyboardEscape = { menuOpen: await ev(`!!document.querySelector('[role=menu]')`), focusBackOnCrumb: await ev(`document.activeElement?.textContent.trim() === 'Learning sources'`) };
  await key('Enter', 'Enter', 13); await sleep(700);
  log.keyboardEnter = { where: await whereAmI(), menuOpen: await ev(`!!document.querySelector('[role=menu][data-state=open]')`) };

  // Back into the page; a real click on a place goes there.
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Motion').setAttribute('data-probe', 'rail2'), true`);
  const rail2 = await ev(`(() => { const r = document.querySelector('[data-probe=rail2]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await clickAt(...rail2); await sleep(600);
  await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].find((b) => /After Effects/.test(b.textContent) && b.textContent.length < 80).setAttribute('data-probe', 'card2'), true`);
  const card2 = await ev(`(() => { const r = document.querySelector('[data-probe=card2]').getBoundingClientRect(); return [r.x + 40, r.y + 20]; })()`);
  await clickAt(...card2); await sleep(700);
  const learning = await crumbAt('Learning sources');
  await clickAt(...learning); await sleep(700);
  log.clickPlace = { where: await whereAmI(), menuOpen: await ev(`!!document.querySelector('[role=menu][data-state=open]')`) };

  // The open page is pressed to see what is beside it, never to "go" to itself.
  await clickAt(...rail2); await sleep(600);
  await clickAt(...card2); await sleep(700);
  await move(900, 600); await sleep(400);
  const cur = await crumbAt('After Effects');
  await clickAt(...cur); await sleep(350);
  log.clickCurrent = { menuOpen: await ev(`!!document.querySelector('[role=menu]')`), rows: await readMenu(), href: await ev('location.href') };
  await key('Escape', 'Escape', 27); await sleep(300);

  // A phone: the whole path behind "…", and the open page's siblings in a sheet.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(900);
  log.phoneTrail = await readTrail();
  const phoneCur = await crumbAt('After Effects');
  if (phoneCur) {
    for (const type of ['touchStart', 'touchEnd']) {
      await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: phoneCur[0], y: phoneCur[1] }] });
    }
    await sleep(700);
    log.phoneSheet = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); return d ? d.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160) : null; })()`);
    await shot(`crumbs-${theme}-phone-sheet.png`);
  }
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
