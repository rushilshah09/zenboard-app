// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// Drives the Chrome already installed on this Mac over the DevTools protocol:
// headless, in a throwaway profile (no access to your browsing data), with real
// trusted mouse events. Needs Node 20+ and `--experimental-websocket`.
//
// Why this exists: the in-app browser's `left_click_drag` fires press, move and
// release as ONE atomic step, which never satisfies dnd-kit's 4px activation
// constraint — so a working drag looked broken. It also cannot cut the network
// or answer a request as a different deployment would. This can do all three.
//
// Run against a `next dev` server (dev-preview harnesses only exist there).
//
// Usage:
//   node --experimental-websocket scripts/verify/verify-stale-deployment.mjs http://localhost:3000

// The stale-deployment branch, end to end: the page's real save request is
// intercepted and answered exactly as a NEWER deployment answers an action ID it
// does not have — 404 with `x-nextjs-action-not-found: 1`. Next's own client code
// then throws its own UnrecognizedActionError into the real net.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base] = process.argv.slice(2);
const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), 'zb-stale-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1200,800', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map(); let intercepted = 0; let intercepting = false;
const send = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 240)); return r.result.value; };
async function click(selector) {
  const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
  if (!c) throw new Error('no element ' + selector);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  }
}
const log = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = async (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); return; }
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      const isAction = request.method === 'POST' && Object.keys(request.headers).some((h) => h.toLowerCase() === 'next-action');
      if (intercepting && isAction) {
        intercepted++;
        await send('Fetch.fulfillRequest', { requestId, responseCode: 404, responseHeaders: [
          { name: 'x-nextjs-action-not-found', value: '1' }, { name: 'content-type', value: 'text/plain' },
        ], body: '' });
      } else {
        await send('Fetch.continueRequest', { requestId });
      }
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.navigate', { url: `${base}/dev-preview/action-failure` });
  for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('[data-row=r1]')`).catch(() => false)) break; }
  await sleep(800);

  intercepting = true;   // from here, the server "has been redeployed"
  await click('[data-row=r1]');
  await sleep(2500);
  log.after = await ev(`({
    toasts: [...document.querySelectorAll('[role=status]')].map(e => e.textContent.trim()).filter(Boolean),
    reloadOffered: [...document.querySelectorAll('[role=status] button')].some(b => b.textContent.trim() === 'Reload'),
    url: location.href,
  })`);
  log.interceptedActionRequests = intercepted;
} catch (e) {
  log.error = String(e?.message || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL'); await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
