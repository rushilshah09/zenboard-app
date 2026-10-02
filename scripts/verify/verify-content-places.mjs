// ── REAL-INPUT VERIFICATION, NO DEPENDENCIES ───────────────────────────────
// See verify-board-drag.mjs for why these scripts drive system Chrome over the
// DevTools protocol instead of the in-app browser.
//
// Content's three places, end to end, in both themes and at phone width:
//   Inbox    — only the pile; a link introduces itself; sort, trash, undo;
//   a capture opens as a capture and becomes a piece from inside;
//   Library  — saved + published, months, filters in the URL, search, spark;
//   a saved thing opens as itself (source card, no stage) and its crumb goes home;
//   a published piece shows its live post;
//   Pictures — a screenshot in the pile, one picked through the file chooser,
//   one dropped onto the inbox; each named, thumbnailed and openable;
//   Platforms — a link from X or YouTube wears its platform's mark (never a
//   favicon "dot"), an off-platform site keeps its favicon, a YouTube card points
//   at the video's own thumbnail, and a piece's channel carries its mark;
//   Remembered previews — a stored preview draws its card with NO request, an
//   expired remembered picture is asked for again, and only the one link with
//   nothing stored or primed asks /api/unfurl (the control).
// Every check is printed with PASS/FAIL; the process exits 1 if any fail.
//
// Usage (needs `next dev` running):
//   node --experimental-websocket scripts/verify/verify-content-places.mjs http://localhost:3000 <out-dir> <picked.png> <dropped.png>
// The two images must be REAL files: the chooser and the drop both read from disk.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out, pickedPng, droppedPng] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (theme, name, ok, got) => { results.push({ theme, name, ok: !!ok, got }); };

async function session(theme, port, { width = 1440, height = 900, mobile = false } = {}) {
  const profile = mkdtempSync(join(tmpdir(), `zb-places-${theme}-`));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws, seq = 0; const pending = new Map(); const errors = [];
  // Every command has a deadline: a reply that never comes is a FAILURE with the
  // command's name, not a script that silently hangs until someone kills it.
  const send = (m, p = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method: m, params: p }));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { pending.delete(id); rej(new Error(`CDP ${m} timed out`)); }, 30000);
      pending.set(id, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } });
    });
  };
  const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const unfurls = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Network.requestWillBeSent' && /\/api\/unfurl\?/.test(msg.params.request.url)) unfurls.push(decodeURIComponent(msg.params.request.url.split('url=')[1] || ''));
    if (msg.method === 'Runtime.exceptionThrown') errors.push(String(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text).slice(0, 200));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(String(msg.params.args?.[0]?.value ?? msg.params.args?.[0]?.description).slice(0, 200));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  const go = async (path, ready) => { await send('Page.navigate', { url: `${base}${path}` }); for (let i = 0; i < 100; i++) { await sleep(300); if (await ev(`document.readyState === 'complete' && !!(${ready})`).catch(() => false)) break; } await sleep(800); };
  const centre = (sel) => ev(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const mouse = (type, [x, y]) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  const hover = async (sel) => { const c = await centre(sel); if (c) { await mouse('mouseMoved', c); await sleep(250); } return c; };
  const click = async (sel, wait = 700) => { const c = await centre(sel); if (!c) throw new Error('nothing to click: ' + sel.slice(0, 120)); await mouse('mouseMoved', c); await mouse('mousePressed', c); await mouse('mouseReleased', c); await sleep(wait); };
  const key = async (k, code, vk, modifiers = 0) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers }); await sleep(250); };
  const type = async (text) => { await send('Input.insertText', { text }); await sleep(450); };
  // Select-all as the EDITING COMMAND: a key event carrying a modifier does not
  // run it in headless Chrome, so the "cleared" field kept its old query.
  const clear = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, commands: ['selectAll'] });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await key('Backspace', 'Backspace', 8);
  };
  const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, `places-${name}-${theme}.png`), Buffer.from(data, 'base64')); };
  const close = async () => { try { ws.close(); } catch {} chrome.kill('SIGKILL'); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { send, ev, go, hover, click, key, type, clear, shot, close, errors, unfurls };
}

// The row's own title span — `:scope >` so an icon button's inner spans are not read as titles.
const rowTitles = `[...document.querySelectorAll('ul li.touch-row')].map((li) => li.querySelector(':scope > button > span')?.textContent.trim())`;
const rowOf = (title) => `[...document.querySelectorAll('ul li.touch-row')].find((li) => li.textContent.includes(${JSON.stringify(title)}))`;
const btnIn = (scope, label) => `(${scope})?.querySelector('button[aria-label=${JSON.stringify(label)}]')`;
const buttonText = (text) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length)`;
const page = `document.querySelector('[role=dialog]')`;
const cards = `[...document.querySelectorAll('[role=button][aria-label]')].filter((c) => c.querySelector('.aspect-video'))`;
const cardNamed = (title) => `${cards}.find((c) => c.getAttribute('aria-label') === ${JSON.stringify(title)})`;

async function desktop(theme, port) {
  const s = await session(theme, port);
  const T = theme;
  try {
    // ── INBOX ──────────────────────────────────────────────────────────────
    await s.go('/dev-preview/content?view=inbox', `document.querySelector('[aria-label="Capture to inbox"]')`);
    check(T, 'inbox holds only the pile, links named by their page', JSON.stringify(await s.ev(rowTitles)) === JSON.stringify(['Thread on hooks that actually work', 'Idea: the pricing video nobody makes', 'How I got my attention span back', 'Screenshot from 13 Sep, 16:12']), await s.ev(rowTitles));
    check(T, 'no saved shelf inside the inbox', !(await s.ev(`[...document.querySelectorAll('h2')].some((h) => h.textContent.trim() === 'Saved')`)));
    const glyphSlot = (title) => `(${rowOf(title)})?.querySelector(':scope > span')`;
    const rowMarks = await s.ev(`({
      x: { svg: !!${glyphSlot('Thread on hooks')}?.querySelector('svg'), favicon: !!${glyphSlot('Thread on hooks')}?.querySelector('img'), site: /@someone · X/.test(${rowOf('Thread on hooks')}.textContent) },
      youtube: { svg: !!${glyphSlot('attention span')}?.querySelector('svg'), favicon: !!${glyphSlot('attention span')}?.querySelector('img'), thumb: ${rowOf('attention span')}.querySelector('img.object-cover')?.naturalWidth || 0 },
      thought: { svg: !!${glyphSlot('pricing video')}?.querySelector('svg'), img: !!${rowOf('pricing video')}.querySelector('img') },
    })`);
    check(T, 'a link from X or YouTube wears its platform mark — no favicon dot — and a YouTube row shows its picture', rowMarks.x.svg && !rowMarks.x.favicon && rowMarks.x.site && rowMarks.youtube.svg && !rowMarks.youtube.favicon && rowMarks.youtube.thumb > 0, rowMarks);
    check(T, 'a thought shows a glyph and no picture', rowMarks.thought.svg && !rowMarks.thought.img, rowMarks.thought);
    await s.shot('inbox');

    await s.hover(rowOf('Thread on hooks'));
    await s.click(btnIn(rowOf('Thread on hooks'), 'Save to library'));
    check(T, 'Save to library takes it off the pile', JSON.stringify(await s.ev(rowTitles)) === JSON.stringify(['Idea: the pricing video nobody makes', 'How I got my attention span back', 'Screenshot from 13 Sep, 16:12']), await s.ev(rowTitles));
    check(T, 'the tab count follows', await s.ev(`!!document.querySelector('[aria-label="Inbox, 3 to sort"]')`));

    await s.hover(rowOf('pricing video'));
    await s.click(btnIn(rowOf('pricing video'), 'Move to Trash'));
    const toast = await s.ev(`[...document.querySelectorAll('[data-sonner-toast], [role=status], li')].map((e) => e.textContent).find((t) => /moved to Trash/.test(t)) || null`);
    check(T, 'Move to Trash says so, with Undo', /“Idea: the pricing video nobody makes” moved to Trash\./.test(toast || ''), toast);
    await s.click(buttonText('Undo'));
    check(T, 'Undo puts it back where it was', JSON.stringify(await s.ev(rowTitles)) === JSON.stringify(['Idea: the pricing video nobody makes', 'How I got my attention span back', 'Screenshot from 13 Sep, 16:12']), await s.ev(rowTitles));

    // ── A CAPTURE OPENS AS A CAPTURE ─────────────────────────────────────────
    await s.click(`${rowOf('attention span')}.querySelector('button')`, 1100);
    const capture = await s.ev(`(() => { const d = ${page}; if (!d) return null; return {
      crumbs: [...d.querySelectorAll('nav li')].map((li) => ((t) => (t.endsWith('/') ? t.slice(0, -1) : t).trim())(li.textContent.trim())).filter(Boolean),
      title: d.querySelector('[aria-label="Content title"]')?.value,
      source: d.querySelector('a.bookmark-card')?.getAttribute('href'),
      newTab: d.querySelector('a.bookmark-card')?.getAttribute('target'),
      stage: !!d.querySelector('[aria-label="Stage"]'),
      actions: ['Add to pipeline', 'Save to library', 'Move to Trash'].every((l) => [...d.querySelectorAll('button')].some((b) => b.textContent.trim() === l)),
      tooltipOpen: document.querySelectorAll('[role=tooltip]').length,
    }; })()`);
    check(T, 'capture view: crumb says Inbox, title adopted, source is a real new-tab link, no stage', capture && capture.crumbs.includes('Inbox') && capture.title === 'How I got my attention span back' && capture.source === 'https://www.youtube.com/watch?v=attn' && capture.newTab === '_blank' && !capture.stage && capture.actions, capture);
    check(T, 'opening a page pops no tooltip', capture && capture.tooltipOpen === 0, capture?.tooltipOpen);
    await s.shot('capture');
    await s.click(`[...${page}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add to pipeline')`, 900);
    const became = await s.ev(`(() => { const d = ${page}; return d ? { stage: !!d.querySelector('[aria-label="Stage"]'), crumbs: [...d.querySelectorAll('nav li')].map((li) => ((t) => (t.endsWith('/') ? t.slice(0, -1) : t).trim())(li.textContent.trim())).filter(Boolean) } : null; })()`);
    check(T, 'Add to pipeline turns the page into the production editor, in Idea', became && became.stage && became.crumbs.includes('Idea'), became);
    await s.key('Escape', 'Escape', 27);
    await sleep(500);
    check(T, 'and it has left the pile', JSON.stringify(await s.ev(rowTitles)) === JSON.stringify(['Idea: the pricing video nobody makes', 'Screenshot from 13 Sep, 16:12']), await s.ev(rowTitles));
    await s.click(`[...document.querySelectorAll('[role=radio]')].find((r) => r.textContent.trim() === 'Pipeline')`, 900);
    check(T, 'the piece reaches the board under the name the inbox showed', await s.ev(`[...document.querySelectorAll('section[aria-label="Idea"] [role=button]')].some((c) => /How I got my attention span back/.test(c.textContent))`));
    const boardMarks = await s.ev(`(() => { const card = (t) => [...document.querySelectorAll('section[aria-label] [role=button]')].filter((c) => !c.closest('section[aria-label="Needs you"]')).find((c) => c.textContent.includes(t)); /* the board's own card — a late piece is ALSO in the Needs you strip, which shows its badge, not its channel */ const channelSpan = (t) => [...(card(t)?.querySelectorAll('span') ?? [])].find((sp) => /^(YouTube|Instagram|TikTok|LinkedIn)$/.test(sp.textContent.trim()));
      return { youtube: !!channelSpan('Studio tour, part one')?.querySelector('svg'), tiktok: !!channelSpan('August recap')?.querySelector('svg'), linkedin: !!channelSpan('Client spotlight')?.querySelector('svg') }; })()`);
    check(T, 'board cards show the channel as its platform mark and name', boardMarks.youtube && boardMarks.tiktok && boardMarks.linkedin, boardMarks);
    await s.shot('board');

    // ── PICTURES ───────────────────────────────────────────────────────────
    await s.click(`[...document.querySelectorAll('[role=radio]')].find((r) => /^Inbox/.test(r.textContent.trim()))`, 900);
    const shotRow = await s.ev(`(() => { const r = ${rowOf('Screenshot from 13 Sep')}; const img = r?.querySelector('img.object-cover'); return { thumb: img?.naturalWidth || 0 }; })()`);
    check(T, 'a stored screenshot shows its thumbnail in the pile', shotRow.thumb > 0, shotRow);

    // Picked through the REAL file chooser input.
    const { root } = await s.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await s.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file][accept="image/*"]' });
    await s.send('DOM.setFileInputFiles', { nodeId, files: [pickedPng] });
    await new Promise((r) => setTimeout(r, 900));
    const picked = await s.ev(`(() => { const r = [...document.querySelectorAll('ul li.touch-row')][0]; const img = r?.querySelector('img.object-cover'); return { title: r?.querySelector(':scope > button > span')?.textContent.trim(), thumb: img?.naturalWidth || 0 }; })()`);
    check(T, 'an image picked from disk lands first, named by its file, with its picture', picked.title === 'nike ad frame 03' && picked.thumb > 0, picked);

    // Dropped onto the inbox, as from the desktop.
    const zone = await s.ev(`(() => { const f = document.querySelector('[aria-label="Capture to inbox"]').closest('form'); f.scrollIntoView({ block: 'center' }); const b = f.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
    for (const type of ['dragEnter', 'dragOver']) {
      await s.send('Input.dispatchDragEvent', { type, x: zone[0], y: zone[1], data: { items: [], files: [droppedPng], dragOperationsMask: 1 } });
      await new Promise((r) => setTimeout(r, 150));
    }
    const dropState = await s.ev(`({ placeholder: document.querySelector('[aria-label="Capture to inbox"]').placeholder, edge: document.querySelector('[aria-label="Capture to inbox"]').closest('form').className.includes('border-line-control') })`);
    check(T, 'dragging a file over the inbox says it will be captured', dropState.placeholder === 'Drop to capture' && dropState.edge, dropState);
    await s.send('Input.dispatchDragEvent', { type: 'drop', x: zone[0], y: zone[1], data: { items: [], files: [droppedPng], dragOperationsMask: 1 } });
    await new Promise((r) => setTimeout(r, 900));
    const dropped = await s.ev(`(() => { const r = [...document.querySelectorAll('ul li.touch-row')][0]; const img = r?.querySelector('img.object-cover'); return { title: r?.querySelector(':scope > button > span')?.textContent.trim(), thumb: img?.naturalWidth || 0, placeholder: document.querySelector('[aria-label="Capture to inbox"]').placeholder }; })()`);
    check(T, 'a dropped image with a name that says nothing is named by the moment', /^Image from /.test(dropped.title || '') && dropped.thumb > 0 && dropped.placeholder !== 'Drop to capture', dropped);
    await s.shot('inbox-pictures');

    // A capture that IS a picture opens with the picture.
    await s.click(`${rowOf('Screenshot from 13 Sep')}.querySelector(':scope > button')`, 1100);
    const figure = await s.ev(`(() => { const d = ${page}; const b = d?.querySelector('button[aria-label="Open the image at full size"]'); return { figure: b?.querySelector('img')?.naturalWidth || 0, crumbs: [...(d?.querySelectorAll('nav li') ?? [])].map((li) => ((t) => (t.endsWith('/') ? t.slice(0, -1) : t).trim())(li.textContent.trim())).filter(Boolean) }; })()`);
    check(T, 'a screenshot capture opens with its picture, openable full size', figure.figure > 0 && figure.crumbs.includes('Inbox'), figure);
    await s.shot('capture-picture');
    await s.key('Escape', 'Escape', 27); await new Promise((r) => setTimeout(r, 400));

    // ── LIBRARY ────────────────────────────────────────────────────────────
    await s.go('/dev-preview/content?view=library', `document.querySelector('[aria-label="Search the library"]')`);
    const months = await s.ev(`[...document.querySelectorAll('h2.text-overline')].map((h) => [h.textContent.trim(), h.nextElementSibling?.children.length])`);
    check(T, 'months newest first, each with its cards', JSON.stringify(months) === JSON.stringify([['Sep 2026', 2], ['Aug 2026', 4], ['Jul 2026', 5]]), months);
    check(T, 'filter counts', await s.ev(`['All, 11', 'Saved, 9', 'Published, 2'].every((l) => document.querySelector('[aria-label="' + l + '"]'))`));
    // ── REMEMBERED PREVIEWS ──
    s.unfurls.length = 0;
    await s.go('/dev-preview/content?view=library', `document.querySelector('[aria-label="Search the library"]')`);
    await new Promise((r) => setTimeout(r, 1500));
    // Lazy images load only on screen — so a remembered picture is only found dead
    // (and asked for again) when its card is seen. Bring it into view first.
    await s.ev(`${cards}.find((c) => /vimeo/.test(c.getAttribute('aria-label') || '') || /Vimeo/.test(c.textContent))?.scrollIntoView({ block: 'center' }), true`);
    await new Promise((r) => setTimeout(r, 2500));
    const remembered = await s.ev(`(() => { const byTitle = (t) => ${cards}.find((c) => c.getAttribute('aria-label') === t);
      const vimeo = byTitle('The new Vimeo player');
      return { behance: !!byTitle('Brand identity for a coffee roaster'), vimeoFresh: !!vimeo?.querySelector('.aspect-video img')?.getAttribute('src')?.startsWith('data:image/svg+xml') }; })()`);
    check(T, 'a remembered preview draws its card — its real title — with no request', remembered.behance && !s.unfurls.some((u) => /behance/.test(u)), { remembered, unfurls: s.unfurls });
    check(T, 'a remembered picture that no longer loads is asked for again, and the fresh one shows', remembered.vimeoFresh, remembered);
    check(T, 'only the link with nothing remembered or known asks /api/unfurl (the control)', s.unfurls.length === 1 && /dribbble/.test(s.unfurls[0]), s.unfurls);
    const platforms = await s.ev(`(() => { const zoo = ${cardNamed('Me at the zoo')}; const reel = ${cardNamed('That reel about client onboarding')}; const studio = ${cardNamed('Studio site with a brilliant case-study layout')}; const film = ${cardNamed('The rebrand nobody asked for')};
      return {
        zooThumb: zoo?.querySelector('.aspect-video img')?.getAttribute('src'),
        zooMeta: { mark: !!zoo?.querySelector('p.text-caption svg'), favicon: !!zoo?.querySelector('p.text-caption img') },
        reelPlaceholderMark: !!reel?.querySelector('.aspect-video svg') && !reel?.querySelector('.aspect-video img'),
        studioFavicon: !!studio?.querySelector('p.text-caption img'),
        filmChannelMark: !!film?.querySelector('p.text-caption svg'),
      }; })()`);
    check(T, "a YouTube card points at the video's own thumbnail, and wears the mark", platforms.zooThumb === 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' && platforms.zooMeta.mark && !platforms.zooMeta.favicon, platforms);
    check(T, 'an Instagram link with no image shows the platform in its place', platforms.reelPlaceholderMark, platforms);
    check(T, 'an off-platform site keeps its own favicon; a published piece shows its channel mark', platforms.studioFavicon && platforms.filmChannelMark, platforms);
    check(T, 'a picture kept in the library is its card', (await s.ev(`${cardNamed('Ad frame: the one-line offer')}?.querySelector('.aspect-video img')?.naturalWidth || 0`)) > 0);
    const top = await s.ev(`(() => { const header = document.querySelector('[aria-label="Search the library"]').closest('main, .scroll-region') ; const box = document.querySelector('[aria-label="Search the library"]').getBoundingClientRect(); const rule = [...document.querySelectorAll('*')].find((e) => e.getAttribute('role') === 'radiogroup')?.closest('div')?.getBoundingClientRect(); return Math.round(box.top); })()`);
    check(T, 'the toolbar has room under the header (not sitting on its rule)', top >= 64, top);
    const media = await s.ev(`(() => { const nike = ${cardNamed('How Nike cuts a 15-second spot')}; const reel = ${cardNamed('That reel about client onboarding')}; const note = ${cardNamed('Open on the result, then show the work')}; const audit = ${cardNamed('What a brand audit actually covers')}; const live = ${cardNamed('The rebrand nobody asked for')};
      return { nikeImg: nike?.querySelector('.aspect-video img')?.naturalWidth || 0, reelFallback: !reel?.querySelector('.aspect-video img') && /instagram\\.com/.test(reel?.textContent || '') && /1 idea from this/.test(reel?.textContent || ''),
        noteText: note?.querySelector('.aspect-video p')?.textContent.trim(), auditMeta: audit?.textContent.includes('Article · Blog · 29 Jul'), liveImg: live?.querySelector('.aspect-video img')?.naturalWidth || 0, cardWidth: Math.round(nike?.getBoundingClientRect().width || 0) }; })()`);
    check(T, 'cards look like what they are: page image, honest fallback, a kept note, a format', media.nikeImg > 0 && media.reelFallback && media.noteText === 'Heard on a podcast. Use it for case-study intros.' && media.auditMeta && media.liveImg > 0, media);
    check(T, 'medium cards (≥ 280px)', media.cardWidth >= 280, media.cardWidth);
    await s.shot('library');

    await s.click(`[...document.querySelectorAll('[role=radio]')].find((r) => /^Saved/.test(r.textContent.trim()))`);
    check(T, 'Saved filter: 9 cards, in the URL', (await s.ev(`${cards}.length`)) === 9 && (await s.ev(`location.search.includes('kind=saved')`)), await s.ev(`[${cards}.length, location.search]`));
    await s.click(`[...document.querySelectorAll('[role=radio]')].find((r) => /^Published/.test(r.textContent.trim()))`);
    check(T, 'Published filter: 2 cards, in the URL', (await s.ev(`${cards}.length`)) === 2 && (await s.ev(`location.search.includes('kind=published')`)), await s.ev(`[${cards}.length, location.search]`));
    await s.click(`[...document.querySelectorAll('[role=radio]')].find((r) => /^All/.test(r.textContent.trim()))`);
    check(T, 'All carries no param', (await s.ev(`${cards}.length`)) === 11 && !(await s.ev(`location.search.includes('kind=')`)), await s.ev(`location.search`));

    await s.click(`document.querySelector('[aria-label="Search the library"]')`, 300);
    await s.type('nike beat');
    check(T, 'search needs every word, found in title and note', (await s.ev(`${cards}.map((c) => c.getAttribute('aria-label'))`)).join() === 'How Nike cuts a 15-second spot' && (await s.ev(`document.querySelector('p[role=status]')?.textContent`)) === '1 result', await s.ev(`${cards}.map((c) => c.getAttribute('aria-label'))`));
    await s.clear();
    check(T, 'clearing the search brings everything back', (await s.ev(`${cards}.length`)) === 11, await s.ev(`${cards}.length`));
    // "selected work" is ONLY in the fetched page title ("Selected work — Example
    // Studio"): not in the stored title, the note, or the host.
    await s.type('selected work');
    check(T, 'search reaches what only the page knows (its fetched title)', (await s.ev(`${cards}.map((c) => c.getAttribute('aria-label'))`)).join() === 'Studio site with a brilliant case-study layout', await s.ev(`${cards}.map((c) => c.getAttribute('aria-label'))`));
    await s.clear();
    await s.type('zzqx');
    check(T, 'no match says so', /Nothing in the library matches “zzqx”\./.test(await s.ev(`document.body.textContent`)));
    await s.clear();
    await sleep(300);

    // Spark from a card: the action sits OUTSIDE the card button.
    await s.hover(cardNamed('How Nike cuts a 15-second spot'));
    await s.click(`${cardNamed('How Nike cuts a 15-second spot')}.parentElement.querySelector('button[aria-label="Make something from this"]')`, 1100);
    const sparkedPage = await s.ev(`(() => { const d = ${page}; return d ? { stage: !!d.querySelector('[aria-label="Stage"]'), sparkedBy: /Sparked by/.test(d.textContent) && /How Nike cuts a 15-second spot/.test(d.textContent) } : null; })()`);
    check(T, 'Make something from this opens a new piece, sparked by the saved one', sparkedPage && sparkedPage.stage && sparkedPage.sparkedBy, sparkedPage);
    await s.key('Escape', 'Escape', 27); await sleep(500);
    check(T, 'the saved card now says what it sparked', /1 idea from this/.test(await s.ev(`${cardNamed('How Nike cuts a 15-second spot')}?.textContent || ''`)));

    // ── A SAVED THING OPENS AS ITSELF ────────────────────────────────────────
    await s.click(cardNamed('Studio site with a brilliant case-study layout'), 1100);
    const savedPage = await s.ev(`(() => { const d = ${page}; if (!d) return null; return {
      crumbs: [...d.querySelectorAll('nav li')].map((li) => ((t) => (t.endsWith('/') ? t.slice(0, -1) : t).trim())(li.textContent.trim())).filter(Boolean),
      source: d.querySelector('a.bookmark-card')?.getAttribute('href'),
      stage: !!d.querySelector('[aria-label="Stage"]'), publish: !!d.querySelector('[aria-label="Publish date"]'),
      fields: ['Link', 'Made by', 'Why you kept it'].every((l) => d.querySelector('[aria-label="' + l + '"]')),
      linkWidth: Math.round(d.querySelector('[aria-label="Link"]')?.getBoundingClientRect().width || 0),
      sourceSiteFavicon: !!d.querySelector('a.bookmark-card span img'),
    }; })()`);
    check(T, 'saved view: Library crumb, source link, its own fields, no stage or dates', savedPage && savedPage.crumbs.includes('Library') && savedPage.source === 'https://example.studio/work' && !savedPage.stage && !savedPage.publish && savedPage.fields, savedPage);
    check(T, 'the link field is wide enough to read a URL', savedPage && savedPage.linkWidth >= 400, savedPage?.linkWidth);
    check(T, "an off-platform source card keeps the site's favicon", savedPage && savedPage.sourceSiteFavicon, savedPage);
    await s.shot('saved');
    await s.click(`[...${page}.querySelectorAll('nav a, nav button')].find((e) => e.textContent.trim() === 'Library')`, 900);
    check(T, 'the Library crumb goes home', !(await s.ev(`!!${page}`)) && (await s.ev(`location.search.includes('view=library') && !location.search.includes('piece=')`)), await s.ev(`location.search`));

    // ── A PUBLISHED PIECE SHOWS WHERE IT WENT ────────────────────────────────
    await s.click(cardNamed('The rebrand nobody asked for'), 1100);
    const livePage = await s.ev(`(() => { const d = ${page}; const card = d?.querySelector('a.bookmark-card'); return d ? { live: d.querySelector('[aria-label="Live link"]')?.value, card: card?.getAttribute('href'), mark: !!card?.querySelector(':scope > span > span svg'), favicon: !!card?.querySelector(':scope > span > span img') } : null; })()`);
    check(T, 'published piece: live link field and a live-post card wearing the YouTube mark', livePage && livePage.live === 'https://youtu.be/rebrand' && livePage.card === 'https://youtu.be/rebrand' && livePage.mark && !livePage.favicon, livePage);
    await s.key('Escape', 'Escape', 27); await sleep(400);

    // ── KEYBOARD ─────────────────────────────────────────────────────────────
    await s.ev(`${cardNamed('How Nike cuts a 15-second spot')}.focus(), true`);
    await s.key('Enter', 'Enter', 13);
    await sleep(900);
    check(T, 'a card opens from the keyboard', await s.ev(`!!${page}`));
  } catch (e) {
    check(T, 'script ran to the end', false, String(e?.message || e));
  }
  check(T, 'no console errors', s.errors.length === 0, s.errors.slice(0, 4));
  await s.close();
}

async function phone() {
  const T = 'dark/phone';
  const s = await session('dark', 9373, { width: 390, height: 844, mobile: true });
  try {
    await s.go('/dev-preview/content?view=library', `document.querySelector('[aria-label="Search the library"]')`);
    const geo = await s.ev(`(() => { const c = ${cards}; const w = innerWidth; return { cols: new Set(c.map((x) => Math.round(x.getBoundingClientRect().left))).size, fits: c.every((x) => x.getBoundingClientRect().right <= w), noSideScroll: document.documentElement.scrollWidth <= w, sparkVisible: getComputedStyle(${cardNamed('How Nike cuts a 15-second spot')}.parentElement.querySelector('.reveal-on-hover')).opacity }; })()`);
    check(T, 'library: one column, nothing off screen, spark reachable on touch', geo.cols === 1 && geo.fits && geo.noSideScroll && Number(geo.sparkVisible) === 1, geo);
    await s.shot('library-phone');
    await s.go('/dev-preview/content?view=inbox', `document.querySelector('[aria-label="Capture to inbox"]')`);
    const inbox = await s.ev(`(() => { const r = ${rowOf('Thread on hooks')}; const acts = r.querySelector('.reveal-on-hover'); return { visible: Number(getComputedStyle(acts).opacity), fits: r.getBoundingClientRect().right <= innerWidth }; })()`);
    check(T, 'inbox: sort actions visible on touch, row fits', inbox.visible === 1 && inbox.fits, inbox);
  } catch (e) {
    check(T, 'script ran to the end', false, String(e?.message || e));
  }
  check(T, 'no console errors', s.errors.length === 0, s.errors.slice(0, 4));
  await s.close();
}

await desktop('light', 9371);
await desktop('dark', 9372);
await phone();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.theme}] ${r.name}${r.ok ? '' : `  → ${JSON.stringify(r.got)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
