'use strict';
// Measurement tool only. Server timings for Zenboard's main routes against the
// mock Supabase, as a hard load (HTML) and as a client navigation (the RSC
// request a sidebar click sends, with a real router-state header; Next 16
// rejects a malformed one with a 400).
//
//   node scripts/perf/bench.cjs --port 3103 --label current [--runs 3] [--routes /today,/tasks]
//   node scripts/perf/bench.cjs --compare baseline,current
//
// Each route gets one unmeasured warm-up, then --runs measured passes; tables
// report medians. "ttfb" is the first response byte; "content" is the whole
// streamed document, i.e. real content on screen. Supabase calls and waves
// (round trips paid in series) come from the tracer, matched by the
// x-zb-bench header sent here, so no other traffic can leak into a result.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const STATE = process.env.ZB_PERF_STATE || path.join(REPO, '.perf');
const RESULTS = path.join(STATE, 'results');
fs.mkdirSync(RESULTS, { recursive: true });

const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i === -1 ? fallback : argv[i + 1]; };
const ROUTES = ['/today', '/tasks', '/tasks?view=week', '/projects', '/clients', '/money', '/documents', '/calendar', '/focus', '/settings', '/habits', '/horizon', '/content', '/forms', '/rituals'];
const median = (v) => { const s = v.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function routerTree(route) {
  const u = new URL(route, 'http://x');
  const seg = u.pathname.split('/')[1];
  const params = Object.fromEntries(u.searchParams);
  const page = Object.keys(params).length ? `__PAGE__?${JSON.stringify(params)}` : '__PAGE__';
  return encodeURIComponent(JSON.stringify(['', { children: ['(app)', { children: [seg, { children: [page, {}, null, null, 0] }, null, 'refetch', 0] }, null, null, 4] }, null, null, 24]));
}

function wavesOf(calls) {
  const c = calls.map((x) => ({ ...x })).sort((a, b) => a.start - b.start);
  for (const x of c) {
    const before = c.filter((p) => p !== x && p.start + p.ms <= x.start + 1);
    x.w = 1 + Math.max(0, ...before.map((p) => p.w || 0));
  }
  return { calls: c.length, waves: Math.max(0, ...c.map((x) => x.w)) };
}

function compare([a, b]) {
  const load = (l) => JSON.parse(fs.readFileSync(path.join(RESULTS, `bench-${l}.json`), 'utf8'));
  const A = load(a);
  const B = load(b);
  const rows = A.table.map((x) => {
    const y = B.table.find((r) => r.route === x.route) || {};
    const d = (k) => `${x[k]} → ${y[k]}`;
    return { route: x.route, ttfb: d('ttfb'), content: d('content'), waves: d('waves'), nav: d('nav'), navWaves: d('navWaves') };
  });
  console.log(`${a} (rtt ${A.rtt} ms) → ${b} (rtt ${B.rtt} ms), medians in ms`);
  console.table(rows);
}

if (arg('compare')) {
  compare(arg('compare').split(','));
} else {
  const PORT = Number(arg('port', 3103));
  const LABEL = arg('label', `port${PORT}`);
  const RUNS = Number(arg('runs', 3));
  const routes = arg('routes') ? arg('routes').split(',') : ROUTES;
  const TRACE = path.join(STATE, `trace-${PORT}.jsonl`);
  const cookie = `${fs.readFileSync(path.join(STATE, 'session-cookie-name.txt'), 'utf8').trim()}=${fs.readFileSync(path.join(STATE, 'session-cookie.txt'), 'utf8').trim()}`;
  const rtt = Number(fs.readFileSync(path.join(STATE, 'rtt'), 'utf8'));

  const get = (route, headers) => new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const ms = () => Number(process.hrtime.bigint() - t0) / 1e6;
    const req = http.request({ host: '127.0.0.1', port: PORT, path: route, headers: { cookie, ...headers } }, (res) => {
      const ttfb = ms();
      let bytes = 0;
      res.on('data', (c) => { bytes += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, ttfb, total: ms(), bytes }));
    });
    req.on('error', reject);
    req.end();
  });

  (async () => {
    const samples = [];
    for (const route of routes) {
      const nav = { RSC: '1', 'Next-Router-State-Tree': routerTree(route) };
      await get(route, { 'x-zb-bench': `${LABEL}:warmup` });
      await get(route, { ...nav, 'x-zb-bench': `${LABEL}:warmup` });
      for (let i = 0; i < RUNS; i++) {
        for (const kind of ['html', 'nav']) {
          const id = `${LABEL}:${kind}:${route}:${i}`;
          const r = await get(route, { ...(kind === 'nav' ? nav : {}), 'x-zb-bench': id });
          samples.push({ route, kind, id, ...r });
        }
      }
      process.stdout.write('.');
    }
    await new Promise((r) => setTimeout(r, 400)); // the tracer writes after response bodies drain
    const byBench = new Map();
    for (const line of fs.readFileSync(TRACE, 'utf8').split('\n')) {
      if (!line.includes(`"bench":"${LABEL}:`)) continue;
      const l = JSON.parse(line);
      if (l.type !== 'sb') continue;
      if (!byBench.has(l.bench)) byBench.set(l.bench, []);
      byBench.get(l.bench).push(l);
    }
    const table = routes.map((route) => {
      const of = (kind) => samples.filter((s) => s.route === route && s.kind === kind);
      const html = of('html');
      const nav = of('nav');
      const w = (s) => wavesOf(byBench.get(s.id) || []);
      return {
        route,
        status: html[0].status,
        ttfb: Math.round(median(html.map((s) => s.ttfb))),
        content: Math.round(median(html.map((s) => s.total))),
        htmlKB: +(html[0].bytes / 1024).toFixed(1),
        calls: median(html.map((s) => w(s).calls)),
        waves: median(html.map((s) => w(s).waves)),
        nav: Math.round(median(nav.map((s) => s.total))),
        navStatus: nav[0].status,
        navWaves: median(nav.map((s) => w(s).waves)),
        navKB: +(nav[0].bytes / 1024).toFixed(1),
      };
    });
    console.log(`\n${LABEL} · port ${PORT} · mock rtt ${rtt} ms · ${RUNS} runs, medians`);
    console.table(table);
    const file = path.join(RESULTS, `bench-${LABEL}.json`);
    fs.writeFileSync(file, JSON.stringify({ label: LABEL, port: PORT, rtt, runs: RUNS, at: new Date().toISOString(), table }, null, 1));
    console.log(`saved ${path.relative(REPO, file)}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
