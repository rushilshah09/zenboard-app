// ── DOES THE DROP SETTLE? REAL-INPUT VERIFICATION ─────────────────────────
// A sibling of verify-board-drag.mjs, watching a different object. That one
// samples the CARD, which lands in its slot instantly by design. The thing that
// is supposed to travel is dnd-kit's OVERLAY — the card you are holding — and
// `lib/drop-settle.ts` is what makes it fly to the slot instead of vanishing at
// the cursor. So this samples the overlay's own left edge every 25ms across the
// release, plus the settling card's opacity (hidden while the overlay flies).
//
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
//   node --experimental-websocket scripts/verify/verify-board-drag.mjs http://localhost:3000/dev-preview/content "studio websites" Draft /tmp

// Real multi-step pointer drag over the DevTools protocol — no dependencies.
// Run: node --experimental-websocket real-drag.mjs <url> <cardText> <targetColumn> <outDir>
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, cardText, targetCol, outDir] = process.argv.slice(2);
const PORT = 9333;
const profile = mkdtempSync(join(tmpdir(), 'zb-drag-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('chrome did not start');
}

let ws, seq = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', ...extra });

const log = {};
try {
  await up();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  // Wait until the board has actually hydrated, not for a fixed time: a dev
  // server compiles on first hit, and a guess either wastes time or races.
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    const ready = await evaluate(`!!document.querySelector('section[aria-label]') && !!document.querySelector('[id^=DndDescribedBy], [id^=DndLiveRegion]')`).catch(() => false);
    if (ready) break;
  }
  log.page = await evaluate(`({ href: location.href, title: document.title, sections: document.querySelectorAll('section[aria-label]').length, text: document.body.innerText.slice(0, 120) })`);

  const geo = await evaluate(`(() => {
    const card = [...document.querySelectorAll('[role=button][aria-label]')].find(b => (b.getAttribute('aria-label')||'').includes(${JSON.stringify(cardText)}));
    const col = document.querySelector('section[aria-label=${JSON.stringify(targetCol)}]');
    if (!card || !col) return { error: 'missing', card: !!card, col: !!col, cols: [...document.querySelectorAll('section[aria-label]')].map(s=>s.getAttribute('aria-label')) };
    const a = card.getBoundingClientRect(), b = col.getBoundingClientRect();
    const from = card.closest('section[aria-label]')?.getAttribute('aria-label');
    return { from, start: [a.x + a.width/2, a.y + a.height/2], end: [b.x + b.width/2, b.y + Math.min(b.height - 20, 120)] };
  })()`);
  log.geometry = geo;
  if (geo.error) throw new Error('geometry: ' + JSON.stringify(geo));

  const [sx, sy] = geo.start, [ex, ey] = geo.end;
  await mouse('mouseMoved', sx, sy, { buttons: 0 });
  await sleep(80);
  await mouse('mousePressed', sx, sy);
  const STEPS = 12;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    await mouse('mouseMoved', sx + (ex - sx) * t, sy + (ey - sy) * t);
    await sleep(35);
  }
  await sleep(250);

  // Held over the target: what does the page say?
  log.midDrag = await evaluate(`(() => {
    const col = document.querySelector('section[aria-label=${JSON.stringify(targetCol)}]');
    const slot = col.querySelector('[aria-hidden].border-dashed');
    return {
      announcement: [...document.querySelectorAll('[id^=DndLiveRegion]')].map(e => e.textContent.trim()).join(' | ') || '(silent)',
      targetRinged: /ring-ink-300/.test(col.className),
      heldCardWidth: Math.round(document.querySelector('.rotate-1')?.getBoundingClientRect().width ?? -1),
      columnCardWidth: Math.round(col.querySelector('[role=button][aria-label]')?.getBoundingClientRect().width ?? -1),
      landingSlotInTarget: !!slot,
      orderInTarget: [...col.querySelectorAll('p.text-body, [aria-hidden].border-dashed')].map(e => e.classList.contains('border-dashed') ? '[LANDING]' : e.textContent.trim().slice(0, 32)),
    };
  })()`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, 'drag-mid.png'), Buffer.from(shot.data, 'base64'));

  await mouse('mouseReleased', ex, ey);
  // Where the dropped card IS, every 30ms after release. If it appears in its
  // slot, x is flat; if the drop replays the journey from the origin column, x
  // starts near the origin and travels.
  log.settle = await evaluate(`(async () => {
    const TEXT = ${JSON.stringify(cardText)};
    const out = [];
    for (let i = 0; i < 24; i++) {
      const overlay = [...document.querySelectorAll('div')]
        .filter((d) => getComputedStyle(d).position === 'fixed')
        .find((d) => (d.textContent || '').toLowerCase().includes(TEXT.toLowerCase()));
      const card = [...document.querySelectorAll('[role=button][aria-label]')]
        .find((b) => (b.getAttribute('aria-label') || '').includes(TEXT));
      out.push({
        ms: i * 25,
        overlayLeft: overlay ? Math.round(overlay.getBoundingClientRect().left) : null,
        overlayTop: overlay ? Math.round(overlay.getBoundingClientRect().top) : null,
        cardOpacity: card ? getComputedStyle(card).opacity : null,
      });
      await new Promise((r) => setTimeout(r, 25));
    }
    return out;
  })()`);
  log.originX = Math.round(sx); log.targetX = Math.round(ex);
  await sleep(300);
  log.afterDrop = await evaluate(`(() => {
    const read = (n) => { const s = document.querySelector('section[aria-label=' + JSON.stringify(n) + ']'); return s ? [...s.querySelectorAll('p.text-body')].map(p => p.textContent.trim().slice(0, 32)) : null; };
    return { from: read(${JSON.stringify(geo.from)}), target: read(${JSON.stringify(targetCol)}), announcement: [...document.querySelectorAll('[id^=DndLiveRegion]')].map(e => e.textContent.trim()).join(' | ') };
  })()`);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, 'drag-after.png'), Buffer.from(shot2.data, 'base64'));
} catch (e) {
  log.error = String(e && e.message || e);
} finally {
  console.log(JSON.stringify(log, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
