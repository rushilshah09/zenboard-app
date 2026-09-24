// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol: every click, modifier-click and key here is trusted input.
//
// A Collection's tags (COLLECTION_PLAN K7; COLLECTION_VIEW_BRIEF §14–16): a card shows
// its first three and counts the rest; an item's page picks tags and makes new ones;
// a selection tags many at once — a tag every selected item carries is checked, and
// picking it takes it off them all; each is one ⌘Z; the canvas's cards show them too.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-collection-tags.mjs http://localhost:3000 /tmp [light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light'] = process.argv.slice(2);
const PORT = 9395;
const profile = mkdtempSync(join(tmpdir(), 'zb-coll-tags-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
// modifiers: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift
const mouse = (type, x, y, buttons = 0, modifiers = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, modifiers });
async function clickAt(x, y, modifiers = 0) { await mouse('mouseMoved', x, y, 0, modifiers); await mouse('mousePressed', x, y, 1, modifiers); await mouse('mouseReleased', x, y, 0, modifiers); }
async function key(k, code, vk, modifiers = 0) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers }); }
async function type(text) { for (const ch of text) await send('Input.dispatchKeyEvent', { type: 'char', text: ch }); }
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const centre = (sel, test) => ev(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => ${test});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const click = async (sel, test, wait = 500, modifiers = 0) => { const at = await centre(sel, test); if (!at) throw new Error(`nothing to click: ${sel} ${test}`); await clickAt(...at, modifiers); await sleep(wait); };

/** Each card's title and the tags it draws ("+N" included). */
const cardTags = () => ev(`Object.fromEntries([...document.querySelectorAll('[data-collection-item]')].map((c) => [
  c.querySelector('[aria-label]')?.getAttribute('aria-label'),
  [...(c.querySelector('[data-card-tags]')?.children ?? [])].map((t) => t.textContent.trim()),
]))`);
const cardCentre = (title) => centre('[data-collection-item] [aria-label]', `e.getAttribute('aria-label') === ${JSON.stringify(title)}`);
/** The option rows of the open tag picker, with whether each is checked. */
const pickerRows = () => ev(`(() => { const panel = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].pop(); return panel ? [...panel.querySelectorAll('button')].map((b) => b.textContent.trim() + (b.querySelector('svg:last-child') && b.textContent.trim() && b.children.length > 1 ? '' : '')) : null; })()`);
const checkedTags = () => ev(`(() => { const panel = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].pop(); return panel ? [...panel.querySelectorAll('button')].filter((b) => b.querySelectorAll('svg').length > 0 && !/^Create/.test(b.textContent.trim())).map((b) => b.textContent.trim()) : null; })()`);
const barText = () => ev(`document.querySelector('[data-collection-page] [role=toolbar]')?.textContent.replace(/\\s+/g, ' ').trim() ?? null`);
const pageTags = () => ev(`[...document.querySelectorAll('[role=dialog] .rounded-xs')].map((t) => t.textContent.trim())`);

const log = { theme };
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push((msg.params.exceptionDetails?.exception?.description ?? '').slice(0, 300));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') { const d = msg.params.args.map((a) => a.value ?? a.description).join(' '); if (!/script tag/.test(d)) errors.push(d.slice(0, 300)); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zb-theme', ${JSON.stringify(theme)}); } catch {}` });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`[...document.querySelectorAll('button,[role=button],.doc-card')].some((b) => /Brand inspiration/.test(b.textContent) && b.textContent.length < 80)`).catch(() => false)) break; }
  await sleep(500);
  await click('button,[role=button],.doc-card', `/Brand inspiration/.test(e.textContent) && e.textContent.length < 80`, 1200);

  // ── A: cards show their tags, three at most, the rest counted ──
  log.A_cards = await cardTags();
  await shot(`collection-tags-${theme}-grid.png`);

  // ── B: an item's page — make a tag, take one off, one ⌘Z each ──
  await clickAt(...(await cardCentre('Linear — product design'))); await sleep(900);
  log.B_pageTags = await pageTags();
  await click('[role=dialog] button', `/^(Edit|Add) tags$/.test(e.textContent.trim())`, 600);
  log.B_pickerFocus = await ev(`document.activeElement?.getAttribute('placeholder')`);
  await type('Research'); await sleep(250);
  await key('Enter', 'Enter', 13); await sleep(500);
  log.B_afterCreate = await pageTags();
  log.B_checked = await checkedTags();
  // Take "Web" off by picking it.
  await click('[data-radix-popper-content-wrapper] button', `e.textContent.trim() === 'Web'`, 500);
  log.B_afterRemove = await pageTags();
  await shot(`collection-tags-${theme}-item-page.png`);
  await key('Escape', 'Escape', 27); await sleep(300);
  await key('Escape', 'Escape', 27); await sleep(600);
  log.B_dialogClosed = !(await ev(`!!document.querySelector('[role=dialog]')`));
  log.B_card = (await cardTags())['Linear — product design'];
  // ⌘Z: "Web" comes back.
  await ev(`document.activeElement?.blur(), true`);
  await key('z', 'KeyZ', 90, 4); await sleep(400);
  log.B_undo = (await cardTags())['Linear — product design'];

  // ── C: a selection tags many at once ──
  await clickAt(...(await cardCentre('Me at the zoo')), 4); await sleep(300);
  await clickAt(...(await cardCentre('Swiss type on a poster wall')), 4); await sleep(400);
  log.C_bar = await barText();
  await click('[data-collection-page] [role=toolbar] button', `e.textContent.trim() === 'Tag'`, 600);
  await click('[data-radix-popper-content-wrapper] button', `e.textContent.trim() === 'Branding'`, 500);
  const tagged = await cardTags();
  log.C_branded = { zoo: tagged['Me at the zoo'], swiss: tagged['Swiss type on a poster wall'] };
  log.C_checkedShared = await checkedTags();
  // Picking a tag they all carry takes it off them all.
  await click('[data-radix-popper-content-wrapper] button', `e.textContent.trim() === 'Branding'`, 500);
  const untagged = await cardTags();
  log.C_unbranded = { zoo: untagged['Me at the zoo'], swiss: untagged['Swiss type on a poster wall'] };
  // A new tag, made from the selection, goes on both.
  await ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] input')].pop()?.focus(), true`);
  await type('Poster'); await sleep(250);
  await key('Enter', 'Enter', 13); await sleep(500);
  const posters = await cardTags();
  log.C_poster = { zoo: posters['Me at the zoo'], swiss: posters['Swiss type on a poster wall'] };
  await key('Escape', 'Escape', 27); await sleep(400);
  await ev(`document.activeElement?.blur(), true`);
  await key('z', 'KeyZ', 90, 4); await sleep(400);
  const undone = await cardTags();
  log.C_undo = { zoo: undone['Me at the zoo'], swiss: undone['Swiss type on a poster wall'] };
  await key('Escape', 'Escape', 27); await sleep(300);

  // ── D: the canvas draws the same tags ──
  await click('[role=radiogroup][aria-label="Collection layout"] [role=radio]', `e.textContent.trim() === 'Canvas'`, 900);
  log.D_canvasTags = (await cardTags())['React mark — logo reference'];
  await shot(`collection-tags-${theme}-canvas.png`);

  log.errors = errors;
} catch (e) {
  log.error = String(e?.stack || e);
  log.errors = errors;
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
