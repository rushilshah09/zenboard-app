'use client';
// M0 spike container — 2,000 static blocks + one live PM editor on the focused
// block. Owns the block array, the unified History, and all instrumentation.
// Exposes window.__spike so the gates can be driven programmatically.
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { History, type Caret, type Step } from './history';
import { ActiveEditor, type ActiveEditorHandle } from './active-editor';
import { plain, mergeSpans, sid, type RichSpan, type SpikeBlock, type SpikeKind } from './rich';

// ── shared type styles: static row and PM host use the SAME objects ─────────
const TB_STYLE: Record<SpikeKind, React.CSSProperties> = {
  text: { fontSize: 16, lineHeight: 1.55 },
  h1: { fontSize: 28, lineHeight: 1.3, fontWeight: 700 },
  h2: { fontSize: 22, lineHeight: 1.35, fontWeight: 650 },
  h3: { fontSize: 18, lineHeight: 1.4, fontWeight: 600 },
  bullet: { fontSize: 16, lineHeight: 1.55 },
};
const ROW_PAD: Record<SpikeKind, string> = {
  text: '3px 2px', h1: '20px 2px 6px', h2: '14px 2px 4px', h3: '10px 2px 3px', bullet: '3px 2px',
};

function spanNodes(spans: RichSpan[]): ReactNode {
  if (!plain(spans)) return <br />; // match PM's trailing-break height for empty blocks
  return spans.map((s, i) => {
    const cls = [s.b && 'sp-b', s.i && 'sp-i', s.u && 'sp-u', s.s && 'sp-s'].filter(Boolean).join(' ');
    if (s.c) return <code key={i} className={'sp-code ' + cls}>{s.text}</code>;
    if (s.link) return <a key={i} className={'sp-link ' + cls} href={s.link}>{s.text}</a>;
    return cls ? <span key={i} className={cls}>{s.text}</span> : s.text;
  });
}

const Row = memo(function Row({ b, active, children }: { b: SpikeBlock; active: boolean; children?: ReactNode }) {
  return (
    <div data-sbid={b.id} style={{ display: 'flex', padding: ROW_PAD[b.type], background: active ? 'color-mix(in srgb, var(--accent, #4a7dff) 6%, transparent)' : undefined }}>
      {b.type === 'bullet' && <span style={{ ...TB_STYLE.bullet, flexShrink: 0, width: 22, textAlign: 'center', userSelect: 'none' }}>•</span>}
      <div className="sp-tb" style={{ ...TB_STYLE[b.type], flex: 1, minWidth: 0 }}>
        {children ?? spanNodes(b.spans)}
      </div>
    </div>
  );
}, (p, n) => p.b === n.b && p.active === n.active && p.children === n.children);

// DOM point → char offset within a block's text container.
function charOffsetAt(x: number, y: number, container: HTMLElement): number | null {
  let node: Node | null = null; let off = 0;
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
  if (!node || !container.contains(node)) return null;
  const w = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let n = 0; let cur: Node | null;
  while ((cur = w.nextNode())) { if (cur === node) return n + off; n += (cur.textContent ?? '').length; }
  return n; // element-level hit → end of text
}

const nextFrames = (n: number) => new Promise<void>((res) => {
  const step = (k: number) => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1)));
  step(n);
});

// Rect in the scroller's CONTENT coordinates — invariant under scrolling, so a
// scroll between the pre-mount capture and the post-mount measure can't fake a
// layout shift (and a real shift can't hide behind one).
function contentRect(el: HTMLElement): { x: number; y: number; w: number; h: number } {
  const scroller = document.getElementById('scroller');
  const r = el.getBoundingClientRect();
  if (!scroller) return { x: r.x, y: r.y, w: r.width, h: r.height };
  const sr = scroller.getBoundingClientRect();
  return { x: r.x - sr.x + scroller.scrollLeft, y: r.y - sr.y + scroller.scrollTop, w: r.width, h: r.height };
}

type Metrics = {
  keyPaint: number[]; keySync: number[]; mountShifts: number[]; cls: number; initialRenderMs: number;
};

export function SpikeEditor({ initial }: { initial: SpikeBlock[] }) {
  const [blocks, setBlocks] = useState<SpikeBlock[]>(initial);
  const [active, setActive] = useState<Caret>(null);
  const [editorKey, setEditorKey] = useState(0);
  const blocksRef = useRef(blocks);
  const activeRef = useRef(active);
  useLayoutEffect(() => { activeRef.current = active; }, [active]);
  const historyRef = useRef(new History());
  const handleRef = useRef<ActiveEditorHandle>({ view: null });
  const metricsRef = useRef<Metrics>({ keyPaint: [], keySync: [], mountShifts: [], cls: 0, initialRenderMs: 0 });
  const pendingRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const lastActionRef = useRef('—');

  const commit = (after: SpikeBlock[]) => { blocksRef.current = after; setBlocks(after); };

  // ── mutation handlers (all history-aware) ─────────────────────────────────
  const onText = (spans: RichSpan[], cB: number, cA: number) => {
    const id = activeRef.current?.id; if (!id) return;
    const before = blocksRef.current;
    const after = before.map((b) => (b.id === id ? { ...b, spans } : b));
    historyRef.current.typing(id, before, after, { id, offset: cB }, { id, offset: cA });
    blocksRef.current = after; // no setState: static rows stay untouched while typing
    lastActionRef.current = 'typing';
  };

  const onConvert = (kind: SpikeKind, literal: RichSpan[]) => {
    const id = activeRef.current?.id; if (!id) return;
    const before = blocksRef.current;
    const after = before.map((b) => (b.id === id ? { ...b, type: kind, spans: [] } : b));
    historyRef.current.push('convert', before, after, { id, offset: plain(literal).length }, { id, offset: 0 });
    commit(after); setActive({ id, offset: 0 }); setEditorKey((k) => k + 1);
    lastActionRef.current = 'convert:' + kind;
  };

  const onSplit = (a: RichSpan[], b: RichSpan[]) => {
    const id = activeRef.current?.id; if (!id) return;
    const before = blocksRef.current;
    const idx = before.findIndex((x) => x.id === id); if (idx < 0) return;
    const cur = before[idx];
    const nb: SpikeBlock = { id: sid(), type: cur.type === 'bullet' ? 'bullet' : 'text', spans: b };
    const after = [...before.slice(0, idx), { ...cur, spans: a }, nb, ...before.slice(idx + 1)];
    historyRef.current.breakRun();
    historyRef.current.push('split', before, after, { id, offset: plain(a).length }, { id: nb.id, offset: 0 });
    commit(after); setActive({ id: nb.id, offset: 0 });
    lastActionRef.current = 'split';
  };

  const onMergeBack = () => {
    const id = activeRef.current?.id; if (!id) return;
    const before = blocksRef.current;
    const idx = before.findIndex((x) => x.id === id); if (idx <= 0) return;
    const prev = before[idx - 1]; const cur = before[idx];
    const poff = plain(prev.spans).length;
    const merged = { ...prev, spans: mergeSpans([...prev.spans, ...cur.spans]) };
    const after = [...before.slice(0, idx - 1), merged, ...before.slice(idx + 1)];
    historyRef.current.breakRun();
    historyRef.current.push('merge', before, after, { id, offset: 0 }, { id: prev.id, offset: poff });
    commit(after); setActive({ id: prev.id, offset: poff });
    lastActionRef.current = 'merge';
  };

  const onNavigate = (dir: -1 | 1) => {
    const id = activeRef.current?.id; if (!id) return;
    const bs = blocksRef.current;
    const idx = bs.findIndex((x) => x.id === id);
    const t = bs[idx + dir]; if (!t) return;
    setActive({ id: t.id, offset: dir < 0 ? plain(t.spans).length : 0 });
    lastActionRef.current = 'navigate';
  };

  const onMove = (dir: -1 | 1) => {
    const id = activeRef.current?.id; if (!id) return false;
    const before = blocksRef.current;
    const idx = before.findIndex((x) => x.id === id);
    const j = idx + dir; if (j < 0 || j >= before.length) return true;
    const after = [...before];
    [after[idx], after[j]] = [after[j], after[idx]];
    const caret = activeRef.current;
    historyRef.current.breakRun();
    historyRef.current.push('move', before, after, caret, caret);
    commit(after); setEditorKey((k) => k + 1);
    lastActionRef.current = 'move';
    return true;
  };

  const applyStep = (s: Step | null, dir: 'undo' | 'redo') => {
    if (!s) return true;
    const target = dir === 'undo' ? s.before : s.after;
    const caret = dir === 'undo' ? s.caretBefore : s.caretAfter;
    blocksRef.current = target; setBlocks(target);
    setActive(caret ? { ...caret } : null);
    setEditorKey((k) => k + 1);
    lastActionRef.current = `${dir}:${s.label}`;
    return true;
  };
  const undo = () => applyStep(historyRef.current.undo(), 'undo');
  const redo = () => applyStep(historyRef.current.redo(), 'redo');

  // ── click → mount-at-caret ────────────────────────────────────────────────
  const onSurfaceMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const row = (e.target as HTMLElement).closest('[data-sbid]') as HTMLElement | null;
    if (!row) return;
    const id = row.dataset.sbid!;
    if (id === activeRef.current?.id) return; // PM handles clicks inside itself
    const tb = row.querySelector('.sp-tb') as HTMLElement;
    const offset = charOffsetAt(e.clientX, e.clientY, tb) ?? plain(blocksRef.current.find((b) => b.id === id)?.spans ?? []).length;
    e.preventDefault();
    pendingRectRef.current = contentRect(tb);
    setActive({ id, offset });
  };

  // Mount-shift check (Gate A): compare the text container rect before the
  // static→PM swap vs after PM paints. Expected delta: 0.
  useEffect(() => {
    if (!active || !pendingRectRef.current) return;
    const beforeRect = pendingRectRef.current; pendingRectRef.current = null;
    let dead = false;
    void nextFrames(2).then(() => {
      if (dead) return;
      const tb = document.querySelector(`[data-sbid="${active.id}"] .sp-tb`);
      if (!tb) return;
      const r = contentRect(tb as HTMLElement);
      const shift = Math.max(Math.abs(r.x - beforeRect.x), Math.abs(r.y - beforeRect.y), Math.abs(r.w - beforeRect.w), Math.abs(r.h - beforeRect.h));
      metricsRef.current.mountShifts.push(Math.round(shift * 100) / 100);
    });
    return () => { dead = true; };
  }, [active]);

  // Global undo/redo when no editor is mounted + CLS observer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      if (activeRef.current) return; // PM keymap owns it while mounted
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    let obs: PerformanceObserver | null = null;
    try {
      obs = new PerformanceObserver((l) => {
        for (const en of l.getEntries() as (PerformanceEntry & { value: number })[]) metricsRef.current.cls += en.value;
      });
      obs.observe({ type: 'layout-shift', buffered: true });
    } catch { /* unsupported */ }
    return () => { window.removeEventListener('keydown', onKey); obs?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── scriptable API for gate measurement ───────────────────────────────────
  useEffect(() => {
    const pct = (a: number[], p: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
    const api = {
      n: () => blocksRef.current.length,
      state: () => ({
        depth: historyRef.current.depth, lastLabel: historyRef.current.lastLabel,
        active: activeRef.current, lastAction: lastActionRef.current,
      }),
      block: (i: number) => { const b = blocksRef.current[i]; return b && { id: b.id, type: b.type, text: plain(b.spans), spans: b.spans }; },
      find: (id: string) => { const i = blocksRef.current.findIndex((b) => b.id === id); const b = blocksRef.current[i]; return b && { i, type: b.type, text: plain(b.spans) }; },
      async clickAt(i: number, off: number) {
        const b = blocksRef.current[i]; if (!b) return { error: 'no block' };
        const row = document.querySelector(`[data-sbid="${b.id}"]`) as HTMLElement;
        row.scrollIntoView({ block: 'center' });
        await nextFrames(2);
        const tb = row.querySelector('.sp-tb') as HTMLElement;
        // screen point of the target char, via a collapsed range
        const w = document.createTreeWalker(tb, NodeFilter.SHOW_TEXT);
        let n = 0; let node: Node | null = null; let rel = 0; let cur: Node | null;
        while ((cur = w.nextNode())) {
          const len = (cur.textContent ?? '').length;
          if (n + len >= off) { node = cur; rel = off - n; break; }
          n += len;
        }
        let x: number; let y: number;
        if (node) {
          const rg = document.createRange(); rg.setStart(node, rel); rg.collapse(true);
          const r = rg.getBoundingClientRect();
          x = r.left + 0.5; y = r.top + Math.max(4, r.height / 2);
        } else { const r = tb.getBoundingClientRect(); x = r.left + 2; y = r.top + r.height / 2; }
        const resolved = charOffsetAt(x, y, tb);
        const shiftCount = metricsRef.current.mountShifts.length;
        pendingRectRef.current = contentRect(tb);
        setActive({ id: b.id, offset: resolved ?? off });
        // Wait for THIS activation's shift measurement to land (bounded).
        for (let k = 0; k < 20 && metricsRef.current.mountShifts.length === shiftCount; k++) await nextFrames(1);
        const v = handleRef.current.view;
        return {
          expected: off, resolvedFromPoint: resolved,
          pmSelection: v ? v.state.selection.head - 1 : null,
          mountShift: metricsRef.current.mountShifts.at(-1) ?? null,
        };
      },
      async typeRun(str: string, frameGap = 1) {
        const v = handleRef.current.view; if (!v) return { error: 'no active editor' };
        const start = metricsRef.current.keyPaint.length;
        for (const ch of str) {
          const view = handleRef.current.view; if (!view) break; // convert/split remounts swap the view
          view.dispatch(view.state.tr.insertText(ch));
          await nextFrames(frameGap);
        }
        await nextFrames(2);
        const run = metricsRef.current.keyPaint.slice(start);
        const sync = metricsRef.current.keySync.slice(start);
        return { chars: run.length, p50: pct(run, 0.5), p95: pct(run, 0.95), max: Math.max(0, ...run), syncP50: pct(sync, 0.5), syncP95: pct(sync, 0.95), syncMax: Math.max(0, ...sync) };
      },
      undo: () => { undo(); return api.state(); },
      redo: () => { redo(); return api.state(); },
      move: (dir: -1 | 1) => { onMove(dir); return api.state(); },
      deactivate: () => setActive(null),
      metrics: () => {
        const kp = metricsRef.current.keyPaint; const ks = metricsRef.current.keySync;
        return {
          keystrokes: kp.length, p50: pct(kp, 0.5), p95: pct(kp, 0.95), max: Math.max(0, ...kp),
          syncP50: pct(ks, 0.5), syncP95: pct(ks, 0.95), syncMax: Math.max(0, ...ks),
          mountShifts: metricsRef.current.mountShifts, cls: Math.round(metricsRef.current.cls * 10000) / 10000,
          initialRenderMs: metricsRef.current.initialRenderMs,
          raw: { keyPaint: [...kp], keySync: [...ks] },
        };
      },
      resetMetrics: () => { metricsRef.current.keyPaint = []; metricsRef.current.keySync = []; metricsRef.current.mountShifts = []; metricsRef.current.cls = 0; },
    };
    (window as unknown as { __spike: typeof api }).__spike = api;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial render cost (2k static rows) — advisory for the §13 open-time budget.
  useEffect(() => {
    const t0 = performance.timeOrigin ? performance.now() : 0;
    void nextFrames(1).then(() => { metricsRef.current.initialRenderMs = Math.round(performance.now() - t0); });
  }, []);

  const activeBlock = active ? blocks.find((b) => b.id === active.id) : null;

  return (
    <div onMouseDown={onSurfaceMouseDown} style={{ cursor: 'text' }}>
      {blocks.map((b) => (
        <Row key={b.id} b={b} active={b.id === active?.id}>
          {b.id === active?.id && activeBlock ? (
            <ActiveEditor
              key={active.id + ':' + editorKey}
              block={activeBlock} offset={active.offset}
              onText={onText} onConvert={onConvert} onSplit={onSplit} onMergeBack={onMergeBack}
              onNavigate={onNavigate} onMove={onMove} onUndo={undo} onRedo={redo}
              onKeyPaint={(paintMs, syncMs) => { metricsRef.current.keyPaint.push(Math.round(paintMs * 100) / 100); metricsRef.current.keySync.push(Math.round(syncMs * 100) / 100); }}
              handleRef={handleRef}
            />
          ) : undefined}
        </Row>
      ))}
    </div>
  );
}

// ── HUD: reads refs on an interval; its re-render never touches the rows ────
export function SpikeHud() {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 400); return () => clearInterval(t); }, []);
  const w = typeof window !== 'undefined' ? (window as unknown as { __spike?: { state: () => { depth: number; lastLabel: string; lastAction: string; active: Caret }; metrics: () => { keystrokes: number; p50: number; p95: number; max: number; mountShifts: number[]; cls: number; initialRenderMs: number }; n: () => number } }).__spike : undefined;
  if (!w) return null;
  const s = w.state(); const m = w.metrics();
  const cell: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12 };
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50, width: 250, padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--ink, #111) 92%, transparent)', color: 'var(--paper, #fff)', fontSize: 11.5, fontFamily: 'ui-monospace, monospace', lineHeight: 1.7, pointerEvents: 'none' }}>
      <div style={cell}><span>blocks</span><b>{w.n()}</b></div>
      <div style={cell}><span>key→paint p50 / p95</span><b>{m.p50}ms / {m.p95}ms</b></div>
      <div style={cell}><span>keystrokes</span><b>{m.keystrokes}</b></div>
      <div style={cell}><span>mount shift (last)</span><b>{m.mountShifts.at(-1) ?? '—'}px</b></div>
      <div style={cell}><span>CLS total</span><b>{m.cls}</b></div>
      <div style={cell}><span>history depth</span><b>{s.depth}</b></div>
      <div style={cell}><span>last action</span><b style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.lastAction}</b></div>
      <div style={cell}><span>initial render</span><b>{m.initialRenderMs}ms</b></div>
    </div>
  );
}
