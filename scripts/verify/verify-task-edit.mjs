// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// Editing a task, and filing it under a project (user report 2026-09-19: "There not way to edit task and add
// project in task"). On the tasks harness, which now mounts the task's own panel as AppShell does.
//
// NOTHING REACHES THE REAL DATABASE. The panel reads through the browser Supabase client; every request to
// `/rest/v1/` or `/auth/v1/` is answered here with the harness's own staged tasks, projects and lists, and any
// read this script does not recognise is answered with an empty list rather than let through. Every server
// action is answered in React's flight format and its arguments are RECORDED, so each save is checked for what
// it actually sent — not just for what the screen shows.
//   A  a row's menu reaches every edit: Open · Highlight · Schedule · Project · List · Delete
//   B  Project › Balluji files the task and saves ["t1","p1"]; filed, it leaves the Inbox (that is filing)
//   C  inside Balluji, List › Priority files a task in a list too — its project stays
//   D  Open from the menu opens the task OVER Balluji, and closing it returns to Balluji, not the Inbox
//   E  the panel: a SQUARE box, and Schedule · Project · List chips
//   F  Project offers this space's projects only — never another space's
//   G  picking one files the task and saves it; the chip names it
//   H  a task in a workstream that changes project loses the workstream with it
//   I  "No project" takes it away — and with nowhere else to be, the task goes to the Inbox
//   J  List files it in a list
//   K  Schedule is a real date: Tomorrow, then "No date" — which keeps a filed task out of the Inbox
//   L  a save the server refuses puts the chip back and says so
//   N  the whole row of chips works from the keyboard
//   R  every OTHER edit in the panel is checked too: a refused priority, name, done, label or message puts the
//      old value back and says so — none is kept on screen as if it had saved
//   S  a long name opens whole (not cut to one line); a subtask's box is square and named for the subtask
//   T  the calmer panel (2026-09-21, "so much cluttered"): empty properties fold behind one More chip and a set
//      one never hides; More remembers itself; an empty chip is a ghost and a set one is filled; the header
//      says where the task lives instead of its name again; no "nothing here" sentence is left; and a chip's
//      menu opens again after Escape
//   M  phone width, and dark
//
// The harness must never be left: its rail writes ABSOLUTE `/tasks?…` addresses, so one rail click puts the
// page on the real route and the next navigation lands on /login. Scopes are loaded by address instead.
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-task-edit.mjs http://localhost:3000 /tmp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const PORT = 9391;
const profile = mkdtempSync(join(tmpdir(), 'zb-task-edit-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const errors = [];
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
// Enter carries its text, as a real keystroke does — without it Chrome does not activate a button.
const key = async (k, code, vk) => {
  const text = k === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {};
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const escape = () => key('Escape', 'Escape', 27);
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** The centre of the first visible element matching `selector` that passes `test`. */
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  e.scrollIntoView({ block: 'nearest' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const menuItem = (label) => at('[role=menuitem],[role=menuitemradio]', `e.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(label)})`);
const menuText = () => ev(`[...document.querySelectorAll('[role=menu]')].map((m) => [...m.querySelectorAll('[role=menuitem],[role=menuitemradio]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()))`);
/** The facts of a task row in the list, by its title (the shared TaskRow: title button, then its TaskMeta). */
const rowChips = (title) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(title)} && !x.closest('[role=dialog]'));
  const meta = b?.nextElementSibling;
  return b ? (meta && meta.tagName === 'SPAN' && !meta.querySelector('button') ? [...meta.children].map((c) => c.textContent.trim()).filter(Boolean) : []) : null;
})()`);
const rowMenu = (title) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(title)} && !x.closest('[role=dialog]'));
  const m = b?.parentElement?.querySelector('button[aria-label="Task actions"]');
  if (!m) return null;
  const r = m.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const rowPoint = (title) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(title)} && !x.closest('[role=dialog]'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.x + 40, r.y + 10];
})()`);
/** The panel's chips, in order, as they read. */
const chips = () => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
  if (!d) return null;
  const row = [...d.querySelectorAll('div')].find((x) => getComputedStyle(x).flexWrap === 'wrap' && x.querySelectorAll(':scope > span > button, :scope > button').length >= 3);
  return row ? [...row.querySelectorAll(':scope > span > button, :scope > button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()) : null;
})()`);
const chip = (label) => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
  const b = d && [...d.querySelectorAll('button')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)});
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
const panelRows = (name) => ev(`(() => {
  const p = document.querySelector('[role=dialog][aria-label=${JSON.stringify(name)}]');
  return p ? [...p.querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()) : null;
})()`);
const panelRow = (name, label) => at(`[role=dialog][aria-label=${JSON.stringify(name)}] button`, `e.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}`);
const toasts = () => ev(`[...document.querySelectorAll('[data-sonner-toast], li[role=status], [role=status]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean)`);
async function openTask(id, search = '') {
  const q = new URLSearchParams(search);
  q.set('task', id);
  await send('Page.navigate', { url: `${base}/dev-preview/tasks?${q}` });
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev(`!!document.querySelector('[role=dialog][data-state=open] textarea')`).catch(() => false)) break; }
  await sleep(900);
}
const here = () => ev(`location.pathname + location.search`);
/** The More / Less chip: its state, and a click. */
const moreChip = () => ev(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
  const b = d && [...d.querySelectorAll('button')].find((x) => ['More', 'Less'].includes(x.textContent.replace(/\\s+/g, ' ').trim()));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { text: b.textContent.trim(), expanded: b.getAttribute('aria-expanded'), name: b.getAttribute('aria-label'), at: [r.x + r.width / 2, r.y + r.height / 2] };
})()`);

// ── The staged database: the harness's own tasks, projects and lists (app/dev-preview/tasks/page.dev.tsx) ──
const SPACE = 's1';
const TASKS = [
  { id: 't1', title: 'Review the launch checklist', done: false, priority: 'high', estimate_minutes: 30, scheduled_date: null, is_inbox: true, notes: null, parent_task_id: null, recurrence: null, project_id: null, space_id: SPACE },
  { id: 't2', title: 'Draft the weekly update', done: false, priority: 'low', estimate_minutes: null, scheduled_date: null, is_inbox: true, notes: null, parent_task_id: null, recurrence: null, project_id: null, space_id: SPACE },
  { id: 't3', title: 'Chase the contract signature', done: false, priority: 'low', estimate_minutes: null, scheduled_date: null, is_inbox: false, notes: null, parent_task_id: null, recurrence: null, project_id: 'p1', space_id: SPACE },
  { id: 't4', title: 'Send the deposit invoice', done: false, priority: 'med', estimate_minutes: 20, scheduled_date: null, is_inbox: true, notes: null, parent_task_id: null, recurrence: null, project_id: 'p1', space_id: SPACE },
  // A name long enough to wrap in the panel, and a subtask of some priority under it.
  { id: 't6', title: 'Write the brand guidelines for the autumn launch, with the new type scale and the whole colour story', done: false, priority: 'low', estimate_minutes: null, scheduled_date: null, is_inbox: true, notes: 'First the type.\nThen the colour.\nThen the voice.', parent_task_id: null, recurrence: null, project_id: null, space_id: SPACE },
  { id: 't7', title: 'Draft the type scale', done: false, priority: 'high', estimate_minutes: null, scheduled_date: null, is_inbox: false, notes: null, parent_task_id: 't6', recurrence: null, project_id: null, space_id: SPACE },
];
const PROJECTS = [
  { id: 'p1', name: 'Balluji', color: '#9A1B6F', space_id: SPACE },
  { id: 'p2', name: 'New life', color: '#7B8B5F', space_id: SPACE },
  // Another space's project — must never be offered for a task in s1.
  { id: 'p9', name: 'Other studio', color: '#2B5CB0', space_id: 's2' },
];
const LISTS = [
  { id: 'L1', name: 'Priority', color: '#C88A3B', space_id: SPACE },
  { id: 'L2', name: 'Extra work', color: '#2B5CB0', space_id: SPACE },
];
function answerRead(url) {
  const u = new URL(url);
  const table = u.pathname.split('/rest/v1/')[1];
  const select = u.searchParams.get('select') ?? '';
  if (table === 'tasks' && select.includes('title')) return TASKS;
  if (table === 'tasks' && select.includes('section_id')) return [{ id: 't3', section_id: 'sec1' }];
  if (table === 'tasks' && select.includes('list_id')) return [{ id: 't2', list_id: 'L1' }, { id: 't4', list_id: 'L2' }];
  if (table === 'projects') return PROJECTS;
  if (table === 'task_lists') return LISTS;
  if (table === 'sections') return [{ id: 'sec1', project_id: 'p1', name: 'Design' }];
  if (table === 'labels') return [{ id: 'l1', name: 'Waiting', color: 'ochre' }, { id: 'l2', name: 'Errand', color: 'teal' }];
  if (table === 'task_labels') return [{ task_id: 't1', label_id: 'l2' }];
  return [];   // calendar_events, reminders, task_links, comments, activity, attachments… — empty, never through
}

const log = {};
const saves = [];
const reads = [];
const urls = [];
let refuseNext = false;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Fetch.requestPaused') { void answer(msg.params); return; }
    if (msg.method === 'Page.navigatedWithinDocument' || msg.method === 'Page.frameNavigated') {
      const u = msg.params.url ?? msg.params.frame?.url;
      if (u) urls.push(u.replace(/^https?:\/\/[^/]+/, ''));
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  const origin = new URL(base).origin;
  const cors = [
    { name: 'access-control-allow-origin', value: origin },
    { name: 'access-control-allow-credentials', value: 'true' },
    { name: 'access-control-allow-headers', value: '*' },
    { name: 'access-control-allow-methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
  ];
  async function answer(p) {
    const { request, requestId } = p;
    const url = request.url;
    if (url.includes('/rest/v1/') || url.includes('/auth/v1/') || url.includes('/storage/v1/') || url.includes('/realtime/v1/')) {
      reads.push(`${request.method} ${url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`);
      if (request.method === 'OPTIONS') { await send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors }); return; }
      const auth = url.includes('/auth/v1/');
      const body = auth ? { message: 'no session' } : answerRead(url);
      await send('Fetch.fulfillRequest', {
        requestId, responseCode: auth ? 401 : 200,
        responseHeaders: [...cors, { name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      });
      return;
    }
    const isAction = request.method === 'POST' && Object.keys(request.headers).some((h) => h.toLowerCase() === 'next-action');
    if (!isAction) { await send('Fetch.continueRequest', { requestId }); return; }
    let args = request.postData ?? null;
    if (!args && request.hasPostData) { try { args = (await send('Network.getRequestPostData', { requestId: p.networkId })).postData; } catch { args = '?'; } }
    // A READ that goes through an action answers in its own shape: the panel's file list (`listAttachments`,
    // one owner object) is a list. Everything else here is a save, answered as the real ones answer.
    let parsed = null;
    try { parsed = JSON.parse(args ?? 'null'); } catch { parsed = null; }
    const isFileList = Array.isArray(parsed) && parsed.length === 1 && parsed[0] && typeof parsed[0] === 'object'
      && ('task_id' in parsed[0] || 'page_id' in parsed[0] || 'project_id' in parsed[0]);
    if (isFileList) {
      const reply = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:[]\n`;
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(reply).toString('base64') });
      return;
    }
    const refused = refuseNext;
    refuseNext = false;
    saves.push({ args, refused });
    const result = refused ? { error: 'The server refused it.' } : { ok: true };
    const reply = `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify(result)}\n`;
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: Buffer.from(reply).toString('base64') });
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  // The Next.js dev badge (<nextjs-portal>) sits in the bottom corner — exactly over the task panel's Send button at
  // 1440×900. A click aimed at Send landed on the badge, which Radix rightly read as a press OUTSIDE the panel and
  // closed it (found 2026-09-22: "R_message box: null"). Production has no badge; the harness hides it.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.append(s); });` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.navigate', { url: `${base}/dev-preview/tasks` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`document.body.innerText.includes('Review the launch checklist')`).catch(() => false)) break; }
  await sleep(1200);

  // A — the row's menu
  await hover(await rowPoint('Review the launch checklist'));
  await clickAt(await rowMenu('Review the launch checklist'));
  log.A_menu = (await menuText())[0] ?? null;
  // What a screen reader hears, from Chrome's accessibility tree — textContent jams the value onto the word.
  const axName = async (label) => {
    const r = await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('[role=menuitem]')].find((e) => e.textContent.trim().startsWith(${JSON.stringify(label)}))` });
    if (!r.result?.objectId) return null;
    const ax = await send('Accessibility.getPartialAXTree', { objectId: r.result.objectId, fetchRelatives: false });
    return ax.nodes?.find((n) => n.role?.value === 'menuitem')?.name?.value ?? null;
  };
  log.A_axNames = { schedule: await axName('Schedule'), project: await axName('Project'), list: await axName('List') };

  // B — Project › Balluji, from the row
  await hover(await menuItem('Project'));
  await sleep(300);
  log.B_projects = (await menuText())[1] ?? null;
  const before = saves.length;
  await clickAt(await menuItem('Balluji'));
  await sleep(900);
  log.B_saved = saves.slice(before).map((x) => x.args);
  // Filed is out of the Inbox — that is what filing means.
  log.B_leftInbox = !(await ev(`document.body.innerText.includes('Review the launch checklist')`));

  // C — inside Balluji (loaded by address; the rail would leave the harness): a list, and the project stays
  await send('Page.navigate', { url: `${base}/dev-preview/tasks?scope=project%3Ap1` });
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev(`document.body.innerText.includes('Chase the contract signature')`).catch(() => false)) break; }
  await sleep(1000);
  log.C_scope = await here();
  await hover(await rowPoint('Chase the contract signature'));
  await clickAt(await rowMenu('Chase the contract signature'));
  await hover(await menuItem('List'));
  await sleep(300);
  const c0 = saves.length;
  await clickAt(await menuItem('Priority'));
  await sleep(900);
  log.C_rowChips = await rowChips('Chase the contract signature');
  log.C_saved = saves.slice(c0).map((x) => x.args);

  // D — Open, over Balluji; close, and Balluji is still there
  await hover(await rowPoint('Send the deposit invoice'));
  await clickAt(await rowMenu('Send the deposit invoice'));
  await clickAt(await menuItem('Open'));
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('[role=dialog][data-state=open] textarea')`)) break; }
  await sleep(900);
  log.D_open = { at: await here(), title: await ev(`document.querySelector('[role=dialog][data-state=open] textarea')?.value ?? null`) };
  await escape(); await sleep(900);
  log.D_closed = { at: await here(), stillBalluji: await ev(`document.body.innerText.includes('Chase the contract signature') && !document.body.innerText.includes('Review the launch checklist')`) };

  // E — the panel of t1
  await openTask('t1');
  log.E_at = await here();
  log.E_chips = await chips();
  log.E_box = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const b = d?.querySelector('[role=checkbox]');
    return b ? { role: 'checkbox', radius: getComputedStyle(b).borderRadius, size: Math.round(b.getBoundingClientRect().width) } : null;
  })()`);
  await shot('task-panel-light.png');

  // F — this space's projects only
  await clickAt(await chip('Project'));
  log.F_offered = await panelRows('Project');

  // G — file it
  let n = saves.length;
  await clickAt(await panelRow('Project', 'New life'));
  await sleep(900);
  log.G_chips = await chips();
  log.G_saved = saves.slice(n).map((x) => x.args);

  // H — t3 is in Balluji's "Design" workstream; moving it takes it out of the workstream too
  await openTask('t3');
  log.H_before = await chips();
  n = saves.length;
  await clickAt(await chip('Balluji'));
  await clickAt(await panelRow('Project', 'New life'));
  await sleep(900);
  log.H_after = await chips();
  log.H_saved = saves.slice(n).map((x) => x.args);

  // I — and "No project" takes it away
  n = saves.length;
  await clickAt(await chip('New life'));
  log.I_offered = await panelRows('Project');
  await clickAt(await panelRow('Project', 'No project'));
  await sleep(900);
  log.I_chips = await chips();
  log.I_saved = saves.slice(n).map((x) => x.args);

  // J — a list (folded while the task has none: More first)
  n = saves.length;
  log.J_more = await moreChip();
  await clickAt(log.J_more.at);
  await clickAt(await chip('List'));
  await clickAt(await panelRow('List', 'Priority'));
  await sleep(900);
  log.J_chips = await chips();
  log.J_saved = saves.slice(n).map((x) => x.args);

  // K — a real date, then no date (t3 is in a list now, so it must stay out of the Inbox)
  n = saves.length;
  await clickAt(await chip('Schedule'));
  await sleep(400);
  log.K_picker = await ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] button')].map((b) => b.textContent.trim()).filter((t) => t && t.length < 16).slice(0, 6)`);
  await clickAt(await at('[data-radix-popper-content-wrapper] button', `e.textContent.trim() === 'Tomorrow'`));
  await sleep(900);
  log.K_tomorrow = await chips();
  await clickAt(await chip('Tomorrow'));
  await sleep(400);
  await clickAt(await at('[data-radix-popper-content-wrapper] button', `e.textContent.trim() === 'No date'`));
  await sleep(900);
  log.K_noDate = await chips();
  log.K_saved = saves.slice(n).map((x) => x.args);

  // L — the server refuses: the chip goes back and a toast says so
  refuseNext = true;
  await clickAt(await chip('Project'));
  await clickAt(await panelRow('Project', 'Balluji'));
  await sleep(1500);
  log.L_chips = await chips();
  log.L_toast = (await toasts()).slice(-1)[0] ?? null;
  log.L_refused = saves.slice(-1)[0] ?? null;

  // N — the keyboard: Tab to a chip, Enter opens it, ↓ moves, Enter picks, Escape comes back to the chip
  await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea')); [...d.querySelectorAll('button')].find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === 'Project')?.focus(); return true; })()`);
  await key('Enter', 'Enter', 13); await sleep(500);
  log.N_focusInPanel = await ev(`document.activeElement?.closest('[role=dialog][aria-label="Project"]') ? document.activeElement.textContent.replace(/\\s+/g, ' ').trim() : null`);
  await key('ArrowDown', 'ArrowDown', 40); await sleep(150);
  log.N_moved = await ev(`document.activeElement?.textContent.replace(/\\s+/g, ' ').trim() ?? null`);
  const k0 = saves.length;
  await key('Enter', 'Enter', 13); await sleep(900);
  log.N_chips = await chips();
  log.N_saved = saves.slice(k0).map((x) => x.args);
  log.N_focusBack = await ev(`document.activeElement?.textContent.replace(/\\s+/g, ' ').trim() ?? null`);

  // R — the panel's other edits, refused one at a time
  await openTask('t1');
  const priorityChip = async () => ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const b = d && [...d.querySelectorAll('button')].find((x) => ['High', 'Medium', 'Low'].includes(x.textContent.replace(/\\s+/g, ' ').trim()));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { label: b.textContent.trim(), at: [r.x + r.width / 2, r.y + r.height / 2] };
  })()`);
  let pc = await priorityChip();
  refuseNext = true;
  await clickAt(pc.at);
  await clickAt(await panelRow('Priority', 'Medium'));
  await sleep(1300);
  log.R_priority = { before: pc.label, after: (await priorityChip())?.label, toast: (await toasts()).slice(-1)[0] ?? null };

  // The name: select it all, type another, leave the field — refused, the old name comes back.
  refuseNext = true;
  await ev(`(() => { const t = document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]'); t.focus(); t.select(); return true; })()`);
  await send('Input.insertText', { text: 'A name the server will refuse' });
  await ev(`(document.activeElement.blur(), true)`);
  await sleep(1300);
  log.R_name = await ev(`document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]')?.value ?? null`);

  // Done, refused: the box is empty again.
  refuseNext = true;
  await clickAt(await at('[role=dialog][data-state=open] [role=checkbox]', `e.getAttribute('aria-label') === 'Mark done'`));
  await sleep(1300);
  log.R_done = await ev(`document.querySelector('[role=dialog][data-state=open] [role=checkbox]')?.getAttribute('aria-checked') ?? null`);

  // Escape inside a chip's panel closes that panel and nothing else — the task stays open, focus on the chip.
  await clickAt((await priorityChip()).at);
  log.R_escape_before = await ev(`!!document.querySelector('[role=dialog][aria-label="Priority"]')`);
  await escape(); await sleep(600);
  log.R_escape_after = await ev(`({ chipPanel: !!document.querySelector('[role=dialog][aria-label="Priority"]'), task: !!document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]'), focus: document.activeElement?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 20) ?? null })`);
  if (!log.R_escape_after.task) await openTask('t1');

  // A label, refused: t1 carries Errand; taking it off is refused, so Errand is still there. Reached the way that
  // broke (2026-09-21): open the Labels menu, Escape out of it, click the chip again — the hand changes from the
  // keyboard to the pointer, which used to replay the panel's slide-in under the press and lose the click.
  await openTask('t1');
  await clickAt(await chip('Errand'));
  log.R_labelsFirst = await ev(`!!document.querySelector('[role=dialog][aria-label="Labels"]')`);
  await escape(); await sleep(400);
  log.R_labelsClosed = !(await ev(`!!document.querySelector('[role=dialog][aria-label="Labels"]')`));
  await clickAt(await chip('Errand'));
  log.R_labelsAgain = await ev(`!!document.querySelector('[role=dialog][aria-label="Labels"]')`);
  log.R_panelStayed = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.querySelector('textarea')); return d ? Math.round(d.getBoundingClientRect().right) <= innerWidth : null; })()`);
  refuseNext = true;
  await clickAt(await at('[role=dialog][aria-label="Labels"] button', `e.textContent.trim() === 'Errand'`));
  await sleep(1300);
  await escape(); await sleep(300);
  log.R_label = (await chips())?.includes('Errand') ?? null;

  // A toast rises BESIDE the open side panel, not over its message box — and pressing it leaves the panel open.
  log.R_toastBeside = await ev(`(() => {
    const toast = [...document.querySelectorAll('[data-toaster] > *')].pop();
    const panel = [...document.querySelectorAll('[role=dialog]')].find((d) => d.getAttribute('data-state') === 'open' && d.querySelector('textarea'));
    if (!toast || !panel) return null;
    const t = toast.getBoundingClientRect(); const p = panel.getBoundingClientRect();
    return { toastRight: Math.round(t.right), panelLeft: Math.round(p.left), clear: t.right <= p.left };
  })()`);
  const toastPoint = await ev(`(() => { const t = [...document.querySelectorAll('[data-toaster] > *')].pop(); if (!t) return null; const r = t.getBoundingClientRect(); return [r.x + 24, r.y + r.height / 2]; })()`);
  if (toastPoint) {
    await clickAt(toastPoint);
    await sleep(500);
    log.R_toastPressKeepsPanel = await ev(`!!document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]')`);
  }

  // A message, refused: it leaves the thread and its words come back to the box.
  refuseNext = true;
  await clickAt(await at('[role=dialog][data-state=open] input[placeholder="Leave a message…"]'));
  await send('Input.insertText', { text: 'Can we move this to Thursday?' });
  await clickAt(await at('[role=dialog][data-state=open] button[aria-label="Send"]'));
  await sleep(1300);
  log.R_message = await ev(`({ box: document.querySelector('[role=dialog][data-state=open] input[placeholder="Leave a message…"]')?.value ?? null, inThread: document.querySelector('[role=dialog][data-state=open]')?.textContent.includes('Can we move this to Thursday?') && !document.querySelector('[role=dialog][data-state=open] input[placeholder="Leave a message…"]')?.value })`);

  // And a priority that is NOT refused still saves, so the check proves both halves.
  n = saves.length;
  pc = await priorityChip();
  await clickAt(pc.at);
  await clickAt(await panelRow('Priority', 'Low'));
  await sleep(900);
  log.R_savesWhenAllowed = { chip: (await priorityChip())?.label, saved: saves.slice(n).map((x) => x.args) };

  // S — a long name, notes of three lines, and a subtask
  await openTask('t6');
  log.S_name = await ev(`(() => {
    const t = document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]');
    const line = parseFloat(getComputedStyle(t).lineHeight) || 0;
    return { height: Math.round(t.getBoundingClientRect().height), line: Math.round(line), whole: t.scrollHeight <= t.clientHeight + 1 };
  })()`);
  log.S_notes = await ev(`(() => { const t = document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Description"]'); return { whole: t.scrollHeight <= t.clientHeight + 1, height: Math.round(t.getBoundingClientRect().height) }; })()`);
  log.S_subtask = await ev(`(() => {
    const b = [...document.querySelectorAll('[role=dialog][data-state=open] [role=checkbox]')].find((x) => (x.getAttribute('aria-label') || '').includes('Draft the type scale'));
    if (!b) return null;
    const s = getComputedStyle(b);
    return { name: b.getAttribute('aria-label'), radius: s.borderRadius, edge: s.borderTopColor, size: Math.round(b.getBoundingClientRect().width) };
  })()`);
  // Focus reveals the row's hidden add button — read after its 100ms fade, not in the same tick as the focus.
  log.S_addSubtask = await ev(`(async () => {
    const b = [...document.querySelectorAll('[role=dialog][data-state=open] button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Add a subtask to'));
    if (!b) return null;
    b.focus();
    await new Promise((r) => setTimeout(r, 250));
    return { name: b.getAttribute('aria-label'), shownOnFocus: getComputedStyle(b).opacity };
  })()`);
  // With a subtask above it, the add line is the tree's next row: its + over the box column, its words on the names.
  log.S_treeAddLine = await ev(`(() => {
    const d = document.querySelector('[role=dialog][data-state=open]');
    const input = d.querySelector('input[aria-label="Add a subtask"]');
    const glyph = input?.parentElement.querySelector('svg');
    const box = [...d.querySelectorAll('[role=checkbox]')].find((x) => (x.getAttribute('aria-label') || '').includes('Draft the type scale'));
    const name = [...d.querySelectorAll('span')].find((x) => x.textContent === 'Draft the type scale');
    if (!input || !glyph || !box || !name) return null;
    const x = (e) => Math.round(e.getBoundingClientRect().left * 10) / 10;
    return { glyph: x(glyph), box: x(box), words: x(input), names: x(name), nameSize: getComputedStyle(name).fontSize, wordSize: getComputedStyle(input).fontSize };
  })()`);
  await shot('task-panel-long.png');
  // An emptied name is not a rename: leaving the field puts the old name back, and nothing is saved.
  const savesBeforeEmpty = saves.length;
  await ev(`(() => { const t = document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]'); t.focus(); t.select(); return true; })()`);
  await key('Backspace', 'Backspace', 8);
  log.S_emptyWhileTyping = await ev(`(() => { const t = document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]'); return { value: t.value, placeholder: getComputedStyle(t, '::placeholder').color }; })()`);
  await key('Tab', 'Tab', 9);
  await sleep(400);
  log.S_emptyName = {
    value: await ev(`document.querySelector('[role=dialog][data-state=open] textarea[aria-label="Task name"]')?.value ?? null`),
    saved: saves.slice(savesBeforeEmpty).map((x) => x.args),
  };

  // T — the calmer panel
  await ev(`(localStorage.removeItem('zb:task-panel:all-properties'), true)`);
  await openTask('t1');
  log.T_folded = { chips: await chips(), more: await moreChip() };
  log.T_header = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const nav = d?.querySelector('nav, [aria-label="Breadcrumb"]');
    return nav ? nav.textContent.replace(/\\s+/g, ' ').trim() : null;
  })()`);
  log.T_quiet = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const t = d?.textContent ?? '';
    return {
      noSubtaskSentence: !t.includes('No subtasks yet'), noFilesSentence: !t.includes('No files yet'),
      noCommentsSentence: !t.includes('No comments yet'), noSubtasksHeading: ![...d.querySelectorAll('.text-overline')].some((e) => e.textContent.trim() === 'Subtasks'),
      addFile: !![...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add file'),
      addSubtask: !!d.querySelector('input[placeholder="Add a subtask…"]'),
    };
  })()`);
  log.T_ghostVsFilled = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const find = (label) => [...d.querySelectorAll('button')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim() === label);
    const look = (b) => b ? { bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color } : null;
    return { set: look(find('High')), empty: look(find('Project')) };
  })()`);
  // The two add lines — Add a subtask…, Add file — share one glyph column and one word column, on the panel's own
  // column (the box and the description), in one size and one ink; every placeholder is the house ink-500.
  log.T_addLines = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const x = (e) => (e ? Math.round(e.getBoundingClientRect().left * 10) / 10 : null);
    const sub = d.querySelector('input[aria-label="Add a subtask"]');
    const file = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add file');
    const fileWords = (() => { const t = [...file.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); const r = document.createRange(); r.selectNodeContents(t); return Math.round(r.getBoundingClientRect().left * 10) / 10; })();
    const ref = document.createElement('span'); ref.className = 'text-ink-500'; d.append(ref);
    const ink500 = getComputedStyle(ref).color; ref.remove();
    const ph = (sel) => { const e = d.querySelector(sel) || document.querySelector(sel); return e ? getComputedStyle(e, '::placeholder').color : null; };
    return {
      glyphs: [x(sub.parentElement.querySelector('svg')), x(file.querySelector('svg'))],
      words: [x(sub), fileWords],
      column: { box: x(d.querySelector('[role=checkbox]')), description: x(d.querySelector('textarea[aria-label="Description"]')) },
      size: [getComputedStyle(sub).fontSize, getComputedStyle(file).fontSize],
      ink: { ink500, fileWords: getComputedStyle(file).color, subtaskPlaceholder: ph('input[aria-label="Add a subtask"]'), description: ph('textarea[aria-label="Description"]'), message: ph('input[aria-label="Message"]') },
      rows: [Math.round(sub.parentElement.getBoundingClientRect().height), Math.round(file.getBoundingClientRect().height)],
    };
  })()`);
  // The chips are classes now, so the press and the hover curve must still come from the global button rule.
  log.T_chipMotion = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const b = [...d.querySelectorAll('button')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim() === 'Project');
    const cs = getComputedStyle(b);
    const props = cs.transitionProperty.split(',').map((x) => x.trim());
    const durs = cs.transitionDuration.split(',').map((x) => x.trim());
    const curves = cs.transitionTimingFunction.split(/,\\s*(?![^(]*\\))/).map((x) => x.trim());
    const of = (name) => { const i = props.indexOf(name); return i < 0 ? null : { duration: durs[i % durs.length], curve: curves[i % curves.length] }; };
    return { transform: of('transform'), background: of('background-color'), color: of('color') };
  })()`);
  // An empty chip is a ghost until the pointer is on it: then it takes the hover wash.
  const projectChip = await chip('Project');
  await hover(projectChip);
  log.T_ghostHover = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const b = [...d.querySelectorAll('button')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim() === 'Project');
    return { bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color };
  })()`);
  await mouse('mouseMoved', 5, 5);
  await sleep(200);
  // Inside a chip's panel: the chosen label carries the mark and says so, the other draws nothing; the new-label
  // field is the DS MenuField — declared chromeless, the wash as its ground, the house placeholder ink.
  await clickAt(await chip('Errand'));
  log.T_labelsPanel = await ev(`(() => {
    const p = document.querySelector('[role=dialog][aria-label="Labels"]');
    if (!p) return null;
    const f = p.querySelector('input[aria-label="New label"]');
    const ref = document.createElement('span'); ref.className = 'text-ink-500'; p.append(ref); const ink500 = getComputedStyle(ref).color; ref.remove();
    const wash = document.createElement('span'); wash.className = 'bg-surface-hover'; p.append(wash); const hover = getComputedStyle(wash).backgroundColor; wash.remove();
    return {
      chromeless: !!f?.hasAttribute('data-chromeless'), placeholder: f ? getComputedStyle(f, '::placeholder').color : null, ink500,
      ground: f ? getComputedStyle(f).backgroundColor : null, hover,
      rows: [...document.querySelectorAll('[role=dialog][aria-label="Labels"] button[aria-pressed]')].map((b) => ({ text: b.textContent.replace(/\\s+/g, ' ').trim(), pressed: b.getAttribute('aria-pressed'), mark: getComputedStyle(b.querySelector('svg')).visibility })),
    };
  })()`);
  await escape(); await sleep(300);
  await shot('task-panel-folded.png');
  await clickAt(log.T_folded.more.at);
  await sleep(400);
  log.T_expanded = { chips: await chips(), more: await moreChip() };
  await shot('task-panel-expanded.png');
  // Remembered: a fresh load of the panel keeps everything showing.
  await openTask('t1');
  log.T_remembered = (await moreChip())?.expanded;
  await clickAt((await moreChip()).at);
  await sleep(300);
  log.T_foldedAgain = (await moreChip())?.expanded;
  // t3 lives in Balluji: the header names Balluji, not the task.
  await openTask('t3');
  log.T_headerProject = await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const nav = d?.querySelector('nav, [aria-label="Breadcrumb"]');
    return nav ? nav.textContent.replace(/\\s+/g, ' ').trim() : null;
  })()`);
  // The project menu marks the task's project and nothing else.
  // The chip, not the header crumb that shares its name: a chip is a Pop trigger (aria-haspopup=dialog).
  await clickAt(await ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const b = [...d.querySelectorAll('button[aria-haspopup=dialog]')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim() === 'Balluji');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  })()`));
  log.T_projectMarks = await ev(`[...document.querySelectorAll('[role=dialog][aria-label="Project"] button[aria-pressed]')].map((b) => ({ text: b.textContent.replace(/\\s+/g, ' ').trim(), pressed: b.getAttribute('aria-pressed'), mark: getComputedStyle(b.querySelector('svg')).visibility }))`);
  await escape(); await sleep(300);
  // A chip's menu opens, closes on Escape, and opens again.
  const prioAt = async () => ev(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('data-state') === 'open' && x.querySelector('textarea'));
    const b = d && [...d.querySelectorAll('button')].find((x) => ['High', 'Medium', 'Low'].includes(x.textContent.replace(/\\s+/g, ' ').trim()));
    const r = b.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  })()`);
  await clickAt(await prioAt());
  const opened1 = await ev(`!!document.querySelector('[role=dialog][aria-label="Priority"]')`);
  await escape(); await sleep(400);
  const closed = !(await ev(`!!document.querySelector('[role=dialog][aria-label="Priority"]')`));
  await clickAt(await prioAt());
  const opened2 = await ev(`!!document.querySelector('[role=dialog][aria-label="Priority"]')`);
  log.T_reopen = { opened1, closed, opened2 };
  log.T_priorityMarks = await ev(`[...document.querySelectorAll('[role=dialog][aria-label="Priority"] button[aria-pressed]')].map((b) => ({ text: b.textContent.replace(/\\s+/g, ' ').trim(), pressed: b.getAttribute('aria-pressed'), mark: getComputedStyle(b.querySelector('svg')).visibility }))`);
  await escape(); await sleep(300);

  // M — dark, then a phone
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  // The last Escape left a (correct) focus ring on the Priority chip, and the pointer rests on it (its hover wash);
  // the dark picture is of the panel at rest.
  await ev(`(document.activeElement?.blur(), true)`);
  await mouse('mouseMoved', 5, 5);
  await sleep(500);
  await shot('task-panel-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(600);
  // t6 has no project, so its Project chip is the empty one.
  await openTask('t6');
  await clickAt(await chip('Project'));
  log.M_phone = await ev(`(() => {
    const p = document.querySelector('[role=dialog][aria-label="Project"]');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), inside: r.left >= 0 && r.right <= innerWidth };
  })()`);
  await shot('task-panel-phone.png');

  log.consoleErrors = errors.slice(0, 6);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 6);
} finally {
  log.allSaves = saves.map((x) => x.args);
  log.readCount = reads.length;
  log.urls = urls.slice(0, 20);
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
