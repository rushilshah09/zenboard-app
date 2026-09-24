'use strict';
// Measurement tool only — never imported by the app.
//
// A local stand-in for the Supabase project, faithful enough for Zenboard to
// render every page against realistic studio data (fixtures.cjs):
//   · PostgREST: select (columns, aliases, casts, JSON paths, embeds), filters
//     (eq/neq/gt/gte/lt/lte/like/ilike/is/in/cs/cd/ov/fts, `not.`, or/and
//     trees), order (with nulls), limit/offset, count=exact (incl. HEAD),
//     single/maybeSingle, insert/upsert/update/delete, return=representation.
//   · Auth: ES256 session tokens, JWKS, /user, token refresh, logout.
// Every response first waits `.perf/rtt` milliseconds, read on each request:
// the distance to the database, which is the variable this harness controls.
// Writes live in memory until restart, or `POST /__mock/reset`.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildFixtures, USER_ID, USER_EMAIL } = require('./fixtures.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const STATE = process.env.ZB_PERF_STATE || path.join(REPO, '.perf');
const PORT = Number(process.env.MOCK_PORT || 54321);
const ORIGIN = `http://127.0.0.1:${PORT}`;
fs.mkdirSync(STATE, { recursive: true });

const RTT_FILE = path.join(STATE, 'rtt');
if (!fs.existsSync(RTT_FILE)) fs.writeFileSync(RTT_FILE, '200');
const rtt = () => { try { return Math.max(0, Number(fs.readFileSync(RTT_FILE, 'utf8')) || 0); } catch { return 0; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Auth. Keys persist, so a saved session cookie survives restarts. ────────
const KEYS_FILE = path.join(STATE, 'keys.json');
let keys;
if (fs.existsSync(KEYS_FILE)) {
  keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
} else {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  keys = { kid: crypto.randomUUID(), priv: privateKey.export({ format: 'jwk' }), pub: publicKey.export({ format: 'jwk' }) };
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys));
}
const privKey = crypto.createPrivateKey({ key: keys.priv, format: 'jwk' });
const pubKey = crypto.createPublicKey({ key: keys.pub, format: 'jwk' });
const b64u = (s) => Buffer.from(s).toString('base64url');

function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: keys.kid }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privKey, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${sig.toString('base64url')}`;
}
function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  try {
    return crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
  } catch { return false; }
}

const USER = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: USER_EMAIL,
  email_confirmed_at: '2026-06-17T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Mock Studio' }, created_at: '2026-06-17T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
};
function session() {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 365 * 24 * 3600;
  const access_token = signJwt({
    iss: `${ORIGIN}/auth/v1`, sub: USER_ID, aud: 'authenticated', exp, iat, email: USER_EMAIL,
    role: 'authenticated', aal: 'aal1', session_id: 'mock-session', is_anonymous: false,
  });
  return { access_token, token_type: 'bearer', expires_in: exp - iat, expires_at: exp, refresh_token: 'mock-refresh', user: USER };
}
// @supabase/ssr's cookie: `sb-<first label of the API host>-auth-token`, value
// "base64-" + base64url(session JSON). Short enough to need no chunking.
const COOKIE_NAME = `sb-${new URL(ORIGIN).hostname.split('.')[0]}-auth-token`;
fs.writeFileSync(path.join(STATE, 'session-cookie-name.txt'), COOKIE_NAME);
fs.writeFileSync(path.join(STATE, 'session-cookie.txt'), `base64-${b64u(JSON.stringify(session()))}`);

// ── PostgREST ────────────────────────────────────────────────────────────────
let db = buildFixtures();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Range',
  'Access-Control-Max-Age': '86400',
};
function send(res, status, body, headers = {}, headOnly = false) {
  const h = { ...CORS, ...headers };
  if (body === null || status === 204) { res.writeHead(status, h); res.end(); return; }
  const buf = Buffer.from(JSON.stringify(body));
  h['Content-Type'] = 'application/json; charset=utf-8';
  h['Content-Length'] = buf.length;
  res.writeHead(status, h);
  res.end(headOnly ? undefined : buf);
}
const pgError = (code, message, status = 400) => Object.assign(new Error(message), { pg: { code, message, details: null, hint: null }, status });

/** Split on a separator at parenthesis depth 0, outside double quotes. */
function splitTop(s, sep = ',') {
  const out = []; let depth = 0; let quoted = false; let cur = '';
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const unquote = (s) => (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"' ? s.slice(1, -1) : s);

/** `col->a->>b` → { name: 'col', path: [['->','a'], ['->>','b']] } */
function parsePath(expr) {
  const parts = expr.split(/(->>|->)/);
  const p = [];
  for (let i = 1; i < parts.length; i += 2) p.push([parts[i], parts[i + 1]]);
  return { name: parts[0], path: p };
}
function walk(value, p) {
  let v = value === undefined ? null : value;
  for (const [op, key] of p) {
    if (v == null) return null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
    v = Array.isArray(v) && /^\d+$/.test(key) ? v[Number(key)] : v[key];
    if (v === undefined) v = null;
    if (op === '->>' && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return v;
}
const colValue = (row, expr) => { const { name, path: p } = parsePath(expr); return walk(row[name], p); };

function parseSelect(sel) {
  if (!sel) return [{ kind: 'star' }];
  return splitTop(sel).map((raw) => {
    let item = raw;
    let alias = null;
    const aliased = item.match(/^([A-Za-z_]\w*):(?!:)/);
    if (aliased) { alias = aliased[1]; item = item.slice(aliased[0].length); }
    const paren = item.indexOf('(');
    if (paren !== -1 && item.endsWith(')')) {
      // `table!hint(...)`: the hint names the foreign-key column to follow.
      const [table, hint = null] = item.slice(0, paren).split('!');
      return { kind: 'embed', table, hint, alias: alias || table, items: parseSelect(item.slice(paren + 1, -1)) };
    }
    item = item.replace(/::\w+$/, '');
    if (item === '*') return { kind: 'star' };
    const { name, path: p } = parsePath(item);
    return { kind: 'col', name, path: p, alias: alias || (p.length ? p[p.length - 1][1] : name) };
  });
}
const singular = (t) => (t.endsWith('ies') ? `${t.slice(0, -3)}y` : t.endsWith('s') ? t.slice(0, -1) : t);
function project(row, items, table) {
  const out = {};
  for (const it of items) {
    if (it.kind === 'star') Object.assign(out, row);
    else if (it.kind === 'col') out[it.alias] = walk(row[it.name], it.path);
    else {
      const target = db[it.table] || [];
      const own = (col) => Object.prototype.hasOwnProperty.call(row, col);
      // To-one when this row holds the key (the hinted column, else <table>_id);
      // otherwise to-many through the child's key back to this row.
      const fk = it.hint && own(it.hint) ? it.hint : `${singular(it.table)}_id`;
      if (own(fk)) {
        const hit = target.find((x) => x.id === row[fk]);
        out[it.alias] = hit ? project(hit, it.items, it.table) : null;
      } else {
        const back = it.hint || `${singular(table)}_id`;
        out[it.alias] = target.filter((x) => x[back] === row.id).map((x) => project(x, it.items, it.table));
      }
    }
  }
  return out;
}

const isTs = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x);
function cmp(a, b) {
  if (a == null) return Number.NaN;
  if (typeof a === 'boolean') return a === (b === 'true') ? 0 : Number.NaN;
  if (typeof a === 'number') { const n = Number(b); return Number.isNaN(n) ? Number.NaN : a - n; }
  const s = typeof a === 'object' ? JSON.stringify(a) : String(a);
  if (isTs(s) && isTs(b)) return Date.parse(s) - Date.parse(b);
  return s < b ? -1 : s > b ? 1 : 0;
}
const listArg = (arg) => splitTop(arg.replace(/^\(/, '').replace(/\)$/, '')).map(unquote);
function arrayArg(arg) {
  if (arg.startsWith('{') && !arg.startsWith('{"')) return arg.slice(1, -1).split(',').filter(Boolean).map(unquote);
  try { return JSON.parse(arg); } catch { return [arg]; }
}
function test(v, op, arg) {
  switch (op) {
    case 'eq': return cmp(v, arg) === 0;
    case 'neq': return v != null && cmp(v, arg) !== 0;
    case 'gt': return cmp(v, arg) > 0;
    case 'gte': return cmp(v, arg) >= 0;
    case 'lt': return cmp(v, arg) < 0;
    case 'lte': return cmp(v, arg) <= 0;
    case 'like':
    case 'ilike': {
      if (v == null) return false;
      const re = new RegExp(`^${arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`, op === 'ilike' ? 'is' : 's');
      return re.test(String(v));
    }
    case 'is': return arg === 'null' ? v == null : arg === 'true' ? v === true : arg === 'false' ? v === false : false;
    case 'in': return listArg(arg).some((x) => cmp(v, x) === 0);
    case 'cs': {
      const want = arrayArg(arg);
      if (Array.isArray(v)) return [].concat(want).every((w) => v.map(String).includes(String(w)));
      if (v && typeof v === 'object' && want && typeof want === 'object') return Object.entries(want).every(([k, x]) => JSON.stringify(v[k]) === JSON.stringify(x));
      return false;
    }
    case 'cd': { const allow = [].concat(arrayArg(arg)).map(String); return Array.isArray(v) && v.every((x) => allow.includes(String(x))); }
    case 'ov': { const any = [].concat(arrayArg(arg)).map(String); return Array.isArray(v) && v.some((x) => any.includes(String(x))); }
    case 'fts': case 'plfts': case 'phfts': case 'wfts':
      return v != null && String(v).toLowerCase().includes(arg.replace(/^\([^)]*\)/, '').toLowerCase());
    default: throw pgError('PGRST100', `mock: unsupported operator "${op}"`);
  }
}

function leaf(col, expr) {
  let rest = expr; let not = false;
  if (rest.startsWith('not.')) { not = true; rest = rest.slice(4); }
  const dot = rest.indexOf('.');
  if (dot === -1) throw pgError('PGRST100', `mock: cannot parse filter "${col}=${expr}"`);
  return { kind: 'leaf', col, not, op: rest.slice(0, dot), arg: rest.slice(dot + 1) };
}
function token(tok) {
  let t = tok; let not = false;
  if (t.startsWith('not.')) { not = true; t = t.slice(4); }
  const logic = t.match(/^(and|or)\(([\s\S]*)\)$/);
  if (logic) return { kind: logic[1], not, children: splitTop(logic[2]).map(token) };
  const dot = t.indexOf('.');
  const node = leaf(t.slice(0, dot), t.slice(dot + 1));
  if (not) node.not = !node.not;
  return node;
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function conditions(url) {
  const out = [];
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    const logic = key.match(/^(not\.)?(and|or)$/);
    if (logic) { out.push({ kind: logic[2], not: !!logic[1], children: splitTop(value.replace(/^\(/, '').replace(/\)$/, '')).map(token) }); continue; }
    if (key.includes('.')) continue; // a filter on an embedded resource: not needed here
    out.push(leaf(key, value));
  }
  return out;
}
function holds(row, c) {
  const r = c.kind === 'leaf' ? test(colValue(row, c.col), c.op, c.arg)
    : c.kind === 'and' ? c.children.every((x) => holds(row, x))
      : c.children.some((x) => holds(row, x));
  return c.not ? !r : r;
}
function sorter(order) {
  const keys = splitTop(order).map((t) => {
    const bits = t.split('.');
    const desc = bits.includes('desc');
    const nullsFirst = bits.includes('nullsfirst') ? true : bits.includes('nullslast') ? false : desc;
    return { col: bits[0], desc, nullsFirst };
  });
  return (a, b) => {
    for (const k of keys) {
      const x = colValue(a, k.col); const y = colValue(b, k.col);
      if (x == null && y == null) continue;
      if (x == null) return k.nullsFirst ? -1 : 1;
      if (y == null) return k.nullsFirst ? 1 : -1;
      let d;
      if (typeof x === 'number' && typeof y === 'number') d = x - y;
      else if (typeof x === 'boolean') d = x === y ? 0 : x ? 1 : -1;
      else if (isTs(x) && isTs(y)) d = Date.parse(x) - Date.parse(y);
      else d = String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
      if (d) return k.desc ? -d : d;
    }
    return 0;
  };
}

function handleRest(req, res, url, body) {
  const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?(\w+)$/);
  if (!m) return send(res, 404, { code: 'PGRST125', message: 'Invalid path specified in request URL' });
  if (m[1]) return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${m[2]} in the schema cache` });
  const table = m[2];
  if (!db[table]) return send(res, 404, { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` });
  const items = parseSelect(url.searchParams.get('select'));
  const conds = conditions(url);
  const match = (row) => conds.every((c) => holds(row, c));
  const prefer = String(req.headers.prefer || '');
  const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object+json');
  const reply = (status, rows) => {
    if (!/return=representation/.test(prefer)) return send(res, status === 201 ? 201 : 204, null);
    const out = rows.map((r) => project(r, items, table));
    return send(res, status, wantsObject ? (out[0] ?? null) : out);
  };

  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = db[table].filter(match);
    const total = rows.length;
    const order = url.searchParams.get('order');
    if (order) rows = rows.slice().sort(sorter(order));
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = url.searchParams.get('limit');
    rows = rows.slice(offset, limit != null ? offset + Number(limit) : undefined);
    const headers = {};
    if (/count=(exact|planned|estimated)/.test(prefer)) {
      headers['Content-Range'] = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
    }
    const out = rows.map((r) => project(r, items, table));
    if (wantsObject) {
      if (out.length !== 1) {
        return send(res, 406, { code: 'PGRST116', details: `The result contains ${out.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, headers);
      }
      return send(res, 200, out[0], headers, req.method === 'HEAD');
    }
    return send(res, 200, out, headers, req.method === 'HEAD');
  }
  if (req.method === 'POST') {
    let input = body ? JSON.parse(body) : [];
    if (!Array.isArray(input)) input = [input];
    const onConflict = (url.searchParams.get('on_conflict') || 'id').split(',');
    const merge = /resolution=merge-duplicates/.test(prefer);
    const ignore = /resolution=ignore-duplicates/.test(prefer);
    const now = new Date().toISOString();
    const written = [];
    for (const r of input) {
      const existing = merge || ignore ? db[table].find((x) => onConflict.every((k) => r[k] !== undefined && x[k] === r[k])) : null;
      if (existing) { if (merge) Object.assign(existing, r); written.push(existing); continue; }
      const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...r };
      db[table].push(row);
      written.push(row);
    }
    return reply(201, written);
  }
  if (req.method === 'PATCH') {
    const patch = body ? JSON.parse(body) : {};
    const rows = db[table].filter(match);
    for (const r of rows) Object.assign(r, patch);
    return reply(200, rows);
  }
  if (req.method === 'DELETE') {
    const rows = db[table].filter(match);
    db[table] = db[table].filter((r) => !rows.includes(r));
    return reply(200, rows);
  }
  return send(res, 405, { code: 'PGRST117', message: `Unsupported HTTP method: ${req.method}` });
}

function handleAuth(req, res, url) {
  const p = url.pathname.slice('/auth/v1'.length);
  if (p === '/.well-known/jwks.json') return send(res, 200, { keys: [{ ...keys.pub, kid: keys.kid, alg: 'ES256', use: 'sig', key_ops: ['verify'], ext: true }] });
  if (p === '/user') {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return verifyJwt(bearer) ? send(res, 200, USER) : send(res, 403, { code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' });
  }
  if (p === '/token') return send(res, 200, session());
  if (p === '/logout') return send(res, 204, null);
  if (p === '/settings') return send(res, 200, { external: { email: true }, disable_signup: false });
  return send(res, 404, { code: 404, msg: `mock: ${p} is not mocked` });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, ORIGIN);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    if (url.pathname === '/__mock/reset') { db = buildFixtures(); return send(res, 200, { reset: true }); }
    await sleep(rtt());
    try {
      if (url.pathname.startsWith('/auth/v1')) return handleAuth(req, res, url);
      if (url.pathname.startsWith('/rest/v1')) return handleRest(req, res, url, body);
      return send(res, 404, { message: `mock: ${url.pathname} is not mocked` });
    } catch (e) {
      if (e.pg) return send(res, e.status, e.pg);
      return send(res, 500, { code: 'MOCK500', message: String((e && e.stack) || e) });
    }
  });
});
server.on('upgrade', (req, socket) => socket.destroy()); // Realtime is not mocked.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock supabase · ${ORIGIN} · state ${STATE} · rtt ${rtt()} ms`);
});
