// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// An image uploaded into a doc must still be there when the doc reopens (user report 2026-09-21: "when I upload
// image on this document it's visible but when I reopen that same document image is not visible"). On the
// documents harness, doc "Discussion call with client" (app/dev-preview/documents/page.dev.tsx, `pUploads`).
//
// NOTHING REACHES THE REAL DATABASE. Every `/rest/v1/`, `/auth/v1/` and `/storage/v1/` request is answered here,
// and every server action is answered in React's flight format BY NAME — this script reads Next's own action
// manifest for the harness page, so an upload's three steps, the listing and the save are each answered as
// themselves. Every save's arguments are RECORDED, so what the doc WROTE is checked, not only what it shows.
//   A  the doc opens; the image whose reference is stored opens AS THE PICTURE (the bug showed "Add an image")
//   B  each empty image block offers the page's uploads that nothing shows — images only; the PDF block its PDF
//   C  picking one puts it in that block, the other block stops offering it, and the save carries its fileId
//   D  uploading a new image into a block: the three steps run, the block shows it, the save carries its fileId
//   E  from the keyboard: a PDF offered by name is picked with Enter
//   F  REOPEN — open another doc, come back: every image is still there, each the right file (the user's report)
//   P  a signed proposal holding an upload: its signature lands after the doc and the block repaints to show it; a
//      signature taken before uploads survived a reload reads "accepted", and one the doc no longer matches "edited"
//   M  dark, and phone width
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-doc-uploads.mjs http://localhost:3000 <out-dir> [upload.png]
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [base, out, uploadPath] = process.argv.slice(2);
const PORT = 9392;
const MANIFEST = '.next/dev/server/app/dev-preview/documents/page/server-reference-manifest.json';
const profile = mkdtempSync(join(tmpdir(), 'zb-doc-uploads-'));
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
const key = async (k, code, vk) => {
  const text = k === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {};
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/** The centre of the first visible element matching `selector` that passes `test` (a JS expression over `e`). */
const at = (selector, test = 'true') => ev(`(() => {
  const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length && (${test}));
  if (!e) return null;
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
})()`);
/** What a block shows: the picture's src, the file card's name, or the empty state's words — and what it offers. */
const block = (id) => ev(`(() => {
  const row = document.querySelector('[data-block-id=${JSON.stringify(id)}]');
  if (!row) return null;
  const img = row.querySelector('.img-block img');
  const offer = [...row.querySelectorAll('[role=group]')].find((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === 'Uploaded to this doc');
  return {
    img: img ? img.getAttribute('src') : null,
    empty: /Add an image|Paste a link to a PDF/.test(row.textContent),
    text: row.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80),
    offers: offer ? [...offer.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')) : [],
  };
})()`);

// ── The staged world ─────────────────────────────────────────────────────────
const STORED = '3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c01';   // up-img's reference, kept in the fixture
const LOST_FRONT = '0b7d2f41-2222-4c3d-9e8f-000000000a01';  // uploads the bug stopped showing
const LOST_TABLE = '0b7d2f41-2222-4c3d-9e8f-000000000a02';
const LOST_PDF = '0b7d2f41-2222-4c3d-9e8f-000000000a03';
const UPLOADED = '5c1e9a77-3333-4d4e-8f9a-000000000b01';    // what the upload step records
const UNPLACED = [
  { id: LOST_FRONT, path: 'u/a-front.png', filename: 'Besan barfi back.png', mime_type: 'image/png', size_bytes: 20480, created_at: '2026-09-19T09:00:00Z' },
  { id: LOST_TABLE, path: 'u/a-table.png', filename: 'Nutrition table.png', mime_type: 'image/png', size_bytes: 30720, created_at: '2026-09-19T09:01:00Z' },
  { id: LOST_PDF, path: 'u/a-dieline.pdf', filename: 'Dieline.pdf', mime_type: 'application/pdf', size_bytes: 40960, created_at: '2026-09-19T09:02:00Z' },
];
/** A signed URL, as the signer answers — a picture of a distinct colour per file, so a block shows WHICH one. */
const COLOURS = { [STORED]: '#C4783C', [LOST_FRONT]: '#5F87C5', [LOST_TABLE]: '#7B8B5F', [UPLOADED]: '#9A1B6F' };
const urlFor = (id) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${COLOURS[id] ?? '#999999'}"/><text x="16" y="36" font-size="22" fill="#fff" font-family="sans-serif">${id.slice(-4)}</text></svg>`);

/** What `loadAcceptanceState` answers: one signature, taken against the upload-blind reading of the proposal. */
let proposalHashes = ['fingerprint-with-the-upload', 'fingerprint-blind-to-uploads'];
const SIGNED = { id: 'acc-1', blockId: 'pp-acc', signerName: 'Balluji Foods', signerEmail: null, acceptedAt: '2026-09-19T10:00:00Z', statement: 'I accept this proposal and its terms.', contentHash: 'fingerprint-blind-to-uploads', amount: 60000, invoiceId: null };

const log = {};
const saves = [];     // updatePage arguments
const calls = [];     // every action, by name

try {
  if (!existsSync(MANIFEST)) throw new Error(`no action manifest at ${MANIFEST} — load ${base}/dev-preview/documents once first`);
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const NAME = Object.fromEntries(Object.entries(manifest.node).map(([id, v]) => [id, v.exportedName]));

  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Fetch.requestPaused') { void answer(msg.params); return; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  const origin = new URL(base).origin;
  const cors = [
    { name: 'access-control-allow-origin', value: origin },
    { name: 'access-control-allow-credentials', value: 'true' },
    { name: 'access-control-allow-headers', value: '*' },
    { name: 'access-control-allow-methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
  ];
  const flight = (result) => Buffer.from(`0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify(result)}\n`).toString('base64');
  function reply(name, args) {
    switch (name) {
      case 'unplacedPageUploads': return UNPLACED;
      case 'signAttachments': return { urls: Object.fromEntries((args[0] ?? []).map((id) => [id, urlFor(id)])) };
      case 'signAttachment': return { url: urlFor(args[0]) };
      case 'createAttachmentUploadUrl': return { path: 'u/tok-shelf-photo.png', uploadToken: 'one-shot' };
      case 'recordAttachment': return { attachment: { id: UPLOADED, path: args[1]?.path, filename: args[1]?.filename, mime_type: args[1]?.mimeType, size_bytes: args[1]?.sizeBytes, created_at: new Date().toISOString() } };
      case 'saveVersion': return { saved: false };
      case 'listAttachments': return [];
      case 'loadAcceptanceState': return { acceptances: [SIGNED], hashes: proposalHashes, invoices: {}, crossing: false };
      default: return { ok: true };
    }
  }
  async function answer(p) {
    const { request, requestId } = p;
    const url = request.url;
    if (/\/(rest|auth|storage|realtime)\/v1\//.test(url)) {
      if (request.method === 'OPTIONS') { await send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors }); return; }
      const auth = url.includes('/auth/v1/');
      const storage = url.includes('/storage/v1/');
      if (storage) calls.push(`storage ${request.method} ${url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]}`);
      const body = auth ? { message: 'no session' } : storage ? { Key: 'attachments/u/tok-shelf-photo.png' } : [];
      await send('Fetch.fulfillRequest', {
        requestId, responseCode: auth ? 401 : 200,
        responseHeaders: [...cors, { name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      });
      return;
    }
    const header = Object.entries(request.headers).find(([h]) => h.toLowerCase() === 'next-action');
    if (request.method !== 'POST' || !header) { await send('Fetch.continueRequest', { requestId }); return; }
    const name = NAME[header[1]] ?? `unknown:${header[1].slice(0, 8)}`;
    let raw = request.postData ?? null;
    if (!raw && request.hasPostData) { try { raw = (await send('Network.getRequestPostData', { requestId: p.networkId })).postData; } catch { raw = null; } }
    let args = [];
    try { args = JSON.parse(raw ?? '[]'); } catch { args = []; }
    calls.push(name);
    if (name === 'updatePage') saves.push(args);
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/x-component' }], body: flight(reply(name, args)) });
  }

  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.navigate', { url: `${base}/dev-preview/documents` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`document.body.innerText.includes('Discussion call with client')`).catch(() => false)) break; }
  await sleep(800);

  const openDoc = async (title) => {
    // An open doc replaces the list; its back button returns to it.
    const back = await at('button', `e.getAttribute('aria-label') === 'Back to documents'`);
    if (back) { await clickAt(back); await sleep(600); }
    await clickAt(await at('a, button, [role=button], [role=row], [role=gridcell], div, span', `e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(title)}`));
    for (let i = 0; i < 30; i++) { await sleep(200); if (await ev(`!!document.querySelector('[data-block-id]')`)) break; }
    await sleep(1200);   // the listing and the signatures land
  };

  // A — the doc opens, and the image whose reference is stored opens as the picture.
  await openDoc('Discussion call with client');
  log.A_stored = await block('up-img');
  log.A_storedIsTheFile = log.A_stored?.img === urlFor(STORED);

  // B — the offers.
  log.B_lost1 = await block('up-lost-1');
  log.B_lost2 = await block('up-lost-2');
  log.B_pdf = await block('up-pdf');
  await ev(`document.querySelector('[data-block-id="up-lost-1"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(300);
  await shot('doc-offers.png');

  // M (phone) — the offers at 390px: nothing runs off the side, and a thumbnail is still a thumb-sized target.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(800);
  log.M_phoneOverflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  log.M_phoneThumb = await ev(`(() => { const b = document.querySelector('[data-block-id="up-lost-1"] [role=group] button'); if (!b) return null; const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
  await ev(`document.querySelector('[data-block-id="up-lost-1"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(300);
  await shot('doc-offers-phone.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(800);

  // C — pick the first lost image into the first empty block.
  const before = saves.length;
  await clickAt(await at('[data-block-id="up-lost-1"] button', `e.getAttribute('aria-label') === 'Show Besan barfi back.png here'`));
  await sleep(1400);   // the 600ms autosave, and its round trip
  log.C_lost1 = await block('up-lost-1');
  log.C_lost1IsTheFile = log.C_lost1?.img === urlFor(LOST_FRONT);
  log.C_lost2 = await block('up-lost-2');
  const savedBlocks = () => (saves.at(-1)?.[1]?.content?.blocks ?? []);
  log.C_saved = { saves: saves.length - before, block: savedBlocks().find((b) => b.id === 'up-lost-1') ?? null };

  // D — upload a new image into the second empty block: ticket → bytes straight to storage → record.
  if (uploadPath) {
    const { root } = await send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-block-id="up-lost-2"] input[type=file]' });
    const callsBefore = calls.length;
    await send('DOM.setFileInputFiles', { nodeId, files: [resolve(uploadPath)] });
    for (let i = 0; i < 40; i++) { await sleep(250); if ((await block('up-lost-2'))?.img) break; }
    await sleep(1400);
    log.D_steps = calls.slice(callsBefore).filter((c) => !['saveVersion', 'updatePage', 'syncMentions', 'signAttachments'].includes(c));
    log.D_lost2 = await block('up-lost-2');
    log.D_lost2IsTheUpload = log.D_lost2?.img === urlFor(UPLOADED);
    log.D_saved = savedBlocks().find((b) => b.id === 'up-lost-2') ?? null;
  }

  // E — from the keyboard: into the PDF block's link field, Tab along to the PDF offered by name, Enter picks it.
  await clickAt(await at('[data-block-id="up-pdf"] input:not([type=file])'));
  for (let i = 0; i < 6; i++) {
    if ((await ev(`document.activeElement?.getAttribute('aria-label')`)) === 'Show Dieline.pdf here') break;
    await key('Tab', 'Tab', 9);
    await sleep(120);
  }
  log.E_focusRing = await ev(`(() => { const a = document.activeElement; const s = getComputedStyle(a); return { label: a.getAttribute('aria-label'), focusVisible: a.matches(':focus-visible'), ring: s.boxShadow !== 'none' || s.outlineStyle !== 'none' }; })()`);
  await key('Enter', 'Enter', 13);
  await sleep(1400);
  log.E_pdf = await block('up-pdf');
  log.E_saved = savedBlocks().find((b) => b.id === 'up-pdf') ?? null;

  // F — REOPEN: leave for another doc, come back. Every picture must still be there, each the right file.
  await openDoc('Launch plan');
  log.F_left = await ev(`!document.querySelector('[data-block-id="up-img"]')`);
  await openDoc('Discussion call with client');
  log.F_reopened = {
    stored: (await block('up-img'))?.img === urlFor(STORED),
    picked: (await block('up-lost-1'))?.img === urlFor(LOST_FRONT),
    uploaded: uploadPath ? (await block('up-lost-2'))?.img === urlFor(UPLOADED) : 'skipped',
    pdf: (await block('up-pdf'))?.text ?? null,
  };
  await ev(`document.querySelector('[data-block-id="up-lost-1"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(300);
  await shot('doc-reopened.png');

  // M (dark) — the reopened doc.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(500);
  await shot('doc-reopened-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await sleep(300);

  // P — the signed proposal. Its signature lands a round trip after the doc; the block must repaint to show it.
  const acceptText = async () => ev(`document.querySelector('[data-block-id="pp-acc"]')?.textContent.replace(/\\s+/g, ' ').trim() ?? null`);
  await openDoc('Packaging proposal');
  log.P_signed = await acceptText();
  log.P_acceptedNotEdited = !!log.P_signed?.includes('Accepted by Balluji Foods') && !log.P_signed.includes('edited since');
  log.P_image = (await block('pp-img'))?.img ? 'shown' : 'missing';
  await shot('proposal-signed.png');
  // The same signature, against a document that no longer reads the way it was signed in either form: edited.
  await openDoc('Launch plan');
  proposalHashes = ['fingerprint-with-the-upload'];
  await openDoc('Packaging proposal');
  log.P_editedNote = !!(await acceptText())?.includes('has been edited since it was accepted');

  log.consoleErrors = errors.slice(0, 6);
} catch (err) {
  log.error = String(err?.stack || err);
  log.consoleErrors = errors.slice(0, 6);
} finally {
  log.calls = calls;
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
