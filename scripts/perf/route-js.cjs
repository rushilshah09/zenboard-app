'use strict';
// Measurement tool only. First-load JavaScript per route from a Next 16
// (Turbopack) production build, which prints no size column of its own.
// first-load = rootMainFiles ∪ the entryJSFiles of every segment a route
// renders (root layout, (app) layout, page). Sizes are gzip level 6.
//   node scripts/perf/route-js.cjs <checkout>/.next
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const NEXT = process.argv[2];
const bm = JSON.parse(fs.readFileSync(path.join(NEXT, 'build-manifest.json'), 'utf8'));
const sizes = new Map();
const size = (f) => {
  if (!sizes.has(f)) { const buf = fs.readFileSync(path.join(NEXT, f)); sizes.set(f, { raw: buf.length, gz: zlib.gzipSync(buf, { level: 6 }).length }); }
  return sizes.get(f);
};
const manifests = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) manifests(p, out); else if (e.name === 'page_client-reference-manifest.js') out.push(p);
  }
  return out;
};
const rows = [];
for (const m of manifests(path.join(NEXT, 'server/app'))) {
  globalThis.__RSC_MANIFEST = {};
  require(path.resolve(m));
  const [key, man] = Object.entries(globalThis.__RSC_MANIFEST)[0];
  const files = new Set(bm.rootMainFiles);
  for (const list of Object.values(man.entryJSFiles)) list.forEach((f) => files.add(f));
  const shared = new Set(bm.rootMainFiles);
  for (const [k, list] of Object.entries(man.entryJSFiles)) if (!k.endsWith('/page')) list.forEach((f) => shared.add(f));
  const pageEntry = Object.entries(man.entryJSFiles).find(([k]) => k.endsWith('/page'));
  let gz = 0; let pageGz = 0;
  for (const f of files) gz += size(f).gz;
  if (pageEntry) for (const f of pageEntry[1]) if (!shared.has(f)) pageGz += size(f).gz;
  rows.push({ route: key.replace(/\/page$/, '') || '/', chunks: files.size, gzKB: +(gz / 1024).toFixed(1), pageOnlyGzKB: +(pageGz / 1024).toFixed(1) });
}
rows.sort((a, b) => b.gzKB - a.gzKB);
console.table(rows);
