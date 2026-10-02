'use strict';
// Measurement tool only. Print every Supabase call of each traced request, in
// order, with the WAVE it sits in: 1 + the deepest wave among calls that had
// already finished when it began — how many round trips were paid in series.
//   node scripts/perf/waves.cjs .perf/trace-3103.jsonl [urlSubstring] [--bench label]
const fs = require('node:fs');

const [file, filter = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const bi = process.argv.indexOf('--bench');
const bench = bi === -1 ? null : process.argv[bi + 1];
const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const reqs = lines.filter((l) => l.type === 'req' && !l.prefetch && l.url.includes(filter) && (!bench || (l.bench || '').startsWith(bench)));
const calls = lines.filter((l) => l.type === 'sb');

for (const r of reqs) {
  const c = calls.filter((x) => x.req === r.id).sort((a, b) => a.start - b.start);
  for (const x of c) {
    const before = c.filter((p) => p !== x && p.start + p.ms <= x.start + 1);
    x.wave = 1 + Math.max(0, ...before.map((p) => p.wave || 0));
  }
  const waves = Math.max(0, ...c.map((x) => x.wave));
  console.log(`\n#${r.id} ${r.method} ${r.rsc ? 'RSC ' : ''}${r.action ? 'ACTION ' : ''}${r.url} status=${r.status} ttfb=${r.ttfb}ms total=${r.total}ms calls=${c.length} waves=${waves}${r.bench ? ` bench=${r.bench}` : ''}`);
  for (const x of c) {
    console.log(`  w${x.wave} +${String(Math.round(x.start)).padStart(5)}ms ${String(Math.round(x.ms)).padStart(4)}ms ${String(x.bytes ?? '?').padStart(7)}B ${x.status} ${x.method.padEnd(4)} ${x.path.padEnd(18)} ${x.query.replace(/^\?select=/, '').slice(0, 100)}`);
  }
}
