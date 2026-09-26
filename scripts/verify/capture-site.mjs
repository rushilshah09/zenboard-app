// ── THE WEBSITE, CAPTURED SECTION BY SECTION ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol rather than the in-app browser (a hidden pane paints no new
// frames, so a scrolled screenshot there is the frame from before the scroll).
//
// Scrolls each part of the home page to the top of the window, lets its
// scroll-linked reveal finish, and saves the viewport. It also reads back what a
// screenshot cannot show: console errors, horizontal overflow, and the face and
// weight the headlines actually render in.
//
// Usage:
//   node --experimental-websocket scripts/verify/capture-site.mjs http://localhost:3000 /tmp [light|dark] [width] [reduce]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, theme = 'light', width = '1440', motion = 'no-preference'] = process.argv.slice(2);
const W = Number(width);
const H = W < 700 ? 812 : 900;
const PORT = 9391;
const profile = mkdtempSync(join(tmpdir(), 'zb-site-'));
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
const shot = async (name) => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

// The parts of the page, top to bottom: a selector for each, and the name its capture is saved under.
const PARTS = [
  ['hero', 'main section:first-of-type'],
  ['showcase', 'main section:nth-of-type(2)'],
  ['how', '#how'],
  ['people', '#who'],
  ['day', '#day'],
  ['projects', '#projects'],
  ['portal', '#portal'],
  ['money', '#money'],
  ['details', '#details'],
  ['faq', '#faq'],
  ['footer', 'footer'],
];

try {
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
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion === 'reduce' ? 'reduce' : 'no-preference' }] });

  // The theme is a stored choice; the boot script reads it before first paint.
  await send('Page.navigate', { url: base + '/' }); await sleep(2500);
  await ev(`localStorage.setItem('zb-theme', ${JSON.stringify(theme)})`);
  await send('Page.navigate', { url: base + '/' }); await sleep(3000);
  await ev(`document.documentElement.style.scrollBehavior = 'auto'`);

  const facts = await ev(`(() => {
    const h1 = getComputedStyle(document.querySelector('h1'));
    const h2 = getComputedStyle(document.querySelector('#day h2'));
    return {
      // Against the width asked for, not innerWidth: an emulated phone WIDENS its layout viewport to fit
      // whatever overflows, so innerWidth grows with the bug and the difference reads zero.
      overflowX: Math.max(document.documentElement.scrollWidth, innerWidth) - ${W},
      height: document.documentElement.scrollHeight,
      h1: h1.fontFamily.split(',')[0] + ' ' + h1.fontWeight + ' ' + h1.fontSize,
      h2: h2.fontFamily.split(',')[0] + ' ' + h2.fontWeight + ' ' + h2.fontSize,
      theme: document.documentElement.dataset.theme ?? document.documentElement.className,
    };
  })()`);
  console.log(`── / · ${theme} · ${W}px · motion ${motion} ──`);
  console.log('  facts', JSON.stringify(facts));
  if (facts.overflowX > 0) errors.push(`the page scrolls sideways by ${facts.overflowX}px`);

  for (const [name, sel] of PARTS) {
    const top = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null; })()`);
    if (top == null) { errors.push(`no ${name} (${sel})`); continue; }
    // Hero from the very top; the rest with their top a little under the floating navigation.
    await ev(`window.scrollTo(0, ${name === 'hero' ? 0 : `Math.max(0, ${top} - 24)`})`);
    await sleep(900);
    await shot(`site-${theme}-${W}-${name}.png`);
  }
  console.log(errors.length ? errors.map((e) => '  ✗ ' + e).join('\n') : '  ✓ no errors, no sideways scroll');
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.exit(errors.length ? 1 : 0);
