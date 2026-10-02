'use strict';
// Measurement tool only — preloaded into `next start` via NODE_OPTIONS=--require.
//
// Tags every outbound Supabase request with the incoming request that caused
// it (AsyncLocalStorage) and appends JSON lines to $ZB_TRACE_FILE:
//   { type: 'req', id, url, method, rsc, prefetch, action, bench, status, ttfb, total }
//   { type: 'sb',  req, bench, page, method, path, query, start, ms, status, bytes }
// `bench` is the x-zb-bench header bench.cjs sends, so a benchmark reads back
// exactly its own requests, never a browser tab's background traffic.
const { AsyncLocalStorage } = require('node:async_hooks');
const http = require('node:http');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const FILE = process.env.ZB_TRACE_FILE || 'trace.jsonl';
const HOST = process.env.ZB_TRACE_HOST || '.supabase.co';
const als = new AsyncLocalStorage();
let seq = 0;
const write = (o) => fs.appendFileSync(FILE, `${JSON.stringify(o)}\n`);

const origEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function emit(ev, req, res) {
  if (ev !== 'request') return origEmit.apply(this, arguments);
  const ctx = {
    id: ++seq, url: req.url, method: req.method, t0: performance.now(),
    rsc: req.headers.rsc === '1', prefetch: req.headers['next-router-prefetch'] || null,
    action: req.headers['next-action'] ? 'action' : null, bench: req.headers['x-zb-bench'] || null,
    firstByte: null,
  };
  const mark = () => { if (ctx.firstByte == null) ctx.firstByte = performance.now() - ctx.t0; };
  const w = res.write;
  const e = res.end;
  res.write = function write_() { mark(); return w.apply(this, arguments); };
  res.end = function end_() { mark(); return e.apply(this, arguments); };
  res.on('finish', () => write({
    type: 'req', id: ctx.id, url: ctx.url, method: ctx.method, rsc: ctx.rsc, prefetch: ctx.prefetch,
    action: ctx.action, bench: ctx.bench, status: res.statusCode,
    ttfb: +(ctx.firstByte ?? 0).toFixed(1), total: +(performance.now() - ctx.t0).toFixed(1),
  }));
  return als.run(ctx, () => origEmit.apply(this, arguments));
};

const origFetch = globalThis.fetch;
globalThis.fetch = async function fetch_(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes(HOST)) return origFetch.apply(this, arguments);
  const ctx = als.getStore();
  const start = performance.now();
  const u = new URL(url);
  const rec = {
    type: 'sb', req: ctx ? ctx.id : null, bench: ctx ? ctx.bench : null, page: ctx ? ctx.url : null,
    method: (init && init.method) || (typeof input === 'object' && input.method) || 'GET',
    path: u.pathname.replace('/rest/v1/', '').replace('/auth/v1/', 'auth:'),
    query: decodeURIComponent(u.search).slice(0, 400),
    start: ctx ? +(start - ctx.t0).toFixed(1) : null,
  };
  try {
    const res = await origFetch.apply(this, arguments);
    rec.ms = +(performance.now() - start).toFixed(1);
    rec.status = res.status;
    res.clone().arrayBuffer().then((b) => { rec.bytes = b.byteLength; write(rec); }, () => write(rec));
    return res;
  } catch (err) {
    rec.ms = +(performance.now() - start).toFixed(1);
    rec.error = String((err && err.message) || err);
    write(rec);
    throw err;
  }
};
