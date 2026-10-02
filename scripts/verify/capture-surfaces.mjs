// ── EVERY SURFACE, ONE FRAME EACH, NO DEPENDENCIES ─────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// The product-wide design record: each /dev-preview harness at a real desktop size in the chosen theme, so a
// cross-app review compares every screen against its neighbours rather than one screen against memory. Any
// database or auth request is answered here with nothing, so no real data is read or written.
//
// Usage:
//   [FULL=1] [W=…] [H=…] node --experimental-websocket scripts/verify/capture-surfaces.mjs http://localhost:3000 <out-dir> <light|dark> [route …]
//   (routes are dev-preview names, e.g. `home tasks calendar`; none = the default set below)
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light', ...only] = process.argv.slice(2);
const ROUTES = only.length ? only : [
  'shell', 'home', 'tasks', 'week', 'calendar', 'projects', 'documents', 'clients', 'money', 'content', 'inbox',
  'habits', 'rituals', 'horizon', 'memory', 'focus', 'settings', 'forms-hub', 'automations', 'onboarding', 'portal',
  'notifications', 'loading',
];
const WIDTH = Number(process.env.W ?? 1440), HEIGHT = Number(process.env.H ?? 900);
const PORT = 9394;
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'zb-surf-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
let errors = [];
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const report = {};

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      const empty = request.method === 'OPTIONS' ? { responseCode: 204 } : { responseCode: request.url.includes('/auth/v1/') ? 401 : 200, body: Buffer.from('[]').toString('base64') };
      void send('Fetch.fulfillRequest', { requestId, ...empty, responseHeaders: [{ name: 'access-control-allow-origin', value: new URL(base).origin }, { name: 'access-control-allow-headers', value: '*' }, { name: 'content-type', value: 'application/json' }] });
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 160) ?? 'exception');
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' ').slice(0, 160));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/rest/v1/*', requestStage: 'Request' }, { urlPattern: '*/auth/v1/*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 768 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  // SKIN=paper captures the paper skin. It is stamped BEFORE the document runs, so the blocking
  // boot script in layout.tsx reads it and the first paint is already paper — capturing after a
  // reload would photograph the default skin's first frame on a slow compile.
  if (process.env.SKIN) {
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.setItem('zb-skin',${JSON.stringify(process.env.SKIN)})}catch(e){}`,
    });
  }

  for (const route of ROUTES) {
    errors = [];
    await send('Page.navigate', { url: `${base}/dev-preview/${route}` });
    // The first hit compiles the route; wait for real content, then for fonts and a settled frame.
    let ok = false;
    for (let i = 0; i < 150; i++) {
      await sleep(300);
      ok = await ev(`document.readyState === 'complete' && document.body.innerText.trim().length > 40`).catch(() => false);
      if (ok) break;
    }
    await ev(`document.fonts.ready.then(() => true)`).catch(() => null);
    await sleep(1400);
    // FULL=1: the whole page, not the first screen — the tallest scroller's content, laid out at the viewport width.
    let shotParams = { format: 'png' };
    if (process.env.FULL) {
      const h = await ev(`Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll('*')].filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 40).map((e) => e.scrollHeight + e.getBoundingClientRect().top))`);
      await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: Math.min(6000, Math.ceil(h)), deviceScaleFactor: 1, mobile: WIDTH < 768 });
      await sleep(700);
    }
    writeFileSync(join(out, `${route}-${process.env.SKIN ? process.env.SKIN + '-' : ''}${theme}${process.env.FULL ? '-full' : ''}.png`), Buffer.from((await send('Page.captureScreenshot', shotParams)).data, 'base64'));
    if (process.env.FULL) await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 768 });
    report[route] = { rendered: ok, errors: [...new Set(errors)].filter((e) => !/script tag while rendering/.test(e)).slice(0, 4) };
  }
} finally {
  console.log(JSON.stringify(report, null, 1));
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
