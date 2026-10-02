// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// The dead colour classes of 2026-09-14, measured BEFORE and AFTER in both
// themes. A dead class generated no CSS, so its "before" is reproduced exactly
// by removing the replacement class from the live element and reading again.
// The theme comes from the emulated OS preference on a fresh profile, so the
// boot script resolves it — and the ACCENT — the way a first visit does.
//
// Usage (needs `next dev` running):
//   node --experimental-websocket scripts/verify/verify-colour-fixes.mjs http://localhost:3000 <out-dir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page-side instruments. Every colour is resolved through a 1×1 canvas, which
// understands lab()/oklch()/color-mix() output and composites alpha the way the
// page does. `groundOf` composites every ancestor's fill from the root down.
const HELPERS = `window.__zb = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const SENT = '#010203';
  const paint = (c) => { cx.fillStyle = SENT; cx.fillStyle = c; if (cx.fillStyle === SENT && c.replace(/\\s/g,'').toLowerCase() !== SENT) throw new Error('unparseable colour ' + c); cx.fillRect(0, 0, 1, 1); };
  const over = (layers) => { cx.clearRect(0, 0, 1, 1); paint('#ffffff'); for (const c of layers) if (c) paint(c); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
  const washesOf = (cs) => [...(cs.backgroundImage || '').matchAll(/linear-gradient\\((.+?),\\s*\\1\\)/g)].map((m) => m[1]);
  const layersOf = (el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, ...washesOf(cs)]; };
  const groundLayers = (el) => { const chain = []; for (let n = el.parentElement; n; n = n.parentElement) chain.unshift(n); return chain.flatMap(layersOf); };
  const groundOf = (el) => over(groundLayers(el));
  const fillOf = (el) => over([...groundLayers(el), ...layersOf(el)]);
  const splitList = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  // The ring Tailwind draws: a box-shadow with no offset, no blur and a spread.
  const ringOf = (el) => {
    for (const sh of splitList(getComputedStyle(el).boxShadow || '')) {
      const colour = (sh.match(/^(?:rgba?|oklab|oklch|lab|lch|color|hsla?)\\([^)]*\\)|^#[0-9a-f]+|^[a-z]+(?=\\s)/i) || [])[0];
      const px = [...sh.replace(colour || '', '').matchAll(/(-?[\\d.]+)px/g)].map((m) => +m[1]);
      if (colour && px.length >= 4 && px[0] === 0 && px[1] === 0 && px[2] === 0 && px[3] >= 3) return { colour, spread: px[3] };
    }
    return null;
  };
  const selfTest = () => {
    const half = over(['rgba(0,0,0,0.5)']);
    const lab = over(['oklch(0.5 0 0)']);
    let threw = false; try { over(['not-a-colour']); } catch { threw = true; }
    return { halfBlackOnWhite: half, oklchMid: lab, rejectsGarbage: threw, ok: Math.abs(half[0] - 128) <= 1 && lab[0] > 90 && lab[0] < 110 && threw };
  };
  return { over, hex, contrast, groundOf, fillOf, ringOf, selfTest };
})(); true`;

async function session(theme) {
  const PORT = theme === 'dark' ? 9352 : 9351;
  const profile = mkdtempSync(join(tmpdir(), `zb-colour-fix-${theme}-`));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let ws, seq = 0; const pending = new Map();
  const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });

  const go = async (path, ready) => {
    await send('Page.navigate', { url: `${base}${path}` });
    for (let i = 0; i < 100; i++) { await sleep(300); if (await ev(`document.readyState === 'complete' && !!(${ready})`).catch(() => false)) break; }
    await sleep(700);
    await ev(HELPERS);
  };
  const centre = (sel) => ev(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const mouse = async (type, [x, y]) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  const click = async (sel) => { const c = await centre(sel); if (!c) throw new Error('nothing to click: ' + sel); await mouse('mouseMoved', c); await mouse('mousePressed', c); await mouse('mouseReleased', c); await sleep(450); };
  const shot = async (name, sel, pad = 16) => {
    const r = await ev(`(() => { const e = ${sel}; if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.max(0, b.x - ${pad}), y: Math.max(0, b.y - ${pad}), width: b.width + ${pad * 2}, height: b.height + ${pad * 2} }; })()`);
    if (!r) return null;
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 2 } });
    const file = join(out, `colour-${name}-${theme}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  };
  const close = async () => { try { ws.close(); } catch {} chrome.kill('SIGKILL'); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { send, ev, go, centre, mouse, click, shot, close };
}

const byText = (text, scope = 'document', tags = 'button, [role=tab], [role=radio], a') =>
  `[...${scope}.querySelectorAll(${JSON.stringify(tags)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)} && e.getClientRects().length)`;

async function run(theme) {
  const s = await session(theme);
  const r = { theme };
  try {
    // ── 1. The four DS class strings, on a paper ground, with real pointer input ──
    await s.go('/dev-preview/overlay-states', `document.querySelector('main')`);
    r.resolvedTheme = await s.ev(`document.documentElement.dataset.theme`);
    r.accent = await s.ev(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
    r.ruler = await s.ev(`__zb.selfTest()`);
    await s.ev(`(() => {
      const box = document.createElement('div');
      box.id = 'probe'; box.className = 'bg-paper text-ink-900';
      box.style.cssText = 'position:fixed;left:24px;top:24px;z-index:99999;padding:24px;display:flex;gap:28px;align-items:center';
      box.innerHTML = \`
        <button id="danger-after" class="h-8 rounded-md px-3 bg-danger-500 text-onsolid hover:bg-danger-600 active:bg-danger-500">Delete</button>
        <button id="danger-before" class="h-8 rounded-md px-3 bg-danger-500 text-onsolid hover:bg-danger-600">Delete</button>
        <span style="display:inline-flex"><span class="h-8 rounded-s-md px-3 bg-danger-500 text-onsolid grid place-items-center">Delete</span><span id="seam-after" class="h-8 w-7 rounded-e-md border-s bg-danger-500 text-onsolid border-line-onsolid"></span></span>
        <span style="display:inline-flex"><span class="h-8 rounded-s-md px-3 bg-danger-500 text-onsolid grid place-items-center">Delete</span><span id="seam-before" class="h-8 w-7 rounded-e-md border-s bg-danger-500 text-onsolid"></span></span>
        <span id="step-after" class="grid size-6 place-items-center rounded-full text-caption font-semibold bg-berry-500 text-onsolid ring-4 ring-surface-active">2</span>
        <span id="step-before" class="grid size-6 place-items-center rounded-full text-caption font-semibold bg-berry-500 text-onsolid ring-4">2</span>
        <span id="thumb-after" class="focus-ring relative block size-4 rounded-full border border-line-control bg-paper shadow-lift-1 active:ring-4 active:ring-accent-wash"></span>
        <span id="thumb-before" class="focus-ring relative block size-4 rounded-full border border-line-control bg-paper shadow-lift-1 active:ring-4"></span>\`;
      document.body.appendChild(box); return true; })()`);
    await sleep(300);
    const read = (id, what) => s.ev(`(() => { const e = document.getElementById('${id}'); const g = __zb.groundOf(e); const f = __zb.fillOf(e); const ring = __zb.ringOf(e);
      const ringRgb = ring ? __zb.over([...[g].map(__zb.hex), ring.colour]) : null;
      return { ${what} fill: __zb.hex(f), ground: __zb.hex(g), ring: ring && { declared: ring.colour, spread: ring.spread, onGround: __zb.hex(ringRgb), vsGround: __zb.contrast(ringRgb, g) },
        edge: getComputedStyle(e).borderInlineStartWidth !== '0px' ? (() => { const c = __zb.over([__zb.hex(f), getComputedStyle(e).borderInlineStartColor]); return { colour: __zb.hex(c), vsFill: __zb.contrast(c, f) }; })() : null }; })()`);
    const pressCycle = async (id) => {
      const c = await s.centre(`document.getElementById('${id}')`);
      await s.mouse('mouseMoved', [c[0], c[1] + 200]); await sleep(150);
      const rest = await read(id, '');
      await s.mouse('mouseMoved', c); await sleep(200);
      const hover = await read(id, '');
      await s.mouse('mousePressed', c); await sleep(200);
      const pressed = await read(id, '');
      await s.mouse('mouseReleased', c); await s.mouse('mouseMoved', [c[0], c[1] + 200]); await sleep(150);
      return { rest, hover, pressed };
    };
    for (const which of ['after', 'before']) {
      const d = await pressCycle(`danger-${which}`);
      r[`dangerButton_${which}`] = { rest: d.rest.fill, hover: d.hover.fill, pressed: d.pressed.fill, pressedDistinctFromHover: d.pressed.fill !== d.hover.fill };
      const th = await pressCycle(`thumb-${which}`);
      r[`sliderThumb_${which}`] = { restRing: th.rest.ring, pressedRing: th.pressed.ring };
      r[`stepCurrent_${which}`] = (await read(`step-${which}`, '')).ring;
      r[`splitSeam_${which}`] = (await read(`seam-${which}`, '')).edge;
    }
    r.shots = { probes: await s.shot('ds-probes', `document.getElementById('probe')`, 4) };
    await s.ev(`document.getElementById('probe').remove(), true`);

    // ── 2. New project dialog: the search field is the DS field ──
    await s.click(byText('Open new project'));
    const field = `document.querySelector('[role=dialog] input[aria-label="Search templates"]')`;
    r.newProjectSearch = await s.ev(`(() => { const i = ${field}; if (!i) return { error: 'no search field' }; const cs = getComputedStyle(i); const f = __zb.fillOf(i); const edge = __zb.over([__zb.hex(f), cs.borderTopColor]);
      const dialog = i.closest('[role=dialog]'); const dg = __zb.fillOf(dialog);
      return { height: i.getBoundingClientRect().height, fill: __zb.hex(f), dialogFill: __zb.hex(dg), edge: __zb.hex(edge), edgeVsDialog: __zb.contrast(edge, dg), hasIcon: !!i.parentElement.querySelector('svg'), paddingStart: cs.paddingInlineStart }; })()`);
    const fc = await s.centre(field);
    await s.mouse('mouseMoved', fc); await s.mouse('mousePressed', fc); await s.mouse('mouseReleased', fc); await sleep(200);
    await s.send('Input.insertText', { text: 'zzqx' }); await sleep(400);
    r.newProjectSearch.typedFilters = await s.ev(`/No templates match/.test(document.querySelector('[role=dialog]').textContent)`);
    r.shots.newProjectSearch = await s.shot('new-project-search', `${field}.closest('.flex.items-center.justify-between')`, 8);

    // ── 3. A valid file drag over the public form's dropzone ──
    await s.go('/dev-preview/forms', byText('Public form'));
    await s.click(byText('Public form'));
    const zone = `[...document.querySelectorAll('button')].find((b) => /browse/.test(b.textContent))`;
    const zc = await s.centre(zone);
    r.dropzone = { idle: await s.ev(`(() => { const z = ${zone}; return { fill: __zb.hex(__zb.fillOf(z)), ground: __zb.hex(__zb.groundOf(z)) }; })()`) };
    for (const type of ['dragEnter', 'dragOver']) {
      await s.send('Input.dispatchDragEvent', { type, x: zc[0], y: zc[1], data: { items: [{ mimeType: 'text/plain', data: 'brief' }], dragOperationsMask: 1 } });
      await sleep(150);
    }
    await sleep(250);
    r.dropzone.valid = await s.ev(`(() => { const z = [...document.querySelectorAll('button')].find((b) => /Drop to upload/.test(b.textContent)); if (!z) return { error: 'valid state not reached' };
      const g = __zb.groundOf(z); const after = __zb.fillOf(z); const edge = __zb.over([__zb.hex(after), getComputedStyle(z).borderTopColor]);
      z.classList.remove('bg-paper-3', 'wash-over'); const before = __zb.fillOf(z); z.classList.add('bg-paper-3', 'wash-over');
      return { after: __zb.hex(after), before: __zb.hex(before), ground: __zb.hex(g), edge: __zb.hex(edge), borderStyle: getComputedStyle(z).borderTopStyle, afterVsGround: __zb.contrast(after, g), beforeVsGround: __zb.contrast(before, g) }; })()`);
    r.shots.dropzoneValid = await s.shot('dropzone-valid', `[...document.querySelectorAll('button')].find((b) => /Drop to upload/.test(b.textContent))`, 8);
    await s.send('Input.dispatchDragEvent', { type: 'dragCancel', x: zc[0], y: zc[1], data: { items: [], dragOperationsMask: 1 } }).catch(() => {});

    // ── 4. Content: the sign-off states in the piece editor ──
    await s.go('/dev-preview/content', `document.querySelector('[role=button][aria-label*="TechSpark case study film"]')`);
    const openPiece = async (title) => { await s.click(`document.querySelector('[role=button][aria-label*=${JSON.stringify(title)}]')`); await sleep(700); };
    await openPiece('TechSpark case study film');
    r.changesRequested = await s.ev(`(() => { const d = document.querySelector('[role=dialog]'); if (!d) return { error: 'piece did not open' };
      const a = [...d.querySelectorAll('[role=status]')].find((x) => /Changes requested/.test(x.textContent)); if (!a) return { error: 'no alert' };
      const box = __zb.fillOf(a); const title = [...a.querySelectorAll('p')].find((p) => p.textContent.trim() === 'Changes requested'); const body = a.querySelector('.text-ink-700');
      const ink = (el) => __zb.over([__zb.hex(box), getComputedStyle(el).color]);
      const note = 'cut the intro to 10s'; const occurrences = d.textContent.split(note).length - 1;
      return { fill: __zb.hex(box), edge: __zb.hex(__zb.over([__zb.hex(box), getComputedStyle(a).borderTopColor])), titleContrast: __zb.contrast(ink(title), box), bodyContrast: __zb.contrast(ink(body), box),
        body: body.textContent.trim(), noteShownTimes: occurrences, sendAgain: !![...a.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Send again'), icon: !!a.querySelector('svg') }; })()`);
    r.shots.changesRequested = await s.shot('changes-requested', `[...document.querySelectorAll('[role=dialog] [role=status]')].find((x) => /Changes requested/.test(x.textContent))`, 12);
    const hintOf = `(() => { const d = document.querySelector('[role=dialog]'); const h = d && d.querySelector('span.col-span-2'); return h ? h.textContent.trim() : null; })()`;
    r.changesRequested.stageHint = await s.ev(hintOf);
    await s.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(600);
    await openPiece('Client spotlight');
    r.awaiting = { stageHint: await s.ev(hintOf), approvalLine: await s.ev(`/With the client/.test(document.querySelector('[role=dialog]')?.textContent || '')`) };
    await s.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(600);
    await openPiece('August recap');
    r.noApproval = { stageHint: await s.ev(hintOf) };

    // ── 5. Feedback: the shipped marker ──
    await s.go('/dev-preview/clients', byText('Feedback'));
    await s.click(byText('Feedback'));
    await sleep(500);
    r.shipped = await s.ev(`(() => { const sp = [...document.querySelectorAll('span.text-success')].find((x) => x.textContent.trim() === 'Shipped'); if (!sp) return { error: 'no shipped marker' };
      const g = __zb.fillOf(sp.parentElement); const after = __zb.over([__zb.hex(g), getComputedStyle(sp).color]);
      sp.classList.remove('text-success'); const before = __zb.over([__zb.hex(g), getComputedStyle(sp).color]); sp.classList.add('text-success');
      return { after: __zb.hex(after), before: __zb.hex(before), card: __zb.hex(g), afterContrast: __zb.contrast(after, g), beforeContrast: __zb.contrast(before, g) }; })()`);
    r.shots.shipped = await s.shot('shipped', `[...document.querySelectorAll('span.text-success')].find((x) => x.textContent.trim() === 'Shipped').closest('.group')`, 6);

    // ── 6. Project portal tab: the linked-task button and a team reply ──
    await s.go('/dev-preview/projects', `document.body.textContent.length > 200`);
    const portalTab = byText('Portal', 'document', 'button, [role=tab], [role=radio], a');
    if (!(await s.ev(`!!${portalTab}`))) {
      await s.click(`[...document.querySelectorAll('a, button, [role=button]')].find((e) => /Balluji|Brand|Website|Launch/i.test(e.textContent) && e.getClientRects().length)`);
    }
    await s.click(portalTab);
    await sleep(500);
    r.linkedTask = await s.ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Linked task/.test(x.textContent.trim())); if (!b) return { error: 'no linked-task button' };
      const f = __zb.fillOf(b); const card = __zb.fillOf(b.parentElement);
      return { height: b.getBoundingClientRect().height, fill: __zb.hex(f), card: __zb.hex(card), isDsButton: b.className.includes('bg-surface-fill') }; })()`);
    const toggle = `[...document.querySelectorAll('button')].find((x) => /^1 message$/.test(x.textContent.trim()) && x.closest('div.rounded-lg')?.textContent.includes('brand colors'))`;
    if (await s.ev(`!!${toggle}`)) { await s.click(toggle); await sleep(300); }
    r.teamBubble = await s.ev(`(() => { const p = [...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Happy to — which screens')); if (!p) return { error: 'no team reply bubble' };
      const bubble = p.parentElement; const card = bubble.closest('div.rounded-lg.border.px-4');
      const after = __zb.fillOf(bubble); bubble.classList.remove('bg-surface-raised'); const before = __zb.fillOf(bubble); bubble.classList.add('bg-surface-raised');
      return { after: __zb.hex(after), before: __zb.hex(before), card: card ? __zb.hex(__zb.fillOf(card)) : null, sameToneAsCard: card ? __zb.hex(after) === __zb.hex(__zb.fillOf(card)) : null }; })()`);
    r.shots.teamBubble = await s.shot('team-bubble', `[...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Happy to — which screens'))?.closest('div.rounded-lg.border.px-4')`, 6);

    // ── 7. The same thread in the CLIENT's portal, on the portal's own ground ──
    await s.go('/dev-preview/portal', `document.body.textContent.length > 200`);
    // A prefix, not an exact match: the nav item can carry its count.
    const requestsNav = `[...document.querySelectorAll('button')].find((e) => /^Requests/.test(e.textContent.trim()) && e.getClientRects().length)`;
    if (await s.ev(`!!${requestsNav}`)) await s.click(requestsNav);
    await sleep(400);
    r.portalBubble = await s.ev(`(() => { const p = [...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Happy to — which screens') && x.getClientRects().length); if (!p) return { error: 'no team reply in the portal' };
      const bubble = p.parentElement; const g = __zb.groundOf(bubble);
      const after = __zb.fillOf(bubble); bubble.classList.remove('bg-surface-raised'); const before = __zb.fillOf(bubble); bubble.classList.add('bg-surface-raised');
      return { after: __zb.hex(after), before: __zb.hex(before), ground: __zb.hex(g), afterVsGround: __zb.contrast(after, g), beforeVsGround: __zb.contrast(before, g) }; })()`);
    r.shots.portalBubble = await s.shot('portal-bubble', `[...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Happy to — which screens') && x.getClientRects().length)?.parentElement`, 10);
  } catch (e) {
    r.error = String(e?.message || e);
  } finally {
    await s.close();
  }
  return r;
}

const results = [];
for (const theme of ['light', 'dark']) results.push(await run(theme));
console.log(JSON.stringify(results, null, 2));
process.exit(0);
