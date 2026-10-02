#!/usr/bin/env node
// ── SHIP ────────────────────────────────────────────────────────────────────
//
// One command, from anywhere, that puts Zenboard in production and PROVES it.
// `npm run ship` — or `/ship` in any Claude chat.
//
// It is the four steps that were previously typed by hand, in the one order
// that is safe, with the smoke probe folded in so a green deploy is never
// confused with a working one:
//
//   1. GATE    tsc + the full suite. A red suite can never ship.
//   2. BUILD   OpenNext. It READS the working tree — don't edit sources until
//              it says "OpenNext build complete".
//   3. MEASURE the gzipped worker. Cloudflare's per-plan ceiling is checked by
//              TOUCHING it (an over-size upload is refused and the live version
//              stays), so this only ever WARNS — it never blocks a deploy on a
//              remembered number. 2026-09-27: 3,139 KiB shipped fine.
//   4. DEPLOY  `--keep-vars` is MANDATORY. wrangler.jsonc declares no `vars`,
//              and a plain deploy DELETES every dashboard-set secret
//              (SUPABASE_SERVICE_ROLE_KEY, GOOGLE_OAUTH_*, GEMINI_API_KEY,
//              RESEND_API_KEY) — silently killing uploads, Calendar, AI, email.
//   5. SMOKE   the probes that actually prove something. See below.
//
// `--dry` stops after MEASURE. `--skip-gate` is for a re-ship of a tree that
// just passed; it is not for making a red suite go away.
import { execSync, spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const SKIP_GATE = args.has('--skip-gate');

const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m` };
const step = (n, t) => console.log(`\n${c.b(`[${n}/${DRY ? 3 : 5}] ${t}`)}`);
const die = (msg) => { console.error(`\n${c.r('✗ ' + msg)}\n`); process.exit(1); };

function run(cmd, label) {
  const r = spawnSync(cmd, { shell: true, cwd: APP, stdio: 'inherit' });
  if (r.status !== 0) die(`${label} failed (exit ${r.status}). Nothing was deployed.`);
}

// ── 1. GATE ────────────────────────────────────────────────────────────────
if (SKIP_GATE) {
  console.log(c.y('\n! gate skipped (--skip-gate)'));
} else {
  step(1, 'Gate — tsc + full suite');
  run('npx tsc --noEmit', 'Typecheck');
  run('npx vitest run', 'Tests');
}

// ── 2. BUILD ───────────────────────────────────────────────────────────────
step(2, 'Build — OpenNext → Cloudflare Worker');
run('npx opennextjs-cloudflare build', 'OpenNext build');

// ── 3. MEASURE ─────────────────────────────────────────────────────────────
//
// MEASURE THE BUNDLE, NOT THE ENTRY. `.open-next/worker.js` is the OpenNext
// ENTRY — wrangler bundles it into the real worker afterwards. Gzipping the
// entry reports ~0.7 KiB for a 3 MB worker, which is a lie that always reads
// as "loads of headroom". The only honest number is wrangler's own output, and
// `--dry-run` needs no credentials. `Total Upload` in its log is NOT it either:
// that counts static assets, which the worker limit does not.
step(3, 'Measure — gzipped worker (bundled)');
const outdir = mkdtempSync(join(tmpdir(), 'zb-size-'));
run(`npx wrangler deploy --dry-run --outdir '${outdir}'`, 'Size dry-run');
const bundled = join(outdir, 'worker.js');
if (!existsSync(bundled)) die('wrangler --dry-run produced no worker.js to measure.');
const kib = gzipSync(readFileSync(bundled), { level: 9 }).length / 1024;
rmSync(outdir, { recursive: true, force: true });
const FREE = 3072;   // the FREE plan's gzipped worker limit, kept as a reference point only.
console.log(`  worker: ${c.b(kib.toFixed(2) + ' KiB gz')}`);
//
// DO NOT TURN THIS INTO A WARNING THAT FIRES EVERY RUN. It used to print a red
// "! over the ceiling" on every ship, which is false for this account — 3,139
// and 3,144 KiB both uploaded fine on 2026-09-27 — and a warning that cries
// wolf on every run is one nobody reads on the run that matters. The real
// ceiling is whatever Cloudflare enforces for the plan, and the honest way to
// learn it is to TOUCH it: an over-size upload is refused with `code: 10027`
// and the live version is untouched. So this only ever reports the number.
console.log(c.dim(`  ${kib > FREE ? (kib - FREE).toFixed(2) + ' KiB above' : (FREE - kib).toFixed(2) + ' KiB below'} the ${FREE} KiB free-plan reference.`));
console.log(c.dim('  Deploys above it are fine on this account. If one is ever refused (10027),'));
console.log(c.dim('  known waste to reclaim: chrono-node ships a ~38 KiB gz SSR copy the server'));
console.log(c.dim('  never uses; GuestFocus/Warp (canvas) is statically imported in site-home + legal.'));
if (DRY) { console.log(c.g('\n✓ dry run — built and measured, nothing deployed.\n')); process.exit(0); }

// ── 4. DEPLOY ──────────────────────────────────────────────────────────────
step(4, 'Deploy — wrangler, --keep-vars');
run('npx opennextjs-cloudflare deploy --keep-vars', 'Deploy');

// ── 5. SMOKE ───────────────────────────────────────────────────────────────
//
// Each probe is here because it can FAIL in a way that matters:
//   /today → /login  the only probe that proves the worker booted AND reached
//                    Supabase. A 500 here is a wiped runtime env (see --keep-vars).
//   /                200, NOT a redirect: since 2026-09-27 the root is the
//                    marketing site for anyone without an sb-…-auth-token cookie.
//   /f/does-not-exist 200 BY DESIGN, never 404 — one calm page for every
//                    unavailable reason, so a stranger cannot enumerate tokens.
//   /dev-preview/ds  404 proves the page.dev.tsx gating held and the harness
//                    (3.6 MB of server output) did not ship.
//   POST /api/mcp    401 proves the bearer check is on.
step(5, 'Smoke — production');
const ORIGINS = [process.env.SHIP_ORIGIN, 'https://zenboard-web.designdotrushil.workers.dev'].filter(Boolean);
const PROBES = [
  ['/today', 307, 'worker booted + reached Supabase'],
  ['/', 200, 'marketing site for signed-out'],
  ['/login', 200, ''],
  ['/dev-preview/ds', 404, 'harness gating held'],
  ['/f/does-not-exist', 200, 'by design — never 404'],
  ['/api/mcp', 200, ''],
];
let failed = 0;
for (const origin of ORIGINS) {
  console.log(`\n  ${c.b(origin)}`);
  for (const [path, want, why] of PROBES) {
    let got = '000';
    try { got = execSync(`curl -s -o /dev/null -w '%{http_code}' --max-time 25 '${origin}${path}'`, { encoding: 'utf8' }).trim(); } catch {}
    const ok = got === String(want);
    if (!ok) failed++;
    console.log(`  ${ok ? c.g('✓') : c.r('✗')} ${path.padEnd(20)} ${got} ${c.dim(ok ? why : `expected ${want}`)}`);
  }
  let post = '000';
  try { post = execSync(`curl -s -o /dev/null -w '%{http_code}' --max-time 25 -X POST '${origin}/api/mcp'`, { encoding: 'utf8' }).trim(); } catch {}
  const ok = post === '401';
  if (!ok) failed++;
  console.log(`  ${ok ? c.g('✓') : c.r('✗')} ${'POST /api/mcp'.padEnd(20)} ${post} ${c.dim(ok ? 'bearer required' : 'expected 401')}`);
}
if (failed) die(`${failed} probe(s) failed. The deploy IS live — investigate before calling it done.`);
console.log(c.g('\n✓ Shipped and verified.\n'));
