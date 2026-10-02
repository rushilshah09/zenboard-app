// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser: a drag needs real, multi-step
// pointer events (the in-app drag is one atomic step dnd-kit never activates on),
// and the board needs a desktop-width window to be a board at all.
//
// The database board, 2026-09-15 (the user: "board view same to same Notion …
// cards draggable like content … user can enter page"): Notion's anatomy in
// Zenboard's tokens, cards carried between and within columns, a card opens its
// page, a column makes a page in place, a column can be hidden and brought back.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-db-board.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9345;
const profile = mkdtempSync(join(tmpdir(), 'zb-dbboard-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' || type === 'mouseMoved' && extra.up ? 0 : type === 'mousePressed' ? 1 : (extra.buttons ?? 0), clickCount: 1, ...extra });
async function clickAt(x, y) { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, { buttons: 1 }); await mouse('mouseReleased', x, y); }
async function key(k, code, vk, text) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); }
async function type(text) { for (const ch of text) await send('Input.dispatchKeyEvent', { type: 'char', text: ch }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** Centre of the first element matching `sel` whose text or label matches, scrolled into view. */
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);

/** The board as it stands: each column's label and card titles, top to bottom. */
const readBoard = () => ev(`(() => [...document.querySelectorAll('[data-board-body]')].map((b) => ({
  column: b.closest('section').getAttribute('aria-label'),
  cards: [...b.querySelectorAll('[data-card] > [role=button]')].map((c) => c.getAttribute('aria-label')),
})))()`);

/** Real drag: press on a card, travel in steps, release over a point. */
async function drag(from, to, { hold } = {}) {
  await mouse('mouseMoved', from[0], from[1]);
  await sleep(60);
  await mouse('mousePressed', from[0], from[1], { buttons: 1 });
  const STEPS = 14;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    await mouse('mouseMoved', from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, { buttons: 1 });
    await sleep(30);
  }
  await sleep(220);
  const mid = hold ? await hold() : null;
  await mouse('mouseReleased', to[0], to[1]);
  await sleep(400);
  return mid;
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
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Projects tracker/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  log.theme = theme;

  await clickAt(...await centre('button,[role=button],.doc-card', `/Projects tracker/.test(e.textContent) && e.textContent.length < 80`));
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('[data-db-surface]')`)) break; }
  await sleep(400);
  await clickAt(...await centre('[role=radiogroup][aria-label="Database views"] [role=radio]', `e.textContent.trim() === 'Board'`));
  for (let i = 0; i < 30; i++) { await sleep(150); if (await ev(`!!document.querySelector('[data-board-body]')`)) break; }
  await sleep(500);
  await ev(`document.querySelector('[data-db-surface]').scrollIntoView({ block: 'start' }), document.querySelector('[data-bleed-root]').scrollBy(0, -140), true`);
  await sleep(300);

  // ── Anatomy ──
  log.anatomy = await ev(`(() => {
    const px = (v) => Math.round(parseFloat(v) * 10) / 10;
    const cols = [...document.querySelectorAll('[data-board-body]')].map((b) => b.closest('section'));
    const first = document.querySelector('[data-card] > [role=button] > div');
    const fcs = first && getComputedStyle(first);
    const title = first?.querySelector('span');
    const head = cols[0]?.querySelector('header');
    const chip = head?.firstElementChild;
    const add = [...cols[1].querySelectorAll('button')].find((b) => b.textContent.trim() === 'New page');
    return {
      columns: cols.map((c) => ({ label: c.getAttribute('aria-label'), width: Math.round(c.getBoundingClientRect().width), bg: getComputedStyle(c).backgroundColor })),
      columnGap: cols.length > 1 ? Math.round(cols[1].getBoundingClientRect().left - cols[0].getBoundingClientRect().right) : null,
      header: head && { height: Math.round(head.getBoundingClientRect().height), chipText: chip?.textContent, chipH: Math.round(chip?.getBoundingClientRect().height ?? 0), chipRadius: chip && getComputedStyle(chip).borderRadius, chipBg: chip && getComputedStyle(chip).backgroundColor, count: head.children[1]?.textContent },
      card: first && { width: Math.round(first.getBoundingClientRect().width), height: Math.round(first.getBoundingClientRect().height), radius: fcs.borderRadius, bg: fcs.backgroundColor, border: fcs.borderTopColor, shadow: fcs.boxShadow, padding: fcs.padding, titleSize: title && getComputedStyle(title).fontSize, titleWeight: title && getComputedStyle(title).fontWeight, titleColor: title && getComputedStyle(title).color, glyph: !!first.querySelector('svg') },
      firstCardInset: first ? Math.round(first.getBoundingClientRect().left - cols[0].getBoundingClientRect().left) : null,
      add: add && { text: add.textContent.trim(), height: Math.round(add.getBoundingClientRect().height), color: getComputedStyle(add).color },
      pageGround: getComputedStyle(document.querySelector('[data-bleed-root]')).backgroundColor,
      pageScrollsSideways: (() => { const r = document.querySelector('[data-bleed-root]'); return r.scrollWidth > r.clientWidth; })(),
    };
  })()`);
  log.before = await readBoard();
  await shot(`dbboard-${theme}-rest.png`);

  // ── Hover: the card's ⋯ and the column's ⋯ + appear only where the pointer is ──
  const hoverCard = await ev(`(() => { const c = [...document.querySelectorAll('[data-card] > [role=button]')].find((x) => x.getAttribute('aria-label') === 'Portfolio site'); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await mouse('mouseMoved', ...hoverCard); await sleep(350);
  log.hover = await ev(`(() => {
    const vis = (el) => el ? getComputedStyle(el).opacity : null;
    const card = [...document.querySelectorAll('[data-card]')].find((x) => x.querySelector('[aria-label="Portfolio site"]'));
    const other = [...document.querySelectorAll('[data-card]')].find((x) => x.querySelector('[aria-label="Invoice automation"]'));
    const head = [...document.querySelectorAll('section header')][0];
    const face = card.querySelector('[role=button] > div');
    return { hoveredMenu: vis(card.querySelector('.reveal-on-hover')), otherMenu: vis(other.querySelector('.reveal-on-hover')), columnActions: vis(head.querySelector('.reveal-on-hover')), hoveredBgImage: getComputedStyle(face).backgroundImage.slice(0, 60) };
  })()`);
  await shot(`dbboard-${theme}-hover-card.png`);

  // ── Carry a card to another column, onto the top ──
  const card = await centre('[data-card] > [role=button]', `e.getAttribute('aria-label') === 'Twitter redesign'`);
  const doneTop = await ev(`(() => { const b = [...document.querySelectorAll('[data-board-body]')].find((x) => /^Done,/.test(x.closest('section').getAttribute('aria-label'))); const c = b.querySelector('[data-card]'); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 6]; })()`);
  log.crossColumn = await drag(card, doneTop, {
    hold: async () => (await shot(`dbboard-${theme}-carrying.png`), ev(`(() => {
      const slot = document.querySelector('[data-board-body] > .border-dashed');
      const col = slot?.closest('section')?.getAttribute('aria-label');
      const body = slot?.parentElement;
      const index = body ? [...body.children].filter((c) => c.matches('[data-card], .border-dashed')).indexOf(slot) : null;
      const overlay = [...document.querySelectorAll('.cursor-grabbing')].pop();
      const origin = [...document.querySelectorAll('[data-card] > [role=button]')].find((c) => c.getAttribute('aria-label') === 'Twitter redesign');
      return { slotIn: col, slotIndex: index, slotHeight: slot && Math.round(slot.getBoundingClientRect().height), overlayWidth: overlay && Math.round(overlay.getBoundingClientRect().width), originOpacity: origin && getComputedStyle(origin).opacity };
    })()`)),
  });
  await shot(`dbboard-${theme}-after-cross.png`);
  log.afterCross = await readBoard();

  // ── Reorder within a column: Mastership branding to the top of Not started ──
  const m = await centre('[data-card] > [role=button]', `e.getAttribute('aria-label') === 'Mastership branding'`);
  const nsTop = await ev(`(() => { const b = [...document.querySelectorAll('[data-board-body]')].find((x) => /^Not started,/.test(x.closest('section').getAttribute('aria-label'))); const c = b.querySelector('[data-card]'); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 4]; })()`);
  log.withinColumn = await drag(m, nsTop, { hold: () => ev(`(() => { const slot = document.querySelector('[data-board-body] > .border-dashed'); return slot ? { slotIn: slot.closest('section').getAttribute('aria-label'), index: [...slot.parentElement.children].filter((c) => c.matches('[data-card], .border-dashed')).indexOf(slot) } : null; })()`) });
  log.afterWithin = await readBoard();

  // ── Undo puts the last move back ──
  await ev(`document.querySelector('[data-db-surface]').dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })), true`);
  await sleep(300);
  log.afterUndo = (await readBoard()).find((c) => /^Not started/.test(c.column));

  // ── A card opens its page ──
  await clickAt(...await centre('[data-card] > [role=button]', `e.getAttribute('aria-label') === 'Portfolio site'`));
  await sleep(700);
  log.openPage = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); return d ? { title: d.getAttribute('aria-label') || d.querySelector('h1,h2')?.textContent, text: d.innerText.replace(/\\s+/g, ' ').slice(0, 140) } : null; })()`);
  await shot(`dbboard-${theme}-peek.png`);
  await key('Escape', 'Escape', 27); await sleep(500);

  // ── A column makes a page in place ──
  await clickAt(...await centre('section button', `e.textContent.trim() === 'New page' && /^In progress,/.test(e.closest('section').getAttribute('aria-label'))`));
  await sleep(250);
  log.newCardFocused = await ev(`document.activeElement?.getAttribute('aria-label')`);
  await type('Launch checklist'); await key('Enter', 'Enter', 13, '\r'); await sleep(250);
  await type('Press kit'); await key('Enter', 'Enter', 13, '\r'); await sleep(250);
  await key('Escape', 'Escape', 27); await sleep(300);
  log.afterAdd = (await readBoard()).find((c) => /^In progress/.test(c.column));

  // ── Hide a column, then bring it back ──
  const doneHeader = await ev(`(() => { const s = [...document.querySelectorAll('section')].find((x) => /^Done,/.test(x.getAttribute('aria-label') || '')); const h = s.querySelector('header'); h.scrollIntoView({ block: 'center', inline: 'center' }); const r = h.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await mouse('mouseMoved', ...doneHeader); await sleep(200);
  await clickAt(...await centre('button[aria-label="Done options"]', 'true'));
  await sleep(400);
  await clickAt(...await centre('[role=menuitem]', `e.textContent.trim() === 'Hide group'`));
  await sleep(400);
  log.hidden = { columns: (await readBoard()).map((c) => c.column), hiddenSection: await ev(`document.querySelector('section[aria-label="Hidden groups"]')?.innerText.replace(/\\s+/g, ' ')`) };
  await shot(`dbboard-${theme}-hidden.png`);
  await clickAt(...await centre('section[aria-label="Hidden groups"] button', 'true'));
  await sleep(400);
  log.shownAgain = (await readBoard()).map((c) => c.column);

  // ── The Group page: Notion's panel — toggles, and every column to move or hide ──
  await key('Escape', 'Escape', 27); await sleep(200);
  await clickAt(...await centre('button[aria-label="View settings"]', 'true'));
  await sleep(400);
  await clickAt(...await centre('button', `/^Group/.test(e.textContent.trim()) && !!e.closest('[style*="position: fixed"]')`));
  await sleep(400);
  const panel = () => ev(`(() => { const p = [...document.querySelectorAll('[style*="position: fixed"]')].find((x) => /Hide empty groups/.test(x.textContent)); return p ? p.innerText.replace(/\s+/g, ' ').trim() : null; })()`);
  log.groupPage = await panel();
  await shot(`dbboard-${theme}-group-page.png`);
  await clickAt(...await centre('label', `e.textContent.trim() === 'Color columns'`));
  await sleep(300);
  log.colorColumnsOff = await ev(`[...document.querySelectorAll('[data-board-body]')].map((b) => getComputedStyle(b.closest('section')).backgroundColor)`);
  await clickAt(...await centre('label', `e.textContent.trim() === 'Color columns'`));
  await sleep(200);
  await clickAt(...await centre('button[aria-label="Hide In progress"]', 'true'));
  await sleep(300);
  log.afterEye = (await readBoard()).map((c) => c.column);
  await clickAt(...await centre('button[aria-label="Show In progress"]', 'true'));
  await sleep(300);
  // Keyboard: lift "Done" by its handle, move it up to the top, drop it.
  await ev(`document.querySelector('button[aria-label="Move Done"]').focus(), true`);
  await key(' ', 'Space', 32, ' '); await sleep(250);
  for (let i = 0; i < 3; i++) { await key('ArrowUp', 'ArrowUp', 38); await sleep(200); }
  await key(' ', 'Space', 32, ' '); await sleep(400);
  log.afterKeyboardReorder = { board: (await readBoard()).map((c) => c.column), panel: await panel() };
  await key('Escape', 'Escape', 27); await sleep(300);

  // ── A phone ──
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(900);
  log.phone = await ev(`(() => { const r = document.querySelector('[data-bleed-root]'); const b = document.querySelector('[data-board-body]')?.closest('section'); return { pageScrollsSideways: r.scrollWidth > r.clientWidth, firstColumn: b && Math.round(b.getBoundingClientRect().left), width: b && Math.round(b.getBoundingClientRect().width) }; })()`);
  await shot(`dbboard-${theme}-375.png`);
} catch (e) {
  log.error = String(e?.stack || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
