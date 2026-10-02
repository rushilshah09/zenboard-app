'use client';
// A Collection's canvas (COLLECTION_PLAN K5; COLLECTION_ITEM_BRIEF §5–8; COLLECTION_CANVAS_BRIEF).
//
// The same items as the masonry, on an infinite surface, each where the person put it. An item never
// put anywhere opens where the masonry would place it — in the reference the grid simply becomes a
// surface that pans — so switching to the canvas moves nothing. The first time anything is moved, the
// whole arrangement is written down, so nothing else reflows when one card goes somewhere else.
//
//   · drag a card to move it, with everything selected; ⌘/Shift-click adds to the selection
//   · drag the ground for a marquee; Space-drag, a middle-button drag or one finger pans
//   · wheel or two fingers pan; ⌘/Ctrl-wheel or a pinch zooms about the pointer
//   · the corner handle of a selected card resizes it, and its height follows its picture
//   · arrows nudge the selection (Shift: 10 px), [ and ] resize it; Enter or a double-click opens
//   · + and − zoom, Shift+0 is 100%, Shift+1 fits everything
//
// Every move and resize is ONE undoable change, and brings the cards it touched to the front. Where
// the camera looks is each viewer's own, kept in this browser.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FrameCorners, Minus, Plus } from '@/components/ds/icons';
import { Button, Icon, IconButton } from '@/components/ds/ui';
import { OVERLAY_CLASS } from '@/components/ds/ui/menu';
import { cn } from '@/lib/cn';
import {
  CANVAS_CARD_W, CANVAS_GAP, arrangement, boundsOf, boxesToSave, clampZoom, fitCamera, hitTest, moveBoxes, panBy, panToReveal,
  rectBetween, resizeBox, toScreen, toWorld, viewRect, zoomAt, type Camera, type CanvasBox, type CanvasBoxes, type Point, type Rect,
} from '@/lib/canvas';
import { boxesOf, resolveTags, type CollectionItem, type CollectionTag } from '@/lib/collection';
import { isTypingTarget } from '@/lib/list-keys';
import { masonryColumns } from '@/lib/masonry';
import type { LinkMeta } from '@/lib/unfurl';
import { CollectionCard, ItemActions } from './collection-card';

const HOME: Camera = { x: 40, y: 40, zoom: 1 };
/** Below this many, drawing everything costs less than working out what is on screen (§45). */
const DRAW_ALL_UNDER = 60;
/** How far beyond the frame is drawn anyway, in screen pixels, so a pan shows no hole. */
const OVERSCAN = 600;
const cameraKey = (key: string) => `zb:collection-camera:${key}`;

function readCamera(key: string): Camera | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(cameraKey(key)) ?? 'null') as Partial<Camera> | null;
    if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y) || !Number.isFinite(raw.zoom)) return null;
    return { x: raw.x!, y: raw.y!, zoom: clampZoom(raw.zoom!) };
  } catch {
    return null;
  }
}

type Gesture =
  | { kind: 'move'; pointerId: number; ids: string[]; start: Point; moved: boolean; collapseTo: string | null }
  | { kind: 'resize'; pointerId: number; id: string; startX: number; startW: number }
  | { kind: 'marquee'; pointerId: number; origin: Point; base: string[] }
  | { kind: 'pan'; pointerId: number; last: Point };

export function CollectionCanvas({ cameraKey: key, items, vocabulary, selected, onSelect, onOpen, onDelete, onPlace, onLearn, onShape }: {
  /** Whose camera this is — the Collection's page. */
  cameraKey: string;
  items: CollectionItem[];
  /** The Collection's tags, which the cards' tag ids name. */
  vocabulary?: readonly CollectionTag[];
  selected: ReadonlySet<string>;
  onSelect: (ids: Iterable<string>) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Write the arrangement down: every box, and the items to raise to the front — one undoable change. */
  onPlace: (boxes: CanvasBoxes, front: string[]) => void;
  onLearn: (id: string, url: string, meta: LinkMeta | null) => void;
  onShape: (id: string, shape: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [frameHeight, setFrameHeight] = useState(560);
  const [camera, setCamera] = useState<Camera>(() => readCamera(key) ?? HOME);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [moveBy, setMoveBy] = useState<{ ids: string[]; dx: number; dy: number } | null>(null);
  const [resizeTo, setResizeTo] = useState<{ id: string; w: number } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  // The frame fills the page below the Collection's bar, and a finger or a wheel over it moves the
  // canvas rather than the page.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => {
      const scroller = el.closest('.scroll-region');
      const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      // To the bottom of what shows: no gap under the canvas, so nothing marks where it ends.
      setFrameHeight(Math.max(420, Math.round(bottom - el.getBoundingClientRect().top)));
    };
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize((cur) => (cur.width === r.width && cur.height === r.height ? cur : { width: r.width, height: r.height }));
      fit();
    });
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // Where the camera looks is kept for next time, a moment after it stops moving.
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.localStorage.setItem(cameraKey(key), JSON.stringify(camera)); } catch { /* private window: forget it */ }
    }, 300);
    return () => clearTimeout(t);
  }, [key, camera]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const onHeight = useCallback((id: string, h: number) => {
    setHeights((cur) => (cur[id] === h ? cur : { ...cur, [id]: h }));
  }, []);
  const heightOf = useCallback((id: string) => heights[id] ?? CANVAS_CARD_W * (byId.get(id)?.shape ?? 0.75) + 64, [heights, byId]);

  const order = useMemo(() => items.map((i) => i.id), [items]);
  const saved = useMemo(() => boxesOf({ items }), [items]);
  const columns = masonryColumns(Math.max(0, size.width - HOME.x * 2), CANVAS_CARD_W, CANVAS_GAP);
  const laid = useMemo(() => arrangement(order, saved, heightOf, columns), [order, saved, heightOf, columns]);
  // What is drawn: the arrangement, with a gesture in progress applied to it.
  const shown = useMemo(() => {
    let boxes = laid;
    if (moveBy) boxes = moveBoxes(boxes, moveBy.ids, moveBy.dx, moveBy.dy);
    if (resizeTo && boxes[resizeTo.id]) boxes = { ...boxes, [resizeTo.id]: resizeBox(boxes[resizeTo.id], resizeTo.w) };
    return boxes;
  }, [laid, moveBy, resizeTo]);
  // Painted in layer order; newer items above older ones in the same layer.
  const layered = useMemo(
    () => items.map((item, index) => ({ item, index })).sort((a, b) => (a.item.canvas?.z ?? 0) - (b.item.canvas?.z ?? 0) || b.index - a.index),
    [items],
  );
  // Past a few dozen, only what the camera is looking at is drawn (§45): a card off screen still signs a URL
  // for its upload and may ask its link what it is. A card being moved is in `shown` at its moved place, so it
  // stays drawn wherever it is carried.
  const inView = useMemo(() => {
    if (items.length <= DRAW_ALL_UNDER) return null;
    return new Set(hitTest(viewRect(camera, size.width, size.height, OVERSCAN), shown, heightOf));
  }, [items.length, camera, size, shown, heightOf]);

  /** Write down where everything is, raising `front`. A card's measured height travels with its place. */
  const commit = (boxes: CanvasBoxes, front: string[]) => {
    const measured: CanvasBoxes = {};
    for (const [id, b] of Object.entries(boxes)) {
      const same = laid[id] && laid[id].w === b.w && heights[id] !== undefined;
      measured[id] = same ? { x: b.x, y: b.y, w: b.w, h: heights[id] } : { x: b.x, y: b.y, w: b.w };
    }
    onPlace(boxesToSave(measured, new Set(order)), front);
  };

  const zoomBy = (factor: number) => setCamera((c) => zoomAt(c, c.zoom * factor, size.width / 2, size.height / 2));
  const zoomTo = (zoom: number) => setCamera((c) => zoomAt(c, zoom, size.width / 2, size.height / 2));
  const fitAll = () => setCamera(fitCamera(boundsOf(shown, heightOf), size.width, size.height, 48));

  // A wheel moves the canvas, never the page under it — which needs a listener that may cancel.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const delta = Math.max(-50, Math.min(50, e.deltaY * unit));
        setCamera((c) => zoomAt(c, c.zoom * Math.exp(-delta * 0.01), e.clientX - rect.left, e.clientY - rect.top));
        return;
      }
      const sideways = e.shiftKey && !e.deltaX;
      setCamera((c) => panBy(c, -(sideways ? e.deltaY : e.deltaX) * unit, -(sideways ? 0 : e.deltaY) * unit));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]') || target.closest('[data-canvas-controls]')) return;
    const point = local(e);
    pointers.current.set(e.pointerId, point);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: camera.zoom };
      gesture.current = null;
      setMoveBy(null); setMarquee(null); setResizeTo(null);
      return;
    }
    viewportRef.current?.setPointerCapture(e.pointerId);
    const handle = target.closest('[data-resize-handle]')?.getAttribute('data-resize-handle');
    const itemId = target.closest('[data-canvas-item]')?.getAttribute('data-canvas-item') ?? null;
    if (handle && shown[handle]) {
      e.preventDefault();
      gesture.current = { kind: 'resize', pointerId: e.pointerId, id: handle, startX: e.clientX, startW: shown[handle].w };
      return;
    }
    if (e.button === 1 || spaceHeld || (e.pointerType === 'touch' && !itemId)) {
      e.preventDefault();
      gesture.current = { kind: 'pan', pointerId: e.pointerId, last: { x: e.clientX, y: e.clientY } };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    if (itemId) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      let ids: string[];
      let collapseTo: string | null = null;
      if (additive) {
        const next = new Set(selected);
        if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
        onSelect(next);
        ids = [...next];
      } else if (selected.has(itemId)) {
        ids = [...selected];
        // A plain click on one card of many selects just that card — once it is clear nothing is moving.
        if (selected.size > 1) collapseTo = itemId;
      } else {
        onSelect([itemId]);
        ids = [itemId];
      }
      gesture.current = { kind: 'move', pointerId: e.pointerId, ids, start: { x: e.clientX, y: e.clientY }, moved: false, collapseTo };
      return;
    }
    // The ground: a marquee, adding to the selection with Shift or ⌘.
    e.preventDefault();
    viewportRef.current?.focus();
    const origin = toWorld(camera, point.x, point.y);
    const base = e.shiftKey || e.metaKey || e.ctrlKey ? [...selected] : [];
    if (!base.length && selected.size) onSelect([]);
    gesture.current = { kind: 'marquee', pointerId: e.pointerId, origin, base };
    setMarquee({ x: origin.x, y: origin.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, local(e));
    const pinching = pinch.current;
    if (pinching && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const scale = Math.hypot(a.x - b.x, a.y - b.y) / pinching.distance;
      setCamera((c) => zoomAt(c, pinching.zoom * scale, (a.x + b.x) / 2, (a.y + b.y) / 2));
      return;
    }
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.kind === 'pan') {
      const dx = e.clientX - g.last.x;
      const dy = e.clientY - g.last.y;
      g.last = { x: e.clientX, y: e.clientY };
      setCamera((c) => panBy(c, dx, dy));
    } else if (g.kind === 'move') {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 4) return;
      g.moved = true;
      setMoveBy({ ids: g.ids, dx: dx / camera.zoom, dy: dy / camera.zoom });
    } else if (g.kind === 'resize') {
      setResizeTo({ id: g.id, w: g.startW + (e.clientX - g.startX) / camera.zoom });
    } else {
      const p = local(e);
      const rect = rectBetween(g.origin, toWorld(camera, p.x, p.y));
      setMarquee(rect);
      onSelect(new Set([...g.base, ...hitTest(rect, shown, heightOf)]));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (g.kind === 'pan') {
      setPanning(false);
    } else if (g.kind === 'move') {
      setMoveBy(null);
      if (g.moved) commit(moveBoxes(laid, g.ids, (e.clientX - g.start.x) / camera.zoom, (e.clientY - g.start.y) / camera.zoom), g.ids);
      else if (g.collapseTo) onSelect([g.collapseTo]);
    } else if (g.kind === 'resize') {
      setResizeTo(null);
      const box = laid[g.id];
      const w = g.startW + (e.clientX - g.startX) / camera.zoom;
      if (box && Math.abs(resizeBox(box, w).w - box.w) >= 1) commit({ ...laid, [g.id]: resizeBox(box, w) }, [g.id]);
    } else {
      setMarquee(null);
    }
  };

  const itemAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.('[data-canvas-item]')?.getAttribute('data-canvas-item') ?? null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(e.target) || (e.target as HTMLElement).closest('[data-no-drag], [data-canvas-controls]')) return;
    if (e.key === ' ') { e.preventDefault(); if (!e.repeat) setSpaceHeld(true); return; }
    if (e.key === 'Enter') {
      const id = itemAt(e.target) ?? (selected.size === 1 ? [...selected][0] : null);
      if (id) { e.preventDefault(); onOpen(id); }
      return;
    }
    const chosen = [...selected];
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (nudge[e.key] && chosen.length) {
      e.preventDefault();
      commit(moveBoxes(laid, chosen, nudge[e.key][0], nudge[e.key][1]), []);
      return;
    }
    if ((e.key === '[' || e.key === ']') && chosen.length) {
      e.preventDefault();
      const grow = e.key === ']' ? 20 : -20;
      const next: CanvasBoxes = { ...laid };
      for (const id of chosen) if (next[id]) next[id] = resizeBox(next[id], next[id].w + grow);
      commit(next, chosen);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomBy(1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(0.8); }
    else if (e.shiftKey && e.code === 'Digit0') { e.preventDefault(); zoomTo(1); }
    else if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitAll(); }
  };

  // Tabbing onto a card selects it, so the keyboard reaches everything a pointer does — and brings it
  // into sight by moving the camera, never by letting the frame scroll, which would shift every card
  // out from under the pointer.
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const id = itemAt(e.target);
    if (!id || gesture.current) return;
    if (!selected.has(id)) onSelect([id]);
    const box = shown[id];
    if (box) setCamera((c) => panToReveal(c, box, heightOf(id), size.width, size.height));
  };

  const dot = 24 * camera.zoom;
  const band = marquee && { a: toScreen(camera, marquee.x, marquee.y), b: toScreen(camera, marquee.x + marquee.w, marquee.y + marquee.h) };

  return (
    <div ref={viewportRef} data-collection-canvas role="listbox" aria-multiselectable aria-label="Canvas" tabIndex={0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
        const id = itemAt(e.target);
        if (id) onOpen(id);
      }}
      onKeyDown={onKeyDown} onKeyUp={(e) => { if (e.key === ' ') setSpaceHeld(false); }}
      onBlur={() => setSpaceHeld(false)} onFocus={onFocus}
      // A frame that hides its overflow can still be scrolled — by focus, by scrollIntoView. It never is.
      onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } }}
      className={cn(
        // No frame and no rounded box: a Collection's canvas is the rest of the pane (COLLECTION_INDEX_BRIEF §3). It
        // reaches past the page's side padding, which the page names `--collection-bleed`.
        'focus-ring relative touch-none select-none overflow-hidden border-t border-line-soft bg-well',
        panning ? 'cursor-grabbing' : spaceHeld ? 'cursor-grab' : 'cursor-default',
      )}
      style={{
        height: frameHeight,
        width: 'calc(100% + 2 * var(--collection-bleed, 0px))',
        marginInline: 'calc(-1 * var(--collection-bleed, 0px))',
        backgroundImage: 'radial-gradient(var(--color-line-soft) 1px, transparent 1px)',
        backgroundSize: `${dot}px ${dot}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
      }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
        {layered.map(({ item }) => {
          const box = shown[item.id];
          if (!box || (inView && !inView.has(item.id))) return null;
          const isSelected = selected.has(item.id);
          return (
            <CanvasItem key={item.id} item={item} box={box} zoom={camera.zoom} selected={isSelected}
              handle={isSelected && selected.size === 1} vocabulary={vocabulary}
              onHeight={onHeight} onLearn={onLearn} onShape={onShape} onOpen={onOpen} onDelete={onDelete} />
          );
        })}
      </div>
      {band && (
        <div aria-hidden className="pointer-events-none absolute border border-accent bg-accent-wash"
          style={{ left: band.a.x, top: band.a.y, width: band.b.x - band.a.x, height: band.b.y - band.a.y }} />
      )}
      {/* Bottom LEFT: the pane's bottom-right corner is where every toast appears (components/ds/ui/toast.tsx), and a
          canvas that reaches that corner put Zoom and Fit under an Undo toast for its eight seconds. */}
      <div data-canvas-controls className={cn(OVERLAY_CLASS, 'absolute bottom-3 left-3 flex items-center gap-0.5 p-0.5')}>
        <IconButton size="sm" label="Zoom out" icon={<Icon icon={Minus} size={16} />} onClick={() => zoomBy(0.8)} />
        <Button size="sm" variant="ghost" className="min-w-[52px] tabular-nums" aria-label="Zoom to 100%" onClick={() => zoomTo(1)}>
          {Math.round(camera.zoom * 100)}%
        </Button>
        <IconButton size="sm" label="Zoom in" icon={<Icon icon={Plus} size={16} />} onClick={() => zoomBy(1.25)} />
        <IconButton size="sm" label="Fit everything" icon={<Icon icon={FrameCorners} size={16} />} onClick={fitAll} />
      </div>
    </div>
  );
}

/**
 * One card on the canvas, memoised on props a pan never changes. A pan moves the CAMERA, which is one
 * transform on the world above; it used to re-render every card as well, because each render handed each
 * card a fresh tags array, a fresh menu element and a fresh gestures object. Measured with 50 cards drawn:
 * 20.6ms of handlers per pointer move while panning (137.6ms worst), over a 16.7ms frame on every move.
 * Now a pan re-renders the world's transform and nothing under it, and a card drag re-renders the cards
 * that moved (a box that did not move keeps its identity).
 */
const CanvasItem = memo(function CanvasItem({ item, box, zoom, selected, handle, vocabulary, onHeight, onLearn, onShape, onOpen, onDelete }: {
  item: CollectionItem; box: CanvasBox; zoom: number; selected: boolean; handle: boolean;
  vocabulary?: readonly CollectionTag[];
  onHeight: (id: string, height: number) => void;
  onLearn: (id: string, url: string, meta: LinkMeta | null) => void;
  onShape: (id: string, shape: number) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <CanvasCell id={item.id} box={box} zoom={zoom} handle={handle} onHeight={onHeight}>
      <CollectionCard item={item} tags={resolveTags(vocabulary, item.tags)} selected={selected} onLearn={onLearn} onShape={onShape}
        menu={<ItemActions item={item} onOpen={onOpen} onDelete={onDelete} />}
        gestures={{ role: 'option', 'aria-selected': selected }} />
    </CanvasCell>
  );
});

/** One placed card: where it is, how wide, and — when it is the one selected — its resize handle. */
function CanvasCell({ id, box, zoom, handle, onHeight, children }: {
  id: string; box: CanvasBox; zoom: number; handle: boolean;
  onHeight: (id: string, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const b = entries[0]?.borderBoxSize?.[0];
      onHeight(id, Math.round(b ? b.blockSize : el.offsetHeight));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, onHeight]);
  return (
    <div ref={ref} data-canvas-item={id} className="absolute left-0 top-0" style={{ width: box.w, transform: `translate(${box.x}px, ${box.y}px)` }}>
      {children}
      {handle && (
        // Drawn at the same size whatever the zoom, so it can always be grabbed. A finger needs more than the
        // drawn square (WCAG 2.5.5): on a coarse pointer an invisible 44px grip reaches out past the corner,
        // over open canvas, and only 11px into the card, so the card's own corner still moves it.
        <span data-resize-handle={id} aria-hidden
          className={cn(
            'absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-xs border border-accent bg-surface-raised',
            "[@media(pointer:coarse)]:after:absolute [@media(pointer:coarse)]:after:-left-1.5 [@media(pointer:coarse)]:after:-top-1.5 [@media(pointer:coarse)]:after:size-11 [@media(pointer:coarse)]:after:content-['']",
          )}
          style={{ transform: `scale(${1 / zoom})` }} />
      )}
    </div>
  );
}
