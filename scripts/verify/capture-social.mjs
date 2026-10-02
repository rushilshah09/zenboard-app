// ── CAPTURE THE FOUNDER BANNERS ─────────────────────────────────────────────
//
// Renders app/dev-preview/social (development only) in headless Chrome at each board's own size and
// DPR 2, and saves one PNG per board: twice the pixels each network recommends, so the banner stays
// sharp on a retina screen after the network re-encodes it.
//
// Driven over CDP like capture-site.mjs, because Chrome's one-shot `--screenshot` never settles on a
// `next dev` page: `--virtual-time-budget` waits on the live-reload socket, which never closes. This
// waits for what the banner actually needs instead: the fonts, and the product's own window (an
// iframe of /demo) having drawn itself.
//
//   node scripts/verify/capture-social.mjs [base=http://localhost:3000] [out=brand/social] [safe]
//
// `safe` adds the profile photo's circle where each network lays it, to check nothing sits beneath it.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const [base = 'http://localhost:3000', out = 'brand/social', safe] = process.argv.slice(2);
// Name, width, height: the boards in app/dev-preview/social/page.dev.tsx, at the networks' own sizes.
const BOARDS = [
  ['linkedin', 1584, 396],
  ['x', 1500, 500],
];
const PORT = 9392;
const profile = mkdtempSync(join(tmpdir(), 'zb-social-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--window-size=1600,900', 'about:blank',
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

// Ready when the page's fonts are in, and the product's window has drawn a real page with its own
// fonts in: the demo posts `ready` to the window it lives in, but the frame is same-origin, so its
// document can simply be read.
const READY = `(async () => {
  await document.fonts.ready;
  const frame = document.querySelector('iframe');
  for (let i = 0; i < 120; i++) {
    const d = frame?.contentDocument;
    if (d && d.readyState === 'complete' && d.body && d.body.innerText.length > 200) {
      await d.fonts.ready;
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
})()`;

try {
  mkdirSync(out, { recursive: true });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (msg.params.exceptionDetails?.exception?.description ?? '').slice(0, 200));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('console: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  for (const [name, width, height] of BOARDS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: `${base}/dev-preview/social?b=${name}${safe ? '&safe=1' : ''}` });
    await sleep(1500);
    const ready = await ev(READY);
    // The print settles into its first frames and the demo finishes its arrival.
    await sleep(2500);
    const file = join(out, `${name}${safe ? '-safe' : ''}.png`);
    writeFileSync(file, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    console.log(`${ready ? '✓' : '! product window never drew,'} ${file} (${width * 2}×${height * 2})`);
  }
  if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
} finally {
  ws?.close();
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
