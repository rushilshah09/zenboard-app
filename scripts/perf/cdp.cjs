'use strict';
// Measurement tool only. Headless Chrome with a throwaway profile, driven over
// the DevTools protocol, against a server started by serve.sh.
//
//   node scripts/perf/cdp.cjs measure <port> <label> <route...>     hard load: first visit + return visit
//   node scripts/perf/cdp.cjs nav     <port> <label> <from> <to...> client navigation: click → skeleton → content
//   node scripts/perf/cdp.cjs shots   <port> <route> <outPrefix> [holdMs]  loading + loaded screenshots
//   node scripts/perf/cdp.cjs eval    <port> <route> <script.js>     run an async expression in the page
//   node scripts/perf/cdp.cjs compare <portA> <portB> <route...>   pixel-diff two builds + console errors
//
// Observers install before the page's own scripts. Network: NET_RTT (75 ms,
// India → Cloudflare's Singapore edge, measured) and NET_MBPS (20). CPU_SLOWDOWN
// throttles the main thread. Results go to .perf/results/.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const WebSocket = require('next/dist/compiled/ws');

const REPO = path.resolve(__dirname, '..', '..');
const STATE = process.env.ZB_PERF_STATE || path.join(REPO, '.perf');
const RESULTS = path.join(STATE, 'results');
fs.mkdirSync(RESULTS, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const COOKIE_NAME = fs.readFileSync(path.join(STATE, 'session-cookie-name.txt'), 'utf8').trim();
const COOKIE = fs.readFileSync(path.join(STATE, 'session-cookie.txt'), 'utf8').trim();
const NET = { offline: false, latency: Number(process.env.NET_RTT || 75), downloadThroughput: (Number(process.env.NET_MBPS || 20) * 1e6) / 8, uploadThroughput: (10 * 1e6) / 8 };
const CPU = Number(process.env.CPU_SLOWDOWN || 1);
const VIEW = { width: 1440, height: 900 };
const RTT_FILE = path.join(STATE, 'rtt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getRtt = () => Number(fs.readFileSync(RTT_FILE, 'utf8'));
const setRtt = (ms) => fs.writeFileSync(RTT_FILE, String(ms));
const SKELETON = '[aria-busy="true"][aria-live="polite"], [data-skeleton]';

const OBSERVE = `(() => {
  const m = window.__m = { cls: 0, shifts: [], lcp: null, fcp: null, skel: null, skelGone: null, content: null, longTasks: 0, longTaskMs: 0 };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { m.cls += e.value; m.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4) }); } }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { const es = l.getEntries(); const e = es[es.length - 1]; m.lcp = { t: Math.round(e.startTime), el: e.element ? e.element.nodeName + '.' + String(e.element.className || '').slice(0, 40) : null }; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.longTasks++; m.longTaskMs += e.duration; } }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  const check = () => {
    const now = Math.round(performance.now());
    const sk = document.querySelector(${JSON.stringify(SKELETON)});
    if (sk && m.skel == null) m.skel = now;
    if (!sk && m.skel != null && m.skelGone == null) m.skelGone = now;
    if (m.content == null && !sk && document.querySelector('main, h1')) m.content = now;
  };
  new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'data-skeleton'] });
})();`;

const getJSON = (url) => new Promise((resolve, reject) => http.get(url, (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject));

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zb-cdp-'));
  const port = 9333 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', `--user-data-dir=${dir}`, `--remote-debugging-port=${port}`, `--window-size=${VIEW.width},${VIEW.height}`, 'about:blank'], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await getJSON(`http://127.0.0.1:${port}/json/list`)).find((t) => t.type === 'page'); } catch { /* not up yet */ }
    if (!page) await sleep(100);
  }
  if (!page) throw new Error('Chrome did not start');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on('open', r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.on('message', (d) => {
    const msg = JSON.parse(d);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result); } else if (msg.method) listeners.forEach((f) => f(msg));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (f) => listeners.push(f);
  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: 1, mobile: false });
  await send('Network.emulateNetworkConditions', NET);
  if (CPU > 1) await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
  await send('Network.setCookie', { name: COOKIE_NAME, value: COOKIE, domain: 'localhost', path: '/' });
  const close = async () => { try { ws.close(); } catch { /* gone */ } proc.kill('SIGKILL'); await sleep(200); fs.rmSync(dir, { recursive: true, force: true }); };
  return { send, on, close };
}

async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
  return r.result.value;
}
async function load(c, url, waitMs = 8000) {
  const loaded = new Promise((r) => c.on((m) => { if (m.method === 'Page.loadEventFired') r(); }));
  await c.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(waitMs)]);
}

const METRICS = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const js = res.filter((r) => r.initiatorType === 'script' || /\\.js(\\?|$)/.test(r.name));
  const m = window.__m || {};
  return {
    ttfb: Math.round(nav.responseStart), fcp: m.fcp, skel: m.skel, content: m.skelGone ?? m.content,
    lcp: m.lcp && m.lcp.t, cls: +(m.cls || 0).toFixed(4), shifts: m.shifts, longTasks: m.longTasks, longTaskMs: Math.round(m.longTaskMs || 0),
    htmlKB: +(nav.encodedBodySize / 1024).toFixed(1), jsCount: js.length, jsTransferKB: +(js.reduce((a, r) => a + r.transferSize, 0) / 1024).toFixed(1),
    clientSupabase: res.filter((r) => r.name.includes(':54321')).map((r) => new URL(r.name).pathname.replace('/rest/v1/', '').replace('/auth/v1/', 'auth:') + '@' + Math.round(r.responseEnd)),
  };
})()`;

async function measure(port, label, routes) {
  const out = [];
  for (const route of routes) {
    const c = await launch();
    const url = `http://localhost:${port}${route}`;
    await c.send('Network.clearBrowserCache');
    await load(c, url); await sleep(2500);
    const first = await evaluate(c.send, METRICS);
    await load(c, url); await sleep(2500);
    const ret = await evaluate(c.send, METRICS);
    out.push({ route, first, ret });
    console.log(`${route.padEnd(18)} first: ttfb=${first.ttfb} fcp=${first.fcp} skel=${first.skel} content=${first.content} lcp=${first.lcp} cls=${first.cls} js=${first.jsTransferKB}KB long=${first.longTasks}/${first.longTaskMs}ms client-sb=${first.clientSupabase.length} | return: ttfb=${ret.ttfb} content=${ret.content} lcp=${ret.lcp} cls=${ret.cls}`);
    await c.close();
  }
  fs.writeFileSync(path.join(RESULTS, `cdp-${label}.json`), JSON.stringify({ label, at: new Date().toISOString(), net: NET, cpu: CPU, rtt: getRtt(), out }, null, 1));
}

async function navTimings(port, label, from, targets) {
  const c = await launch();
  await load(c, `http://localhost:${port}${from}`); await sleep(3000);
  const out = [];
  for (const to of targets) {
    const r = await evaluate(c.send, `(async () => {
      const t0 = performance.now(); const m = { skel: null, content: null };
      const obs = new MutationObserver(() => {
        const now = performance.now() - t0; const sk = document.querySelector(${JSON.stringify(SKELETON)});
        if (sk && m.skel == null) m.skel = now;
        if (location.pathname + location.search === ${JSON.stringify(to)} && !sk && m.content == null && (m.skel != null || now > 30)) m.content = now;
      });
      obs.observe(document.body, { childList: true, subtree: true });
      const before = performance.getEntriesByType('resource').length;
      const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') === ${JSON.stringify(to)});
      if (!a) return { to: ${JSON.stringify(to)}, error: 'no link' };
      a.click();
      await new Promise((res) => setTimeout(res, 4500));
      obs.disconnect();
      const res = performance.getEntriesByType('resource').slice(before);
      const rsc = res.filter((x) => x.name.includes('_rsc='));
      return { to: ${JSON.stringify(to)}, skel: m.skel && Math.round(m.skel), content: m.content && Math.round(m.content), rscRequests: rsc.length, clientSupabase: res.filter((x) => x.name.includes(':54321')).length };
    })()`);
    out.push(r);
    console.log(JSON.stringify(r));
  }
  fs.writeFileSync(path.join(RESULTS, `nav-${label}.json`), JSON.stringify({ label, at: new Date().toISOString(), net: NET, rtt: getRtt(), out }, null, 1));
  await c.close();
}

async function shots(port, route, prefix, holdMs = 2500) {
  const previous = getRtt();
  const c = await launch();
  try {
    setRtt(0);
    await load(c, `http://localhost:${port}${route}`); await sleep(2500);
    const loaded = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${prefix}-loaded.png`, Buffer.from(loaded.data, 'base64'));
    setRtt(holdMs);
    const navigating = c.send('Page.navigate', { url: `http://localhost:${port}${route}` });
    let captured = false;
    for (let i = 0; i < 200 && !captured; i++) {
      await sleep(50);
      const shown = await evaluate(c.send, `!!document.querySelector(${JSON.stringify(SKELETON)})`).catch(() => false);
      if (shown) {
        await sleep(150);
        const skel = await c.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`${prefix}-loading.png`, Buffer.from(skel.data, 'base64'));
        captured = true;
      }
    }
    await navigating;
    console.log(`${route}: ${prefix}-loaded.png${captured ? `, ${prefix}-loading.png` : ' (loading state never appeared)'}`);
  } finally {
    setRtt(previous);
    await c.close();
  }
}

async function evalScript(port, route, file) {
  const c = await launch();
  const logs = [];
  c.on((m) => { if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); });
  await load(c, `http://localhost:${port}${route}`); await sleep(1500);
  const r = await evaluate(c.send, fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(r, null, 1));
  const filter = process.env.LOG_FILTER;
  for (const l of logs) if (!filter || l.includes(filter)) console.log('console:', l);
  await c.close();
}

// Render the same route on two builds, screenshot both after they settle, and
// diff the pixels in a canvas. The proof that a change is invisible: a fix that
// claims "loaded screens stay pixel-identical" has to survive this. Console
// errors are collected on both sides; the mock serves no Realtime socket, so
// that one known error is reported separately rather than counted.
const FREEZE = `(() => {
  const css = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';
  const add = () => {
    if (!document.head || document.getElementById('zb-freeze')) return !!document.head;
    const s = document.createElement('style'); s.id = 'zb-freeze'; s.textContent = css; document.head.appendChild(s); return true;
  };
  if (!add()) new MutationObserver((_, o) => { if (add()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
})();`;

async function compare(portA, portB, routes) {
  const KNOWN = /realtime\/v1\/websocket/;
  const out = [];
  for (const route of routes) {
    const sides = [];
    for (const port of [portA, portB]) {
      const c = await launch();
      const errors = [];
      c.on((m) => {
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((x) => x.value ?? x.description).join(' ').slice(0, 240));
        if (m.method === 'Runtime.exceptionThrown') errors.push(`EXCEPTION ${(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 240)}`);
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(`${m.params.entry.text}`.slice(0, 240));
      });
      await c.send('Log.enable');
      // Compare SETTLED screens: an entrance or looping animation caught at a
      // different moment on each side is a timing difference, not a visual one
      // (a build that hydrates 50 ms sooner shifts a transition's phase). The
      // freeze is installed at DOCUMENT START: injecting it into a page that has
      // already painted forces a mid-life restyle whose raster differs by timing,
      // which once produced an 11-pixel "difference" on identical DOM geometry.
      // ANIMATIONS=1 keeps animations running.
      if (process.env.ANIMATIONS !== '1') await c.send('Page.addScriptToEvaluateOnNewDocument', { source: FREEZE });
      await load(c, `http://localhost:${port}${route}`);
      await sleep(3500);
      await evaluate(c.send, 'document.fonts.ready.then(() => true)');
      const shot = await c.send('Page.captureScreenshot', { format: 'png' });
      sides.push({ port, png: shot.data, errors });
      await c.close();
    }
    const c = await launch();
    const diff = await evaluate(c.send, `(async () => {
      const img = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
      const [a, b] = await Promise.all([img(${JSON.stringify(sides[0].png)}), img(${JSON.stringify(sides[1].png)})]);
      const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
      const px = (i) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const A = px(a), B = px(b);
      const out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d'); g.drawImage(b, 0, 0);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, 0, w, h);
      const mark = g.getImageData(0, 0, w, h);
      let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2] || A[i + 3] !== B[i + 3]) {
          n++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
          mark.data[i] = 230; mark.data[i + 1] = 0; mark.data[i + 2] = 60; mark.data[i + 3] = 255;
        }
      }
      g.putImageData(mark, 0, 0);
      return { w, h, differing: n, bbox: n ? [x0, y0, x1, y1] : null, png: n ? out.toDataURL('image/png').split(',')[1] : null };
    })()`);
    await c.close();
    const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
    if (diff.png) fs.writeFileSync(path.join(RESULTS, `diff-${slug}.png`), Buffer.from(diff.png, 'base64'));
    if (diff.bbox) {
      // A handful of differing pixels is invisible at full size. Crop the region
      // (padded), scale it 12x without smoothing, and put A | B side by side.
      const z = await launch();
      const zoom = await evaluate(z.send, `(async () => {
        const img = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
        const [a, b] = await Promise.all([img(${JSON.stringify(sides[0].png)}), img(${JSON.stringify(sides[1].png)})]);
        const [x0, y0, x1, y1] = ${JSON.stringify(diff.bbox)};
        const pad = 12, S = 12;
        const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad);
        const sw = Math.min(a.width - sx, x1 - x0 + 1 + pad * 2), sh = Math.min(a.height - sy, y1 - y0 + 1 + pad * 2);
        const cv = document.createElement('canvas'); cv.width = sw * S * 2 + S * 2; cv.height = sh * S;
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
        g.fillStyle = '#ff0050'; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(a, sx, sy, sw, sh, 0, 0, sw * S, sh * S);
        g.drawImage(b, sx, sy, sw, sh, sw * S + S * 2, 0, sw * S, sh * S);
        return cv.toDataURL('image/png').split(',')[1];
      })()`);
      await z.close();
      fs.writeFileSync(path.join(RESULTS, `zoom-${slug}.png`), Buffer.from(zoom, 'base64'));
    }
    const count = (e) => ({ real: e.filter((x) => !KNOWN.test(x)), known: e.filter((x) => KNOWN.test(x)).length });
    const ea = count(sides[0].errors), eb = count(sides[1].errors);
    const r = { route, identicalBytes: sides[0].png === sides[1].png, differingPixels: diff.differing, bbox: diff.bbox, errorsA: ea.real, errorsB: eb.real, knownRealtimeErrors: [ea.known, eb.known] };
    out.push(r);
    console.log(`${route.padEnd(20)} pixels differing ${String(diff.differing).padStart(7)} of ${diff.w * diff.h}${diff.bbox ? ` in ${diff.bbox}` : ''}  errors ${ea.real.length}/${eb.real.length}${diff.png ? `  → results/diff-${slug}.png` : ''}`);
    for (const e of eb.real.filter((x) => !ea.real.includes(x))) console.log(`   NEW ERROR on ${portB}: ${e}`);
  }
  fs.writeFileSync(path.join(RESULTS, `compare-${portA}-${portB}.json`), JSON.stringify({ at: new Date().toISOString(), portA, portB, out }, null, 1));
}

(async () => {
  const [mode, port, a, ...rest] = process.argv.slice(2);
  if (mode === 'measure') await measure(port, a, rest);
  else if (mode === 'nav') await navTimings(port, a, rest[0], rest.slice(1));
  else if (mode === 'shots') await shots(port, a, rest[0], rest[1] ? Number(rest[1]) : 2500);
  else if (mode === 'eval') await evalScript(port, a, rest[0]);
  else if (mode === 'compare') await compare(port, a, rest);
  else throw new Error('usage: cdp.cjs measure|nav|shots|eval|compare …');
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
