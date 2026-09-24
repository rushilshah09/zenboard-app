// ── DEAD COLOUR CLASS AUDIT, NO DEPENDENCIES ───────────────────────────────
// A Tailwind colour class can render as nothing in two ways:
//
//   1. its name was never declared in `@theme`, so Tailwind generates NO CSS for
//      it (`text-danger` until 2026-09-14; `active:bg-danger-700`, `bg-surface`,
//      `ring-berry-alpha-20` and seven more until later that day). The static
//      guard in app/design-system.test.ts now catches this kind on every run.
//   2. the name IS declared but its value chain resolves to nothing, so the CSS
//      exists and does nothing. Only a browser can see this kind, which is what
//      the second half of this script is for. None found as of 2026-09-14.
//
// NOT an instance of either: `border-berry-500` computing to near-black. The
// `berry-*` UTILITIES are aliased to the ink ramp on purpose (globals.css, the
// B&G monochrome remap) while `var(--color-berry-500)` is still magenta — one
// name, two colours, depending on how it is read. An earlier note here called
// that "declared but valueless"; the measurement says otherwise.
//
// Usage (needs `next dev` running):
//   node --experimental-websocket scripts/verify/audit-colour-classes.mjs http://localhost:3000
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { colourClassTokens, readTheme, sourceFiles, undeclaredColourClasses } from './colour-classes.mjs';

const [base] = process.argv.slice(2);

// ── 1. Colour classes in source, with where they are ─────────────────────────
// The SAME scanner as the static guard (colour-classes.mjs), so the audit and the
// test cannot disagree about what counts as a colour class.
const where = new Map();
for (const file of sourceFiles(['components', 'app', 'lib'])) {
  for (const { token, line } of colourClassTokens(readFileSync(file, 'utf8'))) {
    if (!where.has(token)) where.set(token, []);
    where.get(token).push(`${file}:${line}`);
  }
}
const theme = readTheme('app');
const classes = [...where.keys()];
console.error(`source: ${classes.length} distinct colour-prefixed class tokens`);

// ── 2. Ask the browser ───────────────────────────────────────────────────────
const PORT = 9340, profile = mkdtempSync(join(tmpdir(), 'zb-colour-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };

const PROBE = `(async (classes) => {
  // Every rule in every sheet, flattened through layers, media and supports.
  const rules = [];
  const visit = (list) => { for (const r of list) { if (r.selectorText) rules.push(r); if (r.cssRules) visit(r.cssRules); } };
  for (const sheet of document.styleSheets) { try { visit(sheet.cssRules); } catch {} }
  const byClass = new Map();
  for (const r of rules) {
    for (const m of r.selectorText.matchAll(/\\.((?:\\\\.|[^\\s.:#>+~,\\[\\]()])+)/g)) {
      const name = m[1].replace(/\\\\(.)/g, '$1');
      if (!byClass.has(name)) byClass.set(name, []);
      byClass.get(name).push(r);
    }
  }
  const COLOUR_PROPS = /^(color|background-color|border-color|border-(top|right|bottom|left|x|y|inline|block|inline-start|inline-end|block-start|block-end)-color|outline-color|fill|stroke|caret-color|text-decoration-color|accent-color|--tw-(ring|ring-offset|shadow|inset-shadow|inset-ring)-color|--tw-gradient-(from|via|to))$/;
  // Declarations AS AUTHORED. Enumerating \`rule.style\` gives longhands, and the
  // longhands of a shorthand written with var() report an EMPTY value — which the
  // first run of this audit read as "resolves to nothing" and called the app's
  // most-used border dead. \`cssText\` keeps \`border-color: var(--…)\` intact.
  const declsOf = (r) => {
    const out = [];
    for (const part of r.style.cssText.split(';')) {
      const i = part.indexOf(':'); if (i < 0) continue;
      const prop = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim().replace(/\s*!important$/, '');
      if (COLOUR_PROPS.test(prop) && value) out.push([prop, value]);
    }
    return out;
  };
  const SENTINEL = 'rgb(1, 2, 3)';
  const parent = document.createElement('div');
  parent.style.color = SENTINEL;
  const child = document.createElement('div');
  parent.appendChild(child); document.body.appendChild(parent);
  // Resolve a declared value the way the page would: on an inheriting property,
  // so a value that is invalid at computed time falls back to the sentinel.
  const resolves = (value) => {
    if (/^(inherit|currentcolor|currentColor|transparent|initial|unset|revert)$/.test(value.trim())) return true;
    child.style.color = ''; child.style.setProperty('color', value);
    return getComputedStyle(child).color !== SENTINEL;
  };
  const out = { noCss: [], deadLight: [], deadDark: [] };
  const root = document.documentElement; const prev = root.dataset.theme;
  const rows = classes.map((cls) => {
    const found = byClass.get(cls) || [];
    const decls = found.flatMap(declsOf);
    return { cls, generated: found.length > 0, decls };
  });
  for (const theme of ['light', 'dark']) {
    root.dataset.theme = theme;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const row of rows) {
      if (!row.generated || !row.decls.length) continue;
      if (theme === 'light' && /(^|:)dark:/.test(row.cls)) continue;
      if (theme === 'dark' && /(^|:)light:/.test(row.cls)) continue;
      const bad = row.decls.filter(([, v]) => !resolves(v));
      if (bad.length) out[theme === 'light' ? 'deadLight' : 'deadDark'].push({ cls: row.cls, decl: bad[0] });
    }
  }
  root.dataset.theme = prev || 'light';
  parent.remove();
  out.noCss = rows.filter((r) => !r.generated).map((r) => r.cls);
  return out;
})`;

const report = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `${base}/dev-preview/ds` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`document.styleSheets.length > 0 && !!document.body && document.readyState === 'complete'`).catch(() => false)) break; }
  await sleep(1500);
  // Ruler self-test: a known-live and a known-dead value must be told apart.
  report.rulerSelfTest = await ev(`(() => { const p = document.createElement('div'); p.style.color = 'rgb(1, 2, 3)'; const c = document.createElement('div'); p.appendChild(c); document.body.appendChild(p);
    c.style.setProperty('color', 'var(--color-danger-600)'); const live = getComputedStyle(c).color;
    c.style.color = ''; c.style.setProperty('color', 'var(--this-token-does-not-exist)'); const dead = getComputedStyle(c).color;
    p.remove(); return { live, dead, ok: live !== 'rgb(1, 2, 3)' && dead === 'rgb(1, 2, 3)' }; })()`);
  // …and the SHORTHAND path, through a real generated rule. \`border-line-soft\` draws
  // the app's commonest visible border, so the audit must call it live.
  report.rulerShorthandSelfTest = await ev(`(() => {
    const rules = []; const visit = (l) => { for (const r of l) { if (r.selectorText) rules.push(r); if (r.cssRules) visit(r.cssRules); } };
    for (const s of document.styleSheets) { try { visit(s.cssRules); } catch {} }
    const rule = rules.find((r) => r.selectorText === '.border-line-soft');
    const m = rule && /border-color:\s*([^;]+)/.exec(rule.style.cssText);
    const p = document.createElement('div'); p.style.color = 'rgb(1, 2, 3)'; const c = document.createElement('div'); p.appendChild(c); document.body.appendChild(p);
    c.style.setProperty('color', m ? m[1].trim() : ''); const got = getComputedStyle(c).color; p.remove();
    return { declared: m && m[1].trim(), resolved: got, ok: !!m && got !== 'rgb(1, 2, 3)' };
  })()`);
  const res = await ev(`${PROBE}(${JSON.stringify(classes)})`);
  const withWhere = (list) => list.map((x) => { const cls = typeof x === 'string' ? x : x.cls; return { ...(typeof x === 'string' ? { cls } : x), uses: where.get(cls).length, at: where.get(cls).slice(0, 3) }; });
  report.deadLight = withWhere(res.deadLight);
  report.deadDark = withWhere(res.deadDark);
  report.noCssCount = res.noCss.length;
  // No generated CSS AND names a colour family: the static guard's verdict, checked
  // against what the browser actually received.
  const staticVerdict = new Set(sourceFiles(['components', 'app', 'lib']).flatMap((f) => undeclaredColourClasses(readFileSync(f, 'utf8'), theme).map((o) => o.token)));
  const families = (cls) => theme.families.has((colourClassTokens(`"${cls}"`)[0]?.name ?? '').split('-')[0]);
  report.noCss = withWhere(res.noCss.filter(families));
  report.noCssCount = report.noCss.length;
  report.staticGuardAgrees = report.noCss.every((r) => staticVerdict.has(r.cls)) && [...staticVerdict].every((c) => res.noCss.includes(c));
} catch (e) { report.error = String(e?.message || e); }
finally {
  console.log(JSON.stringify(report, null, 2));
  try { ws?.close(); } catch {} chrome.kill('SIGKILL'); await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
