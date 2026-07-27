// Client-portal security suite. Seeds a throwaway owner with sensitive data
// (notes, estimates, time, money), enables the portal, then asserts the public
// token route only ever exposes the allowed projection and that anon has no
// direct access. Cleans up the throwaway afterwards (cascade).
//
// Run with the dev server up:   node scripts/portal-security-test.mjs
// Requires migration 0006_portal.sql to be applied first (it auto-detects).
import { readFileSync } from 'node:fs';

const BASE = process.env.PORTAL_BASE || 'http://localhost:3000';
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1].trim();
const URL_ = get('NEXT_PUBLIC_SUPABASE_URL');
const SVC = get('SUPABASE_SERVICE_ROLE_KEY');
const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const Hs = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=representation' };

let pass = 0, fail = 0;
const ok = (name, cond) => { (cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ FAIL: ' + name))); };

const rest = (t, b, method = 'POST') => fetch(URL_ + '/rest/v1/' + t, { method, headers: Hs, body: JSON.stringify(b) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(t + ' ' + r.status + ' ' + JSON.stringify(j)); return j; });
const patch = (t, q, b) => fetch(URL_ + '/rest/v1/' + t + '?' + q, { method: 'PATCH', headers: Hs, body: JSON.stringify(b) }).then((r) => r.ok);
const portalHtml = (token) => fetch(`${BASE}/portal/${token}`).then((r) => r.text());

async function main() {
  // 0006 detection
  const probe = await fetch(URL_ + '/rest/v1/projects?select=portal_token&limit=1', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
  if (probe.status !== 200) {
    console.log('\n⚠ Migration 0006_portal.sql is NOT applied yet — portal columns are missing.');
    console.log('  Apply it in the Supabase SQL editor, then re-run this script.\n');
    process.exit(2);
  }

  // ── Test A: anon has no direct table access (RLS never opened to anon) ──
  console.log('\nA. anon lockdown');
  for (const t of ['projects', 'tasks', 'pages', 'invoices', 'time_entries', 'client_requests']) {
    const r = await fetch(URL_ + '/rest/v1/' + t + '?select=*&limit=5', { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
    const j = await r.json().catch(() => null);
    ok(`anon SELECT ${t} → 0 rows`, Array.isArray(j) && j.length === 0);
  }
  const ai = await fetch(URL_ + '/rest/v1/client_requests', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: '00000000-0000-0000-0000-000000000000', client_token: 'x', body: 'hack' }) });
  ok('anon INSERT client_requests → rejected', ai.status === 401 || ai.status === 403);

  // ── Seed throwaway owner with sensitive data ──
  const email = 'zb-sec-test@zenboard.test', password = 'ZbSec!' + Date.now();
  const list = await fetch(URL_ + '/auth/v1/admin/users?per_page=200', { headers: Hs }).then((r) => r.json());
  for (const u of (list.users || [])) if (u.email === email) await fetch(URL_ + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: Hs });
  const u = await fetch(URL_ + '/auth/v1/admin/users', { method: 'POST', headers: Hs, body: JSON.stringify({ email, password, email_confirm: true }) }).then((r) => r.json());
  const uid = u.id;
  const [space] = await rest('spaces', [{ user_id: uid, name: 'Secret Studio', tag: 'WORK' }]);
  // a SECOND project the client must never see
  const [other] = await rest('projects', [{ user_id: uid, space_id: space.id, name: 'OTHER-PROJECT-LEAK', status: 'active' }]);
  const [proj] = await rest('projects', [{
    user_id: uid, space_id: space.id, name: 'Aurora Rebrand', status: 'active',
    portal_enabled: true, portal_token: 'sec' + Math.random().toString(36).slice(2, 14),
    share_progress: true, share_completed_tasks: true, share_open_tasks: false,
    share_timeline: true, share_files: false, allow_requests: true, portal_intro: 'Welcome to your project portal.',
  }]);
  const token = proj.portal_token;
  const T = (o) => Object.assign({ user_id: uid, space_id: space.id, project_id: proj.id, title: '', done: false, notes: null, estimate_minutes: null, completed_at: null, client_visible: false }, o);
  const [tDone] = await rest('tasks', [T({ title: 'Logo concepts v1', done: true, completed_at: new Date().toISOString(), estimate_minutes: 240, notes: 'SECRETNOTE-internal' })]);
  const [tOpen] = await rest('tasks', [T({ title: 'Homepage hero design', done: false, estimate_minutes: 180, notes: 'CONFIDENTIAL-approach' })]);
  await rest('tasks', [T({ title: 'OTHERPROJECTTASK', project_id: other.id })]);
  await rest('time_entries', [{ user_id: uid, project_id: proj.id, task_id: tDone.id, started_at: new Date().toISOString(), minutes: 999, source: 'manual' }]);
  const [doc] = await rest('pages', [{ user_id: uid, space_id: space.id, project_id: proj.id, title: 'Brand Brief', type: 'doc', content: { text: 'DOC-BODY-VISIBLE' }, client_visible: false }]);

  // ── Test B: projection exposes only allowed fields ──
  console.log('\nB. projection (progress+completed+timeline on; open+files off)');
  let html = await portalHtml(token);
  ok('shows project name', html.includes('Aurora Rebrand'));
  ok('shows studio/space name', html.includes('Secret Studio'));
  ok('shows intro', html.includes('Welcome to your project portal'));
  ok('shows completed task title', html.includes('Logo concepts v1'));
  ok('HIDES open task (share_open_tasks off)', !html.includes('Homepage hero design'));
  ok('NEVER leaks notes (SECRETNOTE)', !html.includes('SECRETNOTE'));
  ok('NEVER leaks notes (CONFIDENTIAL)', !html.includes('CONFIDENTIAL'));
  ok('NEVER leaks estimate minutes (240/180)', !html.includes('240') && !/\b180\b/.test(html));
  ok('NEVER leaks logged time (999)', !html.includes('999'));
  ok('HIDES other project', !html.includes('OTHER-PROJECT-LEAK') && !html.includes('OTHERPROJECTTASK'));
  ok('HIDES docs when share_files off', !html.includes('Brand Brief') && !html.includes('DOC-BODY-VISIBLE'));

  // ── Test D: toggling flags immediately changes the live projection ──
  console.log('\nD. flag toggles change live projection (no stale cache)');
  await patch('projects', 'id=eq.' + proj.id, { share_open_tasks: true });
  html = await portalHtml(token);
  ok('open task appears after share_open_tasks=true', html.includes('Homepage hero design'));
  ok('open task still hides its notes', !html.includes('CONFIDENTIAL'));
  // turn off timeline too, since it independently surfaces completed-task titles as "updates"
  await patch('projects', 'id=eq.' + proj.id, { share_completed_tasks: false, share_timeline: false });
  html = await portalHtml(token);
  ok('completed hidden after share_completed_tasks=false', !html.includes('Logo concepts v1'));
  await patch('projects', 'id=eq.' + proj.id, { share_completed_tasks: true, share_open_tasks: false, share_timeline: true });

  // ── Test E: per-item client_visible overrides + docs require share_files ──
  console.log('\nE. client_visible overrides');
  await patch('pages', 'id=eq.' + doc.id, { client_visible: true });
  html = await portalHtml(token);
  ok('doc still hidden (share_files off, even if client_visible)', !html.includes('Brand Brief'));
  await patch('projects', 'id=eq.' + proj.id, { share_files: true });
  html = await portalHtml(token);
  ok('doc shows when share_files on + client_visible', html.includes('Brand Brief') && html.includes('DOC-BODY-VISIBLE'));
  // open task override while share_open_tasks is off
  await patch('projects', 'id=eq.' + proj.id, { share_open_tasks: false });
  await patch('tasks', 'id=eq.' + tOpen.id, { client_visible: true });
  html = await portalHtml(token);
  ok('open task shows via per-task override', html.includes('Homepage hero design'));

  // ── Test C: disabled / rotated token rejected ──
  console.log('\nC. disabled / rotated token');
  await patch('projects', 'id=eq.' + proj.id, { portal_enabled: false });
  html = await portalHtml(token);
  ok('disabled portal → unavailable', /isn.t available/i.test(html) && !html.includes('Aurora Rebrand'));
  const newToken = 'sec' + Math.random().toString(36).slice(2, 14);
  await patch('projects', 'id=eq.' + proj.id, { portal_enabled: true, portal_token: newToken });
  const oldHtml = await portalHtml(token);
  ok('old (rotated-away) token → unavailable', /isn.t available/i.test(oldHtml));
  const newHtml = await portalHtml(newToken);
  ok('new token → works', newHtml.includes('Aurora Rebrand'));

  // ── Test F: request submission token-scoped ──
  console.log('\nF. request submission');
  // service-role insert (what the server action does) works when allowed
  const ins = await fetch(URL_ + '/rest/v1/client_requests', { method: 'POST', headers: Hs, body: JSON.stringify({ project_id: proj.id, client_token: newToken, body: 'Hello from client', status: 'new' }) });
  ok('server-side insert creates request', ins.ok);
  const reqs = await fetch(URL_ + '/rest/v1/client_requests?project_id=eq.' + proj.id + '&select=body', { headers: Hs }).then((r) => r.json());
  ok('request readable by owner side', Array.isArray(reqs) && reqs.some((r) => r.body === 'Hello from client'));

  // ── Cleanup ──
  await fetch(URL_ + '/auth/v1/admin/users/' + uid, { method: 'DELETE', headers: Hs });

  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
